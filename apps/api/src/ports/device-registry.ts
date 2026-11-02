export interface DeviceRegistry {
  isRegistered(deviceSerial: string): Promise<boolean>;
}
