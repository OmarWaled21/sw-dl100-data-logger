# data_logger_backend/utils/websocket_utils.py

import os, django
from django.urls import re_path
from django.contrib.auth.models import AnonymousUser
from channels.db import database_sync_to_async
from urllib.parse import parse_qs
from rest_framework.authtoken.models import Token
from device_details.consumers import DeviceConsumer
from home.consumers import DataLoggerConsumer
from logs.consumers import LogConsumer

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'data_logger_backend.settings')
django.setup()


# ✅ 1. Middleware لتوثيق التوكن
@database_sync_to_async
def get_user(token_key):
    try:
        token = Token.objects.get(key=token_key)
        return token.user
    except Token.DoesNotExist:
        return AnonymousUser()


class TokenAuthMiddleware:
    """
    Middleware يقرأ التوكن من query string (?token=...)
    ويضيف user إلى scope
    """
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        query_string = parse_qs(scope["query_string"].decode())
        token_key = query_string.get("token", [None])[0]
        scope["user"] = await get_user(token_key)
        return await self.inner(scope, receive, send)


# ✅ 2. مسارات WebSocket كلها هنا
websocket_urlpatterns = [
    re_path(r'ws/home/$', DataLoggerConsumer.as_asgi()),
    re_path(r'ws/logs/latest/$', LogConsumer.as_asgi()),
    re_path(r'ws/device/(?P<device_id>[^/]+)/$', DeviceConsumer.as_asgi()),
]
