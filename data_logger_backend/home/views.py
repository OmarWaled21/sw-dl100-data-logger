from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Device, MasterClock
from device_details.models import DeviceReading
from .serializers import DeviceSerializer, MasterClockSerializer, DeviceReadingSerializer
from .utils import get_master_time


class DataLoggerListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role == 'admin':
            device_qs = Device.objects.filter(admin=user)
        else:
            device_qs = Device.objects.filter(admin=user.admin)

        devices = list(device_qs)  # تحويل queryset لقائمة
        for device in devices:
            device.status = device.get_dynamic_status()  # أو استخدم property لو عملتها

        # ترتيب حسب status
        status_order = {'offline': 0, 'error': 1, 'working': 2}  # حسب الأولوية اللي تحبها
        devices.sort(key=lambda d: status_order.get(d.status, 3))
        
        serialized = DeviceSerializer(devices, many=True)

        master_clock = MasterClock.objects.first()
        time_difference = master_clock.time_difference if master_clock else 0

        data = {
            'current_time': get_master_time().strftime("%Y-%m-%d %H:%M:%S"),
            'time_difference': time_difference,
            'devices': serialized.data
        }
        return Response({"message": "Getting Data Logger Data Successfully", "results": data})


class EditMasterClockView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role != 'admin':
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
