import json
from channels.generic.websocket import AsyncWebsocketConsumer

class LogConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope["user"]
        print(f"[Consumer] 🔌 Connect from user={user} (authenticated={user.is_authenticated})")

        if not user.is_authenticated:
            print("[Consumer] ❌ Anonymous connection rejected")
            await self.close()
            return

        # 🟦 join all log groups
        self.groups_to_join = [
            "all_users_latest_log",
            "device_logs_group",
            "admin_logs_group",
            f"user_{user.id}_logs",
        ]

        for group_name in self.groups_to_join:
            await self.channel_layer.group_add(group_name, self.channel_name)
            print(f"[Consumer] ✅ Joined group {group_name}")

        await self.accept()

    async def disconnect(self, close_code):
        for group_name in self.groups_to_join:
            await self.channel_layer.group_discard(group_name, self.channel_name)
            print(f"[Consumer] 🔴 Left group {group_name}")

    # 🟦 latest log
    async def send_latest_log(self, event):
        print(f"[Consumer] 📤 send_latest_log received -> {event}")
        await self.send(text_data=json.dumps({
            "category": "latest_log",
            "data": event["log"],
        }))

    # 🟩 device logs
    async def send_device_log(self, event):
        print(f"[Consumer] ⚙️ Sending device log to frontend")
        await self.send(text_data=json.dumps({
            "category": "device_log",
            "data": event["log"],
        }))

    # 🟨 admin logs
    async def send_admin_log(self, event):
        print(f"[Consumer] 👨‍💼 Sending admin log to frontend")
        await self.send(text_data=json.dumps({
            "category": "admin_log",
            "data": event["log"],
        }))
