from django.db import models
from django.conf import settings
from django.utils import timezone
from accounts.models import Department

APPROVED_SPECIALIZATIONS = [
    'Biomedical Equipment',
    'Medical & Surgical Equipment',
    'Laboratory & Diagnostic Equipment',
    'Radiology & Medical Imaging',
    'Critical Care & Life-Support Equipment',
    'IT & Healthcare Technology',
]

ROUTINE_KEYWORDS = [
    # Gloves, masks, gauze, consumables
    'surgical glove', 'examination glove', 'nitrile glove', 'latex glove', 'sterile glove', 'gloves', 'glove',
    'surgical mask', 'n95 mask', 'face mask', 'medical mask', 'masks', 'mask',
    'surgical gauze', 'sterile gauze', 'gauze pad', 'gauze', 'cotton roll', 'cotton swab', 'cotton',
    'bandage', 'bandages', 'dressing', 'wound dressing', 'adhesive tape', 'surgical tape',
    'disposable syringe', 'hypodermic needle', 'syringe', 'needle', 'cannula', 'iv cannula',
    'iv infusion set', 'infusion set', 'catheter', 'foley catheter', 'urine bag', 'tubing', 'lancet',
    'consumable', 'consumables', 'disposable', 'disposables', 'specimen container', 'vacutainer',
    # Cleaning, housekeeping, sanitation
    'cleaning', 'sanitizer', 'detergent', 'disinfectant wipe', 'disinfectant', 'mop', 'broom',
    'trash bag', 'bin', 'soap', 'bleach', 'floor cleaner', 'biohazard bag',
    # Stationery
    'stationery', 'paper', 'copier paper', 'pen', 'pens', 'folder', 'folders', 'envelope', 'envelopes',
    'stapler', 'staples', 'marker', 'notebook', 'toner', 'cartridge', 'ink',
    # Basic furniture
    'basic furniture', 'furniture', 'chair', 'chairs', 'desk', 'desks', 'table', 'tables', 'shelf',
    'cupboard', 'stool', 'filing cabinet', 'cabinet', 'examination couch', 'examination table',
    # Linen and routine general supplies
    'linen', 'bedsheet', 'pillow', 'blanket', 'curtain', 'towel', 'scrub suit', 'uniform', 'apron',
    'general supply', 'general supplies', 'drinking water', 'tea', 'coffee', 'grocery', 'battery', 'batteries'
]

EXPLICIT_EQUIPMENT_KEYWORDS = [
    'suction apparatus', 'portable suction', 'apparatus', 'electrosurgical', 'diathermy',
    'cautery', 'operating table', 'ot light', 'surgical light', 'laparoscope', 'endoscope',
    'anesthesia workstation', 'surgical microscope', 'analyzer', 'spectrophotometer', 'incubator',
    'centrifuge', 'pcr machine', 'thermal cycler', 'hematology analyzer', 'biochemistry analyzer',
    'blood gas analyzer', 'elisa reader', 'x-ray', 'mri', 'ct scanner', 'ultrasound', 'mammography',
    'c-arm', 'fluoroscopy', 'ventilator', 'patient monitor', 'multipara', 'cardiac monitor',
    'pulse oximeter', 'resuscitator', 'bipap', 'cpap', 'ecmo', 'defibrillator', 'infusion pump',
    'syringe pump', 'autoclave', 'sterilizer', 'dialysis machine', 'pacs', 'ris', 'his server',
    'telemetry', 'workstation', 'server', 'machine', 'machinery', 'equipment', 'scanner'
]

TECH_DOMAINS = {
    'Biomedical Equipment': [
        'biomedical', 'dialysis', 'infusion pump', 'syringe pump', 'autoclave',
        'sterilizer', 'defibrillator', 'ecg', 'ekg', 'electrosurgical', 'diathermy',
        'cautery machine', 'medical electronic', 'biomedical sensor'
    ],
    'Medical & Surgical Equipment': [
        'suction apparatus', 'portable suction', 'operating table', 'ot light', 'surgical light',
        'laparoscope', 'endoscope', 'arthroscope', 'anesthesia workstation', 'surgical microscope',
        'cautery unit', 'implants', 'surgical laser', 'cryosurgical unit', 'surgical equipment', 'surgical unit'
    ],
    'Laboratory & Diagnostic Equipment': [
        'laboratory', 'analyzer', 'spectrophotometer', 'incubator', 'pcr', 'hematology',
        'biochemistry', 'centrifuge', 'reagents analyzer', 'blood gas analyzer', 'elisa reader',
        'biosafety cabinet', 'flow cytometer', 'diagnostic machine'
    ],
    'Radiology & Medical Imaging': [
        'radiology', 'x-ray', 'mri', 'ct scanner', 'ultrasound', 'mammography', 'fluoroscopy',
        'c-arm', 'imaging system', 'radiography', 'doppler', 'pet scan'
    ],
    'Critical Care & Life-Support Equipment': [
        'ventilator', 'icu', 'critical care', 'life-support', 'patient monitor', 'multipara',
        'cardiac monitor', 'pulse oximeter', 'resuscitator', 'bipap', 'cpap', 'ecmo',
        'defibrillator monitor', 'capnograph'
    ],
    'IT & Healthcare Technology': [
        'pacs', 'ris', 'his', 'emr', 'ehr', 'telemedicine', 'medical server', 'telemetry',
        'healthcare network', 'clinical software', 'dicom', 'workstation', 'firewall', 'server'
    ]
}


def evaluate_item_technical_requirement(item_name: str, category: str = "", specifications: str = ""):
    """
    Evaluates whether an individual item requires technical officer evaluation.
    Returns tuple: (is_technical: bool, suggested_specialization: str or None, reason: str)
    """
    name_str = (item_name or "").lower().strip()
    cat_str = (category or "").lower().strip()
    spec_str = (specifications or "").lower().strip()
    full_text = f"{name_str} {cat_str} {spec_str}"

    if not full_text.strip():
        return False, None, "Item details are empty."

    # 1. Check if item contains explicit specialized equipment keywords or technical service indicators
    has_explicit_equipment = any(kw in full_text for kw in EXPLICIT_EQUIPMENT_KEYWORDS)
    has_tech_service = any(kw in full_text for kw in [
        'installation', 'calibration', 'calibrated', 'integration',
        'specialized maintenance', 'preventive maintenance', 'electronic medical machine'
    ])

    # 2. Check if item matches routine non-technical consumable/general keywords
    is_routine_name = any(kw in name_str for kw in ROUTINE_KEYWORDS)
    is_routine_overall = any(kw in full_text for kw in ROUTINE_KEYWORDS)

    # If it's a routine consumable/general item (like gloves, masks, gauze, paper, chairs)
    # and has NO explicit complex equipment keywords (like "suction apparatus", "infusion pump", etc.)
    if is_routine_name and not has_explicit_equipment and not has_tech_service:
        return False, None, "Routine consumable or general hospital supply not requiring technical evaluation."

    # If category is routine consumables / stationery / general supplies and not explicit equipment
    routine_cats = ['consumable', 'supplies', 'stationery', 'furniture', 'housekeeping', 'facility']
    if any(rc in cat_str for rc in routine_cats) and not has_explicit_equipment and not has_tech_service:
        return False, None, "Standard routine supplies not requiring technical evaluation."

    # 3. Match against the 6 approved technical specializations
    best_spec = None
    max_score = 0

    # Direct category match if category itself is an approved specialization
    for approved in APPROVED_SPECIALIZATIONS:
        if approved.lower() == cat_str:
            best_spec = approved
            max_score = 10
            break

    for spec, keywords in TECH_DOMAINS.items():
        score = sum(2 for kw in keywords if kw in name_str)
        score += sum(1 for kw in keywords if kw in spec_str)
        if spec.lower() in cat_str or any(kw in cat_str for kw in keywords):
            score += 4
        if score > max_score:
            max_score = score
            best_spec = spec

    if best_spec and max_score > 0:
        return True, best_spec, f"Specialized item requiring {best_spec} evaluation."

    # 4. If explicit equipment or technical service was indicated, default to general surgical or biomedical equipment
    if has_explicit_equipment or has_tech_service:
        default_spec = 'Biomedical Equipment' if ('biomedical' in full_text or 'electronic' in full_text) else 'Medical & Surgical Equipment'
        return True, default_spec, f"Specialized medical equipment requiring {default_spec} evaluation."

    # If routine overall and not triggered by technical domains
    if is_routine_overall:
        return False, None, "Routine supply not requiring technical evaluation."

    return False, None, "Standard hospital item not requiring specialized technical evaluation."


class Requisition(models.Model):
    class PriorityChoices(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        HIGH = 'HIGH', 'High'
        URGENT = 'URGENT', 'Urgent'

    class StatusChoices(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        SUBMITTED = 'SUBMITTED', 'Submitted'
        RETURNED = 'RETURNED', 'Returned for Correction'
        PENDING_TECHNICAL_EVALUATION = 'PENDING_TECHNICAL_EVALUATION', 'Pending Technical Evaluation'
        PENDING_COMMITTEE_REVIEW = 'PENDING_COMMITTEE_REVIEW', 'Pending Committee Review'
        PENDING_APPROVAL = 'PENDING_APPROVAL', 'Pending Approval'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        RFQ_ISSUED = 'RFQ_ISSUED', 'RFQ Issued'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    req_number = models.CharField(max_length=50, unique=True, blank=True, verbose_name="Requisition Number")
    title = models.CharField(max_length=255)
    department = models.ForeignKey(
        Department, on_delete=models.CASCADE, related_name='requisitions'
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='requisitions'
    )
    priority = models.CharField(
        max_length=20, choices=PriorityChoices.choices, default=PriorityChoices.MEDIUM
    )
    estimated_budget = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    status = models.CharField(
        max_length=30, choices=StatusChoices.choices, default=StatusChoices.DRAFT
    )
    category = models.CharField(
        max_length=150, blank=True, null=True, verbose_name="Item Category / Procurement Domain"
    )
    requires_technical_evaluation = models.BooleanField(
        default=False,
        verbose_name="Requires Technical Evaluation",
        help_text="Designates whether this procurement item requires technical officer evaluation based on technical complexity."
    )
    technical_specialization = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="Required Technical Specialization",
        help_text="One of the 6 approved technical specializations required to evaluate this procurement."
    )
    justification = models.TextField(blank=True, null=True)
    supporting_document = models.FileField(
        upload_to='requisitions/documents/',
        null=True,
        blank=True,
        verbose_name="Supporting Document"
    )
    review_comments = models.TextField(
        blank=True, null=True, verbose_name="Review Comments / Return Reason"
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='reviewed_requisitions',
        verbose_name="Reviewed By"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name="Reviewed At")
    assigned_purchase_officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='assigned_requisitions',
        verbose_name="Assigned Purchase Officer"
    )
    assigned_at = models.DateTimeField(null=True, blank=True, verbose_name="Assigned At")
    submitted_at = models.DateTimeField(null=True, blank=True, verbose_name="Submitted At")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_requisition'
        verbose_name = 'Purchase Requisition'
        verbose_name_plural = 'Purchase Requisitions'
        ordering = ['-created_at']

    def get_technical_evaluation_advisory(self):
        """
        Advisory technical evaluation recommendation.
        Evaluates each requisition item individually.
        If at least one item requires specialized technical evaluation,
        the system recommends technical evaluation for the requisition.
        """
        items = list(self.items.all()) if self.pk else []
        if not items:
            is_tech, spec, reason = evaluate_item_technical_requirement(
                item_name=self.title or '',
                category=self.category or '',
                specifications=self.justification or ''
            )
            return {
                'recommended': is_tech,
                'reason': reason if is_tech else "No items present to trigger technical evaluation.",
                'suggested_specialization': spec,
                'triggering_items': [self.title] if (is_tech and self.title) else [],
                'item_evaluations': []
            }

        item_evaluations = []
        triggering_items = []
        spec_counts = {}

        for item in items:
            is_tech, spec, reason = evaluate_item_technical_requirement(
                item_name=item.item_name,
                category=item.category or '',
                specifications=item.specifications or ''
            )
            item_evaluations.append({
                'id': item.id,
                'item_name': item.item_name,
                'category': item.category,
                'is_technical': is_tech,
                'suggested_specialization': spec,
                'reason': reason
            })
            if is_tech:
                triggering_items.append(item.item_name)
                if spec:
                    spec_counts[spec] = spec_counts.get(spec, 0) + 1

        if triggering_items:
            suggested_spec = max(spec_counts.items(), key=lambda x: x[1])[0] if spec_counts else 'Biomedical Equipment'
            rec_reason = (
                f"Technical evaluation is recommended because {len(triggering_items)} item(s) "
                f"require specialized technical review: {', '.join(triggering_items)}."
            )
            return {
                'recommended': True,
                'reason': rec_reason,
                'suggested_specialization': suggested_spec,
                'triggering_items': triggering_items,
                'item_evaluations': item_evaluations
            }
        else:
            return {
                'recommended': False,
                'reason': "All requested items are routine consumables or standard hospital supplies not requiring technical evaluation.",
                'suggested_specialization': None,
                'triggering_items': [],
                'item_evaluations': item_evaluations
            }

    def determine_technical_requirement(self):
        """
        Advisory recommendation wrapper returning (is_recommended: bool, suggested_specialization: str or None).
        The actual routing decision is made exclusively by the Purchase Officer.
        """
        advisory = self.get_technical_evaluation_advisory()
        return advisory['recommended'], advisory['suggested_specialization']

    def assign_purchase_officer(self, save=False):
        """
        Automatically selects and assigns an eligible Purchase Officer with the lowest current workload.
        Excludes inactive/disabled Purchase Officers.
        Workload is determined by currently active Purchase Requisitions waiting for PO review (status=SUBMITTED).
        Deterministic fair tie-breaking based on least recently assigned (or lowest ID).
        """
        from django.contrib.auth import get_user_model
        from django.db.models import Count, Max, Q
        from datetime import datetime, timezone as dt_timezone

        User = get_user_model()
        eligible_pos = User.objects.filter(
            Q(role__name__icontains='purchase') | Q(role__name__icontains='procurement officer'),
            is_active=True
        )
        if self.requested_by_id:
            eligible_pos = eligible_pos.exclude(id=self.requested_by_id)

        if not eligible_pos.exists():
            return None

        # Annotate active workload of requisitions with status=SUBMITTED
        pos_with_workload = eligible_pos.annotate(
            active_workload=Count(
                'assigned_requisitions',
                filter=Q(assigned_requisitions__status=self.StatusChoices.SUBMITTED)
            ),
            last_assigned=Max('assigned_requisitions__assigned_at')
        )

        min_time = datetime.min.replace(tzinfo=dt_timezone.utc)
        sorted_pos = sorted(
            pos_with_workload,
            key=lambda u: (
                u.active_workload,
                u.last_assigned or min_time,
                u.id
            )
        )

        selected_po = sorted_pos[0]
        self.assigned_purchase_officer = selected_po
        self.assigned_at = timezone.now()

        if save and self.pk:
            self.save(update_fields=['assigned_purchase_officer', 'assigned_at', 'updated_at'])

        return selected_po

    def save(self, *args, **kwargs):
        if not self.req_number:
            year = timezone.now().strftime('%Y')
            count = Requisition.objects.filter(created_at__year=year).count() + 1
            self.req_number = f"REQ-{year}-{count:05d}"

        if self.status == self.StatusChoices.SUBMITTED:
            if not self.submitted_at:
                self.submitted_at = timezone.now()
            if not self.assigned_purchase_officer:
                self.assign_purchase_officer()

        # NOTE: Department Staff submission does NOT decide whether technical evaluation is required.
        # The Purchase Officer decides this explicitly during the Purchase Officer review stage.
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.req_number} - {self.title}"


class RequisitionItem(models.Model):
    requisition = models.ForeignKey(
        Requisition, on_delete=models.CASCADE, related_name='items'
    )
    item_name = models.CharField(max_length=255, verbose_name="Item / Product Name")
    category = models.CharField(max_length=150, blank=True, null=True, verbose_name="Category")
    quantity = models.PositiveIntegerField(default=1, verbose_name="Quantity")
    specifications = models.TextField(blank=True, null=True, verbose_name="Specifications")
    estimated_unit_price = models.DecimalField(
        max_digits=12, decimal_places=2, default=0.00, verbose_name="Estimated Unit Price"
    )
    total_price = models.DecimalField(
        max_digits=12, decimal_places=2, default=0.00, verbose_name="Total Price"
    )
    required_date = models.DateField(null=True, blank=True, verbose_name="Required Date")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_requisition_item'
        verbose_name = 'Requisition Item'
        verbose_name_plural = 'Requisition Items'
        ordering = ['id']

    def determine_technical_requirement_details(self):
        """
        Evaluates technical evaluation advisory details for this individual item.
        """
        return evaluate_item_technical_requirement(
            item_name=self.item_name,
            category=self.category or '',
            specifications=self.specifications or ''
        )

    def save(self, *args, **kwargs):
        if self.quantity and self.estimated_unit_price is not None:
            self.total_price = self.quantity * self.estimated_unit_price
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.item_name} (x{self.quantity}) for {self.requisition.req_number}"


class Approval(models.Model):
    class StatusChoices(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'

    requisition = models.ForeignKey(
        Requisition, on_delete=models.CASCADE, related_name='approvals'
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='approvals'
    )
    stage = models.CharField(max_length=50, help_text="Approval stage or authority role")
    status = models.CharField(
        max_length=20, choices=StatusChoices.choices, default=StatusChoices.PENDING
    )
    comments = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_approval'
        verbose_name = 'Approval'
        verbose_name_plural = 'Approvals'
        ordering = ['-created_at']

    def __str__(self):
        return f"Approval for {self.requisition.req_number} by {self.approved_by}"


class QuotationRequest(models.Model):
    class StatusChoices(models.TextChoices):
        OPEN = 'OPEN', 'Open'
        CLOSED = 'CLOSED', 'Closed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    rfq_number = models.CharField(max_length=50, unique=True, blank=True, verbose_name="RFQ Number")
    requisition = models.ForeignKey(
        Requisition, on_delete=models.CASCADE, related_name='quotation_requests'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_rfqs'
    )
    title = models.CharField(max_length=255)
    issue_date = models.DateField(auto_now_add=True)
    due_date = models.DateField()
    terms_and_conditions = models.TextField(blank=True, null=True)
    status = models.CharField(
        max_length=20, choices=StatusChoices.choices, default=StatusChoices.OPEN
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_quotation_request'
        verbose_name = 'Quotation Request (RFQ)'
        verbose_name_plural = 'Quotation Requests (RFQs)'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.rfq_number:
            year = timezone.now().strftime('%Y')
            count = QuotationRequest.objects.filter(created_at__year=year).count() + 1
            self.rfq_number = f"RFQ-{year}-{count:05d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.rfq_number} - {self.title}"


class Quotation(models.Model):
    class StatusChoices(models.TextChoices):
        SUBMITTED = 'SUBMITTED', 'Submitted'
        UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
        ACCEPTED = 'ACCEPTED', 'Accepted'
        REJECTED = 'REJECTED', 'Rejected'

    quotation_number = models.CharField(max_length=50, unique=True, blank=True, verbose_name="Quotation Number")
    quotation_request = models.ForeignKey(
        QuotationRequest, on_delete=models.CASCADE, related_name='quotations'
    )
    vendor = models.ForeignKey(
        'vendors.Vendor', on_delete=models.CASCADE, related_name='quotations'
    )
    submission_date = models.DateTimeField(auto_now_add=True)
    valid_until = models.DateField(null=True, blank=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    lead_time_days = models.PositiveIntegerField(null=True, blank=True, help_text="Delivery lead time in days")
    status = models.CharField(
        max_length=20, choices=StatusChoices.choices, default=StatusChoices.SUBMITTED
    )
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_quotation'
        verbose_name = 'Quotation'
        verbose_name_plural = 'Quotations'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.quotation_number:
            year = timezone.now().strftime('%Y')
            count = Quotation.objects.filter(created_at__year=year).count() + 1
            self.quotation_number = f"QT-{year}-{count:05d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.quotation_number} - {self.vendor}"


class QuotationItem(models.Model):
    quotation = models.ForeignKey(
        Quotation, on_delete=models.CASCADE, related_name='items'
    )
    item_name = models.CharField(max_length=255)
    specification = models.TextField(blank=True, null=True)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    total_price = models.DecimalField(max_digits=12, decimal_places=2, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_quotation_item'
        verbose_name = 'Quotation Item'
        verbose_name_plural = 'Quotation Items'

    def save(self, *args, **kwargs):
        if self.quantity and self.unit_price:
            self.total_price = self.quantity * self.unit_price
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.item_name} (Qty: {self.quantity})"


class PurchaseOrder(models.Model):
    class StatusChoices(models.TextChoices):
        ISSUED = 'ISSUED', 'Issued'
        PARTIALLY_DELIVERED = 'PARTIALLY_DELIVERED', 'Partially Delivered'
        DELIVERED = 'DELIVERED', 'Delivered'
        INSPECTED = 'INSPECTED', 'Inspected'
        CLOSED = 'CLOSED', 'Closed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    po_number = models.CharField(max_length=50, unique=True, blank=True, verbose_name="PO Number")
    quotation = models.ForeignKey(
        Quotation, on_delete=models.SET_NULL, null=True, blank=True, related_name='purchase_orders'
    )
    vendor = models.ForeignKey(
        'vendors.Vendor', on_delete=models.CASCADE, related_name='purchase_orders'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_pos'
    )
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    order_date = models.DateField(auto_now_add=True)
    expected_delivery_date = models.DateField(null=True, blank=True)
    terms_and_conditions = models.TextField(blank=True, null=True)
    status = models.CharField(
        max_length=30, choices=StatusChoices.choices, default=StatusChoices.ISSUED
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_purchase_order'
        verbose_name = 'Purchase Order'
        verbose_name_plural = 'Purchase Orders'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.po_number:
            year = timezone.now().strftime('%Y')
            count = PurchaseOrder.objects.filter(created_at__year=year).count() + 1
            self.po_number = f"PO-{year}-{count:05d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.po_number} - {self.vendor}"


class PurchaseOrderItem(models.Model):
    purchase_order = models.ForeignKey(
        PurchaseOrder, on_delete=models.CASCADE, related_name='items'
    )
    item_name = models.CharField(max_length=255)
    specification = models.TextField(blank=True, null=True)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    total_price = models.DecimalField(max_digits=12, decimal_places=2, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_po_item'
        verbose_name = 'Purchase Order Item'
        verbose_name_plural = 'Purchase Order Items'

    def save(self, *args, **kwargs):
        if self.quantity and self.unit_price:
            self.total_price = self.quantity * self.unit_price
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.item_name} (Qty: {self.quantity})"
