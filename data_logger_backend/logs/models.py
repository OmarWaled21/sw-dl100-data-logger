from django.conf import settings
from django.db import models
from home.utils import get_master_time

# Create your models here.
class DeviceLog(models.Model):
    device = models.ForeignKey('home.Device', on_delete=models.CASCADE)
    department = models.ForeignKey('home.Department', on_delete=models.SET_NULL, null=True, blank=True)
    timestamp = models.DateTimeField(default=get_master_time)
    error_type = models.CharField(max_length=100)
    message = models.TextField(blank=True, null=True)
    sent = models.BooleanField(default=False)
    resolved = models.BooleanField(default=False)
    is_read = models.BooleanField(default=False)
    
    def save(self, *args, **kwargs):
        if self.device and not self.department:
            self.department = self.device.department
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.device.name or self.device.device_id} - {self.error_type} - {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}"
    
    def get_log_info(self):
        return {
            'id': self.id,
            'source': self.device.name or self.device.device_id,
            'timestamp': self.timestamp,
            'error_type': self.error_type,
            'message': self.message,
        }
        
    
class AdminLog(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='logs'
    )
    admin = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='admin_logs',
        limit_choices_to={'role': 'admin'}
    )
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='manager_logs',
        limit_choices_to={'role': 'manager'}
    )

    timestamp = models.DateTimeField(default=get_master_time)
    action = models.CharField(max_length=50)  # مثل: login, logout
    message = models.TextField(blank=True, null=True)
    sent = models.BooleanField(default=False)
    is_read = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        """
        ضبط القيم تلقائيًا بناءً على نوع المستخدم:
        - لو Admin → admin=None, manager=None
        - لو Manager → admin=user.admin
        - لو Supervisor/User → admin=user.admin, manager=أقرب مدير فوقه
        """
        from authentication.models import CustomUser  # import محلي لتجنب circular import

        # احسب الـ admin دايمًا
        if self.user.role == 'admin':
            self.admin = None
            self.manager = None

        elif self.user.role == 'manager':
            self.admin = self.user.admin
            self.manager = None

        else:
            # user or supervisor
            self.admin = self.user.admin
            # نحاول نلاقي المانجر اللي هو تبعه
            # (ممكن تكون العلاقة غير مباشرة من خلال admin.sub_users)
            possible_manager = CustomUser.objects.filter(
                role='manager',
                admin=self.user.admin,
                department=getattr(self.user, 'department', None)
            ).first()
            self.manager = possible_manager

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.username} - {self.action} - {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}"

    def get_log_info(self):
        return {
            'id': self.id,
            'source': f"{self.user.username} ({self.user.role})",
            'user': self.user.username,
            'role': self.user.role,
            'timestamp': self.timestamp,
            'type': self.action,
            'message': self.message,
            'admin': self.admin.username if self.admin else None,
            'manager': self.manager.username if self.manager else None,
        }
        
class NotificationSettings(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    devices = models.ManyToManyField("home.Device", blank=True, related_name="notified_users")

    gmail_is_active = models.BooleanField(default=False)
    email = models.EmailField(blank=True, null=True)
    report_time = models.TimeField(default="09:00")
    local_is_active = models.BooleanField(default=True, editable=False)  # دايمًا شغالة

    def save(self, *args, **kwargs):
        # إذا email فاضي، عيّنه على user.email
        if not self.email:
            self.email = self.user.email
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.username} Notifications"