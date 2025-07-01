from django.urls import path
from . import views

urlpatterns = [
    path('', views.data_logger, name='data_logger'),
    path('master/update-time/', views.edit_master_clock, name='edit_master_clock'),
    path('delete-schedule/<int:schedule_id>/', views.delete_schedule, name='delete_schedule'),
    path('toggle_auto_report/', views.toggle_auto_report, name='toggle_auto_report'),
]
