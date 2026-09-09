# Generated manually to synchronize the exact 12 procurement-based departments
from django.db import migrations

NEW_DEPTS = [
    {'name': 'Medical & Surgical Equipment', 'code': 'MSE'},
    {'name': 'Biomedical Engineering', 'code': 'BME'},
    {'name': 'Laboratory & Diagnostic Services', 'code': 'LDS'},
    {'name': 'Radiology & Imaging', 'code': 'RAD'},
    {'name': 'Medical Consumables', 'code': 'MC'},
    {'name': 'Critical Care & Emergency Services', 'code': 'CCES'},
    {'name': 'Operation Theatre & Sterilization', 'code': 'OTS'},
    {'name': 'Facilities & Maintenance', 'code': 'FM'},
    {'name': 'Housekeeping & Laundry', 'code': 'HKL'},
    {'name': 'IT & Digital Services', 'code': 'ITDS'},
    {'name': 'Furniture, Office & General Supplies', 'code': 'FOGS'},
    {'name': 'Central Stores & Logistics', 'code': 'CSL'},
]


def sync_procurement_departments(apps, schema_editor):
    Department = apps.get_model('accounts', 'Department')
    User = apps.get_model('accounts', 'User')

    dept_map = {}
    for item in NEW_DEPTS:
        dept = Department.objects.filter(name__iexact=item['name']).first()
        if not dept:
            Department.objects.filter(code=item['code']).update(code=None)
            dept = Department.objects.create(
                name=item['name'],
                code=item['code'],
                description=f"{item['name']} Department",
                is_active=True
            )
        else:
            dept.name = item['name']
            dept.code = item['code']
            dept.is_active = True
            dept.save()
        dept_map[item['name']] = dept

    default_dept = dept_map['Medical & Surgical Equipment']
    valid_ids = [d.id for d in dept_map.values()]

    for u in User.objects.exclude(department_id__in=valid_ids).filter(department__isnull=False):
        u.department = default_dept
        u.save()

    Department.objects.exclude(id__in=valid_ids).delete()


def reverse_sync(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_systemsetting'),
    ]

    operations = [
        migrations.RunPython(sync_procurement_departments, reverse_sync),
    ]
