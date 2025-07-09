from django.contrib import admin

from device_details.models import DeviceControl

# Register your models here.
@admin.register(DeviceControl)
class DeviceControlAdmin(admin.ModelAdmin):
    list_display = ('device', 'name', 'is_on', 'auto_schedule', 'auto_on', 'auto_off', 'auto_pause_until', 'temp_control_enabled', 'temp_on_threshold', 'temp_off_threshold', 'control_priority')
    list_filter = ('is_on', 'auto_schedule')
    search_fields = ('device__name', 'device__device_id', 'name')