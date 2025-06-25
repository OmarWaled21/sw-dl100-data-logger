from django.urls import path
from django.contrib.auth import views as auth_views
from . import views
from .views import CustomPasswordResetView

urlpatterns = [
    path('', views.user_login, name='login'),
    path("logout/", views.user_logout, name="logout"),
    path('password_reset/', CustomPasswordResetView.as_view(), name='password_reset'),  # تم التعديل هنا
    path('password_reset/done/', views.password_reset_done, name='password_reset_done'),
    path('reset/<uidb64>/<token>/', views.password_reset_confirm, name='password_reset_confirm'),
    path('reset/done/', views.password_reset_complete, name='password_reset_complete'),
    path('update_user/', views.update_account_view, name='update_user'),
]