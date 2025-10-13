import json
from channels.generic.websocket import AsyncWebsocketConsumer

class LatestLogConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope["user"]
        print(f"[LatestLogConsumer] 🔌 Connect from user={user} (auth={user.is_authenticated})")

        if not user.is_authenticated:
            await self.close()
            print("[WS Connect] Connection closed: unauthenticated")
            return

        self.group_name = "all_users_latest_log"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        print(f"[LatestLogConsumer] ✅ Joined group {self.group_name}")

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        print(f"[LatestLogConsumer] 🔴 Left group {self.group_name}")

    async def send_latest_log(self, event):
        """بيستقبل event من backend وبيبعتها للـ frontend"""
        await self.send(text_data=json.dumps({
            "category": "latest_log",
            "data": event["log"],
        }))

        print(f"[LatestLogConsumer] 📤 send_latest_log received -> {event}")
        