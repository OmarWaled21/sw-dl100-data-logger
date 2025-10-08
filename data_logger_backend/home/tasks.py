from django.utils import timezone
from datetime import timedelta
from .models import Device

def auto_check_all_devices():
    """
    تمر على كل الأجهزة وتشغل check_and_log_status
    لتوليد أو إغلاق اللوجز تلقائيًا
    """
    devices = Device.objects.all()
    for device in devices:
        try:
            device.check_and_log_status()
        except Exception as e:
            print(f"[auto_check_all_devices] Error on {device}: {e}")
