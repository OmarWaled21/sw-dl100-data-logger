from datetime import timedelta
import json
import paho.mqtt.client as mqtt
from django.conf import settings
from data_logger.utils import get_master_time
from device_details.models import Device, DeviceControl

def on_connect(client, userdata, flags, rc):
    print("🔌 MQTT Listener connected with result code", rc)
    client.subscribe("devices/+/state")  # 🔁 اشتراك في حالة كل الأجهزة

def on_message(client, userdata, msg):
    try:
        topic_parts = msg.topic.split('/')
        device_id = topic_parts[1]
        payload = msg.payload.decode().strip().lower()

        print(f"📥 MQTT Update: {device_id} → {payload}")

        state = payload == "on"

        # ✅ تحديث الحالة فقط بدون انتظار confirmation
        device = Device.objects.get(device_id=device_id)
        control, _ = DeviceControl.objects.get_or_create(device=device)
        
        control.is_on = state
        control.last_confirmed_state = state
        
        # ⏸ Pause auto control for 1 hour due to manual action
        control.auto_pause_until = get_master_time() + timedelta(hours=1)
        
        control.save()

        print(f"✅ Device [{device_id}] updated to {state}")
        
        # ✅ رد إلى الجهاز برسالة تحكم كاملة (MQTT)
        control_data = {
            "device_id": device.device_id,
            "is_on": control.is_on,
            "auto_schedule": control.auto_schedule,
            "auto_on": control.auto_on.strftime('%H:%M') if control.auto_on else None,
            "auto_off": control.auto_off.strftime('%H:%M') if control.auto_off else None,
            "temp_control_enabled": control.temp_control_enabled,
            "temp_on_threshold": control.temp_on_threshold,
            "temp_off_threshold": control.temp_off_threshold,
        }
        
        # 📨 إرسال البيانات على توبك التحكم
        control_topic = f"devices/{device.device_id}/control"
        client.publish(control_topic, json.dumps(control_data), qos=1)

        print(f"📤 Control data sent to {control_topic}")

    except Exception as e:  
        print(f"❌ MQTT Listener Error: {e}")

def mqtt_listener():
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(settings.MQTT_BROKER_URL, settings.MQTT_BROKER_PORT, 60)
    client.loop_forever()
