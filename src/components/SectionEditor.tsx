import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { PaperSection } from "../types";

type Props = {
  section: PaperSection;
  onSaved: (section: PaperSection) => void;
};

export default function SectionEditor({ section, onSaved }: Props) {
  const [content, setContent] = useState(section.content || "");
  const [status, setStatus] = useState(section.status);
  const [saving, setSaving] = useState(false);
  const [savedText, setSavedText] = useState("");

  useEffect(() => {
    setContent(section.content || "");
    setStatus(section.status);
    setSavedText("");
  }, [section]);

  async function save() {
    setSaving(true);
    setSavedText("");

    const { data, error } = await supabase
      .from("paper_sections")
      .update({ content, status, updated_at: new Date().toISOString() })
      .eq("id", section.id)
      .select()
      .single();

    setSaving(false);

    if (error) {
      setSavedText(error.message);
      return;
    }

    setSavedText("Saved");
    onSaved(data as PaperSection);
  }

  return (
    <section className="editor-panel">
      <div className="editor-header">
        <div>
          <div className="eyebrow">PAPER SECTION</div>
          <h2>{section.title}</h2>
        </div>
        <div className="editor-actions">
          <select value={status} onChange={(e) => setStatus(e.target.value as PaperSection["status"])}>
            <option value="not_started">Not started</option>
            <option value="drafting">Drafting</option>
            <option value="review">Ready for review</option>
            <option value="complete">Complete</option>
          </select>
          <button onClick={save} disabled={saving}>
            <Save size={17} />
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <textarea
        className="paper-editor"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Write this section in full detail here..."
      />

      <div className="editor-footer">
        <span>{content.trim() ? content.trim().split(/\s+/).length : 0} words</span>
        <span>{savedText}</span>
      </div>
    </section>
  );
}
