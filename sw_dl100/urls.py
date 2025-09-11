from django.contrib import admin
from django.urls import path, include
from django.conf.urls.static import static
from sw_dl100 import settings

urlpatterns = [
    # i18n
    path('i18n/', include('django.conf.urls.i18n')),
    # admin
    path('admin/', admin.site.urls),
    path('', include('data_logger.urls')),
    path('auth/', include('authentication.urls')),
    path('users/', include('users.urls')),
    path('logs/', include('logs.urls')),
    path('device/', include('device_details.urls')),
    # API
    path('api/', include('data_logger.api_urls')),
    path('api/auth/', include('authentication.api_urls')),
    path('api/users/', include('users.api_urls')),
    path('api/logs/', include('logs.api_urls')),
    path('api/device/', include('device_details.api_urls')),
]

# Add media route (only in development)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)