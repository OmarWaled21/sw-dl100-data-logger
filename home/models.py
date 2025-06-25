from django.db import models

class Category(models.Model):
    name = models.CharField(max_length=100)
    icon = models.CharField(max_length=100, blank=True)  # ممكن تستخدم FontAwesome icon names مثلاً
    slug = models.SlugField(unique=True) 
    
    def __str__(self):
        return self.name