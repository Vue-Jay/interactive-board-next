import {createRoot} from "react-dom/client";
import LektrusPublicSite from "./LektrusPublicSite";

const root=document.getElementById("root");
if(root)createRoot(root).render(<LektrusPublicSite/>);
