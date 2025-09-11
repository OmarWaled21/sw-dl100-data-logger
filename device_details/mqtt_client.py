# device_details/mqtt_client.py

import paho.mqtt.publish as publish
from django.conf import settings

def send_mqtt_command(device_id: str, state: bool):
    topic = f"devices/{device_id}/control"
    payload = "on" if state else "off"
    
    try:
        publish.single(
            topic=topic,
            payload=payload,
            hostname=settings.MQTT_BROKER_URL,
            port=settings.MQTT_BROKER_PORT,
            qos=1
        )
        print(f"📤 MQTT Sent → [{topic}] = {payload}")
    except Exception as e:
        print(f"❌ MQTT Send Error: {e}")
