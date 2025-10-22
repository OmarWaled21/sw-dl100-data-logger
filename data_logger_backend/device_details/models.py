from django.db import models
from home.models.device_model import Device
from home.utils import get_master_time

class DeviceReading(models.Model):
    device = models.ForeignKey('home.Device', on_delete=models.CASCADE)
    temperature = models.FloatField()
    humidity = models.FloatField()
    timestamp = models.DateTimeField(default=get_master_time)

    def __str__(self):
        return f"{self.device.name} - {self.timestamp}"
    

class DeviceControl(models.Model):
    PRIORITY_CHOICES = [
        ('schedule', 'Auto Schedule'),
        ('temp', 'Temperature Control'),
        # ممكن تضيف غيرهم في المستقبل
    ]
    
    device = models.OneToOneField(Device, on_delete=models.CASCADE, related_name='control')
    name = models.CharField(max_length=50, default='Relay')
    is_on = models.BooleanField(default=False)

    # Auto schedule fields
    auto_schedule = models.BooleanField(default=False)
    auto_on = models.TimeField(null=True, blank=True)
    auto_off = models.TimeField(null=True, blank=True)
    auto_pause_until = models.DateTimeField(null=True, blank=True)
    
    # ✅ Temperature-based control
    temp_control_enabled = models.BooleanField(default=False)
    temp_on_threshold = models.FloatField(null=True, blank=True)
    temp_off_threshold = models.FloatField(null=True, blank=True) 
        
    # Priority control
    control_priority = models.CharField(
        max_length=10,
        choices=PRIORITY_CHOICES,
        default='schedule',
        help_text="Control priority: 'schedule' or 'temp'"
    )
    
    pending_confirmation = models.BooleanField(default=False)
    confirmation_deadline = models.DateTimeField(null=True, blank=True)
    last_seen = models.DateTimeField(null=True, blank=True)
    last_confirmed_state = models.BooleanField(default=False)

    def confirm_action(self):
        self.pending_confirmation = False
        self.confirmation_deadline = None
        self.last_seen = None
        self.save()

    def __str__(self):
        return f"{self.device.name or self.device.device_id} - {self.name}: {'On' if self.is_on else 'Off'}"

class ControlFeaturePriority(models.Model):
    control = models.ForeignKey(DeviceControl, on_delete=models.CASCADE, related_name="feature_priorities")
    feature = models.CharField(max_length=50)  # مثلاً: auto_schedule, temp_control, humidity_control
    priority = models.PositiveIntegerField()

    class Meta:
        unique_together = ("control", "feature")
        ordering = ["priority"]

    def __str__(self):
        return f"{self.control.device.device_id} - {self.feature} (Priority: {self.priority})"
