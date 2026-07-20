import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Activity, BookOpenText, BrainCircuit, Database, FileSearch,
  GitCompareArrows, LogOut, Menu, Microscope, Settings2, ShieldCheck, X
} from "lucide-react";
import { supabase } from "./lib/supabase";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import CrossReferenceAnalysis from "./components/CrossReferenceAnalysis";
import InvestigationsHub from "./components/InvestigationsHub";
import MarketHub from "./components/MarketHub";
import EvidenceHub from "./components/EvidenceHub";
import ResearchHub from "./components/ResearchHub";
import SettingsHub from "./components/SettingsHub";

type Tab = "command" | "investigations" | "crossref" | "market" | "evidence" | "outputs" | "settings";

const NAV = [
  ["command", "Command", "Research overview", Activity],
  ["investigations", "Events", "Signals and cases", Microscope],
  ["crossref", "Matching", "Evidence cross-reference", GitCompareArrows],
  ["market", "Market", "Companies and prices", Database],
  ["evidence", "Evidence", "Disclosures and sources", FileSearch],
  ["outputs", "Outputs", "Paper and findings", BookOpenText],
  ["settings", "Control", "Quality and administration", Settings2],
] as const;

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState("");
  const [tab, setTab] = useState<Tab>("command");
  const [error, setError] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session) loadWorkspace(); else setProjectId(""); }, [session]);

  async function loadWorkspace() {
    setError("");
    const { data, error } = await supabase.from("project_members").select("project_id").limit(1);
    if (error || !data?.length) { setError("This account has not been approved for the NEPSE V14 research workspace."); return; }
    setProjectId(data[0].project_id);
  }

  if (loading) return <div className="v14-loading"><BrainCircuit size={30}/><span>Initializing research environment…</span></div>;
  if (!session) return <Login />;
  const active = NAV.find(([key]) => key === tab)!;

  return <div className="v14-shell terminal-shell">
    <header className="terminal-header">
      <div className="terminal-brand">
        <div className="terminal-logo"><Activity size={21}/></div>
        <div><strong>NEPSE <em>V14</em></strong><span>MARKET INTEGRITY LAB</span></div>
      </div>
      <div className="terminal-market-strip">
        <span><i/>PRIVATE RESEARCH</span>
        <span>DATASET <b>2015—2026</b></span>
        <span>MODE <b>FORENSIC</b></span>
      </div>
      <div className="terminal-account">
        <div><strong>{session.user.email?.split("@")[0]}</strong><span>Approved researcher</span></div>
        <button title="Sign out" onClick={() => supabase.auth.signOut()}><LogOut size={17}/></button>
      </div>
      <button className="terminal-menu" onClick={() => setMobileNav(true)}><Menu size={21}/></button>
    </header>

    <nav className={`terminal-nav ${mobileNav ? "open" : ""}`}>
      <div className="terminal-mobile-head"><strong>Research modules</strong><button onClick={() => setMobileNav(false)}><X size={19}/></button></div>
      {NAV.map(([key, label, description, Icon]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => { setTab(key as Tab); setMobileNav(false); }}>
        <Icon size={17}/><span><strong>{label}</strong><small>{description}</small></span>
      </button>)}
    </nav>

    <main className="terminal-main">
      <div className="terminal-page-head">
        <div><span>NEPSE V14 / {active[1]}</span><h1>{active[2]}</h1></div>
        <div className="terminal-access"><ShieldCheck size={16}/><span>Research-only environment</span></div>
      </div>
      <div className="v14-content terminal-content">
        {error && <div className="error-banner">{error}</div>}
        {!error && projectId && <>
          {tab === "command" && <Dashboard projectId={projectId}/>} 
          {tab === "investigations" && <InvestigationsHub projectId={projectId}/>} 
          {tab === "crossref" && <CrossReferenceAnalysis projectId={projectId}/>} 
          {tab === "market" && <MarketHub projectId={projectId}/>} 
          {tab === "evidence" && <EvidenceHub projectId={projectId}/>} 
          {tab === "outputs" && <ResearchHub projectId={projectId}/>} 
          {tab === "settings" && <SettingsHub projectId={projectId}/>} 
        </>}
      </div>
    </main>
    {mobileNav && <button className="terminal-overlay" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
  </div>;
}
