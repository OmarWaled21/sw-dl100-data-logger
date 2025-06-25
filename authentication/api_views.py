from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authtoken.models import Token
from authentication.serializers import LoginSerializer,UpdateAccountSerializer
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth.forms import PasswordResetForm
from rest_framework.generics import GenericAPIView
from django.utils.http import urlsafe_base64_decode
from django.contrib.auth.tokens import default_token_generator
from django.contrib.auth.models import User

class LoginAPIView(APIView):
    permission_classes = []
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
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
        return Response({"message": "Login failed","results": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


class LogoutAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            # حذف التوكن الخاص بالمستخدم لتسجيل الخروج
            request.user.auth_token.delete()
            return Response({
                "success": True,
                "message": "Logged out successfully."
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                "success": False,
                "message": "Logout failed. Please try again later."
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PasswordResetRequestAPIView(APIView):
    def post(self, request):
        form = PasswordResetForm(data=request.data)
        if form.is_valid():
            form.save(
                request=request,
                use_https=request.is_secure(),
                email_template_name='authentication/password_reset_email.html',
            )
            return Response({"message": "Password reset email sent."}, status=status.HTTP_200_OK)
        return Response({"message": "Invalid input.", "errors": form.errors}, status=status.HTTP_400_BAD_REQUEST)

class PasswordResetConfirmAPIView(GenericAPIView):
    def post(self, request, uidb64, token):
        password = request.data.get('new_password')
        try:
            uid = urlsafe_base64_decode(uidb64).decode()
            user = User.objects.get(pk=uid)

            if default_token_generator.check_token(user, token):
                user.set_password(password)
                user.save()
                return Response({"message": "Password reset successful."}, status=status.HTTP_200_OK)
            else:
                return Response({"message": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return Response({"message": "Something went wrong."}, status=status.HTTP_400_BAD_REQUEST)




class UpdateAccountAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request):
        serializer = UpdateAccountSerializer(instance=request.user, data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Account updated successfully. Please log in again."}, status=status.HTTP_200_OK)
        return Response({"message": "Login failed", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)