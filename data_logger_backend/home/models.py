from django.db import models
from django.core.exceptions import ValidationError
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from .utils import get_master_time
from logs.models import DeviceLog
from django.db import models

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

class Device(models.Model):
    STATUS_CHOICES = [
        ('working', 'Working'),
        ('error', 'Error'),
        ('offline', 'Offline'),
    ]
    admin = models.ForeignKey(
        settings.AUTH_USER_MODEL,      # يربط بموديل CustomUser
        on_delete=models.CASCADE,      # لو الأدمن اتحذف، تمسح أجهزته
        related_name='devices',   # تقدر تستخدم user.clock_devices.all()
    )
    id = models.AutoField(primary_key=True)
    device_id = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=100, blank=True, null=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='offline')
    temperature = models.FloatField(null=True, blank=True)
    max_temp = models.FloatField(null=True, blank=True, default=40)
    min_temp = models.FloatField(null=True, blank=True, default=10)
    humidity = models.FloatField(null=True, blank=True)
    max_hum = models.FloatField(null=True, blank=True, default=70)
    min_hum = models.FloatField(null=True, blank=True, default=20)
    temp_sensor_error = models.BooleanField(default=False)
    hum_sensor_error = models.BooleanField(default=False)
    wifi_strength = models.IntegerField(null=True, blank=True)  # قوة الواي فاي (dBm)
    rtc_error = models.BooleanField(default=False)
    sd_card_error = models.BooleanField(default=False)
    last_update = models.DateTimeField(null=True, blank=True)
    firmware_version = models.CharField(max_length=20, default='1.0.0')
    firmware_updated_at = models.DateTimeField(null=True, blank=True, default=None)
    last_calibrated = models.DateTimeField(default=timezone.now)
    interval_wifi = models.IntegerField(default=60)
    interval_local = models.IntegerField(default=60)
    battery_level = models.IntegerField(null=True, blank=True)
    low_battery = models.BooleanField(default=False)

    def __str__(self):
        return self.name or self.device_id
    
    def clean(self):
        if self.interval_wifi < self.interval_local:
            raise ValidationError("interval_wifi يجب أن يكون أقل من أو يساوي interval_local")

    def save(self, *args, **kwargs):
        self.full_clean()  # يقوم بتشغيل الدالة clean() قبل الحفظ
        super().save(*args, **kwargs)
    
    def needs_calibration(self):
        reference_date = self.last_calibrated or self.created_at
        return (timezone.now() - reference_date).days >= 180  # 6 شهور

    def check_connection(self):
        """التحقق من اتصال الجهاز (إذا كان متصلاً خلال آخر 5 دقائق)"""
        return get_master_time() - self.last_update < timedelta(seconds= self.interval_wifi + 120)

    def check_wifi_strength(self):
        """التحقق من قوة إشارة الواي فاي"""
        return self.wifi_strength is None or self.wifi_strength >= -80

    def check_sensors(self):
        temp_error = False
        hum_error = False
        low_battery = False

        if self.temperature is None or self.temperature in [-127, 80]:
            temp_error = True
        elif self.temperature > self.max_temp or self.temperature < self.min_temp:
            temp_error = True

        if self.humidity is None:
            hum_error = True
        elif self.humidity > self.max_hum or self.humidity < self.min_hum:
            hum_error = True
            
        if self.battery_level is None or self.battery_level < 21:
            low_battery = True

        # تحديث حالات الخطأ
        self.temp_sensor_error = temp_error
        self.hum_sensor_error = hum_error
        self.low_battery = low_battery

        return not (temp_error or hum_error or self.rtc_error or self.sd_card_error or self.low_battery)
    

    def update_status(self):
        if self.last_update is None:
            self.status = 'offline'
            self.save()
            return self.status
        """تحديث حالة الجهاز تلقائياً وتسجيل الأخطاء"""
        time_diff = get_master_time() - self.last_update
        is_connected = self.check_connection()
        good_sensors = self.check_sensors()

        # تحديد الحالة الجديدة
        new_status = 'offline' if time_diff >= timedelta(seconds = self.interval_wifi + 120) else (
            'working' if is_connected and good_sensors else 'error'
        )

        previous_status = self.status
        self.status = new_status

        # فقط لو تغيرت الحالة، سجل أو حدث الأخطاء
        if new_status != previous_status:

            if self.sd_card_error:
                if not DeviceLog.objects.filter(device=self, error_type='sd_card_error', resolved=False).exists():
                    DeviceLog.objects.create(
                        device=self,
                        error_type='sd_card_error',
                        message='SD Card Not Working'
                    )
            else:
                DeviceLog.objects.filter(device=self, error_type='sd_card_error', resolved=False).update(resolved=True)

            # ✅ فقط لو كنا شغالين أو في error وبقينا offline → نسجل لوج
            if new_status == 'offline' and previous_status != 'offline':
                DeviceLog.objects.create(
                    device=self,
                    error_type='offline',
                    message=f'Device {self.name or self.device_id} is offline'
                )

            # ✅ لو رجعنا نشتغل، نعتبره تعافي ونقفل اللوج القديم
            elif new_status == 'working':
                DeviceLog.objects.filter(device=self, error_type='offline', resolved=False).update(resolved=True)

            self.save()

        return self.status

class AutoReportSchedule(models.Model):
    SCHEDULE_CHOICES = [
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
    ]

    schedule_type = models.CharField(max_length=10, choices=SCHEDULE_CHOICES, blank=False, null=False)
    weekday = models.IntegerField(null=True, blank=True)  # 0=Monday
    month_day = models.IntegerField(null=True, blank=True)  # 1–31
    email = models.EmailField()
    devices = models.ManyToManyField(Device)
    enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.schedule_type.title()} - {self.email}"
        return f"Auto Report is {'Enabled' if self.enabled else 'Disabled'}"

class AutoReportSettings(models.Model):
    enabled = models.BooleanField(default=True)

    def __str__(self):
        return f"Auto Reports are {'Enabled' if self.enabled else 'Disabled'}"