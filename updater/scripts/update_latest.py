import os
import json
import hashlib
import datetime

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
FIRMWARE_DIR = os.path.join(BASE_DIR, "firmware")
APP_DIR = os.path.join(BASE_DIR, "app")
LATEST_JSON_PATH = os.path.join(BASE_DIR, "latest.json")

def calc_checksum(filepath):
    """احسب SHA256 للملف"""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            h.update(chunk)
    return h.hexdigest()

def build_entry(path, base_url, default_name):
    """يبني entry سواء لملف firmware أو app"""
    if not os.path.exists(path):
        print(f"[⚠️] File not found: {path}")
        return {
            "version": "0.0.0",
            "url": f"{base_url}/{default_name}",
            "checksum": "N/A"
        }
    
    filename = os.path.basename(path)
    version = (
        os.path.splitext(filename)[0]
        .replace("fw_", "")
        .replace(".bin", "")
        .replace("updater_", "")
        .replace(".exe", "")
    )
    checksum = calc_checksum(path)
    url = f"{base_url}/{filename}"
    return {"version": version, "url": url, "checksum": checksum}

def main():
    base_url = "https://raw.githubusercontent.com/OmarWaled21/sw-dl100-data-logger/main"

    fw_ht_path = os.path.join(FIRMWARE_DIR, "HT", "fw_HT.bin")
    fw_t_path = os.path.join(FIRMWARE_DIR, "T", "fw_T.bin")
    app_path = os.path.join(APP_DIR, "updater.exe")

    latest = {
        "released_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "app": build_entry(app_path, f"{base_url}/app", "updater.exe"),
        "firmware": {
            "HT": build_entry(fw_ht_path, f"{base_url}/firmware/HT", "fw_HT.bin"),
            "T": build_entry(fw_t_path, f"{base_url}/firmware/T", "fw_T.bin")
        }
    }

    with open(LATEST_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(latest, f, indent=2)

    print("[✅] latest.json updated successfully")

if __name__ == "__main__":
    main()
