from django.urls import path
from . import api_views

urlpatterns = [
    path('', api_views.api_data_logger_data, name='api_data_logger_data'),
    path('edit-server-clock/', api_views.api_edit_master_clock, name='api_edit_master_clock'),
    path('add-reading/', api_views.api_add_device_reading, name='api_add_device_reading'),
    path('update-firmware-info/', api_views.api_update_firmware_info, name='api_update_firmware_info'),
]