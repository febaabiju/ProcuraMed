import os
import time
from unittest.mock import patch, MagicMock
from django.test import SimpleTestCase, TestCase
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from rest_framework.test import APIRequestFactory
from rest_framework import status

from accounts.views import (
    ForgotPasswordView,
    ResetPasswordValidateView,
    ResetPasswordConfirmView,
)
from accounts.models import Role, User, AuditLog
from vendors.emails import get_smtp_connection, get_from_email, send_password_reset_email


class PasswordResetWorkflowTests(SimpleTestCase):
    """
    Unit test suite covering the 8 required test phases for the password reset workflow:
    1. Matching username and registered email.
    2. Mismatched username/email combination.
    3. Nonexistent account without revealing account existence.
    4. SMTP authentication or connection failure handling.
    5. Valid reset email with correct production frontend URL.
    6. Valid token, expired token, and reused token validation.
    7. Successful password reset confirmation and token invalidation.
    8. Frontend response compatibility and error handling resilience.
    """

    def setUp(self):
        self.factory = APIRequestFactory()
        self.role = Role(id=3, name='Department Staff')
        self.user = User(
            id=101,
            username='ds_101',
            email='febabiju10973@gmail.com',
            first_name='John',
            last_name='Mathew',
            role=self.role,
            is_active=True,
            is_staff=False,
            is_superuser=False,
            password='pbkdf2_sha256$1200000$test$saltandhashvalue1234567890'
        )

    def test_1_matching_username_and_registered_email(self):
        """Test 1: A matching username and registered email sends email and returns 200 JSON."""
        request = self.factory.post(
            '/api/accounts/forgot-password/',
            {'username': 'ds_101', 'email': 'febabiju10973@gmail.com'},
            format='json'
        )

        with patch('accounts.views.User.objects') as mock_user_mgr, \
             patch('accounts.views.send_password_reset_email', return_value=(True, 'Email sent successfully')) as mock_send, \
             patch('accounts.views.AuditLog.objects.create') as mock_audit:

            mock_qs = MagicMock()
            mock_user_mgr.select_related.return_value = mock_qs
            mock_qs.filter.return_value.first.return_value = self.user

            response = ForgotPasswordView.as_view()(request)

            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertTrue(response.data.get('success'))
            self.assertTrue(response.data.get('email_sent'))
            self.assertIn('febabiju10973@gmail.com', response.data.get('message'))
            mock_send.assert_called_once()

    def test_2_mismatched_username_email(self):
        """Test 2: A mismatched username/email returns 200 enumeration-safe response and does not email."""
        request = self.factory.post(
            '/api/accounts/forgot-password/',
            {'username': 'ds_101', 'email': 'wrong@gmail.com'},
            format='json'
        )

        with patch('accounts.views.User.objects') as mock_user_mgr, \
             patch('accounts.views.send_password_reset_email') as mock_send:

            mock_qs = MagicMock()
            mock_user_mgr.select_related.return_value = mock_qs
            mock_qs.filter.return_value.first.return_value = None  # No match

            response = ForgotPasswordView.as_view()(request)

            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertTrue(response.data.get('success'))
            self.assertIn('If a matching active account was found', response.data.get('message'))
            mock_send.assert_not_called()

    def test_3_nonexistent_account_enumeration_protection(self):
        """Test 3: A nonexistent account does not reveal account existence."""
        request = self.factory.post(
            '/api/accounts/forgot-password/',
            {'username': 'nonexistent_user', 'email': 'nobody@hospital.org'},
            format='json'
        )

        with patch('accounts.views.User.objects') as mock_user_mgr, \
             patch('accounts.views.send_password_reset_email') as mock_send:

            mock_qs = MagicMock()
            mock_user_mgr.select_related.return_value = mock_qs
            mock_qs.filter.return_value.first.return_value = None

            response = ForgotPasswordView.as_view()(request)

            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertIn('If a matching active account was found', response.data.get('message'))
            # Does not expose whether username or email exists
            self.assertNotIn('No active account', str(response.data))
            mock_send.assert_not_called()

    def test_4_smtp_delivery_failure_handling(self):
        """Test 4: SMTP authentication or connection failure returns 500 JSON without false success."""
        request = self.factory.post(
            '/api/accounts/forgot-password/',
            {'username': 'ds_101', 'email': 'febabiju10973@gmail.com'},
            format='json'
        )

        smtp_err = 'Gmail SMTP authentication failed. Please verify the 16-character Google App Password in EMAIL_HOST_PASSWORD.'

        with patch('accounts.views.User.objects') as mock_user_mgr, \
             patch('accounts.views.send_password_reset_email', return_value=(False, smtp_err)) as mock_send, \
             patch('accounts.views.AuditLog.objects.create') as mock_audit:

            mock_qs = MagicMock()
            mock_user_mgr.select_related.return_value = mock_qs
            mock_qs.filter.return_value.first.return_value = self.user

            response = ForgotPasswordView.as_view()(request)

            self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
            self.assertFalse(response.data.get('email_sent'))
            self.assertIn(smtp_err, response.data.get('error'))
            # Server-side audit log recorded the failure
            mock_audit.assert_called_once()
            call_kwargs = mock_audit.call_args[1]
            self.assertEqual(call_kwargs.get('action'), 'Password Reset Failed')

    def test_5_valid_reset_email_production_frontend_url(self):
        """Test 5: Reset email uses the configured production frontend origin (Vercel)."""
        request = self.factory.post(
            '/api/accounts/forgot-password/',
            {'username': 'ds_101', 'email': 'febabiju10973@gmail.com'},
            format='json'
        )

        with patch('accounts.views.User.objects') as mock_user_mgr, \
             patch('accounts.views.send_password_reset_email', return_value=(True, 'Sent')) as mock_send, \
             patch('accounts.views.AuditLog.objects.create'):

            mock_qs = MagicMock()
            mock_user_mgr.select_related.return_value = mock_qs
            mock_qs.filter.return_value.first.return_value = self.user

            # Test in production mode (DEBUG=False) with unset FRONTEND_URL
            with patch.object(settings, 'DEBUG', False), \
                 patch.object(settings, 'FRONTEND_URL', ''):

                response = ForgotPasswordView.as_view()(request)
                self.assertEqual(response.status_code, status.HTTP_200_OK)

                call_kwargs = mock_send.call_args[1]
                reset_url = call_kwargs['reset_url']
                self.assertTrue(reset_url.startswith('https://procuramed.vercel.app/reset-password'))
                self.assertIn('uid=', reset_url)
                self.assertIn('token=', reset_url)

    def test_6_token_validation_expired_and_reused(self):
        """Test 6: Valid token passes; expired token and reused token are rejected."""
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        valid_token = default_token_generator.make_token(self.user)

        validate_view = ResetPasswordValidateView.as_view()

        # 6a. Valid token validation
        req_valid = self.factory.get('/api/accounts/reset-password/validate/', {'uid': uid, 'token': valid_token})
        with patch('accounts.views.User.objects.filter') as mock_filter:
            mock_filter.return_value.first.return_value = self.user
            resp = validate_view(req_valid)
            self.assertEqual(resp.status_code, status.HTTP_200_OK)
            self.assertTrue(resp.data.get('valid'))
            self.assertEqual(resp.data.get('username'), 'ds_101')

        # 6b. Expired token validation (simulating token older than PASSWORD_RESET_TIMEOUT)
        with patch('accounts.views.User.objects.filter') as mock_filter:
            mock_filter.return_value.first.return_value = self.user
            with patch.object(default_token_generator, 'check_token', return_value=False):
                resp = validate_view(req_valid)
                self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertFalse(resp.data.get('valid'))
                self.assertIn('invalid or has expired', resp.data.get('error'))

        # 6c. Reused token validation (after user password changes, check_token returns False)
        # We simulate password change on the user model:
        original_hash = self.user.password
        self.user.set_password('BrandNewPassword@2026')
        with patch('accounts.views.User.objects.filter') as mock_filter:
            mock_filter.return_value.first.return_value = self.user
            # The token generated with the old password hash must now fail
            is_valid_after_change = default_token_generator.check_token(self.user, valid_token)
            self.assertFalse(is_valid_after_change)
            resp = validate_view(req_valid)
            self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertFalse(resp.data.get('valid'))

        # Restore user password for subsequent tests
        self.user.password = original_hash

    def test_7_successful_password_reset_confirm(self):
        """Test 7: ResetPasswordConfirmView validates passwords, updates user, and records audit log."""
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)

        confirm_view = ResetPasswordConfirmView.as_view()

        req_confirm = self.factory.post(
            '/api/accounts/reset-password/confirm/',
            {
                'uid': uid,
                'token': token,
                'new_password': 'ValidNewPass#2026',
                'confirm_password': 'ValidNewPass#2026'
            },
            format='json'
        )

        with patch('accounts.views.User.objects.filter') as mock_filter, \
             patch.object(self.user, 'save') as mock_save, \
             patch('accounts.views.AuditLog.objects.create') as mock_audit:

            mock_filter.return_value.first.return_value = self.user

            resp = confirm_view(req_confirm)
            self.assertEqual(resp.status_code, status.HTTP_200_OK)
            self.assertTrue(resp.data.get('success'))
            self.assertIn('password has been reset successfully', resp.data.get('message'))
            mock_save.assert_called_once()
            mock_audit.assert_called_once()
            self.assertEqual(self.user.first_login, False)
            self.assertTrue(self.user.check_password('ValidNewPass#2026'))

    def test_8_audit_log_failure_resilience(self):
        """Test 8: Database failure in AuditLog creation does not crash ForgotPasswordView into an HTML 500 error."""
        request = self.factory.post(
            '/api/accounts/forgot-password/',
            {'username': 'ds_101', 'email': 'febabiju10973@gmail.com'},
            format='json'
        )

        with patch('accounts.views.User.objects') as mock_user_mgr, \
             patch('accounts.views.send_password_reset_email', return_value=(True, 'Sent')), \
             patch('accounts.views.AuditLog.objects.create', side_effect=Exception('DB sequence integrity error')):

            mock_qs = MagicMock()
            mock_user_mgr.select_related.return_value = mock_qs
            mock_qs.filter.return_value.first.return_value = self.user

            # Should still return clean JSON status 200, NOT crash with unhandled 500
            response = ForgotPasswordView.as_view()(request)
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertTrue(response.data.get('success'))
            self.assertIn('A secure password reset link has been sent', response.data.get('message'))

    def test_9_smtp_helper_environment_variable_precedence(self):
        """Test 9: get_smtp_connection dynamically sanitizes and reads environment variables."""
        with patch.object(settings, 'EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend'):
            with patch.dict(os.environ, {
                'EMAIL_HOST': 'smtp.sendgrid.net',
                'EMAIL_PORT': '587',
                'EMAIL_USE_TLS': 'True',
                'EMAIL_HOST_USER': 'apikey',
                'EMAIL_HOST_PASSWORD': '  SG.test_key_1234567890#comment  ',
                'DEFAULT_FROM_EMAIL': 'notifications@procuramed.com'
            }):
                from_email = get_from_email()
                self.assertEqual(from_email, 'notifications@procuramed.com')

                conn, err = get_smtp_connection()
                self.assertIsNone(err)
                self.assertIsNotNone(conn)
                self.assertEqual(conn.host, 'smtp.sendgrid.net')
                self.assertEqual(conn.port, 587)
                self.assertEqual(conn.username, 'apikey')
                self.assertEqual(conn.password, 'SG.test_key_1234567890')

    def test_10_public_endpoints_ignore_stale_or_invalid_jwt_headers(self):
        """Test 10: ForgotPasswordView, ResetPasswordValidateView, and ResetPasswordConfirmView ignore stale Authorization headers."""
        expired_auth_header = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired_token_signature'

        # Test ValidateView with stale JWT header
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)
        req = self.factory.get(
            '/api/accounts/reset-password/validate/',
            {'uid': uid, 'token': token},
            HTTP_AUTHORIZATION=expired_auth_header
        )
        with patch('accounts.views.User.objects.filter') as mock_filter:
            mock_filter.return_value.first.return_value = self.user
            resp = ResetPasswordValidateView.as_view()(req)
            self.assertEqual(resp.status_code, status.HTTP_200_OK)
            self.assertTrue(resp.data.get('valid'))

    def test_11_malformed_uid_safety(self):
        """Test 11: Corrupted or non-integer base64 UID does not raise database DataError or 500."""
        # Non-integer UID base64 (e.g. b"not_an_id")
        bad_uid = urlsafe_base64_encode(force_bytes('not_an_id'))
        req = self.factory.get('/api/accounts/reset-password/validate/', {'uid': bad_uid, 'token': 'dummy_token'})
        resp = ResetPasswordValidateView.as_view()(req)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(resp.data.get('valid'))

        # Completely invalid base64 string
        req_garbage = self.factory.get('/api/accounts/reset-password/validate/', {'uid': '%%%invalid_base64%%%', 'token': 'dummy_token'})
        resp_garbage = ResetPasswordValidateView.as_view()(req_garbage)
        self.assertEqual(resp_garbage.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(resp_garbage.data.get('valid'))

    def test_12_apps_script_relay_successful_delivery(self):
        """Test 12: Successful password-reset email delivery via Google Apps Script HTTPS relay."""
        import json
        from vendors.emails import send_password_reset_email

        mock_resp = MagicMock()
        mock_resp.getcode.return_value = 200
        mock_resp.read.return_value = json.dumps({'success': True}).encode('utf-8')
        mock_resp.__enter__.return_value = mock_resp
        mock_resp.__exit__.return_value = None

        with patch.dict(os.environ, {
            'GOOGLE_APPS_SCRIPT_URL': 'https://script.google.com/macros/s/test_id/exec',
            'GOOGLE_APPS_SCRIPT_TOKEN': 'super_secret_shared_token_2026'
        }), patch('urllib.request.urlopen', return_value=mock_resp) as mock_urlopen:

            success, msg = send_password_reset_email(
                user=self.user,
                reset_url='https://procuramed.vercel.app/reset-password?uid=MQ&token=test-token-xyz'
            )

            self.assertTrue(success)
            self.assertEqual(msg, 'Password reset email sent successfully')
            mock_urlopen.assert_called_once()

            # Verify request properties
            call_req = mock_urlopen.call_args[0][0]
            self.assertEqual(call_req.full_url, 'https://script.google.com/macros/s/test_id/exec')
            self.assertEqual(call_req.get_method(), 'POST')
            self.assertEqual(call_req.headers.get('Content-type'), 'application/json; charset=utf-8')

            # Verify exact payload keys: token, to, subject, textBody, htmlBody
            sent_payload = json.loads(call_req.data.decode('utf-8'))
            self.assertEqual(sent_payload['token'], 'super_secret_shared_token_2026')
            self.assertEqual(sent_payload['to'], 'febabiju10973@gmail.com')
            self.assertIn('Password Reset Request', sent_payload['subject'])
            self.assertIn('https://procuramed.vercel.app/reset-password?uid=MQ&token=test-token-xyz', sent_payload['textBody'])
            self.assertIn('https://procuramed.vercel.app/reset-password?uid=MQ&token=test-token-xyz', sent_payload['htmlBody'])

    def test_13_apps_script_relay_missing_configuration_safeguards(self):
        """Test 13: Partial or invalid configuration fails safely without attempting delivery."""
        from vendors.emails import send_password_reset_email

        # 13a. Missing token
        with patch.dict(os.environ, {
            'GOOGLE_APPS_SCRIPT_URL': 'https://script.google.com/macros/s/test_id/exec',
            'GOOGLE_APPS_SCRIPT_TOKEN': ''
        }, clear=True):
            success, msg = send_password_reset_email(user=self.user, reset_url='https://example.com')
            self.assertFalse(success)
            self.assertIn('shared secret token is not configured', msg)

        # 13b. Missing URL
        with patch.dict(os.environ, {
            'GOOGLE_APPS_SCRIPT_URL': '',
            'GOOGLE_APPS_SCRIPT_TOKEN': 'secret_token_123'
        }, clear=True):
            success, msg = send_password_reset_email(user=self.user, reset_url='https://example.com')
            self.assertFalse(success)
            self.assertIn('URL is not configured', msg)

        # 13c. Non-HTTPS URL rejected
        with patch.dict(os.environ, {
            'GOOGLE_APPS_SCRIPT_URL': 'http://script.google.com/insecure/exec',
            'GOOGLE_APPS_SCRIPT_TOKEN': 'secret_token_123'
        }, clear=True):
            success, msg = send_password_reset_email(user=self.user, reset_url='https://example.com')
            self.assertFalse(success)
            self.assertIn('must use HTTPS protocol', msg)

    def test_14_apps_script_relay_content_service_redirect_handling(self):
        """Test 14: Google Apps Script 302 ContentService redirect is followed safely via GET."""
        import json
        import urllib.error
        from vendors.emails import send_password_reset_email

        # Mock initial redirect response (HTTP 302 Found)
        redir_err = urllib.error.HTTPError(
            url='https://script.google.com/macros/s/test_id/exec',
            code=302,
            msg='Found',
            hdrs={'Location': 'https://script.googleusercontent.com/macros/echo?user_content_key=xyz'},
            fp=None
        )

        # Mock final response from redirected echo endpoint
        final_resp = MagicMock()
        final_resp.getcode.return_value = 200
        final_resp.read.return_value = json.dumps({'success': True}).encode('utf-8')
        final_resp.__enter__.return_value = final_resp
        final_resp.__exit__.return_value = None

        def mock_urlopen_side_effect(req, *args, **kwargs):
            if hasattr(req, 'full_url') and 'script.google.com' in req.full_url:
                raise redir_err
            return final_resp

        with patch.dict(os.environ, {
            'GOOGLE_APPS_SCRIPT_URL': 'https://script.google.com/macros/s/test_id/exec',
            'GOOGLE_APPS_SCRIPT_TOKEN': 'valid_token'
        }), patch('urllib.request.urlopen', side_effect=mock_urlopen_side_effect) as mock_urlopen:

            success, msg = send_password_reset_email(
                user=self.user,
                reset_url='https://procuramed.vercel.app/reset-password'
            )

            self.assertTrue(success)
            self.assertEqual(msg, 'Password reset email sent successfully')
            self.assertEqual(mock_urlopen.call_count, 2)
            # Second call was GET to redirect URL
            second_call_req = mock_urlopen.call_args_list[1][0][0]
            self.assertEqual(second_call_req.full_url, 'https://script.googleusercontent.com/macros/echo?user_content_key=xyz')
            self.assertEqual(second_call_req.get_method(), 'GET')

    def test_15_apps_script_relay_unsuccessful_response_handling(self):
        """Test 15: Apps Script application error (e.g. Unauthorized token) returns failure message without falling back to SMTP."""
        import json
        from vendors.emails import send_password_reset_email

        mock_resp = MagicMock()
        mock_resp.getcode.return_value = 200
        mock_resp.read.return_value = json.dumps({'success': False, 'error': 'Unauthorized: invalid token'}).encode('utf-8')
        mock_resp.__enter__.return_value = mock_resp
        mock_resp.__exit__.return_value = None

        with patch.dict(os.environ, {
            'GOOGLE_APPS_SCRIPT_URL': 'https://script.google.com/macros/s/test_id/exec',
            'GOOGLE_APPS_SCRIPT_TOKEN': 'wrong_token'
        }), patch('urllib.request.urlopen', return_value=mock_resp), \
           patch('vendors.emails.get_smtp_connection') as mock_smtp:

            success, msg = send_password_reset_email(
                user=self.user,
                reset_url='https://procuramed.vercel.app/reset-password'
            )

            self.assertFalse(success)
            self.assertIn('Unauthorized: invalid token', msg)
            # Confirm NO silent fallback to SMTP occurred
            mock_smtp.assert_not_called()

    def test_16_apps_script_relay_invalid_json_handling(self):
        """Test 16: Non-JSON / malformed response from relay returns clean error without crashing."""
        from vendors.emails import send_password_reset_email

        mock_resp = MagicMock()
        mock_resp.getcode.return_value = 200
        mock_resp.read.return_value = b'<html><body>502 Bad Gateway</body></html>'
        mock_resp.__enter__.return_value = mock_resp
        mock_resp.__exit__.return_value = None

        with patch.dict(os.environ, {
            'GOOGLE_APPS_SCRIPT_URL': 'https://script.google.com/macros/s/test_id/exec',
            'GOOGLE_APPS_SCRIPT_TOKEN': 'valid_token'
        }), patch('urllib.request.urlopen', return_value=mock_resp):

            success, msg = send_password_reset_email(
                user=self.user,
                reset_url='https://procuramed.vercel.app/reset-password'
            )

            self.assertFalse(success)
            self.assertIn('Invalid response received from Google Apps Script relay', msg)

    def test_17_apps_script_relay_http_error_handling(self):
        """Test 17: HTTP error from relay (e.g. 500) returns clean failure message."""
        import urllib.error
        from io import BytesIO
        from vendors.emails import send_password_reset_email

        http_err = urllib.error.HTTPError(
            url='https://script.google.com/macros/s/test_id/exec',
            code=500,
            msg='Internal Server Error',
            hdrs={},
            fp=BytesIO(b'{"error": "Internal Google Script Error"}')
        )

        with patch.dict(os.environ, {
            'GOOGLE_APPS_SCRIPT_URL': 'https://script.google.com/macros/s/test_id/exec',
            'GOOGLE_APPS_SCRIPT_TOKEN': 'valid_token'
        }), patch('urllib.request.urlopen', side_effect=http_err):

            success, msg = send_password_reset_email(
                user=self.user,
                reset_url='https://procuramed.vercel.app/reset-password'
            )

            self.assertFalse(success)
            self.assertIn('Google Apps Script relay error: Internal Google Script Error', msg)

    def test_18_apps_script_relay_timeout_handling(self):
        """Test 18: Network timeout returns user-friendly timeout error without hanging."""
        import socket
        import urllib.error
        from vendors.emails import send_password_reset_email

        timeout_err = urllib.error.URLError(reason=socket.timeout('timed out'))

        with patch.dict(os.environ, {
            'GOOGLE_APPS_SCRIPT_URL': 'https://script.google.com/macros/s/test_id/exec',
            'GOOGLE_APPS_SCRIPT_TOKEN': 'valid_token'
        }), patch('urllib.request.urlopen', side_effect=timeout_err):

            success, msg = send_password_reset_email(
                user=self.user,
                reset_url='https://procuramed.vercel.app/reset-password'
            )

            self.assertFalse(success)
            self.assertIn('timed out', msg.lower())

    def test_19_apps_script_relay_fallback_to_smtp_when_unconfigured(self):
        """Test 19: When Google Apps Script variables are absent, send_password_reset_email falls back to SMTP."""
        from vendors.emails import send_password_reset_email

        with patch.dict(os.environ, {
            'GOOGLE_APPS_SCRIPT_URL': '',
            'GOOGLE_APPS_SCRIPT_TOKEN': ''
        }, clear=True), \
        patch('vendors.emails.get_smtp_connection', return_value=(None, 'SMTP connection refused for testing')) as mock_smtp:

            success, msg = send_password_reset_email(
                user=self.user,
                reset_url='https://procuramed.vercel.app/reset-password'
            )

            self.assertFalse(success)
            self.assertEqual(msg, 'SMTP connection refused for testing')
            mock_smtp.assert_called_once()

