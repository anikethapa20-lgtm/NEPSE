import { useEffect,useMemo,useState } from "react";
import { ExternalLink, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabase";

type Evidence={id:string;source_name:string;source_type:string;title:string;published_at:string|null;symbol:string|null;summary:string|null;source_url:string;authority_score:number|null;relevance_score:number|null;matched_terms:string[]|null;evidence_type:string|null;validation_status:string|null};
type Coverage={evidence_year:number;official_records:number;news_records:number;symbol_linked_records:number;disclosure_records:number};
type Run={source_key:string;status:string;records_saved:number;disclosures_saved:number;pages_scanned:number;started_at:string|null;completed_at:string|null;error_message:string|null};

export default function PublicEvidence(){
  const[rows,setRows]=useState<Evidence[]>([]),[coverage,setCoverage]=useState<Coverage[]>([]),[runs,setRuns]=useState<Run[]>([]),[query,setQuery]=useState(""),[source,setSource]=useState("all"),[loading,setLoading]=useState(false);
  async function load(){
    setLoading(true);
    let q=supabase.from("internet_evidence").select("id,source_name,source_type,title,published_at,symbol,summary,source_url,authority_score,relevance_score,matched_terms,evidence_type,validation_status").eq("is_relevant",true).not("published_at","is",null).order("relevance_score",{ascending:false}).order("published_at",{ascending:false}).limit(300);
    if(query.trim())q=q.or(`title.ilike.%${query.trim()}%,summary.ilike.%${query.trim()}%,symbol.ilike.%${query.trim()}%`);
    if(source!=="all")q=q.eq("source_type",source);
    const[e,c,r]=await Promise.all([q,supabase.rpc("get_evidence_coverage_by_year"),supabase.rpc("get_evidence_backfill_status")]);
    setRows((e.data||[]) as Evidence[]);
    setCoverage((c.data||[]) as Coverage[]);
    setRuns((r.data||[]) as Run[]);
    setLoading(false);
  }
  useEffect(()=>{load()},[]);
  const totalOfficial=useMemo(()=>coverage.reduce((sum,row)=>sum+Number(row.official_records||0),0),[coverage]);
  const totalLinked=useMemo(()=>coverage.reduce((sum,row)=>sum+Number(row.symbol_linked_records||0),0),[coverage]);
  const coveredYears=useMemo(()=>coverage.filter(row=>Number(row.official_records||0)+Number(row.news_records||0)>0).length,[coverage]);
  const maxYearTotal=Math.max(1,...coverage.map(row=>Number(row.official_records||0)+Number(row.news_records||0)));
  return <section className="system-page">
    <div className="system-heading"><div><div className="eyebrow">VERIFIED REAL-WORLD EVIDENCE</div><h1>Public Evidence</h1><p>Dated regulator, exchange, company, and lower-weight news records used by the cross-reference engine.</p></div><button className="secondary-action" onClick={load}><RefreshCw size={16}/>{loading?"Refreshing…":"Refresh"}</button></div>
    <div className="evidence-summary-grid"><div><span>Official records</span><strong>{totalOfficial.toLocaleString()}</strong></div><div><span>Symbol-linked</span><strong>{totalLinked.toLocaleString()}</strong></div><div><span>Years covered</span><strong>{coveredYears}/{coverage.length||12}</strong></div><div><span>Backfill sources</span><strong>{runs.filter(run=>run.status==="completed").length}/{runs.length||6}</strong></div></div>
    <article className="evidence-coverage-card"><div className="coverage-heading"><div><div className="eyebrow">HISTORICAL COVERAGE</div><h2>Evidence by year</h2></div><small>Official records are weighted above news-discovery records.</small></div><div className="coverage-chart">{coverage.map(row=>{const official=Number(row.official_records||0),news=Number(row.news_records||0),total=official+news;return <div key={row.evidence_year} className="coverage-year"><div className="coverage-bars"><i className="official" style={{height:`${Math.max(total?4:0,official/maxYearTotal*110)}px`}}/><i className="news" style={{height:`${Math.max(total?3:0,news/maxYearTotal*110)}px`}}/></div><strong>{total}</strong><span>{row.evidence_year}</span></div>})}</div><div className="coverage-legend"><span><i className="official"/>Official</span><span><i className="news"/>News discovery</span></div></article>
    <div className="backfill-status-grid">{runs.map(run=><div key={run.source_key} className="backfill-status"><span>{run.source_key.replace(/-/g," ")}</span><strong className={run.status}>{run.status.replace(/_/g," ")}</strong><small>{Number(run.records_saved||0).toLocaleString()} records · {Number(run.pages_scanned||0).toLocaleString()} pages</small>{run.error_message&&<small className="run-error">{run.error_message}</small>}</div>)}</div>
    <div className="evidence-toolbar"><div className="search-field"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load()} placeholder="Search company, ticker, or event"/></div><select value={source} onChange={e=>setSource(e.target.value)}><option value="all">All reliable sources</option><option value="regulator">Regulators</option><option value="exchange">Exchange</option><option value="company">Company sources</option><option value="news">News discovery</option></select><button className="primary-action" onClick={load}>Search</button></div>
    <div className="evidence-list">{rows.map(r=><article className="evidence-card" key={r.id}><div className="evidence-source"><ShieldCheck size={17}/><span>{r.source_name}</span><small>{r.validation_status==="official"?"Official source":r.validation_status==="discovery_only"?"Discovery only":r.source_type}</small></div><div className="evidence-content"><div className="evidence-title-row"><h3>{r.title}</h3>{r.symbol&&<span className="symbol-chip">Matched to {r.symbol}</span>}</div>{r.summary&&<p>{r.summary}</p>}<div className="evidence-meta"><span>{r.published_at?new Date(r.published_at).toLocaleDateString():"—"}</span><span>{String(r.evidence_type||"market event").replace(/_/g," ")}</span><span>Relevance {Math.round(Number(r.relevance_score||0))}/100</span><span>Authority {Math.round(Number(r.authority_score||0))}/100</span><a href={r.source_url} target="_blank" rel="noreferrer">Open source <ExternalLink size={13}/></a></div>{r.matched_terms?.length?<div className="matched-terms">Matched: {r.matched_terms.slice(0,5).join(", ")}</div>:null}</div></article>)}{!rows.length&&<div className="empty-state"><h3>No verified evidence loaded</h3><p>Run the historical backfill and refresh. Undated and generic institutional pages are excluded.</p></div>}</div>
  </section>
}
