import { FormEvent, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { Decision } from "../types";

export default function DecisionsPanel({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<Decision[]>([]);
  const [title, setTitle] = useState("");
  const [decision, setDecision] = useState("");
  const [rationale, setRationale] = useState("");

  async function load() {
    const { data } = await supabase
      .from("research_decisions")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setItems((data || []) as Decision[]);
  }

  useEffect(() => { load(); }, [projectId]);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !decision.trim()) return;
    await supabase.from("research_decisions").insert({
      project_id: projectId,
      title,
      decision,
      rationale,
      status: "decided",
    });
    setTitle("");
    setDecision("");
    setRationale("");
    await load();
  }

  return (
    <section className="tool-panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">DECISION LOG</div>
          <h2>Research Decisions</h2>
        </div>
      </div>

      <form className="stack-form" onSubmit={add}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Decision topic" />
        <textarea value={decision} onChange={(e) => setDecision(e.target.value)} placeholder="What did the authors decide?" />
        <textarea value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="Why was this decision made?" />
        <button type="submit"><Plus size={16} /> Record decision</button>
      </form>

      <div className="card-list">
        {items.map((item) => (
          <article className="note-card" key={item.id}>
            <span className="tag">{item.status}</span>
            <h3>{item.title}</h3>
            <strong>{item.decision}</strong>
            <p>{item.rationale}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
