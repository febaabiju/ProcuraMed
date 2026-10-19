from decimal import Decimal
from datetime import timedelta
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import Department, Role, AuditLog
from procurement.models import (
    Requisition, RequisitionItem,
    determine_specialization_from_category,
    CATEGORY_TO_SPECIALIZATION,
    NON_TECHNICAL_CATEGORIES
)

User = get_user_model()


class TechnicalOfficerAssignmentLogicTests(TestCase):
    """
    Test suite verifying the Technical Officer assignment logic:
    Purchase Item Category -> Technical Specialization -> Eligible Technical Officers -> Workload-based assignment.
    """

    @classmethod
    def setUpTestData(cls):
        # 1. Roles
        cls.to_role, _ = Role.objects.get_or_create(
            name='Technical Officer',
            defaults={'description': 'Technical Officer Role'}
        )
        cls.po_role, _ = Role.objects.get_or_create(
            name='Purchase Officer',
            defaults={'description': 'Purchase Officer Role'}
        )
        cls.staff_role, _ = Role.objects.get_or_create(
            name='Department Staff',
            defaults={'description': 'Department Staff Role'}
        )

        # 2. Departments
        cls.biomed_dept, _ = Department.objects.get_or_create(
            name='Biomedical Engineering',
            defaults={'code': 'BME', 'is_active': True}
        )
        cls.clinical_dept, _ = Department.objects.get_or_create(
            name='Medical & Clinical Services',
            defaults={'code': 'MCS', 'is_active': True}
        )
        cls.admin_dept, _ = Department.objects.get_or_create(
            name='Administration & General Supplies',
            defaults={'code': 'AGS', 'is_active': True}
        )

        # 3. Staff & PO Users
        cls.staff_user = User.objects.create_user(
            username='test_staff_tech_flow',
            email='staff_flow@procuramed.test',
            password='TestPassword123!',
            first_name='Clinical',
            last_name='Staff',
            role=cls.staff_role,
            department=cls.clinical_dept
        )
        cls.po_user = User.objects.create_user(
            username='test_po_tech_flow',
            email='po_flow@procuramed.test',
            password='TestPassword123!',
            first_name='Purchase',
            last_name='Officer',
            role=cls.po_role,
            department=cls.admin_dept
        )

        # 4. Technical Officers matching the 6 Technical Specializations
        # TO 1: Medical, Surgical & Critical Care Equipment
        cls.to_surgical = User.objects.create_user(
            username='to_surgical_active',
            email='to_surgical@procuramed.test',
            password='TestPassword123!',
            first_name='Robert',
            last_name='Vincent',
            employee_id='TO-TEST-01',
            role=cls.to_role,
            department=cls.biomed_dept,
            is_active=True,
            technical_specializations=['Medical, Surgical & Critical Care Equipment']
        )
        # TO 2: Biomedical Equipment
        cls.to_biomed = User.objects.create_user(
            username='to_biomed_active',
            email='to_biomed@procuramed.test',
            password='TestPassword123!',
            first_name='Nayana',
            last_name='Binu',
            employee_id='TO-TEST-02',
            role=cls.to_role,
            department=cls.biomed_dept,
            is_active=True,
            technical_specializations=['Biomedical Equipment']
        )
        # TO 3: Radiology & Medical Imaging
        cls.to_radiology = User.objects.create_user(
            username='to_radiology_active',
            email='to_radiology@procuramed.test',
            password='TestPassword123!',
            first_name='Varun',
            last_name='Sharma',
            employee_id='TO-TEST-03',
            role=cls.to_role,
            department=cls.biomed_dept,
            is_active=True,
            technical_specializations=['Radiology & Medical Imaging']
        )
        # TO 4: IT & Healthcare Technology
        cls.to_it = User.objects.create_user(
            username='to_it_active',
            email='to_it@procuramed.test',
            password='TestPassword123!',
            first_name='Mohammed',
            last_name='Irfan',
            employee_id='TO-TEST-04',
            role=cls.to_role,
            department=cls.biomed_dept,
            is_active=True,
            technical_specializations=['IT & Healthcare Technology']
        )
        # TO 5: Facilities & General Engineering
        cls.to_facilities = User.objects.create_user(
            username='to_facilities_active',
            email='to_facilities@procuramed.test',
            password='TestPassword123!',
            first_name='Ishaani',
            last_name='Krishna',
            employee_id='TO-TEST-05',
            role=cls.to_role,
            department=cls.biomed_dept,
            is_active=True,
            technical_specializations=['Facilities & General Engineering']
        )
        # TO 6: Laboratory & Diagnostic Equipment
        cls.to_lab = User.objects.create_user(
            username='to_lab_active',
            email='to_lab@procuramed.test',
            password='TestPassword123!',
            first_name='Lab',
            last_name='Expert',
            employee_id='TO-TEST-06',
            role=cls.to_role,
            department=cls.biomed_dept,
            is_active=True,
            technical_specializations=['Laboratory & Diagnostic Equipment']
        )

        # TO 7: Second Biomedical Officer for workload-balancing tests
        cls.to_biomed_2 = User.objects.create_user(
            username='to_biomed_second',
            email='to_biomed_2@procuramed.test',
            password='TestPassword123!',
            first_name='Biomed',
            last_name='Junior',
            employee_id='TO-TEST-07',
            role=cls.to_role,
            department=cls.biomed_dept,
            is_active=True,
            technical_specializations=['Biomedical Equipment']
        )

        # Inactive Technical Officer (should NEVER be assigned)
        cls.to_inactive = User.objects.create_user(
            username='to_inactive_biomed',
            email='to_inactive@procuramed.test',
            password='TestPassword123!',
            first_name='Inactive',
            last_name='Officer',
            employee_id='TO-TEST-INACTIVE',
            role=cls.to_role,
            department=cls.biomed_dept,
            is_active=False,
            technical_specializations=['Biomedical Equipment']
        )

    def setUp(self):
        self.client = APIClient()

    def test_01_category_to_specialization_mapping_for_all_6_domains(self):
        """Verify purchase categories map accurately to the 6 Technical Specializations."""
        mappings = {
            'Biomedical Equipment': 'Biomedical Equipment',
            'Medical Equipment & Devices': 'Medical, Surgical & Critical Care Equipment',
            'Surgical Instruments': 'Medical, Surgical & Critical Care Equipment',
            'ICU & Critical Care Equipment': 'Medical, Surgical & Critical Care Equipment',
            'Laboratory Equipment & Supplies': 'Laboratory & Diagnostic Equipment',
            'Diagnostic Equipment': 'Laboratory & Diagnostic Equipment',
            'Radiology & Imaging Equipment': 'Radiology & Medical Imaging',
            'IT Hardware & Software': 'IT & Healthcare Technology',
            'Maintenance & Technical Services': 'Facilities & General Engineering',
        }
        for cat, expected_spec in mappings.items():
            result = determine_specialization_from_category(cat)
            self.assertEqual(
                result, expected_spec,
                f"Category '{cat}' should map to '{expected_spec}', got '{result}'."
            )

    def test_02_non_technical_categories_do_not_require_evaluation(self):
        """Verify non-technical routine categories return None from category mapping."""
        non_tech_cats = [
            'Medical Consumables',
            'General Hospital Supplies',
            'Cleaning & Housekeeping Supplies',
            'Hospital Furniture & Fixtures',
            'Other',
        ]
        for cat in non_tech_cats:
            result = determine_specialization_from_category(cat)
            self.assertIsNone(
                result,
                f"Non-technical category '{cat}' should map to None, got '{result}'."
            )

    def test_03_assign_technical_officer_matches_required_specialization(self):
        """Requisition item with Biomedical Equipment category assigns to eligible Biomedical TO."""
        req = Requisition.objects.create(
            req_number='REQ-TECH-001',
            title='Dialysis Station Unit',
            category='Biomedical Equipment',
            department=self.clinical_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            estimated_budget=Decimal('500000.00')
        )
        RequisitionItem.objects.create(
            requisition=req,
            item_name='Hemodialysis Machine',
            category='Biomedical Equipment',
            quantity=1,
            estimated_unit_price=Decimal('500000.00'),
            total_price=Decimal('500000.00')
        )

        assigned_to = req.assign_technical_officer(save=True)
        self.assertIsNotNone(assigned_to)
        self.assertIn(assigned_to, [self.to_biomed, self.to_biomed_2])
        self.assertIn('Biomedical Equipment', assigned_to.technical_specializations)
        self.assertEqual(req.assigned_technical_officer, assigned_to)
        self.assertIsNotNone(req.technical_assigned_at)
        self.assertEqual(req.technical_specialization, 'Biomedical Equipment')

    def test_04_assign_technical_officer_assigns_to_one_eligible_officer_only(self):
        """Ensure assignment selects exactly ONE Technical Officer."""
        req = Requisition.objects.create(
            req_number='REQ-TECH-002',
            title='MRI Scanner System',
            category='Radiology & Imaging Equipment',
            department=self.clinical_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            estimated_budget=Decimal('15000000.00')
        )
        RequisitionItem.objects.create(
            requisition=req,
            item_name='1.5T MRI Scanner',
            category='Radiology & Imaging Equipment',
            quantity=1,
            estimated_unit_price=Decimal('15000000.00'),
            total_price=Decimal('15000000.00')
        )

        assigned_to = req.assign_technical_officer(save=True)
        self.assertEqual(assigned_to, self.to_radiology)
        self.assertEqual(req.assigned_technical_officer, self.to_radiology)

    def test_05_inactive_technical_officers_are_excluded(self):
        """Inactive Technical Officers are never eligible for assignment."""
        # Deactivate all active Biomedical TOs except the inactive one
        self.to_biomed.is_active = False
        self.to_biomed.save()
        self.to_biomed_2.is_active = False
        self.to_biomed_2.save()

        try:
            req = Requisition.objects.create(
                req_number='REQ-TECH-003',
                title='Autoclave Unit',
                category='Biomedical Equipment',
                department=self.clinical_dept,
                requested_by=self.staff_user,
                status=Requisition.StatusChoices.SUBMITTED,
                estimated_budget=Decimal('200000.00')
            )
            assigned_to = req.assign_technical_officer(save=True)
            self.assertIsNone(assigned_to, "Inactive TO should not be assigned.")
            self.assertIsNone(req.assigned_technical_officer)
        finally:
            self.to_biomed.is_active = True
            self.to_biomed.save()
            self.to_biomed_2.is_active = True
            self.to_biomed_2.save()

    def test_06_non_technical_category_does_not_assign_technical_officer(self):
        """Requisition with non-technical category (e.g. Medical Consumables) assigns NO TO."""
        req = Requisition.objects.create(
            req_number='REQ-TECH-004',
            title='Sterile Surgical Gauze and Bandages',
            category='Medical Consumables',
            department=self.clinical_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            estimated_budget=Decimal('25000.00')
        )
        RequisitionItem.objects.create(
            requisition=req,
            item_name='Sterile Gauze 10x10',
            category='Medical Consumables',
            quantity=500,
            estimated_unit_price=Decimal('50.00'),
            total_price=Decimal('25000.00')
        )

        assigned_to = req.assign_technical_officer(save=True)
        self.assertIsNone(assigned_to)
        self.assertIsNone(req.assigned_technical_officer)
        self.assertIsNone(req.technical_assigned_at)

    def test_07_no_eligible_officer_leaves_request_unassigned(self):
        """If no Technical Officer exists for a specialization, do NOT assign unrelated officer."""
        req = Requisition.objects.create(
            req_number='REQ-TECH-005',
            title='Nuclear Imaging Specimen Scanner',
            category='Unmatched Specialized Technology',
            department=self.clinical_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            estimated_budget=Decimal('500000.00')
        )
        # Directly pass a specialization with no active officers
        assigned_to = req.assign_technical_officer(specialization='Nonexistent Nuclear Specialization', save=True)
        self.assertIsNone(assigned_to)
        self.assertIsNone(req.assigned_technical_officer)
        self.assertIsNone(req.technical_assigned_at)

    def test_08_workload_balancing_selects_lowest_workload_officer(self):
        """When multiple TOs share a specialization, officer with lowest active workload is assigned."""
        now = timezone.now()

        # Give to_biomed 2 active ongoing requisitions
        Requisition.objects.create(
            req_number='REQ-WORKLOAD-01',
            title='Active Req 1',
            category='Biomedical Equipment',
            department=self.clinical_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION,
            assigned_technical_officer=self.to_biomed,
            technical_assigned_at=now - timedelta(hours=3)
        )
        Requisition.objects.create(
            req_number='REQ-WORKLOAD-02',
            title='Active Req 2',
            category='Biomedical Equipment',
            department=self.clinical_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.PENDING_APPROVAL,
            assigned_technical_officer=self.to_biomed,
            technical_assigned_at=now - timedelta(hours=2)
        )

        # Give to_biomed_2 0 active ongoing requisitions (workload = 0)
        req_new = Requisition.objects.create(
            req_number='REQ-TECH-WORKLOAD-TEST',
            title='Infusion Pump Replacement',
            category='Biomedical Equipment',
            department=self.clinical_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            estimated_budget=Decimal('75000.00')
        )
        RequisitionItem.objects.create(
            requisition=req_new,
            item_name='Volumetric Infusion Pump',
            category='Biomedical Equipment',
            quantity=2,
            estimated_unit_price=Decimal('37500.00'),
            total_price=Decimal('75000.00')
        )

        assigned_to = req_new.assign_technical_officer(save=True)
        self.assertEqual(
            assigned_to, self.to_biomed_2,
            f"Expected to_biomed_2 (workload 0) to be selected over to_biomed (workload 2), got {assigned_to}."
        )

    def test_09_terminal_statuses_do_not_count_towards_workload(self):
        """Completed, rejected, cancelled, and draft requisitions do NOT count toward active workload."""
        now = timezone.now()

        # to_biomed has 3 terminal requisitions (workload should be 0)
        Requisition.objects.create(
            req_number='REQ-TERM-01',
            title='Completed Req',
            category='Biomedical Equipment',
            department=self.clinical_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.COMPLETED,
            assigned_technical_officer=self.to_biomed,
            technical_assigned_at=now - timedelta(days=5)
        )
        Requisition.objects.create(
            req_number='REQ-TERM-02',
            title='Rejected Req',
            category='Biomedical Equipment',
            department=self.clinical_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.REJECTED,
            assigned_technical_officer=self.to_biomed,
            technical_assigned_at=now - timedelta(days=3)
        )
        Requisition.objects.create(
            req_number='REQ-TERM-03',
            title='Cancelled Req',
            category='Biomedical Equipment',
            department=self.clinical_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.CANCELLED,
            assigned_technical_officer=self.to_biomed,
            technical_assigned_at=now - timedelta(days=2)
        )

        # to_biomed_2 has 1 active ongoing requisition (workload = 1)
        Requisition.objects.create(
            req_number='REQ-ACTIVE-01',
            title='Ongoing RFQ Req',
            category='Biomedical Equipment',
            department=self.clinical_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.RFQ_ISSUED,
            assigned_technical_officer=self.to_biomed_2,
            technical_assigned_at=now - timedelta(hours=1)
        )

        # New requisition should go to to_biomed (workload 0 < workload 1)
        req_new = Requisition.objects.create(
            req_number='REQ-TERMINAL-CHECK',
            title='Defibrillator Unit',
            category='Biomedical Equipment',
            department=self.clinical_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            estimated_budget=Decimal('180000.00')
        )
        assigned_to = req_new.assign_technical_officer(save=True)
        self.assertEqual(
            assigned_to, self.to_biomed,
            f"Expected to_biomed (active workload 0) over to_biomed_2 (active workload 1), got {assigned_to}."
        )

    def test_10_tie_breaking_least_recently_assigned(self):
        """When workloads are equal, the least recently assigned officer is selected."""
        now = timezone.now()

        # Both have 1 active requisition, but to_biomed was assigned 5 hours ago, to_biomed_2 was assigned 1 hour ago
        Requisition.objects.create(
            req_number='REQ-TIE-01',
            title='Active Biomed 1',
            category='Biomedical Equipment',
            department=self.clinical_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION,
            assigned_technical_officer=self.to_biomed,
            technical_assigned_at=now - timedelta(hours=5)
        )
        Requisition.objects.create(
            req_number='REQ-TIE-02',
            title='Active Biomed 2',
            category='Biomedical Equipment',
            department=self.clinical_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION,
            assigned_technical_officer=self.to_biomed_2,
            technical_assigned_at=now - timedelta(hours=1)
        )

        req_new = Requisition.objects.create(
            req_number='REQ-TIE-TEST',
            title='Syringe Pump',
            category='Biomedical Equipment',
            department=self.clinical_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            estimated_budget=Decimal('45000.00')
        )
        assigned_to = req_new.assign_technical_officer(save=True)
        self.assertEqual(
            assigned_to, self.to_biomed,
            f"Expected to_biomed (assigned 5h ago) over to_biomed_2 (assigned 1h ago), got {assigned_to}."
        )

    def test_11_po_review_proceed_assigns_technical_officer_via_pipeline(self):
        """
        Full workflow integration:
        PO reviews request requiring Technical Evaluation.
        Pipeline: Purchase Item Category -> Technical Specialization -> Eligible Technical Officers -> Workload-based assignment.
        """
        self.client.force_authenticate(user=self.po_user)

        req = Requisition.objects.create(
            req_number='REQ-PO-REVIEW-TECH',
            title='Surgical Microscope Unit',
            category='Medical Equipment & Devices',
            department=self.clinical_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            submitted_at=timezone.now(),
            estimated_budget=Decimal('1200000.00')
        )
        RequisitionItem.objects.create(
            requisition=req,
            item_name='Opthalmic Operating Microscope',
            category='Medical Equipment & Devices',
            quantity=1,
            estimated_unit_price=Decimal('1200000.00'),
            total_price=Decimal('1200000.00')
        )

        res = self.client.post(f'/api/procurement/requisitions/{req.id}/review/', {
            'action': 'PROCEED',
            'requires_technical_evaluation': True,
            'reason': 'Technical evaluation required for surgical operating microscope optics.'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        req.refresh_from_db()
        self.assertEqual(req.status, Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION)
        self.assertTrue(req.requires_technical_evaluation)
        self.assertEqual(req.technical_specialization, 'Medical, Surgical & Critical Care Equipment')
        self.assertEqual(req.assigned_technical_officer, self.to_surgical)
        self.assertIsNotNone(req.technical_assigned_at)

        # Verify AuditLog description mentions the assigned Technical Officer
        log = AuditLog.objects.filter(
            action='Purchase Officer proceeded requisition for Technical Officer Evaluation',
            module='Purchase Requisition'
        ).first()
        self.assertIsNotNone(log)
        self.assertIn(f"@{self.to_surgical.username}", log.description)

    def test_12_po_review_non_technical_category_leaves_unassigned(self):
        """
        When PO marks technical evaluation on a non-technical category,
        Requirement 7 specifies: do not assign a Technical Officer.
        """
        self.client.force_authenticate(user=self.po_user)

        req = Requisition.objects.create(
            req_number='REQ-PO-REVIEW-NONTECH',
            title='Standard Office Paper & Pens',
            category='General Hospital Supplies',
            department=self.admin_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            submitted_at=timezone.now(),
            estimated_budget=Decimal('5000.00')
        )
        RequisitionItem.objects.create(
            requisition=req,
            item_name='A4 Copier Paper',
            category='General Hospital Supplies',
            quantity=50,
            estimated_unit_price=Decimal('100.00'),
            total_price=Decimal('5000.00')
        )

        res = self.client.post(f'/api/procurement/requisitions/{req.id}/review/', {
            'action': 'PROCEED',
            'requires_technical_evaluation': True,
            'reason': 'PO checked technical evaluation, but category is routine general supplies.'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        req.refresh_from_db()
        self.assertIsNone(
            req.assigned_technical_officer,
            "Non-technical category should NOT have an assigned Technical Officer."
        )
        self.assertIsNone(req.technical_assigned_at)
