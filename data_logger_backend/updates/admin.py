# updates/admin.py
from django.contrib import admin
from .models import UpdatesModel
from django.utils.html import format_html


@admin.register(UpdatesModel)
class UpdatesAdmin(admin.ModelAdmin):
    list_display = (
        'version_app_display',
        'version_esp_display_HT',
        'version_esp_display_T',
        'created_at',
    )
    search_fields = ('version_app', 'version_esp_HT', 'version_esp_T')
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)
    
    fieldsets = (
        ("📦 App Update", {
            "fields": (
                "version_app",
                "url_app",
                "checksum_app",
            )
        }),
        ("⚙️ Firmware Update Humidity and Temperature", {
            "fields": (
                "version_esp_HT",
                "url_esp_HT",
                "checksum_esp_HT",
            )
        }),
        ("⚙️ Firmware Update Temperature Only", {
            "fields": (
                "version_esp_T",
                "url_esp_T",
                "checksum_esp_T",
            )
        }),
        ("🕓 Metadata", {
            "fields": ("created_at",),
        }),
    )

    # تحسين العرض في الجدول بالألوان
    def version_app_display(self, obj):
        return format_html(f"<b style='color:#2b6cb0;'>v{obj.version_app}</b>")
    version_app_display.short_description = "App Version"

    def version_esp_display_HT(self, obj):
        return format_html(f"<b style='color:#38a169;'>v{obj.version_esp_HT}</b>")
    version_esp_display_HT.short_description = "ESP Version Humidity and Temperature"
    
    def version_esp_display_T(self, obj):
        return format_html(f"<b style='color:#a13838;'>v{obj.version_esp_T}</b>")
    version_esp_display_T.short_description = "ESP Version Temperature Only"
