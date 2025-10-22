// types/device.ts
export interface Device {
  device_id: string;
  name: string;
  status: "active" | "offline" | "error";
  has_temperature_sensor: boolean;
  has_humidity_sensor: boolean;
  temperature_type: "air" | "liquid";
  temperature: number;
  humidity: number;
  min_temp: number;
  max_temp: number;
  min_hum: number;
  max_hum: number;
  battery_level: number;
  interval_wifi: number;
  interval_local: number;
  last_update: string;
  department_id: number;
  department: string;
  department_name?: string;
}


export interface DeviceDetails {
  id: string;
  name: string;
  battery: number;
  has_temperature_sensor: boolean;
  has_humidity_sensor: boolean;
  temperature_type: "air" | "liquid";
  temperature: number;
  humidity: number;
  minTemp: number;
  maxTemp: number;
  minHum: number;
  maxHum: number;
  interval_wifi: number;
  interval_local: number;
  last_update: string;
  status: "active" | "offline" | "error";
}