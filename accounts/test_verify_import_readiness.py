from unittest.mock import MagicMock, patch
from pathlib import Path

from django.test import SimpleTestCase

from accounts.management.commands.verify_import_readiness import (
    Command,
    TARGET_TABLES,
    MISSING_ROLES_TO_CREATE,
)


class VerifyImportReadinessUnitTests(SimpleTestCase):
    """Unit tests for verify_import_readiness command using mocks (strictly zero remote network calls)."""

    def test_anti_localhost_protection(self):
        """Verifies that localhost, 127.0.0.1, and ::1 are immediately rejected."""
        cmd = Command()
        for bad_host in ('localhost', '127.0.0.1', '::1', ''):
            conn = cmd._connect_supabase({
                'host': bad_host,
                'port': '5432',
                'dbname': 'postgres',
                'user': 'postgres',
                'sslmode': 'require'
            })
            self.assertIsNone(conn, f"Command should have rejected connection to {bad_host}")

    @patch('accounts.management.commands.verify_import_readiness.getpass.getpass', return_value='secret')
    @patch('accounts.management.commands.verify_import_readiness.psycopg.connect')
    def test_tls_verification_success_with_driver_ssl(self, mock_connect, mock_getpass):
        """Verifies that TLS verification succeeds when driver TLS (conn.pgconn.ssl_in_use) is active."""
        mock_conn = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.pgconn.ssl_in_use = True

        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        mock_cur.fetchone.return_value = (True, 'TLSv1.3', 'TLS_AES_256_GCM_SHA384')

        cmd = Command()
        conn = cmd._connect_supabase({
            'host': 'aws-0-ap-south-1.pooler.supabase.com',
            'port': '5432',
            'dbname': 'postgres',
            'user': 'postgres',
            'sslmode': 'require'
        })
        self.assertIsNotNone(conn)

    @patch('accounts.management.commands.verify_import_readiness.getpass.getpass', return_value='secret')
    @patch('accounts.management.commands.verify_import_readiness.psycopg.connect')
    def test_tls_verification_failure_when_unencrypted(self, mock_connect, mock_getpass):
        """Verifies that connection is rejected when neither driver nor server TLS is active."""
        mock_conn = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.pgconn.ssl_in_use = False

        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        mock_cur.fetchone.return_value = (False, None, None)

        cmd = Command()
        conn = cmd._connect_supabase({
            'host': 'aws-0-ap-south-1.pooler.supabase.com',
            'port': '5432',
            'dbname': 'postgres',
            'user': 'postgres',
            'sslmode': 'require'
        })
        self.assertIsNone(conn)
        mock_conn.close.assert_called_once()

    def test_option_b_role_merge_and_missing_roles(self):
        """Verifies Option B role logic: VENDOR (10) and Vendor (7) map to remote 1; 8 roles pending."""
        cmd = Command()

        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur

        # Mock constraint query return, attribute collation return, and remote roles return
        mock_cur.fetchall.side_effect = [
            [('tbl_role_name_key', 'UNIQUE (name)')],         # unique constraints
            [(1, 'Vendor', 'Approved Supplier', True)],        # remote roles
        ]
        mock_cur.fetchone.return_value = ('name', None)       # collation info

        fixture_json = [
            {'model': 'accounts.role', 'pk': 7, 'fields': {'name': 'Vendor'}},
            {'model': 'accounts.role', 'pk': 10, 'fields': {'name': 'VENDOR'}},
            {'model': 'accounts.user', 'pk': 27, 'fields': {'role': 7}},
            {'model': 'accounts.user', 'pk': 28, 'fields': {'role': 7}},
        ]

        result = cmd._validate_option_b_roles(mock_conn, fixture_json)

        # 0 users pointing to role 10
        self.assertEqual(len(result['users_pointing_to_10']), 0)
        # Exactly 1 remote role ('Vendor')
        self.assertIn('Vendor', result['remote_by_name'])
        self.assertEqual(result['remote_by_name']['Vendor'], 1)

        # All 8 missing roles should be marked as pending creation
        pending_names = [r['name'] for r in result['missing_roles_status'] if not r['exists']]
        self.assertEqual(len(pending_names), 8)
        self.assertEqual(set(pending_names), set(MISSING_ROLES_TO_CREATE))

    def test_fk_graph_cycle_detection_and_topological_sort(self):
        """Verifies that Kahn's algorithm proves the 18 target tables form an acyclic graph (DAG)."""
        cmd = Command()

        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur

        # Catalog FK rows simulating Django model relationships
        simulated_fks = [
            ('fk_user_role', 'tbl_user', 'role_id', 'tbl_role', 'id', 'n'),
            ('fk_user_dept', 'tbl_user', 'department_id', 'tbl_department', 'id', 'n'),
            ('fk_user_created_by', 'tbl_user', 'created_by_id', 'tbl_user', 'id', 'n'), # self
            ('fk_audit_user', 'tbl_audit_log', 'user_id', 'tbl_user', 'id', 'n'),
            ('fk_app_user', 'tbl_vendor_application', 'reviewed_by_id', 'tbl_user', 'id', 'n'),
            ('fk_vendor_user', 'tbl_vendor', 'user_id', 'tbl_user', 'id', 'c'),
            ('fk_vendor_app', 'tbl_vendor', 'application_id', 'tbl_vendor_application', 'id', 'n'),
            ('fk_vsc_vendor', 'tbl_vendor_supplier_categories', 'vendor_id', 'tbl_vendor', 'id', 'c'),
            ('fk_vsc_cat', 'tbl_vendor_supplier_categories', 'suppliercategory_id', 'tbl_supplier_category', 'id', 'c'),
            ('fk_vasc_app', 'tbl_vendor_application_supplier_categories', 'vendorapplication_id', 'tbl_vendor_application', 'id', 'c'),
            ('fk_vasc_cat', 'tbl_vendor_application_supplier_categories', 'suppliercategory_id', 'tbl_supplier_category', 'id', 'c'),
            ('fk_prod_vendor', 'tbl_vendor_product', 'vendor_id', 'tbl_vendor', 'id', 'c'),
            ('fk_prod_cat', 'tbl_vendor_product', 'category_id', 'tbl_supplier_category', 'id', 'r'),
            ('fk_req_dept', 'tbl_requisition', 'department_id', 'tbl_department', 'id', 'c'),
            ('fk_req_user', 'tbl_requisition', 'requested_by_id', 'tbl_user', 'id', 'n'),
            ('fk_reqitem_req', 'tbl_requisition_item', 'requisition_id', 'tbl_requisition', 'id', 'c'),
            ('fk_appr_req', 'tbl_approval', 'requisition_id', 'tbl_requisition', 'id', 'c'),
            ('fk_appr_user', 'tbl_approval', 'approved_by_id', 'tbl_user', 'id', 'n'),
            ('fk_tech_req', 'tbl_technical_evaluation', 'requisition_id', 'tbl_requisition', 'id', 'c'),
            ('fk_tech_user', 'tbl_technical_evaluation', 'evaluated_by_id', 'tbl_user', 'id', 'n'),
            ('fk_rfq_req', 'tbl_quotation_request', 'requisition_id', 'tbl_requisition', 'id', 'c'),
            ('fk_rfq_user', 'tbl_quotation_request', 'created_by_id', 'tbl_user', 'id', 'n'),
            ('fk_rfqi_rfq', 'tbl_rfq_item', 'quotation_request_id', 'tbl_quotation_request', 'id', 'c'),
            ('fk_rfqi_item', 'tbl_rfq_item', 'requisition_item_id', 'tbl_requisition_item', 'id', 'c'),
            ('fk_rfqv_rfq', 'tbl_rfq_vendor_invitation', 'quotation_request_id', 'tbl_quotation_request', 'id', 'c'),
            ('fk_rfqv_vendor', 'tbl_rfq_vendor_invitation', 'vendor_id', 'tbl_vendor', 'id', 'c'),
        ]
        mock_cur.fetchall.return_value = simulated_fks

        graph = cmd._validate_fk_dependency_graph(mock_conn)

        self.assertFalse(graph['has_cycle'], "The 18 tables must be proven to form an acyclic DAG.")
        self.assertEqual(len(graph['topological_order']), len(TARGET_TABLES))
        self.assertEqual(len(graph['self_references']), 1)
        self.assertEqual(graph['self_references'][0][0], 'tbl_user')

        # Verify topological precedence: parent tables precede child tables
        order = graph['topological_order']
        self.assertLess(order.index('tbl_role'), order.index('tbl_user'))
        self.assertLess(order.index('tbl_department'), order.index('tbl_user'))
        self.assertLess(order.index('tbl_user'), order.index('tbl_vendor'))
        self.assertLess(order.index('tbl_vendor_application'), order.index('tbl_vendor'))
        self.assertLess(order.index('tbl_vendor'), order.index('tbl_vendor_product'))
        self.assertLess(order.index('tbl_requisition'), order.index('tbl_approval'))

    def test_sequence_ownership_and_state_inspection(self):
        """Verifies sequence ownership checking, non-mutating state inspection, and sync target calculation."""
        cmd = Command()

        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur

        def mock_execute(query, params=None):
            pass

        def mock_fetchone():
            return ('tbl_user_id_seq', 'a')

        # Provide side effects for the loop over tables
        mock_cur.fetchone.side_effect = [
            # tbl_role: seq_name, priv, (last_val, is_called), properties
            ('tbl_role_id_seq', 'a'), (True,), (1, True), (1, 1, 9223372036854775807, False),
            # tbl_department
            ('tbl_department_id_seq', 'a'), (True,), (15, True), (1, 1, 9223372036854775807, False),
            # tbl_supplier_category
            ('tbl_supplier_category_id_seq', 'a'), (True,), (14, True), (1, 1, 9223372036854775807, False),
            # tbl_system_setting
            ('tbl_system_setting_id_seq', 'a'), (True,), (1, False), (1, 1, 9223372036854775807, False),
            # tbl_user: expected max is 50, last_val is 1 -> needs sync to 50
            ('tbl_user_id_seq', 'a'), (True,), (1, False), (1, 1, 9223372036854775807, False),
        ] + [
            # generic for remaining 13 tables
            ('generic_seq', 'a'), (True,), (100, True), (1, 1, 9223372036854775807, False),
        ] * 13

        fixture_json = [
            {'model': 'accounts.user', 'pk': 50, 'fields': {}},
            {'model': 'accounts.systemsetting', 'pk': 1, 'fields': {}},
        ]

        seq_res = cmd._validate_sequences(mock_conn, fixture_json)

        self.assertTrue(seq_res['all_have_priv'])
        self.assertTrue(seq_res['all_inc_1'])
        self.assertEqual(len(seq_res['reports']), 18)

        # tbl_user report
        user_rep = next(r for r in seq_res['reports'] if r['table'] == 'tbl_user')
        self.assertEqual(user_rep['sequence'], 'tbl_user_id_seq')
        self.assertTrue(user_rep['will_need_sync'])
        self.assertEqual(user_rep['sync_target'], 50)

    def test_fixture_reference_validation_with_option_b(self):
        """Verifies that Option B cleanly remaps vendor roles and leaves 0 unmappable errors."""
        cmd = Command()

        simulated_fixture = [
            # Vendor user with role 7 -> mapped to remote 1
            {'model': 'accounts.user', 'pk': 27, 'fields': {'role': 7, 'department': None}},
            # Internal user with role 3 -> marked pending creation
            {'model': 'accounts.user', 'pk': 2, 'fields': {'role': 3, 'department': 27}},
            # Requisition pointing to department 27 -> remapped to remote 13
            {'model': 'procurement.requisition', 'pk': 37, 'fields': {'department': 27}},
            # Vendor product pointing to category 2 -> remapped to remote 3
            {'model': 'vendors.vendorproduct', 'pk': 1, 'fields': {'category': 2}},
        ]

        res = cmd._validate_fixture_references_with_option_b(simulated_fixture, {})

        self.assertEqual(res['user_role_mapped'], 1)
        self.assertEqual(res['user_role_pending'], 1)
        self.assertEqual(len(res['unmappable_errors']), 0)
