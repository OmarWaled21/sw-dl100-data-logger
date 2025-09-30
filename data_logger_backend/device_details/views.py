from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from rest_framework import status
from django.utils.dateparse import parse_date
from django.utils import timezone
from django.template.loader import render_to_string
from home.models import Device
from home.utils import get_master_time
from home.serializers import DeviceSerializer
from .models import ControlFeaturePriority, DeviceControl, DeviceReading
from collections import defaultdict
from weasyprint import HTML
from datetime import datetime, timedelta, time


class DeviceAPIView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    
    def calculate_hourly_averages(self, readings):
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

    def get_device(self, device_id, user=None):
        try:
            device = Device.objects.get(device_id=device_id)
            if user and device.admin != user:
                raise PermissionDenied("Not authorized for this device.")
            return device
        except Device.DoesNotExist:
            return None

    # GET - Device readings averages
    def get(self, request, device_id=None):
        if device_id:
            # Device readings averages
            if 'averages' in request.path:
                return self.device_readings_averages(request, device_id)
            # Device details
            elif 'details' in request.path or request.path.endswith(f"/{device_id}/"):
                return self.api_device_details(request, device_id)
            # Device readings
            elif 'readings' in request.path:
                return self.device_readings_api(request, device_id)
            # Device dashboard data
            elif 'dashboard' in request.path:
                return self.device_dashboard_data(request, device_id)
            # Download PDF
            elif 'download' in request.path:
                return self.download_device_data_pdf_api(request, device_id)
            # Auto control refresh
            elif 'auto-control' in request.path:
                return self.auto_control_refresh(request, device_id)
            # Get device control info
            elif 'control-info' in request.path:
                return self.get_device_control_info(request, device_id)
            # Get temperature settings
            elif 'temp-settings' in request.path:
                return self.get_temp_settings(request, device_id)
            # Get priority settings
            elif 'priority-settings' in request.path:
                return self.get_priority_settings(request, device_id)
        
        return Response({'error': 'Endpoint not found'}, status=status.HTTP_404_NOT_FOUND)

    # POST - Add device, toggle, update settings, etc.
    def post(self, request, device_id=None):
        if device_id:
            # Toggle device
            if 'toggle' in request.path:
                return self.toggle_device(request, device_id)
            # Toggle schedule
            elif 'toggle-schedule' in request.path:
                return self.toggle_schedule(request, device_id)
            # Update auto time
            elif 'update-auto-time' in request.path:
                return self.update_auto_time(request, device_id)
            # Update temperature settings
            elif 'update-temp-settings' in request.path:
                return self.update_temp_settings(request, device_id)
            # Update priority settings
            elif 'update-priority-settings' in request.path:
                return self.update_priority_settings(request, device_id)
            # Confirm device action
            elif 'confirm-action' in request.path:
                return self.confirm_device_action(request)
        
        # Add device (no device_id in path)
        return self.add_device(request)

    # PUT - Edit device
    def put(self, request, device_id):
        return self.edit_device(request, device_id)

    # DELETE - Delete device
    def delete(self, request, device_id):
        return self.delete_device_api(request, device_id)

    # ========== Individual Method Implementations ==========

    def device_readings_averages(self, request, device_id):
        device = self.get_device(device_id)
        if not device:
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

        labels, avg_temps, avg_hums = self.calculate_hourly_averages(readings)

        data = {
            'device_name': device.name,
            'labels': labels,
            'avg_temperatures': avg_temps,
            'avg_humidities': avg_hums,
        }

        return Response(data)

    def delete_device_api(self, request, device_id):
        device = self.get_device(device_id, request.user)
        if not device:
            return Response({'detail': 'Device not found.'}, status=status.HTTP_404_NOT_FOUND)
        
        device.delete()
        return Response({'detail': 'Device deleted successfully.'}, status=status.HTTP_204_NO_CONTENT)

    def edit_device(self, request, device_id):
        device = self.get_device(device_id, request.user)
        if not device:
            return Response({'error': 'Device not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = DeviceSerializer(device, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def add_device(self, request):
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
            return Response({'error': 'Device already exists'}, status=status.HTTP_400_BAD_REQUEST)

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

    def api_device_details(self, request, device_id):
        try:
            device = Device.objects.get(device_id=device_id)
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

    def device_readings_api(self, request, device_id):
        device = self.get_device(device_id)
        if not device:
            return Response({'error': 'Device not found'}, status=status.HTTP_404_NOT_FOUND)

        # جلب كل القراءات
        readings = DeviceReading.objects.filter(device=device).order_by('-timestamp')

        # فلترة حسب single date أو range
        filter_date = request.GET.get('filter_date')
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')

        message = "All readings"

        try:
            if filter_date:
                # single date
                fd = parse_date(filter_date)
                if not fd:
                    raise ValueError("Invalid date format")
                day_start = datetime.combine(fd, time.min)
                day_end = datetime.combine(fd, time.max)
                readings = readings.filter(timestamp__gte=day_start, timestamp__lte=day_end)
                message = f"Readings for {fd.strftime('%Y-%m-%d')}"

            elif start_date and end_date:
                # date range
                sd = parse_date(start_date)
                ed = parse_date(end_date)
                if not sd or not ed:
                    raise ValueError("Invalid date format")
                start_dt = datetime.combine(sd, time.min)
                end_dt = datetime.combine(ed, time.max)
                readings = readings.filter(timestamp__gte=start_dt, timestamp__lte=end_dt)
                message = f"Readings from {sd.strftime('%Y-%m-%d')} to {ed.strftime('%Y-%m-%d')}"
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, 
                            status=status.HTTP_400_BAD_REQUEST)

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
    def device_dashboard_data(self, request, device_id):
        device = self.get_device(device_id)
        if not device:
            return Response({'error': 'Device not found'}, status=status.HTTP_404_NOT_FOUND)

        device.update_status()

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

    def download_device_data_pdf_api(self, request, device_id):
        device = self.get_device(device_id)
        if not device:
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

    def auto_control_refresh(self, request, device_id):
        master_now = get_master_time()
        current_time = master_now.time()

        controls = DeviceControl.objects.filter(device__device_id=device_id, device__admin=request.user)

        for control in controls:
            if control.auto_pause_until and master_now < control.auto_pause_until:
                continue
            if control.auto_pause_until and master_now >= control.auto_pause_until:
                control.auto_pause_until = None
                control.save()

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

            if desired_state is not None and control.is_on != desired_state:
                if desired_state is True:
                    last_seen = control.last_seen
                    if last_seen and get_master_time() - last_seen < timedelta(seconds=30):
                        control.is_on = desired_state
                        control.last_confirmed_state = desired_state
                        control.save()
                    else:
                        print(f"⚠️ Device {control.device.device_id} is offline. Skipping ON action.")
                elif desired_state is False:
                    control.is_on = desired_state
                    control.last_confirmed_state = desired_state
                    control.save()

        data = [
            {
                "device_id": control.device.device_id,
                "is_on": control.is_on,
                "pending_confirmation": control.pending_confirmation
            }
            for control in controls
        ]

        return Response({"status": "success", "device_controls": data})

    def toggle_device(self, request, device_id):
        try:
            device = Device.objects.get(device_id=device_id, admin=request.user)
            control, _ = DeviceControl.objects.get_or_create(device=device)
        except Device.DoesNotExist:
            return Response({"error": "Device not found"}, status=404)

        control.is_on = not control.is_on
        control.last_confirmed_state = control.is_on
        control.auto_pause_until = get_master_time() + timedelta(hours=1)
        control.save()

        return Response({"status": "ok", "new_state": control.is_on})

    def get_device_control_info(self, request, device_id):
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

    def toggle_schedule(self, request, device_id):
        auto_schedule = str(request.data.get("auto_schedule")).lower() in ["true", "1"]
        try:
            device = Device.objects.get(device_id=device_id, admin=request.user)
            control, _ = DeviceControl.objects.get_or_create(device=device)
            control.auto_schedule = auto_schedule
            control.save()
            
            return Response({"status": "success", "auto_schedule": control.auto_schedule})
        except Device.DoesNotExist:
            return Response({"error": "Device not found"}, status=404)

    def update_auto_time(self, request, device_id):
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
            return Response({"status": "error", "message": str(e)}, status=400)

    def get_temp_settings(self, request, device_id):
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

    def update_temp_settings(self, request, device_id):
        try:
            device = Device.objects.get(device_id=device_id, admin=request.user)
            control = device.control
        except Device.DoesNotExist:
            return Response({"error": "Device not found"}, status=404)

        data = request.data

        try:
            temp_control_enabled = data.get("temp_control_enabled")
            if temp_control_enabled is not None:
                control.temp_control_enabled = str(temp_control_enabled).lower() in ['true', '1']

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

    def update_priority_settings(self, request, device_id):
        try:
            device = Device.objects.get(device_id=device_id, admin=request.user)
            control = device.control
        except Device.DoesNotExist:
            return Response({"error": "Device not found"}, status=404)

        priorities = request.data.get("priorities", [])
        if not priorities:
            return Response({"error": "No priorities provided"}, status=400)

        control.feature_priorities.all().delete()

        for item in priorities:
            ControlFeaturePriority.objects.create(
                control=control,
                feature=item["feature"],
                priority=item["priority"]
            )

        return Response({"status": "success"})

    def get_priority_settings(self, request, device_id):
        try:
            device = Device.objects.get(device_id=device_id, admin=request.user)
            control = device.control
        except Device.DoesNotExist:
            return Response({"error": "Device not found"}, status=404)

        priorities = control.feature_priorities.order_by("priority").values("feature", "priority")
        return Response({"priorities": list(priorities)})

    def confirm_device_action(self, request):
        device_id = request.data.get('device_id')
        status_val = request.data.get('status')  # "on" or "off"

        try:
            device = Device.objects.get(device_id=device_id)
            control = DeviceControl.objects.get(device=device)

            control.is_on = True if status_val == "on" else False
            control.last_confirmed_state = control.is_on
            control.pending_confirmation = False
            control.confirmation_deadline = None
            control.save()

            print(f"✅ Confirmation from device {device_id}: {status_val}")
            return Response({'status': 'ok'}, status=200)

        except Device.DoesNotExist:
            return Response({'error': 'Device not found'}, status=404)