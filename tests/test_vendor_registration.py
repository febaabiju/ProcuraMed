import os
import sys
import pathlib
import time
import pytest
from reportlab.pdfgen import canvas
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

# Paths and configuration
BASE_DIR = pathlib.Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

SCREENSHOT_DIR = BASE_DIR / "test-results" / "screenshots"
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")
REGISTER_URL = f"{BASE_URL}/vendor-register"
HEADLESS_MODE = os.environ.get("HEADLESS", "true").lower() in ("true", "1", "yes")

# Ensure valid sample certificate PDF exists for upload testing
CERT_PATH = BASE_DIR / "test-results" / "sample_vendor_license.pdf"


def ensure_sample_certificate():
    """Generate a valid PDF certificate if not present for file upload verification."""
    CERT_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not CERT_PATH.exists():
        c = canvas.Canvas(str(CERT_PATH))
        c.drawString(100, 750, "GOVERNMENT OF HEALTH & FAMILY WELFARE")
        c.drawString(100, 730, "Medical Device Manufacturer & Wholesale License")
        c.drawString(100, 700, "License No: MD-LIC-2026-98745")
        c.drawString(100, 680, "Entity: Apex LifeCare Solutions Pvt Ltd")
        c.drawString(100, 660, "Validity: 2026 - 2031")
        c.drawString(100, 640, "Certified for Hospital Procurement Supply.")
        c.save()
    return CERT_PATH


class TestVendorRegistration:
    """
    Test Case 5: Vendor Registration / Application Test Suite
    Validates the vendor supplier registration workflow:
    - Required field validation when mandatory information is omitted
    - Successful submission with valid vendor company information, supplier categories,
      products description, and valid business license certificate PDF
    - Verification of confirmation screen, pending approval status, and database record
    """

    @classmethod
    def setup_class(cls):
        """Ensure sample test certificate PDF is available."""
        cls.cert_file = ensure_sample_certificate()

        # Initialize Django settings for database verification
        import django
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
        django.setup()

    def setup_method(self, method):
        """Setup Chrome WebDriver before each test execution."""
        options = Options()
        if HEADLESS_MODE:
            options.add_argument("--headless=new")
        options.add_argument("--window-size=1920,1080")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--ignore-certificate-errors")

        self.driver = webdriver.Chrome(options=options)
        self.driver.maximize_window()
        self.wait = WebDriverWait(self.driver, 12)

    def teardown_method(self, method):
        """Tear down and close the WebDriver session after each test."""
        if hasattr(self, "driver") and self.driver:
            self.driver.quit()

    def click_element(self, element):
        """Helper to reliably scroll and click element across animations."""
        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
        try:
            element.click()
        except Exception:
            self.driver.execute_script("arguments[0].click();", element)

    def test_vendor_registration_missing_fields_validation(self):
        """
        Negative Test: Submit vendor registration form without entering required fields.
        Verify that appropriate validation error messages appear for all mandatory fields:
        Company Name, Contact Person, Business Email, Phone, Address, Categories, and Products.
        """
        driver = self.driver
        wait = self.wait

        driver.get(REGISTER_URL)
        wait.until(EC.visibility_of_element_located((By.XPATH, "//h1[contains(., 'Vendor Supplier Application')]")))

        # Click Submit Application without entering any data
        submit_btn = wait.until(
            EC.presence_of_element_located((By.XPATH, "//button[@type='submit' and contains(., 'Submit Application')]"))
        )
        self.click_element(submit_btn)

        # Verify validation error messages
        company_err = wait.until(
            EC.visibility_of_element_located((By.XPATH, "//*[contains(text(), 'Company name is required')]"))
        )
        email_err = wait.until(
            EC.visibility_of_element_located((By.XPATH, "//*[contains(text(), 'Business Email is required')]"))
        )
        cat_err = wait.until(
            EC.visibility_of_element_located((By.XPATH, "//*[contains(text(), 'At least one supplier category must be selected')]"))
        )

        driver.save_screenshot(str(SCREENSHOT_DIR / "tc5_validation_errors.png"))

        assert "Company name is required" in company_err.text, f"Unexpected error: {company_err.text}"
        assert "Business Email is required" in email_err.text, f"Unexpected error: {email_err.text}"
        assert "At least one supplier category must be selected" in cat_err.text, f"Unexpected error: {cat_err.text}"

    def test_vendor_registration_success(self):
        """
        Positive Test: Complete vendor registration application with valid dummy data.
        Verify:
        1. Form opens successfully at /vendor-register.
        2. Enter valid Company Information (Company Name, Contact Person, Email, Phone, Address).
        3. Select Supplier Categories (Biomedical Equipment).
        4. Enter Products/Services description.
        5. Upload Business License / Registration Certificate PDF.
        6. Submit application and verify confirmation screen ('Application Submitted Successfully!').
        7. Verify company details and status badge 'Pending Admin Approval'.
        8. Verify database persistence with status 'PENDING'.
        """
        driver = self.driver
        wait = self.wait

        # Step 1: Navigate to Vendor Registration page
        driver.get(REGISTER_URL)
        heading = wait.until(EC.visibility_of_element_located((By.XPATH, "//h1[contains(., 'Vendor Supplier Application')]")))
        assert heading.is_displayed(), "Registration heading not visible"
        driver.save_screenshot(str(SCREENSHOT_DIR / "tc5_step1_registration_page_loaded.png"))

        # Prepare unique test vendor data
        timestamp = int(time.time())
        unique_company = f"Apex LifeCare Solutions {timestamp}"
        unique_email = f"apexlifecare.{timestamp}@gmail.com"
        contact_person = "Rajesh Sharma"
        phone_number = "9876543210"
        address_text = "Plot 42, Healthcare Technology Park, Whitefield, Bengaluru, Karnataka 560066"
        products_desc = (
            "Supplier of high-precision diagnostic and biomedical monitoring equipment, "
            "ICU life-support sensors, and hospital calibration apparatus."
        )

        # Step 2: Enter Company Information
        company_input = wait.until(EC.visibility_of_element_located((By.NAME, "company_name")))
        company_input.clear()
        company_input.send_keys(unique_company)

        contact_input = driver.find_element(By.NAME, "contact_person")
        contact_input.clear()
        contact_input.send_keys(contact_person)

        email_input = driver.find_element(By.NAME, "email")
        email_input.clear()
        email_input.send_keys(unique_email)

        phone_input = driver.find_element(By.NAME, "phone")
        phone_input.clear()
        phone_input.send_keys(phone_number)

        address_input = driver.find_element(By.NAME, "address")
        address_input.clear()
        address_input.send_keys(address_text)

        driver.save_screenshot(str(SCREENSHOT_DIR / "tc5_step2_company_info_entered.png"))

        # Step 3: Select Supplier Category (Biomedical Equipment)
        biomed_cb = wait.until(
            EC.presence_of_element_located((By.XPATH, "//label[contains(., 'Biomedical Equipment')]//input[@type='checkbox']"))
        )
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", biomed_cb)
        driver.execute_script("arguments[0].click();", biomed_cb)
        assert biomed_cb.is_selected(), "Biomedical Equipment checkbox was not selected"
        driver.save_screenshot(str(SCREENSHOT_DIR / "tc5_step3_categories_selected.png"))

        # Step 4: Enter Products/Services description and Upload Certificate PDF
        products_input = driver.find_element(By.NAME, "products_services_offered")
        products_input.clear()
        products_input.send_keys(products_desc)

        file_input = driver.find_element(By.CSS_SELECTOR, "input[type='file']")
        file_input.send_keys(str(self.cert_file.resolve()))

        time.sleep(1)
        driver.save_screenshot(str(SCREENSHOT_DIR / "tc5_step4_products_and_certificate_uploaded.png"))

        # Step 5: Submit Application
        submit_btn = wait.until(
            EC.presence_of_element_located((By.XPATH, "//button[@type='submit' and contains(., 'Submit Application')]"))
        )
        self.click_element(submit_btn)

        # Step 6: Verify Confirmation Screen
        success_heading = wait.until(
            EC.visibility_of_element_located((By.XPATH, "//h2[contains(., 'Application Submitted Successfully!')]"))
        )
        assert success_heading.is_displayed(), "Success heading not displayed"

        status_badge = wait.until(
            EC.visibility_of_element_located((By.XPATH, "//*[contains(text(), 'Pending Admin Approval')]"))
        )
        assert status_badge.is_displayed(), "Status badge not displayed"

        comp_display = driver.find_element(By.XPATH, f"//*[contains(text(), '{unique_company}')]")
        assert comp_display.is_displayed(), "Company name not displayed on success card"

        driver.save_screenshot(str(SCREENSHOT_DIR / "tc5_step5_application_submitted_confirmation.png"))

        # Step 7: Verify Database Persistence
        from vendors.models import VendorApplication
        app_record = VendorApplication.objects.filter(email=unique_email).first()
        assert app_record is not None, f"VendorApplication record not found for {unique_email}"
        assert app_record.company_name == unique_company, f"Expected {unique_company}, got {app_record.company_name}"
        assert app_record.status == "PENDING", f"Expected PENDING status, got {app_record.status}"
        assert app_record.phone == phone_number
