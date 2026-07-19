import { createClient } from "@supabase/supabase-js";
import {
  getSecurityList,
  getCompaniesList,
  disclosure,
  shutdownWorkerPool,
} from "nepse-api-unofficial";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const sb = createClient(url, key, {
  auth: { persistSession: false },
});

function asArray(value: any): any[] {
  if (Array.isArray(value)) return value;

  for (const key of [
    "data",
    "content",
    "securities",
    "companies",
    "companyList",
    "securityList",
    "disclosures",
  ]) {
    if (Array.isArray(value?.[key])) return value[key];
  }

  return [];
}

function first(...values: any[]) {
  return values.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
  );
}

function clean(value: any): string | null {
  const result = value == null ? "" : String(value).trim();
  return result || null;
}

function normalizeDate(value: any): string | null {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toISOString();
}

async function main() {
  console.log("Downloading NEPSE security and company directories...");

  const [securityResult, companyResult, disclosureResult] =
    await Promise.all([
      getSecurityList(),
      getCompaniesList(),
      disclosure(),
    ]);

  const securities = asArray(securityResult);
  const companies = asArray(companyResult);
  const disclosures = asArray(disclosureResult);

  console.log(`Security records received: ${securities.length}`);
  console.log(`Company records received: ${companies.length}`);
  console.log(`Disclosure records received: ${disclosures.length}`);

  const companyBySymbol = new Map<string, any>();

  for (const row of companies) {
    const symbol = clean(
      first(
        row.symbol,
        row.securitySymbol,
        row.companySymbol,
        row.stockSymbol
      )
    )?.toUpperCase();

    if (symbol) companyBySymbol.set(symbol, row);
  }

  const securityRows = securities
    .map((row) => {
      const symbol = clean(
        first(
          row.symbol,
          row.securitySymbol,
          row.stockSymbol,
          row.companySymbol
        )
      )?.toUpperCase();

      if (!symbol) return null;

      const company = companyBySymbol.get(symbol);

      const securityName = clean(
        first(
          row.securityName,
          row.security_name,
          row.name,
          row.companyName,
          company?.companyName,
          company?.company_name,
          company?.name
        )
      );

      const companyName = clean(
        first(
          row.companyName,
          row.company_name,
          row.issuerName,
          row.issuer_name,
          company?.companyName,
          company?.company_name,
          company?.name,
          securityName
        )
      );

      return {
        symbol,
        security_name: securityName,
        company_name: companyName,
      };
    })
    .filter(Boolean);

  const merged = new Map<string, any>();

  for (const row of securityRows) {
    merged.set(row.symbol, row);
  }

  for (const [symbol, company] of companyBySymbol) {
    const current = merged.get(symbol) || { symbol };

    merged.set(symbol, {
      symbol,
      security_name:
        current.security_name ||
        clean(
          first(
            company.securityName,
            company.security_name,
            company.companyName,
            company.company_name,
            company.name
          )
        ),
      company_name:
        current.company_name ||
        clean(
          first(
            company.companyName,
            company.company_name,
            company.name,
            company.securityName
          )
        ),
    });
  }

  const directoryRows = [...merged.values()].filter(
    (row) => row.symbol
  );

  if (!directoryRows.length) {
    throw new Error(
      "NEPSE returned no usable security-directory records."
    );
  }

  const { error: securityError } = await sb
    .from("nepse_securities")
    .upsert(directoryRows, {
      onConflict: "symbol",
    });

  if (securityError) throw securityError;

  const aliasRows = directoryRows.map((row) => ({
    symbol: row.symbol,
    company_name:
      row.company_name || row.security_name || null,
    aliases: [
      row.security_name,
      row.company_name,
    ].filter(
      (value, index, array) =>
        value &&
        array.indexOf(value) === index
    ),
  }));

  const { error: aliasError } = await sb
    .from("company_aliases")
    .upsert(aliasRows, {
      onConflict: "symbol",
    });

  if (aliasError) throw aliasError;

  const disclosureRows = disclosures
    .map((row) => {
      const symbol = clean(
        first(
          row.symbol,
          row.securitySymbol,
          row.stockSymbol,
          row.companySymbol
        )
      )?.toUpperCase();

      const title = clean(
        first(
          row.title,
          row.newsHeadline,
          row.headline,
          row.subject,
          row.description
        )
      );

      const publishedAt = normalizeDate(
        first(
          row.publishedAt,
          row.publishedDate,
          row.newsDate,
          row.createdAt,
          row.date
        )
      );

      if (!symbol || !title || !publishedAt) return null;

      return {
        symbol,
        title,
        published_at: publishedAt,
        category:
          clean(
            first(
              row.category,
              row.newsType,
              row.disclosureType
            )
          ) || "NEPSE disclosure",
        source_url: clean(
          first(
            row.url,
            row.newsUrl,
            row.sourceUrl,
            row.attachmentUrl
          )
        ),
        source_name: "Nepal Stock Exchange",
        summary: clean(
          first(
            row.description,
            row.details,
            row.summary
          )
        ),
        authority_score: 95,
        fetched_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  if (disclosureRows.length) {
    const { error: disclosureError } = await sb
      .from("nepse_disclosures")
      .upsert(disclosureRows, {
        onConflict: "symbol,title,published_at",
      });

    if (disclosureError) throw disclosureError;
  }

  console.log(
    `Saved ${directoryRows.length} security-directory records.`
  );
  console.log(
    `Saved ${aliasRows.length} company alias records.`
  );
  console.log(
    `Saved ${disclosureRows.length} NEPSE disclosures.`
  );
}

try {
  await main();
} finally {
  await shutdownWorkerPool();
}
