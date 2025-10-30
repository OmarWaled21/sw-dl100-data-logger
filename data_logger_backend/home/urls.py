from django.urls import path
from .views import AddDeviceView, DataLoggerListView, DepartmentListView, DiscoveryListView, EditMasterClockView, DeviceReadingView, FirmwareUpdateView, IsRegisteredView

urlpatterns = [
    path('', DataLoggerListView.as_view(), name='data-logger-list'),
    path('departments/', DepartmentListView.as_view(), name='departments'),
    path('add/', AddDeviceView.as_view(), name='data-logger-add'),
    path("registered/<str:device_id>/", IsRegisteredView.as_view()),
    path('discover/', DiscoveryListView.as_view(), name='data-logger-discover'),
    path('edit/', EditMasterClockView.as_view(), name='data-logger-edit'),
    path('reading/', DeviceReadingView.as_view(), name='data-logger-reading'),
    path('firmware/', FirmwareUpdateView.as_view(), name='data-logger-firmware'),
    path('home/<str:device_id>/', DataLoggerListView.as_view(), name='data-logger-detail'),
]
