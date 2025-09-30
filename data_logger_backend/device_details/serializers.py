from rest_framework import serializers
from home.models import Device
from .models import DeviceReading

class DeviceEditSerializer(serializers.ModelSerializer):
    class Meta:
        model = Device
        fields = [
            'device_id','name','min_temp', 'max_temp', 'min_hum', 'max_hum', 'interval_wifi', 'interval_local', 'battery_level', 
        ]
        
    def validate(self, data):
        name = data.get('name', self.instance.name if self.instance else None)
        min_temp = data.get('min_temp', self.instance.min_temp if self.instance else None)
        max_temp = data.get('max_temp', self.instance.max_temp if self.instance else None)
        min_hum = data.get('min_hum', self.instance.min_hum if self.instance else None)
        max_hum = data.get('max_hum', self.instance.max_hum if self.instance else None)

        if name is None:
            raise serializers.ValidationError("Device name is required.")
        if min_temp is not None and max_temp is not None and max_temp <= min_temp:
            raise serializers.ValidationError("Max temperature must be greater than min temperature.")
        if min_hum is not None and max_hum is not None and max_hum <= min_hum:
            raise serializers.ValidationError("Max humidity must be greater than min humidity.")
        return data   


class DeviceReadingSerializer(serializers.ModelSerializer):
    timestamp = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S")

    class Meta:
        model = DeviceReading
        fields = ['temperature', 'humidity', 'timestamp']
