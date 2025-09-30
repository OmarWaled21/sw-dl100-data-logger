from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.contrib.auth.tokens import default_token_generator

from authentication.serializers import LoginSerializer, UpdateAccountSerializer
from authentication.models import CustomUser


class AccountViewSet(viewsets.ViewSet):
    """
    Handles login, logout, update account, and password reset flows
    """

    # 🟢 login
    @action(detail=False, methods=["post"], permission_classes=[AllowAny])
    def login(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data["user"]
            token, _ = Token.objects.get_or_create(user=user)
            results = {
                "user_id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
            }
            return Response({
                "token": token.key,
                "results": results,
                "message": "Login successful"
            }, status=status.HTTP_200_OK)
        return Response({"message": "Login failed", "results": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    # 🔴 logout
    @action(detail=False, methods=["post"], permission_classes=[IsAuthenticated])
    def logout(self, request):
        try:
            request.user.auth_token.delete()
            return Response({
                "success": True,
                "message": "Logged out successfully."
            }, status=status.HTTP_200_OK)
        except Exception:
            return Response({
                "success": False,
                "message": "Logout failed. Please try again later."
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # ✏️ update account
    @action(detail=False, methods=["put"], permission_classes=[IsAuthenticated])
    def update_account(self, request):
        serializer = UpdateAccountSerializer(instance=request.user, data=request.data, context={"request": request})
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Account updated successfully. Please log in again."}, status=status.HTTP_200_OK)
        return Response({"message": "Update failed", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    # 📧 password reset request
    @action(detail=False, methods=["post"], permission_classes=[AllowAny])
    def password_reset(self, request):
        email = request.data.get("email")
        try:
            user = CustomUser.objects.get(email=email)

            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)

            # الرابط هيبقى للـ modal في Next.js
            reset_link = f"http://localhost:3000/auth/reset-password/{uid}/{token}"

            send_mail(
                subject="Reset your password",
                message=f"Click the link to reset your password:\n{reset_link}",
                from_email="no-reply@example.com",
                recipient_list=[user.email],
            )
            return Response({"message": "Password reset email sent."}, status=200)
        except CustomUser.DoesNotExist:
            return Response({"message": "Email not found."}, status=400)

    # 🔑 password reset confirm
        # 🔑 password reset confirm
    @action(
        detail=False,
        methods=["post"],
        url_path="password-reset-confirm/(?P<uidb64>[^/.]+)/(?P<token>[^/.]+)",
        permission_classes=[AllowAny]
    )
    def password_reset_confirm(self, request, uidb64=None, token=None):
        password = request.data.get("new_password")
        try:
            uid = urlsafe_base64_decode(uidb64).decode()
            user = CustomUser.objects.get(pk=uid)

            if default_token_generator.check_token(user, token):
                user.set_password(password)
                user.save()
                return Response({
                    "message": "Password reset successful.",
                    "redirect_url": "http://localhost:3000/auth/login"  # 👈 login page
                }, status=status.HTTP_200_OK)
            else:
                return Response({"message": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)

        except Exception:
            return Response({"message": "Something went wrong."}, status=status.HTTP_400_BAD_REQUEST)
