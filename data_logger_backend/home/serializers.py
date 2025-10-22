from rest_framework import serializers
from .models.device_model import  Device
from .models.departments import Department
from .models.master_clock import MasterClock
from device_details.models import DeviceReading

class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name']
        
class DeviceCreateSerializer(serializers.ModelSerializer):
    department_id = serializers.IntegerField(required=False, write_only=True)
    
    class Meta:
        model = Device
        fields = [
            'device_id', 'name', 'min_temp', 'max_temp', 'min_hum', 'max_hum',
            'has_temperature_sensor', 'has_humidity_sensor', 'temperature_type',
            'department_id'  # هذا سنتعامل معه بشكل منفصل
        ]
    

class DeviceSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    department_id = serializers.IntegerField(source='department.id', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    
    class Meta:
        model = Device
        fields = [
            'device_id', 'name', 'department', 'department_name', 'department_id', 'last_update', 'admin_id', 'status',
            'has_temperature_sensor', 'has_humidity_sensor', 'temperature_type', 'temperature', 'humidity', 'battery_level',
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
        
