from django.contrib import admin
from django.urls import path, include
from django.conf.urls.static import static
from data_logger_backend import settings

urlpatterns = [
    # admin
    path('admin/', admin.site.urls),
    path('', include('home.urls')),
    path('auth/', include('authentication.urls')),
    path('device/', include('device_details.urls')),
    path('logs/', include('logs.urls')),
    path('users/', include('users.urls')),
]