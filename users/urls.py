from django.urls import path
from . import views

urlpatterns = [
    path('', views.my_users, name='my_users'),
    path('edit/<int:user_id>/', views.edit_user, name='edit_user'),
    path('delete/<int:user_id>/', views.delete_user, name='delete_user'),
    path('add/', views.add_user, name='add_user'),
]