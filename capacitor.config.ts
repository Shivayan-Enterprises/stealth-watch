import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.stealthyeyewhisper',
  appName: 'stealthy-eye-whisper',
  webDir: 'dist',
  server: {
    url: 'https://4ce7ccd0-b3eb-4aa9-b780-a8d8b6ffc4b7.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};

export default config;
