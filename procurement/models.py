from django.db import models
from django.conf import settings
from django.utils import timezone
from accounts.models import Department

APPROVED_SPECIALIZATIONS = [
    'Biomedical Equipment',
    'Medical, Surgical & Critical Care Equipment',
    'Laboratory & Diagnostic Equipment',
    'Radiology & Medical Imaging',
    'IT & Healthcare Technology',
    'Facilities & General Engineering',
    # Legacy aliases for backwards compatibility
    'Medical & Surgical Equipment',
    'Critical Care & Life-Support Equipment',
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
    ],
    'Facilities & General Engineering': [
        'maintenance', 'technical service', 'hvac', 'generator', 'chiller', 'compressor',
        'medical gas', 'pipeline', 'ups', 'substation', 'boiler', 'engineering', 'electrical panel',
        'plumbing system', 'infrastructure'
    ]
}

# Category to Technical Specialization mapping across hospital departments & vendor catalog
CATEGORY_TO_SPECIALIZATION = {
    # 1. Biomedical Equipment
    'Biomedical Equipment': 'Biomedical Equipment',

    # 2. Medical, Surgical & Critical Care Equipment
    'Medical Equipment & Devices': 'Medical, Surgical & Critical Care Equipment',
    'Surgical Instruments': 'Medical, Surgical & Critical Care Equipment',
    'ICU & Critical Care Equipment': 'Medical, Surgical & Critical Care Equipment',
    'Medical, Surgical & Critical Care Equipment': 'Medical, Surgical & Critical Care Equipment',
    'Medical & Surgical Equipment': 'Medical, Surgical & Critical Care Equipment',
    'Critical Care & Life-Support Equipment': 'Medical, Surgical & Critical Care Equipment',

    # 3. Laboratory & Diagnostic Equipment
    'Laboratory Equipment & Supplies': 'Laboratory & Diagnostic Equipment',
    'Diagnostic Equipment': 'Laboratory & Diagnostic Equipment',
    'Laboratory & Diagnostic Equipment': 'Laboratory & Diagnostic Equipment',
    'Laboratory Equipment': 'Laboratory & Diagnostic Equipment',

    # 4. Radiology & Medical Imaging
    'Radiology & Imaging Equipment': 'Radiology & Medical Imaging',
    'Radiology & Medical Imaging': 'Radiology & Medical Imaging',
    'Radiology & Imaging': 'Radiology & Medical Imaging',

    # 5. IT & Healthcare Technology
    'IT Hardware & Software': 'IT & Healthcare Technology',
    'IT & Healthcare Technology': 'IT & Healthcare Technology',
    'IT & Digital Systems': 'IT & Healthcare Technology',

    # 6. Facilities & General Engineering
    'Maintenance & Technical Services': 'Facilities & General Engineering',
    'Facilities & General Engineering': 'Facilities & General Engineering',
    'Facilities & Maintenance': 'Facilities & General Engineering',
}

NON_TECHNICAL_CATEGORIES = {
    'medical consumables',
    'general hospital supplies',
    'cleaning & housekeeping supplies',
    'hospital furniture & fixtures',
    'other',
    'general office supplies',
    'furniture, office & general supplies',
    'stationery',
}


def determine_specialization_from_category(category_name):
    """
    Matches a purchase request or item category to one of the 6 Technical Specializations:
    - Biomedical Equipment
    - Medical, Surgical & Critical Care Equipment
    - Laboratory & Diagnostic Equipment
    - Radiology & Medical Imaging
    - IT & Healthcare Technology
    - Facilities & General Engineering

    Returns:
        - str: One of the 6 Technical Specializations if matched.
        - None: If the purchase category does not require Technical Evaluation (routine/non-technical)
                or is empty/unrecognized.
    """
    if not category_name or not str(category_name).strip():
        return None

    cat_str = str(category_name).strip()
    cat_lower = cat_str.lower()

    # Check non-technical categories first
    if cat_lower in NON_TECHNICAL_CATEGORIES or any(nt in cat_lower for nt in ['consumable', 'supplies', 'stationery', 'furniture', 'housekeeping', 'cleaning']):
        if not any(eq in cat_lower for eq in ['equipment', 'device', 'instrument', 'imaging', 'hardware', 'technical', 'diagnostic', 'biomedical']):
            return None

    # Check exact match in map
    if cat_str in CATEGORY_TO_SPECIALIZATION:
        return CATEGORY_TO_SPECIALIZATION[cat_str]

    # Check case-insensitive match
    for k, v in CATEGORY_TO_SPECIALIZATION.items():
        if k.lower() == cat_lower:
            return v

    # Check if category contains an approved specialization or key
    for k, v in CATEGORY_TO_SPECIALIZATION.items():
        if k.lower() in cat_lower:
            return v

    return None


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
        APPROVED = 'APPROVED', 'Committee Approved'
        REJECTED = 'REJECTED', 'Rejected'
        RFQ_ISSUED = 'RFQ_ISSUED', 'Awaiting Quotations'
        QUOTATIONS_RECEIVED = 'QUOTATIONS_RECEIVED', 'Quotations Received'
        VENDOR_SELECTED = 'VENDOR_SELECTED', 'Vendor Selected'
        PO_CREATED = 'PO_CREATED', 'PO Created'
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
    assigned_technical_officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='assigned_technical_requisitions',
        verbose_name="Assigned Technical Officer"
    )
    technical_assigned_at = models.DateTimeField(null=True, blank=True, verbose_name="Technical Assigned At")
    technical_compliance = models.CharField(
        max_length=50, blank=True, null=True, verbose_name="Technical Compliance"
    )
    technical_evaluation_remarks = models.TextField(
        blank=True, null=True, verbose_name="Technical Evaluation Remarks"
    )
    technical_recommendation = models.CharField(
        max_length=50, blank=True, null=True, verbose_name="Technical Recommendation"
    )
    technical_evaluated_at = models.DateTimeField(
        null=True, blank=True, verbose_name="Technical Evaluated At"
    )
    technical_document = models.FileField(
        upload_to='requisitions/technical_documents/',
        null=True,
        blank=True,
        verbose_name="Technical Supporting Document"
    )
    assigned_committee_member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='assigned_committee_requisitions',
        verbose_name="Assigned Committee Member",
        help_text="Designated Procurement Committee member assigned for vendor sourcing and purchasing."
    )
    committee_assigned_at = models.DateTimeField(
        null=True, blank=True, verbose_name="Committee Assigned At"
    )
    # Committee Vendor Selection Fields
    selected_vendor = models.ForeignKey(
        'vendors.Vendor',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='selected_for_requisitions',
        verbose_name="Selected Vendor"
    )
    selected_quotation = models.ForeignKey(
        'Quotation',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='selected_for_requisitions',
        verbose_name="Selected Quotation"
    )
    vendor_selected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='requisition_vendor_selections',
        verbose_name="Vendor Selected By"
    )
    vendor_selected_at = models.DateTimeField(null=True, blank=True, verbose_name="Vendor Selection Date")
    vendor_selection_remarks = models.TextField(blank=True, null=True, verbose_name="Vendor Selection Remarks / Justification")

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
        Workload is calculated using all active/ongoing requisitions currently assigned to that PO.
        A requisition continues counting towards workload through all active stages (technical review,
        committee review, approval, RFQ, etc.) and is only excluded upon reaching a terminal/closed state
        (COMPLETED, REJECTED, CANCELLED, CLOSED, DRAFT).
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

        # Exclude terminal/closed/inactive statuses from active ongoing workload
        TERMINAL_STATUSES = [
            self.StatusChoices.COMPLETED,
            self.StatusChoices.REJECTED,
            self.StatusChoices.CANCELLED,
            self.StatusChoices.DRAFT,
            'CLOSED',
        ]

        # Annotate active workload of all ongoing assigned requisitions
        pos_with_workload = eligible_pos.annotate(
            active_workload=Count(
                'assigned_requisitions',
                filter=~Q(assigned_requisitions__status__in=TERMINAL_STATUSES) & Q(assigned_requisitions__isnull=False)
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

    def get_requisition_technical_specialization(self):
        """
        Determines the required Technical Specialization for this requisition
        based on requisition category or item categories.
        """
        if self.category:
            spec = determine_specialization_from_category(self.category)
            if spec:
                return spec

        # Check items
        if self.pk:
            for item in self.items.all():
                if item.category:
                    item_spec = determine_specialization_from_category(item.category)
                    if item_spec:
                        return item_spec

        # Advisory fallback if items had titles/specifications evaluated
        advisory = self.get_technical_evaluation_advisory()
        if advisory.get('recommended') and advisory.get('suggested_specialization'):
            adv_spec = advisory.get('suggested_specialization')
            return CATEGORY_TO_SPECIALIZATION.get(adv_spec, adv_spec)

        return None

    def assign_technical_officer(self, specialization=None, save=False):
        """
        Automatically selects and assigns an eligible active Technical Officer
        whose assigned Technical Specialization matches the required specialization.

        Assignment Pipeline:
        Purchase Item Category -> Technical Specialization -> Eligible Technical Officers -> Workload-based assignment.

        Workload-balancing logic:
        - Count of all active/ongoing requisitions assigned to that Technical Officer
          (excluding terminal statuses: COMPLETED, REJECTED, CANCELLED, DRAFT, CLOSED).
        - Tie-breaking: lowest active workload, least recently assigned (technical_assigned_at), lowest user ID.
        - If purchase category does not require Technical Evaluation: do not assign a Technical Officer.
        - If no eligible Technical Officer exists for the required specialization: keep unassigned
          (do NOT assign an unrelated Technical Officer).
        """
        from django.contrib.auth import get_user_model
        from django.db.models import Count, Max, Q
        from datetime import datetime, timezone as dt_timezone

        # 1. Determine required Technical Specialization if not provided
        if not specialization or not str(specialization).strip():
            specialization = self.get_requisition_technical_specialization()

        if not specialization:
            self.assigned_technical_officer = None
            self.technical_assigned_at = None
            if save and self.pk:
                self.save(update_fields=['assigned_technical_officer', 'technical_assigned_at', 'updated_at'])
            return None

        # Canonicalize specialization among the 6 approved Technical Specializations
        canonical_spec = CATEGORY_TO_SPECIALIZATION.get(str(specialization).strip(), str(specialization).strip())
        spec_norm = str(specialization).strip().lower()
        canon_norm = canonical_spec.lower()

        # 2. Find only existing active Technical Officers
        User = get_user_model()
        eligible_tos = User.objects.filter(
            Q(role__name__icontains='technical') | Q(role__name__icontains='technical officer'),
            is_active=True
        )
        if self.requested_by_id:
            eligible_tos = eligible_tos.exclude(id=self.requested_by_id)

        # 3. Match only Technical Officers whose assigned Technical Specialization matches
        matching_tos = []
        for to in eligible_tos:
            to_specs = to.technical_specializations or []
            if isinstance(to_specs, list):
                if any(
                    isinstance(s, str) and (
                        s.strip().lower() == spec_norm or
                        s.strip().lower() == canon_norm or
                        CATEGORY_TO_SPECIALIZATION.get(s.strip(), s.strip()).lower() == spec_norm or
                        CATEGORY_TO_SPECIALIZATION.get(s.strip(), s.strip()).lower() == canon_norm
                    )
                    for s in to_specs
                ):
                    matching_tos.append(to)

        # 4. If no eligible Technical Officer exists for required specialization,
        # do not assign an unrelated Technical Officer. Keep unassigned.
        if not matching_tos:
            self.assigned_technical_officer = None
            self.technical_assigned_at = None
            self.technical_specialization = specialization
            if save and self.pk:
                self.save(update_fields=['assigned_technical_officer', 'technical_assigned_at', 'technical_specialization', 'updated_at'])
            return None

        # 5. Workload-balancing across eligible Technical Officers
        TERMINAL_STATUSES = [
            self.StatusChoices.COMPLETED,
            self.StatusChoices.REJECTED,
            self.StatusChoices.CANCELLED,
            self.StatusChoices.DRAFT,
            'CLOSED',
        ]

        matching_to_ids = [to.id for to in matching_tos]
        tos_with_workload = User.objects.filter(id__in=matching_to_ids).annotate(
            active_workload=Count(
                'assigned_technical_requisitions',
                filter=~Q(assigned_technical_requisitions__status__in=TERMINAL_STATUSES) & Q(assigned_technical_requisitions__isnull=False)
            ),
            last_assigned=Max('assigned_technical_requisitions__technical_assigned_at')
        )

        min_time = datetime.min.replace(tzinfo=dt_timezone.utc)
        sorted_tos = sorted(
            tos_with_workload,
            key=lambda u: (
                u.active_workload,
                u.last_assigned or min_time,
                u.id
            )
        )

        selected_to = sorted_tos[0]
        self.assigned_technical_officer = selected_to
        self.technical_assigned_at = timezone.now()
        self.technical_specialization = specialization

        if save and self.pk:
            self.save(update_fields=['assigned_technical_officer', 'technical_assigned_at', 'technical_specialization', 'updated_at'])

        return selected_to

    def is_returned_for_technical_clarification(self):
        """
        Checks if this requisition was returned for clarification by a Technical Officer.
        Ensures the assigned Technical Officer is preserved and routed directly back to them upon resubmission.
        """
        if not self.assigned_technical_officer_id:
            return False
        # If the requisition has already moved forward past technical evaluation or reached a terminal/approved state,
        # it is no longer actively returned for clarification.
        if self.status in [
            self.StatusChoices.PENDING_COMMITTEE_REVIEW,
            self.StatusChoices.PENDING_APPROVAL,
            self.StatusChoices.APPROVED,
            self.StatusChoices.RFQ_ISSUED,
            self.StatusChoices.QUOTATIONS_RECEIVED,
            self.StatusChoices.REJECTED,
            self.StatusChoices.CANCELLED,
            self.StatusChoices.COMPLETED,
        ]:
            return False
        if self.technical_recommendation in ['Requires Clarification', 'REQUIRES_CLARIFICATION', 'Return for Clarification']:
            return True
        if self.pk:
            latest_eval = self.technical_evaluations.order_by('-created_at').first()
            if latest_eval and latest_eval.recommendation in ['Requires Clarification', 'REQUIRES_CLARIFICATION', 'Return for Clarification']:
                return True
        return False


    def assign_committee_member(self, save=False):
        """
        Assigns this purchase-ready requisition to exactly one of the five existing Procurement Committee members.
        Workload distribution rules:
        - One request per committee member: Each purchase-ready request is assigned to exactly one member.
        - Equal workload distribution: Automatic round-robin assignment.
        - Initially distribute requests one per member in sequence (Member 1, Member 2, ..., Member 5).
        - After every member has an assignment, assign the next request to the member with the fewest active purchase assignments.
        - If tied, continue round-robin order.
        - As earlier assignments are completed, workloads update dynamically to keep distribution balanced.
        - Preserve the assignment throughout the workflow; prevent duplicate assignments.
        """
        if self.assigned_committee_member_id:
            return self.assigned_committee_member

        from django.contrib.auth import get_user_model
        from django.utils import timezone
        from django.db import transaction

        User = get_user_model()

        with transaction.atomic():
            # Retrieve the 5 active committee members in deterministic order (Member 1 to Member 5)
            # select_for_update() ensures concurrent incoming requests are serialized and assigned fairly
            committee_members = list(User.objects.select_for_update().filter(
                role__name__icontains='committee',
                is_active=True
            ).order_by('employee_id', 'id'))

            if not committee_members:
                return None

            N = len(committee_members)

            # Terminal statuses that no longer count as active purchase workload
            TERMINAL_STATUSES = [
                self.StatusChoices.COMPLETED,
                self.StatusChoices.REJECTED,
                self.StatusChoices.CANCELLED,
                'CLOSED',
            ]

            # Calculate active purchase workload for each committee member
            workloads = {}
            for m in committee_members:
                w = Requisition.objects.filter(
                    assigned_committee_member=m
                ).exclude(status__in=TERMINAL_STATUSES).count()
                workloads[m.id] = w

            # Find the last assigned member from existing assigned requisitions
            last_assigned_req = Requisition.objects.filter(
                assigned_committee_member__isnull=False
            ).exclude(id=self.id if self.pk else None).order_by('-committee_assigned_at', '-id').first()

            last_index = -1
            if last_assigned_req and last_assigned_req.assigned_committee_member in committee_members:
                last_index = committee_members.index(last_assigned_req.assigned_committee_member)

            # Workload balancing rule:
            # Assign to the member with the fewest active purchase assignments.
            # If tied, continue round-robin order.
            min_workload = min(workloads[m.id] for m in committee_members)
            tied_candidates = [m for m in committee_members if workloads[m.id] == min_workload]

            if len(tied_candidates) == 1:
                chosen = tied_candidates[0]
            else:
                # Continue round-robin circular order from (last_index + 1)
                chosen = None
                for step in range(1, N + 1):
                    candidate = committee_members[(last_index + step) % N]
                    if candidate in tied_candidates:
                        chosen = candidate
                        break
                if not chosen:
                    chosen = tied_candidates[0]

            self.assigned_committee_member = chosen
            self.committee_assigned_at = timezone.now()

            if save and self.pk:
                self.save(update_fields=['assigned_committee_member', 'committee_assigned_at', 'updated_at'])

            return chosen

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

        if self.status == self.StatusChoices.PENDING_COMMITTEE_REVIEW:
            if not self.assigned_committee_member:
                self.assign_committee_member()
            if 'update_fields' in kwargs and kwargs['update_fields'] is not None:
                fields = set(kwargs['update_fields'])
                fields.add('assigned_committee_member')
                fields.add('committee_assigned_at')
                kwargs['update_fields'] = list(fields)

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
        RETURNED = 'RETURNED', 'Returned for Clarification'

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


class TechnicalEvaluation(models.Model):
    class ComplianceChoices(models.TextChoices):
        COMPLIANT = 'Compliant', 'Compliant'
        PARTIALLY_COMPLIANT = 'Partially Compliant', 'Partially Compliant'
        NOT_COMPLIANT = 'Not Compliant', 'Not Compliant'

    class RecommendationChoices(models.TextChoices):
        SUITABLE = 'Technically Suitable', 'Technically Suitable'
        NOT_SUITABLE = 'Technically Not Suitable', 'Technically Not Suitable'
        REQUIRES_CLARIFICATION = 'Requires Clarification', 'Requires Clarification'

    requisition = models.ForeignKey(
        Requisition, on_delete=models.CASCADE, related_name='technical_evaluations'
    )
    evaluated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='submitted_technical_evaluations'
    )
    compliance = models.CharField(
        max_length=50, choices=ComplianceChoices.choices, verbose_name="Technical Compliance"
    )
    remarks = models.TextField(verbose_name="Technical Assessment / Remarks")
    recommendation = models.CharField(
        max_length=50, choices=RecommendationChoices.choices, verbose_name="Recommendation"
    )
    supporting_document = models.FileField(
        upload_to='technical_evaluations/documents/',
        null=True,
        blank=True,
        verbose_name="Supporting Technical Documents"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_technical_evaluation'
        verbose_name = 'Technical Evaluation'
        verbose_name_plural = 'Technical Evaluations'
        ordering = ['-created_at']

    def __str__(self):
        return f"Technical Evaluation for {self.requisition.req_number} by {self.evaluated_by} ({self.recommendation})"


class QuotationRequest(models.Model):
    class StatusChoices(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        SENT = 'SENT', 'Sent'
        OPEN = 'OPEN', 'Open'
        CLOSED = 'CLOSED', 'Closed'
        CANCELLED = 'CANCELLED', 'Cancelled'
        EXPIRED = 'EXPIRED', 'Expired'

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
    delivery_requirements = models.TextField(blank=True, null=True, help_text="Delivery timeline and location requirements")
    delivery_location = models.CharField(max_length=255, blank=True, null=True)
    estimated_budget = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    terms_and_conditions = models.TextField(blank=True, null=True)
    status = models.CharField(
        max_length=20, choices=StatusChoices.choices, default=StatusChoices.SENT
    )
    cancellation_reason = models.TextField(blank=True, null=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='cancelled_rfqs'
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)
    invited_vendors = models.ManyToManyField(
        'vendors.Vendor', through='RFQVendorInvitation', related_name='invited_quotation_requests', blank=True
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


class RFQItem(models.Model):
    quotation_request = models.ForeignKey(
        QuotationRequest, on_delete=models.CASCADE, related_name='items'
    )
    requisition_item = models.ForeignKey(
        RequisitionItem, on_delete=models.SET_NULL, null=True, blank=True, related_name='rfq_items'
    )
    item_name = models.CharField(max_length=255)
    category = models.CharField(max_length=150, blank=True, null=True)
    quantity = models.PositiveIntegerField(default=1)
    unit_of_measurement = models.CharField(max_length=50, default='Piece', blank=True)
    technical_specifications = models.TextField(blank=True, null=True)
    estimated_unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_estimated_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_rfq_item'
        verbose_name = 'RFQ Item'
        verbose_name_plural = 'RFQ Items'
        ordering = ['id']

    def save(self, *args, **kwargs):
        if self.quantity and self.estimated_unit_price is not None:
            self.total_estimated_price = self.quantity * self.estimated_unit_price
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.item_name} (x{self.quantity}) for {self.quotation_request.rfq_number}"


class RFQVendorInvitation(models.Model):
    class InvitationStatus(models.TextChoices):
        INVITED = 'INVITED', 'Invited'
        VIEWED = 'VIEWED', 'Viewed'
        ACCEPTED = 'ACCEPTED', 'Accepted'
        DECLINED = 'DECLINED', 'Declined'
        QUOTED = 'QUOTED', 'Quoted'

    quotation_request = models.ForeignKey(
        QuotationRequest, on_delete=models.CASCADE, related_name='vendor_invitations'
    )
    vendor = models.ForeignKey(
        'vendors.Vendor', on_delete=models.CASCADE, related_name='rfq_invitations'
    )
    status = models.CharField(
        max_length=20, choices=InvitationStatus.choices, default=InvitationStatus.INVITED
    )
    invited_at = models.DateTimeField(auto_now_add=True)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_rfq_invitations'
    )
    notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'tbl_rfq_vendor_invitation'
        verbose_name = 'RFQ Vendor Invitation'
        verbose_name_plural = 'RFQ Vendor Invitations'
        unique_together = ('quotation_request', 'vendor')
        ordering = ['-invited_at']

    def __str__(self):
        return f"{self.quotation_request.rfq_number} -> {self.vendor.company_name} ({self.status})"


class Quotation(models.Model):
    class StatusChoices(models.TextChoices):
        SUBMITTED = 'SUBMITTED', 'Received'
        UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
        RECOMMENDED = 'RECOMMENDED', 'Recommended'
        SELECTED = 'SELECTED', 'Selected'
        ACCEPTED = 'ACCEPTED', 'Accepted'
        NOT_SELECTED = 'NOT_SELECTED', 'Not Selected'
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
    tax_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.00, blank=True, null=True, verbose_name="Tax / GST %")
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, blank=True, null=True, verbose_name="Tax Amount")
    shipping_charges = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, blank=True, null=True, verbose_name="Shipping Charges")
    quotation_document = models.FileField(upload_to='quotations/documents/', null=True, blank=True, verbose_name="Quotation Document")
    lead_time_days = models.PositiveIntegerField(null=True, blank=True, help_text="Delivery lead time in days")
    status = models.CharField(
        max_length=20, choices=StatusChoices.choices, default=StatusChoices.SUBMITTED
    )
    remarks = models.TextField(blank=True, null=True)
    evaluation_remarks = models.TextField(blank=True, null=True, verbose_name="Committee Evaluation Remarks")
    is_recommended = models.BooleanField(default=False, verbose_name="Recommended by Committee")
    recommended_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='recommended_quotations'
    )
    recommended_at = models.DateTimeField(null=True, blank=True)
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
    requisition = models.ForeignKey(
        Requisition, on_delete=models.SET_NULL, null=True, blank=True, related_name='purchase_orders', verbose_name="Purchase Requisition"
    )
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
