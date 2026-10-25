"""
Custom Storage Backend for ProcuraMed.
Supports persistent cloud file storage via Supabase Storage REST API
with local fallback and disk caching for development and resilience.
"""

import os
import mimetypes
import json
import urllib.request
import urllib.error
import urllib.parse
import logging
from django.conf import settings
from django.core.files.storage import Storage
from django.core.files.base import ContentFile, File
from django.utils.deconstruct import deconstructible

logger = logging.getLogger(__name__)


@deconstructible
class SupabaseStorage(Storage):
    """
    Storage backend that persists files to Supabase Storage REST API.
    Features:
    - Auto-detects credentials from SUPABASE_URL and SUPABASE_KEY / SUPABASE_SERVICE_ROLE_KEY.
    - Dual persistence: writes to Supabase Storage and local MEDIA_ROOT cache.
    - Resilient read fallback: reads from local disk mirror if available, else streams from Supabase.
    - Auto-provisions storage bucket if it does not exist.
    """

    def __init__(self, **kwargs):
        self.supabase_url = (
            kwargs.get('supabase_url')
            or os.environ.get('SUPABASE_URL', '')
        ).strip().rstrip('/')
        self.supabase_key = (
            kwargs.get('supabase_key')
            or os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
            or os.environ.get('SUPABASE_KEY', '')
        ).strip()
        self.bucket = (
            kwargs.get('bucket')
            or os.environ.get('SUPABASE_STORAGE_BUCKET', 'procuramed-documents')
        ).strip()
        self.media_root = getattr(settings, 'MEDIA_ROOT', None)
        self._bucket_checked = False

    @property
    def is_configured(self):
        return bool(self.supabase_url and self.supabase_key)

    def _normalize_name(self, name):
        clean = str(name).replace('\\', '/').lstrip('/')
        return clean

    def _quote_path(self, name):
        clean = self._normalize_name(name)
        return urllib.parse.quote(clean, safe='/')

    def _get_local_path(self, name):
        if not self.media_root:
            return None
        norm = self._normalize_name(name)
        return os.path.join(str(self.media_root), norm)

    def _get_headers(self, content_type=None):
        headers = {
            'Authorization': f'Bearer {self.supabase_key}',
            'apikey': self.supabase_key,
        }
        if content_type:
            headers['Content-Type'] = content_type
        return headers

    def _ensure_bucket(self):
        if self._bucket_checked or not self.is_configured:
            return
        try:
            url = f"{self.supabase_url}/storage/v1/bucket/{self.bucket}"
            req = urllib.request.Request(url, headers=self._get_headers(), method='GET')
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status == 200:
                    self._bucket_checked = True
                    return
        except urllib.error.HTTPError as e:
            if e.code == 404:
                # Create bucket
                try:
                    create_url = f"{self.supabase_url}/storage/v1/bucket"
                    payload = json.dumps({
                        'id': self.bucket,
                        'name': self.bucket,
                        'public': False
                    }).encode('utf-8')
                    headers = self._get_headers(content_type='application/json')
                    req = urllib.request.Request(create_url, data=payload, headers=headers, method='POST')
                    with urllib.request.urlopen(req, timeout=5) as c_resp:
                        if c_resp.status in (200, 201):
                            self._bucket_checked = True
                except Exception as create_err:
                    logger.warning("Could not auto-create Supabase bucket: %s", create_err)
            else:
                logger.warning("Supabase bucket check error %s: %s", e.code, e)
        except Exception as err:
            logger.warning("Supabase bucket connectivity check failed: %s", err)

    def _save(self, name, content):
        norm_name = self._normalize_name(name)
        content_type = getattr(content, 'content_type', None)
        if not content_type:
            content_type, _ = mimetypes.guess_type(norm_name)
        if not content_type:
            content_type = 'application/octet-stream'

        # Read content bytes
        if hasattr(content, 'chunks'):
            file_bytes = b''.join(chunk for chunk in content.chunks())
        elif hasattr(content, 'read'):
            content.seek(0)
            file_bytes = content.read()
            if isinstance(file_bytes, str):
                file_bytes = file_bytes.encode('utf-8')
        else:
            file_bytes = bytes(content)

        # 1. Save to local disk mirror for immediate fast access
        local_path = self._get_local_path(norm_name)
        if local_path:
            try:
                os.makedirs(os.path.dirname(local_path), exist_ok=True)
                with open(local_path, 'wb') as lf:
                    lf.write(file_bytes)
            except Exception as e:
                logger.warning("Failed to save local mirror file %s: %s", local_path, e)

        # 2. Upload to Supabase Storage if configured
        if self.is_configured:
            self._ensure_bucket()
            upload_url = f"{self.supabase_url}/storage/v1/object/{self.bucket}/{self._quote_path(norm_name)}"
            headers = self._get_headers(content_type=content_type)
            headers['x-upsert'] = 'true'
            try:
                req = urllib.request.Request(upload_url, data=file_bytes, headers=headers, method='POST')
                with urllib.request.urlopen(req, timeout=15) as resp:
                    if resp.status not in (200, 201):
                        logger.warning("Supabase upload returned status %s", resp.status)
            except Exception as e:
                logger.error("Failed to upload %s to Supabase Storage: %s", norm_name, e)

        return norm_name

    def _open(self, name, mode='rb'):
        norm_name = self._normalize_name(name)
        local_path = self._get_local_path(norm_name)

        # Check local cache first
        if local_path and os.path.exists(local_path) and os.path.getsize(local_path) > 0:
            return File(open(local_path, mode))

        # Attempt download from Supabase Storage
        if self.is_configured:
            download_url = f"{self.supabase_url}/storage/v1/object/authenticated/{self.bucket}/{self._quote_path(norm_name)}"
            headers = self._get_headers()
            try:
                req = urllib.request.Request(download_url, headers=headers, method='GET')
                with urllib.request.urlopen(req, timeout=15) as resp:
                    if resp.status == 200:
                        data = resp.read()
                        # Cache locally
                        if local_path:
                            try:
                                os.makedirs(os.path.dirname(local_path), exist_ok=True)
                                with open(local_path, 'wb') as lf:
                                    lf.write(data)
                            except Exception:
                                pass
                        return ContentFile(data, name=norm_name)
            except Exception as e:
                logger.warning("Failed to download %s from Supabase Storage: %s", norm_name, e)

        if local_path and os.path.exists(local_path):
            return File(open(local_path, mode))

        raise FileNotFoundError(f"File '{norm_name}' does not exist on storage or local disk.")

    def exists(self, name):
        norm_name = self._normalize_name(name)
        local_path = self._get_local_path(norm_name)
        if local_path and os.path.exists(local_path) and os.path.getsize(local_path) > 0:
            return True

        if self.is_configured:
            # Check info on Supabase
            info_url = f"{self.supabase_url}/storage/v1/object/info/authenticated/{self.bucket}/{self._quote_path(norm_name)}"
            headers = self._get_headers()
            try:
                req = urllib.request.Request(info_url, headers=headers, method='GET')
                with urllib.request.urlopen(req, timeout=5) as resp:
                    return resp.status == 200
            except Exception:
                # Try range get
                try:
                    dl_url = f"{self.supabase_url}/storage/v1/object/authenticated/{self.bucket}/{self._quote_path(norm_name)}"
                    h = self._get_headers()
                    h['Range'] = 'bytes=0-0'
                    req = urllib.request.Request(dl_url, headers=h, method='GET')
                    with urllib.request.urlopen(req, timeout=5) as resp:
                        return resp.status in (200, 206)
                except Exception:
                    return False

        return False

    def url(self, name):
        norm_name = self._normalize_name(name)
        media_url = getattr(settings, 'MEDIA_URL', '/media/')
        if not media_url.endswith('/'):
            media_url += '/'
        return f"{media_url}{norm_name}"

    def size(self, name):
        norm_name = self._normalize_name(name)
        local_path = self._get_local_path(norm_name)
        if local_path and os.path.exists(local_path):
            return os.path.getsize(local_path)
        return 0

    def delete(self, name):
        norm_name = self._normalize_name(name)
        local_path = self._get_local_path(norm_name)
        if local_path and os.path.exists(local_path):
            try:
                os.remove(local_path)
            except Exception:
                pass

        if self.is_configured:
            del_url = f"{self.supabase_url}/storage/v1/object/{self.bucket}"
            payload = json.dumps({'prefixes': [norm_name]}).encode('utf-8')
            headers = self._get_headers(content_type='application/json')
            try:
                req = urllib.request.Request(del_url, data=payload, headers=headers, method='DELETE')
                with urllib.request.urlopen(req, timeout=5) as resp:
                    pass
            except Exception as e:
                logger.warning("Failed to delete %s on Supabase: %s", norm_name, e)
