import { FormEvent, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { ResearchNote } from "../types";

export default function NotesPanel({ projectId }: { projectId: string }) {
  const [notes, setNotes] = useState<ResearchNote[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [noteType, setNoteType] = useState<ResearchNote["note_type"]>("analysis");

  async function load() {
    const { data } = await supabase
      .from("research_notes")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setNotes((data || []) as ResearchNote[]);
  }

  useEffect(() => { load(); }, [projectId]);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !body.trim()) return;
    await supabase.from("research_notes").insert({
      project_id: projectId,
      title,
      body,
      note_type: noteType,
    });
    setTitle("");
    setBody("");
    await load();
  }

  return (
    <section className="tool-panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">WORKING NOTES</div>
          <h2>Research Analysis</h2>
        </div>
      </div>

      <form className="stack-form" onSubmit={add}>
        <select value={noteType} onChange={(e) => setNoteType(e.target.value as ResearchNote["note_type"])}>
          <option value="analysis">Analysis</option>
          <option value="methodology">Methodology</option>
          <option value="literature">Literature</option>
          <option value="question">Open question</option>
        </select>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add evidence, interpretation, concerns, or next steps..." />
        <button type="submit"><Plus size={16} /> Add note</button>
      </form>

      <div className="card-list">
        {notes.map((note) => (
          <article className="note-card" key={note.id}>
            <span className="tag">{note.note_type}</span>
            <h3>{note.title}</h3>
            <p>{note.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
