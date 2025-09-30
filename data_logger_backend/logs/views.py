from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from weasyprint import HTML
from .models import DeviceLog, AdminLog
from .serializers import DeviceLogSerializer, AdminLogSerializer
from home.utils import get_master_time
from datetime import datetime, timedelta
from django.template.loader import render_to_string


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

    @action(detail=False, methods=['get'])
    def logs_pdf(self, request):
        """GET /logs_pdf/ - Download logs as PDF"""
        device_id = request.GET.get('device_id')
        filter_date = request.GET.get('filter_date')

        user = request.user
        if user.role == 'admin':
            device_logs = DeviceLog.objects.filter(device__admin=user)
            user_logs = AdminLog.objects.filter(admin=user)
        else:
            device_logs = DeviceLog.objects.filter(device__admin=user.admin)
            user_logs = AdminLog.objects.filter(admin=user.admin, user=user)

        if device_id:
            device_logs = device_logs.filter(device__id=device_id)

        if filter_date:
            try:
                filter_date_obj = datetime.strptime(filter_date, "%Y-%m-%d")
                device_logs = device_logs.filter(timestamp__date=filter_date_obj.date())
                user_logs = user_logs.filter(timestamp__date=filter_date_obj.date())
            except ValueError:
                pass

        all_logs = [log.get_log_info() for log in device_logs] + [log.get_log_info() for log in user_logs]
        all_logs.sort(key=lambda log: log['timestamp'], reverse=True)

        context = {
            'logs': all_logs,
            'now': get_master_time(),
        }

        html_string = render_to_string('logs/logs_pdf.html', context)
        pdf = HTML(string=html_string).write_pdf()

        response = HttpResponse(pdf, content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="device_logs.pdf"'
        return response

    @action(detail=False, methods=['post'])
    def create_log(self, request):
        """POST /create_log/ - Create new device log"""
        serializer = DeviceLogSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
