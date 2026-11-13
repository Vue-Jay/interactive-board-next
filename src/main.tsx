import { Capacitor } from "@capacitor/core";

const query=new URLSearchParams(window.location.search);
const pendingInvite=(()=>{try{return /^[a-f0-9]{64}$/.test(sessionStorage.getItem("lesson-board.pending-share.v1")||"")}catch{return false}})();
const appRoute=query.has("section")||query.has("email_confirmation")||query.has("join")||pendingInvite||query.get("source")==="pwa";
const isPublicSite=window.location.pathname==="/"&&!appRoute&&!Capacitor.isNativePlatform();

void (window.location.pathname==="/site-builder"&&!Capacitor.isNativePlatform()?import("./LektrusSiteBuilderEntry"):isPublicSite?import("./LektrusSiteEntry"):import("./appEntry"));
