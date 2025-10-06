# home/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Device
from .serializers import DeviceSerializer

class DataLoggerConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope["user"]
        if not user.is_authenticated:
            await self.close()
            return

        self.group_name = f"user_{user.id}_data_logger"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # send current devices once
        await self.send_initial_devices(user)

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def send_initial_devices(self, user):
        if user.role == 'admin':
            devices = await database_sync_to_async(lambda: list(Device.objects.filter(admin=user)))()
        else:
            devices = await database_sync_to_async(lambda: list(Device.objects.filter(admin=user.admin)))()

        serialized = await database_sync_to_async(lambda: DeviceSerializer(devices, many=True).data)()
        await self.send(text_data=json.dumps({
            "message": "Initial Devices",
            "results": {"devices": serialized}
        }))

    # هذه الطريقة يتم استدعائها عند ارسال type="device.update" من signal
    async def device_update(self, event):
        device = event["device"]
        await self.send(text_data=json.dumps({
            "message": "Device Updated",
            "device": device
        }))
