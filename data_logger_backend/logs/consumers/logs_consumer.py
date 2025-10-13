import json
from channels.generic.websocket import AsyncWebsocketConsumer

class LogsConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope["user"]
        print(f"[LogsConsumer] 🔌 Connect from user={user} (auth={user.is_authenticated})")

        if not user.is_authenticated:
            await self.close()
            return

        self.groups_to_join = [
            "device_logs_group",
            "admin_logs_group",
            f"user_{user.id}_logs",
        ]

        for group in self.groups_to_join:
            await self.channel_layer.group_add(group, self.channel_name)
            print(f"[LogsConsumer] ✅ Joined group {group}")

        await self.accept()

    async def disconnect(self, close_code):
        for group in self.groups_to_join:
            await self.channel_layer.group_discard(group, self.channel_name)
            print(f"[LogsConsumer] 🔴 Left group {group}")

    async def send_device_log(self, event):
        await self.send(text_data=json.dumps({
            "category": "device_log",
            "data": event["log"],
        }))

    async def send_admin_log(self, event):
        await self.send(text_data=json.dumps({
            "category": "admin_log",
            "data": event["log"],
        }))
