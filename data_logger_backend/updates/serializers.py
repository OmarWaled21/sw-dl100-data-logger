from rest_framework import serializers
from .models import UpdatesModel

class UpdatesSerializer(serializers.ModelSerializer):
  class Meta:
    model = UpdatesModel
    fields = [
                'version_app', 'url_app', 'checksum_app', 
                'version_esp_HT', 'url_esp_HT', 'checksum_esp_HT', 
                'version_esp_T', 'url_esp_T', 'checksum_esp_T',
            ]