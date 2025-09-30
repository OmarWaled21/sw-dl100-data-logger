from django.urls import path
from .views import UserManagementViewSet

my_users = UserManagementViewSet.as_view({
    'get': 'my_users'
})
add_user = UserManagementViewSet.as_view({
    'post': 'add_user'
})
edit_user = UserManagementViewSet.as_view({
    'put': 'edit_user'
})
delete_user = UserManagementViewSet.as_view({
    'delete': 'delete_user'
})

urlpatterns = [
    path('', my_users, name='my-users'),                # GET /users/
    path('add/', add_user, name='add-user'),            # POST /users/add/
    path('<int:pk>/edit/', edit_user, name='edit-user'),# PUT /users/<id>/edit/
    path('<int:pk>/delete/', delete_user, name='delete-user'), # DELETE /users/<id>/delete/
]
