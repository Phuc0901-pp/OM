import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'vn.ute.om',
  appName: 'OM Project',
  webDir: 'dist',
  server: {
    url: 'http://192.168.31.160:5173',
    cleartext: true
  }
};

export default config;
