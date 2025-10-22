from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from rest_framework.authtoken.models import Token

from home.models.departments import Department

class CustomUser(AbstractUser):
    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('manager', 'Manager'),
        ('supervisor', 'Supervisor'),
        ('user', 'User'),
    )
    name = models.CharField(max_length=255, blank=True, null=True)
    
    role = models.CharField(max_length=50, choices=ROLE_CHOICES, default='admin')
    
    email = models.EmailField(unique=True, blank=False, null=False)
    
    admin = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        limit_choices_to={'role': 'admin'},
        related_name='managed_users'
    )
    
    # المدير المباشر (Manager) للمستخدم الحالي (سواء supervisor أو user)
    manager = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        limit_choices_to={'role': 'manager'},
        related_name='team_members'
    )
    
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users'
    )

    def __str__(self):
        return f"{self.username} ({self.role})"

    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        
    def save(self, *args, **kwargs):
        # لو المستخدم تابع لمدير (manager)
        if self.manager and not self.department:
            self.department = self.manager.department  # يرث القسم تلقائيًا
        super().save(*args, **kwargs)

# Signals  
@receiver(post_save, sender=CustomUser)
def create_auth_token(sender, instance=None, created=False, **kwargs):
    if created:
        Token.objects.create(user=instance)
        