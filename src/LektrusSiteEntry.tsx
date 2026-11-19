import {createRoot} from "react-dom/client";
import LektrusPublicSite from "./LektrusPublicSite";
import {registerLektrusServiceWorker} from "./registerServiceWorker";

const root=document.getElementById("root");
if(root)createRoot(root).render(<LektrusPublicSite/>);

registerLektrusServiceWorker();
