import { createClient } from "@supabase/supabase-js";
import {
  disclosure,
  get_market_status,
  getNepseIndex,
  getPriceVolume,
  getSecurityList,
  getSummary,
  shutdownWorkerPool,
} from "nepse-api-unofficial";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function nepalDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const cleaned = String(value).replace(/,/g, "").trim();
  const result = Number(cleaned);

  return Number.isFinite(result) ? result : null;
}

function stringValue(
  row: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = row[key];

    if (value !== null && value !== undefined && value !== "") {
      return String(value);
    }
  }

  return null;
}

function toRows(response: unknown): Record<string, unknown>[] {
  if (!response) {
    return [];
  }

  if (Array.isArray(response)) {
    return response.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item && typeof item === "object"),
    );
  }

  if (typeof response === "object") {
    return Object.values(response).filter(
      (item): item is Record<string, unknown> =>
        Boolean(item && typeof item === "object"),
    );
  }

  return [];
}

async function startSync(): Promise<string> {
  const { data, error } = await supabase
    .from("nepse_sync_runs")
    .insert({
      sync_type: "daily_nepse_sync",
      status: "running",
      records_saved: 0,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id;
}

async function finishSync(
  syncId: string,
  status: "success" | "failed",
  recordsSaved: number,
  errorMessage: string | null = null,
): Promise<void> {
  const { error } = await supabase
    .from("nepse_sync_runs")
    .update({
      status,
      records_saved: recordsSaved,
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq("id", syncId);

  if (error) {
    console.error("Could not update sync log:", error.message);
  }
}

async function syncMarketSummary(): Promise<number> {
  const [status, summary] = await Promise.all([
    get_market_status(),
    getSummary(),
  ]);

  if (!status && !summary) {
    console.log("No market summary returned.");
    return 0;
  }

  const statusObject =
    status && typeof status === "object"
      ? (status as Record<string, unknown>)
      : {};

  const summaryObject =
    summary && typeof summary === "object"
      ? (summary as Record<string, unknown>)
      : {};

  const marketOpen = Boolean(
    statusObject.isOpen ??
      statusObject.is_open ??
      statusObject.marketOpen ??
      false,
  );

  const turnover = numberValue(
    summaryObject["Total Turnover Rs:"] ??
      summaryObject.totalTurnover ??
      summaryObject.total_turnover,
  );

  const { error } = await supabase
    .from("nepse_market_snapshots")
    .upsert(
      {
        snapshot_date: nepalDate(),
        market_open: marketOpen,
        total_turnover: turnover,
        summary,
        raw_status: status,
        fetched_at: new Date().toISOString(),
      },
      {
        onConflict: "snapshot_date",
      },
    );

  if (error) {
    throw error;
  }

  console.log("Market summary saved.");
  return 1;
}

async function syncSecurities(): Promise<number> {
  const response = await getSecurityList();
  const rows = toRows(response);

  if (!rows.length) {
    console.log("No securities returned.");
    return 0;
  }

  const securities = rows
    .map((row) => {
      const symbol = stringValue(row, [
        "symbol",
        "securitySymbol",
        "ticker",
      ]);

      if (!symbol) {
        return null;
      }

      return {
        symbol,
        security_name: stringValue(row, [
          "securityName",
          "security_name",
          "name",
        ]),
        company_name: stringValue(row, [
          "companyName",
          "company_name",
        ]),
        security_id: stringValue(row, [
          "id",
          "securityId",
          "security_id",
        ]),
        active: true,
        raw_data: row,
        updated_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  if (!securities.length) {
    return 0;
  }

  const { error } = await supabase
    .from("nepse_securities")
    .upsert(securities, {
      onConflict: "symbol",
    });

  if (error) {
    throw error;
  }

  console.log(`${securities.length} securities saved.`);
  return securities.length;
}

async function syncPrices(): Promise<number> {
  const response = await getPriceVolume();
  const rows = toRows(response);

  if (!rows.length) {
    console.log("No price-volume data returned.");
    return 0;
  }

  const tradeDate = nepalDate();

  const prices = rows
    .map((row) => {
      const symbol = stringValue(row, [
        "symbol",
        "securitySymbol",
        "ticker",
      ]);

      if (!symbol) {
        return null;
      }

      return {
        symbol,
        trade_date: tradeDate,

        last_traded_price: numberValue(
          row.lastTradedPrice ??
            row.ltp ??
            row.last_traded_price,
        ),

        open_price: numberValue(
          row.openPrice ??
            row.open ??
            row.open_price,
        ),

        high_price: numberValue(
          row.highPrice ??
            row.high ??
            row.high_price,
        ),

        low_price: numberValue(
          row.lowPrice ??
            row.low ??
            row.low_price,
        ),

        close_price: numberValue(
          row.closePrice ??
            row.close ??
            row.close_price,
        ),

        volume: numberValue(
          row.totalTradeQuantity ??
            row.volume ??
            row.tradeQuantity,
        ),

        turnover: numberValue(
          row.turnover ??
            row.totalTurnover,
        ),

        transactions: numberValue(
          row.totalTrades ??
            row.transactions ??
            row.tradeCount,
        ),

        raw_data: row,
        fetched_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  if (!prices.length) {
    return 0;
  }

  const { error } = await supabase
    .from("nepse_live_prices")
    .upsert(prices, {
      onConflict: "symbol,trade_date",
    });

  if (error) {
    throw error;
  }

  console.log(`${prices.length} prices saved.`);
  return prices.length;
}

async function syncIndices(): Promise<number> {
  const response = await getNepseIndex();

  if (!response || typeof response !== "object") {
    console.log("No index data returned.");
    return 0;
  }

  const tradeDate = nepalDate();

  const indices = Object.entries(
    response as Record<string, unknown>,
  ).map(([indexName, value]) => {
    const row =
      value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : {};

    return {
      index_name: indexName,
      trade_date: tradeDate,

      index_value: numberValue(
        row.currentValue ??
          row.indexValue ??
          row.value ??
          value,
      ),

      change_value: numberValue(
        row.change ??
          row.changeValue,
      ),

      change_percent: numberValue(
        row.perChange ??
          row.changePercent ??
          row.percentageChange,
      ),

      raw_data: value,
      fetched_at: new Date().toISOString(),
    };
  });

  if (!indices.length) {
    return 0;
  }

  const { error } = await supabase
    .from("nepse_indices")
    .upsert(indices, {
      onConflict: "index_name,trade_date",
    });

  if (error) {
    throw error;
  }

  console.log(`${indices.length} index records saved.`);
  return indices.length;
}

async function syncDisclosures(): Promise<number> {
  const response = await disclosure();
  const rows = toRows(response);

  if (!rows.length) {
    console.log("No disclosures returned.");
    return 0;
  }

  const disclosures = rows.map((row, index) => {
    const symbol = stringValue(row, [
      "symbol",
      "securitySymbol",
    ]);

    const title =
      stringValue(row, [
        "title",
        "newsHeadline",
        "headline",
        "subject",
      ]) ?? "Untitled disclosure";

    const publishedDate =
      stringValue(row, [
        "publishedDate",
        "publishedAt",
        "date",
        "createdDate",
      ]) ?? nepalDate();

    const originalId = stringValue(row, [
      "id",
      "newsId",
      "disclosureId",
    ]);

    const disclosureKey =
      originalId ??
      `${symbol ?? "NEPSE"}-${publishedDate}-${index}`;

    let publishedAt: string | null = null;

    const parsedDate = new Date(publishedDate);

    if (!Number.isNaN(parsedDate.getTime())) {
      publishedAt = parsedDate.toISOString();
    }

    return {
      disclosure_key: disclosureKey,
      symbol,
      title,
      published_at: publishedAt,

      category: stringValue(row, [
        "category",
        "newsType",
        "type",
      ]),

      raw_data: row,
      fetched_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase
    .from("nepse_disclosures")
    .upsert(disclosures, {
      onConflict: "disclosure_key",
    });

  if (error) {
    throw error;
  }

  console.log(`${disclosures.length} disclosures saved.`);
  return disclosures.length;
}

async function main(): Promise<void> {
  let syncId = "";
  let recordsSaved = 0;

  try {
    console.log("Starting NEPSE synchronization...");

    syncId = await startSync();

    recordsSaved += await syncMarketSummary();
    recordsSaved += await syncSecurities();
    recordsSaved += await syncPrices();
    recordsSaved += await syncIndices();
    recordsSaved += await syncDisclosures();

    await finishSync(
      syncId,
      "success",
      recordsSaved,
    );

    console.log(
      `NEPSE synchronization completed. ${recordsSaved} records saved.`,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error("NEPSE synchronization failed:", message);

    if (syncId) {
      await finishSync(
        syncId,
        "failed",
        recordsSaved,
        message,
      );
    }

    process.exitCode = 1;
  } finally {
    await shutdownWorkerPool();
  }
}

await main();