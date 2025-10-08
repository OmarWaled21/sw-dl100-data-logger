from django.contrib import admin
from .models import Device, Department
from authentication.models import CustomUser
from device_details.models import DeviceReading

# --- Inline لعرض القراءات داخل صفحة الجهاز ---
class DeviceReadingInline(admin.TabularInline):
    model = DeviceReading
    extra = 0  # عدد الصفوف الفارغة الإضافية
    readonly_fields = ('temperature', 'humidity', 'timestamp')
    can_delete = False
    ordering = ('-timestamp',)  # عرض أحدث قراءة أولاً


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
        'department',     # ✅ أضفنا القسم هنا
        'get_status',
        'temperature',
        'humidity',
        'last_update'
    )
    list_filter = ('department', 'admin', 'last_update')  # ✅ فلترة حسب القسم أو الأدمن
    search_fields = ('name', 'device_id')
    inlines = [DeviceReadingInline]
    ordering = ('department', 'name')

    def get_status(self, obj):
        return obj.get_dynamic_status()
    get_status.short_description = 'Status'

    # حصر اختيار الأدمنين فقط عند إضافة جهاز جديد
    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "admin":
            kwargs["queryset"] = CustomUser.objects.filter(role='admin')
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


# ✅ لو حبيت تشوف القراءات بشكل منفصل
@admin.register(DeviceReading)
class DeviceReadingAdmin(admin.ModelAdmin):
    list_display = ('device', 'temperature', 'humidity', 'timestamp')
    list_filter = ('device__department', 'device')
    ordering = ('-timestamp',)
    readonly_fields = ('timestamp',) 
