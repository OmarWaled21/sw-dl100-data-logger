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

        self.group_name = f"all_users_latest_log"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        print(f"[Consumer] ✅ Joined group {self.group_name}")

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        print(f"[Consumer] 🔴 Disconnected {self.group_name}")

    async def send_latest_log(self, event):
        print(f"[Consumer] 📤 Sending log to frontend: {event['log']}")
        await self.send(text_data=json.dumps(event["log"]))
