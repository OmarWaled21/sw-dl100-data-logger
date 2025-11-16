from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import FirmwareModel
from .serializers import FirmwareSerializer

class LatestFirmwareView(APIView):
    permission_classes = []  # AllowAny by default

    def get(self, request, *args, **kwargs):
        latest = FirmwareModel.get_latest()
        if not latest:
            return Response({"message": "No firmware found"}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = FirmwareSerializer(latest, context={"request": request})
        data = serializer.data

        response = {
            "HT": {
                "version": data["version_esp_HT"],
                "url": data["url_esp_HT"],
                "checksum": data["checksum_esp_HT"],
            },
            "T": {
                "version": data["version_esp_T"],
                "url": data["url_esp_T"],
                "checksum": data["checksum_esp_T"],
            },
            "created_at": data["created_at"],
        }

        return Response(response, status=status.HTTP_200_OK)

class CheckFirmwareView(APIView):
    """
    API بتستقبل نوع الجهاز (HT أو T) والإصدار الحالي الموجود عنده،
    وتقارن بالإصدار الأحدث في السيرفر.
    """
    permission_classes = []

    def get(self, request, *args, **kwargs):
        device_type = request.query_params.get("type")  # HT أو T
        current_version = request.query_params.get("version")

        if device_type not in ["HT", "T"] or not current_version:
            return Response(
                {"error": "Missing or invalid parameters. Use ?type=HT&T=1.0.0"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        latest = FirmwareModel.get_latest()
        if not latest:
            return Response({"message": "No firmware found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = FirmwareSerializer(latest, context={"request": request})
        data = serializer.data

        if device_type == "HT":
            latest_version = data["version_esp_HT"]
            url = data["url_esp_HT"]
            checksum = data["checksum_esp_HT"]
        else:
            latest_version = data["version_esp_T"]
            url = data["url_esp_T"]
            checksum = data["checksum_esp_T"]

        # مقارنة النسخ
        if current_version == latest_version:
            return Response(
                {
                    "update": False,
                    "latest_version": latest_version,
                    "message": "Device firmware is already up to date.",
                },
                status=status.HTTP_200_OK,
            )
        else:
            return Response(
                {
                    "update": True,
                    "latest_version": latest_version,
                    "url": url,
                    "checksum": checksum,
                    "message": "New firmware available.",
                },
                status=status.HTTP_200_OK,
            )