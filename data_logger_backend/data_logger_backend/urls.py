from django.contrib import admin
from django.urls import path, include
from django.conf.urls.static import static
from data_logger_backend import settings

urlpatterns = [
    # i18n
    path('i18n/', include('django.conf.urls.i18n')),
    # admin
    path('admin/', admin.site.urls),
    path('', include('home.urls')),
    path('auth/', include('authentication.urls')),
    path('device/', include('device_details.urls')),
    path('logs/', include('logs.urls')),
    path('users/', include('users.urls')),
]

# Add media route (only in development)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)