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
from statistics import mean, mode, StatisticsError
import matplotlib.pyplot as plt
from matplotlib.dates import DateFormatter
import matplotlib
matplotlib.use('Agg')  # مهم جدًا علشان نولد صورة بدون واجهة GUI


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
        start_date_str = request.GET.get('start_date')
        end_date_str = request.GET.get('end_date')

        if start_date_str and end_date_str:
            try:
                start_date = parse_date(start_date_str)
                end_date = parse_date(end_date_str)
                day_start = datetime.combine(start_date, datetime.min.time())
                day_end = datetime.combine(end_date, datetime.max.time())
            except ValueError:
                day_end = get_master_time()
                day_start = day_end - timedelta(days=1)
        else:
            fallback_date = last_reading.timestamp.date() if last_reading else get_master_time().date()
            day_start = datetime.combine(fallback_date, datetime.min.time())
            day_end = datetime.combine(fallback_date, datetime.max.time())


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
                'start_date': start_date_str or day_start.strftime('%Y-%m-%d'),
                'end_date': end_date_str or day_end.strftime('%Y-%m-%d'),
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
            'start_date': start_date_str or day_start.strftime('%Y-%m-%d'),
            'end_date': end_date_str or day_end.strftime('%Y-%m-%d'),
            'battery_icon': battery_icon,
            'battery_class': battery_class,
            'battery_status': battery_status,
            'form': form,
        }
        return render(request, 'device_details/device_details.html', context)
    except Device.DoesNotExist:
        return redirect('data_logger')
    
    
def aggregate_data_for_graph(data_rows):
    from collections import defaultdict

    total_points = len(data_rows)

    if total_points <= 100:
        # استخدم البيانات كما هي
        return [
            {
                'timestamp': datetime.strptime(r['timestamp'], "%Y-%m-%d %H:%M:%S"),
                'temperature': r.get('temperature'),
                'humidity': r.get('humidity')
            }
            for r in data_rows
        ]

    # قرر مستوى التجميع
    if total_points <= 1000:
        group_by = 'hour'
    else:
        group_by = 'day'

    grouped = defaultdict(lambda: {'temp': 0, 'hum': 0, 'count': 0})
    for r in data_rows:
        ts = datetime.strptime(r['timestamp'], "%Y-%m-%d %H:%M:%S")
        if group_by == 'hour':
            key = ts.replace(minute=0, second=0, microsecond=0)
        else:
            key = ts.replace(hour=0, minute=0, second=0, microsecond=0)

        grouped[key]['temp'] += r.get('temperature', 0)
        grouped[key]['hum'] += r.get('humidity', 0)
        grouped[key]['count'] += 1

    # تجهيز المتوسطات
    aggregated_data = []
    for key in sorted(grouped.keys()):
        count = grouped[key]['count']
        aggregated_data.append({
            'timestamp': key,
            'temperature': round(grouped[key]['temp'] / count, 2) if count else None,
            'humidity': round(grouped[key]['hum'] / count, 2) if count else None
        })

    return aggregated_data


def get_summary_stats(values):
    return {
        'max': max(values) if values else None,
        'min': min(values) if values else None,
        'avg': round(mean(values), 2) if values else None,
        'mode': round(mode(values), 2) if values else None if values else None,
    }
    
    
@login_required
def download_device_data_pdf(request, device_id):
    try:
        device = Device.objects.get(device_id=device_id)
    except Device.DoesNotExist:
        return redirect('data_logger')
    
    start_date_str = request.GET.get('start_date')
    end_date_str = request.GET.get('end_date')
    include_temp = request.GET.get('include_temp') == '1'
    include_hum = request.GET.get('include_hum') == '1'

    if start_date_str and end_date_str:
        try:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d")
            start_time = datetime.combine(start_date, datetime.min.time())
            end_time = datetime.combine(end_date, datetime.max.time())
        except ValueError:
            end_time = get_master_time()
            start_time = end_time - timedelta(hours=12)
    else:
        end_time = get_master_time()
        start_time = end_time - timedelta(hours=12)


    # جلب القراءات
    readings = DeviceReading.objects.filter(
        device=device,
        timestamp__gte=start_time,
        timestamp__lte=end_time
    ).order_by('-timestamp')

    # بناء الأعمدة حسب ما هو مطلوب
    data_rows = []
    for r in readings:
        row = {'timestamp': r.timestamp.strftime("%Y-%m-%d %H:%M:%S")}
        if include_temp:
            row['temperature'] = r.temperature
        if include_hum:
            row['humidity'] = r.humidity
        data_rows.append(row)
        
    # تجهيز بيانات الجراف
    graph_data = aggregate_data_for_graph(data_rows)
    timestamps = [row['timestamp'] for row in graph_data]
    temps = [row['temperature'] for row in graph_data if include_temp]
    hums = [row['humidity'] for row in graph_data if include_hum]

    temp_summary = get_summary_stats(temps) if include_temp else None
    hum_summary = get_summary_stats(hums) if include_hum else None

    fig, ax = plt.subplots(figsize=(10, 4))

    if include_temp:
        ax.plot(timestamps, temps, label="Temperature (°C)", color="red", marker='o')
    if include_hum:
        ax.plot(timestamps, hums, label="Humidity (%)", color="blue", marker='x')

    ax.set_title(f"Device Data: {device.name}")
    ax.set_xlabel("Time")
    ax.set_ylabel("Value")
    ax.legend()
    ax.xaxis.set_major_formatter(DateFormatter("%Y-%m-%d\n%H:%M"))

    plt.xticks(rotation=45)
    plt.tight_layout()

    # حفظ الصورة في base64
    img_buffer = io.BytesIO()
    plt.savefig(img_buffer, format="png")
    img_buffer.seek(0)
    graph_base64 = base64.b64encode(img_buffer.getvalue()).decode('utf-8')
    plt.close(fig)

    bar_chart_base64 = None

    if (include_temp and temps) or (include_hum and hums):
        fig, ax = plt.subplots(figsize=(6, 4))

        categories = []
        values = []
        colors = []

        if include_temp:
            categories += ["Temp Max", "Temp Min"]
            values += [temp_summary['max'], temp_summary['min']]
            colors += ["red", "lightcoral"]

        if include_hum:
            categories += ["Hum Max", "Hum Min"]
            values += [hum_summary['max'], hum_summary['min']]
            colors += ["blue", "lightblue"]

        ax.bar(categories, values, color=colors)
        ax.set_title("Temperature & Humidity Extremes")
        ax.set_ylabel("Value")

        buf = io.BytesIO()
        plt.tight_layout()
        plt.savefig(buf, format="png")
        buf.seek(0)
        bar_chart_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close(fig)

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
        'start_date': start_date_str or start_time.strftime('%Y-%m-%d'),
        'end_date': end_date_str or end_time.strftime('%Y-%m-%d'),
        'now': get_master_time(),
        'logo_base64': logo_base64,
        'include_temp': include_temp,
        'include_hum': include_hum,
        'graph_base64': graph_base64,
        'temp_summary': temp_summary,
        'hum_summary': hum_summary,
        'bar_chart_base64': bar_chart_base64,
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
    