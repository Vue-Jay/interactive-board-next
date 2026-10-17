import {useCallback,useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";

type Props={value:string;options:string[];disabled?:boolean;onChange:(value:string)=>void};
type Position={left:number;top:number;width:number};

export default function LektrusSubjectPicker({value,options,disabled=false,onChange}:Props){
  const [draft,setDraft]=useState(value);
  // The selected subject and the temporary search query are different things.
  // A fresh opening always lists ALL subjects, even if one is already selected.
  const [filter,setFilter]=useState("");
  const [open,setOpen]=useState(false);
  const [active,setActive]=useState(0);
  const [position,setPosition]=useState<Position>({left:0,top:0,width:256});
  const rootRef=useRef<HTMLDivElement>(null);
  const listRef=useRef<HTMLDivElement>(null);
  const inputRef=useRef<HTMLInputElement>(null);
  const fieldRef=useRef<HTMLDivElement>(null);

  const placeMenu=useCallback(()=>{
    const rect=fieldRef.current?.getBoundingClientRect();
    if(!rect)return;
    const width=Math.min(256,Math.max(180,window.innerWidth-16));
    const left=Math.max(8,Math.min(rect.left,window.innerWidth-width-8));
    setPosition({left,top:rect.bottom+7,width});
  },[]);

  useEffect(()=>{if(!open){setDraft(value);setFilter("")}},[value,open]);
  useEffect(()=>{
    if(!open)return;
    placeMenu();
    const dismiss=(event:PointerEvent)=>{
      const target=event.target as Node;
      if(rootRef.current?.contains(target)||listRef.current?.contains(target))return;
      setOpen(false);
      setDraft(value);
      setFilter("");
    };
    document.addEventListener("pointerdown",dismiss);
    window.addEventListener("resize",placeMenu);
    window.addEventListener("scroll",placeMenu,true);
    return()=>{
      document.removeEventListener("pointerdown",dismiss);
      window.removeEventListener("resize",placeMenu);
      window.removeEventListener("scroll",placeMenu,true);
    };
  },[open,value,placeMenu]);

  const normalized=filter.trim().toLocaleLowerCase("ru-RU");
  const matches=options.filter(name=>!normalized||name.toLocaleLowerCase("ru-RU").includes(normalized));
  const select=(name:string)=>{
    onChange(name);
    setDraft(name);
    setFilter("");
    setOpen(false);
    inputRef.current?.blur();
  };
  const close=()=>{setOpen(false);setDraft(value);setFilter("");inputRef.current?.blur()};
  const show=(showAll=true)=>{placeMenu();if(showAll)setFilter("");setOpen(true);setActive(0)};
  return <div className="lektrus-subject-combobox" ref={rootRef}>
    <span className="lektrus-subject-label">Предмет</span>
    <div className="lektrus-subject-field" ref={fieldRef}>
      <input
        ref={inputRef} type="text" role="combobox"
        aria-label="Выбрать предмет доски" aria-autocomplete="list"
        aria-expanded={open} aria-controls="lektrus-subject-options"
        aria-haspopup="listbox" autoComplete="off" spellCheck={false}
        placeholder="Выбрать предмет" value={draft} disabled={disabled}
        maxLength={80} onFocus={()=>show(true)}
        onChange={event=>{setDraft(event.target.value);setFilter(event.target.value);setActive(0);show(false)}}
        onKeyDown={event=>{
          event.stopPropagation();
          if(event.key==="Escape"){event.preventDefault();close()}
          else if(event.key==="ArrowDown"){event.preventDefault();setOpen(true);setActive(index=>Math.min(index+1,Math.max(0,matches.length-1)))}
          else if(event.key==="ArrowUp"){event.preventDefault();setOpen(true);setActive(index=>Math.max(0,index-1))}
          else if(event.key==="Enter"){
            event.preventDefault();
            if(matches.length)select(matches[Math.min(active,matches.length-1)]);
            else if(draft.trim())select(draft.trim());
          }
        }}
      />
      <button type="button" aria-label={open?"Закрыть список предметов":"Открыть список предметов"} aria-expanded={open}
        disabled={disabled} onClick={()=>{
          if(open){close()}else{inputRef.current?.focus();show(true)}
        }}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
    </div>
    {open&&!disabled&&createPortal(<div id="lektrus-subject-options" className="lektrus-subject-options" role="listbox"
      ref={listRef} style={{left:position.left,top:position.top,width:position.width}}>
      <button type="button" role="option" aria-selected={!value} className={!value?"is-selected":""}
        onPointerDown={e=>e.preventDefault()} onClick={()=>select("")}>Без предмета</button>
      {matches.map((name,index)=><button type="button" role="option" key={name} aria-selected={value===name}
        className={[active===index?"is-focused":"",value===name?"is-selected":""].filter(Boolean).join(" ")}
        onMouseEnter={()=>setActive(index)} onPointerDown={e=>e.preventDefault()} onClick={()=>select(name)}>{name}</button>)}
      {!matches.length&&draft.trim()&&<button type="button" role="option" aria-selected={false}
        onPointerDown={e=>e.preventDefault()} onClick={()=>select(draft.trim())}>Выбрать «{draft.trim()}»</button>}
    </div>,document.body)}
  </div>;
}
