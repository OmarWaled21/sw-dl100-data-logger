# master/utils.py
from django.utils.timezone import now
from datetime import datetime, timedelta
from statistics import mean, mode
import pytz
from django.core.mail import EmailMessage
from django.conf import settings
from django.db import models

def get_master_time():
    from .models import MasterClock
    master_clock = MasterClock.objects.first()
    if master_clock:
        adjusted_time = master_clock.get_adjusted_time()  # استرجاع الوقت المعدل
    else:
        adjusted_time = now()  # إذا لم يوجد MasterClock، استخدم الوقت الفعلي

    return adjusted_time    
    
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
    
def generate_device_pdf(device, start_time, end_time, include_temp=True, include_hum=True):    
    from weasyprint import HTML
    from django.template.loader import render_to_string
    import matplotlib.pyplot as plt
    from matplotlib.dates import DateFormatter
    from device_details.models import DeviceReading
    from PIL import Image
    import io, base64
    
    # جلب القراءات
    readings = DeviceReading.objects.filter(
        device=device,
        timestamp__gte=start_time,
        timestamp__lte=end_time
    ).order_by('-timestamp')

    data_rows = []
    for r in readings:
        row = {'timestamp': r.timestamp.strftime("%Y-%m-%d %H:%M:%S")}
        if include_temp:
            row['temperature'] = r.temperature
        if include_hum:
            row['humidity'] = r.humidity
        data_rows.append(row)

    graph_data = aggregate_data_for_graph(data_rows)
    timestamps = [row['timestamp'] for row in graph_data]
    temps = [row['temperature'] for row in graph_data if include_temp]
    hums = [row['humidity'] for row in graph_data if include_hum]

    temp_summary = get_summary_stats(temps) if include_temp else None
    hum_summary = get_summary_stats(hums) if include_hum else None

    # خط الرسم
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
    img_buffer = io.BytesIO()
    plt.savefig(img_buffer, format="png")
    img_buffer.seek(0)
    graph_base64 = base64.b64encode(img_buffer.getvalue()).decode('utf-8')
    plt.close(fig)

    # بار جراف
    bar_chart_base64 = None
    if (include_temp and temps) or (include_hum and hums):
        fig, ax = plt.subplots(figsize=(6, 4))
        categories, values, colors = [], [], []
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

    context = {
        'device': device,
        'rows': data_rows,
        'start_date': start_time.strftime('%Y-%m-%d'),
        'end_date': end_time.strftime('%Y-%m-%d'),
        'now': get_master_time(),
        'include_temp': include_temp,
        'include_hum': include_hum,
        'graph_base64': graph_base64,
        'temp_summary': temp_summary,
        'hum_summary': hum_summary,
        'bar_chart_base64': bar_chart_base64,
    }

    html_string = render_to_string('device_details/device_data_pdf.html', context)
    return HTML(string=html_string).write_pdf()


def run_auto_reports():
    from data_logger.models import AutoReportSettings, AutoReportSchedule

    now = datetime.now(pytz.timezone(settings.TIME_ZONE))
    weekday = now.weekday()
    day = now.day
    
    settings_obj, _ = AutoReportSettings.objects.get_or_create(id=1)
    if not settings_obj.enabled:
        return  # كله متوقف

    schedules = AutoReportSchedule.objects.filter(
        enabled=True
        ).filter(    
            models.Q(schedule_type='daily') |
            models.Q(schedule_type='weekly', weekday=weekday) |
            models.Q(schedule_type='monthly', month_day=day)
        )

    for schedule in schedules:
        send_scheduled_report(schedule)

def send_scheduled_report(schedule):
    start_time = datetime.now() - timedelta(days=1)
    end_time = datetime.now()

    attachments = []

    for device in schedule.devices.all():
        pdf = generate_device_pdf(device, start_time, end_time)
        filename = f"{device.name}_{start_time.date()}.pdf"
        attachments.append((filename, pdf, 'application/pdf'))

    subject = "Device Auto Report"
    body = "Attached are the device reports for your selected schedule."

    email = EmailMessage(
        subject=subject,
        body=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[schedule.email],
    )
    for file in attachments:
        email.attach(*file)

    email.send(fail_silently=False)
