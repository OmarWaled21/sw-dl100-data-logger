# logs/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth import get_user_model


class LogConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope["user"]

        # استدعاء get_user_model هنا آمن بعد تهيئة Django
        User = get_user_model()

        if not user.is_authenticated:
            await self.close()
            return

        self.group_name = f"user_{user.id}_latest_log"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def send_latest_log(self, event):
        await self.send(text_data=json.dumps(event["log"]))
