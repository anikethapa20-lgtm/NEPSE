import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
const sb=createClient(url,key,{auth:{persistSession:false}});
const{data:project,error:pe}=await sb.from("projects").select("id").order("created_at",{ascending:false}).limit(1).single();
if(pe||!project)throw pe||new Error("Project not found.");
const files=["nepse_research_dataset_part_1.csv","nepse_research_dataset_part_2.csv"];
const num=(v:unknown)=>{if(v===""||v==null)return null;const x=Number(String(v).replace(/,/g,"").trim());return Number.isFinite(x)?x:null};
let total=0;
for(const path of files){
 const{data:blob,error}=await sb.storage.from("research-files").download(path);if(error||!blob)throw error||new Error(`Download failed: ${path}`);
 const rows=parse(await blob.text(),{columns:true,skip_empty_lines:true,relax_column_count:true,trim:true}) as Record<string,string>[];
 for(let i=0;i<rows.length;i+=1000){const chunk=rows.slice(i,i+1000).map(r=>({project_id:project.id,symbol:r.Symbol?.trim(),trade_date:r.Date?.trim(),open_price:num(r.Open),high_price:num(r.High),low_price:num(r.Low),close_price:num(r.Close),volume:num(r.Vol),turnover:num(r.Turnover),transactions:num(r["Trans."]),previous_close:num(r["Prev. Close"]),stock_return:num(r.Return),market_return:num(r.Market_Return),abnormal_return:num(r.Abnormal_Return),source_name:"nepse_research_dataset NEW.csv"})).filter(r=>r.symbol&&r.trade_date);const{error:e}=await sb.from("research_market_data").upsert(chunk,{onConflict:"project_id,symbol,trade_date,source_name"});if(e)throw e;total+=chunk.length;console.log(`${path}: ${Math.min(i+1000,rows.length)}/${rows.length}`)}
}
console.log(`Completed full import: ${total} rows.`);
