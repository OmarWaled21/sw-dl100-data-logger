import os
import requests
import hashlib
from datetime import datetime

# ---------- LOG FUNCTION ----------
def log(message, logs_dir="logs"):
    os.makedirs(logs_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    safe_message = message.replace("❌", "[X]").replace("⚠️", "[!]").replace("✅", "[OK]")
    print(f"[{timestamp}] {safe_message}")
    with open(os.path.join(logs_dir, "updater.log"), "a", encoding="utf-8") as f:
        f.write(f"[{timestamp}] {safe_message}\n")

# ---------- DOWNLOAD + CHECKSUM ----------
def download_file(url, dest_path, expected_checksum=None):
    try:
        log(f"Starting download: {url}")
        r = requests.get(url, stream=True, timeout=30)
        
        if r.status_code == 404:
            log(f"[⚠️] File not found on GitHub: {url}")
            return False  # فقط تنبيه بدون exception
        
        r.raise_for_status()
        
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        with open(dest_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        
        log(f"Downloaded to: {dest_path}")
        
        if expected_checksum:
            sha256_hash = hashlib.sha256()
            with open(dest_path, "rb") as f:
                for byte_block in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(byte_block)
            calc_checksum = sha256_hash.hexdigest()
            
            if calc_checksum.lower() != expected_checksum.lower().replace("sha256:", ""):
                log(f"[❌] Checksum mismatch! Expected {expected_checksum}, got {calc_checksum}")
                return False
            else:
                log(f"[✅] Checksum verified successfully")
        
        return True
    except requests.exceptions.RequestException as e:
        log(f"[❌] Download failed: {e}")
        return False
    except Exception as e:
        log(f"[❌] Unexpected error: {e}")
        return False

# ---------- SYNC FROM GITHUB + BACKEND ----------
def sync_updates(github_json_url, local_api_url):
    try:
        r = requests.get(github_json_url, timeout=10)
        r.raise_for_status()
        data = r.json()
        log("Fetched latest.json from GitHub")
        
        post_resp = requests.post(local_api_url, json=data)
        if post_resp.status_code == 200:
            log("Backend synced successfully")
        else:
            log(f"[⚠️] Backend sync failed: {post_resp.status_code}")
        return data
    except Exception as e:
        log(f"[❌] Sync failed: {e}")
        return None
