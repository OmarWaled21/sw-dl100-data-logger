from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from rest_framework.authtoken.models import Token
from .models import CustomUser

class CustomUserAdmin(UserAdmin):
    # عرض التوكن فقط
    readonly_fields = UserAdmin.readonly_fields + ('get_token',)

    def get_token(self, obj):
        token, created = Token.objects.get_or_create(user=obj)
        return token.key
    get_token.short_description = "Token"

    # ترتيب الحقول وإضافة التوكن تحت categories
    fieldsets = UserAdmin.fieldsets + (
        ("Additional Info", {
            'fields': ('role', 'admin', 'get_token'),
        }),
    )

admin.site.register(CustomUser, CustomUserAdmin)
