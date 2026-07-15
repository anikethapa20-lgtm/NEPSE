import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { BarChart3, BookOpen, Database, FileText, FolderOpen, Images, LogOut, NotebookPen, Scale } from "lucide-react";
import { supabase } from "./lib/supabase";
import type { PaperSection } from "./types";
import Login from "./components/Login";
import SectionEditor from "./components/SectionEditor";
import NotesPanel from "./components/NotesPanel";
import DecisionsPanel from "./components/DecisionsPanel";
import Dashboard from "./components/Dashboard";
import FilesPanel from "./components/FilesPanel";
import FiguresGallery from "./components/FiguresGallery";
import DataCatalog from "./components/DataCatalog";

type Tab = "dashboard" | "paper" | "notes" | "decisions" | "files" | "figures" | "catalog";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState("");
  const [sections, setSections] = useState<PaperSection[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState<Tab>("dashboard");
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    loadWorkspace();
  }, [session]);

  async function loadWorkspace() {
    setError("");
    const { data: memberships, error: membershipError } = await supabase
      .from("project_members")
      .select("project_id, projects(id, title)")
      .limit(1);

    if (membershipError || !memberships?.length) {
      setError("Your account is not approved for this private workspace.");
      return;
    }

    const pid = memberships[0].project_id as string;
    setProjectId(pid);

    const { data, error: sectionsError } = await supabase
      .from("paper_sections")
      .select("*")
      .eq("project_id", pid)
      .order("sort_order");

    if (sectionsError) {
      setError(sectionsError.message);
      return;
    }

    const loaded = (data || []) as PaperSection[];
    setSections(loaded);
    setSelectedId(loaded[0]?.id || "");
  }

  const selected = useMemo(
    () => sections.find((section) => section.id === selectedId),
    [sections, selectedId]
  );

  function updateSaved(saved: PaperSection) {
    setSections((current) => current.map((item) => item.id === saved.id ? saved : item));
  }

  if (loading) return <div className="center">Loading...</div>;
  if (!session) return <Login />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><BookOpen size={24} /></div>
          <div>
            <strong>NEPSE Research</strong>
            <span>Private Workspace</span>
          </div>
        </div>

        <nav className="main-nav">
          <button className={tab === "dashboard" ? "active" : ""} onClick={() => setTab("dashboard")}>
            <BarChart3 size={18} /> Dashboard
          </button>
          <button className={tab === "paper" ? "active" : ""} onClick={() => setTab("paper")}>
            <FileText size={18} /> Full Paper
          </button>
          <button className={tab === "notes" ? "active" : ""} onClick={() => setTab("notes")}>
            <NotebookPen size={18} /> Analysis Notes
          </button>
          <button className={tab === "decisions" ? "active" : ""} onClick={() => setTab("decisions")}>
            <Scale size={18} /> Decision Log
          </button>
          <button className={tab === "figures" ? "active" : ""} onClick={() => setTab("figures")}>
            <Images size={18} /> Figures
          </button>
          <button className={tab === "catalog" ? "active" : ""} onClick={() => setTab("catalog")}>
            <Database size={18} /> Data Catalog
          </button>
          <button className={tab === "files" ? "active" : ""} onClick={() => setTab("files")}>
            <FolderOpen size={18} /> Research Files
          </button>
        </nav>

        {tab === "paper" && (
          <div className="section-nav">
            <div className="section-label">MANUSCRIPT</div>
            {sections.map((section) => (
              <button
                key={section.id}
                className={selectedId === section.id ? "selected" : ""}
                onClick={() => setSelectedId(section.id)}
              >
                <span>{section.title}</span>
                <small>{section.status.replace("_", " ")}</small>
              </button>
            ))}
          </div>
        )}

        <div className="sidebar-bottom">
          <span>{session.user.email}</span>
          <button onClick={() => supabase.auth.signOut()}><LogOut size={16} /> Sign out</button>
        </div>
      </aside>

      <main className="workspace">
        {error && <div className="error-banner">{error}</div>}
        {!error && tab === "dashboard" && projectId && <Dashboard projectId={projectId} sections={sections} />}
        {!error && tab === "paper" && selected && <SectionEditor section={selected} onSaved={updateSaved} />}
        {!error && tab === "notes" && projectId && <NotesPanel projectId={projectId} />}
        {!error && tab === "decisions" && projectId && <DecisionsPanel projectId={projectId} />}
        {!error && tab === "figures" && <FiguresGallery />}
        {!error && tab === "catalog" && projectId && <DataCatalog projectId={projectId} />}
        {!error && tab === "files" && projectId && <FilesPanel projectId={projectId} />}
      </main>
    </div>
  );
}
