import { createClient } from '@supabase/supabase-js';import { parse } from 'csv-parse/sync';
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('Missing Supabase secrets.');const sb=createClient(url,key,{auth:{persistSession:false}});
const n=(v:any)=>v===''||v==null?null:Number(String(v).replace(/,/g,''));
async function getRows(){
  const files=[
    'nepse_research_dataset_part_1.csv',
    'nepse_research_dataset_part_2.csv'
  ];
  const allRows:any[]=[];

  for(const storagePath of files){
    console.log(`Downloading ${storagePath}...`);

    const{data:blob,error}=await sb.storage
      .from('research-files')
      .download(storagePath);

    if(error||!blob){
      throw error||new Error(`Could not download ${storagePath}.`);
    }

    console.log(`Parsing ${storagePath}...`);

    const rows=parse(await blob.text(),{
      columns:true,
      skip_empty_lines:true,
      relax_column_count:true,
      trim:true
    });

    allRows.push(...rows);
    console.log(`Loaded ${rows.length} rows from ${storagePath}.`);
  }

  console.log(`Loaded ${allRows.length} total market rows.`);
  return allRows;
}
function mean(a:number[]){return a.reduce((s,x)=>s+x,0)/a.length}function std(a:number[]){if(a.length<2)return 0;const m=mean(a);return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1))}
async function detection(job:any,rows:any[]){const p=job.parameters||{},rw=+p.volatility_window||30,vw=+p.volume_window||30,sig=+p.return_threshold_sigma||3,vm=+p.volume_multiple||5,min=+p.minimum_history||30,spacing=+p.event_spacing_days||0;const groups=new Map<string,any[]>();for(const r of rows){if(!groups.has(r.Symbol))groups.set(r.Symbol,[]);groups.get(r.Symbol)!.push(r)}const out:any[]=[];for(const[symbol,g]of groups){g.sort((a,b)=>String(a.Date).localeCompare(String(b.Date)));let last=-9999;for(let i=Math.max(rw,vw,min);i<g.length;i++){const ar=n(g[i].Abnormal_Return),vol=n(g[i].Vol);if(ar==null||vol==null)continue;const histR=g.slice(i-rw,i).map(x=>n(x.Abnormal_Return)).filter((x):x is number=>x!=null),histV=g.slice(i-vw,i).map(x=>n(x.Vol)).filter((x):x is number=>x!=null);if(histR.length<rw||histV.length<vw)continue;const s=std(histR),mv=mean(histV),mult=mv?vol/mv:0,rs=s?Math.abs(ar)/s:0;if(Math.abs(ar)>sig*s&&vol>vm*mv&&i-last>spacing){last=i;out.push({project_id:job.project_id,symbol,event_date:g[i].Date,open_price:n(g[i].Open),high_price:n(g[i].High),low_price:n(g[i].Low),close_price:n(g[i].Close),volume:vol,turnover:n(g[i].Turnover),transactions:n(g[i]['Trans.']),previous_close:n(g[i]['Prev. Close']),stock_return:n(g[i].Return),market_return:n(g[i].Market_Return),abnormal_return:ar,rolling_volume_mean:mv,rolling_return_std:s,volume_multiple:mult,return_sigma:rs,severity_score:Math.min(100,mult*2.5+rs*5),event_year:new Date(g[i].Date).getFullYear(),classification:'Unreviewed',review_status:'pending'})}}}const{data:run,error:re}=await sb.from('analysis_runs').insert({project_id:job.project_id,run_name:`Detection ${new Date().toISOString()}`,run_type:'abnormal_event_detection',parameters:p,status:'completed',records_processed:rows.length,events_detected:out.length}).select('id').single();if(re)throw re;for(let i=0;i<out.length;i+=1000){const{error}=await sb.from('research_events').upsert(out.slice(i,i+1000),{onConflict:'project_id,symbol,event_date'});if(error)throw error}return{events:out.length,run_id:run.id}}
async function pump(job:any,rows:any[]){const p=job.parameters||{},runUp=(+p.minimum_run_up_percent||15)/100,rev=(+p.maximum_reversal_percent||-10)/100,fw=+p.forward_window_days||10,minVol=+p.minimum_volume_multiple||5;const groups=new Map<string,any[]>();for(const r of rows){if(!groups.has(r.Symbol))groups.set(r.Symbol,[]);groups.get(r.Symbol)!.push(r)}const cycles:any[]=[];for(const[symbol,g]of groups){g.sort((a,b)=>String(a.Date).localeCompare(String(b.Date)));for(let i=30;i<g.length-fw;i++){const start=n(g[i-5]?.Close),peak=n(g[i].Close),vol=n(g[i].Vol),hist=g.slice(i-30,i).map(x=>n(x.Vol)).filter((x):x is number=>x!=null);if(start==null||peak==null||vol==null||hist.length<30)continue;const up=peak/start-1,mv=vol/mean(hist);if(up<runUp||mv<minVol)continue;let minPrice=peak,end=i;for(let j=i+1;j<=i+fw&&j<g.length;j++){const c=n(g[j].Close);if(c!=null&&c<minPrice){minPrice=c;end=j}}const reversal=minPrice/peak-1;if(reversal<=rev)cycles.push({project_id:job.project_id,symbol,start_date:g[i-5].Date,peak_date:g[i].Date,end_date:g[end].Date,start_price:start,peak_price:peak,end_price:minPrice,run_up_return:up,reversal_return:reversal,peak_volume_multiple:mv,cycle_days:end-(i-5),pump_score:Math.min(100,up*200+Math.abs(reversal)*200+Math.min(mv,15)*2),status:'candidate'})}}const{data:run,error:re}=await sb.from('analysis_runs').insert({project_id:job.project_id,run_name:`Pump cycles ${new Date().toISOString()}`,run_type:'pump_detection',parameters:p,status:'completed',records_processed:rows.length,events_detected:cycles.length}).select('id').single();if(re)throw re;for(const c of cycles)c.analysis_run_id=run.id;for(let i=0;i<cycles.length;i+=500){const{error}=await sb.from('pump_cycles').upsert(cycles.slice(i,i+500),{onConflict:'project_id,symbol,start_date,peak_date,end_date'});if(error)throw error}return{cycles:cycles.length,run_id:run.id}}
const{data:jobs,error}=await sb.from('analysis_jobs').select('*').eq('status','queued').order('created_at').limit(3);if(error)throw error;if(!jobs?.length){console.log('No queued jobs.');process.exit(0)}const rows=await getRows();for(const job of jobs){try{await sb.from('analysis_jobs').update({status:'running',started_at:new Date().toISOString()}).eq('id',job.id);const result=job.job_type==='event_detection'?await detection(job,rows):await pump(job,rows);await sb.from('analysis_jobs').update({status:'completed',result_summary:result,completed_at:new Date().toISOString()}).eq('id',job.id);console.log(job.job_type,result)}catch(e){const msg=e instanceof Error?e.message:String(e);await sb.from('analysis_jobs').update({status:'failed',error_message:msg,completed_at:new Date().toISOString()}).eq('id',job.id);console.error(msg)}}
