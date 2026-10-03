import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.monocode.mobile",
  appName: "MonoCode",
  loggingBehavior: "none",
  webDir: "dist-mobile",
  android: { path: "mobile/android" },
  ios: { path: "mobile/ios", contentInset: "never" },
  plugins: {
    Keyboard: { resize: "native", resizeOnFullScreen: true },
    StatusBar: { style: "DARK" },
  },
};
export default config;
