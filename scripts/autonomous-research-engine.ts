import { createClient } from '@supabase/supabase-js';
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
const sb=createClient(url,key,{auth:{persistSession:false}}),VERSION='v13.2';
async function page(table:string,select:string,projectId:string){const out:any[]=[];for(let from=0;;from+=1000){const{data,error}=await sb.from(table).select(select).eq('project_id',projectId).order('id').range(from,from+999);if(error)throw error;out.push(...(data||[]));if(!data||data.length<1000)break}return out}
async function queue(projectId:string,jobType:string,parameters:any){const{data:existing,error}=await sb.from('analysis_jobs').select('id,status').eq('project_id',projectId).eq('job_type',jobType).in('status',['queued','running']).limit(1);if(error)throw error;if(existing?.length)return false;const{error:insertError}=await sb.from('analysis_jobs').insert({project_id:projectId,job_type:jobType,status:'queued',parameters,worker_version:VERSION,records_processed:0});if(insertError)throw insertError;return true}
const{data:projects,error}=await sb.from('projects').select('id').order('created_at',{ascending:false});if(error)throw error;
for(const p of projects||[]){
 const events=await page('research_events','id,processing_status,cross_referenced_at,terminal_outcome,explanation_status',p.id);
 const pending=events.filter(e=>e.processing_status!=='completed'||!e.cross_referenced_at||!e.terminal_outcome);
 const failed=events.filter(e=>e.processing_status==='failed');
 const staleBefore=new Date(Date.now()-2*60*60*1000).toISOString();
 await sb.from('analysis_jobs').update({status:'failed',error_message:'Marked failed after two hours without completion.',completed_at:new Date().toISOString()}).eq('project_id',p.id).eq('status','running').lt('heartbeat_at',staleBefore);
 if(pending.length){const created=await queue(p.id,'cross_reference',{autonomous:true,processing_version:VERSION,reprocess_failed:failed.length>0,terminal_outcomes:true});if(created)console.log(`${p.id}: queued ${pending.length} events.`)}
 const complete=events.filter(e=>e.processing_status==='completed'&&e.cross_referenced_at&&e.terminal_outcome).length;
 console.log(`${p.id}: ${complete}/${events.length} terminally processed (${events.length?((complete/events.length)*100).toFixed(2):'0.00'}%).`);
}
