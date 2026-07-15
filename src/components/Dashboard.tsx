import { FormEvent, useEffect, useMemo, useState } from "react";
import { BarChart3, CheckCircle2, Database, Edit3, FileCheck2, Files, FlaskConical, NotebookPen, Save, Scale, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { PaperSection, ProjectMetric } from "../types";

type Props = {
  projectId: string;
  sections: PaperSection[];
};

export default function Dashboard({ projectId, sections }: Props) {
  const [metrics, setMetrics] = useState<ProjectMetric[]>([]);
  const [counts, setCounts] = useState({ notes: 0, decisions: 0, files: 0 });
  const [recentSections, setRecentSections] = useState<PaperSection[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  async function load() {
    const [metricResult, noteResult, decisionResult, fileResult, sectionResult] = await Promise.all([
      supabase.from("project_metrics").select("*").eq("project_id", projectId).order("sort_order"),
      supabase.from("research_notes").select("*", { count: "exact", head: true }).eq("project_id", projectId),
      supabase.from("research_decisions").select("*", { count: "exact", head: true }).eq("project_id", projectId),
      supabase.from("research_files").select("*", { count: "exact", head: true }).eq("project_id", projectId),
      supabase.from("paper_sections").select("*").eq("project_id", projectId).order("updated_at", { ascending: false }).limit(5),
    ]);

    setMetrics((metricResult.data || []) as ProjectMetric[]);
    setCounts({
      notes: noteResult.count || 0,
      decisions: decisionResult.count || 0,
      files: fileResult.count || 0,
    });
    setRecentSections((sectionResult.data || []) as PaperSection[]);
  }

  useEffect(() => { load(); }, [projectId, sections]);

  const progress = useMemo(() => {
    const weights: Record<PaperSection["status"], number> = {
      not_started: 0,
      drafting: 0.35,
      review: 0.75,
      complete: 1,
    };
    const total = sections.reduce((sum, section) => sum + weights[section.status], 0);
    return sections.length ? Math.round((total / sections.length) * 100) : 0;
  }, [sections]);

  const statusCounts = useMemo(() => ({
    complete: sections.filter((s) => s.status === "complete").length,
    review: sections.filter((s) => s.status === "review").length,
    drafting: sections.filter((s) => s.status === "drafting").length,
    not_started: sections.filter((s) => s.status === "not_started").length,
  }), [sections]);

  const metric = (key: string) => metrics.find((m) => m.metric_key === key);

  function openEditor() {
    const initial: Record<string, string> = {};
    metrics.forEach((item) => { initial[item.metric_key] = String(item.metric_value); });
    setDraft(initial);
    setMessage("");
    setEditing(true);
  }

  async function saveMetrics(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    const updates = metrics.map((item) => ({
      id: item.id,
      project_id: item.project_id,
      metric_key: item.metric_key,
      metric_label: item.metric_label,
      metric_value: Number(draft[item.metric_key] ?? item.metric_value),
      metric_unit: item.metric_unit,
      metric_group: item.metric_group,
      sort_order: item.sort_order,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("project_metrics").upsert(updates);
    if (error) {
      setMessage(error.message);
      return;
    }
    await load();
    setEditing(false);
  }

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero">
        <div>
          <div className="eyebrow">RESEARCH OVERVIEW</div>
          <h1>NEPSE Abnormal Trading Study</h1>
          <p>
            Track manuscript development, evidence, research decisions, datasets, and the main empirical findings in one place.
          </p>
        </div>
        <div className="progress-ring-card">
          <div className="progress-number">{progress}%</div>
          <div>Overall research progress</div>
          <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
        </div>
      </section>

      <div className="dashboard-toolbar">
        <span>Dashboard values are editable and can be updated as the analysis changes.</span>
        <button onClick={openEditor}><Edit3 size={16} /> Edit dashboard data</button>
      </div>

      <section className="metric-grid">
        <MetricCard icon={<Database size={20} />} label="Daily observations" value={format(metric("total_observations")?.metric_value)} />
        <MetricCard icon={<BarChart3 size={20} />} label="Unique stocks in event file" value={format(metric("unique_event_stocks")?.metric_value)} />
        <MetricCard icon={<FlaskConical size={20} />} label="Detected events" value={format(metric("suspicious_events")?.metric_value)} />
        <MetricCard icon={<FileCheck2 size={20} />} label="Pre-event CAR" value={`${metric("pre_event_car")?.metric_value ?? 0}%`} />
        <MetricCard icon={<Files size={20} />} label="Uploaded files" value={String(counts.files)} />
        <MetricCard icon={<NotebookPen size={20} />} label="Analysis notes" value={String(counts.notes)} />
        <MetricCard icon={<Scale size={20} />} label="Research decisions" value={String(counts.decisions)} />
        <MetricCard icon={<CheckCircle2 size={20} />} label="Complete sections" value={`${statusCounts.complete}/${sections.length}`} />
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-card">
          <div className="eyebrow">MANUSCRIPT</div>
          <h2>Section Progress</h2>
          <div className="status-bars">
            <StatusBar label="Complete" count={statusCounts.complete} total={sections.length} />
            <StatusBar label="Ready for review" count={statusCounts.review} total={sections.length} />
            <StatusBar label="Drafting" count={statusCounts.drafting} total={sections.length} />
            <StatusBar label="Not started" count={statusCounts.not_started} total={sections.length} />
          </div>
        </article>

        <article className="dashboard-card">
          <div className="eyebrow">EMPIRICAL FINDINGS</div>
          <h2>Current Evidence</h2>
          <div className="finding-list">
            <Finding label="CAR(-5,-1)" value={`${metric("pre_event_car")?.metric_value ?? 3.04}%`} detail={`t = ${metric("pre_event_t")?.metric_value ?? 9.15}, p < 0.001`} />
            <Finding label="CAR(+1,+5)" value={`${metric("post_event_car")?.metric_value ?? -0.50}%`} detail={`t ≈ ${metric("post_event_t")?.metric_value ?? -1.64}, p ≈ 0.10`} />
            <Finding label="Event rule" value="3σ + 5× volume" detail="Return and volume must both spike" />
            <Finding label="Event window" value="-10 to +10" detail="Trading days around each event" />
          </div>
        </article>

        <article className="dashboard-card wide">
          <div className="eyebrow">DATA COVERAGE</div>
          <h2>Current Dataset Inventory</h2>
          <div className="finding-list two-column">
            <Finding label="Raw ShareSansar rows" value={format(metric("raw_rows")?.metric_value)} detail="2015-01-01 to 2026-03-06" />
            <Finding label="Clean panel rows" value={format(metric("clean_rows")?.metric_value)} detail="2015-01-01 to 2026-03-03" />
            <Finding label="Research dataset rows" value={format(metric("research_rows")?.metric_value)} detail="Includes return and abnormal return" />
            <Finding label="NEPSE index workbook rows" value={format(metric("index_rows")?.metric_value)} detail="Historical market index series" />
          </div>
        </article>

        <article className="dashboard-card wide">
          <div className="eyebrow">LATEST WORK</div>
          <h2>Recently Updated Sections</h2>
          <div className="recent-list">
            {recentSections.map((section) => (
              <div key={section.id}>
                <div>
                  <strong>{section.title}</strong>
                  <span>{new Date(section.updated_at).toLocaleString()}</span>
                </div>
                <span className={`status-pill ${section.status}`}>{section.status.replace("_", " ")}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      {editing && (
        <div className="image-modal" onClick={() => setEditing(false)}>
          <form className="metric-editor" onSubmit={saveMetrics} onClick={(event) => event.stopPropagation()}>
            <div className="metric-editor-header">
              <div>
                <div className="eyebrow">EDITABLE DASHBOARD</div>
                <h2>Update Research Metrics</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setEditing(false)}><X size={18} /></button>
            </div>
            <div className="metric-editor-grid">
              {metrics.map((item) => (
                <label key={item.id}>
                  <span>{item.metric_label}</span>
                  <input
                    type="number"
                    step="any"
                    value={draft[item.metric_key] ?? ""}
                    onChange={(event) => setDraft((current) => ({ ...current, [item.metric_key]: event.target.value }))}
                  />
                  <small>{item.metric_unit || "numeric value"}</small>
                </label>
              ))}
            </div>
            {message && <div className="error-banner">{message}</div>}
            <div className="metric-editor-actions">
              <button type="button" className="secondary-button" onClick={() => setEditing(false)}>Cancel</button>
              <button type="submit"><Save size={16} /> Save dashboard</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <article className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div><span>{label}</span><strong>{value}</strong></div>
    </article>
  );
}

function StatusBar({ label, count, total }: { label: string; count: number; total: number }) {
  const width = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="status-row">
      <div><span>{label}</span><strong>{count}</strong></div>
      <div className="progress-track"><span style={{ width: `${width}%` }} /></div>
    </div>
  );
}

function Finding({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="finding">
      <div><span>{label}</span><small>{detail}</small></div>
      <strong>{value}</strong>
    </div>
  );
}

function format(value?: number) {
  return value === undefined ? "—" : new Intl.NumberFormat().format(value);
}
