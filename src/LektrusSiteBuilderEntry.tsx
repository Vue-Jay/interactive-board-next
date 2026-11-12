import {createRoot} from "react-dom/client";
import LektrusSiteBuilder from "./LektrusSiteBuilder";
import "./lektrusSiteBuilder.css";
const root=document.getElementById("root");
if(root)createRoot(root).render(<LektrusSiteBuilder/>);
