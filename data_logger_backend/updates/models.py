from django.db import models

# Create your models here.
class UpdatesModel(models.Model):
  # App (desktop/backend) update
  version_app = models.CharField(max_length=50, default="1.0.0")
  url_app = models.URLField(blank=True, null=True)
  checksum_app = models.CharField(max_length=128, blank=True, null=True)
  
  # ESP/firmware update
  version_esp_HT = models.CharField(max_length=50, default="1.0.0")
  url_esp_HT = models.URLField(blank=True, null=True)
  checksum_esp_HT = models.CharField(max_length=128, blank=True, null=True)
  
  version_esp_T = models.CharField(max_length=50, default="1.0.0")
  url_esp_T = models.URLField(blank=True, null=True)
  checksum_esp_T = models.CharField(max_length=128, blank=True, null=True)
  
  # Last update time
  created_at = models.DateTimeField(auto_now_add=True)
  
  class Meta:
      verbose_name = "System Update"
      verbose_name_plural = "System Updates"  
  
  @classmethod
  def get_latest(cls):
      return cls.objects.order_by('-created_at').first()
  
  def __str__(self):
      return f"App: {self.version_app or '-'} | HT: {self.version_esp_HT or '-'} | T: {self.version_esp_T or '-'} ({self.created_at:%Y-%m-%d %H:%M})"