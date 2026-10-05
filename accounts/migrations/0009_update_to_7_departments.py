# Generated manually to consolidate the hospital department master table into exactly 7 departments
from django.db import migrations

TARGET_DEPARTMENTS = [
    {
        'name': 'Medical & Clinical Services',
        'code': 'MCS',
        'description': 'Medical & Clinical Services Department covering medical equipment, surgical instruments, consumables, and ICU care'
    },
    {
        'name': 'Biomedical Engineering',
        'code': 'BME',
        'description': 'Biomedical Engineering Department covering biomedical equipment, calibration, and technical maintenance'
    },
    {
        'name': 'Laboratory & Diagnostic Services',
        'code': 'LDS',
        'description': 'Laboratory & Diagnostic Services Department covering lab equipment, diagnostic systems, and radiology/imaging'
    },
    {
        'name': 'Facilities & Support Services',
        'code': 'FSS',
        'description': 'Facilities & Support Services Department covering maintenance, cleaning, housekeeping, and general hospital supplies'
    },
    {
        'name': 'IT & Digital Services',
        'code': 'ITDS',
        'description': 'IT & Digital Services Department covering healthcare IT hardware, clinical software, and networking'
    },
    {
        'name': 'Administration & General Supplies',
        'code': 'AGS',
        'description': 'Administration & General Supplies Department covering hospital furniture, fixtures, and administrative supplies'
    },
    {
        'name': 'Central Stores & Logistics',
        'code': 'CSL',
        'description': 'Central Stores & Logistics Department managing inventory, general supplies, and medical consumables distribution'
    },
]

LEGACY_TO_NEW_MAP = {
    'Medical & Surgical Equipment': 'Medical & Clinical Services',
    'Radiology & Imaging': 'Laboratory & Diagnostic Services',
    'Medical Consumables': 'Medical & Clinical Services',
    'Critical Care & Emergency Services': 'Medical & Clinical Services',
    'Operation Theatre & Sterilization': 'Medical & Clinical Services',
    'Facilities & Maintenance': 'Facilities & Support Services',
    'Housekeeping & Laundry': 'Facilities & Support Services',
    'Furniture, Office & General Supplies': 'Administration & General Supplies',
    'Administration & Office Management': 'Administration & General Supplies',
    'Biomedical Engineering': 'Biomedical Engineering',
    'Laboratory & Diagnostic Services': 'Laboratory & Diagnostic Services',
    'IT & Digital Services': 'IT & Digital Services',
    'Central Stores & Logistics': 'Central Stores & Logistics',
}


def sync_seven_departments(apps, schema_editor):
    Department = apps.get_model('accounts', 'Department')
    User = apps.get_model('accounts', 'User')
    Requisition = apps.get_model('procurement', 'Requisition')

    # Step 1: Create or update the 7 official departments
    dept_map = {}
    for item in TARGET_DEPARTMENTS:
        # Clear any conflicting code from other departments to prevent unique constraint error
        Department.objects.filter(code=item['code']).exclude(name=item['name']).update(code=None)

        dept = Department.objects.filter(name__iexact=item['name']).first()
        if not dept:
            dept = Department.objects.create(
                name=item['name'],
                code=item['code'],
                description=item['description'],
                is_active=True
            )
        else:
            dept.name = item['name']
            dept.code = item['code']
            dept.description = item['description']
            dept.is_active = True
            dept.save()
        dept_map[item['name']] = dept

    valid_ids = [d.id for d in dept_map.values()]
    default_dept = dept_map['Medical & Clinical Services']

    # Step 2: Remap Requisitions from legacy departments to new departments
    # CRITICAL: Requisition.department has on_delete=CASCADE, so we must remap
    # all existing requisitions before obsolete departments are deleted.
    for old_name, new_name in LEGACY_TO_NEW_MAP.items():
        target_dept = dept_map.get(new_name)
        if target_dept:
            for old_dept in Department.objects.filter(name__iexact=old_name).exclude(id=target_dept.id):
                Requisition.objects.filter(department=old_dept).update(department=target_dept)

    # Step 3: Remap Users from legacy departments to new departments
    for old_name, new_name in LEGACY_TO_NEW_MAP.items():
        target_dept = dept_map.get(new_name)
        if target_dept:
            for old_dept in Department.objects.filter(name__iexact=old_name).exclude(id=target_dept.id):
                User.objects.filter(department=old_dept).update(department=target_dept)

    # Step 4: Fallback for any remaining unmapped requisitions or users pointing to obsolete departments
    Requisition.objects.exclude(department_id__in=valid_ids).filter(department__isnull=False).update(department=default_dept)
    User.objects.exclude(department_id__in=valid_ids).filter(department__isnull=False).update(department=default_dept)

    # Step 5: Safely delete any legacy departments that are not part of the official 7
    Department.objects.exclude(id__in=valid_ids).delete()


def reverse_sync(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0008_update_technical_specializations'),
        ('procurement', '0006_requisition_submitted_at_alter_requisition_status'),
    ]

    operations = [
        migrations.RunPython(sync_seven_departments, reverse_sync),
    ]
