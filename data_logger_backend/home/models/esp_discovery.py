from django.db import models

class ESPDiscovery(models.Model):
    device_id = models.CharField(max_length=100, unique=True)
    is_linked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.device_id