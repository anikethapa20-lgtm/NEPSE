import { useState } from "react";
import PublicEvidence from "./PublicEvidence";import Announcements from "./Announcements";
type View="public"|"announcements";
export default function EvidenceHub({projectId}:{projectId:string}){const[view,setView]=useState<View>("public");return <section><div className="page-tabs"><button className={view==="public"?"active":""} onClick={()=>setView("public")}>Verified evidence</button><button className={view==="announcements"?"active":""} onClick={()=>setView("announcements")}>Company disclosures</button></div>{view==="public"&&<PublicEvidence/>}{view==="announcements"&&<Announcements projectId={projectId}/>}</section>}
