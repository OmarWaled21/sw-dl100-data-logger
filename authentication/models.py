from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from rest_framework.authtoken.models import Token

from home.models import Category

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

    # ربط المستخدم بقسم معين
    categories = models.ManyToManyField(
        'home.Category',
        blank=True,
        related_name='users'
    )

    def __str__(self):
        if self.categories.exists():
            category_names = ", ".join([cat.name for cat in self.categories.all()])
            return f"{self.username} ({category_names})"
        else:
            return f"{self.username} (No Category)"

    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'

        
@receiver(post_save, sender=CustomUser)
def create_auth_token(sender, instance=None, created=False, **kwargs):
    if created:
        Token.objects.create(user=instance)
        
@receiver(post_save, sender=CustomUser)
def assign_all_categories_to_admin(sender, instance, created, **kwargs):
    if created and instance.role == 'admin':
        all_categories = Category.objects.all()
        instance.categories.set(all_categories)  # تعيين كل الأقسام للادمن
        instance.save()