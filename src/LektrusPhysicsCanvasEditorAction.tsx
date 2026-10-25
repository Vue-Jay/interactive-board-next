import LektrusGeometryToolIcon from "./LektrusGeometryToolIcon";

/** Open a selected physics diagram directly from its board preview.
 * Keep this action separate from SVG drag handles and board gestures. */
export default function LektrusPhysicsCanvasEditorAction({onOpenEditor}:{onOpenEditor:()=>void}){
  return <div className="lektrus-graph-canvas-actions" data-board-interactive="true">
    <button type="button" className="lektrus-graph-canvas-editor" data-board-interactive="true"
      title="Открыть физический редактор" aria-label="Открыть физический редактор"
      onPointerDown={event=>event.stopPropagation()}
      onPointerUp={event=>event.stopPropagation()}
      onClick={event=>{event.preventDefault();event.stopPropagation();onOpenEditor()}}
      onDoubleClick={event=>{event.preventDefault();event.stopPropagation()}}>
      <LektrusGeometryToolIcon name="editor" size={17}/><span>Редактор</span>
    </button>
  </div>;
}
