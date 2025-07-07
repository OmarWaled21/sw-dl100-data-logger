from django.urls import path
from . import views

urlpatterns = [
    path('<str:device_id>/', views.device_details, name='device_details'),
    path('<str:device_id>/delete/', views.delete_device, name='delete_device'),
    path('<str:device_id>/download-pdf/', views.download_device_data_pdf, name='download_device_data_pdf'),    
]