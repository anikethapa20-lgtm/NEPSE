import { createClient } from '@supabase/supabase-js';
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('Missing Supabase secrets.');
const sb=createClient(url,key,{auth:{persistSession:false}}),VERSION='v13.2';
const{data:projects,error}=await sb.from('projects').select('id').order('created_at',{ascending:false});if(error)throw error;
let failed=false;
for(const p of projects||[]){
 const[{count:marketRows},{count:totalEvents},{count:completed},{count:failedEvents},{count:missingXref},{count:invalidOhlc},{count:nullSymbols}]=await Promise.all([
  sb.from('research_market_data').select('*',{count:'exact',head:true}).eq('project_id',p.id),
  sb.from('research_events').select('*',{count:'exact',head:true}).eq('project_id',p.id),
  sb.from('research_events').select('*',{count:'exact',head:true}).eq('project_id',p.id).eq('processing_status','completed').not('terminal_outcome','is',null),
  sb.from('research_events').select('*',{count:'exact',head:true}).eq('project_id',p.id).eq('processing_status','failed'),
  sb.from('research_events').select('*',{count:'exact',head:true}).eq('project_id',p.id).eq('processing_status','completed').is('cross_referenced_at',null),
  sb.from('research_market_data').select('*',{count:'exact',head:true}).eq('project_id',p.id).or('high_price.lt.low_price,open_price.lt.0,high_price.lt.0,low_price.lt.0,close_price.lt.0,volume.lt.0'),
  sb.from('research_market_data').select('*',{count:'exact',head:true}).eq('project_id',p.id).or('symbol.is.null,symbol.eq.')
 ]);
 const status=(marketRows||0)>0&&(totalEvents||0)>0&&completed===totalEvents&&(failedEvents||0)===0&&(missingXref||0)===0?'passed':'failed';
 const details={completion_percent:totalEvents?Number((((completed||0)/totalEvents)*100).toFixed(2)):0,expected_market_rows:530674};
 const{error:insertError}=await sb.from('research_validation_runs').insert({project_id:p.id,validation_version:VERSION,status,market_rows:marketRows||0,invalid_ohlc_rows:invalidOhlc||0,null_symbol_rows:nullSymbols||0,total_events:totalEvents||0,completed_events:completed||0,failed_events:failedEvents||0,missing_cross_references:missingXref||0,details});if(insertError)throw insertError;
 console.log(JSON.stringify({project_id:p.id,status,market_rows:marketRows,total_events:totalEvents,completed,failed_events:failedEvents,missing_cross_references:missingXref,invalid_ohlc:invalidOhlc},null,2));
 if(status!=='passed')failed=true;
}
if(failed)process.exitCode=1;
