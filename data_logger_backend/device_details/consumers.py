import re
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from home.models.device_model import Device
from .models import DeviceReading


class DeviceConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.device_id = self.scope['url_route']['kwargs']['device_id']
        safe_device_id = re.sub(r'[^a-zA-Z0-9_.-]', '_', self.device_id)
        self.group_name = f'device_{safe_device_id}'

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # إرسال الحالة الأولية فقط لو الجهاز موجود
        device = await self.get_device()
        if device:
            await self.send_device_details(device)
            await self.send_device_readings(device)
        else:
            await self.send_json({
                "type": "error",
                "message": f"Device with ID '{self.device_id}' not found."
            })

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content):
        # مستقبلًا ممكن تضيف أوامر من العميل هنا
        pass

    # -------------------------------------------------------------------------
    # 🔹 إرسال تفاصيل الجهاز (لكن فقط حسب الحساسات الموجودة)
    async def send_device_details(self, device):
        status = await self.get_device_status(device)
        payload = {
            "type": "details",
            "device_id": device.device_id,
            "name": device.name,
            "battery_level": device.battery_level,
            "has_temperature_sensor": device.has_temperature_sensor,
            "has_humidity_sensor": device.has_humidity_sensor,
            "temperature_type": device.temperature_type,
            "min_temp": device.min_temp,
            "max_temp": device.max_temp,
            "min_hum": device.min_hum,
            "max_hum": device.max_hum,
            "interval_wifi": device.interval_wifi,
            "interval_local": device.interval_local,
            "status": status,
            "last_update": device.last_update.strftime("%Y-%m-%d %H:%M:%S"),
        }

        # ✅ أضف فقط الحقول الخاصة بالحساسات الموجودة
        if device.has_temperature_sensor:
            payload["temperature"] = device.temperature

        if device.has_humidity_sensor:
            payload["humidity"] = device.humidity

        await self.send_json(payload)

    # -------------------------------------------------------------------------
    # 🔹 إرسال آخر القراءات فقط للحساسات الموجودة
    async def send_device_readings(self, device):
        readings = await self.get_readings(device)

        data = []
        for r in readings:
            reading_data = {"timestamp": r.timestamp.strftime("%Y-%m-%d %H:%M:%S")}
            if device.has_temperature_sensor:
                reading_data["temperature"] = r.temperature
            if device.has_humidity_sensor:
                reading_data["humidity"] = r.humidity
            data.append(reading_data)

        await self.send_json({
            "type": "readings",
            "device_id": self.device_id,
            "readings": data
        })

    # -------------------------------------------------------------------------
    # 🔹 دوال ORM
    @database_sync_to_async
    def get_device_status(self, device):
        try:
            return device.get_dynamic_status()
        except Exception:
            return "offline"

    @database_sync_to_async
    def get_device(self):
        try:
            return Device.objects.get(device_id=self.device_id)
        except Device.DoesNotExist:
            return None

    @database_sync_to_async
    def get_readings(self, device):
        try:
            return list(DeviceReading.objects.filter(device=device).order_by('-timestamp')[:50])
        except Exception:
            return []

    # -------------------------------------------------------------------------
    # 🔹 استقبال إشعار من group layer عند تحديث البيانات
    async def device_update(self, event):
        data = event["data"]

        # فلترة الداتا حسب نوع الحساسات
        device = await self.get_device()
        if not device:
            return

        filtered_data = {
            "type": "update",
            "device_id": device.device_id,
        }

        if device.has_temperature_sensor and "temperature" in data:
            filtered_data["temperature"] = data["temperature"]

        if device.has_humidity_sensor and "humidity" in data:
            filtered_data["humidity"] = data["humidity"]

        # فقط لو فيه داتا فعلًا نبعتها
        if len(filtered_data) > 2:
            await self.send_json(filtered_data)
