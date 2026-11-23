import {createRoot} from "react-dom/client";
import {PwaInstallFeedback} from "./PwaInstallOffer";
import LektrusPublicSite from "./LektrusPublicSite";
import {registerLektrusServiceWorker} from "./registerServiceWorker";
import {useServiceAvailability} from "./useServiceAvailability";
import {ServiceUnavailableScreen} from "./ServiceUnavailableScreen";
import {isSelfhostBackendEnabled} from "./selfhostApi";
import {LEKTRUS_LOCAL_TEST_MODE} from "./lektrusLocalTestMode";

function PublicSite(){
  const {reason,checking,check}=useServiceAvailability(isSelfhostBackendEnabled()&&!LEKTRUS_LOCAL_TEST_MODE);
  if(reason)return <ServiceUnavailableScreen reason={reason} checking={checking} automatic onRetry={check}/>;
  return <LektrusPublicSite/>;
}

const root=document.getElementById("root");
if(root)createRoot(root).render(<><PublicSite/><PwaInstallFeedback/></>);

registerLektrusServiceWorker();
