from django.db import models
from django.conf import settings
from django.utils import timezone


class SupplierCategory(models.Model):
    class CategoryChoices(models.TextChoices):
        MEDICAL_EQUIPMENT_DEVICES = 'Medical Equipment & Devices', 'Medical Equipment & Devices'
        BIOMEDICAL_EQUIPMENT = 'Biomedical Equipment', 'Biomedical Equipment'
        MEDICAL_CONSUMABLES = 'Medical Consumables', 'Medical Consumables'
        LABORATORY_EQUIPMENT_SUPPLIES = 'Laboratory Equipment & Supplies', 'Laboratory Equipment & Supplies'
        SURGICAL_INSTRUMENTS = 'Surgical Instruments', 'Surgical Instruments'
        DIAGNOSTIC_EQUIPMENT = 'Diagnostic Equipment', 'Diagnostic Equipment'
        RADIOLOGY_IMAGING_EQUIPMENT = 'Radiology & Imaging Equipment', 'Radiology & Imaging Equipment'
        ICU_CRITICAL_CARE_EQUIPMENT = 'ICU & Critical Care Equipment', 'ICU & Critical Care Equipment'
        HOSPITAL_FURNITURE_FIXTURES = 'Hospital Furniture & Fixtures', 'Hospital Furniture & Fixtures'
        IT_HARDWARE_SOFTWARE = 'IT Hardware & Software', 'IT Hardware & Software'
        MAINTENANCE_TECHNICAL_SERVICES = 'Maintenance & Technical Services', 'Maintenance & Technical Services'
        GENERAL_HOSPITAL_SUPPLIES = 'General Hospital Supplies', 'General Hospital Supplies'
        CLEANING_HOUSEKEEPING_SUPPLIES = 'Cleaning & Housekeeping Supplies', 'Cleaning & Housekeeping Supplies'
        OTHER = 'Other', 'Other'

    CATEGORIES = [
        'Medical Equipment & Devices',
        'Biomedical Equipment',
        'Medical Consumables',
        'Laboratory Equipment & Supplies',
        'Surgical Instruments',
        'Diagnostic Equipment',
        'Radiology & Imaging Equipment',
        'ICU & Critical Care Equipment',
        'Hospital Furniture & Fixtures',
        'IT Hardware & Software',
        'Maintenance & Technical Services',
        'General Hospital Supplies',
        'Cleaning & Housekeeping Supplies',
        'Other',
    ]

    name = models.CharField(max_length=100, unique=True, choices=CategoryChoices.choices)
    description = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'tbl_supplier_category'
        verbose_name = 'Supplier Category'
        verbose_name_plural = 'Supplier Categories'
        ordering = ['id']

    def __str__(self):
        return self.name



class VendorApplication(models.Model):
    class StatusChoices(models.TextChoices):
        PENDING = 'PENDING', 'Pending Approval'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'

    company_name = models.CharField(max_length=255)
    contact_person = models.CharField(max_length=100)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    address = models.TextField()
    supplier_categories = models.ManyToManyField(
        SupplierCategory,
        related_name='applications',
        help_text="Products or services categories provided by vendor"
    )
    products_services_offered = models.TextField(
        default='',
        blank=True,
        verbose_name="Products / Services Offered",
        help_text="Briefly describe the products or services supplied by your company"
    )
    certificate_file = models.FileField(
        upload_to='vendor_certificates/',
        blank=True,
        null=True,
        help_text="Business License / Registration Certificate"
    )
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.PENDING
    )
    admin_remarks = models.TextField(blank=True, null=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(blank=True, null=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_vendor_applications'
    )

    class Meta:
        db_table = 'tbl_vendor_application'
        verbose_name = 'Vendor Application'
        verbose_name_plural = 'Vendor Applications'
        ordering = ['id']

    def __str__(self):
        return f"{self.company_name} ({self.status})"


class Vendor(models.Model):
    class StatusChoices(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active Supplier'
        INACTIVE = 'INACTIVE', 'Inactive'

    vendor_code = models.CharField(max_length=50, unique=True, blank=True, null=True)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='vendor_profile',
        null=True,
        blank=True
    )
    application = models.OneToOneField(
        VendorApplication,
        on_delete=models.SET_NULL,
        related_name='approved_vendor',
        null=True,
        blank=True
    )
    company_name = models.CharField(max_length=255)
    contact_person = models.CharField(max_length=100)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    supplier_categories = models.ManyToManyField(
        SupplierCategory,
        related_name='vendors',
        help_text="Multi-select supplier categories"
    )
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.ACTIVE
    )
    performance_rating = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.00,
        help_text="Vendor Performance Rating"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_vendor'
        verbose_name = 'Vendor'
        verbose_name_plural = 'Vendors'
        ordering = ['id']

    def save(self, *args, **kwargs):
        if not self.vendor_code:
            year = timezone.now().strftime('%Y')
            count = Vendor.objects.filter(created_at__year=year).count() + 1
            code = f"VEN-{year}-{count:05d}"
            while Vendor.objects.filter(vendor_code=code).exists():
                count += 1
                code = f"VEN-{year}-{count:05d}"
            self.vendor_code = code
        super().save(*args, **kwargs)

    def __str__(self):
        code = f"[{self.vendor_code}] " if self.vendor_code else ""
        return f"{code}{self.company_name}"
