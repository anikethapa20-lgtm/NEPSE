import { useState } from "react";
import EventExplorer from "./EventExplorer";
import InsiderAnalysis from "./InsiderAnalysis";
import PumpAnalysis from "./PumpAnalysis";

type View = "events" | "insider" | "pump";
export default function InvestigationsHub({ projectId }: { projectId: string }) {
  const [view, setView] = useState<View>("events");
  return <section>
    <div className="page-tabs" role="tablist" aria-label="Investigation views">
      <button className={view === "events" ? "active" : ""} onClick={() => setView("events")}>Event review</button>
      <button className={view === "insider" ? "active" : ""} onClick={() => setView("insider")}>Insider indicators</button>
      <button className={view === "pump" ? "active" : ""} onClick={() => setView("pump")}>Pump cycles</button>
    </div>
    {view === "events" && <EventExplorer projectId={projectId}/>} 
    {view === "insider" && <InsiderAnalysis projectId={projectId}/>} 
    {view === "pump" && <PumpAnalysis projectId={projectId}/>} 
  </section>;
}
