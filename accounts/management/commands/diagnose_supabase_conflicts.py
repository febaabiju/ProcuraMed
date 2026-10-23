import os
import sys
import json
import getpass
from pathlib import Path
from collections import defaultdict

from django.core.management.base import BaseCommand
import psycopg
from psycopg import sql

# The 3 target tables to diagnose
DIAGNOSTIC_TARGETS = {
    'accounts.role': {
        'table': 'tbl_role',
        'natural_key': 'name',
        'compare_fields': ['name', 'description', 'is_active'],
    },
    'accounts.department': {
        'table': 'tbl_department',
        'natural_key': 'name',
        'compare_fields': ['name', 'code', 'description', 'is_active'],
    },
    'vendors.suppliercategory': {
        'table': 'tbl_supplier_category',
        'natural_key': 'name',
        'compare_fields': ['name', 'description'],
    },
}


class Command(BaseCommand):
    help = (
        'Read-only diagnostic comparison of existing Supabase records against '
        'F:\\ProcuraMed_Backups\\procuramed_prod_data.json for tbl_role, tbl_department, and tbl_supplier_category.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--fixture-path',
            type=str,
            default=r'F:\ProcuraMed_Backups\procuramed_prod_data.json',
            help='Path to the production data fixture file.'
        )
        parser.add_argument(
            '--host',
            type=str,
            default=os.environ.get('SUPABASE_DB_HOST', ''),
            help='Supabase PostgreSQL host.'
        )
        parser.add_argument(
            '--port',
            type=str,
            default=os.environ.get('SUPABASE_DB_PORT', '5432'),
            help='Database port (default: 5432).'
        )
        parser.add_argument(
            '--dbname',
            type=str,
            default=os.environ.get('SUPABASE_DB_NAME', 'postgres'),
            help='Database name (default: postgres).'
        )
        parser.add_argument(
            '--user',
            type=str,
            default=os.environ.get('SUPABASE_DB_USER', 'postgres'),
            help='Database username.'
        )
        parser.add_argument(
            '--sslmode',
            type=str,
            default=os.environ.get('SUPABASE_DB_SSLMODE', 'require'),
            help='SSL mode (default: require).'
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING('\n=== ProcuraMed Read-Only Conflict Diagnostics ==='))
        self.stdout.write('Notice: This diagnostic command is strictly read-only.')
        self.stdout.write('Zero database modifications, deletions, or sequence changes will occur.\n')

        # 1. Load fixture
        fixture_path = Path(options['fixture_path'])
        if not fixture_path.exists():
            self.stderr.write(self.style.ERROR(f'Fixture file not found at {fixture_path}'))
            return

        with open(fixture_path, 'r', encoding='utf-8') as f:
            fixture_json = json.load(f)

        fixture_by_model = defaultdict(dict)
        for item in fixture_json:
            m = item.get('model')
            if m in DIAGNOSTIC_TARGETS:
                pk = item.get('pk')
                fixture_by_model[m][pk] = item.get('fields', {})

        # 2. Connect to Supabase
        conn = self._connect_supabase(options)
        if not conn:
            self.stderr.write(self.style.ERROR('Database connection failed. Diagnostic aborted.'))
            return

        try:
            self.stdout.write(self.style.SUCCESS('Connected to Supabase with read-only lock. Beginning comparison...\n'))
            report = {}
            for model_name, cfg in DIAGNOSTIC_TARGETS.items():
                table_name = cfg['table']
                report[table_name] = self._diagnose_table(
                    conn,
                    model_name,
                    table_name,
                    cfg['natural_key'],
                    cfg['compare_fields'],
                    fixture_by_model.get(model_name, {})
                )

            self._print_executive_summary(report)

        finally:
            conn.close()
            self.stdout.write('\nRemote connection closed.')

    def _connect_supabase(self, options):
        host = options['host'].strip()
        port = options['port'].strip()
        dbname = options['dbname'].strip()
        user = options['user'].strip()
        sslmode = options['sslmode'].strip()

        if not host:
            self.stderr.write(self.style.ERROR('Remote host is required. Supply --host or set SUPABASE_DB_HOST.'))
            return None

        if host.lower() in ('localhost', '127.0.0.1', '::1'):
            self.stderr.write(self.style.ERROR('Cannot connect to localhost or loopback address.'))
            return None

        password = os.environ.get('SUPABASE_DB_PASSWORD', '')
        if not password:
            self.stdout.write(f'Connecting to: {host}:{port} as user {user}')
            password = getpass.getpass('Enter Supabase database password: ')

        if not password:
            self.stderr.write(self.style.ERROR('Password not provided.'))
            return None

        try:
            conn = psycopg.connect(
                host=host,
                port=port,
                dbname=dbname,
                user=user,
                password=password,
                sslmode=sslmode,
                connect_timeout=15
            )

            # Enforce read-only mode at database engine level
            with conn.cursor() as cur:
                cur.execute("SET default_transaction_read_only = on;")
                cur.execute("SET TRANSACTION READ ONLY;")

            # Dual-layer TLS verification
            driver_ssl = False
            if hasattr(conn, 'pgconn') and hasattr(conn.pgconn, 'ssl_in_use'):
                driver_ssl = bool(conn.pgconn.ssl_in_use)
            elif hasattr(conn, 'info') and hasattr(conn.info, 'ssl_in_use'):
                val = conn.info.ssl_in_use
                driver_ssl = bool(val() if callable(val) else val)

            server_ssl = False
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid();")
                    row = cur.fetchone()
                    if row:
                        server_ssl = bool(row[0])
            except Exception:
                pass

            if not (driver_ssl or server_ssl):
                self.stderr.write(self.style.ERROR('TLS could not be verified on remote connection.'))
                conn.close()
                return None

            return conn

        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Connection failed: {e}'))
            return None

    def _diagnose_table(self, conn, model_name, table_name, natural_key, compare_fields, fixture_records):
        self.stdout.write(self.style.MIGRATE_LABEL(f'=== Diagnosing Table: {table_name} ({model_name}) ==='))

        # Fetch all remote records
        with conn.cursor() as cur:
            cur.execute(sql.SQL("SELECT * FROM {};").format(sql.Identifier(table_name)))
            col_names = [desc[0] for desc in cur.description]
            remote_rows = cur.fetchall()

        remote_records = {}
        for row in remote_rows:
            row_dict = dict(zip(col_names, row))
            pk = row_dict['id']
            remote_records[pk] = row_dict

        fixture_pks = set(fixture_records.keys())
        remote_pks = set(remote_records.keys())
        overlapping_pks = fixture_pks & remote_pks
        missing_remotely = fixture_pks - remote_pks  # In fixture, missing on Supabase
        extra_remotely = remote_pks - fixture_pks    # On Supabase, absent in fixture

        self.stdout.write(f'  Fixture records : {len(fixture_pks):3d} (PKs: {sorted(fixture_pks)})')
        self.stdout.write(f'  Remote records  : {len(remote_pks):3d} (PKs: {sorted(remote_pks)})')
        self.stdout.write(f'  Overlapping PKs : {len(overlapping_pks):3d} {sorted(overlapping_pks)}')
        self.stdout.write(f'  Missing remotely: {len(missing_remotely):3d} {sorted(missing_remotely)}')
        self.stdout.write(f'  Extra remotely  : {len(extra_remotely):3d} {sorted(extra_remotely)}')

        # Analyze overlapping records for field differences
        identical_pks = []
        differing_pks = {}

        for pk in sorted(overlapping_pks):
            fix_fields = fixture_records[pk]
            rem_fields = remote_records[pk]

            diffs = {}
            for f in compare_fields:
                fix_val = fix_fields.get(f)
                rem_val = rem_fields.get(f)

                # Normalize string representations for comparison
                fix_norm = "" if fix_val is None else str(fix_val).strip()
                rem_norm = "" if rem_val is None else str(rem_val).strip()

                if fix_norm != rem_norm:
                    diffs[f] = {
                        'fixture': fix_val,
                        'remote': rem_val,
                    }

            if diffs:
                differing_pks[pk] = diffs
            else:
                identical_pks.append(pk)

        # Print field diffs for overlapping records
        if differing_pks:
            self.stdout.write(self.style.WARNING(f'\n  [CONFLICT] {len(differing_pks)} Overlapping PK(s) have field value differences:'))
            for pk, diffs in differing_pks.items():
                fix_name = fixture_records[pk].get(natural_key, '')
                rem_name = remote_records[pk].get(natural_key, '')
                self.stdout.write(f'    - PK {pk:2d} (Fixture: "{fix_name}" vs Remote: "{rem_name}"):')
                for f, vals in diffs.items():
                    self.stdout.write(f'        * Field "{f}":')
                    self.stdout.write(f'            Fixture: {vals["fixture"]!r}')
                    self.stdout.write(f'            Remote : {vals["remote"]!r}')
        else:
            if overlapping_pks:
                self.stdout.write(self.style.SUCCESS(f'  [PASS] All {len(overlapping_pks)} overlapping PK(s) have identical field values.'))

        # Check for Semantic / Natural Key Collisions (Same name, different PK)
        fixture_by_name = {fields.get(natural_key): pk for pk, fields in fixture_records.items() if fields.get(natural_key)}
        remote_by_name = {fields.get(natural_key): pk for pk, fields in remote_records.items() if fields.get(natural_key)}

        shared_names = set(fixture_by_name.keys()) & set(remote_by_name.keys())
        pk_mismatched_names = []
        for name in shared_names:
            f_pk = fixture_by_name[name]
            r_pk = remote_by_name[name]
            if f_pk != r_pk:
                pk_mismatched_names.append((name, f_pk, r_pk))

        if pk_mismatched_names:
            self.stdout.write(self.style.ERROR(
                f'\n  [CRITICAL IDENTITY CONFLICT] {len(pk_mismatched_names)} record(s) exist in both sources with the SAME NAME but DIFFERENT Primary Keys:'
            ))
            for name, f_pk, r_pk in pk_mismatched_names:
                self.stdout.write(f'    - "{name}": Fixture PK={f_pk} vs Remote PK={r_pk}')

        # Print extra remote records (records present on Supabase but absent from fixture)
        if extra_remotely:
            self.stdout.write(self.style.WARNING(f'\n  [EXTRA REMOTE RECORDS] {len(extra_remotely)} record(s) in Supabase not in fixture:'))
            for pk in sorted(extra_remotely):
                r_item = remote_records[pk]
                summary_fields = {f: r_item.get(f) for f in compare_fields}
                self.stdout.write(f'    - PK {pk:2d}: {summary_fields}')

        self.stdout.write('\n')

        return {
            'fixture_count': len(fixture_pks),
            'remote_count': len(remote_pks),
            'overlapping_count': len(overlapping_pks),
            'identical_count': len(identical_pks),
            'differing_count': len(differing_pks),
            'missing_remotely_count': len(missing_remotely),
            'extra_remotely_count': len(extra_remotely),
            'pk_mismatches': pk_mismatched_names,
        }

    def _print_executive_summary(self, report):
        self.stdout.write(self.style.MIGRATE_HEADING('=== DIAGNOSTIC SUMMARY TABLE ==='))
        self.stdout.write(f'{"Table":<30} | {"Fixture":<8} | {"Remote":<8} | {"Overlap":<8} | {"Identical":<10} | {"Diffs":<8} | {"Extra Rem":<10} | {"Name/PK Collisions"}')
        self.stdout.write('-' * 115)
        for tbl, r in report.items():
            self.stdout.write(
                f'{tbl:<30} | '
                f'{r["fixture_count"]:<8} | '
                f'{r["remote_count"]:<8} | '
                f'{r["overlapping_count"]:<8} | '
                f'{r["identical_count"]:<10} | '
                f'{r["differing_count"]:<8} | '
                f'{r["extra_remotely_count"]:<10} | '
                f'{len(r["pk_mismatches"])}'
            )
        self.stdout.write('-' * 115)
        self.stdout.write('\nNotice: No database changes were made. Diagnostic completed safely.\n')
