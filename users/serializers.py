from rest_framework import serializers
from authentication.models import CustomUser

class UserSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source='id')
    class Meta:
        model = CustomUser
        fields = ['user_id', 'username', 'email', 'role']

class AddUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = CustomUser
        fields = ['username', 'email', 'role', 'password']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = CustomUser(**validated_data)
        user.set_password(password)
        user.admin = self.context['request'].user  # ربط المستخدم بالـ admin
        user.save()
        return user
