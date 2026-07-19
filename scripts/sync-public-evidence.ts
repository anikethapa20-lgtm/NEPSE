import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error("Missing Supabase secrets.");
const sb=createClient(url,key,{auth:{persistSession:false}});

type Alias={symbol:string;company_name:string|null;aliases:string[]};
type Item={source_name:string;source_type:"regulator"|"exchange"|"company"|"news"|"other";source_url:string;title:string;published_at:string;summary:string|null;symbol:string|null;company_name:string|null;authority_score:number;evidence_type:string;relevance_score:number;matched_terms:string[];is_relevant:boolean;validation_status:string;source_domain:string;language:string|null;metadata:Record<string,unknown>};

const officialSources=[
 {name:"SEBON Notices",type:"regulator" as const,url:"https://sebon.gov.np/notices",score:98},
 {name:"SEBON News",type:"regulator" as const,url:"https://sebon.gov.np/news",score:95},
 {name:"SEBON Prospectus",type:"regulator" as const,url:"https://sebon.gov.np/prospectus",score:98},
 {name:"SEBON Public Issues",type:"regulator" as const,url:"https://sebon.gov.np/index.php/public-issues-data",score:98}
];

const relevantKeywords=["dividend","bonus share","right share","rights share","merger","acquisition","book closure","annual general meeting","agm","financial statement","quarterly report","rating","credit rating","listing","suspension","halt","lock-in","lock in","promoter share","public issue","ipo","fpo","debenture","auction","resignation","appointment","chief executive","ceo","company secretary","investment","share allotment","enforcement","fine","penalty","license suspended","licence suspended","prospectus","issue manager","प्रारम्भिक सार्वजनिक","हकप्रद","लाभांश","बोनस शेयर","मर्जर","एक्विजिसन","कारोबार रोक्का","सूचीकृत","साधारण सभा"];
const rejectPatterns=[/board of directors?/i,/management team/i,/citizen charter/i,/नागरिक वडापत्र/i,/contact us/i,/about us/i,/career/i,/procurement/i,/tender/i,/speech competition/i,/staff/i,/employee/i,/photo gallery/i,/securities registered$/i];
const clean=(s:string)=>s.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/\s+/g," ").trim();
const esc=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");

async function loadAliases():Promise<Alias[]>{const{data,error}=await sb.from("company_aliases").select("symbol,company_name,aliases");if(error)throw error;return (data||[]) as Alias[]}
function identify(text:string,rows:Alias[]){const normalized=text.toLowerCase();for(const r of rows){const names=[r.symbol,r.company_name,...(r.aliases||[])].filter(Boolean).map(x=>String(x).toLowerCase().trim());for(const name of names){if(name.length<3)continue;if(new RegExp(`(^|[^a-z0-9])${esc(name)}([^a-z0-9]|$)`,`i`).test(normalized))return{symbol:r.symbol,company_name:r.company_name,matched:name}}}return{symbol:null,company_name:null,matched:null}}
function keywordMatches(text:string){const t=text.toLowerCase();return relevantKeywords.filter(k=>t.includes(k.toLowerCase()))}
function evidenceType(text:string){const t=text.toLowerCase();if(/dividend|bonus share|लाभांश|बोनस/.test(t))return"distribution";if(/right share|rights share|हकप्रद/.test(t))return"rights_issue";if(/merger|acquisition|मर्जर|एक्विजिसन/.test(t))return"corporate_action";if(/financial statement|quarterly report|rating|credit rating/.test(t))return"financial_report";if(/listing|suspension|halt|कारोबार रोक्का|सूचीकृत/.test(t))return"trading_status";if(/ipo|fpo|public issue|prospectus|प्रारम्भिक सार्वजनिक/.test(t))return"public_issue";if(/appointment|resignation|ceo|company secretary/.test(t))return"management_change";if(/enforcement|fine|penalty|license suspended|licence suspended/.test(t))return"regulatory_action";return"other_market_event"}
function parseDate(context:string){const iso=context.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);if(iso){const d=new Date(`${iso[1]}-${iso[2].padStart(2,"0")}-${iso[3].padStart(2,"0")}T00:00:00Z`);if(!Number.isNaN(d.getTime()))return d.toISOString()}const en=context.match(/(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+20\d{2}/i);if(en){const d=new Date(en[0]);if(!Number.isNaN(d.getTime()))return d.toISOString()}return null}
function makeItem(title:string,href:string,context:string,meta:any,aliases:Alias[]):Item|null{
  if(title.length<6||rejectPatterns.some(x=>x.test(title)))return null;

  const combined=`${meta.name} ${title} ${context}`;
  const published=parseDate(combined);

  if(!published)return null;

  const id=identify(combined,aliases);
  const terms=keywordMatches(combined);

  if(!id.symbol&&terms.length===0)return null;

  const relevance=Math.min(
    100,
    (id.symbol?55:0)+
    Math.min(35,terms.length*10)+
    (meta.type==="regulator"?10:0)
  );

  if(relevance<45)return null;

  return{
    source_name:meta.name,
    source_type:meta.type,
    source_url:href,
    title,
    published_at:published,
    summary:clean(context).slice(0,500)||null,
    symbol:id.symbol,
    company_name:id.company_name,
    authority_score:meta.score,
    evidence_type:evidenceType(combined),
    relevance_score:relevance,
    matched_terms:[
      ...(id.matched?[id.matched]:[]),
      ...terms
    ].slice(0,12),
    is_relevant:true,
    validation_status:meta.type==="regulator"
      ?"official"
      :"automatic",
    source_domain:new URL(href).hostname,
    language:/[\u0900-\u097F]/.test(title)?"ne":"en",
    metadata:{
      matched_company_term:id.matched,
      source_category:meta.name
    }
  };
}
function parseOfficialPage(
  html:string,
  base:string,
  meta:any,
  aliases:Alias[]
){
  const out:Item[]=[];
  const rowRx=/<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;

  while((match=rowRx.exec(html))){
    const row=match[1];

    const cells=[
      ...row.matchAll(
        /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
      )
    ].map(cell=>clean(cell[1]));

    if(cells.length<2)continue;

    const title=cells[0];
    const dateText=cells[1];

    if(!title||!dateText)continue;

    const link=row.match(
      /<a[^>]+href=["']([^"']+)["'][^>]*>/i
    );

    const href=link
      ?new URL(link[1],base).toString()
      :base;

    const context=[
      title,
      dateText,
      ...cells.slice(2),
      clean(row)
    ].join(" ");

    const item=makeItem(
      title,
      href,
      context,
      meta,
      aliases
    );

    if(item)out.push(item);
  }

  return [
    ...new Map(
      out.map(item=>[
        `${item.source_url}|${item.title}|${item.published_at}`,
        item
      ])
    ).values()
  ].slice(0,500);
}

async function gdelt(aliases:Alias[]){const q=encodeURIComponent('("Nepal Stock Exchange" OR NEPSE) (dividend OR merger OR rights OR IPO OR suspension OR financial results OR appointment OR resignation)');const endpoint=`https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=ArtList&format=json&maxrecords=150&sort=HybridRel`;try{const r=await fetch(endpoint,{signal:AbortSignal.timeout(30000)});if(!r.ok)return[];const j:any=await r.json();return (j.articles||[]).map((a:any)=>{const title=String(a.title||"").trim(),published=a.seendate?new Date(a.seendate).toISOString():null,id=identify(title,aliases),terms=keywordMatches(title);if(!published||!id.symbol||terms.length===0||rejectPatterns.some(x=>x.test(title)))return null;return{source_name:a.domain||"GDELT News",source_type:"news" as const,source_url:a.url,title,published_at:published,summary:null,symbol:id.symbol,company_name:id.company_name,authority_score:55,evidence_type:evidenceType(title),relevance_score:Math.min(85,55+terms.length*8),matched_terms:[id.matched,...terms].filter(Boolean).slice(0,12),is_relevant:true,validation_status:"automatic",source_domain:a.domain||new URL(a.url).hostname,language:a.language||null,metadata:{gdelt:true}} as Item}).filter(Boolean) as Item[]}catch(e){console.warn("GDELT",e);return[]}}

const aliases=await loadAliases();let items:Item[]=[];
for(const source of officialSources){
  for(let page=1;page<=10;page++){
    const pageUrl=page===1
      ?source.url
      :`${source.url}?page=${page}`;

    console.log(`Fetching ${source.name} page ${page}`);

    try{
      const r=await fetch(pageUrl,{
        headers:{
          "user-agent":"Mozilla/5.0 NEPSE-Research-Evidence-Bot/3.0",
          "accept":"text/html,application/xhtml+xml"
        },
        signal:AbortSignal.timeout(30000)
      });

      if(!r.ok){
        console.warn(source.name,page,r.status);
        continue;
      }

      const parsed=parseOfficialPage(
        await r.text(),
        pageUrl,
        source,
        aliases
      );

      console.log(
        `${source.name} page ${page}: ${parsed.length} usable records`
      );

      items.push(...parsed);
    }catch(e){
      console.warn(source.name,page,e);
    }
  }
}
items.push(...await gdelt(aliases));items=[...new Map(items.map(x=>[x.source_url,x])).values()];
let saved=0,disclosures=0;for(let i=0;i<items.length;i+=150){const now=new Date().toISOString(),chunk=items.slice(i,i+150).map(x=>({...x,content_hash:createHash("sha256").update(`${x.source_url}|${x.title}`).digest("hex"),fetched_at:now}));const{error}=await sb.from("internet_evidence").upsert(chunk,{onConflict:"content_hash"});if(error)throw error;saved+=chunk.length;const disclosureRows=chunk.filter(x=>x.symbol&&x.published_at&&x.is_relevant).map(x=>({disclosure_key:x.content_hash,symbol:x.symbol,title:x.title,published_at:x.published_at,category:x.evidence_type,source_url:x.source_url,source_name:x.source_name,authority_score:x.authority_score,summary:x.summary,raw_data:{matched_terms:x.matched_terms,relevance_score:x.relevance_score},fetched_at:now}));if(disclosureRows.length){const{error:de}=await sb.from("nepse_disclosures").upsert(disclosureRows,{onConflict:"disclosure_key"});if(de)throw de;disclosures+=disclosureRows.length}}
console.log(`Saved ${saved} relevant evidence items and ${disclosures} company disclosures.`);
