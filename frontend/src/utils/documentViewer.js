/**
 * Document Viewer Utility for ProcuraMed.
 * Provides reliable, authenticated document viewing (PDF, technical spec, quotation, certificate)
 * by fetching the file using the active JWT Bearer token into a memory Blob URL,
 * with an authenticated ?token=<jwt> fallback for blocked popups or direct tab navigation.
 */

/**
 * Safely extracts the active JWT access token from session or local storage.
 * ProcuraMed stores active tokens in sessionStorage under 'access_token'.
 */
export function getAccessToken() {
  try {
    return (
      sessionStorage.getItem('access_token') ||
      localStorage.getItem('access_token') ||
      sessionStorage.getItem('token') ||
      localStorage.getItem('token') ||
      null
    );
  } catch {
    return null;
  }
}

/**
 * Extracts the backend origin from VITE_API_BASE_URL.
 */
function getBackendOrigin() {
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8001/api';
  try {
    const parsed = new URL(apiBase);
    return parsed.origin;
  } catch {
    return window.location.origin;
  }
}

/**
 * Normalizes any relative or absolute document URL into a full target URL.
 */
export function getAbsoluteDocumentUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }
  const origin = getBackendOrigin();
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${origin}${path}`;
}

/**
 * Securely opens or downloads an authenticated document (PDF, certificate, technical spec)
 * using the user's active JWT credentials and a Blob URL.
 * Falls back to direct window opening with URL token if required.
 *
 * @param {string} url - The API endpoint or media URL for the document
 * @param {string} [fallbackFilename='document.pdf'] - Suggested filename
 * @returns {Promise<boolean>} True if opened successfully
 */
export async function openSecureDocument(url, fallbackFilename = 'document.pdf') {
  if (!url) {
    alert('Document URL is not available.');
    return false;
  }

  const token = getAccessToken();
  const fullTargetUrl = getAbsoluteDocumentUrl(url);

  // 1. Fetch document via authenticated GET (with Authorization: Bearer <token>)
  try {
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(fullTargetUrl, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const contentType = response.headers.get('content-type') || 'application/pdf';
    const cleanBlob = new Blob([blob], { type: contentType });
    const blobUrl = window.URL.createObjectURL(cleanBlob);

    const newWindow = window.open(blobUrl, '_blank');
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      // Popup blocked: create temporary link to trigger open/download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = fallbackFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    // Revoke object URL after delay
    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
    }, 60000);

    return true;
  } catch (err) {
    console.warn('Authenticated Blob fetch failed, falling back to authenticated URL with ?token parameter:', err);

    // Fallback: Append JWT token query parameter so secure_media_view or API can authenticate the tab request
    let fallbackUrl = fullTargetUrl;
    if (token) {
      const separator = fallbackUrl.includes('?') ? '&' : '?';
      fallbackUrl = `${fallbackUrl}${separator}token=${encodeURIComponent(token)}`;
    }

    window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
    return false;
  }
}
