from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework import status
from .models import  DeviceLog, AdminLog, NotificationSettings
from .serializers import DeviceLogSerializer, AdminLogSerializer
from home.utils import get_master_time
from datetime import datetime, timedelta
from django.utils.dateparse import parse_time
from django.core.mail import send_mail
from django.conf import settings

class LogViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _get_logs_queryset(self, request, device_id=None, filter_date=None, error_types=None):
        """Helper to get logs based on user role and filters."""
        user = request.user

        if user.role == 'admin':
            device_logs = DeviceLog.objects.filter(device__admin=user).select_related('device')
            user_logs = AdminLog.objects.filter(admin=user)
        else:
            device_logs = DeviceLog.objects.filter(device__admin=user.admin).select_related('device')
            user_logs = AdminLog.objects.filter(admin=user.admin, user=user)

        if device_id:
            device_logs = device_logs.filter(device__id=device_id)

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

        if error_types and 'All' not in error_types:
            device_logs = device_logs.filter(error_type__in=error_types)

        return device_logs, user_logs

    @action(detail=False, methods=['get'])
    def logs(self, request):
        """GET /logs/ - Get device & admin logs"""
        device_id = request.GET.get('device_id')
        filter_date = request.GET.get('filter_date')
        error_types = request.GET.getlist('error_type')

        try:
            device_logs, user_logs = self._get_logs_queryset(request, device_id, filter_date, error_types)
        except ValueError as e:
            return Response({'message': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        device_logs_serialized = DeviceLogSerializer(device_logs, many=True).data
        user_logs_serialized = AdminLogSerializer(user_logs, many=True).data

        all_logs = device_logs_serialized + user_logs_serialized
        all_logs.sort(key=lambda log: log['timestamp'], reverse=True)

        return Response({'message': 'Getting all logs Successfully', 'results': all_logs})

    @action(detail=False, methods=['post'])
    def create_log(self, request):
        """POST /create_log/ - Create new device log and send email if enabled"""
        serializer = DeviceLogSerializer(data=request.data)
        if serializer.is_valid():
            log = serializer.save()

            # Check if email notifications are enabled for this user
            try:
                notif_settings = NotificationSettings.objects.get(user=request.user)
            except NotificationSettings.DoesNotExist:
                notif_settings = None

            if notif_settings and notif_settings.gmail_is_active and notif_settings.email:
                subject = f"New Device Log: {log.device.name or log.device.device_id}"
                message = f"""
                Device: {log.device.name or log.device.device_id}
                Timestamp: {log.timestamp.strftime('%Y-%m-%d %H:%M:%S')}
                Type: {log.error_type}
                Message: {log.message or 'No message'}
                """
                send_mail(
                    subject,
                    message,
                    settings.DEFAULT_FROM_EMAIL,  # تأكد إنه معرف في settings.py
                    [notif_settings.email],
                    fail_silently=False,
                )

            return Response(serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
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