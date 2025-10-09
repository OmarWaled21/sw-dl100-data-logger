from rest_framework import serializers
from home.models import Device
from .models import DeviceLog, AdminLog

class DeviceLogSerializer(serializers.ModelSerializer):
    source = serializers.CharField(source='device.name', read_only=True)
    error_type = serializers.CharField()
    message = serializers.CharField()
    device_id = serializers.CharField(write_only=True)
    resolved = serializers.BooleanField(default=False)

    class Meta:
        model = DeviceLog
        fields = ['id', 'device_id', 'source', 'error_type', 'message', 'timestamp', 'sent', 'resolved']
        
    def create(self, validated_data):
        device_id = validated_data.pop('device_id')
        try:
            device = Device.objects.get(device_id=device_id)
        except Device.DoesNotExist:
            raise serializers.ValidationError("Invalid device_id")

        return DeviceLog.objects.create(device=device, **validated_data)

class AdminLogSerializer(serializers.ModelSerializer):
    user = serializers.CharField(source='user.username', read_only=True)
    role = serializers.CharField(source='user.role', read_only=True)
    class Meta:
        model = AdminLog
        fields = ['id', 'user', 'role', 'admin', 'action', 'message', 'timestamp']
        read_only_fields = ['user', 'admin', 'timestamp']

    def create(self, validated_data):
        user = self.context['user']
        admin = self.context['admin']
        return AdminLog.objects.create(user=user, admin=admin, **validated_data)
