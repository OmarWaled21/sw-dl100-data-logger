from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from authentication.models import CustomUser
from .serializers import UserSerializer, AddUserSerializer
from django.shortcuts import get_object_or_404

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_my_users(request):
    if request.user.role != 'admin':
        return Response({'message': 'Unauthorized'}, status=403)

    users = CustomUser.objects.filter(admin=request.user)
    serializer = UserSerializer(users, many=True)
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_add_user(request):
    if request.user.role != 'admin':
        return Response({'message': 'Unauthorized'}, status=403)

    serializer = AddUserSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        serializer.save()
        return Response({'success': True,'message': 'User added successfully' ,'results': serializer.data})
    return Response({'message': 'failed to add user', 'results': serializer.errors}, status=400)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def api_edit_user(request, user_id):
    if request.user.role != 'admin':
        return Response({'message': 'Unauthorized'}, status=403)

    user = get_object_or_404(CustomUser, id=user_id, admin=request.user)
    serializer = UserSerializer(user, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response({'success': True, 'message': 'User updated successfully' ,'results': serializer.data})
    return Response({'message': 'failed to update user', 'results': serializer.errors}, status=400)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def api_delete_user(request, user_id):
    if request.user.role != 'admin':
        return Response({'message': 'Unauthorized'}, status=403)

    user = get_object_or_404(CustomUser, id=user_id, admin=request.user)
    user.delete()
    return Response({'success': True, 'message': 'User deleted'})
