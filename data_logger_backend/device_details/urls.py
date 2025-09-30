from django.urls import path
from .views import DeviceAPIView

urlpatterns = [
    path('', DeviceAPIView.as_view(), name='add-device'),
    path('<str:device_id>/', DeviceAPIView.as_view(), name='device-details'),
    path('<str:device_id>/averages/', DeviceAPIView.as_view(), name='device-averages'),
    path('<str:device_id>/readings/', DeviceAPIView.as_view(), name='device-readings'),
    path('<str:device_id>/dashboard/', DeviceAPIView.as_view(), name='device-dashboard'),
    path('<str:device_id>/download/', DeviceAPIView.as_view(), name='download-pdf'),
    path('<str:device_id>/auto-control/', DeviceAPIView.as_view(), name='auto-control'),
    path('<str:device_id>/toggle/', DeviceAPIView.as_view(), name='toggle-device'),
    path('<str:device_id>/control-info/', DeviceAPIView.as_view(), name='control-info'),
    path('<str:device_id>/toggle-schedule/', DeviceAPIView.as_view(), name='toggle-schedule'),
    path('<str:device_id>/update-auto-time/', DeviceAPIView.as_view(), name='update-auto-time'),
    path('<str:device_id>/temp-settings/', DeviceAPIView.as_view(), name='temp-settings'),
    path('<str:device_id>/update-temp-settings/', DeviceAPIView.as_view(), name='update-temp-settings'),
    path('<str:device_id>/priority-settings/', DeviceAPIView.as_view(), name='priority-settings'),
    path('<str:device_id>/update-priority-settings/', DeviceAPIView.as_view(), name='update-priority-settings'),
    path('confirm-action/', DeviceAPIView.as_view(), name='confirm-action'),
]