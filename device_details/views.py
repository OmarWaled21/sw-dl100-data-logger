from django.shortcuts import render, redirect
from .forms import DeviceForm
from data_logger.models import Device
from data_logger.utils import get_master_time
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from datetime import datetime, timedelta
from data_logger.models import DeviceReading
from django.contrib import messages
from collections import defaultdict
from django.utils.dateparse import parse_date
from django.http import HttpResponse
from weasyprint import HTML
from PIL import Image
import io
from django.template.loader import render_to_string
import base64

def calculate_hourly_averages(readings):
    # مجموعة البيانات حسب كل ساعة
    hourly_data = defaultdict(lambda: {'temp_sum': 0, 'hum_sum': 0, 'count': 0})

    for r in readings:
        local_time = local_time = r.timestamp
        hour_key = local_time.replace(minute=0, second=0, microsecond=0)  # الوقت مضبوط على بداية الساعة
        hourly_data[hour_key]['temp_sum'] += r.temperature
        hourly_data[hour_key]['hum_sum'] += r.humidity
        hourly_data[hour_key]['count'] += 1

    # حساب المتوسط لكل ساعة وترتيب النتائج حسب الوقت
    sorted_hours = sorted(hourly_data.keys())
    labels = []
    avg_temps = []
    avg_hums = []

    for hour in sorted_hours:
        data = hourly_data[hour]
        labels.append(hour.strftime("%Y-%m-%d %H:%M"))
        avg_temps.append(data['temp_sum'] / data['count'])
        avg_hums.append(data['hum_sum'] / data['count'])

    return labels, avg_temps, avg_hums

# Create your views here.
@login_required
def device_details(request, device_id):
    try:
        device = Device.objects.get(device_id=device_id)
        device.update_status()  # مهم يحدث حالته قبل ما نرجع البيانات

        # تحديث الوقت
        master_time = get_master_time()
        
        battery_level = device.battery_level or 0
        status = device.status or "offline"

        if status == 'offline':
            battery_icon = 'fa-battery-empty'
            battery_class = 'text-dark'
            battery_status = 'Offline'
        elif battery_level >= 75:
            battery_icon = 'fa-battery-full'
            battery_class = 'text-success'
            battery_status = 'Good Battery'
        elif battery_level >= 50:
            battery_icon = 'fa-battery-three-quarters'
            battery_class = 'text-success'
            battery_status = 'Good Battery'
        elif battery_level >= 25:
            battery_icon = 'fa-battery-half'
            battery_class = 'text-warning'
            battery_status = 'Medium Battery'
        elif battery_level >= 10:
            battery_icon = 'fa-battery-quarter'
            battery_class = 'text-danger'
            battery_status = 'Low Battery'
        else:
            battery_icon = 'fa-battery-empty'
            battery_class = 'text-danger'
            battery_status = 'Low Battery'

        # جلب آخر قراءة
        last_reading = DeviceReading.objects.filter(device=device).order_by('-timestamp').first()

        if last_reading:
            end_time = last_reading.timestamp
            start_time = end_time - timedelta(hours=12)
        else:
            # لو ما فيش قراءات خذ الوقت الحالي كـ end_time عشان ما يطلعش خطأ
            end_time = get_master_time()
            start_time = end_time - timedelta(hours=12)
            
        chart_readings = DeviceReading.objects.filter(
            device=device,
            timestamp__gte=start_time,
            timestamp__lte=end_time
        ).order_by('timestamp')

        chart_labels, chart_temp_data, chart_hum_data = calculate_hourly_averages(chart_readings)
       
        # ========== كل القراءات للجدول ==========
        # قراءة التاريخ من طلب الـ GET
        date_str = request.GET.get('filter_date')

        if date_str:
            filter_date = parse_date(date_str)
        else:
            # إذا لم يحدد المستخدم، نعتمد تاريخ آخر قراءة أو اليوم
            filter_date = last_reading.timestamp.date() if last_reading else get_master_time().date()

        # بداية ونهاية اليوم المختار للتصفية
        day_start = datetime.combine(filter_date, datetime.min.time())
        day_end = datetime.combine(filter_date, datetime.max.time())

        # تصفية القراءات للجدول حسب التاريخ المختار
        filtered_readings = DeviceReading.objects.filter(
            device=device,
            timestamp__gte=day_start,
            timestamp__lte=day_end
        ).order_by('-timestamp')

        combined_data = [
            (r.timestamp.strftime("%Y-%m-%d %H:%M:%S"), r.temperature, r.humidity) 
            for r in filtered_readings
        ]

        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            data = {
                'name': device.name,
                'status': device.status,
                'temperature': device.temperature,
                'min_temp': device.min_temp,
                'max_temp': device.max_temp,
                'humidity': device.humidity,
                'min_hum': device.min_hum,
                'max_hum': device.max_hum,
                'wifi_strength': device.wifi_strength,
                'last_update': device.last_update.strftime("%Y-%m-%d %H:%M:%S"),
                'sd_card_error': device.sd_card_error,
                'rtc_error': device.rtc_error,
                'temp_sensor_error': device.temp_sensor_error,
                'hum_sensor_error': device.hum_sensor_error,
                'current_time': master_time.strftime("%Y-%m-%d %H:%M:%S"),  # إضافة الوقت المحدث للـ response
                'interval_wifi': device.interval_wifi,
                'interval_local': device.interval_local,
                # أضف بيانات الجراف هنا
                'labels': chart_labels,
                'temp_data': chart_temp_data,
                'hum_data': chart_hum_data,
                'combined_data': combined_data,
                'filter_date': filter_date.strftime('%Y-%m-%d'),
                # البطارية
                'battery_icon': battery_icon,
                'battery_class': battery_class,
                'battery_status': battery_status,
                'battery_level': device.battery_level
            }
            return JsonResponse(data)
        
        
        if request.method == 'POST':
            form = DeviceForm(request.POST, instance=device)
            if form.is_valid():
                form.save()
                return redirect('device_details', device_id=device.device_id)
            else: 
                print(form.errors)
        else:
            form = DeviceForm(instance=device)  # ✅ هذا السطر يحل المشكلة

                
        context = {
            'device': device,
            'page_title': 'Device Details',
            'current_time': master_time,  # اعرض الوقت المحدث هنا
            'labels': chart_labels,
            'temp_data': chart_temp_data,
            'hum_data': chart_hum_data,
            'combined_data': combined_data,
            'filter_date': filter_date.strftime('%Y-%m-%d'),  # ✅ أضف هذا السطر
            'battery_icon': battery_icon,
            'battery_class': battery_class,
            'battery_status': battery_status,
            'form': form,
        }
        return render(request, 'device_details/device_details.html', context)
    except Device.DoesNotExist:
        return redirect('data_logger')
    
    

@login_required
def download_device_data_pdf(request, device_id):
    try:
        device = Device.objects.get(device_id=device_id)
    except Device.DoesNotExist:
        return redirect('data_logger')

    filter_date = request.GET.get('filter_date')
    
    if filter_date:
        try:
            # بداية ونهاية اليوم بالتوقيت الموحد
            naive_start = datetime.strptime(filter_date, "%Y-%m-%d")
            start_time = datetime.combine(naive_start, datetime.min.time())
            end_time = datetime.combine(naive_start, datetime.max.time())
        except ValueError:
            start_time = get_master_time().replace(hour=0, minute=0, second=0, microsecond=0)
            end_time = start_time + timedelta(days=1)
    else:
        # بدون فلترة نأخذ آخر 12 ساعة كافتراضي
        end_time = get_master_time()
        start_time = end_time - timedelta(hours=12)

    # جلب القراءات
    readings = DeviceReading.objects.filter(
        device=device,
        timestamp__gte=start_time,
        timestamp__lte=end_time
    ).order_by('-timestamp')

    data_rows = [
        {
            'timestamp': r.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            'temperature': r.temperature,
            'humidity': r.humidity
        } for r in readings
    ]

    # تجهيز اللوجو (اختياري)
    logo_path = 'static/images/tomatiki_logo.png'
    with Image.open(logo_path) as img:
        img.thumbnail((150, 150))
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        logo_base64 = base64.b64encode(img_bytes.getvalue()).decode('utf-8')

    context = {
        'device': device,
        'rows': data_rows,
        'filter_date': filter_date,
        'now': get_master_time(),
        'logo_base64': logo_base64,
    }

    html_string = render_to_string('device_details/device_data_pdf.html', context)
    pdf_file = HTML(string=html_string).write_pdf()

    response = HttpResponse(pdf_file, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="device_data_{device.device_id}.pdf"'
    return response

    
@login_required
def delete_device(request, device_id):
    try:
        device = Device.objects.get(id=device_id)
        if(device.admin != request.user):
            return redirect('data_logger')
        # مثلا لو الجهاز مرتبط بمستخدم معين يمكن تتحقق هنا
        
        if request.method == 'POST':
            device.delete()
            messages.success(request, 'Device has been deleted successfully.')
            return redirect('device_details' , device_id=device.id)  # أو صفحة أخرى بعد الحذف

    except Device.DoesNotExist:
        messages.error(request, 'Device not found.')
        return redirect('data_logger')
    