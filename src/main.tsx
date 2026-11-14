// Keep the public-site styles in the initial HTML stylesheet bundle.
// TatNet serves the landing page through a lazy route; CSS must not depend on that route loading.
import "./lektrusMarketing.css";
import "./lektrusMarketingTypography.css";

import { Capacitor } from "@capacitor/core";
import { pendingSharePath } from "./routes";

const query=new URLSearchParams(window.location.search);
const pendingInvite=Boolean(pendingSharePath());
const appRoute=query.has("section")||query.has("email_confirmation")||query.has("join")||pendingInvite||query.get("source")==="pwa";
const isPublicSite=window.location.pathname==="/"&&!appRoute&&!Capacitor.isNativePlatform();
// Isolated staging-only pilot. Never overrides the normal Lektrus or PWA routes.
const isSelfhostPilot=import.meta.env.VITE_LEKTRUS_SELFHOST_PILOT==="true" &&
  !Capacitor.isNativePlatform() &&
  (window.location.pathname==="/selfhost-pilot"||window.location.pathname==="/confirm-email");

void (isSelfhostPilot?import("./selfhostPilotEntry"):
  window.location.pathname==="/site-builder"&&!Capacitor.isNativePlatform()?import("./LektrusSiteBuilderEntry"):
  isPublicSite?import("./LektrusSiteEntry"):import("./appEntry"));
