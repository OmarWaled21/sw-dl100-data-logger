from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from rest_framework.authtoken.models import Token

class CustomUser(AbstractUser):
    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('supervisor', 'Supervisor'),
        ('user', 'User'),
    )
    
    role = models.CharField(max_length=50, choices=ROLE_CHOICES, default='user')
    
    email = models.EmailField(unique=True, blank=False, null=False)
    
    admin = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        limit_choices_to={'role': 'admin'},
        related_name='sub_users'
    )


    def __str__(self):
        return f"{self.username}"

    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'

        
@receiver(post_save, sender=CustomUser)
def create_auth_token(sender, instance=None, created=False, **kwargs):
    if created:
        Token.objects.create(user=instance)
        