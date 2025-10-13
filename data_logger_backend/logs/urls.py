from django.urls import path
from .views import LogViewSet, MarkLogsReadView, NotificationTreeView, NotificationSettingsView, UnreadCountView

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


urlpatterns = [
    path('device/', device_logs, name='device-logs'),        # GET /logs/device/
    path('admin/', admin_logs, name='admin-logs'),           # GET /logs/admin/
    path('latest_log/', latest_log, name='latest-log'),      # GET /pdf/
    path('create/', log_create, name='logs-create'),         # POST /create/
    path("unread/", UnreadCountView.as_view(), name="unread_logs"),
    path("read/", MarkLogsReadView.as_view(), name="mark_logs_read"),
    path("notifications/settings/", NotificationSettingsView.as_view(), name="notification-settings"),
    path("notifications/tree/", NotificationTreeView.as_view(), name="notification-tree"),
]
