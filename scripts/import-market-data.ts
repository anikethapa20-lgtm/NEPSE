import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

const { data: project, error: projectError } = await supabase
  .from("projects")
  .select("id")
  .order("created_at", { ascending: false })
  .limit(1)
  .single();

if (projectError || !project) {
  throw projectError || new Error("Project not found.");
}

const storageFiles = [
  "nepse_research_dataset_part_1.csv",
  "nepse_research_dataset_part_2.csv",
];

const canonicalSourceName = "nepse_research_dataset NEW.csv";

const toNumber = (value: unknown): number | null => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

let totalImported = 0;

for (const storagePath of storageFiles) {
  console.log(`Downloading ${storagePath}...`);

  const { data: blob, error: downloadError } = await supabase.storage
    .from("research-files")
    .download(storagePath);

  if (downloadError || !blob) {
    throw downloadError || new Error(`Could not download ${storagePath}.`);
  }

  console.log(`Parsing ${storagePath}...`);

  const records = parse(await blob.text(), {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as Record<string, string>[];

  let fileImported = 0;

  for (let i = 0; i < records.length; i += 1000) {
    const chunk = records.slice(i, i + 1000).map((row) => ({
      project_id: project.id,
      symbol: row.Symbol?.trim(),
      trade_date: row.Date?.trim(),
      open_price: toNumber(row.Open),
      high_price: toNumber(row.High),
      low_price: toNumber(row.Low),
      close_price: toNumber(row.Close),
      volume: toNumber(row.Vol),
      turnover: toNumber(row.Turnover),
      transactions: toNumber(row["Trans."]),
      previous_close: toNumber(row["Prev. Close"]),
      stock_return: toNumber(row.Return),
      market_return: toNumber(row.Market_Return),
      abnormal_return: toNumber(row.Abnormal_Return),
      source_name: canonicalSourceName,
    }));

    const validChunk = chunk.filter(
      (row) => row.symbol && row.trade_date
    );

    const { error: upsertError } = await supabase
      .from("research_market_data")
      .upsert(validChunk, {
        onConflict: "project_id,symbol,trade_date,source_name",
      });

    if (upsertError) {
      throw new Error(
        `Import failed in ${storagePath} near row ${i + 1}: ${upsertError.message}`
      );
    }

    fileImported += validChunk.length;
    totalImported += validChunk.length;

    console.log(
      `${storagePath}: imported ${fileImported}/${records.length}`
    );
  }

  console.log(`Completed ${storagePath}: ${fileImported} rows.`);
}

console.log(`Completed full import: ${totalImported} market rows.`);
