from rest_framework import serializers
from django.conf import settings
from .models import FirmwareModel
import os

class FirmwareSerializer(serializers.ModelSerializer):
    url_esp_HT = serializers.SerializerMethodField()
    url_esp_T = serializers.SerializerMethodField()

    class Meta:
        model = FirmwareModel
        fields = [
            "version_esp_HT",
            "file_esp_HT",
            "checksum_esp_HT",
            "url_esp_HT",
            "version_esp_T",
            "file_esp_T",
            "checksum_esp_T",
            "url_esp_T",
            "created_at",
        ]

    def get_url_esp_HT(self, obj):
        """ارجع URL كامل للتحميل لو فيه ملف HT"""
        if obj.file_esp_HT:
            rel_path = os.path.relpath(obj.file_esp_HT, settings.MEDIA_ROOT).replace("\\", "/")
            return self._build_full_url(rel_path)
        return None

    def get_url_esp_T(self, obj):
        """ارجع URL كامل للتحميل لو فيه ملف T"""
        if obj.file_esp_T:
            rel_path = os.path.relpath(obj.file_esp_T, settings.MEDIA_ROOT).replace("\\", "/")
            return self._build_full_url(rel_path)
        return None

    def _build_full_url(self, relative_path):
        """بترجع لينك كامل باستخدام request context"""
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(f"/media/{relative_path}")
        return f"/media/{relative_path}"
