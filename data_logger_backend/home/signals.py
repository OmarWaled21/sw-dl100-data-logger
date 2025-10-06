# home/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import Device
from .serializers import DeviceSerializer

@receiver(post_save, sender=Device)
def device_updated(sender, instance: Device, created, **kwargs):
    channel_layer = get_channel_layer()
    
    # serialize الجهاز اللي اتغير
    serialized = DeviceSerializer(instance).data
    
    # ارسال الرسالة لكل مستخدم له علاقة بالجهاز
    user_id = instance.admin.id if instance.admin else None
    if user_id:
        group_name = f"user_{user_id}_data_logger"
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": "device.update",  # type تحدد الفنكشن في consumer
                "device": serialized
            }
        )
