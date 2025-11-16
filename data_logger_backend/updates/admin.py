from django.contrib import admin
from django.utils.html import format_html
from .models import FirmwareModel

@admin.register(FirmwareModel)
class FirmwareAdmin(admin.ModelAdmin):
    list_display = (
        "created_at",
        "display_ht_version",
        "display_t_version",
        "ht_download_link",
        "t_download_link",
        "display_ht_checksum",
        "display_t_checksum",
    )
    readonly_fields = (
        "checksum_esp_HT",
        "checksum_esp_T",
        "created_at",
    )
    fieldsets = (
        ("HT Firmware", {
            "fields": (
                "version_esp_HT",
                "file_esp_HT",
                "checksum_esp_HT",
            )
        }),
        ("T Firmware", {
            "fields": (
                "version_esp_T",
                "file_esp_T",
                "checksum_esp_T",
            )
        }),
        ("Metadata", {
            "fields": ("created_at",),
        }),
    )
    ordering = ("-created_at",)
    list_filter = ("created_at",)
    search_fields = ("version_esp_HT", "version_esp_T")
    list_per_page = 10

    # 🟢 Custom display for HT version
    def display_ht_version(self, obj):
        return format_html(
            f"<b style='color:#2c7;'>HT {obj.version_esp_HT}</b>"
        )
    display_ht_version.short_description = "HT Version"

    # 🟠 Custom display for T version
    def display_t_version(self, obj):
        return format_html(
            f"<b style='color:#27f;'>T {obj.version_esp_T}</b>"
        )
    display_t_version.short_description = "T Version"

    # 🔗 Download links
    def ht_download_link(self, obj):
        if not obj.file_esp_HT:
            return "-"
        url = obj.file_esp_HT.replace("\\", "/").replace("media/", "/media/")
        return format_html(f"<a href='{url}' target='_blank'>📥 Download HT</a>")
    ht_download_link.short_description = "HT File"

    def t_download_link(self, obj):
        if not obj.file_esp_T:
            return "-"
        url = obj.file_esp_T.replace("\\", "/").replace("media/", "/media/")
        return format_html(f"<a href='{url}' target='_blank'>📥 Download T</a>")
    t_download_link.short_description = "T File"

    # 🔑 Show checksum with copy button
    def display_ht_checksum(self, obj):
        if not obj.checksum_esp_HT:
            return "-"
        return format_html(
            f"""
            <code style='background:#111;color:#0f0;padding:3px 6px;border-radius:4px;'>
                {obj.checksum_esp_HT[:10]}...
            </code>
            <button style='margin-left:6px;padding:3px 6px;border:none;background:#222;color:#0f0;cursor:pointer;'
                onclick="navigator.clipboard.writeText('{obj.checksum_esp_HT}');alert('✅ Copied!')">
                Copy
            </button>
            """
        )
    display_ht_checksum.short_description = "HT Checksum"

    def display_t_checksum(self, obj):
        if not obj.checksum_esp_T:
            return "-"
        return format_html(
            f"""
            <code style='background:#111;color:#0ff;padding:3px 6px;border-radius:4px;'>
                {obj.checksum_esp_T[:10]}...
            </code>
            <button style='margin-left:6px;padding:3px 6px;border:none;background:#222;color:#0ff;cursor:pointer;'
                onclick="navigator.clipboard.writeText('{obj.checksum_esp_T}');alert('✅ Copied!')">
                Copy
            </button>
            """
        )
    display_t_checksum.short_description = "T Checksum"
