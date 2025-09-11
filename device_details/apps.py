from django.apps import AppConfig
import subprocess, os, atexit, threading, sys

mosquitto_process = None

class DeviceDetailsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'device_details'

    def ready(self):
        global mosquitto_process

        try:
            if os.environ.get('RUN_MAIN') != 'true':
                return

            if not sys.platform.startswith("win"):
                print("🚫 Mosquitto auto-launch only supported on Windows.")
                return

            result = subprocess.run(["tasklist"], capture_output=True, text=True)
            if "mosquitto.exe" not in result.stdout:
                print("🟡 Mosquitto not running, starting it...")

                mosquitto_path = r"C:\Program Files\mosquitto\mosquitto.exe"
                config_path = os.path.join(os.path.dirname(__file__), "mosquitto_custom.conf")

                mosquitto_process = subprocess.Popen([mosquitto_path, "-c", config_path])
                print("✅ Mosquitto started from Django with custom config.")
            else:
                print("✅ Mosquitto is already running")

            # Start MQTT listener
            from device_details.mqtt_listener import mqtt_listener
            threading.Thread(target=mqtt_listener, daemon=True).start()

            # Stop mosquitto on exit
            atexit.register(self.stop_mosquitto)

        except Exception as e:
            print(f"❌ Could not check/start Mosquitto: {e}")

    def stop_mosquitto(self):
        global mosquitto_process
        if mosquitto_process is not None:
            print("🛑 Stopping Mosquitto server...")
            mosquitto_process.terminate()
            mosquitto_process.wait()
            print("✅ Mosquitto stopped.")
