from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status

from updates.models import UpdatesModel
from updates.serializers import UpdatesSerializer

# Create your views here.
class LatestUpdateView(APIView):
  def get(self, request):
    latestUpdate = UpdatesModel.get_latest()
    if latestUpdate:
      serializer = UpdatesSerializer(latestUpdate)
      return Response({"message": "Latest update retrieved successfully", "results": serializer.data}, status=status.HTTP_200_OK)
    
    return Response({"error": "No updates found"}, status=status.HTTP_404_NOT_FOUND)
  
# Check if a firmware update is available
class CheckFirmwareUpdateView(APIView):
    def get(self, request):
        fw_type = request.query_params.get('type', '').upper()
        current_version = request.query_params.get('version', '').strip()

        if not fw_type or not current_version:
            return Response(
                {"error": "Missing parameters: 'type' and 'version' are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        latest = UpdatesModel.get_latest()
        if not latest:
            return Response({"update": False, "message": "No firmware records found."}, status=status.HTTP_200_OK)

        # اختار القيم حسب النوع
        if fw_type == 'HT':
            latest_version = latest.version_esp_HT
            url = latest.url_esp_HT
            checksum = latest.checksum_esp_HT
        elif fw_type == 'T':
            latest_version = latest.version_esp_T
            url = latest.url_esp_T
            checksum = latest.checksum_esp_T
        else:
            return Response({"error": "Invalid firmware type. Must be 'HT' or 'T'."}, status=status.HTTP_400_BAD_REQUEST)

        # مقارنة الإصدارات
        if current_version.strip() != latest_version.strip():
            return Response({
                "update": True,
                "version": latest_version,
                "url": url,
                "checksum": checksum,
                "message": f"Firmware update available for {fw_type}",
                "released_at": latest.created_at.strftime("%Y-%m-%d %H:%M:%S") if latest.created_at else None
            }, status=status.HTTP_200_OK)

        return Response({
            "update": False,
            "message": "Your firmware is up to date.",
            "version": current_version
        }, status=status.HTTP_200_OK)
  
class SyncUpdatesView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        data = request.data
        
        # ✅ تحقق من البنية الأساسية
        if not all(k in data for k in ["app", "firmware", "released_at"]):
            return Response(
                {"error": "Invalid JSON structure. Required keys: app, firmware, released_at"},
                status=status.HTTP_400_BAD_REQUEST
            )

        app = data.get("app", {})
        fw = data.get("firmware", {})
        fw_ht = fw.get("HT", {})
        fw_t = fw.get("T", {})
        
        # ✅ تحقق من البنية الداخلية
        required_app_keys = {"version", "url", "checksum"}
        required_fw_keys = {"version", "url", "checksum"}
        
        if not required_app_keys.issubset(app.keys()):
            return Response({"error": "Missing app fields (version, url, checksum)"}, status=400)

        if not fw_ht or not required_fw_keys.issubset(fw_ht.keys()):
            return Response({"error": "Missing firmware HT fields"}, status=400)

        if not fw_t or not required_fw_keys.issubset(fw_t.keys()):
            return Response({"error": "Missing firmware T fields"}, status=400)
        
        try:
          # القيم الجديدة من GitHub
          version_app = app.get("version", "0.0.0")
          version_esp_HT = fw_ht.get("version", "0.0.0")
          version_esp_T = fw_t.get("version", "0.0.0")
          
          last_update = UpdatesModel.get_latest()
          
          if last_update and (
            last_update.version_app == version_app and
            last_update.version_esp_HT == version_esp_HT and
            last_update.version_esp_T == version_esp_T
          ):
            print(f"[ℹ️] No new updates found (latest version already {version_app})")
            return Response({"message": f"No new updates found (latest version already {version_app})"}, status=200)
          
          UpdatesModel.objects.create(
            version_app = app.get("version", "0.0.0"),
            url_app = app.get("url"),
            checksum_app = app.get("checksum"),
            
            version_esp_HT = fw_ht.get("version", "0.0.0"),
            url_esp_HT = fw_ht.get("url"),
            checksum_esp_HT = fw_ht.get("checksum"),
            
            version_esp_T = fw_t.get("version", "0.0.0"),
            url_esp_T = fw_t.get("url"),
            checksum_esp_T = fw_t.get("checksum"),
          )

          return Response({"message": "Updates synced successfully"})
        except Exception as e:
          return Response({"error": f"Failed to update: {str(e)}"}, status=500)
        