interface DiscoveredDevice {
  device_id: string;
  model?: string;
}

interface Department {
  id: number;
  name: string;
}

interface DeviceForm {
  name: string;
  min_temp?: string;
  max_temp?: string;
  min_hum?: string;
  max_hum?: string;
  department_id?: string;
}