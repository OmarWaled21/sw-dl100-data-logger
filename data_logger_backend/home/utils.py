# master/utils.py
from django.utils.timezone import now

def get_master_time():
    from .models.master_clock import MasterClock
    master_clock = MasterClock.objects.first()
    if master_clock:
        adjusted_time = master_clock.get_adjusted_time()  # استرجاع الوقت المعدل
    else:
        adjusted_time = now()  # إذا لم يوجد MasterClock، استخدم الوقت الفعلي

    return adjusted_time   

def get_user_devices(user):
    from .models.device_model import Device

    if user.role == 'admin':
        return Device.objects.filter(admin=user)

    elif user.role == 'manager' and user.department:
        return Device.objects.filter(department=user.department)

    elif user.role in ['user', 'supervisor'] and getattr(user, 'manager', None) and user.manager.department:
        return Device.objects.filter(department=user.manager.department)

    return Device.objects.none() 
    