from django.urls import path
from .views import LogViewSet, NotificationSettingsView

# بنحدد الـ actions ونربطها بـ URLs
device_logs = LogViewSet.as_view({
    'get': 'device_logs'
})
admin_logs = LogViewSet.as_view({
    'get': 'admin_logs'
})
latest_log = LogViewSet.as_view({
    'get': 'latest_local'
})
log_create = LogViewSet.as_view({
    'post': 'create_log'
})
log_read = LogViewSet.as_view({
    'post': 'mark_read'
})

urlpatterns = [
    path('device/', device_logs, name='device-logs'),        # GET /logs/device/
    path('admin/', admin_logs, name='admin-logs'),           # GET /logs/admin/
    path('latest_log/', latest_log, name='latest-log'),      # GET /pdf/
    path('create/', log_create, name='logs-create'),         # POST /create/
    path('mark-read/', log_read, name='logs-read'),        # POST /read/
    path("notifications/settings/", NotificationSettingsView.as_view(), name="notification-settings"),
]
