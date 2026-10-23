from unittest.mock import MagicMock, patch
from pathlib import Path

from django.test import SimpleTestCase
from django.core.management import call_command
from django.core.management.base import CommandError
import io

from accounts.management.commands.preflight_supabase_import import (
    Command,
    TARGET_TABLES,
    EXPECTED_EMPTY_TABLES,
    MODEL_TO_TABLE,
)


class PreflightSupabaseImportUnitTests(SimpleTestCase):
    """Unit tests for preflight_supabase_import management command using mocks (zero remote connections)."""

    def test_fixture_parsing_and_validation(self):
        """Validates that the external fixture file parses cleanly and satisfies all data invariants."""
        fixture_path = Path(r"F:\ProcuraMed_Backups\procuramed_prod_data.json")
        if not fixture_path.exists():
            self.skipTest(f"Fixture not found at {fixture_path}")

        cmd = Command()
        summary = cmd._inspect_fixture(fixture_path)

        self.assertTrue(summary['is_valid'])
        self.assertEqual(len(summary['model_counts']), 16)
        self.assertEqual(sum(summary['model_counts'].values()), 270)
        self.assertEqual(len(summary['vendor_m2m_pairs']), 9)
        self.assertEqual(len(summary['vendor_app_m2m_pairs']), 13)

        # Total database rows
        total_rows = sum(summary['model_counts'].values()) + len(summary['vendor_m2m_pairs']) + len(summary['vendor_app_m2m_pairs'])
        self.assertEqual(total_rows, 292)

        # Exact User PK range
        user_pks = summary['model_pks']['accounts.user']
        self.assertEqual(len(user_pks), 26)
        self.assertEqual(min(user_pks), 1)
        self.assertEqual(max(user_pks), 50)

    def test_anti_localhost_security_guard(self):
        """Verifies that the command immediately rejects localhost or loopback endpoints."""
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

    def test_local_only_command_invocation(self):
        """Verifies that running with --local-only produces clean output and does not attempt network connections."""
        out = io.StringIO()
        err = io.StringIO()
        call_command('preflight_supabase_import', '--local-only', stdout=out, stderr=err)
        output = out.getvalue()
        self.assertIn('[PASS] File exists and parsed as valid JSON (270 objects)', output)
        self.assertIn('[PASS] All 16 primary application models present in fixture', output)
        self.assertIn('Total Database Rows Represented: 292', output)
        self.assertIn('Local Preflight Summary', output)

    @patch('accounts.management.commands.preflight_supabase_import.getpass.getpass', return_value='mock_secret_password')
    @patch('accounts.management.commands.preflight_supabase_import.psycopg.connect')
    def test_mocked_remote_preflight_verifications(self, mock_connect, mock_getpass):
        """Tests the remote table and sequence inspection routines against a simulated Supabase catalog."""
        mock_conn = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.pgconn.ssl_in_use = True

        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur

        current_query = [""]

        def mock_execute(query, params=None):
            current_query[0] = str(query)

        def mock_fetchone():
            q = current_query[0]
            if "django_migrations" in q:
                return (50,)
            if "SELECT COUNT(*)" in q:
                return (0,)
            if "has_sequence_privilege" in q:
                return (True, True)
            if "last_value, is_called" in q:
                return (50, True)
            return (0,)

        def mock_fetchall():
            q = current_query[0]
            if "information_schema.tables" in q:
                return [(t,) for t in TARGET_TABLES + EXPECTED_EMPTY_TABLES + ['django_migrations']]
            if "pg_class s" in q:
                return [
                    (t, 'id', 16000 + i, f"{t}_id_seq", 'public', 'i', 1, 1, 9223372036854775807, False)
                    for i, t in enumerate(TARGET_TABLES)
                ]
            return []

        mock_cur.execute.side_effect = mock_execute
        mock_cur.fetchone.side_effect = mock_fetchone
        mock_cur.fetchall.side_effect = mock_fetchall

        out = io.StringIO()
        call_command(
            'preflight_supabase_import',
            '--host=aws-0-ap-south-1.pooler.supabase.com',
            stdout=out,
        )
        val = out.getvalue()
        self.assertIn('All 18 target application tables exist', val)
        self.assertIn('django_migrations contains exactly 50 applied migrations', val)

    @patch('accounts.management.commands.preflight_supabase_import.getpass.getpass', return_value='mock_secret')
    @patch('accounts.management.commands.preflight_supabase_import.psycopg.connect')
    def test_tls_verification_positive_via_pgconn(self, mock_connect, mock_getpass):
        """Verifies that psycopg 3 conn.pgconn.ssl_in_use = True positively confirms TLS."""
        mock_conn = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.pgconn.ssl_in_use = True

        cmd = Command()
        conn = cmd._connect_supabase({
            'host': 'aws-0-ap-south-1.pooler.supabase.com',
            'port': '5432',
            'dbname': 'postgres',
            'user': 'postgres',
            'sslmode': 'require',
        })
        self.assertIsNotNone(conn)
        self.assertEqual(conn, mock_conn)

    @patch('accounts.management.commands.preflight_supabase_import.getpass.getpass', return_value='mock_secret')
    @patch('accounts.management.commands.preflight_supabase_import.psycopg.connect')
    def test_tls_verification_positive_via_pg_stat_ssl(self, mock_connect, mock_getpass):
        """Verifies that server-side pg_stat_ssl confirms TLS even if driver pgconn is omitted."""
        mock_conn = MagicMock(spec=['cursor', 'close'])
        mock_connect.return_value = mock_conn

        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        mock_cur.fetchone.return_value = (True, 'TLSv1.3', 'TLS_AES_256_GCM_SHA384')

        cmd = Command()
        conn = cmd._connect_supabase({
            'host': 'aws-0-ap-south-1.pooler.supabase.com',
            'port': '5432',
            'dbname': 'postgres',
            'user': 'postgres',
            'sslmode': 'require',
        })
        self.assertIsNotNone(conn)

    @patch('accounts.management.commands.preflight_supabase_import.getpass.getpass', return_value='mock_secret')
    @patch('accounts.management.commands.preflight_supabase_import.psycopg.connect')
    def test_tls_verification_fails_safely_when_unencrypted(self, mock_connect, mock_getpass):
        """Verifies that if neither driver nor server reports SSL, the connection fails safely and is closed."""
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
            'sslmode': 'require',
        })
        self.assertIsNone(conn, "Unencrypted connection must be rejected and return None")
        mock_conn.close.assert_called_once()

