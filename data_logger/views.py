from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.contrib import messages
from django.urls import reverse
from django.shortcuts import get_object_or_404
from django.db.models import Case, When, Value, IntegerField
from django.views.decorators.cache import never_cache
from django.utils.formats import date_format
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from rest_framework.authtoken.models import Token
from .utils import get_master_time
from .forms import  MasterClockForm, AutoReportForm
from .models import Device, MasterClock, AutoReportSchedule, AutoReportSettings


DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

@never_cache
def data_logger(request):
    if not request.user.is_authenticated:
        return redirect('login')

    if request.user.role == 'admin':
        device_qs = Device.objects.filter(admin=request.user)
    else:
        device_qs = Device.objects.filter(admin=request.user.admin)

    status_order = Case(
        When(status='working', then=Value(0)),
        When(status='error', then=Value(1)),
        When(status='offline', then=Value(2)),
        default=Value(3),
        output_field=IntegerField()
    )
    devices = device_qs.annotate(status_order=status_order).order_by('status_order', 'name')

    # 🕓 تحديث الحالات والوقت
    for device in devices:
        device.update_status()
    master_time = get_master_time()

    # 🔐 توكن
    token = Token.objects.get(user=request.user).key

    # ⏱️ Auto Report Schedule Logic
    schedules = AutoReportSchedule.objects.all()
    for s in schedules:
        if s.schedule_type == 'weekly' and s.weekday is not None:
            s.day_display = DAY_NAMES[s.weekday]
        elif s.schedule_type == 'monthly' and s.month_day:
            s.day_display = f"Day {s.month_day}"
        else:
            s.day_display = "Daily"

    # ✅ خزن الـ IDs بتاعة الأجهزة المستخدمة
    used_device_ids = set(
        str(device_id)
        for schedule in AutoReportSchedule.objects.prefetch_related('devices')
        for device_id in schedule.devices.values_list('id', flat=True)
    )


    form = AutoReportForm(request.POST or None, used_device_ids=used_device_ids)
    
    auto_report_enabled = AutoReportSettings.objects.get_or_create(id=1)[0].enabled

    if request.method == 'POST' and form.is_valid():
        form.save()
        return redirect('data_logger')  # 👈 بيرجع لنفس الصفحة ويعرض الجدول الجديد

    # 🔁 التعامل مع Ajax refresh
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        data = {
            'current_time': master_time.strftime("%Y-%m-%d %H:%M:%S"),
            'total_devices': devices.count(),
            'data_logger_url': reverse('data_logger'),
            'status_counts': {
                'working': devices.filter(status='working').count(),
                'error': devices.filter(status='error').count(),
                'offline': devices.filter(status='offline').count(),
            },
            'devices': list(devices.values(
                'id', 'name', 'device_id', 'status', 
                'last_update', 'temperature', 'humidity', 
                'wifi_strength', 'sd_card_error',
                'rtc_error', 'temp_sensor_error', 'hum_sensor_error',
                'min_temp', 'max_temp', 'min_hum', 'max_hum', 'interval_wifi', 'interval_local', 'battery_level'
            )),
        }
        return JsonResponse(data)

    # ✅ تجميع كل حاجة في الـ context
    context = {
        'page_title': 'Data Logger',
        'token': token,
        'current_time': master_time,
        'translated_date': date_format(master_time.date(), format='DATE_FORMAT', use_l10n=True),
        'devices': devices,
        'total_devices': devices.count(),
        'current_section': 'data_logger',
        'status_counts': {
            'working': devices.filter(status='working').count(),
            'error': devices.filter(status='error').count(),
            'offline': devices.filter(status='offline').count(),
        },
        'schedules': schedules,
        'form': form,
        'used_device_ids': used_device_ids,
        'auto_report_enabled': auto_report_enabled, 
    }

    return render(request, 'data_logger/data_logger.html', context)

@require_POST
def toggle_auto_report(request):
    setting, _ = AutoReportSettings.objects.get_or_create(id=1)
    setting.enabled = not setting.enabled
    setting.save()
    return redirect('data_logger')

@require_POST
@login_required
def delete_schedule(request, schedule_id):
    schedule = get_object_or_404(AutoReportSchedule, id=schedule_id)

    # صلاحية: admin فقط أو مالك الجهاز؟
    if request.user.role != 'admin':
        messages.error(request, "You don't have permission to delete schedules.")
        return redirect('data_logger')

    schedule.delete()
    messages.success(request, "Schedule deleted successfully.")
    return redirect('data_logger')


@never_cache
def edit_master_clock(request):
    master_clock = MasterClock.objects.first()

    if request.user.role != 'admin':
        return redirect('data_logger')

    if master_clock is None:
        # إذا لا يوجد MasterClock، أنشئ واحد جديد
        master_clock = MasterClock.objects.create()

    if request.method == 'POST':
        form = MasterClockForm(request.POST, instance=master_clock)
        if form.is_valid():
            form.save()
            return redirect('data_logger')
    else:
        form = MasterClockForm(
            instance=master_clock,
            initial={'current_time': master_clock.get_adjusted_time()}
        )

    return render(request, 'data_logger/edit_master_clock.html', {'form': form, 'master_clock': master_clock, 'page_title': 'Edit Server Clock'})

