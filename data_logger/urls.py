from django.urls import path
from . import views

urlpatterns = [
    path('', views.data_logger, name='data_logger'),
    path('master/update-time/', views.edit_master_clock, name='edit_master_clock'),
]
