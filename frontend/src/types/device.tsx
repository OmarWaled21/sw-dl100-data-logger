// types/device.ts
export interface Device {
  device_id: string;
  name: string;
  status: "active" | "offline" | "error";
  temperature: number;
  humidity: number;
  min_temp: number;
  max_temp: number;
  min_hum: number;
  max_hum: number;
  battery_level: number;
  interval_wifi: number;
  last_update: string;
  department_id: number;
  department: string;
}


export interface DeviceDetails {
  id: string;
  name: string;
  battery: number;
  temperature: number;
  humidity: number;
  minTemp: number;
  maxTemp: number;
  minHum: number;
  maxHum: number;
  interval: number;
  last_update: string;
  status: "active" | "offline" | "error";
}