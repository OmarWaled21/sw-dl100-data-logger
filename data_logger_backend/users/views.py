from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from authentication.models import CustomUser
from .serializers import UserSerializer, AddUserSerializer


class UserManagementViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _check_admin(self, request):
        """Helper to restrict actions to admins only"""
        if request.user.role != 'admin':
            return False
        return True

    @action(detail=False, methods=['get'])
    def my_users(self, request):
        """GET /users/ - List all users of the current admin"""
        if not self._check_admin(request):
            return Response({'message': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        users = CustomUser.objects.filter(admin=request.user)
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def add_user(self, request):
        """POST /users/add/ - Add a new user under the current admin"""
        if not self._check_admin(request):
            return Response({'message': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        serializer = AddUserSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response({
                'success': True,
                'message': 'User added successfully',
                'results': serializer.data
            })
        return Response({'message': 'failed to add user', 'results': serializer.errors},
                        status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['put'])
    def edit_user(self, request, pk=None):
        """PUT /users/<id>/edit/ - Edit a specific user"""
        if not self._check_admin(request):
            return Response({'message': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        user = get_object_or_404(CustomUser, id=pk, admin=request.user)
        serializer = UserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({
                'success': True,
                'message': 'User updated successfully',
                'results': serializer.data
            })
        return Response({'message': 'failed to update user', 'results': serializer.errors},
                        status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['delete'])
    def delete_user(self, request, pk=None):
        """DELETE /users/<id>/delete/ - Delete a specific user"""
        if not self._check_admin(request):
            return Response({'message': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        user = get_object_or_404(CustomUser, id=pk, admin=request.user)
        user.delete()
        return Response({'success': True, 'message': 'User deleted'})
