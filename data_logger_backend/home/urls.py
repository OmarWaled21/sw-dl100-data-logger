from django.urls import path
from .views import DataLoggerListView, EditMasterClockView, DeviceReadingView, FirmwareUpdateView

urlpatterns = [
    path('', DataLoggerListView.as_view(), name='data-logger-list'),
    path('edit/', EditMasterClockView.as_view(), name='data-logger-edit'),
    path('reading/', DeviceReadingView.as_view(), name='data-logger-reading'),
    path('firmware/', FirmwareUpdateView.as_view(), name='data-logger-firmware'),
]
