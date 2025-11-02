import os, json , sys
from utils import log, download_file, sync_updates

# ---------- Load config ----------
def resource_path(relative_path):
    """Works with PyInstaller"""
    import sys
    try:
        base_path = sys._MEIPASS
    except AttributeError:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

config_file = resource_path("config.json")
with open(config_file, "r") as f:
    config = json.load(f)

# ---------- SYNC ----------
data = sync_updates(config["github_json_url"], config["local_api_url"])
if not data:
    log("Exiting updater because sync failed.")
    sys.exit(1)

# ---------- DOWNLOAD APP ----------
app = data.get("app", {})
app_version = app.get("version")
app_url = app.get("url")
app_checksum = app.get("checksum")

app_file = os.path.join(config["download_dir"], f"app_v{app_version}.zip")
if os.path.exists(app_file):
    log(f"App v{app_version} already exists, skipping download.")
else:
    if not download_file(app_url, app_file, app_checksum):
        log("App download failed. Exiting.")
        sys.exit(1)

# ---------- DOWNLOAD FIRMWARE ----------
firmware = data.get("firmware", {})
for fw_type in ["HT", "T"]:
    fw_data = firmware.get(fw_type, {})
    if not fw_data:
        log(f"No firmware found for type {fw_type}")
        continue

    fw_version = fw_data.get("version")
    fw_url = fw_data.get("url")
    fw_checksum = fw_data.get("checksum")
    fw_file = os.path.join(config["download_dir"], f"firmware_{fw_type}_v{fw_version}.bin")

    if os.path.exists(fw_file):
        log(f"Firmware {fw_type} v{fw_version} already exists, skipping download.")
    else:
        if not download_file(fw_url, fw_file, fw_checksum):
            log(f"Firmware {fw_type} download failed. Exiting.")
            sys.exit(1)

log("Updater process finished.")
