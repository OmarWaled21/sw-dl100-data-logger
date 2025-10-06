from django.apps import AppConfig


class DeviceDetailsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'device_details'

    def ready(self):
        import device_details.signals