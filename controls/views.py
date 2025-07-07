from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_GET
import json
from datetime import time
from data_logger.utils import get_master_time
from controls.models import LED

control_state = False

def control_view(request):
    now = get_master_time().time()

    for led in LED.objects.filter(schedule_on=True):
        if led.auto_on and led.auto_off:
            if led.auto_on <= now <= led.auto_off:
                if not led.is_on:
                    led.is_on = True
                    led.save()
            else:
                if led.is_on:
                    led.is_on = False
                    led.save()

    leds = LED.objects.all()
    return render(request, "controls/controls_page.html", {"leds": leds})

@csrf_exempt
@require_POST
def toggle_led(request):
  data = json.loads(request.body)
  led_id = data.get("id")

  try:
    led = LED.objects.get(id=led_id)
    led.is_on = not led.is_on
    led.save()
    return JsonResponse({"status": "success", "is_on": led.is_on})
  except LED.DoesNotExist:
    return JsonResponse({"status": "error", "message": "LED not found"}, status=404)


@require_GET
def get_led_state(request):
    led_id = request.GET.get("id")

    if not led_id:
        return JsonResponse({"status": "error", "message": "Missing LED id"}, status=400)

    try:
        led = LED.objects.get(id=led_id)
        return JsonResponse({
            "status": "success",
            "is_on": led.is_on
        })
    except LED.DoesNotExist:
        return JsonResponse({
            "status": "error",
            "message": "LED not found"
        }, status=404)

@csrf_exempt
@require_POST
def toggle_schedule(request):
    data = json.loads(request.body)
    led_id = data.get("id")
    schedule_on = data.get("schedule_on")

    try:
        led = LED.objects.get(id=led_id)
        led.schedule_on = schedule_on
        led.save()
        return JsonResponse({"status": "success", "schedule_on": led.schedule_on})
    except LED.DoesNotExist:
        return JsonResponse({"status": "error", "message": "LED not found"}, status=404)


@csrf_exempt
@require_POST
def update_auto_time(request):
    data = json.loads(request.body)
    led_id = data.get("id")
    field = data.get("field")
    value = data.get("value")

    print("🔧 update_auto_time debug")
    print("LED ID:", led_id)
    print("Field:", field)
    print("Value:", value)

    if field not in ["auto_on", "auto_off"]:
        return JsonResponse({"status": "error", "message": "Invalid field"}, status=400)

    try:
        led = LED.objects.get(id=led_id)

        if not value:
            return JsonResponse({"status": "error", "message": "Empty value"}, status=400)

        # تحويل النص إلى وقت
        try:
            hour, minute = map(int, value.split(":"))
            time_value = time(hour, minute)
        except Exception as e:
            print("⛔ Time conversion error:", e)
            return JsonResponse({"status": "error", "message": "Invalid time format"}, status=400)

        setattr(led, field, time_value)
        led.save()

        print("✅ Time updated successfully")
        return JsonResponse({"status": "success"})

    except LED.DoesNotExist:
        return JsonResponse({"status": "error", "message": "LED not found"}, status=404)

@require_GET
def auto_control_refresh(request):
    now = get_master_time().time()

    for led in LED.objects.filter(schedule_on=True):
        if led.auto_on and led.auto_off:
            if led.auto_on <= now <= led.auto_off:
                if not led.is_on:
                    led.is_on = True
                    led.save()
            else:
                if led.is_on:
                    led.is_on = False
                    led.save()

    leds = LED.objects.all()

    data = [
        {
            "id": led.id,
            "is_on": led.is_on
        }
        for led in leds
    ]

    return JsonResponse({"status": "success", "leds": data})
