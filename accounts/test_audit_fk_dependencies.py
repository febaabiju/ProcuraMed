from unittest.mock import MagicMock, patch
from pathlib import Path

from django.test import SimpleTestCase
from django.core.management import call_command

from accounts.management.commands.audit_foreign_key_dependencies import (
    Command,
    REFERENCE_TABLES,
)


class AuditForeignKeyDependenciesUnitTests(SimpleTestCase):
    """Unit tests for audit_foreign_key_dependencies command using mocks."""

    def test_fixture_reference_parsing(self):
        """Tests that reference records are extracted from fixture correctly."""
        cmd = Command()
        fixture_path = Path(r"F:\ProcuraMed_Backups\procuramed_prod_data.json")
        if not fixture_path.exists():
            self.skipTest(f"Fixture not found at {fixture_path}")

        with open(fixture_path, 'r', encoding='utf-8') as f:
            data = __import__('json').load(f)

        records = cmd._parse_fixture_references(data)
        self.assertEqual(len(records['tbl_role']), 10)
        self.assertEqual(len(records['tbl_department']), 7)
        self.assertEqual(len(records['tbl_supplier_category']), 14)

    def test_anti_localhost_protection(self):
        """Verifies that localhost is rejected immediately."""
        cmd = Command()
        conn = cmd._connect_supabase({'host': '127.0.0.1', 'port': '5432', 'dbname': 'postgres', 'user': 'postgres', 'sslmode': 'require'})
        self.assertIsNone(conn)

    def test_natural_key_mapping_and_remapping_impact(self):
        """Tests mapping matrix computation and simulated FK remapping."""
        cmd = Command()

        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur

        # Scenario:
        # Fixture has Department PK 16: 'Biomedical Engineering'
        # Remote has Department PK 1: 'Biomedical Engineering' (ID shift 16 -> 1)
        fixture_records = {
            'tbl_role': {1: 'Admin', 2: 'Staff'},
            'tbl_department': {16: 'Biomedical Engineering'},
            'tbl_supplier_category': {20: 'Biomedical Equipment'},
        }

        # Mock query return values for the 3 tables
        mock_cur.fetchall.side_effect = [
            [(1, 'Admin'), (2, 'Staff')],                      # tbl_role: exact match
            [(1, 'Biomedical Engineering')],                   # tbl_department: ID shift (16 -> 1)
            [(2, 'Biomedical Equipment')],                     # tbl_supplier_category: ID shift (20 -> 2)
        ]

        matrix = cmd._compute_natural_key_mapping(mock_conn, fixture_records)

        # Check role mapping
        self.assertEqual(matrix['tbl_role']['fix_to_remote'][1], 1)
        self.assertEqual(matrix['tbl_role']['fix_to_remote'][2], 2)

        # Check department mapping (16 -> 1)
        self.assertEqual(matrix['tbl_department']['fix_to_remote'][16], 1)

        # Check category mapping (20 -> 2)
        self.assertEqual(matrix['tbl_supplier_category']['fix_to_remote'][20], 2)

        # Test remapping impact
        simulated_fixture = [
            {
                'model': 'accounts.user',
                'pk': 1,
                'fields': {'role': 1, 'department': 16}
            },
            {
                'model': 'procurement.requisition',
                'pk': 100,
                'fields': {'department': 16}
            },
            {
                'model': 'vendors.vendor',
                'pk': 5,
                'fields': {'supplier_categories': [20]}
            },
            {
                'model': 'vendors.vendorproduct',
                'pk': 10,
                'fields': {'category': 20}  # Shift: 20 -> 2
            }
        ]

        # Should execute without errors and detect 1 dept remap on user, 1 on req, 1 on vendor, 1 on product
        res = cmd._analyze_fixture_remapping_impact(simulated_fixture, matrix)
        self.assertEqual(res['prod_cat_remaps'], 1)
        self.assertEqual(res['prod_cat_exact'], 0)
        self.assertEqual(len(res['unmappable_fks']), 0)

    def test_vendor_product_category_remapping_classifications(self):
        """Regression test proving VendorProduct categories are classified as mapped (exact), requiring remap, or unmappable."""
        cmd = Command()

        matrix = {
            'tbl_role': {'fix_to_remote': {1: 1}},
            'tbl_department': {'fix_to_remote': {16: 2}},
            'tbl_supplier_category': {
                'fix_to_remote': {
                    5: 5,   # Exact ID match: mapped without shift
                    2: 3,   # ID shift: mapped with remap required
                }
            }
        }

        simulated_fixture = [
            # Product 1: Mapped with exact ID (5 -> 5)
            {
                'model': 'vendors.vendorproduct',
                'pk': 101,
                'fields': {'name': 'Scalpel Set', 'category': 5}
            },
            # Product 2: Mapped requiring ID remapping (2 -> 3)
            {
                'model': 'vendors.vendorproduct',
                'pk': 102,
                'fields': {'name': 'Nitrile Gloves', 'category': 2}
            },
            # Product 3: Unmappable category (99 does not exist on remote)
            {
                'model': 'vendors.vendorproduct',
                'pk': 103,
                'fields': {'name': 'Obsolete Item', 'category': 99}
            }
        ]

        res = cmd._analyze_fixture_remapping_impact(simulated_fixture, matrix)

        self.assertEqual(res['prod_cat_exact'], 1, "Product 101 should be classified as exact match (mapped)")
        self.assertEqual(res['prod_cat_remaps'], 1, "Product 102 should be classified as requiring ID remap")
        self.assertEqual(len(res['unmappable_fks']), 1, "Product 103 should be classified as unmappable")
        self.assertIn("VendorProduct 103: category_id=99 has no match on remote", res['unmappable_fks'][0])

    def test_real_fixture_vendor_products_detected(self):
        """Verifies that all 6 VendorProducts in the real fixture are detected and read via fields['category']."""
        fixture_path = Path(r"F:\ProcuraMed_Backups\procuramed_prod_data.json")
        if not fixture_path.exists():
            self.skipTest(f"Fixture not found at {fixture_path}")

        with open(fixture_path, 'r', encoding='utf-8') as f:
            data = __import__('json').load(f)

        cmd = Command()

        # Remote mapping covering categories present in fixture (2 -> 3, 9 -> 12, 11 -> 1)
        matrix = {
            'tbl_role': {'fix_to_remote': {7: 1}},
            'tbl_department': {'fix_to_remote': {16: 2, 19: 3, 24: 10, 26: 12, 27: 13, 28: 14, 29: 15}},
            'tbl_supplier_category': {
                'fix_to_remote': {
                    2: 3,
                    5: 5,
                    9: 12,
                    10: 14,
                    11: 1,
                    12: 4,
                    13: 6,
                    14: 7,
                    15: 8,
                    17: 10,
                    20: 2,
                    21: 11,
                    22: 13,
                    23: 9,
                }
            }
        }

        res = cmd._analyze_fixture_remapping_impact(data, matrix)

        # In real fixture:
        # 6 vendor products exist, categories: 2 (x2), 9 (x2), 11 (x2)
        # All 3 categories undergo ID shifts:
        # 2 -> 3, 9 -> 12, 11 -> 1
        # Therefore, all 6 require ID remapping, and none are unmappable
        self.assertEqual(res['prod_cat_remaps'], 6, "All 6 vendor products must be detected and require ID remap")
        self.assertEqual(res['prod_cat_exact'], 0)

        # None of the unmappable FKs should be from VendorProduct
        prod_unmappable = [err for err in res['unmappable_fks'] if err.startswith('VendorProduct')]
        self.assertEqual(len(prod_unmappable), 0, f"Expected 0 unmappable VendorProducts, got: {prod_unmappable}")
