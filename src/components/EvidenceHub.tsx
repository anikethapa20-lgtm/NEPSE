import { useState } from "react";
import PublicEvidence from "./PublicEvidence";
import Announcements from "./Announcements";
import DataCatalog from "./DataCatalog";
type View="public"|"announcements"|"sources";
export default function EvidenceHub({projectId}:{projectId:string}){const[view,setView]=useState<View>("public");return <section><div className="page-tabs"><button className={view==="public"?"active":""} onClick={()=>setView("public")}>Public evidence</button><button className={view==="announcements"?"active":""} onClick={()=>setView("announcements")}>Company disclosures</button><button className={view==="sources"?"active":""} onClick={()=>setView("sources")}>Data sources</button></div>{view==="public"&&<PublicEvidence/>}{view==="announcements"&&<Announcements projectId={projectId}/>} {view==="sources"&&<DataCatalog projectId={projectId}/>}</section>}
