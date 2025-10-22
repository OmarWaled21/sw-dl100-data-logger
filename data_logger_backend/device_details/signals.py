import re
from django.db.models.signals import post_save
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from home.models.device_model import Device
from .models import DeviceReading

channel_layer = get_channel_layer()

def safe_group_name(device_id: str) -> str:
    # استبدل أي حرف غير مسموح بـ "_"، واقصر الطول لـ 99 حرف
    return re.sub(r"[^a-zA-Z0-9_.-]", "_", device_id)[:99]

def send_ws_update(group_name, data):
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "device_update",
            "data": data
        }
    )

@receiver(post_save, sender=Device)
def device_update_signal(sender, instance, **kwargs):
    group_name = f'device_{safe_group_name(instance.device_id)}'
    data = {
        'type': 'details',
        'device_id': instance.device_id,
        'name': instance.name,
        'temperature': instance.temperature,
        'humidity': instance.humidity,
        'min_temp': instance.min_temp,
        'max_temp': instance.max_temp,
        'min_hum': instance.min_hum,
        'max_hum': instance.max_hum,
        'battery_level': instance.battery_level,
        'status': instance.get_dynamic_status(),
        'interval_wifi': instance.interval_wifi,
        'interval_local': instance.interval_local,
        'last_update': instance.last_update.strftime("%Y-%m-%d %H:%M:%S")
    }
    send_ws_update(group_name, data)

@receiver(post_save, sender=DeviceReading)
def device_reading_signal(sender, instance, **kwargs):
    group_name = f'device_{safe_group_name(instance.device.device_id)}'
    data = {
        'type': 'readings',
        'device_id': instance.device.device_id,
        'readings': [  # مهم
            {
                'timestamp': instance.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                'temperature': instance.temperature,
                'humidity': instance.humidity
            }
        ]
    }
    send_ws_update(group_name, data)
