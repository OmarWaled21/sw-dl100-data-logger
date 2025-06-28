from rest_framework import serializers
from .models import Device, DeviceReading, MasterClock

class DeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Device
        fields = [
            'device_id', 'name', 'status',
            'last_update', 'temperature', 'humidity',
            'wifi_strength', 'sd_card_error',
            'rtc_error', 'temp_sensor_error', 'hum_sensor_error',
            'min_temp', 'max_temp', 'min_hum', 'max_hum', 'firmware_version',
            'firmware_updated_at', 'last_calibrated', 'admin_id', 'interval_wifi', 'interval_local', 'battery_level'
        ]
        read_only_fields = ['id', 'device_id', 'admin_id']
        
class DeviceReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceReading
        fields = ['id', 'device', 'temperature', 'humidity', 'timestamp']


class MasterClockSerializer(serializers.ModelSerializer):
    class Meta:
        model = MasterClock
        fields = ['time_difference']
        
