import logging
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from vendors.emails import get_smtp_connection, get_from_email

logger = logging.getLogger(__name__)


def send_user_credentials_email(user, temporary_password, login_url=None):
    """
    Sends account creation credentials email to the newly created user's registered email address.
    Includes username, employee ID, role, temporary password, login instructions,
    and a clear notice that password change is required on first login.
    """
    recipient_email = user.email
    if not recipient_email:
        logger.warning(f"Cannot send credentials email: user '{user.username}' has no email address.")
        return False, "User has no email address configured."

    from_email = get_from_email()
    url = login_url or getattr(settings, 'LOGIN_URL', 'http://localhost:3000/login')
    full_name = user.get_full_name() or user.username
    employee_id = user.employee_id or "N/A"
    role_name = user.role.name if user.role else "Hospital Staff"
    dept_name = user.department.name if user.department else None

    subject = f"Welcome to ProcuraMed - Your Login Credentials ({role_name})"

    text_content = f"""Dear {full_name},

Welcome to the ProcuraMed Hospital Procurement Network!

An internal user account has been created for you by the System Administrator with the following details:

--------------------------------------------------
Full Name:          {full_name}
Employee ID:        {employee_id}
Assigned Role:      {role_name}
{f'Department:         {dept_name}' if dept_name else ''}
Username:           {user.username}
Temporary Password: {temporary_password}
Portal Login URL:   {url}
--------------------------------------------------

IMPORTANT LOGIN NOTICE:
- For security purposes, the temporary password provided above is valid for your initial sign-in only.
- You will be required to set a new permanent password on your first login before you can access your portal dashboard.
- Please do not share this temporary password with anyone.

How to get started:
1. Navigate to {url}
2. Enter your username ({user.username}) or registered email address ({recipient_email}).
3. Enter the temporary password shown above.
4. When prompted, choose and confirm your new permanent password.

If you did not expect this email or require technical assistance, please contact the System Administrator at {from_email}.

Best regards,
ProcuraMed Hospital Procurement Administration
Email: {from_email}
Website: http://localhost:3000
"""

    dept_row = f"""
    <tr>
      <td style="padding: 6px 0; color: #64748B; font-weight: 600; width: 140px;">Department:</td>
      <td style="padding: 6px 0; color: #0F172A; font-weight: 700;">{dept_name}</td>
    </tr>
    """ if dept_name else ""

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to ProcuraMed</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8F8FC; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1E293B;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8F8FC; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" style="max-width: 600px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(139, 124, 248, 0.12); border: 1px solid #EDE9FE;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #7C5FF0 0%, #4F46E5 100%); padding: 35px 30px; text-align: center;">
              <h1 style="color: #FFFFFF; font-size: 26px; font-weight: 800; margin: 0 0 6px 0; letter-spacing: -0.5px;">ProcuraMed</h1>
              <p style="color: #EDE9FE; font-size: 13px; margin: 0; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Hospital Procurement Network</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 35px 30px;">
              <div style="display: inline-block; background-color: #EEF2FF; border: 1px solid #C7D2FE; color: #4338CA; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 20px;">
                Account Created &bull; {role_name}
              </div>

              <h2 style="font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 14px 0;">Welcome, {full_name}</h2>
              
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
                An internal user account has been created for you on the <strong>ProcuraMed Hospital Procurement Network</strong>. You can now access your assigned portal using the temporary credentials below.
              </p>

              <!-- Credentials Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 14px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 22px;">
                    <p style="margin: 0 0 14px 0; font-size: 11px; font-weight: 700; color: #6366F1; text-transform: uppercase; letter-spacing: 1px;">Your Login Credentials</p>
                    
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px;">
                      <tr>
                        <td style="padding: 6px 0; color: #64748B; font-weight: 600; width: 140px;">Employee ID:</td>
                        <td style="padding: 6px 0; color: #0F172A; font-weight: 700;">{employee_id}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748B; font-weight: 600;">Assigned Role:</td>
                        <td style="padding: 6px 0; color: #4F46E5; font-weight: 700;">{role_name}</td>
                      </tr>
                      {dept_row}
                      <tr>
                        <td style="padding: 6px 0; color: #64748B; font-weight: 600;">Username:</td>
                        <td style="padding: 6px 0; color: #0F172A; font-weight: 700; font-family: monospace; font-size: 14px;">{user.username}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0 6px 0; color: #64748B; font-weight: 600;">Temporary Password:</td>
                        <td style="padding: 8px 0 6px 0;">
                          <span style="display: inline-block; background-color: #EDE9FE; color: #5B21B6; font-family: Consolas, Monaco, monospace; font-size: 15px; font-weight: 800; padding: 4px 10px; border-radius: 6px; letter-spacing: 1px;">
                            {temporary_password}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Notice Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FFFBEB; border: 1px solid #FDE68A; border-radius: 12px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #92400E;">
                      ⚠️ Password Change Required On First Login
                    </p>
                    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #B45309;">
                      For security compliance, this temporary password will expire upon initial use. You will be prompted to set your personal permanent password immediately after signing in.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="{url}" style="display: inline-block; background: linear-gradient(135deg, #7C5FF0 0%, #4F46E5 100%); color: #FFFFFF; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 34px; border-radius: 12px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);">
                      Sign In to ProcuraMed
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 12px; color: #94A3B8; text-align: center; margin: 0;">
                If button does not work, visit: <a href="{url}" style="color: #6366F1; text-decoration: underline;">{url}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8FAFC; border-top: 1px solid #F1F5F9; padding: 22px 30px; text-align: center;">
              <p style="font-size: 11px; color: #64748B; margin: 0 0 6px 0;">
                This is an automated system notification from ProcuraMed Hospital Network.
              </p>
              <p style="font-size: 11px; color: #94A3B8; margin: 0;">
                Questions? Contact administrator at <a href="mailto:{from_email}" style="color: #6366F1;">{from_email}</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    connection, err = get_smtp_connection()
    if err:
        logger.error(f"Failed to obtain SMTP connection for credentials email: {err}")
        return False, err

    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=from_email,
            to=[recipient_email],
            connection=connection
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send(fail_silently=False)
        logger.info(f"Credentials email sent successfully to {recipient_email} for user '{user.username}'.")
        return True, None
    except Exception as exc:
        logger.error(f"Error sending credentials email to {recipient_email}: {exc}")
        return False, str(exc)
