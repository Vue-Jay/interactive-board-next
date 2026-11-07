import {createRoot} from "react-dom/client";
import LektrusPublicSite from "./LektrusPublicSite";
import "./lektrusPublicSite.css";

const root=document.getElementById("root");
if(root)createRoot(root).render(<LektrusPublicSite/>);
