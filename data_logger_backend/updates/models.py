from django.db import models
import hashlib
import os
from django.conf import settings

class FirmwareModel(models.Model):  
    # ESP/firmware update
    version_esp_HT = models.CharField(max_length=50, default="1.0.0")
    file_esp_HT = models.FilePathField(
        path=os.path.join(settings.MEDIA_ROOT, "esp_firmware/HT"),
        match=r'.*\.bin$', 
        blank=True, null=True
    )
    checksum_esp_HT = models.CharField(max_length=128, blank=True, null=True)
    
    version_esp_T = models.CharField(max_length=50, default="1.0.0")
    file_esp_T = models.FilePathField(
        path=os.path.join(settings.MEDIA_ROOT, "esp_firmware/T"),
        match=r'.*\.bin$', 
        blank=True, null=True
    )
    checksum_esp_T = models.CharField(max_length=128, blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
  
    class Meta:
        verbose_name = "Firmware Update"
        verbose_name_plural = "Firmware Updates"  
  
    @classmethod
    def get_latest(cls):
        return cls.objects.order_by('-created_at').first()
  
    def __str__(self):
        return f"HT: {self.version_esp_HT or '-'} | T: {self.version_esp_T or '-'} ({self.created_at:%Y-%m-%d %H:%M})"
    
    def save(self, *args, **kwargs):
        updated = False

        # HT firmware checksum
        if self.file_esp_HT and (not self.checksum_esp_HT):
            new_checksum = self.calculate_sha256(self.file_esp_HT)
            self.checksum_esp_HT = new_checksum
            updated = True

        # T firmware checksum
        if self.file_esp_T and (not self.checksum_esp_T):
            new_checksum = self.calculate_sha256(self.file_esp_T)
            self.checksum_esp_T = new_checksum
            updated = True

        super().save(*args, **kwargs)

    @staticmethod
    def calculate_sha256(filepath):
        sha256_hash = hashlib.sha256()
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()
