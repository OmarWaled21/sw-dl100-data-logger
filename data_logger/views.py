from django.shortcuts import render, redirect
from django.http import JsonResponse
from .utils import get_master_time
from .forms import  MasterClockForm
from .models import Device, MasterClock
from rest_framework.authtoken.models import Token
from django.db.models import Case, When, Value, IntegerField
from django.views.decorators.cache import never_cache
from django.urls import reverse
from django.contrib import messages
from django.utils.formats import date_format

@never_cache
def data_logger(request):
    if not request.user.is_authenticated:
        return redirect('login')

    if not request.user.categories.filter(slug='data_logger').exists():
        messages.error(request, "You don't have permission to access this page.")
        return redirect('home')  # أو لأي قسم عنده صلاحية

    if request.user.role == 'admin':
        device_qs  = Device.objects.filter(admin=request.user)
    else:
        device_qs  = Device.objects.filter(admin=request.user.admin)
    
     # ترتيب حسب الحالة: green -> red -> gray
    status_order = Case(
        When(status='working', then=Value(0)),
        When(status='error', then=Value(1)),
        When(status='offline', then=Value(2)),
        default=Value(3),
        output_field=IntegerField()
    )

    devices = device_qs.annotate(status_order=status_order).order_by('status_order', 'name')
    
    # تحديث جميع الحالات قبل عرض الصفحة
    for device in devices:
        device.update_status()
    
    # تحديث الوقت
    master_time = get_master_time()

     # 👇 هنا أضف التوكين للكونتكست
    token = Token.objects.get(user=request.user).key

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
            ))
        }
        return JsonResponse(data)

    context = {
        'page_title': 'Data Logger',
        'token': token,
        'current_time': master_time,  # اعرض الوقت المحدث هنا
        'translated_date': date_format(master_time.date(), format='DATE_FORMAT', use_l10n=True),
        'devices': devices,
        'total_devices': devices.count(),
        'current_section': 'data_logger',
        'status_counts': {
            'working': devices.filter(status='working').count(),
            'error': devices.filter(status='error').count(),
            'offline': devices.filter(status='offline').count(),
        },
    }
    return render(request, 'data_logger/data_logger.html', context)

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

