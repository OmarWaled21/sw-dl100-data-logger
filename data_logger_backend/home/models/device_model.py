from django.db import models
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from django.db import models
from smtplib import SMTPException
from datetime import timedelta
from ..utils import get_master_time
from .departments import Department
from logs.models import DeviceLog, NotificationSettings

# device
class Device(models.Model):
    STATUS_CHOICES = [
        ('working', 'Working'),
        ('error', 'Error'),
        ('offline', 'Offline'),
    ]
    
    TEMPERATURE_TYPE_CHOICES = [
        ('air', 'Air Temperature'),
        ('liquid', 'Liquid Temperature'),
    ]
    
    admin = models.ForeignKey(
        settings.AUTH_USER_MODEL,      # يربط بموديل CustomUser
        on_delete=models.CASCADE,      # لو الأدمن اتحذف، تمسح أجهزته
        related_name='devices_managed',   # تقدر تستخدم user.clock_devices.all()
    )
    id = models.AutoField(primary_key=True)
    device_id = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=100, blank=True, null=True)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name="devices_department")
    
    # ✅ حساسات الحرارة والرطوبة
    has_temperature_sensor = models.BooleanField(default=True, verbose_name="Has Temperature Sensor")
    has_humidity_sensor = models.BooleanField(default=True, verbose_name="Has Humidity Sensor")
    temp_sensor_error = models.BooleanField(default=False)
    hum_sensor_error = models.BooleanField(default=False)
    
    # ✅ نوع الحساس الحراري
    temperature_type = models.CharField(
        max_length=20,
        choices=TEMPERATURE_TYPE_CHOICES,
        blank=True,
        null=True,
        verbose_name="Temperature Type"
    )
    
    # temp
    temperature = models.FloatField(null=True, blank=True)
    max_temp = models.FloatField(null=True, blank=True, default=40)
    min_temp = models.FloatField(null=True, blank=True, default=10)
    
    # humidity
    humidity = models.FloatField(null=True, blank=True)
    max_hum = models.FloatField(null=True, blank=True, default=70)
    min_hum = models.FloatField(null=True, blank=True, default=20)
    
    last_update = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    # firmware
    firmware_version = models.CharField(max_length=20, default='1.0.0')
    firmware_updated_at = models.DateTimeField(null=True, blank=True, default=None)
    last_calibrated = models.DateTimeField(default=get_master_time)

    # intervals
    interval_wifi = models.IntegerField(default=20, help_text="مدة الإرسال عبر WiFi بالدقائق")
    interval_local = models.IntegerField(default=5, help_text="مدة الإرسال المحلي بالدقائق")
    
    # battery
    battery_level = models.IntegerField(null=True, blank=True)
    low_battery = models.BooleanField(default=False)

    def __str__(self):
        return self.name or self.device_id
    
    def clean(self):
        super().clean()

        # ✅ الشرط المطلوب
        if self.interval_wifi < self.interval_local:
            raise ValidationError({
                "interval_wifi": f"قيمة WiFi interval ({self.interval_wifi}) يجب ألا تكون أقل من local interval ({self.interval_local})."
            })
        
        if not self.has_temperature_sensor:
            self.temperature_type = None
            self.temperature = None
        if not self.has_humidity_sensor:
            self.humidity = None
            
         # ✅ لو في نوع حرارة محدد، تأكد من الحدود
        if self.temperature_type == 'air':
            if self.min_temp < 0:
                raise ValidationError({"min_temp": "درجة الحرارة الدنيا للـ Air يجب ألا تقل عن 0°C."})
            if self.max_temp > 100:
                raise ValidationError({"max_temp": "درجة الحرارة العليا للـ Air يجب ألا تتجاوز 100°C."})

        elif self.temperature_type == 'liquid':
            if self.min_temp < -55:
                raise ValidationError({"min_temp": "درجة الحرارة الدنيا للـ Liquid يجب ألا تقل عن -55°C."})
            if self.max_temp > 120:
                raise ValidationError({"max_temp": "درجة الحرارة العليا للـ Liquid يجب ألا تتجاوز 120°C."})

        # ✅ تحقق من أن min_temp < max_temp دائمًا
        if self.has_temperature_sensor and self.min_temp >= self.max_temp:
            raise ValidationError({
                "min_temp": "Min temperature يجب أن تكون أقل من Max temperature.",
                "max_temp": "Max temperature يجب أن تكون أكبر من Min temperature."
            })
    
    def needs_calibration(self):
        reference_date = self.last_calibrated or self.created_at
        return (timezone.now() - reference_date).days >= 180  # 6 شهور

    def check_connection(self):
        """التحقق من اتصال الجهاز (إذا كان متصلاً خلال آخر 5 دقائق)"""
        return get_master_time() - self.last_update < timedelta(minutes= self.interval_wifi + 10)

    def check_sensors(self):
        temp_error = False
        hum_error = False
        low_battery = False

        if self.has_temperature_sensor:
            if self.temperature is None:
                temp_error = True
            # التحقق من وجود قيم للحدود قبل المقارنة
            elif (self.max_temp is not None and self.temperature > self.max_temp) or \
                (self.min_temp is not None and self.temperature < self.min_temp):
                temp_error = True

        if self.has_humidity_sensor:
            if self.humidity is None:
                hum_error = True
            # التحقق من وجود قيم للحدود قبل المقارنة
            elif (self.max_hum is not None and self.humidity > self.max_hum) or \
                (self.min_hum is not None and self.humidity < self.min_hum):
                hum_error = True
                
        if self.battery_level is None or self.battery_level < 21:
            low_battery = True

        return not (temp_error or hum_error or low_battery)

        # تحديث حالات الخطأ
        self.temp_sensor_error = temp_error
        self.hum_sensor_error = hum_error
        self.low_battery = low_battery

        return not (temp_error or hum_error or self.low_battery)
    
    def get_dynamic_status(self):
        """
        يحسب الحالة اللحظية للجهاز:
        - offline لو آخر تحديث أقدم من (interval_wifi + 2 دقائق)
        - error لو الحساسات فيها مشكلة
        - working لو كل حاجة تمام
        """
        if not self.last_update:
            return "offline"

        try:
            time_diff = get_master_time() - self.last_update
        except Exception:
            return "offline"

        if time_diff > timedelta(minutes=self.interval_wifi + 10):
            return "offline"

        good_sensors = self.check_sensors()
        return "working" if good_sensors else "error"
    
    def check_and_log_status(self):
        """
        يتحقق من حالة الجهاز (working/error/offline)
        ويُنشئ أو يغلق Log بناءً على الحالة.
        """
        status = self.get_dynamic_status()

        # ✅ لو الجهاز أوفلاين
        if status == "offline":
            exists = DeviceLog.objects.filter(
                device=self, error_type="offline", resolved=False
            ).exists()

            if not exists:
                log = DeviceLog.objects.create(
                    device=self,
                    error_type="offline",
                    message=f"Device {self.name or self.device_id} is offline.",
                )
                self._send_log_email(log)

        else:
            # ✅ الجهاز رجع شغال → نغلق اللوج المفتوح
            DeviceLog.objects.filter(
                device=self, error_type="offline", resolved=False
            ).update(resolved=True)

        return status

    def _handle_threshold_log(self, value, min_val=None, max_val=None, high_type=None, high_msg=None, low_type=None, low_msg=None):
        """Handle logs for high/low temperature or humidity just like offline"""
        if value is None:
            return

        # High
        if max_val is not None:
            exists = DeviceLog.objects.filter(device=self, error_type=high_type, resolved=False).exists()
            if value > max_val and not exists:
                log = DeviceLog.objects.create(device=self, error_type=high_type, message=high_msg)
                self._send_log_email(log)
            elif value <= max_val:
                DeviceLog.objects.filter(device=self, error_type=high_type, resolved=False).update(resolved=True)

        # Low
        if min_val is not None:
            exists = DeviceLog.objects.filter(device=self, error_type=low_type, resolved=False).exists()
            if value < min_val and not exists:
                log = DeviceLog.objects.create(device=self, error_type=low_type, message=low_msg)
                self._send_log_email(log)
            elif value >= min_val:
                DeviceLog.objects.filter(device=self, error_type=low_type, resolved=False).update(resolved=True)

    def _create_unique_log(self, error_type, message, current_value=None, min_value=None, max_value=None):
        """
        Creates a log if not exists or resolves the previous one if value is back to normal.
        """
        log_qs = DeviceLog.objects.filter(device=self, error_type=error_type, resolved=False)
        
        if log_qs.exists():
            if current_value is not None:
                # Resolve High
                if max_value is not None and current_value <= max_value:
                    log_qs.update(resolved=True)
                # Resolve Low
                elif min_value is not None and current_value >= min_value:
                    log_qs.update(resolved=True)
            return

        # Create new log if still abnormal
        log = DeviceLog.objects.create(
            device=self,
            error_type=error_type,
            message=message
        )
        self._send_log_email(log)
    
    def save(self, *args, **kwargs):
        is_new = self._state.adding
        
        # ✅ نظف البيانات أولاً قبل الحفظ
        self.full_clean()
        
        # ✅ احفظ الجهاز أولاً بدون التعامل مع العلاقات
        super().save(*args, **kwargs)

        # ✅ بعد الحفظ لأول مرة، أضف الجهاز تلقائيًا في NotificationSettings للـ admin
        if is_new:
            from logs.models import NotificationSettings

            # استخدم get_or_create مع update_fields لتجنب أي مشاكل
            notif, created = NotificationSettings.objects.get_or_create(
                user=self.admin, 
                defaults={
                    "email": getattr(self.admin, "email", ""),
                    "gmail_is_active": True,
                },
            )

            # 🎯 استخدم through model مباشرة لتجنب العلاقات العكسية
            through_model = NotificationSettings.devices.through
            through_model.objects.get_or_create(
                notificationsettings_id=notif.id,
                device_id=self.id
            )
            
            print(f"✅ Device {self.device_id} linked to NotificationSettings ({self.admin.username})")


    def _send_log_email(self, log):
        """
        Send email to all users who have Gmail notifications enabled for this device
        """
        # هات كل الإعدادات اللي فيها الجهاز ده ومفعلة
        notif_settings_qs = NotificationSettings.objects.filter(
            gmail_is_active=True,
            devices=self
        ).exclude(email__isnull=True).exclude(email__exact='')

        if not notif_settings_qs.exists():
            return

        # جهز الرسالة
        subject = f"Device Log: {log.device.name or log.device.device_id} - {log.error_type}"
        message = f"""
        Device: {log.device.name or log.device.device_id}
        Timestamp: {log.timestamp.strftime('%Y-%m-%d %H:%M:%S')}
        Type: {log.error_type}
        Message: {log.message or 'No message'}
        """

        # استخرج كل الإيميلات
        recipients = [n.email for n in notif_settings_qs]

        # ابعت الإيميل دفعة واحدة
        try:
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                recipients,
                fail_silently=False,
            )
        except SMTPException as e:
            DeviceLog.objects.create(
                device=self,
                error_type="email_error",
                message=f"Failed to send log email: {e}",
            )
