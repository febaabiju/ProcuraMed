import axiosClient from '../api/axiosClient';

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

  // If URL is an external link not on our backend, open directly
  const isHttp = url.startsWith('http://') || url.startsWith('https://');
  const token = localStorage.getItem('token') || localStorage.getItem('access');

  try {
    // Standard relative API path or backend media path
    let requestUrl = url;
    if (isHttp) {
      // Extract pathname and search
      try {
        const parsed = new URL(url);
        requestUrl = parsed.pathname + parsed.search;
      } catch {
        requestUrl = url;
      }
    }

    const response = await axiosClient.get(requestUrl, {
      responseType: 'blob'
    });

    const contentType = response.headers['content-type'] || 'application/pdf';
    const blob = new Blob([response.data], { type: contentType });
    const blobUrl = window.URL.createObjectURL(blob);

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
    console.warn('Axios blob document fetch failed, falling back to direct URL with token:', err);

    // Fallback: Append JWT token query parameter so secure_media_view or API can authenticate
    let fallbackUrl = url;
    if (token) {
      const separator = fallbackUrl.includes('?') ? '&' : '?';
      fallbackUrl = `${fallbackUrl}${separator}token=${encodeURIComponent(token)}`;
    }

    window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
    return false;
  }
}
