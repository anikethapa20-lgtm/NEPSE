import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Filter, Search, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { ResearchEvent } from "../types";

const PAGE_SIZE = 50;
const classifications = [
  "Unreviewed",
  "Explained by public information",
  "Possible information leakage",
  "Possible informed trading",
  "Possible pump-and-dump",
  "Speculative activity",
  "Corporate-action distortion",
  "Data-quality issue",
  "Unclear",
];

export default function EventExplorer({ projectId }: { projectId: string }) {
  const [events, setEvents] = useState<ResearchEvent[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [symbol, setSymbol] = useState("");
  const [year, setYear] = useState("");
  const [classification, setClassification] = useState("");
  const [minSeverity, setMinSeverity] = useState("");
  const [selected, setSelected] = useState<ResearchEvent | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    let query = supabase
      .from("research_events")
      .select("*", { count: "exact" })
      .eq("project_id", projectId)
      .order("severity_score", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (symbol.trim()) query = query.ilike("symbol", `%${symbol.trim()}%`);
    if (year) query = query.eq("event_year", Number(year));
    if (classification) query = query.eq("classification", classification);
    if (minSeverity) query = query.gte("severity_score", Number(minSeverity));

    const { data, count: total } = await query;
    setEvents((data || []) as ResearchEvent[]);
    setCount(total || 0);
    setLoading(false);
  }

  useEffect(() => { load(); }, [projectId, page, symbol, year, classification, minSeverity]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const years = useMemo(() => Array.from({ length: 12 }, (_, i) => 2015 + i), []);

  async function saveReview() {
    if (!selected) return;
    const { data } = await supabase
      .from("research_events")
      .update({
        classification: selected.classification,
        review_status: selected.review_status,
        announcement_match: selected.announcement_match,
        insider_score: selected.insider_score,
        pump_score: selected.pump_score,
        reviewer_notes: selected.reviewer_notes,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", selected.id)
      .select()
      .single();
    if (data) { setSelected(data as ResearchEvent); await load(); }
  }

  return (
    <section className="system-page">
      <div className="system-heading">
        <div><div className="eyebrow">EVENT DATABASE</div><h1>Event Explorer</h1><p>Search, rank, classify, and review all currently detected abnormal trading events.</p></div>
        <div className="record-count">{count.toLocaleString()} matching events</div>
      </div>

      <div className="filter-panel">
        <div className="search-field"><Search size={16} /><input value={symbol} onChange={(e) => { setPage(0); setSymbol(e.target.value); }} placeholder="Search symbol" /></div>
        <select value={year} onChange={(e) => { setPage(0); setYear(e.target.value); }}><option value="">All years</option>{years.map((y) => <option key={y}>{y}</option>)}</select>
        <select value={classification} onChange={(e) => { setPage(0); setClassification(e.target.value); }}><option value="">All classifications</option>{classifications.map((c) => <option key={c}>{c}</option>)}</select>
        <input type="number" value={minSeverity} onChange={(e) => { setPage(0); setMinSeverity(e.target.value); }} placeholder="Min severity" />
        <button className="secondary-action" onClick={() => { setPage(0); setSymbol(""); setYear(""); setClassification(""); setMinSeverity(""); }}><Filter size={16} /> Reset</button>
      </div>

      <div className="data-table-wrap">
        <table className="system-table">
          <thead><tr><th>Symbol</th><th>Date</th><th>Abnormal return</th><th>Volume multiple</th><th>Return sigma</th><th>Severity</th><th>Classification</th><th>Confidence</th><th>Evidence</th><th>Status</th></tr></thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} onClick={() => setSelected(event)}>
                <td><strong>{event.symbol}</strong></td><td>{event.event_date}</td>
                <td className={(event.abnormal_return || 0) >= 0 ? "positive" : "negative"}>{pct(event.abnormal_return)}</td>
                <td>{num(event.volume_multiple)}×</td><td>{num(event.return_sigma)}σ</td>
                <td><span className="severity-badge">{num(event.severity_score)}</span></td>
                <td>{event.auto_classification || event.classification}</td><td>{event.confidence_score==null?"—":Number(event.confidence_score).toFixed(0)}</td><td>{(event.matched_disclosure_count||0)}D · {(event.matched_pump_cycle_count||0)}P</td><td><span className={`status-pill ${event.review_status === "reviewed" ? "complete" : "drafting"}`}>{event.review_status}</span></td>
              </tr>
            ))}
            {!loading && !events.length && <tr><td colSpan={10} className="empty-cell">No events match the current filters.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={16} /> Previous</button>
        <span>Page {page + 1} of {totalPages}</span>
        <button disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight size={16} /></button>
      </div>

      {selected && (
        <div className="drawer-backdrop" onClick={() => setSelected(null)}>
          <aside className="event-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header"><div><div className="eyebrow">EVENT #{selected.id}</div><h2>{selected.symbol} · {selected.event_date}</h2></div><button className="icon-button" onClick={() => setSelected(null)}><X size={18} /></button></div>
            <div className="event-stat-grid"><Stat label="Abnormal return" value={pct(selected.abnormal_return)} /><Stat label="Volume multiple" value={`${num(selected.volume_multiple)}×`} /><Stat label="Return sigma" value={`${num(selected.return_sigma)}σ`} /><Stat label="Severity score" value={num(selected.severity_score)} /></div>
            <div className="warning-note"><strong>Automatic evidence:</strong> {selected.cross_reference_summary || "Not cross-referenced yet."}</div><div className="event-stat-grid"><Stat label="Pre-event CAR" value={pct(selected.pre_car_5??null)}/><Stat label="Post-event CAR" value={pct(selected.post_car_5??null)}/><Stat label="Disclosure matches" value={String(selected.matched_disclosure_count||0)}/><Stat label="Pump matches" value={String(selected.matched_pump_cycle_count||0)}/></div><label>Classification<select value={selected.classification} onChange={(e) => setSelected({ ...selected, classification: e.target.value })}>{classifications.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label>Review status<select value={selected.review_status} onChange={(e) => setSelected({ ...selected, review_status: e.target.value })}><option value="pending">Pending</option><option value="in_review">In review</option><option value="reviewed">Reviewed</option></select></label>
            <label>Announcement match<input value={selected.announcement_match || ""} onChange={(e) => setSelected({ ...selected, announcement_match: e.target.value })} placeholder="None, before event, event day, after buildup..." /></label>
            <div className="two-inputs"><label>Insider score<input type="number" min="0" max="100" value={selected.insider_score ?? ""} onChange={(e) => setSelected({ ...selected, insider_score: e.target.value ? Number(e.target.value) : null })} /></label><label>Pump score<input type="number" min="0" max="100" value={selected.pump_score ?? ""} onChange={(e) => setSelected({ ...selected, pump_score: e.target.value ? Number(e.target.value) : null })} /></label></div>
            <label>Reviewer notes<textarea value={selected.reviewer_notes || ""} onChange={(e) => setSelected({ ...selected, reviewer_notes: e.target.value })} placeholder="Evidence, concerns, validation, and final reasoning..." /></label>
            <button className="primary-action" onClick={saveReview}>Save event review</button>
          </aside>
        </div>
      )}
    </section>
  );
}
function Stat({ label, value }: { label: string; value: string }) { return <div className="event-stat"><span>{label}</span><strong>{value}</strong></div>; }
function num(v: number | null) { return v == null ? "—" : Number(v).toFixed(2); }
function pct(v: number | null) { return v == null ? "—" : `${(Number(v) * 100).toFixed(2)}%`; }
