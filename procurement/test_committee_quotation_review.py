from decimal import Decimal
from datetime import timedelta
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import Role, Department
from procurement.models import (
    Requisition, RequisitionItem, QuotationRequest, RFQItem, RFQVendorInvitation,
    Quotation, QuotationItem, Approval
)
from vendors.models import Vendor, SupplierCategory

User = get_user_model()


class ProcurementCommitteeQuotationReviewTests(TestCase):
    def make_valid_pdf(self, name="signed_quote.pdf"):
        content = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer\n<< /Size 2 /Root 1 0 R >>\nstartxref\n50\n%%EOF"
        return SimpleUploadedFile(name, content, content_type="application/pdf")

    def setUp(self):
        self.client = APIClient()

        # Roles
        self.committee_role, _ = Role.objects.get_or_create(
            name='Procurement Committee Member',
            defaults={'description': 'Committee Member'}
        )
        self.vendor_role, _ = Role.objects.get_or_create(
            name='Vendor',
            defaults={'description': 'Approved Supplier Vendor Account'}
        )
        self.dept_role, _ = Role.objects.get_or_create(
            name='Department Staff',
            defaults={'description': 'Staff Member'}
        )

        # Department
        self.dept, _ = Department.objects.get_or_create(
            name='Critical Care',
            defaults={'code': 'CCU'}
        )

        # Category
        self.category, _ = SupplierCategory.objects.get_or_create(
            name='Medical Equipment & Devices',
            defaults={'description': 'Medical Equipment'}
        )

        # Committee Members
        self.committee_member_1 = User.objects.create_user(
            username='committee_lead_1',
            email='member1@procuramed.com',
            password='Password123!',
            role=self.committee_role,
            employee_id='PC001'
        )

        self.committee_member_2 = User.objects.create_user(
            username='committee_lead_2',
            email='member2@procuramed.com',
            password='Password123!',
            role=self.committee_role,
            employee_id='PC002'
        )

        # Vendors
        self.vendor_user_a = User.objects.create_user(
            username='vendor_a',
            email='sales@vendora.com',
            password='Password123!',
            role=self.vendor_role
        )
        self.vendor_a = Vendor.objects.create(
            user=self.vendor_user_a,
            company_name='Apex Medical Supplies Ltd',
            vendor_code='VEND-APEX',
            contact_person='John Apex',
            email='sales@vendora.com',
            phone='1234567890',
            status='ACTIVE',
            performance_rating=Decimal('4.8')
        )
        self.vendor_a.supplier_categories.add(self.category)

        self.vendor_user_b = User.objects.create_user(
            username='vendor_b',
            email='sales@vendorb.com',
            password='Password123!',
            role=self.vendor_role
        )
        self.vendor_b = Vendor.objects.create(
            user=self.vendor_user_b,
            company_name='BioHealth Innovations Inc',
            vendor_code='VEND-BIO',
            contact_person='Sarah Bio',
            email='sales@vendorb.com',
            phone='1234567891',
            status='ACTIVE',
            performance_rating=Decimal('4.5')
        )
        self.vendor_b.supplier_categories.add(self.category)

        self.vendor_user_c = User.objects.create_user(
            username='vendor_c',
            email='sales@vendorc.com',
            password='Password123!',
            role=self.vendor_role
        )
        self.vendor_c = Vendor.objects.create(
            user=self.vendor_user_c,
            company_name='Crestline Diagnostics',
            vendor_code='VEND-CREST',
            contact_person='David Crest',
            email='sales@vendorc.com',
            phone='1234567892',
            status='ACTIVE',
            performance_rating=Decimal('4.2')
        )
        self.vendor_c.supplier_categories.add(self.category)

        # Staff User
        self.staff_user = User.objects.create_user(
            username='ccu_nurse',
            email='ccu_nurse@procuramed.com',
            password='Password123!',
            role=self.dept_role,
            employee_id='STF001',
            department=self.dept
        )

        # Requisition 1 assigned to Committee Member 1
        self.req_1 = Requisition.objects.create(
            req_number='REQ-2026-CCU-001',
            requested_by=self.staff_user,
            department=self.dept,
            title='ICU Ventilators Procurement',
            priority='HIGH',
            estimated_budget=Decimal('500000.00'),
            category='Medical Equipment',
            assigned_committee_member=self.committee_member_1,
            status='SUBMITTED'
        )
        self.req_item_1 = RequisitionItem.objects.create(
            requisition=self.req_1,
            item_name='High-flow ICU Ventilator',
            quantity=2,
            estimated_unit_price=Decimal('250000.00'),
            total_price=Decimal('500000.00'),
            specifications='ISO 80601-2-12 compliant, touch screen interface'
        )

        # RFQ 1 for Requisition 1
        self.rfq_1 = QuotationRequest.objects.create(
            rfq_number='RFQ-2026-CCU-001',
            requisition=self.req_1,
            created_by=self.committee_member_1,
            title='RFQ: ICU Ventilators',
            due_date=timezone.now() + timedelta(days=14),
            status='PUBLISHED'
        )

        # Quotations for RFQ 1
        self.quote_1a = Quotation.objects.create(
            quotation_number='QT-2026-APEX-001',
            quotation_request=self.rfq_1,
            vendor=self.vendor_a,
            tax_percentage=Decimal('5.00'),
            tax_amount=Decimal('21000.00'),
            shipping_charges=Decimal('4000.00'),
            total_amount=Decimal('445000.00'),
            lead_time_days=10,
            valid_until=(timezone.now() + timedelta(days=30)).date(),
            remarks='Includes 2 years on-site warranty and calibration.',
            status='SUBMITTED',
            quotation_document=self.make_valid_pdf('apex_quotation.pdf')
        )
        QuotationItem.objects.create(
            quotation=self.quote_1a,
            item_name='High-flow ICU Ventilator Apex-V1',
            quantity=2,
            unit_price=Decimal('210000.00'),
            total_price=Decimal('420000.00')
        )

        self.quote_1b = Quotation.objects.create(
            quotation_number='QT-2026-BIO-001',
            quotation_request=self.rfq_1,
            vendor=self.vendor_b,
            tax_percentage=Decimal('5.00'),
            tax_amount=Decimal('20000.00'),
            shipping_charges=Decimal('5000.00'),
            total_amount=Decimal('425000.00'),
            lead_time_days=15,
            valid_until=(timezone.now() + timedelta(days=30)).date(),
            remarks='Lowest compliant price quotation.',
            status='SUBMITTED',
            quotation_document=self.make_valid_pdf('bio_quotation.pdf')
        )

        # Requisition 2 assigned to Committee Member 2
        self.req_2 = Requisition.objects.create(
            req_number='REQ-2026-CCU-002',
            requested_by=self.staff_user,
            department=self.dept,
            title='Patient Monitors',
            priority='MEDIUM',
            estimated_budget=Decimal('150000.00'),
            category='Medical Equipment',
            assigned_committee_member=self.committee_member_2,
            status='SUBMITTED'
        )
        self.rfq_2 = QuotationRequest.objects.create(
            rfq_number='RFQ-2026-CCU-002',
            requisition=self.req_2,
            created_by=self.committee_member_2,
            title='RFQ: Patient Monitors',
            due_date=timezone.now() + timedelta(days=14),
            status='PUBLISHED'
        )
        self.quote_2c = Quotation.objects.create(
            quotation_number='QT-2026-CREST-001',
            quotation_request=self.rfq_2,
            vendor=self.vendor_c,
            tax_percentage=Decimal('5.00'),
            tax_amount=Decimal('6000.00'),
            shipping_charges=Decimal('2000.00'),
            total_amount=Decimal('128000.00'),
            lead_time_days=7,
            valid_until=(timezone.now() + timedelta(days=30)).date(),
            remarks='Fast delivery with standard accessories.',
            status='SUBMITTED'
        )

    def test_committee_member_can_only_see_assigned_quotations(self):
        """Committee members must only see quotations associated with purchase requests assigned to them."""
        # Member 1
        self.client.force_authenticate(user=self.committee_member_1)
        res1 = self.client.get('/api/procurement/quotations/')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        results1 = res1.data.get('results', res1.data)
        ids1 = [q['id'] for q in results1]
        self.assertIn(self.quote_1a.id, ids1)
        self.assertIn(self.quote_1b.id, ids1)
        self.assertNotIn(self.quote_2c.id, ids1)

        # Attempt to access unassigned quotation directly
        detail_res = self.client.get(f'/api/procurement/quotations/{self.quote_2c.id}/')
        self.assertEqual(detail_res.status_code, status.HTTP_404_NOT_FOUND)

        # Member 2
        self.client.force_authenticate(user=self.committee_member_2)
        res2 = self.client.get('/api/procurement/quotations/')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        results2 = res2.data.get('results', res2.data)
        ids2 = [q['id'] for q in results2]
        self.assertIn(self.quote_2c.id, ids2)
        self.assertNotIn(self.quote_1a.id, ids2)
        self.assertNotIn(self.quote_1b.id, ids2)

    def test_secure_document_access_permissions(self):
        """Document endpoint securely enforces committee assignment and authentication."""
        # Unauthenticated
        unauth_client = APIClient()
        res_unauth = unauth_client.get(f'/api/procurement/quotations/{self.quote_1a.id}/document/')
        self.assertEqual(res_unauth.status_code, status.HTTP_401_UNAUTHORIZED)

        # Assigned committee member has access
        self.client.force_authenticate(user=self.committee_member_1)
        res_assigned = self.client.get(f'/api/procurement/quotations/{self.quote_1a.id}/document/')
        self.assertEqual(res_assigned.status_code, status.HTTP_200_OK)

        # Unassigned committee member is forbidden
        self.client.force_authenticate(user=self.committee_member_2)
        res_unassigned = self.client.get(f'/api/procurement/quotations/{self.quote_1a.id}/document/')
        self.assertIn(res_unassigned.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

    def test_mark_under_review_workflow(self):
        """Committee member can mark quotation as Under Review."""
        self.client.force_authenticate(user=self.committee_member_1)
        res = self.client.post(f'/api/procurement/quotations/{self.quote_1a.id}/mark-under-review/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['quotation']['status'], 'UNDER_REVIEW')

        self.quote_1a.refresh_from_db()
        self.assertEqual(self.quote_1a.status, Quotation.StatusChoices.UNDER_REVIEW)

    def test_evaluate_quotation_remarks(self):
        """Committee member can record evaluation remarks."""
        self.client.force_authenticate(user=self.committee_member_1)
        res = self.client.post(f'/api/procurement/quotations/{self.quote_1a.id}/evaluate/', {
            'evaluation_remarks': 'Technical specifications meet ICU requirements. Warranty is sufficient.'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.quote_1a.refresh_from_db()
        self.assertEqual(self.quote_1a.evaluation_remarks, 'Technical specifications meet ICU requirements. Warranty is sufficient.')
        # Status remains UNDER_REVIEW or SUBMITTED
        self.assertIn(self.quote_1a.status, ['SUBMITTED', 'UNDER_REVIEW'])
        self.assertFalse(self.quote_1a.is_recommended)

    def test_recommend_quotation_workflow_and_governance(self):
        """
        Committee member recommends vendor with justification.
        Crucial requirement: does NOT automatically award a contract (no PurchaseOrder)
        or mark quotation ACCEPTED without formal approval.
        """
        self.client.force_authenticate(user=self.committee_member_1)

        # Empty remarks fails validation
        empty_res = self.client.post(f'/api/procurement/quotations/{self.quote_1b.id}/recommend/', {
            'evaluation_remarks': ''
        })
        self.assertEqual(empty_res.status_code, status.HTTP_400_BAD_REQUEST)

        # Successful recommendation
        res = self.client.post(f'/api/procurement/quotations/{self.quote_1b.id}/recommend/', {
            'evaluation_remarks': 'Recommended as the lowest compliant commercial bid with acceptable delivery time.'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['quotation']['status'], 'RECOMMENDED')
        self.assertTrue(res.data['quotation']['is_recommended'])

        self.quote_1b.refresh_from_db()
        self.assertEqual(self.quote_1b.status, Quotation.StatusChoices.RECOMMENDED)
        self.assertTrue(self.quote_1b.is_recommended)
        self.assertEqual(self.quote_1b.recommended_by, self.committee_member_1)
        self.assertIsNotNone(self.quote_1b.recommended_at)

        # Verify: NOT auto-awarded, NOT status=ACCEPTED
        self.assertNotEqual(self.quote_1b.status, Quotation.StatusChoices.ACCEPTED)

        # Verify an Approval entry was registered for formal committee decision
        approval = Approval.objects.filter(
            requisition=self.req_1,
            stage='Procurement Committee Recommendation'
        ).first()
        self.assertIsNotNone(approval)
        self.assertEqual(approval.status, 'PENDING')

    def test_recommendation_swapping_resets_previous_recommendation(self):
        """Recommending another quotation for the same RFQ resets the previous recommendation."""
        self.client.force_authenticate(user=self.committee_member_1)

        # Recommend Quote 1A first
        self.client.post(f'/api/procurement/quotations/{self.quote_1a.id}/recommend/', {
            'evaluation_remarks': 'Recommend 1A for warranty.'
        })
        self.quote_1a.refresh_from_db()
        self.assertTrue(self.quote_1a.is_recommended)

        # Now recommend Quote 1B instead
        self.client.post(f'/api/procurement/quotations/{self.quote_1b.id}/recommend/', {
            'evaluation_remarks': 'Re-evaluating: Quote 1B selected due to budget constraints.'
        })
        self.quote_1a.refresh_from_db()
        self.quote_1b.refresh_from_db()

        self.assertFalse(self.quote_1a.is_recommended)
        self.assertEqual(self.quote_1a.status, Quotation.StatusChoices.UNDER_REVIEW)
        self.assertTrue(self.quote_1b.is_recommended)
        self.assertEqual(self.quote_1b.status, Quotation.StatusChoices.RECOMMENDED)

    def test_compare_quotations_endpoint(self):
        """Comparison endpoint returns matrix with lowest bidder and fastest delivery analysis."""
        self.client.force_authenticate(user=self.committee_member_1)
        res = self.client.get(f'/api/procurement/quotations/compare/?rfq_id={self.rfq_1.id}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        data = res.data
        self.assertEqual(len(data['quotations']), 2)
        # Lowest price is quote_1b (425000 vs 445000)
        self.assertEqual(data['lowest_price_quotation_id'], self.quote_1b.id)
        # Fastest delivery is quote_1a (10 days vs 15 days)
        self.assertEqual(data['fastest_delivery_quotation_id'], self.quote_1a.id)

    def test_reject_quotation(self):
        """Committee member can reject non-compliant or unsuitable quotation."""
        self.client.force_authenticate(user=self.committee_member_1)
        res = self.client.post(f'/api/procurement/quotations/{self.quote_1a.id}/reject/', {
            'rejection_reason': 'Total cost exceeds allocated department budget threshold.'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['quotation']['status'], 'REJECTED')

        self.quote_1a.refresh_from_db()
        self.assertEqual(self.quote_1a.status, Quotation.StatusChoices.REJECTED)
        self.assertFalse(self.quote_1a.is_recommended)
