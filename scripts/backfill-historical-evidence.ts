import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) throw new Error("Missing Supabase secrets.");

const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

type Alias = { symbol: string; company_name: string | null; aliases: string[] | null };
type SourceType = "regulator" | "exchange" | "company" | "news" | "other";
type EvidenceItem = {
  source_name: string;
  source_type: SourceType;
  source_url: string;
  title: string;
  published_at: string;
  summary: string | null;
  symbol: string | null;
  company_name: string | null;
  authority_score: number;
  evidence_type: string;
  relevance_score: number;
  matched_terms: string[];
  is_relevant: boolean;
  validation_status: string;
  source_domain: string;
  language: string | null;
  metadata: Record<string, unknown>;
};

type OfficialSource = {
  key: string;
  name: string;
  type: SourceType;
  authority: number;
  urlForPage: (page: number) => string;
  maxPages: number;
};

const START_DATE = new Date(`${process.env.START_DATE || "2015-01-01"}T00:00:00Z`);
const END_DATE = new Date(`${process.env.END_DATE || new Date().toISOString().slice(0, 10)}T23:59:59Z`);
const SOURCE = process.env.EVIDENCE_SOURCE || "all";
const PAGE_DELAY_MS = Number(process.env.PAGE_DELAY_MS || 125);
const GDELT_DELAY_MS = Number(process.env.GDELT_DELAY_MS || 2500);
const GDELT_MAX_RETRIES = Number(process.env.GDELT_MAX_RETRIES || 4);

const officialSources: OfficialSource[] = [
  {
    key: "sebon-notices",
    name: "SEBON Notices",
    type: "regulator",
    authority: 98,
    urlForPage: (page) => `https://www.sebon.gov.np/notices?page=${page}`,
    maxPages: 80,
  },
  {
    key: "sebon-news",
    name: "SEBON News",
    type: "regulator",
    authority: 96,
    urlForPage: (page) => `https://www.sebon.gov.np/news?page=${page}`,
    maxPages: 80,
  },
  {
    key: "sebon-prospectus",
    name: "SEBON Prospectus",
    type: "regulator",
    authority: 98,
    urlForPage: (page) => `https://www.sebon.gov.np/prospectus?page=${page}`,
    maxPages: 100,
  },
  {
    key: "sebon-public-issues",
    name: "SEBON Public Issues",
    type: "regulator",
    authority: 98,
    urlForPage: (page) => `https://www.sebon.gov.np/index.php/public-issues-data?page=${page}`,
    maxPages: 100,
  },
  {
    key: "nrb-notices",
    name: "Nepal Rastra Bank Notices",
    type: "regulator",
    authority: 94,
    urlForPage: (page) => `https://www.nrb.org.np/category/notices/page/${page}/`,
    maxPages: 420,
  },
];

const relevantKeywords = [
  "dividend", "bonus share", "right share", "rights share", "merger", "acquisition",
  "book closure", "annual general meeting", "agm", "financial statement", "quarterly report",
  "rating", "credit rating", "listing", "suspension", "halt", "lock-in", "lock in",
  "promoter share", "public issue", "ipo", "fpo", "debenture", "auction", "resignation",
  "appointment", "chief executive", "ceo", "company secretary", "share allotment",
  "enforcement", "fine", "penalty", "license suspended", "licence suspended", "prospectus",
  "issue manager", "capital adequacy", "non-performing loan", "npl", "regulatory action",
  "प्रारम्भिक सार्वजनिक", "हकप्रद", "लाभांश", "बोनस शेयर", "मर्जर", "एक्विजिसन",
  "कारोबार रोक्का", "सूचीकृत", "साधारण सभा", "कारबाही", "निलम्बन", "इजाजतपत्र"
];

const rejectPatterns = [
  /board of directors?/i, /management team/i, /citizen charter/i, /नागरिक वडापत्र/i,
  /contact us/i, /about us/i, /career/i, /procurement/i, /tender/i, /quotation/i,
  /staff/i, /employee/i, /photo gallery/i, /holiday/i, /office furniture/i,
  /air conditioner/i, /construction work/i, /standing list/i
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (value: string) => value
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&quot;|&#34;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/\s+/g, " ")
  .trim();
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function loadAliases(): Promise<Alias[]> {
  const rows: Alias[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("company_aliases")
      .select("symbol,company_name,aliases")
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...((data || []) as Alias[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

function identifyCompany(text: string, rows: Alias[]) {
  const normalized = text.toLowerCase();
  for (const row of rows) {
    const names = [row.symbol, row.company_name, ...(row.aliases || [])]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase().trim())
      .filter((value) => value.length >= 3)
      .sort((a, b) => b.length - a.length);
    for (const name of names) {
      const regex = new RegExp(`(^|[^a-z0-9])${escapeRegex(name)}([^a-z0-9]|$)`, "i");
      if (regex.test(normalized)) {
        return { symbol: row.symbol, company_name: row.company_name, matched: name };
      }
    }
  }
  return { symbol: null, company_name: null, matched: null };
}

function keywordMatches(text: string) {
  const normalized = text.toLowerCase();
  return relevantKeywords.filter((keyword) => normalized.includes(keyword.toLowerCase()));
}

function evidenceType(text: string) {
  const value = text.toLowerCase();
  if (/dividend|bonus share|लाभांश|बोनस/.test(value)) return "distribution";
  if (/right share|rights share|हकप्रद/.test(value)) return "rights_issue";
  if (/merger|acquisition|मर्जर|एक्विजिसन/.test(value)) return "corporate_action";
  if (/financial statement|quarterly report|rating|credit rating|capital adequacy|npl/.test(value)) return "financial_report";
  if (/listing|suspension|halt|कारोबार रोक्का|सूचीकृत|निलम्बन/.test(value)) return "trading_status";
  if (/ipo|fpo|public issue|prospectus|प्रारम्भिक सार्वजनिक/.test(value)) return "public_issue";
  if (/appointment|resignation|ceo|company secretary/.test(value)) return "management_change";
  if (/enforcement|fine|penalty|license suspended|licence suspended|कारबाही|इजाजतपत्र/.test(value)) return "regulatory_action";
  return "other_market_event";
}

function parseDate(context: string): string | null {
  const iso = context.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) {
    const date = new Date(`${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}T00:00:00Z`);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  const english = context.match(/(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+20\d{2}/i);
  if (english) {
    const date = new Date(english[0]);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

function inRequestedRange(isoDate: string) {
  const date = new Date(isoDate);
  return date >= START_DATE && date <= END_DATE;
}

function makeItem(
  title: string,
  href: string,
  context: string,
  source: { name: string; type: SourceType; authority: number },
  aliases: Alias[],
): EvidenceItem | null {
  if (title.length < 6 || rejectPatterns.some((pattern) => pattern.test(title))) return null;
  const combined = `${source.name} ${title} ${context}`;
  const published = parseDate(combined);
  if (!published || !inRequestedRange(published)) return null;

  const company = identifyCompany(combined, aliases);
  const terms = keywordMatches(combined);
  if (!company.symbol && terms.length === 0) return null;

  const relevance = Math.min(
    100,
    (company.symbol ? 55 : 0) + Math.min(30, terms.length * 8) + (source.type === "regulator" ? 12 : 0),
  );
  if (relevance < 45) return null;

  return {
    source_name: source.name,
    source_type: source.type,
    source_url: href,
    title,
    published_at: published,
    summary: clean(context).slice(0, 700) || null,
    symbol: company.symbol,
    company_name: company.company_name,
    authority_score: source.authority,
    evidence_type: evidenceType(combined),
    relevance_score: relevance,
    matched_terms: [...(company.matched ? [company.matched] : []), ...terms].slice(0, 15),
    is_relevant: true,
    validation_status: source.type === "regulator" || source.type === "exchange" ? "official" : "automatic",
    source_domain: new URL(href).hostname,
    language: /[\u0900-\u097F]/.test(title) ? "ne" : "en",
    metadata: {
      matched_company_term: company.matched,
      backfill_start_date: START_DATE.toISOString().slice(0, 10),
      source_category: source.name,
    },
  };
}

function parseTableRows(html: string, baseUrl: string, source: OfficialSource, aliases: Alias[]) {
  const items: EvidenceItem[] = [];
  const dates: Date[] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(html))) {
    const row = rowMatch[1];
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => clean(cell[1]));
    if (cells.length < 2) continue;
    const title = cells[0];
    const dateText = cells[1];
    const published = parseDate(dateText);
    if (published) dates.push(new Date(published));

    const linkMatch = row.match(/<a[^>]+href=["']([^"']+)["'][^>]*>/i);
    const href = linkMatch ? new URL(linkMatch[1], baseUrl).toString() : baseUrl;
    const context = [title, dateText, ...cells.slice(2), clean(row)].join(" ");
    const item = makeItem(title, href, context, source, aliases);
    if (item) items.push(item);
  }

  return { items, dates };
}

function parseNrbArticles(html: string, baseUrl: string, source: OfficialSource, aliases: Alias[]) {
  const items: EvidenceItem[] = [];
  const dates: Date[] = [];
  const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/gi;
  let match: RegExpExecArray | null;
  while ((match = articleRegex.exec(html))) {
    const article = match[1];
    const link = article.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const href = new URL(link[1], baseUrl).toString();
    const title = clean(link[2]);
    const context = clean(article);
    const published = parseDate(context);
    if (published) dates.push(new Date(published));
    const item = makeItem(title, href, context, source, aliases);
    if (item) items.push(item);
  }
  return { items, dates };
}

async function saveItems(items: EvidenceItem[], runId: string | null) {
  const unique = [...new Map(items.map((item) => [`${item.source_url}|${item.title}|${item.published_at}`, item])).values()];
  let evidenceSaved = 0;
  let disclosuresSaved = 0;

  for (let index = 0; index < unique.length; index += 150) {
    const now = new Date().toISOString();
    const chunk = unique.slice(index, index + 150).map((item) => ({
      ...item,
      content_hash: createHash("sha256").update(`${item.source_url}|${item.title}|${item.published_at}`).digest("hex"),
      fetched_at: now,
      metadata: { ...item.metadata, backfill_run_id: runId },
    }));

    const { error } = await sb.from("internet_evidence").upsert(chunk, { onConflict: "content_hash" });
    if (error) throw error;
    evidenceSaved += chunk.length;

    const disclosures = chunk
      .filter((item) => item.symbol && item.published_at)
      .map((item) => ({
        disclosure_key: item.content_hash,
        symbol: item.symbol,
        title: item.title,
        published_at: item.published_at,
        category: item.evidence_type,
        source_url: item.source_url,
        source_name: item.source_name,
        authority_score: item.authority_score,
        summary: item.summary,
        raw_data: {
          matched_terms: item.matched_terms,
          relevance_score: item.relevance_score,
          validation_status: item.validation_status,
        },
        fetched_at: now,
      }));

    if (disclosures.length) {
      const { error: disclosureError } = await sb
        .from("nepse_disclosures")
        .upsert(disclosures, { onConflict: "disclosure_key" });
      if (disclosureError) throw disclosureError;
      disclosuresSaved += disclosures.length;
    }
  }

  return { evidenceSaved, disclosuresSaved };
}

async function createRun(sourceKey: string) {
  const { data, error } = await sb
    .from("evidence_backfill_runs")
    .insert({
      source_key: sourceKey,
      start_date: START_DATE.toISOString().slice(0, 10),
      end_date: END_DATE.toISOString().slice(0, 10),
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    console.warn("Could not create evidence_backfill_runs record:", error.message);
    return null;
  }
  return data.id as string;
}

async function finishRun(runId: string | null, status: string, totals: Record<string, unknown>, errorMessage?: string) {
  if (!runId) return;
  await sb
    .from("evidence_backfill_runs")
    .update({
      status,
      completed_at: new Date().toISOString(),
      records_saved: Number(totals.records_saved || 0),
      disclosures_saved: Number(totals.disclosures_saved || 0),
      pages_scanned: Number(totals.pages_scanned || 0),
      details: totals,
      error_message: errorMessage || null,
    })
    .eq("id", runId);
}

async function crawlOfficialSource(source: OfficialSource, aliases: Alias[]) {
  const runId = await createRun(source.key);
  let pagesScanned = 0;
  let emptyPages = 0;
  let totalEvidence = 0;
  let totalDisclosures = 0;

  try {
    for (let page = 1; page <= source.maxPages; page += 1) {
      const pageUrl = source.urlForPage(page);
      console.log(`Fetching ${source.name} page ${page}`);
      const response = await fetch(pageUrl, {
        headers: {
          "user-agent": "Mozilla/5.0 NEPSE-Market-Integrity-Research/11.0",
          accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(35_000),
      });
      if (!response.ok) {
        console.warn(`${source.name} page ${page}: HTTP ${response.status}`);
        if (response.status === 404) break;
        continue;
      }

      const html = await response.text();
      const parsed = source.key === "nrb-notices"
        ? parseNrbArticles(html, pageUrl, source, aliases)
        : parseTableRows(html, pageUrl, source, aliases);
      pagesScanned += 1;

      console.log(`${source.name} page ${page}: ${parsed.items.length} usable records`);
      if (!parsed.dates.length) emptyPages += 1;
      else emptyPages = 0;

      const saved = await saveItems(parsed.items, runId);
      totalEvidence += saved.evidenceSaved;
      totalDisclosures += saved.disclosuresSaved;

      const newest = parsed.dates.length ? new Date(Math.max(...parsed.dates.map((date) => date.getTime()))) : null;
      const oldest = parsed.dates.length ? new Date(Math.min(...parsed.dates.map((date) => date.getTime()))) : null;
      if (newest && newest < START_DATE) {
        console.log(`${source.name}: reached records older than ${START_DATE.toISOString().slice(0, 10)}.`);
        break;
      }
      if (oldest && oldest < START_DATE && parsed.dates.every((date) => date < START_DATE)) break;
      if (emptyPages >= 3) {
        console.log(`${source.name}: stopping after three pages without dated rows.`);
        break;
      }
      await sleep(PAGE_DELAY_MS);
    }

    const totals = {
      records_saved: totalEvidence,
      disclosures_saved: totalDisclosures,
      pages_scanned: pagesScanned,
      source_key: source.key,
    };
    await finishRun(runId, "completed", totals);
    console.log(`${source.name}:`, totals);
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    await finishRun(runId, "failed", { records_saved: totalEvidence, disclosures_saved: totalDisclosures, pages_scanned: pagesScanned }, message);
    throw error;
  }
}

function monthChunks(start: Date, end: Date) {
  const chunks: Array<{ start: Date; end: Date }> = [];
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor <= end) {
    const next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    const chunkEnd = new Date(Math.min(next.getTime() - 1, end.getTime()));
    chunks.push({ start: new Date(Math.max(cursor.getTime(), start.getTime())), end: chunkEnd });
    cursor = next;
  }
  return chunks;
}

function gdeltDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "");
}


function gdeltTimestamp(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
    String(date.getUTCHours()).padStart(2, "0"),
    String(date.getUTCMinutes()).padStart(2, "0"),
    String(date.getUTCSeconds()).padStart(2, "0"),
  ].join("");
}

async function crawlGdelt(aliases: Alias[]) {
  const runId = await createRun("gdelt-news");
  let recordsSaved = 0;
  let disclosuresSaved = 0;
  let chunksScanned = 0;

  const now = new Date();

  const gdeltSupportedStart = new Date(
    now.getTime() - 89 * 24 * 60 * 60 * 1000
  );

  const gdeltStartDate =
    START_DATE < gdeltSupportedStart
      ? gdeltSupportedStart
      : START_DATE;

  const gdeltEndDate =
    END_DATE > now
      ? now
      : END_DATE;

  console.log(
    `GDELT recent-news coverage: ${gdeltStartDate.toISOString()} through ${gdeltEndDate.toISOString()}`
  );

  try {
    for (const chunk of monthChunks(gdeltStartDate, gdeltEndDate)) {
      const month = chunk.start.toISOString().slice(0, 7);

      const query = encodeURIComponent(
        '(NEPSE OR "Nepal Stock Exchange") ' +
        '(dividend OR bonus OR rights OR merger OR acquisition OR IPO OR FPO ' +
        'OR suspension OR "financial results" OR appointment OR resignation OR penalty)'
      );

      const endpoint =
        "https://api.gdeltproject.org/api/v2/doc/doc" +
        `?query=${query}` +
        "&mode=ArtList" +
        "&format=json" +
        "&maxrecords=250" +
        "&sort=HybridRel" +
        `&startdatetime=${gdeltTimestamp(chunk.start)}` +
        `&enddatetime=${gdeltTimestamp(chunk.end)}`;

      console.log(`Fetching GDELT ${month}`);

      let json: any = null;

      for (
        let attempt = 1;
        attempt <= GDELT_MAX_RETRIES;
        attempt++
      ) {
        try {
          const response = await fetch(endpoint, {
            headers: {
              "user-agent": "NEPSE-Market-Integrity-Research/1.0",
              accept: "application/json",
            },
            signal: AbortSignal.timeout(40_000),
          });

          if (response.status === 429) {
            const retryAfter = Number(
              response.headers.get("retry-after") || 0
            );

            const waitMs =
              retryAfter > 0
                ? retryAfter * 1000
                : GDELT_DELAY_MS * Math.pow(2, attempt);

            console.warn(
              `GDELT ${month}: HTTP 429. ` +
              `Retry ${attempt}/${GDELT_MAX_RETRIES} after ${waitMs}ms`
            );

            await sleep(waitMs);
            continue;
          }

          if (!response.ok) {
            console.warn(
              `GDELT ${month}: HTTP ${response.status}`
            );
            break;
          }

          const body = await response.text();

          if (!body.trim()) {
            console.warn(`GDELT ${month}: empty response`);
            break;
          }

          try {
            json = JSON.parse(body);
            break;
          } catch {
            console.warn(
              `GDELT ${month}: non-JSON response: ` +
              body.slice(0, 160).replace(/\s+/g, " ")
            );

            if (attempt < GDELT_MAX_RETRIES) {
              await sleep(
                GDELT_DELAY_MS * Math.pow(2, attempt)
              );
            }
          }
        } catch (requestError) {
          const message =
            requestError instanceof Error
              ? requestError.message
              : String(requestError);

          console.warn(
            `GDELT ${month}: request failed on attempt ` +
            `${attempt}/${GDELT_MAX_RETRIES}: ${message}`
          );

          if (attempt < GDELT_MAX_RETRIES) {
            await sleep(
              GDELT_DELAY_MS * Math.pow(2, attempt)
            );
          }
        }
      }

      chunksScanned += 1;

      if (!json) {
        console.warn(
          `Skipping GDELT ${month} after retries`
        );
        continue;
      }

      const items = (json.articles || [])
        .map((article: any): EvidenceItem | null => {
          const title = String(
            article.title || ""
          ).trim();

          const published = article.seendate
            ? new Date(article.seendate).toISOString()
            : null;

          if (
            !title ||
            !published ||
            !inRequestedRange(published) ||
            rejectPatterns.some((pattern) =>
              pattern.test(title)
            )
          ) {
            return null;
          }

          const company = identifyCompany(
            title,
            aliases
          );

          const terms = keywordMatches(title);

          if (!company.symbol || terms.length === 0) {
            return null;
          }

          const sourceUrl = String(
            article.url || ""
          );

          if (!sourceUrl) {
            return null;
          }

          let sourceDomain =
            article.domain || null;

          if (!sourceDomain) {
            try {
              sourceDomain =
                new URL(sourceUrl).hostname;
            } catch {
              sourceDomain =
                "GDELT News Discovery";
            }
          }

          return {
            source_name:
              article.domain ||
              "GDELT News Discovery",
            source_type: "news",
            source_url: sourceUrl,
            title,
            published_at: published,
            summary: null,
            symbol: company.symbol,
            company_name:
              company.company_name,
            authority_score: 50,
            evidence_type:
              evidenceType(title),
            relevance_score: Math.min(
              82,
              52 + terms.length * 7
            ),
            matched_terms: [
              company.matched,
              ...terms,
            ]
              .filter(Boolean)
              .slice(0, 15) as string[],
            is_relevant: true,
            validation_status:
              "discovery_only",
            source_domain: sourceDomain,
            language:
              article.language || null,
            metadata: {
              gdelt: true,
              discovery_only: true,
              month,
            },
          };
        })
        .filter(Boolean) as EvidenceItem[];

      const saved = await saveItems(
        items,
        runId
      );

      recordsSaved += saved.evidenceSaved;
      disclosuresSaved +=
        saved.disclosuresSaved;

      console.log(
        `GDELT ${month}: saved ${saved.evidenceSaved} evidence records`
      );

      await sleep(GDELT_DELAY_MS);
    }

    await finishRun(runId, "completed", {
      records_saved: recordsSaved,
      disclosures_saved:
        disclosuresSaved,
      pages_scanned: chunksScanned,
      source_key: "gdelt-news",
    });

    console.log(
      "GDELT recent-news backfill complete",
      {
        recordsSaved,
        disclosuresSaved,
        chunksScanned,
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : JSON.stringify(error);

    await finishRun(
      runId,
      "failed",
      {
        records_saved: recordsSaved,
        disclosures_saved:
          disclosuresSaved,
        pages_scanned: chunksScanned,
        source_key: "gdelt-news",
      },
      message
    );

    throw error;
  }
}

const aliases = await loadAliases();
console.log(`Loaded ${aliases.length} company aliases.`);
console.log(`Historical evidence window: ${START_DATE.toISOString().slice(0, 10)} to ${END_DATE.toISOString().slice(0, 10)}`);

if (SOURCE === "gdelt-news") {
  await crawlGdelt(aliases);
} else {
  const sources = SOURCE === "all" ? officialSources : officialSources.filter((source) => source.key === SOURCE);
  if (!sources.length) throw new Error(`Unknown EVIDENCE_SOURCE: ${SOURCE}`);
  for (const source of sources) await crawlOfficialSource(source, aliases);
}
