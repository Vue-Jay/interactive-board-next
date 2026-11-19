import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ru.lektrus.board",
  appName: "Lektrus",
  webDir: "dist",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
  // Enable Web Inspector only on isolated automation builds, never releases.
  ios: {
    webContentsDebuggingEnabled: process.env.LEKTRUS_NATIVE_QA === "1",
  },
  // MainActivity owns Android WebView margins and exports cutout insets.
  // Capacitor 8 otherwise adds a second set of decor-view insets on older
  // WebViews. SystemBars.insetHandling is Android-only; iOS uses safe-area env.
  plugins: {
    SystemBars: { insetsHandling: "disable" },
  },
};

export default config;
