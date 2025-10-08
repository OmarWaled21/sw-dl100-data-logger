import re
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from home.models import Device
from .models import DeviceReading

class DeviceConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.device_id = self.scope['url_route']['kwargs']['device_id']
        
        # تحويل أي حرف غير مسموح في group name إلى "_"
        safe_device_id = re.sub(r'[^a-zA-Z0-9_.-]', '_', self.device_id)
        self.group_name = f'device_{safe_device_id}'

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # إرسال حالة مبدئية عند الاتصال
        await self.send_device_details()
        await self.send_device_readings()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content):
        pass

    async def send_device_details(self):
        device = await self.get_device()
        if device:
            status = await self.get_device_status(device)
            await self.send_json({
                'type': 'details',
                'device_id': device.device_id,
                'name': device.name,
                'battery_level': device.battery_level,
                'temperature': device.temperature,
                'humidity': device.humidity,
                'min_temp': device.min_temp,
                'max_temp': device.max_temp,
                'min_hum': device.min_hum,
                'max_hum': device.max_hum,
                'interval_wifi': device.interval_wifi,
                'status': status,
                'last_update': device.last_update.strftime("%Y-%m-%d %H:%M:%S")
            })

    async def send_device_readings(self):
        readings = await self.get_readings()
        data = [
            {
                'timestamp': r.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                'temperature': r.temperature,
                'humidity': r.humidity
            }
            for r in readings
        ]
        await self.send_json({
            'type': 'readings',
            'device_id': self.device_id,
            'readings': data
        })

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
    def get_readings(self):
        try:
            device = Device.objects.get(device_id=self.device_id)
            return list(DeviceReading.objects.filter(device=device).order_by('-timestamp')[:50])
        except Device.DoesNotExist:
            return []

    async def device_update(self, event):
        await self.send_json(event['data'])
