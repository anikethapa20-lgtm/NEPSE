import json
import os
import sys
from typing import Any

import requests
from nepse import Nepse


SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SERVICE_KEY:
    raise RuntimeError(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    )

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates,return=minimal",
}


def first_value(row: dict[str, Any], names: list[str]) -> Any:
    for name in names:
        value = row.get(name)
        if value is not None and str(value).strip():
            return value
    return None


def normalize_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def extract_rows(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [row for row in value if isinstance(row, dict)]

    if isinstance(value, dict):
        for key in (
            "data",
            "content",
            "companies",
            "companyList",
            "company_list",
            "securities",
        ):
            rows = value.get(key)
            if isinstance(rows, list):
                return [row for row in rows if isinstance(row, dict)]

    return []


def post_rows(table: str, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return

    endpoint = f"{SUPABASE_URL}/rest/v1/{table}"

    for start in range(0, len(rows), 250):
        chunk = rows[start : start + 250]
        response = requests.post(
            endpoint,
            headers=HEADERS,
            data=json.dumps(chunk),
            timeout=60,
        )

        if not response.ok:
            raise RuntimeError(
                f"Supabase {table} upsert failed "
                f"({response.status_code}): {response.text}"
            )

        print(
            f"Saved {min(start + len(chunk), len(rows))}"
            f"/{len(rows)} rows to {table}"
        )


def main() -> None:
    print("Downloading the NEPSE company directory...")

    nepse = Nepse()

    # The library's own documentation recommends disabling TLS
    # verification while NEPSE's certificate-chain issue persists.
    nepse.setTLSVerification(False)

    raw_result = nepse.getCompanyList()
    companies = extract_rows(raw_result)

    print(f"Raw company records received: {len(companies)}")

    if not companies:
        print("Returned value:", repr(raw_result)[:2000])
        raise RuntimeError("NEPSE returned no company-directory rows.")

    directory_by_symbol: dict[str, dict[str, Any]] = {}

    for row in companies:
        symbol = normalize_text(
            first_value(
                row,
                [
                    "symbol",
                    "securitySymbol",
                    "security_symbol",
                    "companySymbol",
                    "stockSymbol",
                    "ticker",
                ],
            )
        )

        company_name = normalize_text(
            first_value(
                row,
                [
                    "companyName",
                    "company_name",
                    "securityName",
                    "security_name",
                    "companyNameEnglish",
                    "name",
                ],
            )
        )

        if not symbol:
            continue

        symbol = symbol.upper()

        directory_by_symbol[symbol] = {
            "symbol": symbol,
            "security_name": company_name,
            "company_name": company_name,
        }

    directory_rows = list(directory_by_symbol.values())

    if not directory_rows:
        print(
            "Example raw record:",
            json.dumps(companies[0], ensure_ascii=False, indent=2),
        )
        raise RuntimeError(
            "Company rows were returned, but no symbols could be parsed."
        )

    alias_rows = [
        {
            "symbol": row["symbol"],
            "company_name": row["company_name"],
            "aliases": (
                [row["company_name"]]
                if row["company_name"]
                else []
            ),
        }
        for row in directory_rows
    ]

    post_rows("nepse_securities", directory_rows)
    post_rows("company_aliases", alias_rows)

    names = sum(
        1
        for row in directory_rows
        if row["company_name"]
    )

    print(f"Directory records saved: {len(directory_rows)}")
    print(f"Symbols with company names: {names}")

    if names == 0:
        raise RuntimeError(
            "Directory saved, but no company names were returned."
        )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
