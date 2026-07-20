import { useMemo } from "react";

type Candle={trade_date:string;open_price:number|null;high_price:number|null;low_price:number|null;close_price:number|null;volume:number|null};
type Marker={event_date:string;classification?:string|null;explanation_status?:string|null};
export default function CandlestickChart({data,events}:{data:Candle[];events:Marker[]}){
 const rows=useMemo(()=>[...data].filter(r=>r.open_price!=null&&r.high_price!=null&&r.low_price!=null&&r.close_price!=null).sort((a,b)=>a.trade_date.localeCompare(b.trade_date)),[data]);
 if(!rows.length)return <div className="empty-state compact"><h3>No OHLC history</h3><p>Market rows for this ticker are not available.</p></div>;
 const W=1100,H=440,pad={l:58,r:22,t:24,b:54},chartH=H-pad.t-pad.b-70;
 const low=Math.min(...rows.map(r=>Number(r.low_price))),high=Math.max(...rows.map(r=>Number(r.high_price))),span=Math.max(.01,high-low);
 const x=(i:number)=>pad.l+i*(W-pad.l-pad.r)/Math.max(1,rows.length-1),y=(v:number)=>pad.t+(high-v)/span*chartH;
 const eventMap=new Map(events.map(e=>[e.event_date,e])); const candleW=Math.max(2,Math.min(9,(W-pad.l-pad.r)/rows.length*.62));
 const maxVol=Math.max(1,...rows.map(r=>Number(r.volume||0)));
 return <div className="candle-wrap"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Candlestick price chart with abnormal event markers">
  {[0,.25,.5,.75,1].map(t=>{const v=high-span*t,yy=y(v);return <g key={t}><line x1={pad.l} x2={W-pad.r} y1={yy} y2={yy} className="chart-grid"/><text x={pad.l-8} y={yy+4} textAnchor="end" className="chart-label">{v.toFixed(2)}</text></g>})}
  {rows.map((r,i)=>{const xx=x(i),o=y(Number(r.open_price)),c=y(Number(r.close_price)),hi=y(Number(r.high_price)),lo=y(Number(r.low_price)),up=Number(r.close_price)>=Number(r.open_price),ev=eventMap.get(r.trade_date);return <g key={r.trade_date}><line x1={xx} x2={xx} y1={hi} y2={lo} className={up?"wick up":"wick down"}/><rect x={xx-candleW/2} y={Math.min(o,c)} width={candleW} height={Math.max(1,Math.abs(c-o))} className={up?"candle up":"candle down"}/>{ev&&<g><line x1={xx} x2={xx} y1={pad.t} y2={pad.t+chartH} className="event-line"/><circle cx={xx} cy={Math.max(12,hi-10)} r="6" className={ev.explanation_status==="explained"?"event-marker explained":"event-marker"}><title>{r.trade_date}: {ev.classification||"Detected event"}</title></circle></g>}<rect x={xx-candleW/2} y={H-pad.b-Number(r.volume||0)/maxVol*55} width={candleW} height={Number(r.volume||0)/maxVol*55} className="volume-bar"/></g>})}
  <line x1={pad.l} x2={W-pad.r} y1={H-pad.b} y2={H-pad.b} className="chart-axis"/>
  {rows.filter((_r,i)=>i===0||i===rows.length-1||i%Math.max(1,Math.floor(rows.length/6))===0).map(r=>{const i=rows.indexOf(r);return <text key={r.trade_date} x={x(i)} y={H-18} textAnchor="middle" className="chart-label">{r.trade_date.slice(0,7)}</text>})}
 </svg><div className="chart-legend"><span><i className="legend-up"/>Up day</span><span><i className="legend-down"/>Down day</span><span><i className="legend-event"/>Detected event</span><span>{rows.length.toLocaleString()} sessions</span></div></div>
}
