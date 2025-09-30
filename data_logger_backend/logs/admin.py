from django.contrib import admin

# Register your models here.
from .models import DeviceLog, AdminLog

admin.site.register(DeviceLog)
admin.site.register(AdminLog)
