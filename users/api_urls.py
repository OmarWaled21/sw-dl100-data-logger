from django.urls import path
from . import api_views

urlpatterns = [
    path('my-users/', api_views.api_my_users, name='api_my_users'),
    path('add-user/', api_views.api_add_user, name='api_add_user'),
    path('edit-user/<int:user_id>/', api_views.api_edit_user, name='api_edit_user'),
    path('delete-user/<int:user_id>/', api_views.api_delete_user, name='api_delete_user'),
]