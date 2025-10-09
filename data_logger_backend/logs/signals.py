from datetime import datetime, timedelta
import threading, time, logging
from django.db import close_old_connections
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.apps import apps
from .models import DeviceLog, AdminLog
from home.utils import get_master_time

channel_layer = get_channel_layer()
logger = logging.getLogger(__name__)


# =============== WebSocket Sender ===============
def send_latest_log(user_id, log_data):
    group_name = "all_users_latest_log"

    # ✅ نحول أي datetime لقيمة نصية (isoformat)
    for key, value in log_data.items():
        if isinstance(value, datetime):
            log_data[key] = value.isoformat()

    print(f"[Signal] 🔔 Sending broadcast log: {log_data}")
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "send_latest_log",
            "log": log_data,
        }
    )


# =============== Signal Listeners ===============
from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=DeviceLog)
def device_log_post_save(sender, instance, created, **kwargs):
    print(f"[Signal] 🚀 Triggered for log {instance.id} (error_type={instance.error_type})")
    if not created:
        return

    try:
        dept = None
        if instance.device:
            dept = instance.device.department or instance.department

        if dept:
            users = dept.users.all()
            print(f"[Signal] 📢 Notifying {users.count()} users in dept {dept.name}")
            for user in users:
                send_latest_log(user.id, instance.get_log_info())
        else:
            print(f"[Signal] ⚠️ No department for device {instance.device.device_id if instance.device else 'UNKNOWN'}")

    except Exception as e:
        print(f"[Signal Error] ❌ {e}")


@receiver(post_save, sender=AdminLog)
def admin_log_post_save(sender, instance, created, **kwargs):
    if created:
        send_latest_log(instance.user.id, instance.get_log_info())


# =============== Background Thread ===============
_auto_checker_started = False

def start_auto_offline_checker():
    global _auto_checker_started
    if _auto_checker_started:
        logger.info("⏩ Auto offline checker already running, skipping duplicate start.")
        return
    _auto_checker_started = True
    
    Device = apps.get_model('home', 'Device')
    logger.info("🔄 Auto offline checker started from logs.signals.")

    def loop():
        while True:
            print("[Checker] 🔁 Loop tick at", get_master_time())
            now = get_master_time()
            devices = Device.objects.all()

            for device in devices:
                try:
                    if not device.last_update:
                        continue

                    # ✅ استدعاء الطريقة الذكية من الموديل نفسه
                    status = device.check_and_log_status()
                    print(f"[Check] {device.device_id}: dynamic_status={status}")

                    # ✅ لو رجع شغال بعد ما كان offline → نبعت إشعار recovery
                    if status != "offline":
                        resolved_logs = DeviceLog.objects.filter(
                            device=device, error_type="offline", resolved=True
                        ).order_by("-timestamp")[:1]

                        for log in resolved_logs:
                            msg = f"✅ Device {device.device_id} is back online."
                            print(msg)

                except Exception as e:
                    logger.error(f"❌ Error checking device {getattr(device, 'device_id', 'UNKNOWN')}: {e}")

            close_old_connections()
            time.sleep(10)

    threading.Thread(target=loop, daemon=True).start()
