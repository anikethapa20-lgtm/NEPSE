import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("Missing Supabase secrets.");
const supabase=createClient(url,key,{auth:{persistSession:false}});
const{data:project}=await supabase.from("projects").select("id").order("created_at",{ascending:false}).limit(1).single();if(!project)throw new Error("Project not found.");
const{data:fileRow}=await supabase.from("research_files").select("storage_path,file_name").eq("file_name","nepse_research_dataset NEW.csv").order("uploaded_at",{ascending:false}).limit(1).single();if(!fileRow)throw new Error("Upload 'nepse_research_dataset NEW.csv' in Research Files first.");
const{data:blob,error:downloadError}=await supabase.storage.from("research-files").download(fileRow.storage_path);if(downloadError||!blob)throw downloadError||new Error("Download failed.");
const records=parse(await blob.text(),{columns:true,skip_empty_lines:true,relax_column_count:true});
const n=(v:unknown)=>v===""||v==null?null:Number(String(v).replace(/,/g,""));let imported=0;
for(let i=0;i<records.length;i+=1000){const chunk=records.slice(i,i+1000).map((r:Record<string,string>)=>({project_id:project.id,symbol:r.Symbol,trade_date:r.Date,open_price:n(r.Open),high_price:n(r.High),low_price:n(r.Low),close_price:n(r.Close),volume:n(r.Vol),turnover:n(r.Turnover),transactions:n(r["Trans."]),previous_close:n(r["Prev. Close"]),stock_return:n(r.Return),market_return:n(r.Market_Return),abnormal_return:n(r.Abnormal_Return),source_name:"nepse_research_dataset NEW.csv"}));const{error}=await supabase.from("research_market_data").upsert(chunk,{onConflict:"project_id,symbol,trade_date,source_name"});if(error)throw error;imported+=chunk.length;console.log(`Imported ${imported}/${records.length}`)}
console.log(`Completed import of ${imported} market rows.`);
