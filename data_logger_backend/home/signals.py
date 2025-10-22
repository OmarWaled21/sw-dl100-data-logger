# home/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from authentication.models import CustomUser
from .models.device_model import Device
from .serializers import DeviceSerializer
from django.db.models import Q

@receiver(post_save, sender=Device)
def device_updated(sender, instance: Device, created, **kwargs):
    instance.check_and_log_status()
    channel_layer = get_channel_layer()
    serialized = DeviceSerializer(instance).data

    # نجيب كل المستخدمين اللي المفروض يشوفوا الجهاز ده
    related_users = (
        CustomUser.objects.select_related("manager", "department")
        .filter(
            Q(role="admin", id=instance.admin_id) |
            Q(role="manager", department=instance.department) |
            Q(role__in=["user", "supervisor"], manager__department=instance.department)
        )
        .distinct()
    )

    # نرسل التحديث لكل المستخدمين المشتركين في الجروب بتاعهم
    for user in related_users:
        group_name = f"user_{user.id}_data_logger"
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": "device.update",
                "device": serialized
            }
        )
    