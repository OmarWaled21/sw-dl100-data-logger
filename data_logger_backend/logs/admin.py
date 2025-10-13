from django.contrib import admin
from django.utils.html import format_html
from .models import DeviceLog, AdminLog, NotificationSettings


@admin.register(DeviceLog)
class DeviceLogAdmin(admin.ModelAdmin):
    list_display = ('device', 'get_department', 'error_type', 'timestamp', 'resolved', 'sent')
    list_filter = ('error_type', 'resolved', 'sent', 'department')
    search_fields = ('device__name', 'device__device_id', 'message')
    readonly_fields = ('timestamp', 'department')
    ordering = ('-timestamp',)

    def get_queryset(self, request):
        qs = super().get_queryset(request).select_related('device', 'department')
        user = request.user

        if user.is_superuser:
            return qs
        elif user.role == 'admin':
            # الادمن يشوف فقط الأقسام اللي فيها المستخدمين بتوعه
            departments = user.managed_users.values_list('department', flat=True)
            return qs.filter(department__in=departments)
        elif user.role == 'manager':
            return qs.filter(department=user.department)
        else:
            # supervisor أو user يشوف الأجهزة الخاصة بالقسم بتاعه
            return qs.filter(department=user.department)
        return qs.none()

    def get_department(self, obj):
        if obj.department:
            return format_html(f"<b>{obj.department.name}</b>")
        return "-"
    get_department.short_description = "Department"


@admin.register(AdminLog)
class AdminLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'colored_role', 'admin', 'manager', 'action', 'timestamp', 'short_message')
    list_filter = ('action', 'sent', 'user__role', 'admin', 'manager')
    search_fields = ('user__username', 'user__email', 'message')
    readonly_fields = ('timestamp', 'admin', 'manager')
    ordering = ('-timestamp',)

    def get_queryset(self, request):
        qs = super().get_queryset(request).select_related('user', 'admin', 'manager')
        user = request.user

        if user.is_superuser:
            return qs

        elif user.role == 'admin':
            # يشوف اللوجز الخاصة بيه والمستخدمين التابعين له
            return qs.filter(admin=user) | qs.filter(user=user)

        elif user.role == 'manager':
            # يشوف لوجز المستخدمين في فريقه
            team_ids = user.team_members.values_list('id', flat=True)
            return qs.filter(user__in=team_ids) | qs.filter(user=user)

        else:
            # user/supervisor → يشوف نفسه فقط
            return qs.filter(user=user)

    def colored_role(self, obj):
        color_map = {
            'admin': '#007bff',
            'manager': '#ff9800',
            'supervisor': '#4caf50',
            'user': '#e53935',
        }
        color = color_map.get(obj.user.role, '#000')
        return format_html(f"<b style='color:{color}'>{obj.user.role.capitalize()}</b>")
    colored_role.short_description = "Role"

    def short_message(self, obj):
        if not obj.message:
            return "-"
        text = obj.message.strip()
        return (text[:60] + "...") if len(text) > 60 else text
    short_message.short_description = "Message"

@admin.register(NotificationSettings)
class NotificationSettingsAdmin(admin.ModelAdmin):
    list_display = ('user', 'get_devices', 'gmail_is_active', 'email', 'report_time', 'local_is_active')
    list_filter = ('gmail_is_active',)
    search_fields = ('user__username', 'email')
    ordering = ('user__username',)
    readonly_fields = ('local_is_active',)

    def get_devices(self, obj):
        return ", ".join([d.name for d in obj.devices.all()]) or "-"
    get_devices.short_description = "Devices"

    def get_queryset(self, request):
        qs = super().get_queryset(request).select_related('user').prefetch_related('devices')
        user = request.user

        if user.is_superuser:
            return qs
        # admin: only settings for users they manage
        if getattr(user, "role", None) == "admin":
            managed_ids = user.managed_users.values_list("id", flat=True)
            return qs.filter(user__in=managed_ids)
        # manager: only users in their department
        if getattr(user, "role", None) == "manager":
            return qs.filter(user__department=user.department)
        # normal user: only their own row
        return qs.filter(user=user)
