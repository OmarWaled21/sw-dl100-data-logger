from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    # admin
    path('admin/', admin.site.urls),
    path('', include('home.urls')),
    path('auth/', include('authentication.urls')),
    path('device/', include('device_details.urls')),
    path('logs/', include('logs.urls')),
    path('users/', include('users.urls')),
    path('updates/', include('updates.urls')),
]