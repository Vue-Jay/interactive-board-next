export type LectrisPanelLayout={
  toolbarSide:"left"|"right";
  quickPosition:"bottom"|"top";
  inspectorSide:"right"|"left";
  editorPosition:"bottom"|"side";
  inspectorWidth:number;
};

export const defaultLectrisPanelLayout:LectrisPanelLayout={
  toolbarSide:"left",quickPosition:"bottom",inspectorSide:"right",editorPosition:"bottom",inspectorWidth:340,
};

export function normalizeLectrisPanelLayout(raw:unknown):LectrisPanelLayout{
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return {...defaultLectrisPanelLayout};
  const input=raw as Partial<Record<keyof LectrisPanelLayout,unknown>>;
  return {
    toolbarSide:input.toolbarSide==="right"?"right":"left",
    quickPosition:input.quickPosition==="top"?"top":"bottom",
    inspectorSide:input.inspectorSide==="left"?"left":"right",
    editorPosition:input.editorPosition==="side"?"side":"bottom",
    inspectorWidth:typeof input.inspectorWidth==="number"&&Number.isFinite(input.inspectorWidth)
      ?Math.min(460,Math.max(280,Math.round(input.inspectorWidth/10)*10)):340,
  };
}

export function readLectrisPanelLayout(key:string):LectrisPanelLayout{
  try{return normalizeLectrisPanelLayout(JSON.parse(localStorage.getItem(key)||"null"))}
  catch{return {...defaultLectrisPanelLayout}}
}
