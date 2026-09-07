from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from accounts.models import Role

User = get_user_model()


class Command(BaseCommand):
    help = 'Creates or ensures the existence of the System Administrator account idempotently.'

    def handle(self, *args, **options):
        # 1. Ensure System Administrator role exists
        role, _ = Role.objects.get_or_create(
            name='System Administrator',
            defaults={
                'description': 'Full administrative control over users, vendors, and system configurations',
                'is_active': True
            }
        )

        # 2. Check if admin user exists
        admin_user = User.objects.filter(username='admin').first()

        if admin_user:
            # Ensure the existing admin account is active
            updated = False
            if not admin_user.is_active:
                admin_user.is_active = True
                updated = True
            if admin_user.role != role:
                admin_user.role = role
                updated = True
            if not admin_user.is_staff:
                admin_user.is_staff = True
                updated = True
            if not admin_user.is_superuser:
                admin_user.is_superuser = True
                updated = True
            if admin_user.email != 'procuramed2026@gmail.com':
                admin_user.email = 'procuramed2026@gmail.com'
                updated = True

            if updated:
                admin_user.save()

            self.stdout.write(self.style.SUCCESS('System Administrator already exists.'))
        else:
            # Create the System Administrator account
            admin_user = User(
                username='admin',
                employee_id='EMP-ADM-001',
                email='procuramed2026@gmail.com',
                first_name='System',
                last_name='Administrator',
                role=role,
                phone='+91 9876543210',
                is_staff=True,
                is_superuser=True,
                is_active=True,
                first_login=False
            )
            admin_user.set_password('admin123')
            admin_user.save()
            self.stdout.write(self.style.SUCCESS('System Administrator created successfully.'))
