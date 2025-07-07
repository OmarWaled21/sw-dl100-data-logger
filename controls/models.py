from django.db import models

# Create your models here.
class LED(models.Model):
    name = models.CharField(max_length=100, default="LED")
    is_on = models.BooleanField(default=False)

    # 🕒 Auto schedule fields
    schedule_on = models.BooleanField(default=False)
    auto_on = models.TimeField(null=True, blank=True)
    auto_off = models.TimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.name} - {'ON' if self.is_on else 'OFF'}"