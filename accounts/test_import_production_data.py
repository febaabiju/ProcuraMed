from unittest.mock import MagicMock, patch
from pathlib import Path
import re

from django.test import SimpleTestCase
from django.core.management.base import CommandError

from accounts.management.commands.import_production_data import (
    Command,
    TARGET_TABLES,
    ImportValidationError,
)


class ImportProductionDataUnitTests(SimpleTestCase):
    """Unit tests for import_production_data management command proving strict read-only dry-run safety."""

    def test_mutually_exclusive_dry_run_and_execute_flags(self):
        """Verifies that passing both --dry-run and --execute simultaneously raises CommandError."""
        cmd = Command()
        with self.assertRaises(CommandError) as ctx:
            cmd.handle(execute=True, dry_run=True)
        self.assertIn('Cannot specify both --dry-run and --execute simultaneously', str(ctx.exception))

    def test_anti_localhost_protection(self):
        """Verifies that localhost / loopback targets are rejected."""
        cmd = Command()
        for bad_host in ('localhost', '127.0.0.1', '::1'):
            with self.assertRaises(CommandError):
                cmd._connect_supabase({'host': bad_host, 'port': '5432', 'dbname': 'postgres', 'user': 'postgres', 'sslmode': 'require'})

    def test_dry_run_executes_no_write_sql_and_no_sequence_mutations(self):
        """Proves that dry-run mode executes ONLY read queries: zero INSERT/UPDATE/DELETE/nextval/setval."""
        cmd = Command()
        executed_queries = []

        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur

        def spy_execute(query, params=None):
            q_str = str(query)
            executed_queries.append(q_str)

        mock_cur.execute.side_effect = spy_execute
        mock_cur.fetchone.return_value = (0,)
        mock_cur.fetchall.return_value = []

        # Simulate dry-run checks
        fixture_data = {
            'model_records': {
                'accounts.user': [
                    {'pk': 1, 'fields': {'username': 'admin', 'employee_id': 'EMP001'}},
                ],
                'vendors.vendor': [],
                'accounts.systemsetting': [],
                'procurement.quotationrequest': [],
            }
        }
        cmd._verify_remote_unique_constraints(mock_conn, fixture_data, {})

        # Assert no write DML or sequence calls
        for q in executed_queries:
            q_upper = q.strip().upper()
            self.assertFalse(q_upper.startswith('INSERT'), f"Forbidden write query: {q}")
            self.assertFalse(q_upper.startswith('UPDATE'), f"Forbidden write query: {q}")
            self.assertFalse(q_upper.startswith('DELETE'), f"Forbidden write query: {q}")
            self.assertNotIn('NEXTVAL', q_upper, f"Forbidden sequence mutation: {q}")
            self.assertNotIn('SETVAL', q_upper, f"Forbidden sequence mutation: {q}")

    def test_missing_role_or_dept_mapping_raises_validation_error(self):
        """Verifies that unmappable foreign keys trigger ImportValidationError (no silent drops)."""
        cmd = Command()

        fixture_data = {
            'model_records': {
                'accounts.user': [
                    {'pk': 10, 'fields': {'role': 999, 'department': None}},  # Unmapped role 999
                ],
                'procurement.requisition': [],
                'vendors.vendorproduct': [],
                'vendors.vendor': [],
                'vendors.vendorapplication': [],
            }
        }

        ref_mappings = {
            'dept_map': {},
            'cat_map': {},
            'role_map': {7: 1},  # Role 999 missing
        }

        with self.assertRaises(ImportValidationError) as ctx:
            cmd._validate_remapping(fixture_data, ref_mappings)
        self.assertIn('unmappable role=999', str(ctx.exception))

    def test_unique_constraint_conflict_raises_error(self):
        """Verifies that an existing remote duplicate (e.g. username collision) triggers an error."""
        cmd = Command()
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur

        # Remote returns an existing duplicate username
        mock_cur.fetchall.return_value = [('admin',)]

        fixture_data = {
            'model_records': {
                'accounts.user': [{'pk': 1, 'fields': {'username': 'admin'}}],
                'vendors.vendor': [],
                'accounts.systemsetting': [],
                'procurement.quotationrequest': [],
            }
        }

        with self.assertRaises(ImportValidationError) as ctx:
            cmd._verify_remote_unique_constraints(mock_conn, fixture_data, {})
        self.assertIn('Username unique constraint conflict', str(ctx.exception))

    def test_unexpected_remote_count_raises_error(self):
        """Verifies that if remote department/category/role count does not match expected, it fails safely."""
        cmd = Command()
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur

        # Mock remote counts query returning 30 instead of 22
        mock_cur.fetchone.return_value = (5,)  # 5 * 18 = 90 rows (unexpected!)

        fixture_data = {}
        with self.assertRaises(ImportValidationError) as ctx:
            cmd._reconcile_counts(mock_conn, fixture_data, {})
        self.assertIn('Expected 22 existing remote reference rows', str(ctx.exception))

    def test_insertion_order_validation(self):
        """Verifies that User 1 must precede all users and have created_by=None."""
        cmd = Command()

        # Case A: Valid ordering (User 1 has created_by=None, User 2 points to admin)
        valid_fixture = {
            'model_records': {
                'accounts.user': [
                    {'pk': 1, 'fields': {'username': 'admin', 'created_by': None}},
                    {'pk': 2, 'fields': {'username': 'staff', 'created_by': ['admin']}},
                ],
                'vendors.vendorapplication': [{'pk': 3, 'fields': {}}],
                'vendors.vendor': [{'pk': 2, 'fields': {'application': 3}}],
            }
        }
        res = cmd._validate_insertion_order(valid_fixture, {})
        self.assertEqual(res['sorted_users'][0]['pk'], 1)

        # Case B: Invalid ordering (User 1 has non-null created_by)
        invalid_fixture = {
            'model_records': {
                'accounts.user': [
                    {'pk': 1, 'fields': {'username': 'admin', 'created_by': ['someone_else']}},
                ],
                'vendors.vendorapplication': [],
                'vendors.vendor': [],
            }
        }
        with self.assertRaises(ImportValidationError):
            cmd._validate_insertion_order(invalid_fixture, {})

    def test_full_fixture_count_reconciliation_math(self):
        """Validates the exact math: 270 models + 22 M2M = 292 fixture; 269 inserts + 22 remote = 291 final."""
        fixture_path = Path(r"F:\ProcuraMed_Backups\procuramed_prod_data.json")
        if not fixture_path.exists():
            self.skipTest(f"Fixture not found at {fixture_path}")

        cmd = Command()
        with open(fixture_path, 'r', encoding='utf-8') as f:
            data = __import__('json').load(f)

        parsed = cmd._validate_and_parse_fixture(data)

        # 16 models present
        self.assertEqual(len(parsed['model_counts']), 16)
        # Exactly 270 model objects
        self.assertEqual(sum(parsed['model_counts'].values()), 270)
        # Exactly 22 M2M pairs
        self.assertEqual(len(parsed['vendor_m2m']) + len(parsed['vendor_app_m2m']), 22)
        # Exactly 26 users
        self.assertEqual(len(parsed['model_records']['accounts.user']), 26)
        # Exactly 8 requisitions
        self.assertEqual(len(parsed['model_records']['procurement.requisition']), 8)
        # Exactly 6 vendor products
        self.assertEqual(len(parsed['model_records']['vendors.vendorproduct']), 6)

    def test_system_setting_actual_fixture_structure_passes_unique_check(self):
        """Regression test: Proves SystemSetting with actual production fixture structure (no 'key' field) passes without KeyError."""
        cmd = Command()
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        mock_cur.fetchall.return_value = []  # No collisions

        actual_system_setting_record = {
            'model': 'accounts.systemsetting',
            'pk': 1,
            'fields': {
                'hospital_name': 'ProcuraMed Hospital Center',
                'hospital_email': 'admin@procuramed.com',
                'hospital_phone': '+91 98765 43210',
                'hospital_address': '123 Healthcare Ave, Medical City',
                'min_password_length': 8,
                'session_timeout': 60,
                'require_password_change': False,
                'email_notifications': True,
                'vendor_approval_emails': True,
                'vendor_rejection_emails': True,
                'new_user_credential_emails': True,
                'enable_purchase_requisition': True,
                'enable_vendor_quotations': True,
                'enable_purchase_order_processing': True,
                'updated_at': '2026-10-22T19:54:30.932Z',
                'updated_by': 1,
            }
        }

        fixture_data = {
            'model_records': {
                'accounts.user': [],
                'vendors.vendor': [],
                'accounts.systemsetting': [actual_system_setting_record],
                'procurement.quotationrequest': [],
                'procurement.requisition': [],
            }
        }

        # Must not raise KeyError: 'key' or any exception
        cmd._verify_remote_unique_constraints(mock_conn, fixture_data, {})

        # Verify that tbl_system_setting.id was checked
        mock_cur.execute.assert_called_with(
            "SELECT id FROM tbl_system_setting WHERE id = ANY(%s);",
            ([1],)
        )

    def test_system_setting_missing_pk_raises_validation_error(self):
        """Verifies that SystemSetting fixture record missing 'pk' fails with a clear diagnostic."""
        cmd = Command()
        mock_conn = MagicMock()
        fixture_data = {
            'model_records': {
                'accounts.user': [],
                'vendors.vendor': [],
                'accounts.systemsetting': [
                    {'model': 'accounts.systemsetting', 'fields': {'hospital_name': 'Test Hospital'}}
                ],
                'procurement.quotationrequest': [],
                'procurement.requisition': [],
            }
        }
        with self.assertRaises(ImportValidationError) as ctx:
            cmd._verify_remote_unique_constraints(mock_conn, fixture_data, {})
        self.assertIn("missing valid integer 'pk'", str(ctx.exception))

    def test_system_setting_missing_fields_dict_raises_validation_error(self):
        """Verifies that SystemSetting fixture record with malformed 'fields' fails with clear diagnostic."""
        cmd = Command()
        mock_conn = MagicMock()
        fixture_data = {
            'model_records': {
                'accounts.user': [],
                'vendors.vendor': [],
                'accounts.systemsetting': [
                    {'model': 'accounts.systemsetting', 'pk': 1, 'fields': None}
                ],
                'procurement.quotationrequest': [],
                'procurement.requisition': [],
            }
        }
        with self.assertRaises(ImportValidationError) as ctx:
            cmd._verify_remote_unique_constraints(mock_conn, fixture_data, {})
        self.assertIn("missing valid 'fields' dict", str(ctx.exception))

    def test_system_setting_missing_hospital_name_raises_validation_error(self):
        """Verifies that SystemSetting fixture record missing 'hospital_name' fails with clear diagnostic."""
        cmd = Command()
        mock_conn = MagicMock()
        fixture_data = {
            'model_records': {
                'accounts.user': [],
                'vendors.vendor': [],
                'accounts.systemsetting': [
                    {'model': 'accounts.systemsetting', 'pk': 1, 'fields': {'session_timeout': 60}}
                ],
                'procurement.quotationrequest': [],
                'procurement.requisition': [],
            }
        }
        with self.assertRaises(ImportValidationError) as ctx:
            cmd._verify_remote_unique_constraints(mock_conn, fixture_data, {})
        self.assertIn("missing expected field 'hospital_name'", str(ctx.exception))

    def test_system_setting_pk_conflict_raises_validation_error(self):
        """Verifies that existing remote SystemSetting (id=1) raises unique conflict error."""
        cmd = Command()
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        mock_cur.fetchall.return_value = [(1,)]

        fixture_data = {
            'model_records': {
                'accounts.user': [],
                'vendors.vendor': [],
                'accounts.systemsetting': [
                    {'model': 'accounts.systemsetting', 'pk': 1, 'fields': {'hospital_name': 'Test'}}
                ],
                'procurement.quotationrequest': [],
                'procurement.requisition': [],
            }
        }
        with self.assertRaises(ImportValidationError) as ctx:
            cmd._verify_remote_unique_constraints(mock_conn, fixture_data, {})
        self.assertIn('SystemSetting primary key unique constraint conflict on tbl_system_setting.id', str(ctx.exception))

    def test_user_missing_required_username_raises_validation_error(self):
        """Verifies that User fixture record missing 'username' raises ImportValidationError."""
        cmd = Command()
        mock_conn = MagicMock()
        fixture_data = {
            'model_records': {
                'accounts.user': [{'pk': 1, 'fields': {'email': 'admin@test.com'}}],
                'vendors.vendor': [],
                'accounts.systemsetting': [],
                'procurement.quotationrequest': [],
                'procurement.requisition': [],
            }
        }
        with self.assertRaises(ImportValidationError) as ctx:
            cmd._verify_remote_unique_constraints(mock_conn, fixture_data, {})
        self.assertIn("missing required 'username' field", str(ctx.exception))

    def test_vendor_missing_vendor_code_field_raises_validation_error(self):
        """Verifies that Vendor fixture record missing 'vendor_code' raises ImportValidationError."""
        cmd = Command()
        mock_conn = MagicMock()
        fixture_data = {
            'model_records': {
                'accounts.user': [],
                'vendors.vendor': [{'pk': 1, 'fields': {'company_name': 'Test Co'}}],
                'accounts.systemsetting': [],
                'procurement.quotationrequest': [],
                'procurement.requisition': [],
            }
        }
        with self.assertRaises(ImportValidationError) as ctx:
            cmd._verify_remote_unique_constraints(mock_conn, fixture_data, {})
        self.assertIn("missing expected 'vendor_code' field", str(ctx.exception))

    def test_requisition_uses_req_number_and_detects_collision(self):
        """Verifies that Requisition uses req_number (not requisition_number) and catches collision."""
        cmd = Command()
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        mock_cur.fetchall.return_value = [('REQ-2026-00001',)]

        fixture_data = {
            'model_records': {
                'accounts.user': [],
                'vendors.vendor': [],
                'accounts.systemsetting': [],
                'procurement.quotationrequest': [],
                'procurement.requisition': [
                    {'pk': 37, 'fields': {'req_number': 'REQ-2026-00001'}}
                ],
            }
        }
        with self.assertRaises(ImportValidationError) as ctx:
            cmd._verify_remote_unique_constraints(mock_conn, fixture_data, {})
        self.assertIn('Requisition number unique constraint conflict on tbl_requisition.req_number', str(ctx.exception))
        mock_cur.execute.assert_called_with(
            "SELECT req_number FROM tbl_requisition WHERE req_number = ANY(%s);",
            (['REQ-2026-00001'],)
        )

    def test_requisition_missing_req_number_raises_validation_error(self):
        """Verifies that Requisition missing req_number raises ImportValidationError."""
        cmd = Command()
        mock_conn = MagicMock()
        fixture_data = {
            'model_records': {
                'accounts.user': [],
                'vendors.vendor': [],
                'accounts.systemsetting': [],
                'procurement.quotationrequest': [],
                'procurement.requisition': [
                    {'pk': 37, 'fields': {'title': 'Sample Requisition'}}
                ],
            }
        }
        with self.assertRaises(ImportValidationError) as ctx:
            cmd._verify_remote_unique_constraints(mock_conn, fixture_data, {})
        self.assertIn("missing required 'req_number' field", str(ctx.exception))

    def test_quotation_request_missing_rfq_number_raises_validation_error(self):
        """Verifies that QuotationRequest missing rfq_number raises ImportValidationError."""
        cmd = Command()
        mock_conn = MagicMock()
        fixture_data = {
            'model_records': {
                'accounts.user': [],
                'vendors.vendor': [],
                'accounts.systemsetting': [],
                'procurement.quotationrequest': [
                    {'pk': 2, 'fields': {'title': 'Sample RFQ'}}
                ],
                'procurement.requisition': [],
            }
        }
        with self.assertRaises(ImportValidationError) as ctx:
            cmd._verify_remote_unique_constraints(mock_conn, fixture_data, {})
        self.assertIn("missing required 'rfq_number' field", str(ctx.exception))

    def test_vendor_natural_key_reference_resolves_and_checks_remote_unique(self):
        """Regression test: Proves vendor user natural key ['ven_1001'] resolves to user PK 21 and checks remote uniqueness."""
        cmd = Command()
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        mock_cur.fetchall.return_value = []

        fixture_data = {
            'model_records': {
                'accounts.user': [
                    {'pk': 21, 'fields': {'username': 'ven_1001'}},
                    {'pk': 10, 'fields': {'username': 'ven_1002'}},
                ],
                'vendors.vendor': [
                    {'pk': 2, 'fields': {'vendor_code': 'VEN-2026-00001', 'user': ['ven_1001'], 'application': 3}},
                    {'pk': 10, 'fields': {'vendor_code': 'VEN-2026-00009', 'user': ['ven_1002'], 'application': 9}},
                ],
                'accounts.systemsetting': [],
                'procurement.quotationrequest': [],
                'procurement.requisition': [],
            }
        }

        # Must not raise ImportValidationError or KeyError
        cmd._verify_remote_unique_constraints(mock_conn, fixture_data, {})

        # Verify that tbl_vendor.user_id was checked with resolved PKs [21, 10]
        mock_cur.execute.assert_any_call(
            "SELECT user_id FROM tbl_vendor WHERE user_id = ANY(%s);",
            ([21, 10],)
        )

    def test_vendor_natural_key_reference_detects_remote_collision(self):
        """Verifies that if resolved user_id collides remotely, ImportValidationError is raised."""
        cmd = Command()
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur

        def mock_fetchall():
            calls = mock_cur.execute.call_args_list
            if calls and 'tbl_vendor WHERE user_id' in str(calls[-1]):
                return [(21,)]
            return []
        mock_cur.fetchall.side_effect = mock_fetchall

        fixture_data = {
            'model_records': {
                'accounts.user': [
                    {'pk': 21, 'fields': {'username': 'ven_1001'}},
                ],
                'vendors.vendor': [
                    {'pk': 2, 'fields': {'vendor_code': 'VEN-2026-00001', 'user': ['ven_1001']}},
                ],
                'accounts.systemsetting': [],
                'procurement.quotationrequest': [],
                'procurement.requisition': [],
            }
        }

        with self.assertRaises(ImportValidationError) as ctx:
            cmd._verify_remote_unique_constraints(mock_conn, fixture_data, {})
        self.assertIn("Vendor user_id 1-to-1 unique constraint conflict on tbl_vendor.user_id: [21]", str(ctx.exception))

    def test_vendor_integer_user_reference_resolves_correctly(self):
        """Verifies that integer PK references (e.g. user=21) resolve correctly when user exists."""
        cmd = Command()
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        mock_cur.fetchall.return_value = []

        fixture_data = {
            'model_records': {
                'accounts.user': [{'pk': 21, 'fields': {'username': 'ven_1001'}}],
                'vendors.vendor': [{'pk': 2, 'fields': {'vendor_code': 'VEN-001', 'user': 21}}],
                'accounts.systemsetting': [],
                'procurement.quotationrequest': [],
                'procurement.requisition': [],
            }
        }
        cmd._verify_remote_unique_constraints(mock_conn, fixture_data, {})
        mock_cur.execute.assert_any_call(
            "SELECT user_id FROM tbl_vendor WHERE user_id = ANY(%s);",
            ([21],)
        )

    def test_vendor_integer_user_reference_missing_user_raises_error(self):
        """Verifies that integer PK referencing non-existent user raises ImportValidationError."""
        cmd = Command()
        mock_conn = MagicMock()
        fixture_data = {
            'model_records': {
                'accounts.user': [{'pk': 1, 'fields': {'username': 'admin'}}],
                'vendors.vendor': [{'pk': 2, 'fields': {'vendor_code': 'VEN-001', 'user': 9999}}],
                'accounts.systemsetting': [],
                'procurement.quotationrequest': [],
                'procurement.requisition': [],
            }
        }
        with self.assertRaises(ImportValidationError) as ctx:
            cmd._verify_remote_unique_constraints(mock_conn, fixture_data, {})
        self.assertIn("references non-existent user PK: 9999", str(ctx.exception))

    def test_vendor_null_user_reference_allowed(self):
        """Verifies that user=None (nullable OneToOneField) is safely accepted."""
        cmd = Command()
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        mock_cur.fetchall.return_value = []

        fixture_data = {
            'model_records': {
                'accounts.user': [],
                'vendors.vendor': [{'pk': 2, 'fields': {'vendor_code': 'VEN-001', 'user': None}}],
                'accounts.systemsetting': [],
                'procurement.quotationrequest': [],
                'procurement.requisition': [],
            }
        }
        cmd._verify_remote_unique_constraints(mock_conn, fixture_data, {})
        # Ensure user_id query was NOT called because no user_ids to check
        for call in mock_cur.execute.call_args_list:
            self.assertNotIn("user_id = ANY", str(call))

    def test_vendor_missing_user_natural_key_raises_error(self):
        """Verifies that natural key referencing non-existent username raises ImportValidationError."""
        cmd = Command()
        mock_conn = MagicMock()
        fixture_data = {
            'model_records': {
                'accounts.user': [{'pk': 1, 'fields': {'username': 'admin'}}],
                'vendors.vendor': [{'pk': 2, 'fields': {'vendor_code': 'VEN-001', 'user': ['unknown_vendor_user']}}],
                'accounts.systemsetting': [],
                'procurement.quotationrequest': [],
                'procurement.requisition': [],
            }
        }
        with self.assertRaises(ImportValidationError) as ctx:
            cmd._verify_remote_unique_constraints(mock_conn, fixture_data, {})
        self.assertIn("references non-existent user with natural key: ['unknown_vendor_user']", str(ctx.exception))

    def test_vendor_malformed_user_natural_key_raises_error(self):
        """Verifies that malformed natural key lists (empty, non-string, or multi-item) raise ImportValidationError."""
        cmd = Command()
        mock_conn = MagicMock()
        for bad_key in ([], ['u1', 'u2'], [123], ['']):
            fixture_data = {
                'model_records': {
                    'accounts.user': [{'pk': 1, 'fields': {'username': 'admin'}}],
                    'vendors.vendor': [{'pk': 2, 'fields': {'vendor_code': 'VEN-001', 'user': bad_key}}],
                    'accounts.systemsetting': [],
                    'procurement.quotationrequest': [],
                    'procurement.requisition': [],
                }
            }
            with self.assertRaises(ImportValidationError) as ctx:
                cmd._verify_remote_unique_constraints(mock_conn, fixture_data, {})
            self.assertIn("malformed user natural key", str(ctx.exception))

    def test_vendor_ambiguous_user_natural_key_raises_error(self):
        """Verifies that duplicate usernames in fixture cause ambiguous user reference error."""
        cmd = Command()
        mock_conn = MagicMock()
        fixture_data = {
            'model_records': {
                'accounts.user': [
                    {'pk': 10, 'fields': {'username': 'duplicate_user'}},
                    {'pk': 20, 'fields': {'username': 'duplicate_user'}},
                ],
                'vendors.vendor': [{'pk': 2, 'fields': {'vendor_code': 'VEN-001', 'user': ['duplicate_user']}}],
                'accounts.systemsetting': [],
                'procurement.quotationrequest': [],
                'procurement.requisition': [],
            }
        }
        with self.assertRaises(ImportValidationError) as ctx:
            cmd._verify_remote_unique_constraints(mock_conn, fixture_data, {})
        self.assertIn("ambiguous user reference 'duplicate_user'", str(ctx.exception))

    def test_vendor_invalid_user_type_raises_error(self):
        """Verifies that invalid user reference types (dict, bool, float) raise ImportValidationError."""
        cmd = Command()
        mock_conn = MagicMock()
        for bad_val in (True, False, {'id': 1}, 12.34):
            fixture_data = {
                'model_records': {
                    'accounts.user': [{'pk': 1, 'fields': {'username': 'admin'}}],
                    'vendors.vendor': [{'pk': 2, 'fields': {'vendor_code': 'VEN-001', 'user': bad_val}}],
                    'accounts.systemsetting': [],
                    'procurement.quotationrequest': [],
                    'procurement.requisition': [],
                }
            }
            with self.assertRaises(ImportValidationError) as ctx:
                cmd._verify_remote_unique_constraints(mock_conn, fixture_data, {})
            self.assertIn("has invalid 'user' reference", str(ctx.exception))

    def test_validate_remapping_includes_vendor_user_map(self):
        """Verifies that _validate_remapping resolves vendor user natural keys and returns vendor_user_map."""
        cmd = Command()
        fixture_data = {
            'model_records': {
                'accounts.user': [
                    {'pk': 21, 'fields': {'username': 'ven_1001', 'role': 1, 'department': None}},
                ],
                'vendors.vendor': [
                    {'pk': 2, 'fields': {'vendor_code': 'VEN-001', 'user': ['ven_1001'], 'supplier_categories': []}},
                ],
                'vendors.vendorapplication': [],
                'vendors.vendorproduct': [],
                'procurement.requisition': [],
            }
        }
        ref_mappings = {
            'dept_map': {},
            'cat_map': {},
            'role_map': {1: 1},
        }
        res = cmd._validate_remapping(fixture_data, ref_mappings)
        self.assertIn('vendor_user_map', res)
        self.assertEqual(res['vendor_user_map'], {2: 21})

    def test_dry_run_default_guarantees_zero_writes_in_handle(self):
        """Verifies that running handle() with default arguments runs in dry-run mode and writes nothing."""
        cmd = Command()
        executed_dml = []

        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur

        def spy_execute(query, params=None):
            q_str = str(query).strip().upper()
            if any(q_str.startswith(w) for w in ('INSERT', 'UPDATE', 'DELETE', 'ALTER')):
                executed_dml.append(q_str)
        mock_cur.execute.side_effect = spy_execute
        mock_cur.fetchone.return_value = (0,)
        mock_cur.fetchall.return_value = []

        with patch.object(cmd, '_validate_and_parse_fixture', return_value={'model_records': {}, 'vendor_m2m': [], 'vendor_app_m2m': []}), \
             patch.object(cmd, '_connect_supabase', return_value=mock_conn), \
             patch.object(cmd, '_validate_reference_tables_and_roles', return_value={'dept_map': {}, 'cat_map': {}, 'role_map': {}, 'roles_to_insert': []}), \
             patch.object(cmd, '_validate_remapping', return_value={}), \
             patch.object(cmd, '_validate_insertion_order', return_value={'sorted_users': []}), \
             patch.object(cmd, '_verify_remote_unique_constraints'), \
             patch.object(cmd, '_reconcile_counts', return_value={'remote_counts': {}, 'expected_inserts': {}}), \
             patch.object(cmd, '_inspect_and_project_sequences', return_value=[]), \
             patch.object(cmd, '_print_dry_run_summary'):

            cmd.handle(dry_run=False, execute=False, fixture_path=r'F:\ProcuraMed_Backups\procuramed_prod_data.json')

        self.assertEqual(len(executed_dml), 0, f"Expected 0 write queries in default dry-run mode, got: {executed_dml}")

    def test_execute_planned_inserts_performs_all_inserts_in_dependency_order(self):
        """Verifies that _execute_planned_inserts executes parameterized inserts in topological order."""
        cmd = Command()
        executed_tables = []

        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur

        def spy_execute(query, params=None):
            q_str = str(query)
            match = re.search(r'INSERT INTO (\w+)', q_str, re.IGNORECASE)
            if match:
                executed_tables.append(match.group(1))

        mock_cur.execute.side_effect = spy_execute

        fixture_data = {
            'model_records': {
                'accounts.role': [{'pk': 2, 'fields': {'name': 'Procurement Officer'}}],
                'accounts.user': [{'pk': 1, 'fields': {'username': 'admin', 'password': 'pbkdf2_sha256$...', 'role': 2, 'created_by': None}}],
                'accounts.systemsetting': [{'pk': 1, 'fields': {'hospital_name': 'Hospital', 'updated_by': ['admin']}}],
                'vendors.vendorapplication': [{'pk': 2, 'fields': {'company_name': 'App Co', 'contact_person': 'A', 'email': 'a@a.com', 'phone': '123', 'address': 'Addr', 'status': 'APPROVED', 'reviewed_by': ['admin'], 'supplier_categories': [1]}}],
                'vendors.vendor': [{'pk': 2, 'fields': {'vendor_code': 'VEN-01', 'user': ['admin'], 'application': 2, 'company_name': 'V Co', 'contact_person': 'V', 'email': 'v@v.com', 'phone': '123', 'status': 'ACTIVE', 'supplier_categories': [1]}}],
                'vendors.vendorproduct': [{'pk': 1, 'fields': {'vendor': 2, 'name': 'Prod', 'category': 1}}],
                'procurement.requisition': [{'pk': 37, 'fields': {'req_number': 'REQ-01', 'title': 'Req', 'department': 10, 'requested_by': ['admin']}}],
                'procurement.requisitionitem': [{'pk': 39, 'fields': {'requisition': 37, 'item_name': 'Item'}}],
                'procurement.approval': [{'pk': 7, 'fields': {'requisition': 37, 'approved_by': ['admin'], 'stage': 'PO'}}],
                'procurement.technicalevaluation': [{'pk': 1, 'fields': {'requisition': 37, 'evaluated_by': ['admin'], 'compliance': 'Compliant', 'remarks': 'OK', 'recommendation': 'Technically Suitable'}}],
                'procurement.quotationrequest': [{'pk': 2, 'fields': {'rfq_number': 'RFQ-01', 'requisition': 37, 'created_by': ['admin'], 'title': 'RFQ', 'due_date': '2026-10-30'}}],
                'procurement.rfqitem': [{'pk': 2, 'fields': {'quotation_request': 2, 'item_name': 'RfqItem'}}],
                'procurement.rfqvendorinvitation': [{'pk': 2, 'fields': {'quotation_request': 2, 'vendor': 2, 'invited_by': ['admin']}}],
                'accounts.auditlog': [{'pk': 1, 'fields': {'user': ['admin'], 'action': 'Login', 'module': 'Auth'}}],
            }
        }
        ref_mappings = {
            'dept_map': {10: 2},
            'cat_map': {1: 1},
            'role_map': {2: 2},
            'roles_to_insert': ['Procurement Officer'],
        }
        ordered_plan = {
            'sorted_users': fixture_data['model_records']['accounts.user'],
        }

        cmd._execute_planned_inserts(mock_conn, fixture_data, ref_mappings, ordered_plan)

        # Verify topological order
        self.assertEqual(executed_tables[0], 'tbl_role')
        self.assertEqual(executed_tables[1], 'tbl_user')
        self.assertEqual(executed_tables[2], 'tbl_system_setting')
        self.assertIn('tbl_vendor_application', executed_tables)
        self.assertIn('tbl_vendor', executed_tables)
        self.assertIn('tbl_vendor_product', executed_tables)
        self.assertIn('tbl_requisition', executed_tables)
        self.assertIn('tbl_audit_log', executed_tables)

    def test_pre_commit_integrity_verification_detects_count_mismatch(self):
        """Verifies that _verify_pre_commit_integrity raises error if any table count does not match expected."""
        cmd = Command()
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur

        reconciliation = {
            'remote_counts': {tbl: 0 for tbl in TARGET_TABLES},
            'expected_inserts': {tbl: 1 for tbl in TARGET_TABLES},
        }
        # Mock actual count returning 0 instead of expected 1
        mock_cur.fetchone.return_value = (0,)

        with self.assertRaises(ImportValidationError) as ctx:
            cmd._verify_pre_commit_integrity(mock_conn, reconciliation, {})
        self.assertIn("Pre-commit count verification failed", str(ctx.exception))

    def test_pre_commit_integrity_verification_detects_orphaned_fks(self):
        """Verifies that _verify_pre_commit_integrity raises error if orphaned foreign keys exist."""
        cmd = Command()
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur

        reconciliation = {
            'remote_counts': {tbl: 0 for tbl in TARGET_TABLES},
            'expected_inserts': {tbl: 0 for tbl in TARGET_TABLES},
        }
        # First 18 calls return 0 for table counts, 19th call returns 1 (orphan detected)
        mock_cur.fetchone.side_effect = [(0,)] * 18 + [(1,)]

        with self.assertRaises(ImportValidationError) as ctx:
            cmd._verify_pre_commit_integrity(mock_conn, reconciliation, {})
        self.assertIn("Pre-commit foreign-key verification failed", str(ctx.exception))

    def test_transaction_rollback_on_insert_exception(self):
        """Verifies that if an insert fails, transaction rolls back and sequence sync is never called."""
        cmd = Command()
        mock_conn = MagicMock()

        # Simulate exception during _execute_planned_inserts
        with patch.object(cmd, '_validate_and_parse_fixture', return_value={'model_records': {}, 'vendor_m2m': [], 'vendor_app_m2m': []}), \
             patch.object(cmd, '_connect_supabase', return_value=mock_conn), \
             patch.object(cmd, '_validate_reference_tables_and_roles', return_value={'dept_map': {}, 'cat_map': {}, 'role_map': {}, 'roles_to_insert': []}), \
             patch.object(cmd, '_validate_remapping', return_value={}), \
             patch.object(cmd, '_validate_insertion_order', return_value={'sorted_users': []}), \
             patch.object(cmd, '_verify_remote_unique_constraints'), \
             patch.object(cmd, '_reconcile_counts', return_value={'remote_counts': {}, 'expected_inserts': {}}), \
             patch.object(cmd, '_inspect_and_project_sequences', return_value=[]), \
             patch.object(cmd, '_create_and_verify_pre_import_backup'), \
             patch.object(cmd, '_execute_planned_inserts', side_effect=RuntimeError('Database disk full')), \
             patch.object(cmd, '_synchronize_sequences') as mock_sync:

            with self.assertRaises(RuntimeError) as ctx:
                cmd.handle(execute=True, dry_run=False, fixture_path=r'F:\ProcuraMed_Backups\procuramed_prod_data.json')

            self.assertIn('Database disk full', str(ctx.exception))
            # Verify sequence sync was NEVER called
            mock_sync.assert_not_called()

    def test_post_commit_sequence_synchronization_runs_safely(self):
        """Verifies that _synchronize_sequences executes setval with proper targets for sequences needing sync."""
        cmd = Command()
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        mock_cur.fetchone.return_value = (50,)

        seq_report = [
            {'table': 'tbl_user', 'sequence': 'tbl_user_id_seq', 'last_val': 24, 'is_called': True, 'needs_sync': True, 'sync_target': 50},
            {'table': 'tbl_role', 'sequence': 'tbl_role_id_seq', 'last_val': 9, 'is_called': True, 'needs_sync': False, 'sync_target': None},
        ]

        cmd._synchronize_sequences(mock_conn, seq_report)

        # tbl_user_id_seq was synchronized
        mock_cur.execute.assert_called_once_with(
            "SELECT setval(%s, %s, true);",
            ("public.tbl_user_id_seq", 50)
        )

    def test_sequence_synchronization_failure_outputs_recovery_sql(self):
        """Verifies that sequence synchronization failure raises CommandError with clear remediation SQL."""
        cmd = Command()
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        mock_cur.execute.side_effect = Exception("Permission denied for sequence tbl_user_id_seq")

        seq_report = [
            {'table': 'tbl_user', 'sequence': 'tbl_user_id_seq', 'last_val': 24, 'is_called': True, 'needs_sync': True, 'sync_target': 50},
        ]

        with self.assertRaises(CommandError) as ctx:
            cmd._synchronize_sequences(mock_conn, seq_report)
        self.assertIn("Sequence synchronization failed", str(ctx.exception))

    def test_pre_import_backup_aborts_if_inside_repository(self):
        """Verifies that backup creation aborts if backup directory is inside the repository."""
        cmd = Command()
        mock_conn = MagicMock()
        repo_dir = str(Path(__file__).resolve().parent.parent)

        with self.assertRaises(CommandError) as ctx:
            cmd._create_and_verify_pre_import_backup({'backup_dir': repo_dir}, mock_conn, 'dummy_pass')
        self.assertIn("cannot be inside the project repository", str(ctx.exception))

    def test_pre_import_backup_aborts_if_pg_dump_fails(self):
        """Verifies that if pg_dump fails, command aborts with CommandError without writing."""
        cmd = Command()
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        mock_cur.description = [('id',), ('name',)]
        mock_cur.fetchall.return_value = []

        with patch('subprocess.run') as mock_sub:
            # Simulate pg_dump failure
            mock_sub.return_value = MagicMock(returncode=1, stdout='', stderr='Connection refused')
            with self.assertRaises(CommandError) as ctx:
                cmd._create_and_verify_pre_import_backup(
                    {'backup_dir': r'F:\ProcuraMed_Backups', 'host': 'supabase.example.com', 'port': 5432, 'user': 'postgres', 'dbname': 'postgres', 'pg_dump_path': r'F:\Apps\PostgreSQL17\bin\pg_dump.exe'},
                    mock_conn,
                    'dummy_pass'
                )
            self.assertIn("pg_dump failed with return code 1", str(ctx.exception))

    def test_post_commit_verification_detects_corrupted_vendor_role(self):
        """Verifies that post-commit verification fails if the preserved Vendor role was altered."""
        cmd = Command()
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur

        reconciliation = {
            'remote_counts': {tbl: 0 for tbl in TARGET_TABLES},
            'expected_inserts': {tbl: 0 for tbl in TARGET_TABLES},
            'total_final': 0,
        }

        # Table counts match (0 for all 18 tables), then role 1 returns 'Admin' instead of 'Vendor'
        mock_cur.fetchone.side_effect = [(0,)] * 18 + [(1, 'Admin')]

        with self.assertRaises(ImportValidationError) as ctx:
            cmd._verify_post_commit_seeding(mock_conn, reconciliation, {}, [])
        self.assertIn("Preserved Vendor role corrupted", str(ctx.exception))




