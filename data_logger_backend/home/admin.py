from django.contrib import admin
from .models.device_model import Device
from .models.departments import Department
from authentication.models import CustomUser
from device_details.models import DeviceReading
from django.utils.html import format_html

# --- Inline لعرض القراءات داخل صفحة الجهاز ---
class DeviceReadingInline(admin.TabularInline):
    model = DeviceReading
    extra = 0
    readonly_fields = ('temperature', 'humidity', 'timestamp')
    can_delete = False
    ordering = ('-timestamp',)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        latest_ids = list(
            qs.order_by('-timestamp').values_list('id', flat=True)[:10]
        )
        return qs.filter(id__in=latest_ids).order_by('-timestamp')



# --- إدارة الأقسام ---
@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)
    ordering = ('name',)

# --- إدارة الأجهزة ---
@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = (
        'name', 
        'device_id', 
        'admin', 
        'department',     
        'get_status',
        'temperature',
        'humidity',
        'battery_level',
        'last_update'
    )
    list_filter = (
        'department', 
        'admin', 
        'temperature_type', 
        'has_temperature_sensor', 
        'has_humidity_sensor', 
        'last_update'
    )
    search_fields = ('name', 'device_id')
    inlines = [DeviceReadingInline]
    ordering = ('department', 'name')
    readonly_fields = ('temp_sensor_error', 'hum_sensor_error', 'low_battery')

    fieldsets = (
        ("Basic Info", {
            "fields": (
                "name",
                "device_id",
                "admin",
                "department",
            )
        }),
        ("Sensors", {
            "fields": (
                "has_temperature_sensor",
                "has_humidity_sensor",
                "temperature_type",
            )
        }),
        ("Temperature Settings", {
            "fields": (
                "temperature",
                "min_temp",
                "max_temp",
                "temp_sensor_error",
            )
        }),
        ("Humidity Settings", {
            "fields": (
                "humidity",
                "min_hum",
                "max_hum",
                "hum_sensor_error",
            )
        }),
        ("Battery & Intervals", {
            "fields": (
                "battery_level",
                "low_battery",
                "interval_wifi",
                "interval_local",
            )
        }),
        ("Firmware & Status", {
            "fields": (
                "firmware_version",
                "firmware_updated_at",
                "last_calibrated",
                "last_update",
            ),
            "classes": ("collapse",),
        }),
    )

    # ✅ عرض الأعمدة الملونة حسب الحالة
    def get_status(self, obj):
        status = obj.get_dynamic_status()
        color_map = {
            "working": "green",
            "error": "orange",
            "offline": "red",
        }
        color = color_map.get(status, "black")
        return format_html(f'<b style="color:{color}">{status.capitalize()}</b>')
    get_status.short_description = "Status"

    # ✅ حصر اختيار الأدمن فقط عند إضافة الجهاز
    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "admin":
            kwargs["queryset"] = CustomUser.objects.filter(role="admin")
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


# ✅ لو حبيت تشوف القراءات بشكل منفصل
@admin.register(DeviceReading)
class DeviceReadingAdmin(admin.ModelAdmin):
    list_display = ('device', 'temperature', 'humidity', 'timestamp')
    list_filter = ('device__department', 'device')
    ordering = ('-timestamp',)
    readonly_fields = ('timestamp',) 
