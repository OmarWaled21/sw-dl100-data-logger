from rest_framework import serializers
from data_logger.models import Device
from logs.models import DeviceLog, AdminLog

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
    source = serializers.CharField(source='user.username', read_only=True)
    error_type = serializers.SerializerMethodField()
    message = serializers.CharField(source='action')
    user_id = serializers.PrimaryKeyRelatedField(source='user', read_only=True, allow_null=True)
    
    class Meta:
        model = AdminLog
        fields = ['id', 'user_id', 'source', 'error_type', 'message', 'timestamp']

    def get_error_type(self, obj):
        return "admin_action"  # أو أي قيمة ثابتة أو قابلة للتغيير حسب نوع اللوج
