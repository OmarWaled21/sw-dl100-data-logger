from datetime import datetime
import threading, time, logging
from django.db import close_old_connections
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.apps import apps
from django.db.models import Q
from django.contrib.auth import get_user_model
from .models import DeviceLog, AdminLog
from home.utils import get_master_time

channel_layer = get_channel_layer()
User = get_user_model()
logger = logging.getLogger(__name__)

# 🔧 Helper for datetime serialization
def serialize_datetime(data):
    for key, value in data.items():
        if isinstance(value, datetime):
            data[key] = value.isoformat()
    return data


# ================== Broadcasters ==================
def send_to_group(group_name, event_type, log_data):
    """Generic group sender"""
    async_to_sync(channel_layer.group_send)(
        group_name,
        {"type": event_type, "log": serialize_datetime(log_data)},
    )


def send_latest_log(log_data):
    send_to_group("all_users_latest_log", "send_latest_log", log_data)


def send_device_log(log_data):
    send_to_group("device_logs_group", "send_device_log", log_data)


def send_admin_log(log_data):
    send_to_group("admin_logs_group", "send_admin_log", log_data)


def send_personal_log(user, event_type, log_data):
    """🔒 Send to a single user's private group"""
    private_group = f"user_{user.id}_logs"
    async_to_sync(channel_layer.group_send)(
        private_group,
        {"type": event_type, "log": serialize_datetime(log_data)},
    )


# ================== Role-Based Logic ==================
def get_relevant_users_for_log(instance, log_type="device"):
    """تحديد مين يشوف اللوج"""
    users = User.objects.none()

    if log_type == "device":
        device = getattr(instance, "device", None)
        department = getattr(device, "department", None) or getattr(instance, "department", None)

        if department:
            # ✅ Admins + managers + users in the department
            users = User.objects.filter(
                Q(role="admin") |
                Q(department=department)
            ).distinct()
        else:
            # لو مفيش قسم، نديها بس للـ admins
            users = User.objects.filter(role="admin")

    elif log_type == "admin":
        admin_user = getattr(instance, "admin", None)
        manager_user = getattr(instance, "manager", None)
        base_q = Q(role="admin")

        if admin_user:
            base_q |= Q(id=admin_user.id)
        if manager_user:
            base_q |= Q(id=manager_user.id)

        users = User.objects.filter(base_q).distinct()

    return users


# ================== Signal Listeners ==================
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender=DeviceLog)
def device_log_post_save(sender, instance, created, **kwargs):
    if not created:
        return

    try:
        log_data = instance.get_log_info()
        print(f"[Signal] 🟩 DeviceLog created {instance.id} -> {log_data}")

        # إرسال أحدث لوج للجميع
        print("[Signal] 🔄 Sending to group: all_users_latest_log")
        send_latest_log(log_data)

        print("[Signal] ⚙️ Sending to group: device_logs_group")
        send_device_log(log_data)

        users = get_relevant_users_for_log(instance, "device")
        print(f"[Signal] 👥 Sending to {users.count()} personal users")

        for user in users:
            print(f"[Signal] 👤 Personal send -> user_{user.id}_logs")
            send_personal_log(user, "send_device_log", log_data)

        print("[Signal] ✅ All sends done")

    except Exception as e:
        print(f"[Signal Error] ❌ {e}")

@receiver(post_save, sender=AdminLog)
def admin_log_post_save(sender, instance, created, **kwargs):
    if not created:
        return

    try:
        log_data = instance.get_log_info()
        print(f"[Signal] 🟨 AdminLog created {instance.id}")

        # إرسال للـ group العام
        send_admin_log(log_data)

        # إرسال للمستخدمين المسموح لهم (admins + manager + نفسه)
        users = get_relevant_users_for_log(instance, "admin")
        for user in users:
            send_personal_log(user, "send_admin_log", log_data)

        print(f"[Signal] 👥 Sent admin log to {users.count()} users")

    except Exception as e:
        print(f"[Signal Error] ❌ {e}")

# ================== Background Thread ==================
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

                    status = device.check_and_log_status()
                    print(f"[Check] {device.device_id}: dynamic_status={status}")

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
