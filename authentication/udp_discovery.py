import socket
import threading

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

def start_udp_discovery():
    def run():
        base_port = 4210
        max_port = 4220
        SERVER_HTTP_PORT = 8000
        
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

        # Try to bind to first available port
        for port in range(base_port, max_port + 1):
            try:
                sock.bind(('', port))
                print(f"UDP discovery server started on port {port}")
                break
            except OSError:
                continue
        else:
            print("No available UDP ports found.")
            return

        while True:
            try:
                data, addr = sock.recvfrom(1024)
                if data.decode().strip() == "DISCOVER_SERVER":
                    ip = get_local_ip()
                    print(f"Request from {addr}, replying with {ip}")
                    response = f"TOMATIKI_SERVER_IP:{ip}:{SERVER_HTTP_PORT}"
                    sock.sendto(response.encode(), addr)
            except Exception as e:
                print("UDP Error:", e)

    threading.Thread(target=run, daemon=True).start()
