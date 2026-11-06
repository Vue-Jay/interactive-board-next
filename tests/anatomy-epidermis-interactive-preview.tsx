/** Unmodified main anatomy component inside a local test-only page.
 * CI clicks its real UI and ensures pointer hit testing does not confuse pan.
 */
import React from "react";
import {createRoot} from "react-dom/client";
import LektrusHumanAnatomy from "../src/LektrusHumanAnatomy";
import type {HumanAnatomyDiagram} from "../src/lektrusHumanAnatomyModel";
const diagram:HumanAnatomyDiagram={
 kind:"bio-anatomy",title:"Анатомия человека",
 system:"integumentary",showDescriptions:true
};
createRoot(document.getElementById("root")!).render(
 <div style={{width:"100vw",height:"100vh",padding:12,boxSizing:"border-box"}}>
  <LektrusHumanAnatomy diagram={diagram}/>
 </div>
);
