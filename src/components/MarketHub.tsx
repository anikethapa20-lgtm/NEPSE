import { useState } from "react";
import MarketDatabase from "./MarketDatabase";
import StockProfiles from "./StockProfiles";
type View="market"|"profile";
export default function MarketHub({projectId}:{projectId:string}){const[view,setView]=useState<View>("market");return <section><div className="page-tabs"><button className={view==="market"?"active":""} onClick={()=>setView("market")}>Market data</button><button className={view==="profile"?"active":""} onClick={()=>setView("profile")}>Company profile</button></div>{view==="market"?<MarketDatabase projectId={projectId}/>:<StockProfiles projectId={projectId}/>}</section>}
