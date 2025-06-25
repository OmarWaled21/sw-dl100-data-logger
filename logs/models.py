from django.conf import settings
from django.db import models
from data_logger.utils import get_master_time

# Create your models here.
class DeviceLog(models.Model):
    device = models.ForeignKey('data_logger.Device', on_delete=models.CASCADE)
    timestamp = models.DateTimeField(default=get_master_time)
    error_type = models.CharField(max_length=100)
    message = models.TextField(blank=True, null=True)
    sent = models.BooleanField(default=False)
    resolved = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.device.name or self.device.device_id} - {self.error_type} - {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}"
    
    def get_log_info(self):
        return {
            'id': self.id,
            'source': self.device.name or self.device.device_id,
            'timestamp': self.timestamp,
            'type': self.error_type,
            'message': self.message,
        }
        
    
class AdminLog(models.Model):
    admin = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='admin_logs',
        limit_choices_to={'role': 'admin'}
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='user_logs'
    )
    timestamp = models.DateTimeField(default=get_master_time)
    action = models.CharField(max_length=50)  # مثل: login, logout
    message = models.TextField(blank=True, null=True)
    sent = models.BooleanField(default=False)
    

    def __str__(self):
        return f"{self.user.username} - {self.action} - {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}"
    
    def get_log_info(self):
        return {
            'id': self.id,
            'source': f"{self.user.username} (User)",
            'timestamp': self.timestamp,
            'type': self.action,
            'message': self.message,
        }
        
        
class AdminGroupInfo(models.Model):
    admin = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='group_info',
        limit_choices_to={'role': 'admin'}
    )
    token = models.CharField(max_length=255)
    updated_at = models.DateTimeField(auto_now=True)
    whatsapp_is_active = models.BooleanField(default=False)
    gmail_is_active = models.BooleanField(default=False)
    sms_is_active = models.BooleanField(default=False)
    group_id = models.CharField(max_length=255, blank=True, null=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)

    def __str__(self):
        return f"Group Info for {self.admin.username}" + "Sending is " + ("Whatsapp Active" if self.whatsapp_is_active else "Inactive") + " and " + ("Gmail Active" if self.gmail_is_active else "Inactive") + " and " + ("SMS Active" if self.sms_is_active else "Inactive")