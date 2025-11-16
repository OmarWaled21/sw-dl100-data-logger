from datetime import timedelta
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models.device_model import Device
from .models.departments import Department
from .models.master_clock import MasterClock
from .models.esp_discovery import ESPDiscovery
from device_details.models import DeviceReading
from .serializers import DeviceSerializer, MasterClockSerializer, DeviceReadingSerializer, DepartmentSerializer
from .utils import get_master_time

class DepartmentListView(APIView):
    def get(self, request):
        departments = Department.objects.all()
        serializer = DepartmentSerializer(departments, many=True)
        return Response(serializer.data)

class DataLoggerListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, device_id=None):  
        user = request.user
        department_id = request.query_params.get('department_id')

        # --- Admin يشوف الأجهزة الخاصة بيه فقط
        if user.role == 'admin':
            device_qs = Device.objects.filter(admin=user)
            if department_id:
                device_qs = device_qs.filter(department_id=department_id)

        # --- Manager يشوف الأجهزة الخاصة بفريقه    
        elif user.role == 'manager':
            if user.department:
                device_qs = Device.objects.filter(department=user.department)
            else:
                return Response({'message': 'Manager has no assigned department'}, status=400)

        # --- Supervisor/User يشوف الأجهزة الخاصة بقسمه
        elif user.role in ['user', 'supervisor']:
            if user.manager and user.manager.department:
                device_qs = Device.objects.filter(department=user.manager.department)
            else:
                return Response({'message': 'Manager has no assigned department'}, status=400)

        else:
            return Response({'message': 'Unauthorized role'}, status=403)

        # ✅ لو فيه device_id، نجيب جهاز واحد فقط
        if device_id:
            device = device_qs.filter(device_id__iexact=device_id).first()
            if not device:
                return Response({'message': 'Device not found'}, status=404)

            master_clock = MasterClock.objects.first()
            time_difference = master_clock.time_difference if master_clock else 0

            data = {
                "message": "Getting Device Data Successfully",
                "current_time": get_master_time().strftime("%Y-%m-%d %H:%M:%S"),
                "name": device.name,
                "min_temp": device.min_temp,
                "max_temp": device.max_temp,
                "min_hum": device.min_hum,
                "max_hum": device.max_hum,
                "interval_wifi": device.interval_wifi,
                "interval_local": device.interval_local,
            }
            return Response(data)

        # ✅ لو مفيش device_id، نرجع كل الأجهزة
        devices = list(device_qs)
        for device in devices:
            device.status = device.get_dynamic_status()

        # ترتيب حسب status
        status_order = {'offline': 0, 'error': 1, 'working': 2}
        devices.sort(key=lambda d: status_order.get(d.status, 3))

        serialized = DeviceSerializer(devices, many=True)

        master_clock = MasterClock.objects.first()
        time_difference = master_clock.time_difference if master_clock else 0

        data = {
            'current_time': get_master_time().strftime("%Y-%m-%d %H:%M:%S"),
            'time_difference': time_difference,
            'devices': serialized.data
        }
        return Response({
            "message": "Getting Data Logger Data Successfully",
            "results": data
        })

    def post(self, request):
        """
        ESP sends one or multiple readings (temperature, humidity, time)
        and optionally a battery_level field
        """
        data = request.data
        device_id = data.get('device_id')
        battery_level = data.get('battery_level')
        readings = data.get('readings')

        if not device_id:
            return Response({'message': 'device_id is required'}, status=400)

        try:
            device = Device.objects.get(device_id=device_id)
        except Device.DoesNotExist:
            return Response({'message': 'Device not found'}, status=404)

        # ✅ تحديث مستوى البطارية لو اتبعت
        if battery_level is not None:
            device.battery_level = battery_level

        created_readings = []

        if readings and isinstance(readings, list):
            for r in readings:
                temperature = r.get('t')
                humidity = r.get('h')
                reading_time = r.get('time')

                from datetime import datetime
                from django.utils.timezone import now

                try:
                    timestamp = datetime.strptime(reading_time, "%Y-%m-%d %H:%M:%S")
                except Exception:
                    timestamp = now()

                # تجاهل لو الجهاز مش فيه الحساس ده
                if not device.has_temperature_sensor:
                    temperature = None
                if not device.has_humidity_sensor:
                    humidity = None

                # لازم يكون فيه على الأقل قيمة واحدة
                if all(v is None for v in [temperature, humidity]):
                    continue

                reading = DeviceReading.objects.create(
                    device=device,
                    temperature=temperature,
                    humidity=humidity,
                    timestamp=timestamp
                )
                created_readings.append(reading)

                # تحديث آخر القيم
                if temperature is not None:
                    device.temperature = temperature
                if humidity is not None:
                    device.humidity = humidity

                device.last_update = timestamp

        # حفظ كل التغييرات مرة واحدة
        device.save()

        return Response({
            'success': True,
            'count': len(created_readings),
            'message': f'{len(created_readings)} readings saved successfully',
            'device_id': device.device_id,
            'last_update': device.last_update.strftime("%Y-%m-%d %H:%M:%S")
        }, status=201)
    
class AddDeviceView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        data = request.data.copy()  # خليه copy عشان نقدر نعدّل فيه
        data.pop("devices", None)   # 🧹 احذف المفتاح devices لو موجود

        device_id = data.get("device_id")
        name = data.get("name")
        min_temp = data.get("min_temp")
        max_temp = data.get("max_temp")
        min_hum = data.get("min_hum")
        max_hum = data.get("max_hum")

        # ✅ الحساسات
        has_temperature_sensor = data.get("has_temperature_sensor", True)
        has_humidity_sensor = data.get("has_humidity_sensor", True)
        temperature_type = data.get("temperature_type")  # air/liquid

        # ✅ تحقق من الـ ID
        if not device_id:
            return Response({"message": "device_id is required"}, status=400)

        if Device.objects.filter(device_id=device_id).exists():
            return Response({"message": "Device with this ID already exists"}, status=400)

        # ✅ department
        if user.role == "admin":
            department_id = data.get("department_id")
            if not department_id:
                return Response({"message": "department_id is required for admin"}, status=400)
            try:
                department = Department.objects.get(id=department_id)
            except Department.DoesNotExist:
                return Response({"message": "Invalid department"}, status=400)
            admin_user = user

        elif user.role == "manager":
            department = user.department
            if not department:
                return Response({"message": "Manager has no department assigned"}, status=400)
            admin_user = getattr(user, "manager", None)
            if not admin_user:
                return Response({"message": "Manager is not linked to an admin"}, status=400)
        else:
            return Response({"message": "Unauthorized"}, status=403)

        # ✅ لو مفيش حساس حرارة، احذف نوع الحرارة
        if not has_temperature_sensor:
            temperature_type = None

        default_temp = 0 if has_temperature_sensor else None
        default_hum = 0 if has_humidity_sensor else None
        
        # ✅ إنشاء الجهاز
        try:
            device = Device.objects.create(
                admin=admin_user,
                device_id=device_id,
                name=name,
                department=department,
                has_temperature_sensor=has_temperature_sensor,
                has_humidity_sensor=has_humidity_sensor,
                temperature_type=temperature_type,
                min_temp=min_temp,
                max_temp=max_temp,
                min_hum=min_hum,
                max_hum=max_hum,
                temperature=default_temp,
                humidity=default_hum,
                last_update=get_master_time(),
            )
        except Exception as e:
            return Response({"message": f"Failed to create device: {str(e)}"}, status=400)
        
        serializer = DeviceSerializer(device)
        return Response(
            {
                "success": True,
                "message": "Device added successfully",
                "results": serializer.data,
            },
            status=201,
        )

class IsRegisteredView(APIView):
    permission_classes = []  # ممكن تخليها مفتوحة عشان ESP يقدر يسأل

    def get(self, request, device_id):
        exists = Device.objects.filter(device_id=device_id).exists()
        return Response({"registered": exists})

class DiscoveryListView(APIView):
    permission_classes = []

    def get(self, request):
        # نحذف الأجهزة القديمة (اللي عدّى عليها 10 ثواني بدون تحديث)
        ESPDiscovery.objects.filter(
            created_at__lt=get_master_time() - timedelta(seconds=10)
        ).delete()

        # نرجّع الأجهزة النشطة حاليًا
        discovered_esps = ESPDiscovery.objects.filter(is_linked=False).order_by('-created_at')
        data = [
            {"device_id": e.device_id, "created_at": e.created_at}
            for e in discovered_esps
        ]
        return Response({"count": len(data), "results": data})

    def post(self, request):
        device_id = request.data.get("device_id")
        if not device_id:
            return Response({"message": "device_id is required"}, status=400)

        # لو موجود، حدّث وقت آخر discover
        esp, created = ESPDiscovery.objects.update_or_create(
            device_id=device_id,
            defaults={
                "is_linked": False,
                "created_at": get_master_time(),
            }
        )

        return Response(
            {"success": True, "message": "Device discovered successfully"},
            status=201 if created else 200
        )
        
class EditMasterClockView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role != 'admin' and user.role != 'manager':
            return Response({'message': 'Unauthorized'}, status=403)

        master_clock = MasterClock.objects.first()
        if master_clock is None:
            master_clock = MasterClock.objects.create()

        try:
            time_diff = int(request.data.get('time_difference'))
        except (TypeError, ValueError):
            return Response({'message': 'Invalid or missing time_difference (must be int)'}, status=400)

        master_clock.time_difference = time_diff
        master_clock.save()

        serializer = MasterClockSerializer(master_clock)
        return Response({'success': True, 'message': 'Master clock updated successfully', 'results': serializer.data})


class DeviceReadingView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            device_id = request.data.get('device_id')
            temperature = float(request.data.get('temperature'))
            humidity = float(request.data.get('humidity'))
            time = get_master_time()
        except (TypeError, ValueError):
            return Response({'message': 'Invalid or missing fields'}, status=400)

        try:
            device = Device.objects.get(device_id=device_id)
        except Device.DoesNotExist:
            return Response({'message': 'Device not found'}, status=404)

        reading = DeviceReading.objects.create(
            device=device,
            temperature=temperature,
            humidity=humidity,
            timestamp=time
        )

        serializer = DeviceReadingSerializer(reading)
        return Response({'success': True, 'message': 'Device reading added successfully', 'results': serializer.data})


class FirmwareUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        device_id = request.data.get('device_id')
        firmware_version = request.data.get('firmware_version')

        if not device_id or not firmware_version:
            return Response({'message': 'Missing device_id or firmware_version'}, status=400)

        try:
            device = Device.objects.get(device_id=device_id)
        except Device.DoesNotExist:
            return Response({'message': 'Device not found'}, status=404)

        device.firmware_version = firmware_version
        device.firmware_updated_at = get_master_time()
        device.save()

        return Response({
            'success': True,
            'message': 'Firmware version updated successfully',
            'results': {
                'device_id': device.device_id,
                'firmware_version': device.firmware_version,
                'firmware_updated_at': device.firmware_updated_at
            }
        })
