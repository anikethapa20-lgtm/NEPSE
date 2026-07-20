import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent } from "react";

type Candle={trade_date:string;open_price:number|null;high_price:number|null;low_price:number|null;close_price:number|null;volume:number|null};
type Marker={event_date:string;classification?:string|null;explanation_status?:string|null};
type RangeKey="1D"|"1W"|"1M"|"MTD"|"YTD"|"1Y"|"ALL";

const RANGE_OPTIONS:RangeKey[]=["1D","1W","1M","MTD","YTD","1Y","ALL"];
const money=(value:number|null|undefined)=>value==null?"—":value.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const integer=(value:number|null|undefined)=>value==null?"—":Math.round(value).toLocaleString();

function initialWindow(rows:Candle[],range:RangeKey){
 const end=rows.length;
 if(!end)return {start:0,end:0};
 if(range==="ALL")return {start:0,end};
 if(range==="1D")return {start:Math.max(0,end-1),end};
 if(range==="1W")return {start:Math.max(0,end-5),end};
 if(range==="1M")return {start:Math.max(0,end-22),end};
 const last=new Date(`${rows[end-1].trade_date}T00:00:00`);
 let cutoff=new Date(last);
 if(range==="MTD")cutoff=new Date(last.getFullYear(),last.getMonth(),1);
 if(range==="YTD")cutoff=new Date(last.getFullYear(),0,1);
 if(range==="1Y")cutoff=new Date(last.getFullYear()-1,last.getMonth(),last.getDate());
 const start=Math.max(0,rows.findIndex(r=>new Date(`${r.trade_date}T00:00:00`)>=cutoff));
 return {start:start<0?0:start,end};
}

export default function CandlestickChart({data,events}:{data:Candle[];events:Marker[]}){
 const rows=useMemo(()=>[...data].filter(r=>r.open_price!=null&&r.high_price!=null&&r.low_price!=null&&r.close_price!=null).sort((a,b)=>a.trade_date.localeCompare(b.trade_date)),[data]);
 const [range,setRange]=useState<RangeKey>("ALL");
 const [window,setWindow]=useState(()=>initialWindow(rows,"ALL"));
 const [hovered,setHovered]=useState<number|null>(null);
 const drag=useRef<{x:number;start:number;end:number}|null>(null);
 const svgRef=useRef<SVGSVGElement|null>(null);
 useEffect(()=>{setRange("ALL");setWindow(initialWindow(rows,"ALL"));setHovered(null)},[rows.length,rows.length?rows[rows.length-1].trade_date:undefined]);
 if(!rows.length)return <div className="empty-state compact"><h3>No OHLC history</h3><p>Market rows for this ticker are not available.</p></div>;

 const safeWindow={start:Math.max(0,Math.min(window.start,rows.length-1)),end:Math.max(1,Math.min(window.end,rows.length))};
 const visible=rows.slice(safeWindow.start,safeWindow.end);
 const W=1100,H=470,pad={l:64,r:28,t:28,b:64},chartH=H-pad.t-pad.b-78,plotW=W-pad.l-pad.r;
 const low=Math.min(...visible.map(r=>Number(r.low_price))),high=Math.max(...visible.map(r=>Number(r.high_price))),span=Math.max(.01,high-low);
 const x=(i:number)=>pad.l+(visible.length===1?plotW/2:i*plotW/Math.max(1,visible.length-1));
 const y=(v:number)=>pad.t+(high-v)/span*chartH;
 const eventMap=new Map(events.map(e=>[e.event_date,e]));
 const candleW=Math.max(3,Math.min(15,plotW/Math.max(1,visible.length)*.62));
 const maxVol=Math.max(1,...visible.map(r=>Number(r.volume||0)));
 const first=visible[0],last=visible[visible.length-1];
 const change=first&&last?Number(last.close_price)-Number(first.open_price):0;
 const changePct=first&&Number(first.open_price)?change/Number(first.open_price)*100:0;
 const selected=hovered==null?null:visible[hovered];

 function applyRange(next:RangeKey){setRange(next);setWindow(initialWindow(rows,next));setHovered(null)}
 function pointerIndex(clientX:number){
  const rect=svgRef.current?.getBoundingClientRect(); if(!rect)return null;
  const svgX=(clientX-rect.left)/rect.width*W;
  return Math.max(0,Math.min(visible.length-1,Math.round((svgX-pad.l)/plotW*Math.max(1,visible.length-1))));
 }
 function onPointerDown(e:ReactPointerEvent<SVGSVGElement>){
  e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,start:safeWindow.start,end:safeWindow.end};
 }
 function onPointerMove(e:ReactPointerEvent<SVGSVGElement>){
  const i=pointerIndex(e.clientX);if(i!=null)setHovered(i);
  if(!drag.current)return;
  const rect=e.currentTarget.getBoundingClientRect();const count=drag.current.end-drag.current.start;
  const shift=Math.round((drag.current.x-e.clientX)/rect.width*count);
  let start=drag.current.start+shift;start=Math.max(0,Math.min(rows.length-count,start));
  setWindow({start,end:start+count});setRange("ALL");
 }
 function onPointerUp(e:ReactPointerEvent<SVGSVGElement>){e.currentTarget.releasePointerCapture(e.pointerId);drag.current=null}
 function onWheel(e:WheelEvent<SVGSVGElement>){
  e.preventDefault();const current=safeWindow.end-safeWindow.start;if(rows.length<2)return;
  const direction=e.deltaY>0?1:-1;const nextCount=Math.max(5,Math.min(rows.length,Math.round(current*(direction>0?1.18:.84))));
  const idx=pointerIndex(e.clientX)??Math.floor(visible.length/2);const anchor=(safeWindow.start+idx)/Math.max(1,rows.length-1);
  let start=Math.round((safeWindow.start+idx)-nextCount*anchor);start=Math.max(0,Math.min(rows.length-nextCount,start));
  setWindow({start,end:start+nextCount});setRange("ALL");
 }

 return <div className="candle-wrap">
  <div className="chart-toolbar">
   <div className="range-buttons" aria-label="Chart range">{RANGE_OPTIONS.map(item=><button key={item} className={range===item?"active":""} onClick={()=>applyRange(item)}>{item}</button>)}</div>
   <div className="chart-summary"><span><small>Period return</small><strong className={change>=0?"positive":"negative"}>{change>=0?"+":""}{money(change)} ({changePct>=0?"+":""}{changePct.toFixed(2)}%)</strong></span><span><small>Visible range</small><strong>{first.trade_date} — {last.trade_date}</strong></span></div>
  </div>
  <div className="chart-interaction-hint">Drag to move · Scroll to zoom · Hover for exact OHLC and volume</div>
  <div className="chart-stage">
   {selected&&<div className="chart-tooltip"><strong>{selected.trade_date}</strong><span>Open <b>{money(selected.open_price)}</b></span><span>High <b>{money(selected.high_price)}</b></span><span>Low <b>{money(selected.low_price)}</b></span><span>Close <b>{money(selected.close_price)}</b></span><span>Volume <b>{integer(selected.volume)}</b></span>{eventMap.has(selected.trade_date)&&<em>{eventMap.get(selected.trade_date)?.classification||"Detected event"}</em>}</div>}
   <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Interactive candlestick price chart with abnormal event markers" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={()=>drag.current=null} onPointerLeave={()=>{if(!drag.current)setHovered(null)}} onWheel={onWheel}>
    {[0,.25,.5,.75,1].map(t=>{const v=high-span*t,yy=y(v);return <g key={t}><line x1={pad.l} x2={W-pad.r} y1={yy} y2={yy} className="chart-grid"/><text x={pad.l-8} y={yy+4} textAnchor="end" className="chart-label">{v.toFixed(2)}</text></g>})}
    {visible.map((r,i)=>{const xx=x(i),o=y(Number(r.open_price)),c=y(Number(r.close_price)),hi=y(Number(r.high_price)),lo=y(Number(r.low_price)),up=Number(r.close_price)>=Number(r.open_price),ev=eventMap.get(r.trade_date);return <g key={r.trade_date}><line x1={xx} x2={xx} y1={hi} y2={lo} className={up?"wick up":"wick down"}/><rect x={xx-candleW/2} y={Math.min(o,c)} width={candleW} height={Math.max(1,Math.abs(c-o))} className={up?"candle up":"candle down"}/>{ev&&<g><line x1={xx} x2={xx} y1={pad.t} y2={pad.t+chartH} className="event-line"/><circle cx={xx} cy={Math.max(12,hi-10)} r="6" className={ev.explanation_status==="explained"?"event-marker explained":"event-marker"}/></g>}<rect x={xx-candleW/2} y={H-pad.b-Number(r.volume||0)/maxVol*58} width={candleW} height={Number(r.volume||0)/maxVol*58} className="volume-bar"/></g>})}
    {hovered!=null&&visible[hovered]&&<g className="crosshair"><line x1={x(hovered)} x2={x(hovered)} y1={pad.t} y2={H-pad.b}/><line x1={pad.l} x2={W-pad.r} y1={y(Number(visible[hovered].close_price))} y2={y(Number(visible[hovered].close_price))}/><circle cx={x(hovered)} cy={y(Number(visible[hovered].close_price))} r="4"/></g>}
    <line x1={pad.l} x2={W-pad.r} y1={H-pad.b} y2={H-pad.b} className="chart-axis"/>
    {visible.map((r,i)=>({r,i})).filter(({i})=>i===0||i===visible.length-1||i%Math.max(1,Math.floor(visible.length/6))===0).map(({r,i})=><text key={`${r.trade_date}-${i}`} x={x(i)} y={H-22} textAnchor="middle" className="chart-label">{visible.length<35?r.trade_date.slice(5):r.trade_date.slice(0,7)}</text>)}
   </svg>
  </div>
  <div className="chart-legend"><span><i className="legend-up"/>Up day</span><span><i className="legend-down"/>Down day</span><span><i className="legend-event"/>Detected event</span><span>{visible.length.toLocaleString()} of {rows.length.toLocaleString()} sessions</span></div>
 </div>
}
