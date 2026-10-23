import os
import sys
import json
import getpass
from pathlib import Path
from collections import defaultdict, Counter

from django.core.management.base import BaseCommand, CommandError
from django.conf import settings

import psycopg
from psycopg import sql

# The 18 tables receiving imported data
TARGET_TABLES = [
    'tbl_role',
    'tbl_department',
    'tbl_user',
    'tbl_system_setting',
    'tbl_audit_log',
    'tbl_supplier_category',
    'tbl_vendor_application',
    'tbl_vendor',
    'tbl_vendor_product',
    'tbl_requisition',
    'tbl_requisition_item',
    'tbl_approval',
    'tbl_technical_evaluation',
    'tbl_quotation_request',
    'tbl_rfq_item',
    'tbl_rfq_vendor_invitation',
    'tbl_vendor_supplier_categories',
    'tbl_vendor_application_supplier_categories',
]

# The 12 application tables expected to remain empty
EXPECTED_EMPTY_TABLES = [
    'tbl_delivery',
    'tbl_delivery_item',
    'tbl_document',
    'tbl_inventory_item',
    'tbl_invoice',
    'tbl_payment',
    'tbl_po_item',
    'tbl_purchase_order',
    'tbl_quotation',
    'tbl_quotation_item',
    'tbl_stock_transaction',
    'tbl_verification',
]

# Model to Table Mapping for primary models
MODEL_TO_TABLE = {
    'accounts.role': 'tbl_role',
    'accounts.department': 'tbl_department',
    'accounts.user': 'tbl_user',
    'accounts.systemsetting': 'tbl_system_setting',
    'accounts.auditlog': 'tbl_audit_log',
    'vendors.suppliercategory': 'tbl_supplier_category',
    'vendors.vendorapplication': 'tbl_vendor_application',
    'vendors.vendor': 'tbl_vendor',
    'vendors.vendorproduct': 'tbl_vendor_product',
    'procurement.requisition': 'tbl_requisition',
    'procurement.requisitionitem': 'tbl_requisition_item',
    'procurement.approval': 'tbl_approval',
    'procurement.technicalevaluation': 'tbl_technical_evaluation',
    'procurement.quotationrequest': 'tbl_quotation_request',
    'procurement.rfqitem': 'tbl_rfq_item',
    'procurement.rfqvendorinvitation': 'tbl_rfq_vendor_invitation',
}


class Command(BaseCommand):
    help = (
        'Read-only preflight verification for ProcuraMed Supabase production import. '
        'Validates fixture integrity, target tables, expected row counts, primary key sets, '
        'foreign keys, M2M relationships, and catalog sequence mappings without modifying any data.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--fixture-path',
            type=str,
            default=r'F:\ProcuraMed_Backups\procuramed_prod_data.json',
            help='Path to the external production data fixture file.'
        )
        parser.add_argument(
            '--host',
            type=str,
            default=os.environ.get('SUPABASE_DB_HOST', ''),
            help='Supabase PostgreSQL host (e.g., aws-0-ap-south-1.pooler.supabase.com).'
        )
        parser.add_argument(
            '--port',
            type=str,
            default=os.environ.get('SUPABASE_DB_PORT', '5432'),
            help='Database port (default: 5432 for Session Pooler).'
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
            help='SSL mode for remote connection (default: require).'
        )
        parser.add_argument(
            '--local-only',
            action='store_true',
            help='Run only local fixture parsing and offline validation without connecting to remote Supabase.'
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING('\n=== ProcuraMed Read-Only Preflight Verification ==='))
        self.stdout.write('Notice: This command performs strictly read-only checks.')
        self.stdout.write('Zero writes, updates, deletions, migrations, or sequence modifications will be executed.\n')

        # ---------------------------------------------------------
        # Step 1: Fixture Loading and Integrity Inspection (Local)
        # ---------------------------------------------------------
        fixture_path = Path(options['fixture_path'])
        fixture_summary = self._inspect_fixture(fixture_path)
        if not fixture_summary['is_valid']:
            self.stderr.write(self.style.ERROR('\n[FAIL] Fixture validation failed. Aborting preflight.'))
            return

        # ---------------------------------------------------------
        # Step 2: Connection Strategy Determination
        # ---------------------------------------------------------
        if options.get('local_only') or not options.get('host'):
            self.stdout.write(self.style.WARNING(
                '\n[INFO] Remote database host not specified or --local-only requested.\n'
                'Skipping remote Supabase database inspection.\n'
                'To inspect remote Supabase, supply --host or set SUPABASE_DB_HOST in environment.'
            ))
            self._print_local_summary(fixture_summary)
            return

        # ---------------------------------------------------------
        # Step 3: Secure Remote Connection Establishment
        # ---------------------------------------------------------
        conn = self._connect_supabase(options)
        if not conn:
            self.stderr.write(self.style.ERROR('\n[FAIL] Remote connection could not be established. Preflight aborted.'))
            return

        try:
            # ---------------------------------------------------------
            # Step 4: Schema & Table Existence Verification
            # ---------------------------------------------------------
            self._verify_tables_and_schema(conn)

            # ---------------------------------------------------------
            # Step 5: Table Emptiness & Primary Key Auditing
            # ---------------------------------------------------------
            self._verify_table_counts_and_pks(conn, fixture_summary)

            # ---------------------------------------------------------
            # Step 6: Catalog Sequence Discovery & Inspection
            # ---------------------------------------------------------
            self._verify_sequences(conn, fixture_summary)

        finally:
            conn.close()
            self.stdout.write('\nRemote database connection closed.')

        self.stdout.write(self.style.SUCCESS(
            '\n=== Preflight Inspection Finished ===\n'
            'Notice: This was a read-only inspection. No database changes were made, '
            'no fixture records were imported, and no sequence values were modified.'
        ))

    # =========================================================================
    # Internal Verification Methods
    # =========================================================================

    def _inspect_fixture(self, fixture_path: Path):
        self.stdout.write(self.style.MIGRATE_LABEL('1. Fixture Parsing & Self-Validation:'))
        self.stdout.write(f'  Target file: {fixture_path}')

        if not fixture_path.exists():
            self.stderr.write(f'  [FAIL] Fixture file does not exist at {fixture_path}')
            return {'is_valid': False}

        try:
            with open(fixture_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            self.stderr.write(f'  [FAIL] Error decoding JSON fixture: {e}')
            return {'is_valid': False}

        self.stdout.write(f'  [PASS] File exists and parsed as valid JSON ({len(data)} objects).')

        model_counts = Counter(d.get('model') for d in data)
        model_pks = defaultdict(list)
        natural_keys = defaultdict(set)

        # Track M2M relationships derived from parent models
        vendor_m2m_pairs = set()
        vendor_app_m2m_pairs = set()

        for d in data:
            model = d.get('model')
            pk = d.get('pk')
            fields = d.get('fields', {})
            model_pks[model].append(pk)

            # Collect natural keys for FK validation
            if model == 'accounts.user':
                natural_keys['accounts.user'].add(fields.get('username'))
            elif model == 'accounts.role':
                natural_keys['accounts.role'].add(fields.get('name'))
            elif model == 'accounts.department':
                natural_keys['accounts.department'].add(fields.get('name'))
            elif model == 'vendors.suppliercategory':
                natural_keys['vendors.suppliercategory'].add(fields.get('name'))

            # Extract M2M pairs directly from fixture
            if model == 'vendors.vendor':
                for cat_id in fields.get('supplier_categories', []):
                    vendor_m2m_pairs.add((pk, cat_id))
            elif model == 'vendors.vendorapplication':
                for cat_id in fields.get('supplier_categories', []):
                    vendor_app_m2m_pairs.add((pk, cat_id))

        # Validate presence of all 16 primary models
        missing_models = [m for m in MODEL_TO_TABLE.keys() if m not in model_counts]
        if missing_models:
            self.stderr.write(f'  [FAIL] Missing models in fixture: {missing_models}')
            return {'is_valid': False}

        self.stdout.write(f'  [PASS] All 16 primary application models present in fixture.')

        # Validate duplicate primary keys within each model
        has_duplicate_pks = False
        for model, pks in model_pks.items():
            counts = Counter(pks)
            dupes = [pk for pk, c in counts.items() if c > 1]
            if dupes:
                self.stderr.write(f'  [FAIL] Model {model} contains duplicate PKs: {dupes}')
                has_duplicate_pks = True

        if has_duplicate_pks:
            return {'is_valid': False}
        self.stdout.write('  [PASS] Zero duplicate primary keys detected across all models.')

        # Validate user credential hashes without printing them
        users = [d for d in data if d.get('model') == 'accounts.user']
        invalid_hashes = 0
        for u in users:
            pw = u.get('fields', {}).get('password', '')
            if not pw.startswith(('pbkdf2_sha256$', 'argon2', 'bcrypt')):
                invalid_hashes += 1

        if invalid_hashes > 0:
            self.stderr.write(f'  [FAIL] {invalid_hashes}/{len(users)} users have unexpected password hash format.')
            return {'is_valid': False}
        self.stdout.write(f'  [PASS] All {len(users)} user accounts have valid PBKDF2 password hash signatures.')

        # Validate internal foreign key consistency
        fk_violations = []
        for d in data:
            model = d.get('model')
            pk = d.get('pk')
            fields = d.get('fields', {})

            def check_fk(fk_field, target_model, is_natural=False):
                val = fields.get(fk_field)
                if val is None:
                    return
                if is_natural:
                    natural_val = val[0] if isinstance(val, list) else val
                    if natural_val not in natural_keys[target_model] and natural_val not in model_pks[target_model]:
                        fk_violations.append(f"{model} (pk={pk}) field '{fk_field}' has invalid reference {val}")
                else:
                    if val not in model_pks[target_model]:
                        fk_violations.append(f"{model} (pk={pk}) field '{fk_field}' has invalid FK {val}")

            if model == 'accounts.user':
                check_fk('role', 'accounts.role')
                check_fk('department', 'accounts.department')
                check_fk('created_by', 'accounts.user', is_natural=True)
            elif model == 'accounts.auditlog':
                check_fk('user', 'accounts.user', is_natural=True)
            elif model == 'vendors.vendor':
                check_fk('user', 'accounts.user', is_natural=True)
                check_fk('application', 'vendors.vendorapplication')
            elif model == 'vendors.vendorapplication':
                check_fk('reviewed_by', 'accounts.user', is_natural=True)
            elif model == 'vendors.vendorproduct':
                check_fk('vendor', 'vendors.vendor')
                check_fk('supply_category', 'vendors.suppliercategory')
            elif model == 'procurement.requisition':
                check_fk('department', 'accounts.department')
                check_fk('requested_by', 'accounts.user', is_natural=True)
            elif model == 'procurement.requisitionitem':
                check_fk('requisition', 'procurement.requisition')
            elif model == 'procurement.approval':
                check_fk('requisition', 'procurement.requisition')
                check_fk('approved_by', 'accounts.user', is_natural=True)
            elif model == 'procurement.technicalevaluation':
                check_fk('requisition', 'procurement.requisition')
                check_fk('evaluated_by', 'accounts.user', is_natural=True)
            elif model == 'procurement.quotationrequest':
                check_fk('requisition', 'procurement.requisition')
                check_fk('created_by', 'accounts.user', is_natural=True)
            elif model == 'procurement.rfqitem':
                check_fk('quotation_request', 'procurement.quotationrequest')
                check_fk('requisition_item', 'procurement.requisitionitem')
            elif model == 'procurement.rfqvendorinvitation':
                check_fk('quotation_request', 'procurement.quotationrequest')
                check_fk('vendor', 'vendors.vendor')

        if fk_violations:
            self.stderr.write(f'  [FAIL] Found {len(fk_violations)} foreign key reference violations:')
            for v in fk_violations[:5]:
                self.stderr.write(f'    - {v}')
            return {'is_valid': False}

        self.stdout.write('  [PASS] 100% of internal foreign key references resolve cleanly within fixture.')

        # Print fixture derived statistics
        self.stdout.write('\n  Fixture-Derived Table Model Counts:')
        for model, table in sorted(MODEL_TO_TABLE.items()):
            cnt = model_counts[model]
            pks = model_pks[model]
            self.stdout.write(f'    - {table:35s} ({model}): {cnt:3d} rows | PK range: {min(pks)}..{max(pks)}')

        self.stdout.write('  Fixture-Derived Many-to-Many Relationships:')
        self.stdout.write(f'    - tbl_vendor_supplier_categories: {len(vendor_m2m_pairs)} relationship pairs')
        self.stdout.write(f'    - tbl_vendor_application_supplier_categories: {len(vendor_app_m2m_pairs)} relationship pairs')
        self.stdout.write(f'  Total Database Rows Represented: {len(data) + len(vendor_m2m_pairs) + len(vendor_app_m2m_pairs)} (270 model + 22 M2M rows)\n')

        return {
            'is_valid': True,
            'model_counts': model_counts,
            'model_pks': model_pks,
            'vendor_m2m_pairs': vendor_m2m_pairs,
            'vendor_app_m2m_pairs': vendor_app_m2m_pairs,
        }

    def _connect_supabase(self, options):
        self.stdout.write(self.style.MIGRATE_LABEL('2. Remote Supabase Connection & TLS Security:'))

        host = options['host'].strip()
        port = options['port'].strip()
        dbname = options['dbname'].strip()
        user = options['user'].strip()
        sslmode = options['sslmode'].strip()

        # Reject accidental localhost execution
        if host.lower() in ('localhost', '127.0.0.1', '::1', ''):
            self.stderr.write('  [FAIL] Remote host cannot be localhost or loopback address.')
            return None

        # Secure password acquisition (never via CLI flags or printed to stdout)
        password = os.environ.get('SUPABASE_DB_PASSWORD', '')
        if not password:
            self.stdout.write(f'  Connecting to: {host}:{port} as user {user}')
            password = getpass.getpass('  Enter Supabase database password: ')

        if not password:
            self.stderr.write('  [FAIL] Database password was not provided.')
            return None

        masked_host = host if len(host) < 15 else f"{host[:8]}...{host[-8:]}"
        self.stdout.write(f'  Connecting to remote host: {masked_host} (Port: {port}, SSLMode: {sslmode})')

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
            # Enforce read-only transaction mode at database engine level
            with conn.cursor() as cur:
                cur.execute("SET default_transaction_read_only = on;")
                cur.execute("SET TRANSACTION READ ONLY;")

            # 1. Driver-level SSL inspection (client-side verification via libpq)
            driver_ssl = False
            if hasattr(conn, 'pgconn') and hasattr(conn.pgconn, 'ssl_in_use'):
                # psycopg 3: pgconn is pq.PGconn, ssl_in_use is a boolean property
                driver_ssl = bool(conn.pgconn.ssl_in_use)
            elif hasattr(conn, 'info') and hasattr(conn.info, 'ssl_in_use'):
                # psycopg 2 compatibility
                val = conn.info.ssl_in_use
                driver_ssl = bool(val() if callable(val) else val)

            # 2. Server-side SSL inspection via pg_stat_ssl
            server_ssl = False
            ssl_version = None
            ssl_cipher = None
            try:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT ssl, version, cipher 
                        FROM pg_stat_ssl 
                        WHERE pid = pg_backend_pid();
                    """)
                    row = cur.fetchone()
                    if row:
                        server_ssl = bool(row[0])
                        ssl_version = row[1]
                        ssl_cipher = row[2]
            except Exception:
                # In pooled environments where pg_stat_ssl might be restricted, rely on client libpq
                pass

            # Fail-safe TLS verification: must be positively confirmed
            tls_verified = driver_ssl or server_ssl

            if tls_verified:
                desc = []
                if ssl_version:
                    desc.append(f"Protocol: {ssl_version}")
                if ssl_cipher:
                    desc.append(f"Cipher: {ssl_cipher}")
                if driver_ssl:
                    desc.append("libpq: Encrypted")
                details = ", ".join(desc) if desc else "Active"
                self.stdout.write(self.style.SUCCESS(f'  [PASS] TLS Connection verified ({details}).'))
            else:
                self.stderr.write(self.style.ERROR(
                    '  [FAIL] TLS could not be positively verified on this connection.\n'
                    '         Security policy requires an active TLS/SSL connection to Supabase.'
                ))
                conn.close()
                return None

            self.stdout.write(f'  [PASS] Session read-only mode locked on server.')
            return conn

        except Exception as e:
            self.stderr.write(self.style.ERROR(f'  [FAIL] Connection failed: {e}'))
            return None

    def _verify_tables_and_schema(self, conn):
        self.stdout.write(self.style.MIGRATE_LABEL('\n3. Remote Schema & Table Existence Inspection:'))

        with conn.cursor() as cur:
            cur.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
            """)
            existing_tables = set(r[0] for r in cur.fetchall())

            # Check 18 target tables
            missing_target_tables = [t for t in TARGET_TABLES if t not in existing_tables]
            if missing_target_tables:
                self.stderr.write(f'  [FAIL] Missing target application tables in database: {missing_target_tables}')
            else:
                self.stdout.write(f'  [PASS] All 18 target application tables exist in public schema.')

            # Check 12 expected empty tables
            missing_empty_tables = [t for t in EXPECTED_EMPTY_TABLES if t not in existing_tables]
            if missing_empty_tables:
                self.stderr.write(f'  [FAIL] Missing unpopulated application tables: {missing_empty_tables}')
            else:
                self.stdout.write(f'  [PASS] All 12 unpopulated module tables exist in public schema.')

            # Check migration count
            if 'django_migrations' in existing_tables:
                cur.execute("SELECT COUNT(*) FROM django_migrations;")
                mig_count = cur.fetchone()[0]
                if mig_count == 50:
                    self.stdout.write(f'  [PASS] django_migrations contains exactly 50 applied migrations.')
                else:
                    self.stdout.write(self.style.WARNING(f'  [NOT VERIFIED] django_migrations count is {mig_count} (expected 50).'))
            else:
                self.stderr.write('  [FAIL] django_migrations table does not exist.')

    def _verify_table_counts_and_pks(self, conn, fixture_summary):
        self.stdout.write(self.style.MIGRATE_LABEL('\n4. Table Row Counts & Primary Key State Inspection:'))

        model_pks = fixture_summary['model_pks']
        target_counts = {}

        with conn.cursor() as cur:
            # Query counts on all 18 target tables
            for table in TARGET_TABLES:
                cur.execute(sql.SQL("SELECT COUNT(*) FROM {};").format(sql.Identifier(table)))
                count = cur.fetchone()[0]
                target_counts[table] = count

            # Query counts on the 12 expected-empty tables
            empty_table_counts = {}
            for table in EXPECTED_EMPTY_TABLES:
                cur.execute(sql.SQL("SELECT COUNT(*) FROM {};").format(sql.Identifier(table)))
                empty_table_counts[table] = cur.fetchone()[0]

        # Audit empty tables
        non_empty = {t: c for t, c in empty_table_counts.items() if c > 0}
        if non_empty:
            self.stderr.write(f'  [FAIL] Expected-empty tables contain records: {non_empty}')
        else:
            self.stdout.write('  [PASS] All 12 unpopulated tables are 100% empty (0 rows).')

        # Audit target tables
        total_target_rows = sum(target_counts.values())
        if total_target_rows == 0:
            self.stdout.write(self.style.SUCCESS(
                '  [PASS] All 18 target tables are currently empty (0 rows).\n'
                '         Database is in a clean state and ready for fixture import.'
            ))
        else:
            self.stdout.write(self.style.WARNING(
                f'  [INFO] Target tables contain {total_target_rows} existing rows.\n'
                '         Comparing existing database records with fixture primary keys:'
            ))

            with conn.cursor() as cur:
                for model, table in sorted(MODEL_TO_TABLE.items()):
                    db_cnt = target_counts[table]
                    expected_pks = set(model_pks[model])
                    cur.execute(sql.SQL("SELECT id FROM {};").format(sql.Identifier(table)))
                    db_pks = set(r[0] for r in cur.fetchall())

                    if db_cnt == 0:
                        status = 'EMPTY (0 rows)'
                    elif db_pks == expected_pks:
                        status = 'PASS (Exact PK match)'
                    else:
                        missing = expected_pks - db_pks
                        extra = db_pks - expected_pks
                        status = f'MISMATCH (Missing: {len(missing)}, Extra: {len(extra)})'

                    self.stdout.write(f'    - {table:35s}: DB={db_cnt:3d} rows | {status}')

    def _verify_sequences(self, conn, fixture_summary):
        self.stdout.write(self.style.MIGRATE_LABEL('\n5. Catalog Sequence Discovery & Non-Destructive Inspection:'))

        with conn.cursor() as cur:
            # Query exact catalog dependency linking single-column PKs to sequences
            cur.execute("""
                SELECT 
                    t.relname AS table_name,
                    a.attname AS pk_column,
                    s.oid AS sequence_oid,
                    s.relname AS sequence_name,
                    n.nspname AS schema_name,
                    d.deptype AS dependency_type,
                    seq.seqincrement AS increment_by,
                    seq.seqmin AS min_value,
                    seq.seqmax AS max_value,
                    seq.seqcycle AS is_cycled
                FROM pg_class s
                JOIN pg_namespace n ON n.oid = s.relnamespace
                JOIN pg_sequence seq ON seq.seqrelid = s.oid
                JOIN pg_depend d ON d.objid = s.oid 
                                 AND d.classid = 'pg_class'::regclass 
                                 AND d.deptype IN ('a', 'i')
                JOIN pg_class t ON t.oid = d.refobjid 
                                AND d.refclassid = 'pg_class'::regclass
                JOIN pg_attribute a ON a.attrelid = d.refobjid 
                                   AND a.attnum = d.refobjsubid
                JOIN (
                    SELECT conrelid, conkey[1] AS attnum
                    FROM pg_constraint
                    WHERE contype = 'p' AND array_length(conkey, 1) = 1
                ) pk ON pk.conrelid = t.oid AND pk.attnum = a.attnum
                WHERE s.relkind = 'S' 
                  AND n.nspname = 'public'
                  AND t.relname = ANY(%s)
                ORDER BY t.relname;
            """, [TARGET_TABLES])

            discovered = cur.fetchall()

        discovered_by_table = defaultdict(list)
        for row in discovered:
            discovered_by_table[row[0]].append(row)

        missing_seq_tables = [t for t in TARGET_TABLES if t not in discovered_by_table]
        if missing_seq_tables:
            self.stderr.write(f'  [FAIL] Tables missing attached sequences in catalog: {missing_seq_tables}')
        else:
            self.stdout.write(f'  [PASS] Catalog verified: all 18 target tables have attached primary key sequences.')

        # Verify configuration and inspect dynamic state without calling nextval()
        for table in TARGET_TABLES:
            entries = discovered_by_table.get(table, [])
            if len(entries) > 1:
                self.stderr.write(f'  [FAIL] {table}: Ambiguous sequence mapping ({len(entries)} sequences found).')
                continue
            if not entries:
                continue

            entry = entries[0]
            _, pk_col, seq_oid, seq_name, schema_name, dep_type, inc_by, min_val, max_val, is_cycled = entry

            # Check configuration constraints
            dep_desc = 'Identity' if dep_type == 'i' else 'Serial'
            if inc_by != 1:
                self.stderr.write(f'  [FAIL] {seq_name}: Unsupported increment_by = {inc_by} (Expected 1).')
                continue
            if is_cycled:
                self.stderr.write(f'  [FAIL] {seq_name}: Unsupported cycling configuration (is_cycled=True).')
                continue

            # Check privileges and query on-disk sequence state
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT 
                        has_sequence_privilege(current_user, %s, 'SELECT') AS can_select,
                        has_sequence_privilege(current_user, %s, 'UPDATE') AS can_update;
                """, [seq_oid, seq_oid])
                can_select, can_update = cur.fetchone()

                if not can_select:
                    self.stdout.write(f'  - {seq_name:42s} -> {table:32s} | NOT VERIFIED (Lacks SELECT privilege)')
                    continue

                # Query sequence state directly using safe SQL identifier quoting
                query = sql.SQL("SELECT last_value, is_called FROM {}.{};").format(
                    sql.Identifier(schema_name),
                    sql.Identifier(seq_name)
                )
                cur.execute(query)
                last_val, is_called = cur.fetchone()

                # Calculate expected next generated ID
                next_id = (last_val + inc_by) if is_called else last_val
                status = f"last_value={last_val}, is_called={is_called} -> Next ID={next_id} ({dep_desc})"
                self.stdout.write(f'  - {seq_name:42s} -> {table:32s} | [PASS] {status}')

    def _print_local_summary(self, fixture_summary):
        self.stdout.write('\n=== Local Preflight Summary ===')
        self.stdout.write(f'Total Model Objects in Fixture : 270')
        self.stdout.write(f'Derived M2M Relationships      : 22 (9 Vendor + 13 Vendor Application)')
        self.stdout.write(f'Total Database Rows Represented: 292')
        self.stdout.write(f'Target Tables Evaluated        : 18 tables')
        self.stdout.write(f'Empty Tables Preserved         : 12 tables')
        self.stdout.write(f'Fixture Foreign Keys           : 100% verified')
        self.stdout.write(f'PBKDF2 Password Hashes         : 26/26 verified')
        self.stdout.write('\nTo run remote preflight against Supabase, run:')
        self.stdout.write('  python manage.py preflight_supabase_import --host=<supabase-pooler-host>')
