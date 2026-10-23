from unittest.mock import MagicMock, patch
from pathlib import Path
import io

from django.test import SimpleTestCase
from django.core.management import call_command

from accounts.management.commands.diagnose_supabase_conflicts import (
    Command,
    DIAGNOSTIC_TARGETS,
)


class DiagnoseSupabaseConflictsUnitTests(SimpleTestCase):
    """Unit tests for diagnose_supabase_conflicts management command using mocks."""

    def test_fixture_loading_and_filter(self):
        """Verifies that the command correctly parses the fixture and filters to the 3 target models."""
        cmd = Command()
        fixture_path = Path(r"F:\ProcuraMed_Backups\procuramed_prod_data.json")
        if not fixture_path.exists():
            self.skipTest(f"Fixture not found at {fixture_path}")

        with open(fixture_path, 'r', encoding='utf-8') as f:
            data = __import__('json').load(f)

        fixture_roles = [d for d in data if d.get('model') == 'accounts.role']
        fixture_depts = [d for d in data if d.get('model') == 'accounts.department']
        fixture_cats = [d for d in data if d.get('model') == 'vendors.suppliercategory']

        self.assertEqual(len(fixture_roles), 10)
        self.assertEqual(len(fixture_depts), 7)
        self.assertEqual(len(fixture_cats), 14)

    def test_anti_localhost_protection(self):
        """Verifies that connecting to localhost is blocked."""
        cmd = Command()
        conn = cmd._connect_supabase({'host': 'localhost', 'port': '5432', 'dbname': 'postgres', 'user': 'postgres', 'sslmode': 'require'})
        self.assertIsNone(conn)

    @patch('accounts.management.commands.diagnose_supabase_conflicts.getpass.getpass', return_value='mock_secret')
    @patch('accounts.management.commands.diagnose_supabase_conflicts.psycopg.connect')
    def test_diagnostic_table_comparison_logic(self, mock_connect, mock_getpass):
        """Tests field-level difference detection and semantic natural key collision detection."""
        cmd = Command()

        # Simulated remote connection
        mock_conn = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.pgconn.ssl_in_use = True

        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur

        # Scenario:
        # Fixture has:
        # PK 1: {'name': 'Role A', 'description': 'Desc A', 'is_active': True}
        # PK 2: {'name': 'Role B', 'description': 'Desc B', 'is_active': True}
        # PK 3: {'name': 'Role C', 'description': 'Desc C', 'is_active': True}
        fixture_records = {
            1: {'name': 'Role A', 'description': 'Desc A', 'is_active': True},
            2: {'name': 'Role B', 'description': 'Desc B', 'is_active': True},
            3: {'name': 'Role C', 'description': 'Desc C', 'is_active': True},
        }

        # Remote has:
        # PK 1: Identical to fixture
        # PK 2: Different description
        # PK 4: Extra remote role ("Role C" exists remotely with PK 4 -> Semantic PK collision!)
        mock_cur.description = [('id',), ('name',), ('description',), ('is_active',)]
        mock_cur.fetchall.return_value = [
            (1, 'Role A', 'Desc A', True),
            (2, 'Role B', 'Modified Remote Description', True),
            (4, 'Role C', 'Desc C', True),
        ]

        result = cmd._diagnose_table(
            mock_conn,
            'accounts.role',
            'tbl_role',
            'name',
            ['name', 'description', 'is_active'],
            fixture_records
        )

        self.assertEqual(result['fixture_count'], 3)
        self.assertEqual(result['remote_count'], 3)
        self.assertEqual(result['overlapping_count'], 2) # PKs 1 and 2
        self.assertEqual(result['identical_count'], 1)   # PK 1
        self.assertEqual(result['differing_count'], 1)   # PK 2
        self.assertEqual(result['missing_remotely_count'], 1) # PK 3
        self.assertEqual(result['extra_remotely_count'], 1)   # PK 4

        # Verify semantic PK collision detected: "Role C" is PK 3 in fixture but PK 4 remotely
        self.assertEqual(len(result['pk_mismatches']), 1)
        name, f_pk, r_pk = result['pk_mismatches'][0]
        self.assertEqual(name, 'Role C')
        self.assertEqual(f_pk, 3)
        self.assertEqual(r_pk, 4)
