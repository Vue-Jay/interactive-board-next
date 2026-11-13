import { Capacitor } from "@capacitor/core";
import { pendingSharePath } from "./routes";

const query=new URLSearchParams(window.location.search);
const pendingInvite=Boolean(pendingSharePath());
const appRoute=query.has("section")||query.has("email_confirmation")||query.has("join")||pendingInvite||query.get("source")==="pwa";
const isPublicSite=window.location.pathname==="/"&&!appRoute&&!Capacitor.isNativePlatform();

void (window.location.pathname==="/site-builder"&&!Capacitor.isNativePlatform()?import("./LektrusSiteBuilderEntry"):isPublicSite?import("./LektrusSiteEntry"):import("./appEntry"));
