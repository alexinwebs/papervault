"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { textKey } from "@/lib/paper-detection";

type Option = { value: string; keywords?: string; description?: string };
/** Editable, themed suggestions. Unknown values remain valid for manual creation. */
export function SuggestionInput({ id, label, value, options, onValueChange, placeholder, maxLength, required = false }: {
 id: string; label: string; value: string; options: Option[]; onValueChange: (value: string) => void;
 placeholder?: string; maxLength?: number; required?: boolean;
}) {
 const root = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null), menu = useRef<HTMLDivElement>(null);
 const [open, setOpen] = useState(false), [active, setActive] = useState(-1);
 const [position, setPosition] = useState<{ left: number; top?: number; bottom?: number; width: number; height: number }>();
 const matches = useMemo(() => { const q = textKey(value); return options.filter(o => !q || textKey(`${o.value} ${o.keywords ?? ""}`).includes(q)).slice(0, 50); }, [options, value]);
 const listId = `${id}-suggestions`;
 useLayoutEffect(() => {
  if (!open) return;
  const place = () => { const box = root.current?.getBoundingClientRect(); if (!box) return;
   const viewport = window.visualViewport, height = viewport?.height ?? window.innerHeight, offset = viewport?.offsetTop ?? 0;
   const below = offset + height - box.bottom - 12, above = box.top - offset - 12;
   const upward = below < 180 && above > below;
   const room = Math.max(60, Math.min(300, upward ? above : below));
   const width = Math.min(box.width, window.innerWidth - 16);
   setPosition({left: Math.max(8, Math.min(box.left, window.innerWidth - width - 8)), ...(upward ? {bottom: window.innerHeight-box.top+6} : {top: box.bottom+6}), width, height: room});
  };
  place(); window.addEventListener("resize",place); window.addEventListener("scroll",place,true); window.visualViewport?.addEventListener("resize",place);
  return () => { window.removeEventListener("resize",place); window.removeEventListener("scroll",place,true); window.visualViewport?.removeEventListener("resize",place); };
 }, [open]);
 useEffect(() => { if (!open) return; const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node) && !menu.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener("pointerdown",outside); return()=>document.removeEventListener("pointerdown",outside); }, [open]);
 useEffect(() => { if (active >= matches.length) setActive(-1); }, [active, matches.length]);
 useEffect(() => { if (open && active >= 0) menu.current?.querySelector(`#${id}-option-${active}`)?.scrollIntoView({block:"nearest"}); }, [active,open,id]);
 const choose = (choice: string) => { onValueChange(choice); setOpen(false); setActive(-1); input.current?.focus(); };
 return <div ref={root} className="relative min-w-0" onBlur={e=>{if(!root.current?.contains(e.relatedTarget as Node)&&!menu.current?.contains(e.relatedTarget as Node))setOpen(false);}}>
  <input ref={input} id={id} className="pv-input pr-11" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open?listId:undefined} aria-activedescendant={open&&active>=0?`${id}-option-${active}`:undefined} autoComplete="off" value={value} maxLength={maxLength} required={required} placeholder={placeholder}
   onChange={e=>{onValueChange(e.target.value);setActive(-1);setOpen(true);}}
   onKeyDown={e=>{if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();setOpen(true);setActive(i=>matches.length?(i<0?(e.key==="ArrowUp"?matches.length-1:0):Math.max(0,Math.min(matches.length-1,i+(e.key==="ArrowDown"?1:-1)))):-1);}
    else if(open&&(e.key==="Home"||e.key==="End")){e.preventDefault();setActive(matches.length?(e.key==="Home"?0:matches.length-1):-1);}
    else if(e.key==="Escape"&&open){e.preventDefault();e.stopPropagation();setOpen(false);setActive(-1);}
    else if(e.key==="Enter"&&open){e.preventDefault();if(active>=0&&matches[active])choose(matches[active].value);else setOpen(false);}
    else if(e.key==="Tab"){setOpen(false);setActive(-1);}}} />
  <button type="button" aria-label={`${open?"Close":"Open"} ${label.toLowerCase()} suggestions`} aria-expanded={open} aria-controls={open?listId:undefined} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-sm hover:bg-blue-soft/50" onClick={()=>{input.current?.focus();setOpen(o=>!o);setActive(-1);}}><ChevronDown className={`h-4 w-4 ${open?"rotate-180":""}`} aria-hidden /></button>
  <span className="sr-only" role="status" aria-live="polite">{open ? `${matches.length} suggestions. Use arrow keys to choose, Enter to select, or Escape to close. You can also keep a new value.` : ""}</span>
  {open&&position?createPortal(<div ref={menu} id={listId} role="listbox" aria-label={`${label} suggestions`} className="fixed z-[100] overflow-auto overscroll-contain rounded-sm border-2 border-ink bg-paper p-1 text-ink shadow-hard" style={{left:position.left,top:position.top,bottom:position.bottom,width:position.width,maxHeight:position.height}}>
   {matches.length?matches.map((option,index)=><div key={option.value} id={`${id}-option-${index}`} role="option" aria-selected={active===index} onPointerDown={e=>e.preventDefault()} onPointerMove={()=>setActive(index)} onClick={()=>choose(option.value)} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-3 py-2 font-sans text-sm ${active===index?"bg-blue-light":"hover:bg-blue-soft"}`}><span className="min-w-0 flex-1 break-words">{option.value}{option.description?<span className="ml-2 text-xs text-ink/60">{option.description}</span>:null}</span>{textKey(value)===textKey(option.value)?<Check className="h-4 w-4 shrink-0" aria-hidden/>:null}</div>):<p className="px-3 py-3 font-sans text-sm text-ink/70">No matching entry. Keep typing to create a new {label.toLowerCase()} when you submit.</p>}
  </div>,document.body):null}
 </div>;
}
