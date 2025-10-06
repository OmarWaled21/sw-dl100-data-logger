from rest_framework import serializers
from .models import Device, MasterClock
from device_details.models import DeviceReading

class DeviceSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    
    class Meta:
        model = Device
        fields = [
            'device_id', 'name','last_update', 'admin_id', 'status',
            'temperature', 'humidity', 'battery_level', 
            'temp_sensor_error', 'hum_sensor_error', 'low_battery',
            'min_temp', 'max_temp', 'min_hum', 'max_hum', 
            'firmware_version', 'firmware_updated_at', 'last_calibrated', 'interval_wifi', 'interval_local'
        ]
        read_only_fields = ['id', 'device_id', 'admin_id']
        
    def get_status(self, obj):
        return obj.get_dynamic_status()
        
class DeviceReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceReading
        fields = ['id', 'device', 'temperature', 'humidity', 'timestamp']


class MasterClockSerializer(serializers.ModelSerializer):
    class Meta:
        model = MasterClock
        fields = ['time_difference']
        
