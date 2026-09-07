from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from accounts.models import Role, Department
from vendors.models import SupplierCategory, VendorApplication, Vendor

User = get_user_model()


class Command(BaseCommand):
    help = 'Seeds initial roles, departments, supplier categories, system admin, and sample procurement data'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('Starting ProcuraMed initial database seed...'))

        # 1. Seed Roles
        roles_data = [
            {'name': 'System Administrator', 'description': 'Full administrative control over users, vendors, and system configurations'},
            {'name': 'Procurement Officer', 'description': 'Manages RFQs, purchase orders, vendor evaluations, and contracts'},
            {'name': 'Purchase Officer', 'description': 'Responsible for hospital procurement activities, RFQs, purchase orders, and quotations'},
            {'name': 'Department Staff', 'description': 'Submits purchase requisitions for hospital equipment and consumables'},
            {'name': 'Technical Officer', 'description': 'Conducts technical evaluation and quality inspection of received equipment'},
            {'name': 'Finance Officer', 'description': 'Handles budget verification, invoice processing, and vendor payments'},
            {'name': 'Committee Member', 'description': 'Reviews high-value purchase requisitions and approves tenders'},
            {'name': 'Procurement Committee Member', 'description': 'Evaluates high-value purchase requisitions, tenders, and procurement approvals'},
            {'name': 'Vendor', 'description': 'External equipment supplier participating in quotations and fulfillments'},
        ]

        role_objs = {}
        for rdata in roles_data:
            role, created = Role.objects.get_or_create(
                name=rdata['name'],
                defaults={'description': rdata['description'], 'is_active': True}
            )
            role_objs[rdata['name']] = role
            if created:
                self.stdout.write(self.style.SUCCESS(f"Created Role: {role.name}"))

        # 2. Seed Departments
        depts_data = [
            {'name': 'Cardiology', 'code': 'CARD'},
            {'name': 'Neurology', 'code': 'NEUR'},
            {'name': 'Orthopedics', 'code': 'ORTHO'},
            {'name': 'General Medicine', 'code': 'GMED'},
            {'name': 'General Surgery', 'code': 'SURG'},
            {'name': 'Pediatrics', 'code': 'PED'},
            {'name': 'Obstetrics & Gynecology', 'code': 'OBGYN'},
            {'name': 'Emergency & Trauma', 'code': 'EMERG'},
            {'name': 'Intensive Care Unit (ICU)', 'code': 'ICU'},
            {'name': 'Radiology & Imaging', 'code': 'RAD'},
            {'name': 'Pathology & Laboratory', 'code': 'PATH'},
            {'name': 'Operation Theatre (OT)', 'code': 'OT'},
            {'name': 'Biomedical Engineering', 'code': 'BME'},
            {'name': 'Facilities & Maintenance', 'code': 'FAC'},
            {'name': 'Information Technology', 'code': 'IT'},
        ]

        dept_objs = {}
        for ddata in depts_data:
            dept, created = Department.objects.get_or_create(
                name=ddata['name'],
                defaults={'code': ddata['code'], 'description': f"Hospital {ddata['name']} Department", 'is_active': True}
            )
            dept_objs[ddata['name']] = dept
            if created:
                self.stdout.write(self.style.SUCCESS(f"Created Department: {dept.name}"))

        # 3. Seed Supplier Categories
        categories_data = [
            {'name': 'Medical Equipment & Devices', 'description': 'Specialized medical instruments, diagnostic machinery, patient monitoring, life-support systems, and therapeutic devices.'},
            {'name': 'Laboratory Equipment & Supplies', 'description': 'Clinical analyzers, lab reagents, microscopes, centrifuges, glassware, test tubes, and pathology diagnostic tools.'},
            {'name': 'Surgical Instruments', 'description': 'Precision surgical instruments, scalpels, forceps, retractors, surgical sets, trays, and sterilizable OR tools.'},
            {'name': 'Diagnostic Equipment', 'description': 'Ultrasound systems, ECG/EKG machines, patient vitals monitors, endoscopy sets, and point-of-care diagnostic tools.'},
            {'name': 'Radiology & Imaging Equipment', 'description': 'X-ray machines, MRI, CT scanning systems, ultrasound probes, PACS hardware, and radiology imaging accessories.'},
            {'name': 'ICU & Critical Care Equipment', 'description': 'Ventilators, syringe and infusion pumps, defibrillators, multipara monitors, and emergency resuscitation gear.'},
            {'name': 'Pharmaceuticals & Medical Consumables', 'description': 'Prescription medications, IV solutions, disposable syringes, cannulas, gloves, surgical dressings, and sterile consumables.'},
            {'name': 'IT Hardware & Software', 'description': 'Hospital information systems (HIS), workstations, servers, barcode scanners, networking devices, and clinical software.'},
            {'name': 'Office Supplies & Stationery', 'description': 'Administrative documentation, medical charts, filing cabinets, printer supplies, and hospital operational stationery.'},
            {'name': 'Furniture & Fixtures', 'description': 'Hospital patient beds, examination tables, surgical carts, medical recliners, doctor chairs, and ward cabinets.'},
            {'name': 'Biomedical Equipment', 'description': 'Biomedical sensors, calibration meters, safety analyzers, electromedical parts, and life-support test apparatus.'},
            {'name': 'Maintenance & Technical Services', 'description': 'Preventive maintenance contracts, calibration services, biomedical engineering repairs, and equipment overhauls.'},
            {'name': 'Cleaning & Housekeeping Supplies', 'description': 'Hospital-grade disinfectants, sanitizing chemicals, biohazard disposal bags, janitorial tools, and sterilizing fluids.'},
            {'name': 'General Hospital Supplies', 'description': 'Hospital linens, patient gowns, staff scrubs, identification wristbands, catering disposables, and facility sundries.'},
        ]

        cat_objs = {}
        for cdata in categories_data:
            cat, created = SupplierCategory.objects.update_or_create(
                name=cdata['name'],
                defaults={'description': cdata['description']}
            )
            cat_objs[cdata['name']] = cat
            if created:
                self.stdout.write(self.style.SUCCESS(f"Created Supplier Category: {cat.name}"))

        # 4. Seed System Administrator
        admin_user, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'employee_id': 'EMP-ADM-001',
                'email': 'admin@procuramed.hospital',
                'first_name': 'System',
                'last_name': 'Administrator',
                'role': role_objs['System Administrator'],
                'department': dept_objs['Information Technology'],
                'phone': '+91 9876543210',
                'is_staff': True,
                'is_superuser': True,
                'is_active': True,
                'first_login': False
            }
        )
        if created:
            admin_user.set_password('admin123')
            admin_user.save()
            self.stdout.write(self.style.SUCCESS("Created System Administrator: admin / admin123 (EMP-ADM-001)"))
        else:
            admin_user.role = role_objs['System Administrator']
            admin_user.employee_id = 'EMP-ADM-001'
            admin_user.is_staff = True
            admin_user.is_superuser = True
            admin_user.save()

        self.stdout.write(self.style.SUCCESS('ProcuraMed initial database seed completed successfully!'))
