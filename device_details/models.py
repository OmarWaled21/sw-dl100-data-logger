from django.db import models
from data_logger.utils import get_master_time

class DeviceReading(models.Model):
    device = models.ForeignKey('data_logger.Device', on_delete=models.CASCADE)
    temperature = models.FloatField()
    humidity = models.FloatField()
    timestamp = models.DateTimeField(default=get_master_time)

    def __str__(self):
        return f"{self.device.name} - {self.timestamp}"
    
