from django.shortcuts import render, redirect
from django.http import JsonResponse
from logs.models import  DeviceLog, AdminLog
from django.http import HttpResponse
from weasyprint import HTML
from PIL import Image
import io
from django.template.loader import render_to_string
import base64
from datetime import timedelta
from data_logger.utils import get_master_time
from datetime import datetime
from data_logger.models import Device

def logs_view(request):
    device_id = request.GET.get('device_id')
    filter_date = request.GET.get('filter_date')
    error_types = request.GET.getlist('error_type')

    # الحصول على السجلات الأساسية حسب صلاحية المستخدم
    if request.user.role == 'admin':
        device_logs = DeviceLog.objects.filter(device__admin=request.user).select_related('device')
        user_logs = AdminLog.objects.filter(admin=request.user)
    else:
        device_logs = DeviceLog.objects.filter(device__admin=request.user.admin).select_related('device')
        user_logs = AdminLog.objects.filter(admin=request.user.admin, user=request.user)

    # فلترة حسب الجهاز إذا تم تحديده
    if device_id:
        device_logs = device_logs.filter(device__id=device_id)

    # فلترة حسب التاريخ مع معالجة أفضل للتاريخ
    if filter_date:
        try:
            # تحويل التاريخ إلى بداية اليوم بالتوقيت الموحد
            base_master_time = get_master_time()
            naive_start_date = datetime.strptime(filter_date, "%Y-%m-%d")
            start_date = base_master_time.replace(
                year=naive_start_date.year,
                month=naive_start_date.month,
                day=naive_start_date.day,
                hour=0,
                minute=0,
                second=0,
                microsecond=0
            )
            end_date = start_date + timedelta(days=1)

            # فلترة باستخدام توقيت الماستر
            device_logs = device_logs.filter(timestamp__gte=start_date, timestamp__lt=end_date)
            user_logs = user_logs.filter(timestamp__gte=start_date, timestamp__lt=end_date)
        except ValueError as e:
            print(f"خطأ في تحويل التاريخ: {e}")
            
            # تطبيق الفلترة على النطاق الزمني
            device_logs = device_logs.filter(timestamp__gte=start_date, timestamp__lt=end_date)
            user_logs = user_logs.filter(timestamp__gte=start_date, timestamp__lt=end_date)
        except ValueError as e:
            print(f"خطأ في تحويل التاريخ: {e}")
                
    if error_types and 'All' not in error_types:
        device_logs = device_logs.filter(error_type__in=error_types)

    # جمع السجلات وترتيبها
    all_logs = list(device_logs) + list(user_logs)
    if not all_logs:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'html': '<tr><td colspan="4" class="text-center py-4">No logs found for selected date</td></tr>'})
        return render(request, 'logs/logs.html', {'logs': []})

    all_logs = [log.get_log_info() for log in all_logs]
    all_logs.sort(key=lambda log: log['timestamp'], reverse=True)

    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        html = render_to_string('logs_rows.html', {'logs': all_logs})
        return JsonResponse({'html': html})

    # استخرج الأجهزة المرتبطة بالمستخدم
    if request.user.role == 'admin':
        devices = DeviceLog.objects.filter(device__admin=request.user).values_list('device', flat=True).distinct()
    else:
        devices = DeviceLog.objects.filter(device__admin=request.user.admin).values_list('device', flat=True).distinct()

    # نحصل على كائنات الأجهزة من IDs
    devices = Device.objects.filter(id__in=devices)

    return render(request, 'logs/logs.html', {
        'logs': all_logs,
        'devices': devices,  # ← دي علشان نعرضهم في الـ HTML
        'page_title': 'Log History'
    })



def download_logs_pdf(request):
    if not request.user.is_authenticated:
        return redirect('login')
    
    device_id = request.GET.get('device_id')
    filter_date = request.GET.get('filter_date')

    # Get logs based on user role
    if request.user.role == 'admin':
        device_logs = DeviceLog.objects.filter(device__admin=request.user)
        user_logs = AdminLog.objects.filter(admin=request.user)
    else:
        device_logs = DeviceLog.objects.filter(device__admin=request.user.admin)
        user_logs = AdminLog.objects.filter(admin=request.user.admin, user=request.user)

    if device_id:
        device_logs = device_logs.filter(device__id=device_id)

    if filter_date:
        try:
            filter_date_obj = datetime.strptime(filter_date, "%Y-%m-%d")
            device_logs = device_logs.filter(timestamp__date=filter_date_obj.date())
            user_logs = user_logs.filter(timestamp__date=filter_date_obj.date())
        except ValueError:
            pass

    # دمج الـ logs في قائمة واحدة (لو عايز تعرضهم مع بعض)
    all_logs = list(device_logs) + list(user_logs)
    all_logs = [log.get_log_info() for log in all_logs]  # ← دي أهم خطوة
    all_logs.sort(key=lambda log: log['timestamp'], reverse=True)

    context = {
        'logs': all_logs,
        'now': get_master_time(),
    }

    # Render HTML template
    html_string = render_to_string('logs/logs_pdf.html', context)
    
    # Create PDF
    html = HTML(string=html_string)
    result = html.write_pdf()

    # Create HTTP response with PDF
    response = HttpResponse(result, content_type='application/pdf')
    response['Content-Disposition'] = 'attachment; filename="device_logs.pdf"'
    
    return response
