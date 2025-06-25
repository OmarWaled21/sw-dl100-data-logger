from django.urls import path
from . import api_views  # الملف اللي وضعت فيه الأكواد السابقة

urlpatterns = [
    path('', api_views.api_get_logs, name='api_get_logs'),
    path('download/', api_views.api_download_logs_pdf, name='api_download_logs_pdf'),
    path('add-log/', api_views.create_device_log, name='create_device_log'),
]
