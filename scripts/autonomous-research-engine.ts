import { createClient } from '@supabase/supabase-js';
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('Missing Supabase secrets.');
const sb=createClient(url,key,{auth:{persistSession:false}});
async function all(table:string,select:string,projectId:string){const out:any[]=[];for(let from=0;;from+=1000){const{data,error}=await sb.from(table).select(select).eq('project_id',projectId).order('id').range(from,from+999);if(error)throw error;out.push(...(data||[]));if(!data||data.length<1000)break}return out}
const{data:projects,error:pe}=await sb.from('projects').select('id').order('created_at',{ascending:false});if(pe)throw pe;
for(const project of projects||[]){const projectId=project.id;const events=await all('research_events','id,cross_referenced_at,explanation_status,auto_classification,classification',projectId);const pending=events.filter(e=>!e.cross_referenced_at);const queued=await sb.from('analysis_jobs').select('id').eq('project_id',projectId).eq('status','queued').limit(1);
 if(pending.length&&!queued.data?.length){const{error}=await sb.from('analysis_jobs').insert({project_id:projectId,job_type:'cross_reference',status:'queued',parameters:{autonomous:true,terminal_outcomes:true}});if(error)throw error;console.log(`Queued cross-reference for ${pending.length} pending events.`)}
 for(let i=0;i<events.length;i+=500){const updates=events.slice(i,i+500).filter(e=>e.cross_referenced_at).map(e=>({id:e.id,processing_status:'completed',processed_at:e.cross_referenced_at,terminal_outcome:e.explanation_status==='explained'?'explained':e.explanation_status||'unexplained'}));for(const u of updates){const{id,...patch}=u;const{error}=await sb.from('research_events').update(patch).eq('id',id);if(error)throw error}}
 const completed=events.filter(e=>e.cross_referenced_at).length;console.log(`${projectId}: ${completed}/${events.length} processed (${events.length?Math.round(completed/events.length*100):0}%).`)
}
