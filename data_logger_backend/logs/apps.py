from django.apps import AppConfig



class LogsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'logs'

    def ready(self):
        from . import signals
        signals.start_auto_offline_checker()
