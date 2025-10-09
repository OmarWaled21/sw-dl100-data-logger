from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework import status
from .models import DeviceLog, AdminLog, NotificationSettings
from .serializers import DeviceLogSerializer, AdminLogSerializer
from home.utils import get_master_time
from datetime import datetime, timedelta
from django.utils.dateparse import parse_time
from django.db.models import Q

class LogViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _get_logs_queryset(self, request, device_id=None, filter_date=None, error_types=None):
        """Helper to get logs based on user role, department, and filters."""
        user = request.user

        # ✅ Admin يشوف كل الأجهزة وكل الأقسام
        if user.role == 'admin':
            device_logs = DeviceLog.objects.select_related('device', 'department')
            user_logs = AdminLog.objects.all()

        # ✅ Manager يشوف أجهزة قسمه فقط
        elif user.role == 'manager':
            device_logs = DeviceLog.objects.filter(
                department=user.department
            ).select_related('device', 'department')
            user_logs = AdminLog.objects.filter(
                Q(manager=user) | Q(user=user)
            )

        # ✅ User يشوف قسمه فقط
        else:
            device_logs = DeviceLog.objects.filter(
                department=user.department
            ).select_related('device', 'department')
            user_logs = AdminLog.objects.filter(user=user)

        # فلترة بالـ device_id لو تم تحديده
        if device_id:
            device_logs = device_logs.filter(device__id=device_id)

        # فلترة بالتاريخ
        if filter_date:
            try:
                base_master_time = get_master_time()
                naive_start_date = datetime.strptime(filter_date, "%Y-%m-%d")
                start_date = base_master_time.replace(
                    year=naive_start_date.year,
                    month=naive_start_date.month,
                    day=naive_start_date.day,
                    hour=0, minute=0, second=0, microsecond=0
                )
                end_date = start_date + timedelta(days=1)
                device_logs = device_logs.filter(timestamp__gte=start_date, timestamp__lt=end_date)
                user_logs = user_logs.filter(timestamp__gte=start_date, timestamp__lt=end_date)
            except ValueError:
                raise ValueError("Invalid date format, must be YYYY-MM-DD")

        # فلترة بنوع الخطأ
        if error_types and 'All' not in error_types:
            device_logs = device_logs.filter(error_type__in=error_types)

        return device_logs, user_logs

    @action(detail=False, methods=['get'], url_path='device')
    def device_logs(self, request):
        """GET /logs/device/"""
        device_logs, _ = self._get_logs_queryset(request)
        serialized = DeviceLogSerializer(device_logs.order_by('-timestamp'), many=True).data
        table_head = ["time", "device", "error_type", "message"]
        return Response({
            "message": "Device logs fetched successfully",
            "table_head": table_head,
            "results": serialized,
            "unread_count": 0,  # لو عندك unread logic حطها هنا
        })

    @action(detail=False, methods=['get'], url_path='admin')
    def admin_logs(self, request):
        """GET /logs/admin/"""
        _, user_logs = self._get_logs_queryset(request)
        serialized = AdminLogSerializer(user_logs.order_by('-timestamp'), many=True).data
        table_head = ["time", "user", "type", "message"]
        return Response({
            "message": "Admin logs fetched successfully",
            "table_head": table_head,
            "results": serialized,
            "unread_count": 0,
        })

    @action(detail=False, methods=['get'])
    def latest_local(self, request):
        """GET /logs/latest_local/"""
        user = request.user

        if user.role == 'admin':
            last_log = DeviceLog.objects.filter(device__admin=user).order_by('-timestamp').first()
        else:
            last_log = DeviceLog.objects.filter(device__admin=user.admin).order_by('-timestamp').first()

        if not last_log:
            return Response({"message": None})

        return Response({
            "message": f"[{last_log.device.name or last_log.device.device_id}] {last_log.error_type}: {last_log.message or 'No message'}",
            "timestamp": last_log.timestamp
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def create_log(self, request):
        user = request.user
        log_type = request.data.get('log_type', 'admin')

        if log_type == 'device':
            serializer = DeviceLogSerializer(data=request.data)
        else:
            admin = getattr(user, 'admin', user)
            serializer = AdminLogSerializer(
                data=request.data,
                context={'user': user, 'admin': admin}
            )

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'], url_path='mark-read')
    def mark_read(self, request):
        """
        POST /logs/mark-read/
        Marks device/admin logs as read for the current user.
        """
        user = request.user
        log_type = request.data.get('type', 'all')

        # لو عندك حقل is_read في DeviceLog/AdminLog فعّل السطور دي
        if log_type in ['device', 'all']:
            device_logs = DeviceLog.objects.filter(device__admin=user)
            if hasattr(DeviceLog, 'is_read'):
                device_logs.update(is_read=True)

        if log_type in ['admin', 'all']:
            admin_logs = AdminLog.objects.filter(admin=user)
            if hasattr(AdminLog, 'is_read'):
                admin_logs.update(is_read=True)

        return Response({"message": "Logs marked as read successfully"}, status=status.HTTP_200_OK)



class NotificationSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        settings, _ = NotificationSettings.objects.get_or_create(user=user)
        return Response({
            "gmail_is_active": settings.gmail_is_active,
            "email": settings.email,
            "report_time": settings.report_time.strftime("%H:%M"),
            "local_is_active": settings.local_is_active
        })

    def post(self, request):
        user = request.user
        settings, _ = NotificationSettings.objects.get_or_create(user=user)
        data = request.data

        settings.gmail_is_active = data.get("gmail_is_active", False)
        settings.email = data.get("email", None)
        settings.report_time = parse_time(data.get("report_time", "09:00"))
        settings.local_is_active = data.get("local_is_active", False)
        settings.save()

        return Response({"success": True})
