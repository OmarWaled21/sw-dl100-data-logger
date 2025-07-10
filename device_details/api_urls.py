from django.urls import path
from .api_views import * 
urlpatterns = [
    path('add-device/', add_device, name='add_device'),
    path('confirm/', confirm_device_action, name='confirm_device_action'),
    path('<str:device_id>/', api_device_details, name='api_device_details'),
    path('<str:device_id>/edit/', edit_device, name='device-edit'),
    path('<str:device_id>/delete/', delete_device_api, name='delete_device_api'),
    path('<str:device_id>/readings/', device_readings_api, name='device_readings'),
    path('<str:device_id>/averages/', device_readings_averages, name='device_readings_averages'),
    path('<str:device_id>/dashboard/', device_dashboard_data, name='device_dashoard_data'),
    path('<str:device_id>/download-pdf/', download_device_data_pdf_api, name='download_device_data_pdf_api'),
    path('<str:device_id>/toggle/', toggle_device, name='toggle-device'),
    path('<str:device_id>/control-info/', get_device_control_info,name='device_control_info'),
    path('<str:device_id>/schedule/toggle/', toggle_schedule, name='toggle_auto_schedule'),
    path('<str:device_id>/schedule/update/', update_auto_time, name='update_auto_time'),
    path('<str:device_id>/temp/settings/', get_temp_settings, name='get_temp_settings'),
    path('<str:device_id>/temp/update/', update_temp_settings, name='update_temp_settings'),
    path('<str:device_id>/schedule/refresh/', auto_control_refresh, name='auto_control_refresh'),
    path('<str:device_id>/priority/get/', get_priority_settings, name='get_priority_settings'),
    path('<str:device_id>/priority/', update_priority_settings, name='update_priority_settings'),
]