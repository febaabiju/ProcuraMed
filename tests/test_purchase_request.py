import os
import pathlib
import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import Select

# Paths and configuration
BASE_DIR = pathlib.Path(__file__).resolve().parent.parent
SCREENSHOT_DIR = BASE_DIR / "test-results" / "screenshots"
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

# Test Configuration - configurable via environment variables
BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")
LOGIN_URL = f"{BASE_URL}/login"
CREATE_REQ_URL = f"{BASE_URL}/staff/create-request"
REQUESTS_LIST_URL = f"{BASE_URL}/staff/requests"
STAFF_USERNAME = os.environ.get("TEST_STAFF_USERNAME", "test_staff")
STAFF_PASSWORD = os.environ.get("TEST_STAFF_PASSWORD", "TestStaff@2026")
HEADLESS_MODE = os.environ.get("HEADLESS", "true").lower() in ("true", "1", "yes")


class TestPurchaseRequest:
    """
    Test Case 2: ProcuraMed Purchase Request Submission Test Suite
    Covers end-to-end requisition creation, item specification, submission verification,
    and form field validation error handling.
    """

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

    def login_as_staff(self):
        """Helper to perform authenticated login as Department Staff."""
        driver = self.driver
        wait = self.wait

        driver.get(LOGIN_URL)
        username_field = wait.until(EC.visibility_of_element_located((By.NAME, "username")))
        username_field.clear()
        username_field.send_keys(STAFF_USERNAME)

        password_field = wait.until(EC.visibility_of_element_located((By.NAME, "password")))
        password_field.clear()
        password_field.send_keys(STAFF_PASSWORD)

        login_btn = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[type='submit']")))
        self.click_element(login_btn)

        wait.until(EC.url_contains("/staff/dashboard"))

    def test_submit_purchase_request_success(self):
        """
        Test Case 2: Submit a valid Purchase Requisition.
        Steps:
        1. Login as authorized Department Staff.
        2. Navigate to Create Purchase Requisition page.
        3. Fill Step 1 Requisition Details (Title, Priority, Clinical Justification).
        4. Fill Step 2 Item Specifications (Product Name, Category, Quantity, Unit Price, Specs).
        5. Review Requisition Summary in Step 3 and submit.
        6. Verify confirmation alert and automatic redirection to My Requisitions list.
        """
        driver = self.driver
        wait = self.wait

        # Step 1: Login as staff requester
        self.login_as_staff()
        driver.save_screenshot(str(SCREENSHOT_DIR / "tc2_step1_staff_dashboard.png"))

        # Step 2: Open Create Purchase Requisition Form
        driver.get(CREATE_REQ_URL)
        wait.until(EC.url_contains("/staff/create-request"))
        form_heading = wait.until(
            EC.visibility_of_element_located((By.XPATH, "//h2[contains(text(), 'Step 1: General Requisition Details')]"))
        )
        assert form_heading.is_displayed(), "Create Requisition form failed to load"
        driver.save_screenshot(str(SCREENSHOT_DIR / "tc2_step2_create_form_loaded.png"))

        # Step 3: Enter Step 1 General Requisition Details
        title_val = "Automated Procurement - Emergency Surgical Gloves Replenishment"
        title_input = wait.until(
            EC.visibility_of_element_located((By.XPATH, "//input[contains(@placeholder, 'Monthly Replenishment')]"))
        )
        title_input.clear()
        title_input.send_keys(title_val)

        priority_select_elem = wait.until(
            EC.visibility_of_element_located((By.XPATH, "//label[contains(text(), 'Priority Level')]/following::select[1]"))
        )
        Select(priority_select_elem).select_by_value("HIGH")

        justification_val = "Emergency stock replenishment required for Operation Theatre surgical procedures."
        justification_input = wait.until(EC.visibility_of_element_located((By.TAG_NAME, "textarea")))
        justification_input.clear()
        justification_input.send_keys(justification_val)

        driver.save_screenshot(str(SCREENSHOT_DIR / "tc2_step3_step1_details_entered.png"))

        next_btn_1 = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Next: Add Items & Specs')]")))
        self.click_element(next_btn_1)

        # Step 4: Enter Step 2 Multi-Item Specifications
        wait.until(
            EC.visibility_of_element_located((By.XPATH, "//h2[contains(text(), 'Step 2: Add Requisition Items')]"))
        )

        item_name_input = wait.until(
            EC.visibility_of_element_located((By.XPATH, "//input[contains(@placeholder, 'Surgical Gloves')]"))
        )
        item_name_input.clear()
        item_name_input.send_keys("Nitrile Surgical Gloves Powder-Free (Box of 100)")

        category_elem = wait.until(
            EC.visibility_of_element_located((By.XPATH, "//label[contains(text(), 'Category')]/following::select[1]"))
        )
        wait.until(lambda d: len(Select(category_elem).options) > 1)
        Select(category_elem).select_by_visible_text("Medical Consumables")

        qty_input = wait.until(
            EC.visibility_of_element_located((By.XPATH, "//label[contains(text(), 'Quantity')]/following::input[1]"))
        )
        qty_input.clear()
        qty_input.send_keys("50")

        price_input = wait.until(
            EC.visibility_of_element_located((By.XPATH, "//label[contains(text(), 'Estimated Unit Price')]/following::input[1]"))
        )
        price_input.clear()
        price_input.send_keys("450.00")

        specs_input = wait.until(
            EC.visibility_of_element_located((By.XPATH, "//input[contains(@placeholder, 'Nitrile, textured grip')]"))
        )
        specs_input.clear()
        specs_input.send_keys("Medical grade nitrile, powder-free, hypoallergenic, ISO certified.")

        driver.save_screenshot(str(SCREENSHOT_DIR / "tc2_step4_item_specs_entered.png"))

        next_btn_2 = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Next: Review Requisition')]")))
        self.click_element(next_btn_2)

        # Step 5: Review & Submit
        wait.until(
            EC.visibility_of_element_located((By.XPATH, "//h2[contains(text(), 'Step 3: Review Requisition Before Submission')]"))
        )
        driver.save_screenshot(str(SCREENSHOT_DIR / "tc2_step5_review_summary.png"))

        submit_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Submit Requisition')]")))
        self.click_element(submit_btn)

        # Step 6: Verify Confirmation Banner
        success_banner = wait.until(
            EC.visibility_of_element_located((By.XPATH, "//div[contains(@class, 'bg-emerald-50')]"))
        )
        assert "Purchase Requisition submitted successfully" in success_banner.text, (
            f"Expected success message, got: {success_banner.text}"
        )
        driver.save_screenshot(str(SCREENSHOT_DIR / "tc2_step6_submission_confirmation.png"))

        # Step 7: Verify Redirection to My Requisitions and entry in list
        wait.until(EC.url_contains("/staff/requests"))
        requisition_row = wait.until(
            EC.visibility_of_element_located((By.XPATH, "//table//tbody//tr[1]"))
        )
        driver.save_screenshot(str(SCREENSHOT_DIR / "tc2_step7_requisition_in_list.png"))

        assert "Submitted" in requisition_row.text, f"Requisition status not 'Submitted': {requisition_row.text}"

    def test_purchase_request_validation_errors(self):
        """
        Negative Test: Attempt proceeding with empty required fields.
        Verify that proper validation error messages appear for Title and Justification.
        """
        driver = self.driver
        wait = self.wait

        self.login_as_staff()
        driver.get(CREATE_REQ_URL)
        wait.until(EC.url_contains("/staff/create-request"))

        # Click Next without filling mandatory fields
        next_btn_1 = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Next: Add Items & Specs')]")))
        self.click_element(next_btn_1)

        title_error = wait.until(
            EC.visibility_of_element_located((By.XPATH, "//*[contains(text(), 'Requisition title / purpose is required.')]"))
        )
        justification_error = wait.until(
            EC.visibility_of_element_located((By.XPATH, "//*[contains(text(), 'Reason and justification are required.')]"))
        )

        driver.save_screenshot(str(SCREENSHOT_DIR / "tc2_validation_errors_displayed.png"))

        assert title_error.is_displayed(), "Title validation error not shown"
        assert justification_error.is_displayed(), "Justification validation error not shown"
