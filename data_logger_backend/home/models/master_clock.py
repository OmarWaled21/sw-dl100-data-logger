from django.db import models
from django.utils import timezone
from datetime import timedelta

class MasterClock(models.Model):
    time_difference = models.IntegerField(default=0)  # الفرق بالثواني بين الوقت الفعلي والوقت الذي اختاره المستخدم

    def set_time(self, new_time):
        """يحسب الفرق بين الوقت الجديد و timezone.now()"""
        time_diff = int((new_time - timezone.now()).total_seconds())
        self.time_difference = time_diff
        self.save()

    def get_adjusted_time(self):
        """يرجع الوقت المعدل بناءً على الفرق المخزن"""
        return timezone.now() + timedelta(seconds=self.time_difference)
