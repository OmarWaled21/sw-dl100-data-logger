from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from authentication.models import CustomUser
from .serializers import UserSerializer, AddUserSerializer


class UserManagementViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _check_admin_or_manager(self, request):
        """يسمح فقط للـ admin أو manager"""
        return request.user.role in ['admin', 'manager']

    @action(detail=False, methods=['get'])
    def my_users(self, request):
        """
        GET /users/
        - admin يشوف كل المستخدمين
        - manager يشوف المستخدمين في نفس القسم
        - supervisor / user يشوف نفسه فقط
        """
        user = request.user

        if user.role == 'admin':
            users = CustomUser.objects.all().exclude(id=user.id)

        elif user.role == 'manager':
            # يظهر المستخدمين اللي في نفس القسم
            users = CustomUser.objects.filter(department=user.department).exclude(id=user.id)

        else:
            # المستخدم العادي يشوف نفسه فقط
            users = CustomUser.objects.filter(id=user.id)

        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def add_user(self, request):
        """POST /users/add/ - إنشاء مستخدم جديد"""
        if not self._check_admin_or_manager(request):
            return Response({'message': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        serializer = AddUserSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            new_user = serializer.save()

            # لو اللي أضاف المستخدم هو manager
            if request.user.role == 'manager':
                new_user.manager = request.user
                new_user.department = request.user.department
                new_user.admin = request.user.admin  # عشان يورث الأدمن الأعلى
                new_user.save()

            # لو اللي أضاف المستخدم هو admin
            elif request.user.role == 'admin':
                new_user.admin = request.user

                # ✅ يجيب الـ manager المسؤول عن القسم المختار (إن وُجد)
                department = new_user.department
                if department:
                    manager = CustomUser.objects.filter(
                        department=department, role='manager'
                    ).first()
                    if manager:
                        new_user.manager = manager
                        # يورث الأدمن الأعلى من المانجر كمان (في حال في تسلسل إداري)
                        new_user.admin = manager.admin or request.user

                new_user.save()

            return Response({
                'success': True,
                'message': 'User added successfully',
                'results': serializer.data
            })
        return Response({'message': 'failed to add user', 'results': serializer.errors},
                        status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['put'])
    def edit_user(self, request, pk=None):
        """PUT /users/<id>/edit/"""
        user = request.user

        if user.role == 'admin':
            target_user = get_object_or_404(CustomUser, id=pk)
        elif user.role == 'manager':
            target_user = get_object_or_404(CustomUser, id=pk, department=user.department)
        else:
            return Response({'message': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        serializer = UserSerializer(target_user, data=request.data, partial=True)
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
        """DELETE /users/<id>/delete/"""
        user = request.user

        if user.role == 'admin':
            target_user = get_object_or_404(CustomUser, id=pk)
        elif user.role == 'manager':
            target_user = get_object_or_404(CustomUser, id=pk, department=user.department)
        else:
            return Response({'message': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        target_user.delete()
        return Response({'success': True, 'message': 'User deleted'})
