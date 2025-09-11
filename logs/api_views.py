from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.http import HttpResponse
from weasyprint import HTML
from PIL import Image
import io
import base64
from logs.models import DeviceLog, AdminLog
from .serializers import DeviceLogSerializer, AdminLogSerializer
from data_logger.utils import get_master_time
from datetime import datetime, timedelta
from django.template.loader import render_to_string

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_get_logs(request):
    device_id = request.GET.get('device_id')
    filter_date = request.GET.get('filter_date')
    error_types = request.GET.getlist('error_type')

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
        except ValueError as e:
            return Response({'message': f'Invalid date: {e}'}, status=400)

    if error_types and 'All' not in error_types:
        device_logs = device_logs.filter(error_type__in=error_types)

    device_logs_serialized = DeviceLogSerializer(device_logs, many=True).data
    user_logs_serialized = AdminLogSerializer(user_logs, many=True).data

    all_logs = device_logs_serialized + user_logs_serialized
    all_logs.sort(key=lambda log: log['timestamp'], reverse=True)

    return Response({'message': 'Getting all logs Successfully', 'results': all_logs})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_download_logs_pdf(request):
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



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_device_log(request):
    serializer = DeviceLogSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)