# home/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .serializers import DeviceSerializer
from .utils import get_user_devices

class DataLoggerConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope["user"]
        if not user.is_authenticated:
            await self.close()
            return

        self.user = user
        self.group_name = f"user_{user.id}_data_logger"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        await self.send_initial_devices()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    @database_sync_to_async
    def get_serialized_devices(self):
        devices = get_user_devices(self.user)
        return DeviceSerializer(devices, many=True).data

    async def send_initial_devices(self):
        serialized = await self.get_serialized_devices()
        await self.send(text_data=json.dumps({
            "message": "Initial Devices",
            "results": {"devices": serialized}
        }))

    async def device_update(self, event):
        device = event["device"]
        await self.send(text_data=json.dumps({
            "message": "Device Updated",
            "device": device
        }))
