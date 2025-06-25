# master/utils.py
from django.utils.timezone import now

def get_master_time():
    from .models import MasterClock
    master_clock = MasterClock.objects.first()
    if master_clock:
        adjusted_time = master_clock.get_adjusted_time()  # استرجاع الوقت المعدل
    else:
        adjusted_time = now()  # إذا لم يوجد MasterClock، استخدم الوقت الفعلي

    return adjusted_time