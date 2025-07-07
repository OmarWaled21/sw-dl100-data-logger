from django.urls import path
from .api_views import * 
urlpatterns = [
    path('add-device/', add_device, name='add_device'),
    path('<str:device_id>/', api_device_details, name='api_device_details'),
    path('<str:device_id>/edit/', edit_device, name='device-edit'),
    path('<str:device_id>/delete/', delete_device_api, name='delete_device_api'),
    path('<str:device_id>/readings/', device_readings_api, name='device_readings'),
    path('<str:device_id>/averages/', device_readings_averages, name='device_readings_averages'),
    path('<str:device_id>/dashboard/', device_dashboard_data, name='device_dashoard_data'),
    path('<str:device_id>/download-pdf/', download_device_data_pdf_api, name='download_device_data_pdf_api'),
    path('<str:device_id>/toggle/', toggle_device, name='toggle-device'),
]