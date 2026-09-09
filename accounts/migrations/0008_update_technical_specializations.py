# Generated manually to update Technical Officer specializations to the exact 6 approved domains
import logging
from django.db import migrations

logger = logging.getLogger(__name__)

APPROVED_SPECIALIZATIONS = [
    'Biomedical Equipment',
    'Medical & Surgical Equipment',
    'Laboratory & Diagnostic Equipment',
    'Radiology & Medical Imaging',
    'Critical Care & Life-Support Equipment',
    'IT & Healthcare Technology',
]

# Mapping of previous specialization names that have a CLEAR equivalent among the 6 approved domains
CLEAR_EQUIVALENTS = {
    'medical equipment & devices': 'Medical & Surgical Equipment',
    'biomedical equipment': 'Biomedical Equipment',
    'laboratory equipment': 'Laboratory & Diagnostic Equipment',
    'radiology & imaging equipment': 'Radiology & Medical Imaging',
    'radiology & imaging': 'Radiology & Medical Imaging',
    'surgical & operation theatre equipment': 'Medical & Surgical Equipment',
    'icu & critical care equipment': 'Critical Care & Life-Support Equipment',
    'critical care & life-support equipment': 'Critical Care & Life-Support Equipment',
    'it & digital systems': 'IT & Healthcare Technology',
    'it & healthcare technology': 'IT & Healthcare Technology',
}


def migrate_technical_specializations(apps, schema_editor):
    User = apps.get_model('accounts', 'User')

    # Dynamically find all users with technical specializations or Technical Officer roles
    users = User.objects.filter(
        technical_specializations__isnull=False
    ).exclude(technical_specializations=[])

    unmatched_records = {}
    migrated_count = 0

    for user in users:
        raw_specs = user.technical_specializations
        if not isinstance(raw_specs, list):
            continue

        updated_specs = []
        user_unmatched = []

        for spec in raw_specs:
            if not isinstance(spec, str):
                continue
            cleaned = spec.strip()
            key = cleaned.lower()

            # 1. Exact match with approved specialization
            matched_approved = next(
                (appr for appr in APPROVED_SPECIALIZATIONS if appr.lower() == key),
                None
            )
            if matched_approved:
                if matched_approved not in updated_specs:
                    updated_specs.append(matched_approved)
                continue

            # 2. Clear direct equivalent
            if key in CLEAR_EQUIVALENTS:
                target = CLEAR_EQUIVALENTS[key]
                if target not in updated_specs:
                    updated_specs.append(target)
                continue

            # 3. No clear equivalent: DO NOT guess or assign random specialization
            user_unmatched.append(cleaned)

        if user_unmatched:
            unmatched_records[user.username] = user_unmatched

        user.technical_specializations = updated_specs
        user.save()
        migrated_count += 1

    print(f"\n[Migration 0008] Dynamically processed {migrated_count} Technical Officer record(s).")
    if unmatched_records:
        print("[Migration 0008] Notice: Unmatched specializations with no clear equivalent were safely excluded (not guessed):")
        for username, un_specs in unmatched_records.items():
            print(f"  - User '{username}': unmatched values {un_specs}. Admin can review/edit via Admin > Technical Officers.")
    else:
        print("[Migration 0008] All existing specializations had direct equivalents or were already valid.")


def reverse_migration(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_update_departments'),
    ]

    operations = [
        migrations.RunPython(migrate_technical_specializations, reverse_migration),
    ]
