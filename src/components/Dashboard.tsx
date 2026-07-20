import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Database, FileText, RefreshCw, SearchCheck, Server, ShieldAlert, Sparkles, TrendingUp } from "lucide-react";
import { supabase } from "../lib/supabase";

type Stats = {total_events:number;reviewed_events:number;unexplained_events:number;high_insider_events:number;cross_referenced_events:number;explained_events:number;high_confidence_events:number};

export default function Dashboard({projectId}:{projectId:string}) {
  const [stats,setStats]=useState<Stats|null>(null),[years,setYears]=useState<{event_year:number;event_count:number}[]>([]),[marketCount,setMarketCount]=useState(0),[disclosures,setDisclosures]=useState(0),[issues,setIssues]=useState(0),[cycles,setCycles]=useState(0),[lastSync,setLastSync]=useState<any>(null),[refreshing,setRefreshing]=useState(false);
  async function load(){setRefreshing(true);const[e,y,m,d,q,p,s]=await Promise.all([supabase.rpc('get_dashboard_event_stats',{p_project_id:projectId}),supabase.rpc('get_event_year_counts',{p_project_id:projectId}),supabase.rpc('count_research_market_rows',{p_project_id:projectId}),supabase.from('nepse_disclosures').select('*',{count:'exact',head:true}),supabase.from('data_quality_issues').select('*',{count:'exact',head:true}).eq('project_id',projectId).neq('status','resolved'),supabase.from('pump_cycles').select('*',{count:'exact',head:true}).eq('project_id',projectId),supabase.from('nepse_sync_runs').select('*').order('started_at',{ascending:false}).limit(1).maybeSingle()]);setStats((Array.isArray(e.data)?e.data[0]:e.data) as Stats);setYears((y.data||[]) as any);setMarketCount(Number(m.data??0));setDisclosures(d.count||0);setIssues(q.count||0);setCycles(p.count||0);setLastSync(s.data);setRefreshing(false)}
  useEffect(()=>{load()},[projectId]);
  const total=Number(stats?.total_events||0),reviewed=Number(stats?.reviewed_events||0),unexplained=Number(stats?.unexplained_events||0),highInsider=Number(stats?.high_insider_events||0),xref=Number(stats?.cross_referenced_events||0),explained=Number(stats?.explained_events||0),highConfidence=Number(stats?.high_confidence_events||0);
  const processed=Math.min(total,xref),completion=total?Math.round(processed/total*100):0,explanationRate=processed?Math.round(explained/processed*100):0;
  const max=useMemo(()=>Math.max(1,...years.map(x=>Number(x.event_count))),[years]);

  return <section className="finance-command">
    <div className="finance-intro">
      <div className="finance-intro-copy">
        <div className="finance-kicker"><Sparkles size={14}/> FORENSIC MARKET RESEARCH</div>
        <h2>Investigate the market.<br/><span>Defend every finding.</span></h2>
        <p>A private intelligence workspace for detecting unusual NEPSE activity, connecting evidence, reviewing cases, and turning analysis into publication-ready research.</p>
        <div className="finance-actions"><button onClick={load}><RefreshCw size={16} className={refreshing?"spin":""}/>Refresh research data</button><span>Last sync · {lastSync?.started_at?new Date(lastSync.started_at).toLocaleString():"not available"}</span></div>
      </div>
      <div className="finance-score">
        <div className="finance-score-top"><span>PIPELINE HEALTH</span><b>{completion}%</b></div>
        <div className="finance-ring" style={{"--score":`${completion*3.6}deg`} as React.CSSProperties}><div><strong>{completion}%</strong><span>processed</span></div></div>
        <div className="finance-score-bottom"><div><strong>{total.toLocaleString()}</strong><span>events</span></div><div><strong>{explanationRate}%</strong><span>explained</span></div><div><strong>{highConfidence.toLocaleString()}</strong><span>high confidence</span></div></div>
      </div>
    </div>

    <div className="finance-tape">
      <Tape icon={<Database/>} label="MARKET ROWS" value={marketCount.toLocaleString()} delta="Full sample"/>
      <Tape icon={<ShieldAlert/>} label="DETECTED" value={total.toLocaleString()} delta="Signal universe"/>
      <Tape icon={<SearchCheck/>} label="MATCHED" value={processed.toLocaleString()} delta={`${completion}% coverage`}/>
      <Tape icon={<FileText/>} label="EVIDENCE" value={disclosures.toLocaleString()} delta="Indexed records"/>
    </div>

    <div className="finance-grid">
      <article className="finance-panel chart-panel">
        <PanelTitle code="01 / TEMPORAL SIGNALS" title="Event activity across the sample" detail="Detected event density by calendar year."/>
        <div className="finance-chart-grid">
          <div className="finance-y-labels"><span>{max}</span><span>{Math.round(max/2)}</span><span>0</span></div>
          <div className="finance-bars">{years.map(x=><div key={x.event_year} className="finance-bar-item"><span>{Number(x.event_count).toLocaleString()}</span><i style={{height:`${Math.max(7,Number(x.event_count)/max*205)}px`}}/><small>{String(x.event_year).slice(-2)}</small></div>)}</div>
        </div>
      </article>

      <article className="finance-panel queue-panel">
        <PanelTitle code="02 / ATTENTION QUEUE" title="Research risk monitor" detail="Signals that deserve human review."/>
        <div className="finance-risk-list">
          <Risk icon={<AlertTriangle/>} label="Open quality issues" value={issues} tone="amber" note="Data integrity"/>
          <Risk icon={<ShieldAlert/>} label="High insider indicators" value={highInsider} tone="red" note="Priority cases"/>
          <Risk icon={<TrendingUp/>} label="Pump-and-dump cycles" value={cycles} tone="lime" note="Pattern detections"/>
        </div>
        <button className="finance-open-link">Open Event Laboratory <ArrowUpRight size={15}/></button>
      </article>

      <article className="finance-panel outcome-panel">
        <PanelTitle code="03 / RESOLUTION" title="Evidence outcome mix" detail="Current state of the processed event universe."/>
        <div className="finance-outcomes">
          <Outcome label="Explained" value={explained} total={Math.max(processed,1)} tone="lime"/>
          <Outcome label="Unexplained" value={unexplained} total={Math.max(processed,1)} tone="orange"/>
          <Outcome label="High-confidence" value={highConfidence} total={Math.max(processed,1)} tone="cyan"/>
          <Outcome label="Human reviewed" value={reviewed} total={Math.max(total,1)} tone="violet"/>
        </div>
      </article>

      <article className="finance-panel sync-panel">
        <PanelTitle code="04 / DATA ENGINE" title="Latest ingestion run" detail="Status of the most recent market-data synchronization."/>
        {lastSync?<div className="finance-sync"><div className="finance-sync-status"><CheckCircle2 size={22}/><span><strong>{String(lastSync.status||"unknown").replace(/_/g," ")}</strong><small>Engine status</small></span></div><div className="finance-sync-number"><strong>{Number(lastSync.records_saved||0).toLocaleString()}</strong><span>records saved</span></div><time>{new Date(lastSync.started_at).toLocaleString()}</time>{lastSync.error_message&&<p>{lastSync.error_message}</p>}</div>:<div className="v14-empty">No synchronization run is available.</div>}
      </article>
    </div>
  </section>
}

function Tape({icon,label,value,delta}:{icon:React.ReactNode;label:string;value:string;delta:string}){return <article className="finance-tape-item"><div>{icon}<span>{label}</span></div><strong>{value}</strong><small>{delta}</small></article>}
function PanelTitle({code,title,detail}:{code:string;title:string;detail:string}){return <div className="finance-panel-title"><span>{code}</span><h3>{title}</h3><p>{detail}</p></div>}
function Risk({icon,label,value,tone,note}:{icon:React.ReactNode;label:string;value:number;tone:string;note:string}){return <div className={`finance-risk ${tone}`}><div className="finance-risk-icon">{icon}</div><div><strong>{label}</strong><span>{note}</span></div><b>{value.toLocaleString()}</b></div>}
function Outcome({label,value,total,tone}:{label:string;value:number;total:number;tone:string}){const pct=Math.min(100,Math.round(value/total*100));return <div className="finance-outcome"><div><span>{label}</span><strong>{value.toLocaleString()}</strong></div><div className="finance-outcome-track"><i className={tone} style={{width:`${pct}%`}}/></div><small>{pct}% of reference set</small></div>}
