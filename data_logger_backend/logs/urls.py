from django.urls import path
from .views import LogViewSet, NotificationSettingsView

# بنحدد الـ actions ونربطها بـ URLs
log_list = LogViewSet.as_view({
    'get': 'logs'
})
latest_log = LogViewSet.as_view({
    'get': 'latest_local'
})
log_create = LogViewSet.as_view({
    'post': 'create_log'
})

urlpatterns = [
    path('', log_list, name='logs-list'),           # GET /logs/
    path('latest_log/', latest_log, name='latest-log'),         # GET /pdf/
    path('create/', log_create, name='logs-create'), # POST /create/
    path("notifications/settings/", NotificationSettingsView.as_view(), name="notification-settings"),
]
