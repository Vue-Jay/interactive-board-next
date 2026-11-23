import { Capacitor } from "@capacitor/core";
import { useSyncExternalStore } from "react";
import { createPwaInstallController } from "./pwaInstallController";

export const pwaInstall = createPwaInstallController(window, navigator, Capacitor.isNativePlatform());
export const usePwaInstall = () => useSyncExternalStore(pwaInstall.subscribe, pwaInstall.getSnapshot);
