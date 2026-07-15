import { FormEvent, useEffect, useState } from "react";
import { Database, Edit3, Save, X } from "lucide-react";
import { supabase } from "../lib/supabase";

type DatasetRow = {
  id: string;
  project_id: string;
  dataset_name: string;
  role: string;
  row_count: number;
  unique_symbols: number | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  notes: string | null;
};

export default function DataCatalog({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<DatasetRow[]>([]);
  const [editing, setEditing] = useState<DatasetRow | null>(null);
  const [draft, setDraft] = useState<DatasetRow | null>(null);

  async function load() {
    const { data } = await supabase
      .from("dataset_catalog")
      .select("*")
      .eq("project_id", projectId)
      .order("dataset_name");
    setRows((data || []) as DatasetRow[]);
  }

  useEffect(() => { load(); }, [projectId]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    await supabase.from("dataset_catalog").update({
      dataset_name: draft.dataset_name,
      role: draft.role,
      row_count: Number(draft.row_count),
      unique_symbols: draft.unique_symbols === null ? null : Number(draft.unique_symbols),
      start_date: draft.start_date || null,
      end_date: draft.end_date || null,
      status: draft.status,
      notes: draft.notes,
    }).eq("id", draft.id);
    setEditing(null);
    setDraft(null);
    await load();
  }

  return (
    <section className="catalog-page">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">DATA INVENTORY</div>
          <h2>Datasets Used in the Study</h2>
          <p>All current files are documented here. Every record can be edited later.</p>
        </div>
      </div>

      <div className="catalog-table">
        <div className="catalog-head">
          <span>Dataset</span><span>Role</span><span>Rows</span><span>Symbols</span><span>Coverage</span><span>Status</span><span></span>
        </div>
        {rows.map((row) => (
          <div className="catalog-row" key={row.id}>
            <div><Database size={18} /><strong>{row.dataset_name}</strong></div>
            <span>{row.role}</span>
            <span>{new Intl.NumberFormat().format(row.row_count)}</span>
            <span>{row.unique_symbols ?? "—"}</span>
            <span>{row.start_date || "—"}<br />{row.end_date ? `to ${row.end_date}` : ""}</span>
            <span className={`status-pill ${row.status === "final" ? "complete" : "drafting"}`}>{row.status}</span>
            <button className="icon-button" onClick={() => { setEditing(row); setDraft({ ...row }); }}><Edit3 size={16} /></button>
          </div>
        ))}
      </div>

      {editing && draft && (
        <div className="image-modal" onClick={() => setEditing(null)}>
          <form className="metric-editor" onSubmit={save} onClick={(event) => event.stopPropagation()}>
            <div className="metric-editor-header">
              <div><div className="eyebrow">EDIT DATASET</div><h2>{editing.dataset_name}</h2></div>
              <button type="button" className="icon-button" onClick={() => setEditing(null)}><X size={18} /></button>
            </div>
            <div className="metric-editor-grid">
              <label><span>Dataset name</span><input value={draft.dataset_name} onChange={(e) => setDraft({ ...draft, dataset_name: e.target.value })} /></label>
              <label><span>Role</span><input value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} /></label>
              <label><span>Row count</span><input type="number" value={draft.row_count} onChange={(e) => setDraft({ ...draft, row_count: Number(e.target.value) })} /></label>
              <label><span>Unique symbols</span><input type="number" value={draft.unique_symbols ?? ""} onChange={(e) => setDraft({ ...draft, unique_symbols: e.target.value ? Number(e.target.value) : null })} /></label>
              <label><span>Start date</span><input type="date" value={draft.start_date || ""} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} /></label>
              <label><span>End date</span><input type="date" value={draft.end_date || ""} onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} /></label>
              <label><span>Status</span><select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}><option value="raw">Raw</option><option value="cleaned">Cleaned</option><option value="working">Working</option><option value="final">Final</option></select></label>
              <label className="wide-label"><span>Notes</span><textarea value={draft.notes || ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label>
            </div>
            <div className="metric-editor-actions">
              <button type="button" className="secondary-button" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit"><Save size={16} /> Save dataset</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
