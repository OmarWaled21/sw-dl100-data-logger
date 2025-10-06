# data_logger_backend/asgi.py
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "data_logger_backend.settings")

# ✅ فعّل إعدادات Django أولًا
import django
django.setup()

# ✅ جهّز التطبيق العادي
django_asgi_app = get_asgi_application()

# ✅ بعد ما Django يبقى جاهز، استورد باقي الموديولات
from data_logger_backend.utils.websocket_utils import TokenAuthMiddleware, websocket_urlpatterns

# ✅ إعداد الـ ASGI الرئيسي
application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": TokenAuthMiddleware(
        URLRouter(websocket_urlpatterns)
    ),
})
