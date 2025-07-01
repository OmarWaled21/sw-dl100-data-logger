from django.contrib import admin
from .models import Device
from authentication.models import CustomUser
from data_logger.models import Device
from device_details.models import DeviceReading
from data_logger.models import AutoReportSchedule

class DeviceReadingInline(admin.TabularInline):
    model = DeviceReading
    extra = 0  # عدد الحقول الفارغة الإضافية
    readonly_fields = ('temperature', 'humidity', 'timestamp')
    can_delete = False
    
class DeviceAdmin(admin.ModelAdmin):
    list_display = ('name', 'device_id', 'admin', 'status',  'temperature', 'humidity', 'last_update')
    inlines = [DeviceReadingInline]

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "admin":
            kwargs["queryset"] = CustomUser.objects.filter(role='admin')
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

admin.site.register(Device, DeviceAdmin)
admin.site.register(DeviceReading)  # لو حبيت تشوف القراءات لوحدها كمان


@admin.register(AutoReportSchedule)
class AutoReportScheduleAdmin(admin.ModelAdmin):
    list_display = ('get_devices', 'schedule_type', 'enabled')
    list_editable = ('enabled',)

    def get_devices(self, obj):
        return ", ".join([d.name for d in obj.devices.all()])
    get_devices.short_description = "Devices"
