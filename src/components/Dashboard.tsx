import { useEffect, useMemo, useState } from "react";
import { BarChart3, CheckCircle2, Database, FileCheck2, Files, FlaskConical, NotebookPen, Scale } from "lucide-react";
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

  useEffect(() => {
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
    load();
  }, [projectId, sections]);

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

      <section className="metric-grid">
        <MetricCard icon={<Database size={20} />} label="Daily observations" value={format(metric("total_observations")?.metric_value)} />
        <MetricCard icon={<BarChart3 size={20} />} label="Unique stocks" value={format(metric("unique_stocks")?.metric_value)} />
        <MetricCard icon={<FlaskConical size={20} />} label="Detected events" value={format(metric("suspicious_events")?.metric_value)} />
        <MetricCard icon={<FileCheck2 size={20} />} label="Pre-event CAR" value={`${metric("pre_event_car")?.metric_value ?? 0}%`} />
        <MetricCard icon={<Files size={20} />} label="Uploaded files" value={String(counts.files)} />
        <MetricCard icon={<NotebookPen size={20} />} label="Analysis notes" value={String(counts.notes)} />
        <MetricCard icon={<Scale size={20} />} label="Research decisions" value={String(counts.decisions)} />
        <MetricCard icon={<CheckCircle2 size={20} />} label="Complete sections" value={`${statusCounts.complete}/${sections.length}`} />
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-card">
          <div className="card-title-row">
            <div>
              <div className="eyebrow">MANUSCRIPT</div>
              <h2>Section Progress</h2>
            </div>
          </div>
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
            <Finding label="CAR(-5,-1)" value="3.04%" detail="t = 9.15, p < 0.001" />
            <Finding label="CAR(+1,+5)" value="-0.50%" detail="t ≈ -1.64, p ≈ 0.10" />
            <Finding label="Event rule" value="3σ + 5× volume" detail="Return and volume must both spike" />
            <Finding label="Event window" value="-10 to +10" detail="Trading days around each event" />
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
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <article className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
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
