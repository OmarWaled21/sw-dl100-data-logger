from django.urls import path
from .api_views import LoginAPIView, LogoutAPIView, UpdateAccountAPIView, PasswordResetRequestAPIView, PasswordResetConfirmAPIView

urlpatterns = [
    path('login/', LoginAPIView.as_view(), name='api-login'),
    path('logout/', LogoutAPIView.as_view(), name='api-login'),
    path('update-account/', UpdateAccountAPIView.as_view(), name='api-update-account'),
    path('password-reset/', PasswordResetRequestAPIView.as_view(), name='password-reset'),
    path('password-reset-confirm/<uidb64>/<token>/', PasswordResetConfirmAPIView.as_view(), name='password-reset-confirm'),
]

