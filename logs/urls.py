from django.urls import path
from . import views

urlpatterns = [
    path('', views.logs_view, name='logs_view'),
    path('download-pdf/', views.download_logs_pdf, name='download_logs_pdf'),
]
