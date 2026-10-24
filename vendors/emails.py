import os
from pathlib import Path
import json
import socket
import urllib.request
import urllib.error
import urllib.parse
import logging
from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.utils.html import strip_tags
try:
    from dotenv import dotenv_values
except ImportError:
    dotenv_values = None

logger = logging.getLogger(__name__)


def get_smtp_connection():
    """
    Creates an email connection with credentials dynamically loaded from environment
    variables and settings, falling back to local .env if present.
    Ensures quotes, trailing comments, and spaces in EMAIL_HOST_PASSWORD are sanitized.
    """
    env_file = Path(settings.BASE_DIR) / '.env'
    env_vars = {}
    if env_file.exists() and dotenv_values:
        try:
            env_vars = dotenv_values(env_file)
        except Exception:
            env_vars = {}

    host = os.environ.get('EMAIL_HOST') or env_vars.get('EMAIL_HOST') or getattr(settings, 'EMAIL_HOST', 'smtp.gmail.com')
    raw_port = os.environ.get('EMAIL_PORT') or env_vars.get('EMAIL_PORT') or getattr(settings, 'EMAIL_PORT', 587)
    try:
        port = int(str(raw_port).strip())
    except (ValueError, TypeError):
        port = 587

    raw_tls = os.environ.get('EMAIL_USE_TLS') or env_vars.get('EMAIL_USE_TLS') or getattr(settings, 'EMAIL_USE_TLS', 'True')
    use_tls = str(raw_tls).lower() in ('true', '1', 't', 'yes')

    raw_ssl = os.environ.get('EMAIL_USE_SSL') or env_vars.get('EMAIL_USE_SSL') or getattr(settings, 'EMAIL_USE_SSL', 'False')
    use_ssl = str(raw_ssl).lower() in ('true', '1', 't', 'yes')

    username = os.environ.get('EMAIL_HOST_USER') or env_vars.get('EMAIL_HOST_USER') or getattr(settings, 'EMAIL_HOST_USER', 'procuramed2026@gmail.com')
    if username:
        username = username.strip().strip('\'"')

    password = os.environ.get('EMAIL_HOST_PASSWORD') or env_vars.get('EMAIL_HOST_PASSWORD') or getattr(settings, 'EMAIL_HOST_PASSWORD', '')

    if password:
        if '#' in password:
            password = password.split('#')[0]
        password = password.strip().strip('\'"').replace(' ', '')

    if not password:
        return None, "Email password is not configured (EMAIL_HOST_PASSWORD is empty). Please set your 16-character Gmail App Password in environment variables."

    try:
        backend_cls = getattr(settings, 'EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend')
        connection = get_connection(
            backend=backend_cls,
            host=host,
            port=port,
            username=username,
            password=password,
            use_tls=use_tls,
            use_ssl=use_ssl,
            timeout=15,
        )
        return connection, None
    except Exception as exc:
        return None, f"Failed to initialize email connection: {exc}"


def get_from_email():
    """
    Dynamically loads the default from-email from environment, settings, or .env.
    """
    env_file = Path(settings.BASE_DIR) / '.env'
    env_vars = {}
    if env_file.exists() and dotenv_values:
        try:
            env_vars = dotenv_values(env_file)
        except Exception:
            env_vars = {}

    from_email = (
        os.environ.get('DEFAULT_FROM_EMAIL') or
        env_vars.get('DEFAULT_FROM_EMAIL') or
        os.environ.get('EMAIL_HOST_USER') or
        env_vars.get('EMAIL_HOST_USER') or
        getattr(settings, 'DEFAULT_FROM_EMAIL', 'procuramed2026@gmail.com')
    )
    return str(from_email).strip().strip('\'"')


def get_apps_script_config():
    """
    Dynamically loads Google Apps Script relay configuration from environment variables,
    settings, or local .env.
    Returns (script_url, script_token).
    """
    env_file = Path(settings.BASE_DIR) / '.env'
    env_vars = {}
    if env_file.exists() and dotenv_values:
        try:
            env_vars = dotenv_values(env_file)
        except Exception:
            env_vars = {}

    script_url = (
        os.environ.get('GOOGLE_APPS_SCRIPT_URL') or
        env_vars.get('GOOGLE_APPS_SCRIPT_URL') or
        getattr(settings, 'GOOGLE_APPS_SCRIPT_URL', '')
    )
    if script_url:
        script_url = str(script_url).strip().strip('\'"')

    script_token = (
        os.environ.get('GOOGLE_APPS_SCRIPT_TOKEN') or
        env_vars.get('GOOGLE_APPS_SCRIPT_TOKEN') or
        getattr(settings, 'GOOGLE_APPS_SCRIPT_TOKEN', '')
    )
    if script_token:
        script_token = str(script_token).strip().strip('\'"')

    return script_url or None, script_token or None


def send_email_via_apps_script(to_email, subject, text_content, html_content, script_url=None, script_token=None, timeout=15):
    """
    Sends an email over HTTPS via a deployed Google Apps Script Web App relay.
    Bypasses blocked outbound SMTP ports (25, 465, 587) on hosting platforms like Render Free.
    Uses exact payload keys expected by Apps Script: token, to, subject, textBody, and htmlBody.
    Handles Google Apps Script 302 / ContentService redirect behavior and timeouts safely.
    Never logs passwords, tokens, email bodies, or the shared secret.
    """
    if not script_url or not script_token:
        cfg_url, cfg_token = get_apps_script_config()
        script_url = script_url or cfg_url
        script_token = script_token or cfg_token

    if not script_url and not script_token:
        return False, "Google Apps Script relay is not configured."

    if not script_url:
        return False, "Google Apps Script URL is not configured (GOOGLE_APPS_SCRIPT_URL is empty)."

    if not script_token:
        return False, "Google Apps Script shared secret token is not configured (GOOGLE_APPS_SCRIPT_TOKEN is empty)."

    if not script_url.lower().startswith('https://'):
        return False, "Google Apps Script URL must use HTTPS protocol."

    if not to_email:
        return False, "Recipient email address is required."

    payload = {
        'token': script_token,
        'to': to_email,
        'subject': subject,
        'textBody': text_content,
        'htmlBody': html_content,
    }

    try:
        data = json.dumps(payload).encode('utf-8')
    except (TypeError, ValueError) as json_err:
        logger.error(f"Failed to serialize email payload to JSON: {json_err}")
        return False, "Failed to encode email payload for relay."

    req = urllib.request.Request(
        url=script_url,
        data=data,
        headers={
            'Content-Type': 'application/json; charset=utf-8',
            'User-Agent': 'ProcuraMed-Backend/1.0',
            'Accept': 'application/json',
        },
        method='POST'
    )

    try:
        # urllib.request.urlopen automatically follows 301, 302, 303 redirects from POST by issuing a GET to the Location header.
        # Google Apps Script ContentService returns HTTP 302 Found pointing to script.googleusercontent.com/macros/echo?...
        with urllib.request.urlopen(req, timeout=timeout) as response:
            status_code = getattr(response, 'status', None) or response.getcode()

            # Handle case where redirect status was not automatically followed
            if status_code in (301, 302, 303, 307, 308):
                redirect_url = response.headers.get('Location') or response.headers.get('location')
                if redirect_url:
                    redirect_url = urllib.parse.urljoin(script_url, redirect_url)
                    redir_req = urllib.request.Request(
                        redirect_url,
                        headers={
                            'User-Agent': 'ProcuraMed-Backend/1.0',
                            'Accept': 'application/json',
                        },
                        method='GET'
                    )
                    with urllib.request.urlopen(redir_req, timeout=timeout) as redir_resp:
                        response_body = redir_resp.read().decode('utf-8', errors='replace')
                else:
                    response_body = response.read().decode('utf-8', errors='replace')
            else:
                response_body = response.read().decode('utf-8', errors='replace')

    except urllib.error.HTTPError as http_err:
        # If urllib raised HTTPError on redirect (e.g. 307/308 or redirect limit)
        if http_err.code in (301, 302, 303, 307, 308):
            redirect_url = http_err.headers.get('Location') or http_err.headers.get('location')
            if redirect_url:
                try:
                    redirect_url = urllib.parse.urljoin(script_url, redirect_url)
                    redir_req = urllib.request.Request(
                        redirect_url,
                        headers={
                            'User-Agent': 'ProcuraMed-Backend/1.0',
                            'Accept': 'application/json',
                        },
                        method='GET'
                    )
                    with urllib.request.urlopen(redir_req, timeout=timeout) as redir_resp:
                        response_body = redir_resp.read().decode('utf-8', errors='replace')
                except Exception as redir_err:
                    logger.error(f"Failed to follow Google Apps Script redirect: {redir_err}")
                    return False, f"Failed to follow Google Apps Script redirect: {redir_err}"
            else:
                logger.error(f"Google Apps Script returned redirect HTTP {http_err.code} without Location header")
                return False, f"Google Apps Script returned HTTP {http_err.code} without Location header."
        else:
            logger.error(f"Google Apps Script relay returned HTTP error {http_err.code}")
            try:
                err_body = http_err.read().decode('utf-8', errors='replace')
                err_json = json.loads(err_body)
                detail = err_json.get('error') or err_json.get('message')
                if detail:
                    return False, f"Google Apps Script relay error: {detail}"
            except Exception:
                pass
            return False, f"Google Apps Script relay failed with HTTP {http_err.code}."

    except (socket.timeout, TimeoutError) as to_err:
        logger.error(f"Timeout while connecting to Google Apps Script relay: {to_err}")
        return False, "Google Apps Script email relay timed out. Please try again."

    except urllib.error.URLError as url_err:
        if isinstance(url_err.reason, (socket.timeout, TimeoutError)):
            logger.error(f"Timeout while connecting to Google Apps Script relay: {url_err}")
            return False, "Google Apps Script email relay timed out. Please try again."
        logger.error(f"Network error connecting to Google Apps Script relay: {url_err.reason}")
        return False, f"Failed to connect to Google Apps Script relay: {url_err.reason}"

    except Exception as exc:
        logger.error(f"Unexpected error in Google Apps Script relay: {exc}")
        return False, f"Failed to send email via Google Apps Script relay: {str(exc)}"

    # Parse and validate JSON response from relay
    try:
        res_data = json.loads(response_body)
    except (json.JSONDecodeError, ValueError) as json_err:
        logger.error(f"Invalid JSON received from Google Apps Script relay: {json_err}")
        return False, "Invalid response received from Google Apps Script relay."

    if not isinstance(res_data, dict):
        logger.error("Non-dictionary JSON response from Google Apps Script relay")
        return False, "Invalid JSON structure received from Google Apps Script relay."

    # Check for success indicators
    is_success = (
        res_data.get('success') is True or
        str(res_data.get('status')).lower() == 'success' or
        str(res_data.get('result')).lower() == 'success'
    )

    if is_success:
        logger.info(f"Password reset email delivered to {to_email} via Google Apps Script relay.")
        return True, "Password reset email sent successfully"

    error_msg = res_data.get('error') or res_data.get('message') or "Email delivery failed at relay"
    logger.error(f"Google Apps Script relay reported error: {error_msg}")
    return False, f"Google Apps Script relay error: {error_msg}"



def send_vendor_approval_email(application, username, temporary_password, portal_url=None):
    """
    Sends an approval email notification to the vendor's registered email address
    with their assigned username, temporary password, and login instructions.
    """
    recipient_email = application.email
    company_name = application.company_name
    contact_person = application.contact_person or company_name
    from_email = get_from_email()
    login_url = portal_url or getattr(settings, 'VENDOR_PORTAL_URL', 'http://localhost:3000/login')

    subject = f"ProcuraMed - Vendor Supplier Application Approved ({company_name})"

    text_content = f"""Dear {contact_person},

Congratulations! We are pleased to inform you that your Vendor Supplier Application for ProcuraMed Hospital Network has been approved.

Your Vendor Portal account has been created with the following login credentials:

--------------------------------------------------
Company Name:       {company_name}
Username:           {username}
Temporary Password: {temporary_password}
Portal Login URL:   {login_url}
--------------------------------------------------

Next Steps:
1. Navigate to the ProcuraMed Portal: {login_url}
2. Sign in using your assigned username and temporary password.
3. For security purposes, you will be prompted to set a new password during your first login.
4. Once signed in, you can manage your business capabilities, view RFQs/tenders, and submit quotations.

If you have any questions or require assistance, please contact the System Administrator at {from_email}.

Best regards,
ProcuraMed Hospital Procurement Administration
Email: {from_email}
Website: http://localhost:3000
"""

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Application Approved</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8F8FC; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1E293B;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8F8FC; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" style="max-width: 600px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(139, 124, 248, 0.12); border: 1px solid #EDE9FE;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #8B7CF8 0%, #6D54EA 100%); padding: 35px 30px; text-align: center;">
              <h1 style="color: #FFFFFF; font-size: 26px; font-weight: 800; margin: 0 0 6px 0; letter-spacing: -0.5px;">ProcuraMed</h1>
              <p style="color: #EDE9FE; font-size: 13px; margin: 0; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Hospital Procurement Network</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 35px 30px;">
              <div style="display: inline-block; background-color: #ECFDF5; border: 1px solid #A7F3D0; color: #065F46; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 20px;">
                ✓ Application Approved
              </div>

              <h2 style="font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 14px 0;">Welcome to ProcuraMed Supplier Network</h2>
              
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
                Dear <strong>{contact_person}</strong>,
              </p>
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
                We are pleased to inform you that the supplier application submitted for <strong>{company_name}</strong> has been successfully reviewed and approved by the Hospital System Administrator.
              </p>

              <!-- Credentials Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 14px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 12px 0; font-size: 11px; font-weight: 700; color: #7C3AED; text-transform: uppercase; letter-spacing: 1px;">Your Vendor Portal Credentials</p>
                    
                    <table width="100%" border="0" cellspacing="0" cellpadding="6" style="font-size: 13px;">
                      <tr>
                        <td width="35%" style="color: #64748B; font-weight: 600;">Assigned Username:</td>
                        <td style="color: #0F172A; font-weight: 700; font-family: monospace; font-size: 14px;">{username}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748B; font-weight: 600;">Temporary Password:</td>
                        <td style="color: #7C3AED; font-weight: 700; font-family: monospace; font-size: 14px;">{temporary_password}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748B; font-weight: 600;">Registered Email:</td>
                        <td style="color: #0F172A; font-weight: 600;">{recipient_email}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 25px 0;">
                <tr>
                  <td align="center">
                    <a href="{login_url}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #8B7CF8 0%, #6D54EA 100%); color: #FFFFFF; font-size: 14px; font-weight: 700; padding: 14px 32px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 14px rgba(139, 124, 248, 0.35);">
                      Log In to Vendor Portal &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Important Notice -->
              <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 14px 16px; border-radius: 8px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 12px; color: #92400E; line-height: 1.5;">
                  <strong>First-Time Login Security Notice:</strong> You are required to update your temporary password upon your first sign-in before accessing procurement features.
                </p>
              </div>

              <p style="font-size: 13px; line-height: 1.5; color: #64748B; margin: 0;">
                If you have questions or need assistance, reply to this email or reach us at <a href="mailto:{from_email}" style="color: #8B7CF8; text-decoration: none; font-weight: 600;">{from_email}</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0F172A; padding: 25px 30px; text-align: center; border-top: 1px solid #1E293B;">
              <p style="color: #94A3B8; font-size: 12px; margin: 0 0 6px 0;">ProcuraMed Hospital Procurement Management System</p>
              <p style="color: #64748B; font-size: 11px; margin: 0;">Official Admin Contact: <a href="mailto:{from_email}" style="color: #A78BFA; text-decoration: none;">{from_email}</a> | Kerala, India</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    connection, conn_err = get_smtp_connection()
    if not connection:
        logger.error(f"Cannot send approval email to {recipient_email}: {conn_err}")
        return False, conn_err

    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=from_email,
            to=[recipient_email],
            connection=connection,
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send(fail_silently=False)
        logger.info(f"Vendor approval email successfully sent to {recipient_email} for {company_name}.")
        return True, "Email sent successfully"
    except Exception as exc:
        logger.error(f"Failed to send vendor approval email to {recipient_email}: {str(exc)}", exc_info=True)
        err_str = str(exc)
        if "535" in err_str or "Authentication" in err_str or "Username and Password not accepted" in err_str:
            err_str = "Gmail SMTP authentication failed. Please verify the 16-character Google App Password in .env."
        return False, err_str


def send_vendor_rejection_email(application, rejection_reason):
    """
    Sends a rejection email notification to the vendor's registered email address
    informing them of the decision and including the Admin's rejection remarks.
    """
    recipient_email = application.email
    company_name = application.company_name
    contact_person = application.contact_person or company_name
    from_email = get_from_email()

    subject = f"ProcuraMed - Vendor Supplier Application Status ({company_name})"

    reason_text = rejection_reason.strip() if rejection_reason else "Application does not meet current qualification criteria."

    text_content = f"""Dear {contact_person},

Thank you for your interest in becoming a registered supplier for ProcuraMed Hospital Network.

Following a thorough administrative review, we regret to inform you that your supplier application for {company_name} has not been approved at this time.

Reason for Rejection / Admin Remarks:
--------------------------------------------------
{reason_text}
--------------------------------------------------

If you believe this decision was made in error or if you are able to address the remarks noted above, you are welcome to submit an updated application in the future or contact the System Administrator at {from_email}.

Thank you for your time and interest in ProcuraMed.

Best regards,
ProcuraMed Hospital Procurement Administration
Email: {from_email}
Website: http://localhost:3000
"""

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Application Status Update</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8F8FC; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1E293B;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8F8FC; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" style="max-width: 600px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06); border: 1px solid #F1F5F9;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #475569 0%, #334155 100%); padding: 35px 30px; text-align: center;">
              <h1 style="color: #FFFFFF; font-size: 26px; font-weight: 800; margin: 0 0 6px 0; letter-spacing: -0.5px;">ProcuraMed</h1>
              <p style="color: #CBD5E1; font-size: 13px; margin: 0; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Hospital Procurement Network</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 35px 30px;">
              <div style="display: inline-block; background-color: #FEF2F2; border: 1px solid #FECACA; color: #991B1B; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 20px;">
                Application Reviewed
              </div>

              <h2 style="font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 14px 0;">Supplier Application Status Update</h2>
              
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0;">
                Dear <strong>{contact_person}</strong>,
              </p>
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
                Thank you for applying to become an approved supplier for <strong>{company_name}</strong>. Following review by our procurement administration, we regret to inform you that your application has not been approved at this time.
              </p>

              <!-- Reason Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FFF1F2; border-left: 4px solid #E11D48; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 18px 20px;">
                    <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; color: #9F1239; text-transform: uppercase; letter-spacing: 1px;">Reason for Rejection / Admin Remarks</p>
                    <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #881337; font-weight: 500;">
                      {reason_text}
                    </p>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; line-height: 1.6; color: #64748B; margin: 0 0 20px 0;">
                If you have resolved the points above or wish to provide additional documentation, you may contact the administration or submit a new application when ready.
              </p>

              <p style="font-size: 13px; line-height: 1.5; color: #64748B; margin: 0;">
                For questions regarding this review, please contact: <a href="mailto:{from_email}" style="color: #8B7CF8; text-decoration: none; font-weight: 600;">{from_email}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0F172A; padding: 25px 30px; text-align: center; border-top: 1px solid #1E293B;">
              <p style="color: #94A3B8; font-size: 12px; margin: 0 0 6px 0;">ProcuraMed Hospital Procurement Management System</p>
              <p style="color: #64748B; font-size: 11px; margin: 0;">Official Admin Contact: <a href="mailto:{from_email}" style="color: #A78BFA; text-decoration: none;">{from_email}</a> | Kerala, India</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    connection, conn_err = get_smtp_connection()
    if not connection:
        logger.error(f"Cannot send rejection email to {recipient_email}: {conn_err}")
        return False, conn_err

    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=from_email,
            to=[recipient_email],
            connection=connection,
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send(fail_silently=False)
        logger.info(f"Vendor rejection email successfully sent to {recipient_email} for {company_name}.")
        return True, "Email sent successfully"
    except Exception as exc:
        logger.error(f"Failed to send vendor rejection email to {recipient_email}: {str(exc)}", exc_info=True)
        err_str = str(exc)
        if "535" in err_str or "Authentication" in err_str or "Username and Password not accepted" in err_str:
            err_str = "Gmail SMTP authentication failed. Please verify the 16-character Google App Password in .env."
        return False, err_str


def send_password_reset_email(user, reset_url, expires_in_minutes=30, vendor=None):
    """
    Sends a secure password-reset email with a one-time reset link and expiration notice
    to the user's registered email address for any supported ProcuraMed role.
    """
    recipient_email = user.email
    if not recipient_email:
        logger.warning(f"Cannot send password reset email: user '{user.username}' has no email configured.")
        return False, "User has no email address configured."

    role_name = user.role.name if user.role else "User"
    portal_name = f"{role_name} Portal" if "portal" not in role_name.lower() else role_name

    company_name = vendor.company_name if vendor else None
    contact_person = user.get_full_name() or (vendor.contact_person if vendor else None) or user.username
    from_email = get_from_email()

    if company_name:
        subject = f"ProcuraMed - Password Reset Request ({company_name})"
        account_desc = f"Vendor account associated with {company_name}"
    else:
        subject = f"ProcuraMed - Password Reset Request ({role_name})"
        account_desc = f"{role_name} account"

    frontend_url = getattr(settings, 'FRONTEND_URL', 'https://procuramed.vercel.app').rstrip('/')

    text_content = f"""Dear {contact_person},

We received a request to reset the password for your ProcuraMed {account_desc} (@{user.username}).

To set a new password for your account, please click the secure link below:

{reset_url}

IMPORTANT SECURITY NOTICE:
- This password reset link will expire in {expires_in_minutes} minutes.
- For your security, this link can only be used once.
- If you did not request a password reset, please ignore this email. Your account credentials will remain safe and unchanged.

If you require further assistance, please contact the System Administrator at {from_email}.

Best regards,
ProcuraMed Hospital Procurement Administration
Email: {from_email}
Website: {frontend_url}
"""

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Password Reset Request</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8F8FC; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1E293B;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8F8FC; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" style="max-width: 600px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(139, 124, 248, 0.12); border: 1px solid #EDE9FE;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #8B7CF8 0%, #6D54EA 100%); padding: 35px 30px; text-align: center;">
              <h1 style="color: #FFFFFF; font-size: 26px; font-weight: 800; margin: 0 0 6px 0; letter-spacing: -0.5px;">ProcuraMed</h1>
              <p style="color: #EDE9FE; font-size: 13px; margin: 0; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Hospital Procurement Network</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 35px 30px;">
              <div style="display: inline-block; background-color: #F5F3FF; border: 1px solid #DDD6FE; color: #6D28D9; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 20px;">
                🔒 Password Reset Request
              </div>

              <h2 style="font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 14px 0;">Reset Your {portal_name} Password</h2>
              
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0;">
                Dear <strong>{contact_person}</strong>,
              </p>
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
                We received a request to reset the password for your ProcuraMed {account_desc} (Username: <strong style="color: #7C3AED; font-family: monospace;">@{user.username}</strong>).
              </p>

              <!-- Reset Button CTA -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="{reset_url}" style="display: inline-block; background: linear-gradient(135deg, #8B7CF8 0%, #6D54EA 100%); color: #FFFFFF; text-decoration: none; padding: 14px 34px; border-radius: 12px; font-size: 14px; font-weight: 700; box-shadow: 0 4px 14px rgba(109, 84, 234, 0.35); letter-spacing: 0.3px;">
                  Reset Password Now &rarr;
                </a>
              </div>

              <!-- Expiration & Security Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FFFBEB; border: 1px solid #FDE68A; border-radius: 14px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 700; color: #92400E; text-transform: uppercase; letter-spacing: 1px;">Security &amp; Expiration Notice</p>
                    <ul style="margin: 0; padding-left: 18px; font-size: 12px; line-height: 1.6; color: #78350F;">
                      <li>This link is valid for <strong>{expires_in_minutes} minutes</strong> only.</li>
                      <li>For your security, this single-use link can only be used once.</li>
                      <li>If you did not request this password reset, no action is needed. Your current password remains secure and unchanged.</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <p style="font-size: 12px; line-height: 1.5; color: #94A3B8; margin: 0 0 10px 0;">
                If the button above does not work, copy and paste the following URL into your browser:
              </p>
              <p style="font-size: 11px; font-family: monospace; word-break: break-all; color: #6D28D9; background-color: #F8FAFC; padding: 10px; border-radius: 8px; border: 1px solid #E2E8F0; margin: 0 0 20px 0;">
                {reset_url}
              </p>

              <p style="font-size: 13px; line-height: 1.5; color: #64748B; margin: 0;">
                For assistance, please contact the System Administrator at: <a href="mailto:{from_email}" style="color: #8B7CF8; text-decoration: none; font-weight: 600;">{from_email}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0F172A; padding: 25px 30px; text-align: center; border-top: 1px solid #1E293B;">
              <p style="color: #94A3B8; font-size: 12px; margin: 0 0 6px 0;">ProcuraMed Hospital Procurement Management System</p>
              <p style="color: #64748B; font-size: 11px; margin: 0;">Official Admin Contact: <a href="mailto:{from_email}" style="color: #A78BFA; text-decoration: none;">{from_email}</a> | Kerala, India</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    # 1. Primary path: Use Google Apps Script HTTPS relay when configured (required for Render Free hosting)
    gas_url, gas_token = get_apps_script_config()
    if gas_url or gas_token:
        # When relay variables are configured, production must use the relay instead of SMTP.
        # Do not silently fall back to blocked SMTP after a configured relay fails.
        return send_email_via_apps_script(
            to_email=recipient_email,
            subject=subject,
            text_content=text_content,
            html_content=html_content,
            script_url=gas_url,
            script_token=gas_token,
        )

    # 2. Fallback path: Standard SMTP connection for local development when relay is unconfigured
    connection, conn_err = get_smtp_connection()
    if not connection:
        logger.error(f"Cannot send password reset email to {recipient_email}: {conn_err}")
        return False, conn_err

    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=from_email,
            to=[recipient_email],
            connection=connection,
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send(fail_silently=False)
        logger.info(f"Password reset email successfully sent to {recipient_email} for @{user.username} ({role_name}).")
        return True, "Password reset email sent successfully"
    except Exception as exc:
        logger.error(f"Failed to send password reset email to {recipient_email}: {str(exc)}", exc_info=True)
        err_str = str(exc)
        if "535" in err_str or "Authentication" in err_str or "Username and Password not accepted" in err_str:
            err_str = "Gmail SMTP authentication failed. Please verify the 16-character Google App Password in EMAIL_HOST_PASSWORD environment variable."
        return False, err_str


def send_vendor_password_reset_email(user, vendor, reset_url, expires_in_minutes=30):
    """
    Backwards-compatible wrapper for send_password_reset_email.
    """
    return send_password_reset_email(user=user, reset_url=reset_url, expires_in_minutes=expires_in_minutes, vendor=vendor)


