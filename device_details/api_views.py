from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from rest_framework import status
from django.utils.dateparse import parse_date
from django.utils import timezone
from django.template.loader import render_to_string
from data_logger.models import Device
from data_logger.utils import get_master_time
from data_logger.serializers import DeviceSerializer
from device_details.models import ControlFeaturePriority, DeviceControl, DeviceReading
from collections import defaultdict
from weasyprint import HTML
from datetime import datetime, timedelta, time
from device_details.mqtt_client import send_mqtt_command

def calculate_hourly_averages(readings):
    hourly_data = defaultdict(lambda: {'temp_sum': 0, 'hum_sum': 0, 'count': 0})

    for r in readings:
        ts = r.timestamp
        if timezone.is_naive(ts):
            ts = timezone.make_aware(ts, timezone.get_current_timezone())
        hour_key = ts.replace(minute=0, second=0, microsecond=0)
        hourly_data[hour_key]['temp_sum'] += r.temperature
        hourly_data[hour_key]['hum_sum'] += r.humidity
        hourly_data[hour_key]['count'] += 1

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

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def device_readings_averages(request, device_id):
    try:
        device = Device.objects.get(device_id=device_id)
    except Device.DoesNotExist:
        return Response({'error': 'Device not found'}, status=404)

    last_reading = DeviceReading.objects.filter(device=device).order_by('-timestamp').first()

    if last_reading:
        end_time = last_reading.timestamp
        start_time = end_time - timedelta(hours=12)
    else:
        end_time = get_master_time()
        start_time = end_time - timedelta(hours=12)

    readings = DeviceReading.objects.filter(
        device=device,
        timestamp__gte=start_time,
        timestamp__lte=end_time
    ).order_by('timestamp')

    labels, avg_temps, avg_hums = calculate_hourly_averages(readings)

    data = {
        'device_name': device.name,
        'labels': labels,
        'avg_temperatures': avg_temps,
        'avg_humidities': avg_hums,
    }

    return Response(data)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_device_api(request, device_id):
    try:
        # جلب الجهاز حسب device_id النصي
        device = Device.objects.get(device_id=device_id)
        
        # تحقق من أن المستخدم هو المسؤول (Admin) عن الجهاز
        if device.admin != request.user:
            return Response({'detail': 'Not authorized to delete this device.'}, status=status.HTTP_403_FORBIDDEN)
        
        device.delete()
        return Response({'detail': 'Device deleted successfully.'}, status=status.HTTP_204_NO_CONTENT)
    
    except Device.DoesNotExist:
        return Response({'detail': 'Device not found.'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['PUT'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def edit_device(request, device_id):
    try:
        device = Device.objects.get(device_id=device_id)
    except Device.DoesNotExist:
        return Response({'error': 'Device not found'}, status=status.HTTP_404_NOT_FOUND)

    if device.admin != request.user:
        raise PermissionDenied("Not authorized to edit this device.")

    serializer = DeviceSerializer(device, data=request.data, partial=True)  # partial=True لو عايز تحديث جزئي
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    else:
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def add_device(request):
    device_id = request.data.get('device_id')
    name = request.data.get('name')
    temperature = request.data.get('temperature')
    humidity = request.data.get('humidity')
    wifi_strength = request.data.get('wifi_strength')
    last_update = request.data.get('last_update')
    

    if not device_id:
        return Response({'error': 'device_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    user = request.user
    device = Device.objects.filter(device_id=device_id).first()

    if device:
        # إذا كان الجهاز موجود بالفعل، نعرض رسالة تفيد بذلك بدلاً من تحديثه
        return Response({'error': 'Device already exists'}, status=status.HTTP_400_BAD_REQUEST)

    # إذا لم يكن الجهاز موجودًا، نقوم بإضافته
    device = Device.objects.create(
        device_id=device_id,
        admin=user,
        name=name,
        temperature=temperature,
        wifi_strength=wifi_strength,
        humidity=humidity,
        last_update=last_update
    )

    serializer = DeviceSerializer(device)
    return Response(serializer.data, status=status.HTTP_201_CREATED)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_device_details(request, device_id):
    try:
        device = Device.objects.get(device_id=device_id)  # 👈 استخدم device_id بدل id
        device.update_status()
        
        serializer = DeviceSerializer(device)
        
        return Response({
            "message": "Device details retrieved successfully",
            "results": serializer.data
        })

    except Device.DoesNotExist:
        return Response({
            "message": "Device not found"
        }, status=status.HTTP_404_NOT_FOUND)

    except Exception as e:
        return Response({
            "message": f"An error occurred: {str(e)}"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def device_readings_api(request, device_id):
    try:
        device = Device.objects.get(device_id=device_id)
    except Device.DoesNotExist:
        return Response({'error': 'Device not found'}, status=status.HTTP_404_NOT_FOUND)

    # Handle date filtering
    date_str = request.GET.get('filter_date')
    
    if date_str:
        try:
            filter_date = parse_date(date_str)
            if not filter_date:
                raise ValueError("Invalid date format")
            
            # Filter for specific day
            day_start = datetime.combine(filter_date, datetime.min.time())
            day_end = datetime.combine(filter_date, datetime.max.time())
            
            readings = DeviceReading.objects.filter(
                device=device,
                timestamp__gte=day_start,
                timestamp__lte=day_end
            ).order_by('-timestamp')
            
            message = f"Readings for {filter_date.strftime('%Y-%m-%d')}"
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, 
                          status=status.HTTP_400_BAD_REQUEST)
    else:
        # Default to last 12 hours if no filter
        end_time = get_master_time()
        start_time = end_time - timedelta(hours=12)
        
        readings = DeviceReading.objects.filter(
            device=device,
            timestamp__gte=start_time,
            timestamp__lte=end_time
        ).order_by('-timestamp')
        
        message = "Last 12 hours readings"

    # Prepare response data
    combined_data = [
        {
            'timestamp': r.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            'temperature': r.temperature,
            'humidity': r.humidity
        } for r in readings
    ]

    response_data = {
        'device_id': device.device_id,
        'device_name': device.name,
        'message': message,
        'readings': combined_data,
        'current_time': get_master_time().strftime("%Y-%m-%d %H:%M:%S")
    }

    return Response(response_data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def device_dashboard_data(request, device_id):
    try:
        device = Device.objects.get(device_id=device_id)
        device.update_status()
    except Device.DoesNotExist:
        return Response({'error': 'Device not found'}, status=status.HTTP_404_NOT_FOUND)

    # Get device status data
    status_data = {
        'name': device.name,
        'status': device.status,
        'temperature': device.temperature,
        'humidity': device.humidity,
        'min_temp': device.min_temp,
        'max_temp': device.max_temp,
        'min_hum': device.min_hum,
        'max_hum': device.max_hum,
        'interval_wifi': device.interval_wifi,
        'interval_local': device.interval_local,
        'battery_level': device.battery_level,
        'wifi_strength': device.wifi_strength,
        'last_update': device.last_update.strftime("%Y-%m-%d %H:%M:%S"),
        'errors': {
            'sd_card': device.sd_card_error,
            'rtc': device.rtc_error,
            'temp_sensor': device.temp_sensor_error,
            'hum_sensor': device.hum_sensor_error
        }
    }

    return Response(status_data)


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def download_device_data_pdf_api(request, device_id):
    try:
        device = Device.objects.get(device_id=device_id)
    except Device.DoesNotExist:
        return Response({'error': 'Device not found'}, status=404)

    filter_date = request.GET.get('filter_date')
    
    if filter_date:
        try:
            naive_start = datetime.strptime(filter_date, "%Y-%m-%d")
            start_time = datetime.combine(naive_start, datetime.min.time())
            end_time = datetime.combine(naive_start, datetime.max.time())
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=400)
    else:
        end_time = get_master_time()
        start_time = end_time - timedelta(hours=12)

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

    context = {
        'device': device,
        'rows': data_rows,
        'filter_date': filter_date,
        'now': get_master_time(),
    }

    html_string = render_to_string('device_details/device_data_pdf.html', context)
    pdf_file = HTML(string=html_string).write_pdf()

    response = HttpResponse(pdf_file, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="device_data_{device.device_id}.pdf"'
    return response


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def auto_control_refresh(request, device_id):
    master_now = get_master_time()
    current_time = master_now.time()

    controls = DeviceControl.objects.filter(device__device_id=device_id, device__admin=request.user)

    for control in controls:
        # ⏸ Pause Check
        if control.auto_pause_until and master_now < control.auto_pause_until:
            continue
        if control.auto_pause_until and master_now >= control.auto_pause_until:
            control.auto_pause_until = None
            control.save()


        # ✅ Decision logic
        priority_features = list(control.feature_priorities.order_by("priority").values_list("feature", flat=True))
        desired_state = None
        decision_made = False

        for feature in priority_features:
            if feature == "temp_control" and control.temp_control_enabled:
                temperature = control.device.temperature
                if control.temp_on_threshold is not None and temperature >= control.temp_on_threshold:
                    desired_state = True
                    decision_made = True
                elif control.temp_off_threshold is not None and temperature <= control.temp_off_threshold:
                    desired_state = False
                    decision_made = True
                break
            elif feature == "auto_schedule" and control.auto_schedule:
                if control.auto_on and control.auto_off:
                    if control.auto_on <= current_time <= control.auto_off:
                        desired_state = True
                    else:
                        desired_state = False
                    decision_made = True
                break

        # fallback
        if not decision_made:
            if control.control_priority == "temp" and control.temp_control_enabled:
                temperature = control.device.temperature
                if control.temp_on_threshold is not None and temperature >= control.temp_on_threshold:
                    desired_state = True
                elif control.temp_off_threshold is not None and temperature <= control.temp_off_threshold:
                    desired_state = False
            elif control.control_priority == "schedule" and control.auto_schedule:
                if control.auto_on and control.auto_off:
                    if control.auto_on <= current_time <= control.auto_off:
                        desired_state = True
                    else:
                        desired_state = False

        # ✅ Apply only if change is needed
        if desired_state is not None and control.is_on != desired_state:
            # ⛔ Check if device is online before turning ON
            if desired_state is True:
                last_seen = control.last_seen
                if last_seen and get_master_time() - last_seen < timedelta(seconds=30):
                    control.is_on = desired_state
                    control.last_confirmed_state = desired_state
                    control.save()
                    send_mqtt_command(device_id=control.device.device_id, state=desired_state)
                else:
                    print(f"⚠️ Device {control.device.device_id} is offline. Skipping ON action.")
            elif desired_state is False:
                control.is_on = desired_state
                control.last_confirmed_state = desired_state
                control.save()
                send_mqtt_command(device_id=control.device.device_id, state=False)

    # ✅ Return current states
    data = [
        {
            "device_id": control.device.device_id,
            "is_on": control.is_on,
            "pending_confirmation": control.pending_confirmation
        }
        for control in controls
    ]

    return Response({"status": "success", "device_controls": data})

@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def toggle_device(request, device_id):
    try:
        device = Device.objects.get(device_id=device_id, admin=request.user)
        control, _ = DeviceControl.objects.get_or_create(device=device)
    except Device.DoesNotExist:
        return Response({"error": "Device not found"}, status=404)

    # Toggle the current state
    control.is_on = not control.is_on
    control.last_confirmed_state = control.is_on

    # ⏸ Pause auto control for 1 hour
    control.auto_pause_until = get_master_time() + timedelta(hours=1)

    control.save()

    send_mqtt_command(device_id=device.device_id, state=control.is_on)

    return Response({"status": "ok", "new_state": control.is_on})

@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def get_device_control_info(request, device_id):
    try:
        device = Device.objects.get(device_id=device_id, admin=request.user)
        control, _ = DeviceControl.objects.get_or_create(device=device)
    except Device.DoesNotExist:
        return Response({"error": "Device not found"}, status=404)

    return Response({
        "device_id": device.device_id,
        "device_name": device.name,
        "is_on": control.is_on,
        "name": control.name,
        "auto_schedule": control.auto_schedule,
        "auto_on": control.auto_on.strftime('%H:%M') if control.auto_on else None,
        "auto_off": control.auto_off.strftime('%H:%M') if control.auto_off else None,
        "pending_confirmation": control.pending_confirmation,
        "last_confirmed_state": control.last_confirmed_state
    })


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def toggle_schedule(request, device_id):
    auto_schedule = str(request.data.get("auto_schedule")).lower() in ["true", "1"]
    print("Request data:", request.data)
    try:
        device = Device.objects.get(device_id=device_id, admin=request.user)
        control, _ = DeviceControl.objects.get_or_create(device=device)
        control.auto_schedule = auto_schedule
        control.save()
        
        return Response({"status": "success", "auto_schedule": control.auto_schedule})
    except Device.DoesNotExist:
        return Response({"error": "Device not found"}, status=404)


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def update_auto_time(request, device_id):
    auto_on = request.data.get("auto_on")
    auto_off = request.data.get("auto_off")
    auto_schedule = str(request.data.get("auto_schedule")).lower() in ["true", "1"]

    try:
        device = Device.objects.get(device_id=device_id, admin=request.user)
        control, _ = DeviceControl.objects.get_or_create(device=device)

        control.auto_schedule = auto_schedule

        if auto_on:
            hour, minute = map(int, auto_on.split(":"))
            control.auto_on = time(hour, minute)

        if auto_off:
            hour, minute = map(int, auto_off.split(":"))
            control.auto_off = time(hour, minute)

        control.save()

        return Response({
            "status": "success",
            "auto_schedule": control.auto_schedule,
            "auto_on": control.auto_on.strftime('%H:%M') if control.auto_on else None,
            "auto_off": control.auto_off.strftime('%H:%M') if control.auto_off else None,
            "is_on": control.is_on
        })

    except Device.DoesNotExist:
        return Response({"status": "error", "message": "Device not found"}, status=404)
    except Exception as e:
        print("⛔ Error:", e)
        return Response({"status": "error", "message": str(e)}, status=400)
    

# ✅ Get current temperature control settings
@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def get_temp_settings(request, device_id):
    try:
        device = Device.objects.get(device_id=device_id, admin=request.user)
        control = DeviceControl.objects.get(device=device)

    except Device.DoesNotExist:
        return Response({"error": "Device not found"}, status=404)

    return Response({
        "temp_control_enabled": control.temp_control_enabled,
        "temp_on_threshold": control.temp_on_threshold,
        "temp_off_threshold": control.temp_off_threshold
    })


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def update_temp_settings(request, device_id):
    try:
        device = Device.objects.get(device_id=device_id, admin=request.user)
        control = device.control
    except Device.DoesNotExist:
        return Response({"error": "Device not found"}, status=404)

    data = request.data

    try:
        # 🟡 تأكد إنك بتحول boolean صح
        temp_control_enabled = data.get("temp_control_enabled")
        if temp_control_enabled is not None:
            control.temp_control_enabled = str(temp_control_enabled).lower() in ['true', '1']

        # 🟡 حول الـ threshold لو مش فاضي
        temp_on_threshold = data.get("temp_on_threshold")
        if temp_on_threshold not in [None, ""]:
            control.temp_on_threshold = float(temp_on_threshold)
        else:
            control.temp_on_threshold = None

        temp_off_threshold = data.get("temp_off_threshold")
        if temp_off_threshold not in [None, ""]:
            control.temp_off_threshold = float(temp_off_threshold)
        else:
            control.temp_off_threshold = None

        control.save()
        return Response({"status": "success"})

    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=400)


@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def update_priority_settings(request, device_id):
    try:
        device = Device.objects.get(device_id=device_id, admin=request.user)
        control = device.control
    except Device.DoesNotExist:
        return Response({"error": "Device not found"}, status=404)

    priorities = request.data.get("priorities", [])
    if not priorities:
        return Response({"error": "No priorities provided"}, status=400)

    # امسح الأولويات القديمة
    control.feature_priorities.all().delete()

    # خزّن الأولويات الجديدة
    for item in priorities:
        ControlFeaturePriority.objects.create(
            control=control,
            feature=item["feature"],
            priority=item["priority"]
        )

    return Response({"status": "success"})

@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def get_priority_settings(request, device_id):
    try:
        device = Device.objects.get(device_id=device_id, admin=request.user)
        control = device.control
    except Device.DoesNotExist:
        return Response({"error": "Device not found"}, status=404)

    priorities = control.feature_priorities.order_by("priority").values("feature", "priority")
    return Response({"priorities": list(priorities)})

@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def confirm_device_action(request):
    device_id = request.data.get('device_id')
    status = request.data.get('status')  # "on" or "off"

    try:
        device = Device.objects.get(device_id=device_id)
        control = DeviceControl.objects.get(device=device)

        # ✅ ثبت الحالة الفعلية اللي الجهاز نفذها
        control.is_on = True if status == "on" else False
        control.last_confirmed_state = control.is_on  # ✅ سجل الحالة المؤكدة
        control.pending_confirmation = False
        control.confirmation_deadline = None
        control.save()

        print(f"✅ Confirmation from device {device_id}: {status}")
        return Response({'status': 'ok'}, status=200)

    except Device.DoesNotExist:
        return Response({'error': 'Device not found'}, status=404)

