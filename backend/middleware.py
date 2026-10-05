"""
Middleware for ProcuraMed backend application.
"""

class NoCacheResponseMiddleware:
    """
    Ensures that all API responses include anti-caching HTTP headers,
    preventing browsers from caching authenticated data or restoring
    protected dashboard views from back-forward cache after logout.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path.startswith('/api/'):
            response['Cache-Control'] = 'no-cache, no-store, must-revalidate, max-age=0, private'
            response['Pragma'] = 'no-cache'
            response['Expires'] = '0'
        return response
