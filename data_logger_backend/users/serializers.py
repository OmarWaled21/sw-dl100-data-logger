from rest_framework import serializers
from authentication.models import CustomUser

class UserSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source='id')
    department_name = serializers.CharField(source='department.name')
    department = serializers.PrimaryKeyRelatedField(read_only=True)
    manager_name = serializers.SerializerMethodField()
    
    def get_manager_name(self, obj):
        return obj.manager.username if obj.manager else None
    
    class Meta:
        model = CustomUser
        fields = ['user_id', 'username', 'email', 'role', 'department', 'department_name', 'admin', 'manager_name']

class AddUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = CustomUser
        fields = ['username', 'email', 'role', 'password', 'department', 'manager']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = CustomUser(**validated_data)
        user.set_password(password)
        user.admin = self.context['request'].user  # ربط المستخدم بالـ admin
        user.save()
        return user
