import { Capacitor } from "@capacitor/core";

const query=new URLSearchParams(window.location.search);
const appRoute=query.has("section")||query.has("email_confirmation")||query.get("source")==="pwa";
const isPublicSite=window.location.pathname==="/"&&!appRoute&&!Capacitor.isNativePlatform();

void (isPublicSite?import("./LektrusSiteEntry"):import("./appEntry"));
