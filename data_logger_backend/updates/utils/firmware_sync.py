import os
import re
import hashlib
from django.conf import settings
from updates.models import FirmwareModel

def sync_firmware():
    """Scan firmware folders (HT/T) and register new files automatically."""
    base_ht = os.path.join(settings.MEDIA_ROOT, "esp_firmware/HT")
    base_t = os.path.join(settings.MEDIA_ROOT, "esp_firmware/T")

    print("🔍 Checking for new firmware files...")
    _sync_folder(base_ht, "HT")
    _sync_folder(base_t, "T")
    print("✅ Firmware sync complete.\n")


def _sync_folder(folder, device_type):
    if not os.path.exists(folder):
        print(f"⚠ Folder not found: {folder}")
        return

    for filename in os.listdir(folder):
        if not filename.endswith(".bin"):
            continue

        filepath = os.path.join(folder, filename)
        version = _extract_version(filename)
        checksum = _calculate_sha256(filepath)

        # Check if already exists
        exists = FirmwareModel.objects.filter(
            **{f"file_esp_{device_type}": filepath}
        ).first()

        if exists:
            continue  # already registered

        # Create new entry
        kwargs = {
            f"version_esp_{device_type}": version,
            f"file_esp_{device_type}": filepath,
            f"checksum_esp_{device_type}": checksum,
        }

        FirmwareModel.objects.create(**kwargs)
        print(f"🟢 Added {device_type} firmware {filename} (v{version})")


def _extract_version(filename):
    """Extract version number like v1.0.0 from filename."""
    match = re.search(r'v(\d+\.\d+\.\d+)', filename)
    return match.group(1) if match else "1.0.0"


def _calculate_sha256(filepath):
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            sha256_hash.update(chunk)
    return sha256_hash.hexdigest()
