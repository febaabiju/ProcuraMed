from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from backend.views import secure_media_view

urlpatterns = [
    path('admin/', admin.site.urls),
    path('media/<path:path>', secure_media_view, name='secure_media'),
    path('api/media/<path:path>', secure_media_view, name='secure_media_api'),
    path('api/accounts/', include('accounts.urls')),
    path('api/vendors/', include('vendors.urls')),
    path('api/procurement/', include('procurement.urls')),
    path('api/inventory/', include('inventory.urls')),
    path('api/finance/', include('finance.urls')),
    path('api/documents/', include('documents.urls')),
    path('api/dashboard/', include('dashboard.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
