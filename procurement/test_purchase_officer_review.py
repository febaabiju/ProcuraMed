import os
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import Department, Role, AuditLog
from procurement.models import Requisition, RequisitionItem, Approval

User = get_user_model()


class PurchaseOfficerReviewWorkflowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        # Create Roles
        cls.po_role, _ = Role.objects.get_or_create(
            name='Purchase Officer',
            defaults={'description': 'Purchase Officer Role'}
        )
        cls.staff_role, _ = Role.objects.get_or_create(
            name='Department Staff',
            defaults={'description': 'Department Staff Role'}
        )
        cls.committee_role, _ = Role.objects.get_or_create(
            name='Procurement Committee',
            defaults={'description': 'Procurement Committee Role'}
        )

        cls.tech_role, _ = Role.objects.get_or_create(
            name='Technical Officer',
            defaults={'description': 'Technical Officer Role'}
        )

        # Create Departments
        cls.surgery_dept, _ = Department.objects.get_or_create(
            name='Medical & Surgical Equipment',
            defaults={'code': 'SUR', 'is_active': True}
        )
        cls.admin_dept, _ = Department.objects.get_or_create(
            name='Administration & Office Management',
            defaults={'code': 'ADM', 'is_active': True}
        )

        # Create Dynamic Test Users (isolated from production accounts)
        cls.staff_user = User.objects.create_user(
            username='test_dynamic_staff_1',
            email='test_staff_1@procuramed.test',
            password='TestPassword123!',
            first_name='Dynamic',
            last_name='Staff',
            role=cls.staff_role,
            department=cls.surgery_dept
        )
        cls.other_staff_user = User.objects.create_user(
            username='test_dynamic_staff_2',
            email='test_staff_2@procuramed.test',
            password='TestPassword123!',
            first_name='Other',
            last_name='Staff',
            role=cls.staff_role,
            department=cls.admin_dept
        )
        cls.po_user = User.objects.create_user(
            username='test_dynamic_po_1',
            email='test_po_1@procuramed.test',
            password='TestPassword123!',
            first_name='Dynamic',
            last_name='PO',
            role=cls.po_role,
            department=cls.admin_dept
        )
        cls.committee_user = User.objects.create_user(
            username='test_dynamic_committee_1',
            email='test_committee_1@procuramed.test',
            password='TestPassword123!',
            first_name='Dynamic',
            last_name='Committee',
            role=cls.committee_role,
            department=cls.admin_dept
        )
        cls.tech_user = User.objects.create_user(
            username='test_dynamic_tech_1',
            email='test_tech_1@procuramed.test',
            password='TestPassword123!',
            first_name='Dynamic',
            last_name='Tech',
            role=cls.tech_role,
            department=cls.surgery_dept,
            technical_specializations=['Biomedical Equipment', 'Medical & Surgical Equipment']
        )

    def setUp(self):
        self.client = APIClient()

    def test_01_staff_submission_sets_submitted_at_and_audit_log(self):
        """Test submitting a draft requisition sets submitted_at and records AuditLog."""
        self.client.force_authenticate(user=self.staff_user)

        # Create a draft requisition with an item
        req = Requisition.objects.create(
            req_number='REQ-TEST-0001',
            title='Surgery Light Units',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            priority='HIGH',
            estimated_budget=Decimal('150000.00'),
            status=Requisition.StatusChoices.DRAFT,
            justification='Operating theatre emergency illumination unit replacement.'
        )
        RequisitionItem.objects.create(
            requisition=req,
            item_name='LED Surgical OT Light',
            category='Medical Equipment & Devices',
            quantity=2,
            estimated_unit_price=Decimal('75000.00'),
            total_price=Decimal('150000.00'),
            required_date=timezone.localdate() + timezone.timedelta(days=14)
        )

        self.assertIsNone(req.submitted_at)

        # Submit requisition
        res = self.client.post(f'/api/procurement/requisitions/{req.id}/submit/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        req.refresh_from_db()
        self.assertEqual(req.status, Requisition.StatusChoices.SUBMITTED)
        self.assertIsNotNone(req.submitted_at)

        # Verify AuditLog
        log_exists = AuditLog.objects.filter(
            user=self.staff_user,
            action='Requisition Submitted',
            module='Purchase Requisition'
        ).exists()
        self.assertTrue(log_exists, "AuditLog should record Requisition Submitted event.")

    def test_02_purchase_officer_queue_displays_only_submitted_requisitions(self):
        """Purchase officer queue and dashboard should only show SUBMITTED requisitions."""
        # Create one DRAFT, one SUBMITTED, one APPROVED
        req_draft = Requisition.objects.create(
            req_number='REQ-QUEUE-DRAFT',
            title='Draft Requisition',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.DRAFT,
            estimated_budget=Decimal('50000.00')
        )
        req_submitted = Requisition.objects.create(
            req_number='REQ-QUEUE-SUBMITTED',
            title='Submitted Surgical Packs',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            submitted_at=timezone.now(),
            estimated_budget=Decimal('85000.00')
        )
        RequisitionItem.objects.create(
            requisition=req_submitted,
            item_name='Surgical Pack Set',
            category='Surgical Instruments',
            quantity=10,
            estimated_unit_price=Decimal('8500.00'),
            total_price=Decimal('85000.00'),
            required_date=timezone.localdate() + timezone.timedelta(days=7)
        )
        req_approved = Requisition.objects.create(
            req_number='REQ-QUEUE-APPROVED',
            title='Approved Requisition',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.APPROVED,
            submitted_at=timezone.now(),
            estimated_budget=Decimal('10000.00')
        )

        self.client.force_authenticate(user=self.po_user)

        # Check PO Dashboard
        dash_res = self.client.get('/api/procurement/purchase-officer-dashboard/')
        self.assertEqual(dash_res.status_code, status.HTTP_200_OK)
        pending_list = dash_res.data.get('pending_requisitions', [])
        pending_req_numbers = [r['req_number'] for r in pending_list]

        self.assertIn('REQ-QUEUE-SUBMITTED', pending_req_numbers)
        self.assertNotIn('REQ-QUEUE-DRAFT', pending_req_numbers)
        self.assertNotIn('REQ-QUEUE-APPROVED', pending_req_numbers)

        # Check fields in dashboard queue
        sub_item = next(r for r in pending_list if r['req_number'] == 'REQ-QUEUE-SUBMITTED')
        self.assertIn('req_number', sub_item)
        self.assertIn('department_name', sub_item)
        self.assertIn('requested_by_name', sub_item)
        self.assertIn('title', sub_item)
        self.assertIn('priority', sub_item)
        self.assertIn('estimated_budget', sub_item)
        self.assertIn('required_date', sub_item)
        self.assertIn('submitted_at', sub_item)
        self.assertIn('status', sub_item)

    def test_03_purchase_officer_cannot_review_own_requisition(self):
        """Purchase officer cannot review a requisition where they are the requester."""
        req = Requisition.objects.create(
            req_number='REQ-OWN-001',
            title='Office Printer Cartridges',
            department=self.admin_dept,
            requested_by=self.po_user,  # PO is the requester
            status=Requisition.StatusChoices.SUBMITTED,
            submitted_at=timezone.now(),
            estimated_budget=Decimal('12000.00')
        )

        self.client.force_authenticate(user=self.po_user)
        res = self.client.post(f'/api/procurement/requisitions/{req.id}/review/', {
            'action': 'PROCEED',
            'reason': 'Looks good to me.'
        })
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("cannot review your own submitted requisition", res.data.get('detail', ''))

    def test_04_return_for_correction_requires_reason_and_sets_returned(self):
        """Return for correction must require a reason, set status to RETURNED, and create no Approval record."""
        req = Requisition.objects.create(
            req_number='REQ-RET-001',
            title='Incomplete Surgical Scissors Requisition',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            submitted_at=timezone.now(),
            estimated_budget=Decimal('25000.00')
        )

        self.client.force_authenticate(user=self.po_user)

        # 1. Attempt return without reason
        res_no_reason = self.client.post(f'/api/procurement/requisitions/{req.id}/review/', {
            'action': 'RETURN',
            'reason': ''
        })
        self.assertEqual(res_no_reason.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('reason', res_no_reason.data)

        # 2. Return with valid reason
        res_valid = self.client.post(f'/api/procurement/requisitions/{req.id}/review/', {
            'action': 'RETURN_FOR_CORRECTION',
            'reason': 'Please provide detailed specifications for grade of stainless steel and sterilization type.'
        })
        self.assertEqual(res_valid.status_code, status.HTTP_200_OK)

        req.refresh_from_db()
        self.assertEqual(req.status, Requisition.StatusChoices.RETURNED)
        self.assertEqual(req.reviewed_by, self.po_user)
        self.assertIsNotNone(req.reviewed_at)
        self.assertIn('grade of stainless steel', req.review_comments)

        # Verify NO Approval record was created for RETURN
        approval_count = Approval.objects.filter(requisition=req).count()
        self.assertEqual(approval_count, 0, "No Approval record should be created when returning for correction.")

        # Verify AuditLog created
        audit_exists = AuditLog.objects.filter(
            user=self.po_user,
            action='Purchase Officer Requisition Returned',
            module='Purchase Requisition'
        ).exists()
        self.assertTrue(audit_exists, "AuditLog should record Purchase Officer Requisition Returned.")

    def test_05_staff_can_edit_and_resubmit_returned_requisition(self):
        """Department staff can update a RETURNED requisition and resubmit it."""
        req = Requisition.objects.create(
            req_number='REQ-RESUBMIT-001',
            title='Returned Instrument Set',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.RETURNED,
            review_comments='Fix quantity and pricing.',
            reviewed_by=self.po_user,
            reviewed_at=timezone.now(),
            submitted_at=timezone.now() - timezone.timedelta(days=2),
            estimated_budget=Decimal('20000.00')
        )
        item = RequisitionItem.objects.create(
            requisition=req,
            item_name='Micro Dissecting Forceps',
            category='Surgical Instruments',
            quantity=5,
            estimated_unit_price=Decimal('4000.00'),
            total_price=Decimal('20000.00'),
            required_date=timezone.localdate() + timezone.timedelta(days=10)
        )

        self.client.force_authenticate(user=self.staff_user)

        # Resubmit
        res = self.client.post(f'/api/procurement/requisitions/{req.id}/submit/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        req.refresh_from_db()
        self.assertEqual(req.status, Requisition.StatusChoices.SUBMITTED)
        # Previous review feedback remains preserved in review_comments until new review
        self.assertEqual(req.review_comments, 'Fix quantity and pricing.')

        # AuditLog should show Requisition Resubmitted
        audit_resubmitted = AuditLog.objects.filter(
            user=self.staff_user,
            action='Requisition Resubmitted'
        ).exists()
        self.assertTrue(audit_resubmitted, "AuditLog should record Requisition Resubmitted.")

    def test_06_proceed_with_technical_item_routes_to_pending_technical_evaluation(self):
        """Proceeding a requisition with technical items routes to PENDING_TECHNICAL_EVALUATION and creates Approval."""
        req = Requisition.objects.create(
            req_number='REQ-TECH-001',
            title='Electrosurgical Generator Unit',
            category='Medical Equipment & Devices',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            submitted_at=timezone.now(),
            estimated_budget=Decimal('350000.00')
        )
        RequisitionItem.objects.create(
            requisition=req,
            item_name='High Frequency Electrosurgical Unit',
            category='Medical Equipment & Devices',
            quantity=1,
            estimated_unit_price=Decimal('350000.00'),
            total_price=Decimal('350000.00'),
            required_date=timezone.localdate() + timezone.timedelta(days=30)
        )

        self.client.force_authenticate(user=self.po_user)

        res = self.client.post(f'/api/procurement/requisitions/{req.id}/review/', {
            'action': 'PROCEED',
            'requires_technical_evaluation': True,
            'reason': 'Technical specifications checked and complete.'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        req.refresh_from_db()
        self.assertEqual(req.status, Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION)
        self.assertTrue(req.requires_technical_evaluation)
        self.assertEqual(req.technical_specialization, 'Biomedical Equipment')

        # Verify Approval record created
        approval = Approval.objects.filter(requisition=req).first()
        self.assertIsNotNone(approval)
        self.assertEqual(approval.stage, 'Purchase Officer Review')
        self.assertEqual(approval.status, Approval.StatusChoices.APPROVED)
        self.assertEqual(approval.approved_by, self.po_user)

        # Verify AuditLog created with exact action name
        audit_proceeded = AuditLog.objects.filter(
            user=self.po_user,
            action='Purchase Officer proceeded requisition for Technical Officer Evaluation'
        ).exists()
        self.assertTrue(audit_proceeded)

    def test_07_proceed_without_technical_item_routes_to_pending_committee_review(self):
        """Proceeding a requisition without technical items routes to PENDING_COMMITTEE_REVIEW and creates Approval."""
        req = Requisition.objects.create(
            req_number='REQ-NONTECH-001',
            title='Office Paper and Printer Toner',
            category='General Office Supplies',
            department=self.admin_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            submitted_at=timezone.now(),
            estimated_budget=Decimal('15000.00')
        )
        RequisitionItem.objects.create(
            requisition=req,
            item_name='A4 Copier Paper Reams',
            category='General Office Supplies',
            quantity=50,
            estimated_unit_price=Decimal('300.00'),
            total_price=Decimal('15000.00'),
            required_date=timezone.localdate() + timezone.timedelta(days=5)
        )

        self.client.force_authenticate(user=self.po_user)

        res = self.client.post(f'/api/procurement/requisitions/{req.id}/review/', {
            'action': 'PROCEED',
            'requires_technical_evaluation': False,
            'reason': 'Routine consumable verification passed.'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        req.refresh_from_db()
        self.assertEqual(req.status, Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW)
        self.assertFalse(req.requires_technical_evaluation)
        self.assertIsNone(req.technical_specialization)

        # Verify Approval record created
        approval = Approval.objects.filter(requisition=req).first()
        self.assertIsNotNone(approval)
        self.assertEqual(approval.stage, 'Purchase Officer Review')
        self.assertEqual(approval.status, Approval.StatusChoices.APPROVED)

        # Verify AuditLog created with exact action name
        audit_proceeded = AuditLog.objects.filter(
            user=self.po_user,
            action='Purchase Officer proceeded requisition directly to Procurement Committee'
        ).exists()
        self.assertTrue(audit_proceeded)

    def test_08_reject_requires_reason_and_creates_no_approval(self):
        """Rejecting a requisition requires a reason, sets REJECTED, and creates no Approval record."""
        req = Requisition.objects.create(
            req_number='REQ-REJ-001',
            title='Luxury Furniture Order',
            department=self.admin_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            submitted_at=timezone.now(),
            estimated_budget=Decimal('900000.00')
        )

        self.client.force_authenticate(user=self.po_user)

        # 1. Missing reason
        res_no_reason = self.client.post(f'/api/procurement/requisitions/{req.id}/review/', {
            'action': 'REJECT',
            'reason': ''
        })
        self.assertEqual(res_no_reason.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('reason', res_no_reason.data)

        # 2. Valid reason
        res_valid = self.client.post(f'/api/procurement/requisitions/{req.id}/review/', {
            'action': 'REJECT',
            'reason': 'Budget allocation ceiling exceeded. Non-essential hospital luxury expenditure.'
        })
        self.assertEqual(res_valid.status_code, status.HTTP_200_OK)

        req.refresh_from_db()
        self.assertEqual(req.status, Requisition.StatusChoices.REJECTED)
        self.assertEqual(req.reviewed_by, self.po_user)
        self.assertIn('Budget allocation ceiling exceeded', req.review_comments)

        # Verify NO Approval record created
        self.assertEqual(Approval.objects.filter(requisition=req).count(), 0)

        # Verify AuditLog created
        audit_rejected = AuditLog.objects.filter(
            user=self.po_user,
            action='Purchase Officer Requisition Rejected'
        ).exists()
        self.assertTrue(audit_rejected)

    def test_09_purchase_officer_cannot_modify_requisition_items_directly(self):
        """Requisition details are read-only during PO review; PO cannot edit items via PUT/PATCH."""
        req = Requisition.objects.create(
            req_number='REQ-IMMUTABLE-001',
            title='Diagnostic Equipment Set',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            submitted_at=timezone.now(),
            estimated_budget=Decimal('100000.00')
        )

        self.client.force_authenticate(user=self.po_user)

        # PO attempts to patch title or budget
        res_patch = self.client.patch(f'/api/procurement/requisitions/{req.id}/', {
            'title': 'Tampered by PO',
            'estimated_budget': '50000.00'
        })
        self.assertEqual(res_patch.status_code, status.HTTP_403_FORBIDDEN)

        # PO attempts PUT
        res_put = self.client.put(f'/api/procurement/requisitions/{req.id}/', {
            'title': 'Tampered by PO',
            'department': self.surgery_dept.id,
            'items': []
        })
        self.assertEqual(res_put.status_code, status.HTTP_403_FORBIDDEN)

    def test_10_secure_document_endpoint_rbac(self):
        """Test secure supporting document access endpoint under RBAC."""
        pdf_content = b"%PDF-1.4 sample test pdf file content for procurement test"
        dummy_file = SimpleUploadedFile("spec_sheet.pdf", pdf_content, content_type="application/pdf")

        req = Requisition.objects.create(
            req_number='REQ-DOC-001',
            title='Requisition With PDF',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            supporting_document=dummy_file,
            status=Requisition.StatusChoices.SUBMITTED,
            submitted_at=timezone.now(),
            estimated_budget=Decimal('50000.00')
        )

        # 1. Unauthenticated -> 401
        self.client.logout()
        res_unauth = self.client.get(f'/api/procurement/requisitions/{req.id}/document/')
        self.assertEqual(res_unauth.status_code, status.HTTP_401_UNAUTHORIZED)

        # 2. Other department staff (not requester, non-privileged) -> 403
        self.client.force_authenticate(user=self.other_staff_user)
        res_forbidden = self.client.get(f'/api/procurement/requisitions/{req.id}/document/')
        self.assertEqual(res_forbidden.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Requesting staff -> 200 FileResponse
        self.client.force_authenticate(user=self.staff_user)
        res_requester = self.client.get(f'/api/procurement/requisitions/{req.id}/document/')
        self.assertEqual(res_requester.status_code, status.HTTP_200_OK)
        self.assertEqual(res_requester['Content-Type'], 'application/pdf')
        if hasattr(res_requester, 'file_to_stream') and res_requester.file_to_stream:
            res_requester.file_to_stream.close()

        # 4. Purchase Officer -> 200 FileResponse
        self.client.force_authenticate(user=self.po_user)
        res_po = self.client.get(f'/api/procurement/requisitions/{req.id}/document/')
        self.assertEqual(res_po.status_code, status.HTTP_200_OK)
        self.assertEqual(res_po['Content-Type'], 'application/pdf')
        if hasattr(res_po, 'file_to_stream') and res_po.file_to_stream:
            res_po.file_to_stream.close()

        # Clean up created file safely on Windows
        try:
            if req.supporting_document and req.supporting_document.storage.exists(req.supporting_document.name):
                req.supporting_document.storage.delete(req.supporting_document.name)
        except Exception:
            pass

    def test_11_cannot_review_non_submitted_requisition(self):
        """Attempting to review a DRAFT, APPROVED, or REJECTED requisition returns 400 Bad Request."""
        req_draft = Requisition.objects.create(
            req_number='REQ-DRAFT-REVIEW',
            title='Draft Requisition',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.DRAFT,
            estimated_budget=Decimal('10000.00')
        )

        self.client.force_authenticate(user=self.po_user)

        res = self.client.post(f'/api/procurement/requisitions/{req_draft.id}/review/', {
            'action': 'PROCEED',
            'requires_technical_evaluation': True
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Only submitted requisitions can be reviewed", res.data.get('detail', ''))

    def test_12_proceed_missing_technical_decision_returns_400(self):
        """Proceeding without selecting Yes or No for technical evaluation must return 400 Bad Request."""
        req = Requisition.objects.create(
            req_number='REQ-NO-DECISION-001',
            title='Clinical Supplies Order',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            submitted_at=timezone.now(),
            estimated_budget=Decimal('50000.00')
        )
        self.client.force_authenticate(user=self.po_user)

        # Missing requires_technical_evaluation
        res = self.client.post(f'/api/procurement/requisitions/{req.id}/review/', {
            'action': 'PROCEED',
            'reason': 'Proceeding without decision.'
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('requires_technical_evaluation', res.data)

    def test_13_multi_item_requisition_technical_advisory(self):
        """
        Multi-item requisition with Item 1: Portable Suction Apparatus and Item 2: Surgical Gloves.
        Advisory must recommend technical evaluation because at least one item requires it,
        identifying the triggering item and suggesting Medical & Surgical Equipment specialization.
        """
        req = Requisition.objects.create(
            req_number='REQ-MULTI-001',
            title='Emergency OT Suction and Glove Stock',
            category='Medical Equipment & Devices',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            submitted_at=timezone.now(),
            estimated_budget=Decimal('85000.00')
        )
        # Item 1: Specialized medical equipment
        item1 = RequisitionItem.objects.create(
            requisition=req,
            item_name='Portable Suction Apparatus',
            category='Medical Equipment & Devices',
            quantity=1,
            estimated_unit_price=Decimal('75000.00'),
            total_price=Decimal('75000.00'),
            specifications='High-vacuum surgical suction unit for operating theatre.'
        )
        # Item 2: Routine consumable
        item2 = RequisitionItem.objects.create(
            requisition=req,
            item_name='Surgical Gloves',
            category='Medical Consumables',
            quantity=100,
            estimated_unit_price=Decimal('100.00'),
            total_price=Decimal('10000.00'),
            specifications='Sterile powder-free latex gloves size 7.5.'
        )

        # Verify Item-level advisories
        advisory_item1 = item1.determine_technical_requirement_details()
        self.assertTrue(advisory_item1[0])  # is_technical
        self.assertEqual(advisory_item1[1], 'Medical & Surgical Equipment')

        advisory_item2 = item2.determine_technical_requirement_details()
        self.assertFalse(advisory_item2[0])  # is_technical is False for gloves
        self.assertIsNone(advisory_item2[1])

        # Verify Requisition-level advisory
        req_advisory = req.get_technical_evaluation_advisory()
        self.assertTrue(req_advisory['recommended'])
        self.assertIn('Portable Suction Apparatus', req_advisory['triggering_items'])
        self.assertNotIn('Surgical Gloves', req_advisory['triggering_items'])
        self.assertEqual(req_advisory['suggested_specialization'], 'Medical & Surgical Equipment')

        # Purchase Officer decides YES
        self.client.force_authenticate(user=self.po_user)
        res = self.client.post(f'/api/procurement/requisitions/{req.id}/review/', {
            'action': 'PROCEED',
            'requires_technical_evaluation': True,
            'technical_specialization': 'Medical & Surgical Equipment',
            'reason': 'Technical evaluation confirmed for Suction Apparatus.'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        req.refresh_from_db()
        self.assertEqual(req.status, Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION)
        self.assertTrue(req.requires_technical_evaluation)
        self.assertEqual(req.technical_specialization, 'Medical & Surgical Equipment')

    def test_14_purchase_officer_can_override_system_advisory_both_ways(self):
        """
        The system recommendation must NOT automatically determine the final routing.
        PO can decide NO even if advisory says YES, or decide YES even if advisory says NO.
        """
        self.client.force_authenticate(user=self.po_user)

        # 14a: Item is equipment (advisory YES), but PO decides NO (e.g., standard pre-approved model)
        req_eq = Requisition.objects.create(
            req_number='REQ-OVERRIDE-NO',
            title='ECG Machine Standard Replacement',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            submitted_at=timezone.now(),
            estimated_budget=Decimal('120000.00')
        )
        RequisitionItem.objects.create(
            requisition=req_eq,
            item_name='12-Channel ECG Machine',
            category='Medical Equipment & Devices',
            quantity=1,
            estimated_unit_price=Decimal('120000.00'),
            total_price=Decimal('120000.00')
        )
        self.assertTrue(req_eq.get_technical_evaluation_advisory()['recommended'])

        res_override_no = self.client.post(f'/api/procurement/requisitions/{req_eq.id}/review/', {
            'action': 'PROCEED',
            'requires_technical_evaluation': False,
            'reason': 'Standard hospital rate contract equipment; technical officer evaluation bypassed.'
        })
        self.assertEqual(res_override_no.status_code, status.HTTP_200_OK)
        req_eq.refresh_from_db()
        self.assertEqual(req_eq.status, Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW)
        self.assertFalse(req_eq.requires_technical_evaluation)
        self.assertIsNone(req_eq.technical_specialization)

        # 14b: Item is routine supplies (advisory NO), but PO decides YES (e.g., special installation)
        req_routine = Requisition.objects.create(
            req_number='REQ-OVERRIDE-YES',
            title='Specialized Laboratory Reagents and Test Kits',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            submitted_at=timezone.now(),
            estimated_budget=Decimal('45000.00')
        )
        RequisitionItem.objects.create(
            requisition=req_routine,
            item_name='Routine Examination Plastic Containers',
            category='Medical Consumables',
            quantity=500,
            estimated_unit_price=Decimal('90.00'),
            total_price=Decimal('45000.00')
        )
        self.assertFalse(req_routine.get_technical_evaluation_advisory()['recommended'])

        res_override_yes = self.client.post(f'/api/procurement/requisitions/{req_routine.id}/review/', {
            'action': 'PROCEED',
            'requires_technical_evaluation': True,
            'technical_specialization': 'Laboratory & Diagnostic Equipment',
            'reason': 'Cold-chain and diagnostic compatibility requires Laboratory Officer review.'
        })
        self.assertEqual(res_override_yes.status_code, status.HTTP_200_OK)
        req_routine.refresh_from_db()
        self.assertEqual(req_routine.status, Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION)
        self.assertTrue(req_routine.requires_technical_evaluation)
        self.assertEqual(req_routine.technical_specialization, 'Laboratory & Diagnostic Equipment')

    def test_15_return_and_resubmission_workflow_and_re_review(self):
        """
        PO returns requisition for correction. Staff edits and resubmits.
        PO must review again and make the technical evaluation decision again.
        """
        req = Requisition.objects.create(
            req_number='REQ-RESUBMIT-001',
            title='Laparoscopy Instruments',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            submitted_at=timezone.now(),
            estimated_budget=Decimal('200000.00')
        )
        RequisitionItem.objects.create(
            requisition=req,
            item_name='Laparoscopic Forceps Set',
            category='Medical Equipment & Devices',
            quantity=2,
            estimated_unit_price=Decimal('100000.00'),
            total_price=Decimal('200000.00')
        )

        # 1. Purchase Officer returns for correction
        self.client.force_authenticate(user=self.po_user)
        res_ret = self.client.post(f'/api/procurement/requisitions/{req.id}/review/', {
            'action': 'RETURN',
            'reason': 'Please specify exact diameter and compatibility with existing tower.'
        })
        self.assertEqual(res_ret.status_code, status.HTTP_200_OK)
        req.refresh_from_db()
        self.assertEqual(req.status, Requisition.StatusChoices.RETURNED)
        self.assertEqual(Approval.objects.filter(requisition=req).count(), 0)

        # 2. Staff updates specifications and resubmits
        self.client.force_authenticate(user=self.staff_user)
        res_sub = self.client.post(f'/api/procurement/requisitions/{req.id}/submit/')
        self.assertEqual(res_sub.status_code, status.HTTP_200_OK)
        req.refresh_from_db()
        self.assertEqual(req.status, Requisition.StatusChoices.SUBMITTED)
        self.assertFalse(req.requires_technical_evaluation)  # Reset for fresh PO decision

        # 3. PO reviews the resubmitted requisition and decides
        self.client.force_authenticate(user=self.po_user)
        res_proc = self.client.post(f'/api/procurement/requisitions/{req.id}/review/', {
            'action': 'PROCEED',
            'requires_technical_evaluation': True,
            'technical_specialization': 'Medical & Surgical Equipment',
            'reason': 'Specifications updated and verified.'
        })
        self.assertEqual(res_proc.status_code, status.HTTP_200_OK)
        req.refresh_from_db()
        self.assertEqual(req.status, Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION)
        self.assertTrue(req.requires_technical_evaluation)

    def test_16_rejected_requisition_cannot_be_edited_or_resubmitted(self):
        """Staff cannot edit or resubmit a REJECTED requisition."""
        req = Requisition.objects.create(
            req_number='REQ-PERM-REJ',
            title='Disallowed Request',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            submitted_at=timezone.now(),
            estimated_budget=Decimal('50000.00')
        )
        self.client.force_authenticate(user=self.po_user)
        res_rej = self.client.post(f'/api/procurement/requisitions/{req.id}/review/', {
            'action': 'REJECT',
            'reason': 'Item permanently disallowed by hospital board.'
        })
        self.assertEqual(res_rej.status_code, status.HTTP_200_OK)
        req.refresh_from_db()
        self.assertEqual(req.status, Requisition.StatusChoices.REJECTED)

        # Staff attempts to submit -> 400 Bad Request
        self.client.force_authenticate(user=self.staff_user)
        res_sub = self.client.post(f'/api/procurement/requisitions/{req.id}/submit/')
        self.assertEqual(res_sub.status_code, status.HTTP_400_BAD_REQUEST)

        # Staff attempts to edit -> 400 Bad Request
        res_edit = self.client.patch(f'/api/procurement/requisitions/{req.id}/', {
            'title': 'Attempted update on rejected'
        })
        self.assertEqual(res_edit.status_code, status.HTTP_400_BAD_REQUEST)

    def test_17_department_staff_cannot_bypass_po_review_directly(self):
        """Department Staff cannot create or edit a requisition directly into PENDING_TECHNICAL_EVALUATION or PENDING_COMMITTEE_REVIEW."""
        self.client.force_authenticate(user=self.staff_user)

        res = self.client.post('/api/procurement/requisitions/', {
            'title': 'Bypass Attempt Requisition',
            'category': 'Medical Equipment & Devices',
            'status': 'PENDING_TECHNICAL_EVALUATION',
            'items': [{
                'item_name': 'Direct Route Item',
                'category': 'Medical Equipment & Devices',
                'quantity': 1,
                'estimated_unit_price': '50000.00'
            }]
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('status', res.data)

    def test_18_workflow_visibility_in_committee_and_technical_dashboards(self):
        """
        Verify that a requisition proceeded with YES appears in Technical Officer dashboard,
        and a requisition proceeded with NO appears in Procurement Committee dashboard.
        """
        # 1. Proceed with NO -> PENDING_COMMITTEE_REVIEW
        req_comm = Requisition.objects.create(
            req_number='REQ-COMM-DASH-1',
            title='Surgical Cotton & Swabs',
            category='Medical Consumables',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            submitted_at=timezone.now(),
            estimated_budget=Decimal('25000.00')
        )
        self.client.force_authenticate(user=self.po_user)
        res_po_comm = self.client.post(f'/api/procurement/requisitions/{req_comm.id}/review/', {
            'action': 'PROCEED',
            'requires_technical_evaluation': False,
            'reason': 'Proceed to committee.'
        })
        self.assertEqual(res_po_comm.status_code, status.HTTP_200_OK)

        # Check Procurement Committee dashboard
        self.client.force_authenticate(user=self.committee_user)
        res_comm_dash = self.client.get('/api/procurement/committee-dashboard/')
        self.assertEqual(res_comm_dash.status_code, status.HTTP_200_OK)
        pending_refs = [item['req_number'] for item in res_comm_dash.data.get('pending_reviews', [])]
        self.assertIn('REQ-COMM-DASH-1', pending_refs)

        # 2. Proceed with YES -> PENDING_TECHNICAL_EVALUATION
        req_tech = Requisition.objects.create(
            req_number='REQ-TECH-DASH-1',
            title='High Precision Infusion Pump',
            category='Biomedical Equipment',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            submitted_at=timezone.now(),
            estimated_budget=Decimal('95000.00')
        )
        self.client.force_authenticate(user=self.po_user)
        res_po_tech = self.client.post(f'/api/procurement/requisitions/{req_tech.id}/review/', {
            'action': 'PROCEED',
            'requires_technical_evaluation': True,
            'technical_specialization': 'Biomedical Equipment',
            'reason': 'Proceed to technical officer.'
        })
        self.assertEqual(res_po_tech.status_code, status.HTTP_200_OK)

        # Check Technical Officer dashboard
        self.client.force_authenticate(user=self.tech_user)
        res_tech_dash = self.client.get('/api/procurement/technical-officer-dashboard/')
        self.assertEqual(res_tech_dash.status_code, status.HTTP_200_OK)
        tech_refs = [item['procurement_ref'] for item in res_tech_dash.data.get('assigned_evaluations', [])]
        self.assertIn('REQ-TECH-DASH-1', tech_refs)
