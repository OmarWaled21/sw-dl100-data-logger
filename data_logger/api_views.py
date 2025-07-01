from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Device, MasterClock
from device_details.models import DeviceReading
from .serializers import DeviceSerializer, MasterClockSerializer, DeviceReadingSerializer
from .utils import get_master_time

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_data_logger_data(request):
    user = request.user
    if user.role == 'admin':
        device_qs = Device.objects.filter(admin=user)
    else:
        device_qs = Device.objects.filter(admin=user.admin)

    for device in device_qs:
        device.update_status()

    devices = device_qs.order_by('status')

    serialized = DeviceSerializer(devices, many=True)
    
    # ⏱️ الحصول على time_difference
    master_clock = MasterClock.objects.first()
    time_difference = master_clock.time_difference if master_clock else 0
    
    data = {
        'current_time': get_master_time().strftime("%Y-%m-%d %H:%M:%S"),
        'time_difference': time_difference,
        'devices': serialized.data
    }
    return Response({"message": "Getting Data Logger Data Successfully","results": data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_edit_master_clock(request):
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
    return Response({'success': True, 'message': 'Master clock updated successfully' ,'results': serializer.data})



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_add_device_reading(request):
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
        timestamp = time
    )

    serializer = DeviceReadingSerializer(reading)
    return Response({'success': True, 'message': 'Device reading added successfully' ,'results': serializer.data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_update_firmware_info(request):
    try:
        device_id = request.data.get('device_id')
        firmware_version = request.data.get('firmware_version')
    except:
        return Response({'message': 'Missing device_id or firmware_version'}, status=400)

    try:
        device = Device.objects.get(device_id=device_id)
    except Device.DoesNotExist:
        return Response({'message': 'Device not found'}, status=404)

    # تحديث البيانات
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
