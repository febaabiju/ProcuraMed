import os
import sys
import json
import getpass
from pathlib import Path
from collections import defaultdict

from django.core.management.base import BaseCommand
import psycopg
from psycopg import sql

REFERENCE_TABLES = ['tbl_role', 'tbl_department', 'tbl_supplier_category']

MODEL_MAP = {
    'tbl_role': 'accounts.role',
    'tbl_department': 'accounts.department',
    'tbl_supplier_category': 'vendors.suppliercategory',
}


class Command(BaseCommand):
    help = (
        'Read-only foreign-key dependency audit for tbl_role, tbl_department, and tbl_supplier_category. '
        'Inspects live catalog foreign-key constraints, referencing row counts, grouped user FK distributions, '
        'M2M pairs, and calculates exact natural-key ID remapping matrices without modifying any data.'
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
        self.stdout.write(self.style.MIGRATE_HEADING('\n=== ProcuraMed Read-Only Foreign-Key Dependency Audit ==='))
        self.stdout.write('Notice: This audit is strictly read-only.')
        self.stdout.write('Zero database modifications, deletions, or sequence changes will occur.\n')

        # 1. Load Fixture
        fixture_path = Path(options['fixture_path'])
        if not fixture_path.exists():
            self.stderr.write(self.style.ERROR(f'Fixture file not found at {fixture_path}'))
            return

        with open(fixture_path, 'r', encoding='utf-8') as f:
            fixture_json = json.load(f)

        fixture_records = self._parse_fixture_references(fixture_json)

        # 2. Connect to Supabase
        conn = self._connect_supabase(options)
        if not conn:
            self.stderr.write(self.style.ERROR('Database connection failed. Audit aborted.'))
            return

        try:
            self.stdout.write(self.style.SUCCESS('Connected to Supabase with read-only lock. Beginning audit...\n'))

            # Section 1: Catalog FK Constraints
            fk_constraints = self._audit_catalog_fk_constraints(conn)

            # Section 2: Referencing Tables Row Counts & FK Value Distribution
            self._audit_referencing_tables_data(conn, fk_constraints)

            # Section 3: User Table Grouped FK Counts (Privacy-Safe)
            self._audit_user_grouped_counts(conn)

            # Section 4: M2M Category Relationships
            self._audit_m2m_relationships(conn)

            # Section 5: Natural-Key ID Mapping Matrix
            mapping_matrix = self._compute_natural_key_mapping(conn, fixture_records)

            # Section 6: Fixture Foreign-Key Remapping Impact Analysis
            self._analyze_fixture_remapping_impact(fixture_json, mapping_matrix)

        finally:
            conn.close()
            self.stdout.write('\nRemote database connection closed.')

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

    def _parse_fixture_references(self, fixture_json):
        records = defaultdict(dict)
        for item in fixture_json:
            m = item.get('model')
            pk = item.get('pk')
            fields = item.get('fields', {})
            if m == 'accounts.role':
                records['tbl_role'][pk] = fields.get('name', '').strip()
            elif m == 'accounts.department':
                records['tbl_department'][pk] = fields.get('name', '').strip()
            elif m == 'vendors.suppliercategory':
                records['tbl_supplier_category'][pk] = fields.get('name', '').strip()
        return records

    def _audit_catalog_fk_constraints(self, conn):
        self.stdout.write(self.style.MIGRATE_LABEL('1. Foreign Keys Referencing Target Reference Tables:'))

        with conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    tc.table_name AS referencing_table,
                    kcu.column_name AS referencing_column,
                    ccu.table_name AS referenced_table,
                    ccu.column_name AS referenced_column,
                    rc.update_rule AS on_update,
                    rc.delete_rule AS on_delete,
                    tc.constraint_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                 AND tc.table_schema = kcu.table_schema
                JOIN information_schema.referential_constraints rc
                  ON tc.constraint_name = rc.constraint_name
                JOIN information_schema.constraint_column_usage ccu
                  ON rc.constraint_name = ccu.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY'
                  AND tc.table_schema = 'public'
                  AND ccu.table_name = ANY(%s)
                ORDER BY ccu.table_name, tc.table_name, kcu.column_name;
            """, [REFERENCE_TABLES])

            rows = cur.fetchall()

        self.stdout.write(f'{"Referenced Table":<24} | {"Referencing Table":<36} | {"Column":<26} | {"ON DELETE":<12} | {"Constraint Name"}')
        self.stdout.write('-' * 135)
        for ref_tbl, src_tbl, src_col, _, on_up, on_del, c_name in rows:
            self.stdout.write(f'{ref_tbl:<24} | {src_tbl:<36} | {src_col:<26} | {on_del:<12} | {c_name}')
        self.stdout.write('-' * 135)
        self.stdout.write(f'Total referencing foreign key constraints discovered: {len(rows)}\n')

        return rows

    def _audit_referencing_tables_data(self, conn, fk_constraints):
        self.stdout.write(self.style.MIGRATE_LABEL('\n2. Existing Row Counts in Referencing Tables:'))

        referencing_tables = sorted(list(set(row[0] for row in fk_constraints)))
        table_counts = {}

        with conn.cursor() as cur:
            for tbl in referencing_tables:
                cur.execute(sql.SQL("SELECT COUNT(*) FROM {};").format(sql.Identifier(tbl)))
                cnt = cur.fetchone()[0]
                table_counts[tbl] = cnt

        for tbl, cnt in table_counts.items():
            status = self.style.WARNING(f'{cnt:3d} rows (CONTAINS DATA)') if cnt > 0 else self.style.SUCCESS('  0 rows (Empty)')
            self.stdout.write(f'  - {tbl:<42s}: {status}')

        self.stdout.write('\n')

    def _audit_user_grouped_counts(self, conn):
        self.stdout.write(self.style.MIGRATE_LABEL('3. User Account Distribution (tbl_user Grouped by Role & Dept):'))
        self.stdout.write('   (Strictly anonymous aggregated counts; zero credentials or personal data displayed)\n')

        with conn.cursor() as cur:
            # Check if tbl_user exists
            cur.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_name = 'tbl_user'
                );
            """)
            if not cur.fetchone()[0]:
                self.stdout.write('  tbl_user does not exist in remote database.\n')
                return

            cur.execute("SELECT COUNT(*) FROM tbl_user;")
            total_users = cur.fetchone()[0]

            if total_users == 0:
                self.stdout.write(self.style.SUCCESS('  tbl_user is completely empty (0 rows).\n'))
                return

            self.stdout.write(f'  Total users in remote tbl_user: {total_users}')

            # Grouped by role_id
            cur.execute("""
                SELECT role_id, COUNT(*) 
                FROM tbl_user 
                GROUP BY role_id 
                ORDER BY role_id NULLS LAST;
            """)
            role_groups = cur.fetchall()
            self.stdout.write('  Distribution by role_id:')
            for r_id, count in role_groups:
                lbl = f"role_id={r_id}" if r_id is not None else "role_id=NULL"
                self.stdout.write(f'    * {lbl:<15s}: {count} user(s)')

            # Grouped by department_id
            cur.execute("""
                SELECT department_id, COUNT(*) 
                FROM tbl_user 
                GROUP BY department_id 
                ORDER BY department_id NULLS LAST;
            """)
            dept_groups = cur.fetchall()
            self.stdout.write('  Distribution by department_id:')
            for d_id, count in dept_groups:
                lbl = f"department_id={d_id}" if d_id is not None else "department_id=NULL"
                self.stdout.write(f'    * {lbl:<20s}: {count} user(s)')

        self.stdout.write('\n')

    def _audit_m2m_relationships(self, conn):
        self.stdout.write(self.style.MIGRATE_LABEL('4. Existing Many-to-Many Category Relationships (IDs Only):'))

        with conn.cursor() as cur:
            # tbl_vendor_supplier_categories
            cur.execute("""
                SELECT vendor_id, suppliercategory_id 
                FROM tbl_vendor_supplier_categories 
                ORDER BY vendor_id, suppliercategory_id;
            """)
            v_cats = cur.fetchall()
            if v_cats:
                self.stdout.write(f'  tbl_vendor_supplier_categories ({len(v_cats)} pairs):')
                for vid, cid in v_cats:
                    self.stdout.write(f'    - vendor_id={vid}, suppliercategory_id={cid}')
            else:
                self.stdout.write(self.style.SUCCESS('  tbl_vendor_supplier_categories: 0 pairs (Empty).'))

            # tbl_vendor_application_supplier_categories
            cur.execute("""
                SELECT vendorapplication_id, suppliercategory_id 
                FROM tbl_vendor_application_supplier_categories 
                ORDER BY vendorapplication_id, suppliercategory_id;
            """)
            va_cats = cur.fetchall()
            if va_cats:
                self.stdout.write(f'  tbl_vendor_application_supplier_categories ({len(va_cats)} pairs):')
                for appid, cid in va_cats:
                    self.stdout.write(f'    - vendorapplication_id={appid}, suppliercategory_id={cid}')
            else:
                self.stdout.write(self.style.SUCCESS('  tbl_vendor_application_supplier_categories: 0 pairs (Empty).'))

        self.stdout.write('\n')

    def _compute_natural_key_mapping(self, conn, fixture_records):
        self.stdout.write(self.style.MIGRATE_LABEL('5. Natural-Key Matching Matrix (Remote Supabase IDs <-> Fixture IDs):'))

        mapping_matrix = {}

        with conn.cursor() as cur:
            for tbl in REFERENCE_TABLES:
                self.stdout.write(f'\n  --- {tbl} ---')
                cur.execute(sql.SQL("SELECT id, name FROM {} ORDER BY id;").format(sql.Identifier(tbl)))
                remote_rows = cur.fetchall()
                remote_by_name = {name.strip(): rid for rid, name in remote_rows if name}

                fix_by_pk = fixture_records[tbl]
                fix_by_name = {name.strip(): fpk for fpk, name in fix_by_pk.items() if name}

                all_names = sorted(list(set(remote_by_name.keys()) | set(fix_by_name.keys())))

                mapping_matrix[tbl] = {
                    'fix_to_remote': {},
                    'remote_to_fix': {},
                    'unmatched_fixture': [],
                    'unmatched_remote': [],
                }

                self.stdout.write(f'  {"Natural Key (Name)":<38} | {"Fixture ID":<12} | {"Remote ID":<12} | {"Status"}')
                self.stdout.write('  ' + '-' * 80)

                for name in all_names:
                    f_id = fix_by_name.get(name)
                    r_id = remote_by_name.get(name)

                    f_str = str(f_id) if f_id is not None else "-"
                    r_str = str(r_id) if r_id is not None else "-"

                    if f_id is not None and r_id is not None:
                        if f_id == r_id:
                            status = self.style.SUCCESS('EXACT ID MATCH')
                        else:
                            status = self.style.WARNING(f'ID SHIFT (Fix={f_id} -> Rem={r_id})')
                        mapping_matrix[tbl]['fix_to_remote'][f_id] = r_id
                        mapping_matrix[tbl]['remote_to_fix'][r_id] = f_id
                    elif f_id is not None:
                        status = self.style.ERROR('MISSING ON REMOTE')
                        mapping_matrix[tbl]['unmatched_fixture'].append((f_id, name))
                    else:
                        status = self.style.NOTICE('EXTRA ON REMOTE')
                        mapping_matrix[tbl]['unmatched_remote'].append((r_id, name))

                    self.stdout.write(f'  {name:<38} | {f_str:<12} | {r_str:<12} | {status}')

        return mapping_matrix

    def _analyze_fixture_remapping_impact(self, fixture_json, mapping_matrix):
        self.stdout.write(self.style.MIGRATE_LABEL('\n6. Fixture Foreign-Key Remapping Impact Analysis:'))
        self.stdout.write('   (Simulating foreign-key remapping if existing Supabase reference IDs are preserved)\n')

        # Check references in fixture:
        # accounts.user -> role, department
        # procurement.requisition -> department
        # vendors.vendor -> supplier_categories (M2M)
        # vendors.vendorapplication -> supplier_categories (M2M)
        # vendors.vendorproduct -> category

        role_remap = mapping_matrix['tbl_role']['fix_to_remote']
        dept_remap = mapping_matrix['tbl_department']['fix_to_remote']
        cat_remap = mapping_matrix['tbl_supplier_category']['fix_to_remote']

        user_role_remaps = 0
        user_role_exact = 0
        user_dept_remaps = 0
        user_dept_exact = 0
        req_dept_remaps = 0
        req_dept_exact = 0
        vendor_cat_remaps = 0
        vendor_cat_exact = 0
        app_cat_remaps = 0
        app_cat_exact = 0
        prod_cat_remaps = 0
        prod_cat_exact = 0

        unmappable_fks = []

        for item in fixture_json:
            m = item.get('model')
            pk = item.get('pk')
            f = item.get('fields', {})

            if m == 'accounts.user':
                r_val = f.get('role')
                if r_val is not None:
                    if r_val in role_remap:
                        if r_val != role_remap[r_val]:
                            user_role_remaps += 1
                        else:
                            user_role_exact += 1
                    else:
                        unmappable_fks.append(f"User {pk}: role_id={r_val} has no match on remote")

                d_val = f.get('department')
                if d_val is not None:
                    if d_val in dept_remap:
                        if d_val != dept_remap[d_val]:
                            user_dept_remaps += 1
                        else:
                            user_dept_exact += 1
                    else:
                        unmappable_fks.append(f"User {pk}: department_id={d_val} has no match on remote")

            elif m == 'procurement.requisition':
                d_val = f.get('department')
                if d_val is not None:
                    if d_val in dept_remap:
                        if d_val != dept_remap[d_val]:
                            req_dept_remaps += 1
                        else:
                            req_dept_exact += 1
                    else:
                        unmappable_fks.append(f"Requisition {pk}: department_id={d_val} has no match on remote")

            elif m == 'vendors.vendor':
                for cat in f.get('supplier_categories', []):
                    if cat in cat_remap:
                        if cat != cat_remap[cat]:
                            vendor_cat_remaps += 1
                        else:
                            vendor_cat_exact += 1
                    else:
                        unmappable_fks.append(f"Vendor {pk}: category_id={cat} has no match on remote")

            elif m == 'vendors.vendorapplication':
                for cat in f.get('supplier_categories', []):
                    if cat in cat_remap:
                        if cat != cat_remap[cat]:
                            app_cat_remaps += 1
                        else:
                            app_cat_exact += 1
                    else:
                        unmappable_fks.append(f"VendorApplication {pk}: category_id={cat} has no match on remote")

            elif m == 'vendors.vendorproduct':
                c_val = f.get('category')
                if c_val is None and 'supply_category' in f:
                    c_val = f.get('supply_category')
                if c_val is not None:
                    if c_val in cat_remap:
                        if c_val != cat_remap[c_val]:
                            prod_cat_remaps += 1
                        else:
                            prod_cat_exact += 1
                    else:
                        unmappable_fks.append(f"VendorProduct {pk}: category_id={c_val} has no match on remote")

        self.stdout.write('  Remapping Requirements if Remote IDs are Preserved:')
        self.stdout.write(f'    - accounts.user.role               : {user_role_remaps} reference(s) require ID remapping')
        self.stdout.write(f'    - accounts.user.department         : {user_dept_remaps} reference(s) require ID remapping')
        self.stdout.write(f'    - procurement.requisition.dept     : {req_dept_remaps} reference(s) require ID remapping')
        self.stdout.write(f'    - vendors.vendor.supplier_cats     : {vendor_cat_remaps} M2M item(s) require ID remapping')
        self.stdout.write(f'    - vendors.vendorapp.supplier_cats  : {app_cat_remaps} M2M item(s) require ID remapping')
        self.stdout.write(f'    - vendors.vendorproduct.category   : {prod_cat_remaps} reference(s) require ID remapping')

        if unmappable_fks:
            self.stdout.write(self.style.ERROR(f'\n  [CRITICAL BLOCKER] {len(unmappable_fks)} foreign key(s) CANNOT be remapped because the target reference does not exist on remote:'))
            for u in unmappable_fks[:10]:
                self.stdout.write(f'    * {u}')
        else:
            self.stdout.write(self.style.SUCCESS('\n  [PASS] 100% of fixture foreign keys can be cleanly mapped to remote natural keys.'))

        self.stdout.write('\nNotice: Audit complete. Strictly read-only; no database changes were made.\n')

        return {
            'user_role_remaps': user_role_remaps,
            'user_role_exact': user_role_exact,
            'user_dept_remaps': user_dept_remaps,
            'user_dept_exact': user_dept_exact,
            'req_dept_remaps': req_dept_remaps,
            'req_dept_exact': req_dept_exact,
            'vendor_cat_remaps': vendor_cat_remaps,
            'vendor_cat_exact': vendor_cat_exact,
            'app_cat_remaps': app_cat_remaps,
            'app_cat_exact': app_cat_exact,
            'prod_cat_remaps': prod_cat_remaps,
            'prod_cat_exact': prod_cat_exact,
            'unmappable_fks': unmappable_fks,
        }
