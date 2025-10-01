from django.urls import path
from .views import LogViewSet, NotificationSettingsView

# بنحدد الـ actions ونربطها بـ URLs
log_list = LogViewSet.as_view({
    'get': 'logs'
})
log_pdf = LogViewSet.as_view({
    'get': 'logs_pdf'
})
log_create = LogViewSet.as_view({
    'post': 'create_log'
})

urlpatterns = [
    path('', log_list, name='logs-list'),           # GET /logs/
    path('pdf/', log_pdf, name='logs-pdf'),         # GET /pdf/
    path('create/', log_create, name='logs-create'), # POST /create/
    path("notifications/settings/", NotificationSettingsView.as_view(), name="notification-settings"),
]
