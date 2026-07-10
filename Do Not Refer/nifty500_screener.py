"""
Nifty 500 Deep Value Screener
==============================

Filters Nifty 500 stocks that are:
  1. Down 50%+ from their all-time high (price data via yfinance)
  2. Showing an "upward tick" in sales growth (YoY growth accelerating)
  3. Where Promoters, FIIs and DIIs have each NOT reduced their holding
     by more than 5 percentage points over the last 1 year
  4. Market cap >= Rs 10,000 crore

WHY TWO DATA SOURCES?
----------------------
Price history and market cap are freely available via Yahoo Finance
(yfinance) for NSE-listed stocks. But shareholding pattern (Promoter/
FII/DII %) and quarterly/annual sales figures are NOT available through
any free market-data API for Indian stocks. The most practical free
source for this is screener.in (create a free account).

So this script:
  - Auto-fetches the Nifty 500 constituent list from NSE.
  - Auto-fetches price history + market cap from yfinance.
  - Reads shareholding + sales data from a CSV YOU export from
    screener.in (see screener_export_template.csv + instructions below).

HOW TO GET THE SCREENER.IN CSV
--------------------------------
1. Go to https://www.screener.in and log in (free account is enough).
2. Click "Screens" -> "Create a stock screen".
3. Use this query (paste into the query box):

     Market Capitalization > 10000 AND
     Promoter holding > 0

   (We only need this query to pull in ~all Nifty 500 stocks with
   basic data; the real filtering happens in this script. Feel free to
   just screen "Market Capitalization > 500" to get a broad universe.)
4. Once results appear, click "Export to Excel" (or use "Add Column"
   first to add these data points before exporting):
     - Sales
     - Sales growth (or "Sales" for last 3 years / last 4 quarters)
     - Promoter holding
     - Change in promoter holding (Change in promoter holding %)
     - FII holding
     - Change in FII holding
     - DII holding
     - Change in DII holding
5. Save the exported file as CSV, rename it to
   "screener_export.csv" and place it in the same folder as this
   script (or update SCREENER_CSV_PATH below).

   Exact column names vary a bit release to release, so open the CSV
   once you export it and adjust COLUMN_MAP below to match.

REQUIRED PYTHON PACKAGES
--------------------------
    pip install yfinance pandas requests

USAGE
------
    python nifty500_screener.py

Output: shortlisted stocks saved to "shortlist_result.csv" in the
same folder, and also printed to the console.
"""

import io
import time
import sys
import concurrent.futures as futures

import pandas as pd
import requests

# ============================================================
# CONFIG - edit these to match your setup
# ============================================================

SCREENER_CSV_PATH = "screener_export.csv"      # your exported file from screener.in
OUTPUT_PATH = "shortlist_result.csv"
PRICE_CACHE_PATH = "price_cache.csv"            # avoids re-hitting yfinance every run

# --- Filter thresholds (change as you like) ---
MIN_DROP_FROM_ATH_PCT = 50.0     # current price must be >= 50% below all-time high
MIN_MARKET_CAP_CR = 10000.0      # crore
MAX_HOLDING_DROP_PP = 5.0        # promoters/FII/DII must not have sold more than this
REQUIRE_SALES_UPWARD_TICK = True  # latest YoY sales growth must be accelerating & positive

# --- Map YOUR screener.in export's column names to what this script expects ---
# Open your exported CSV once and update the right-hand side strings to match
# the actual header names in that file.
COLUMN_MAP = {
    "name": "Name",
    "nse_symbol": "NSE Code",                 # screener.in sometimes calls this "Symbol" or "NSE Code"
    "sales_latest": "Sales latest",           # e.g. TTM / last FY sales
    "sales_preceding": "Sales preceding",     # sales one year before "latest"
    "sales_year_ago": "Sales 2 years ago",    # sales two years before "latest"
    "promoter_change_1yr": "Change in promoter holding",   # percentage-point change over 1 year
    "fii_change_1yr": "Change in FII holding",
    "dii_change_1yr": "Change in DII holding",
    "market_cap_screener": "Market Capitalization",  # optional cross-check, in crore
}

NUM_WORKERS = 8          # parallel yfinance fetches; lower if you get rate-limited
REQUEST_DELAY_SEC = 0.15  # be polite to Yahoo Finance


# ============================================================
# STEP 1: Get the Nifty 500 constituent list from NSE
# ============================================================

def fetch_nifty500_list() -> pd.DataFrame:
    """
    Downloads the official Nifty 500 constituent list from NSE.
    Falls back to a manual CSV named 'nifty500_list.csv' (columns:
    Company Name, Symbol) if NSE blocks the automated request.
    """
    urls = [
        "https://niftyindices.com/IndexConstituent/ind_nifty500list.csv",
        "https://archives.nseindia.com/content/indices/ind_nifty500list.csv",
    ]
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        ),
        "Accept": "text/csv,application/csv,*/*",
    }

    session = requests.Session()
    try:
        session.get("https://www.nseindia.com", headers=headers, timeout=10)
    except requests.RequestException:
        pass

    for url in urls:
        try:
            resp = session.get(url, headers=headers, timeout=15)
            if resp.status_code == 200 and "Symbol" in resp.text:
                df = pd.read_csv(io.StringIO(resp.text))
                df.columns = [c.strip() for c in df.columns]
                return df[["Company Name", "Symbol"]].rename(
                    columns={"Company Name": "name", "Symbol": "symbol"}
                )
        except requests.RequestException:
            continue

    # Fallback: local manual file
    try:
        df = pd.read_csv("nifty500_list.csv")
        df.columns = [c.strip() for c in df.columns]
        return df.rename(columns={df.columns[0]: "name", df.columns[1]: "symbol"})
    except FileNotFoundError:
        print(
            "ERROR: Could not auto-download the Nifty 500 list from NSE "
            "(it often blocks scripted requests), and no local "
            "'nifty500_list.csv' fallback was found.\n"
            "Fix: download the list yourself from "
            "https://niftyindices.com/indices/equity/broad-based-indices/nifty-500 "
            "(Download the CSV of constituents) and save it as "
            "'nifty500_list.csv' with columns 'Company Name,Symbol'."
        )
        sys.exit(1)


# ============================================================
# STEP 2: Price history + market cap via yfinance
# ============================================================

def get_price_and_cap(symbol: str) -> dict:
    """Returns current price, all-time-high, % off ATH, and market cap (in crore)."""
    import yfinance as yf  # imported here so the NSE-fetch step works even if yfinance is missing

    ticker = f"{symbol}.NS"
    result = {
        "symbol": symbol,
        "current_price": None,
        "all_time_high": None,
        "pct_off_ath": None,
        "market_cap_cr": None,
        "error": None,
    }
    try:
        tk = yf.Ticker(ticker)
        hist = tk.history(period="max", auto_adjust=False)
        if hist.empty:
            result["error"] = "no price history"
            return result

        ath = hist["High"].max()
        current = hist["Close"].iloc[-1]
        pct_off = (current - ath) / ath * 100.0

        info = {}
        try:
            info = tk.get_info()
        except Exception:
            pass
        mcap = info.get("marketCap")

        result.update(
            current_price=round(float(current), 2),
            all_time_high=round(float(ath), 2),
            pct_off_ath=round(float(pct_off), 2),
            market_cap_cr=round(mcap / 1e7, 2) if mcap else None,
        )
    except Exception as e:
        result["error"] = str(e)

    time.sleep(REQUEST_DELAY_SEC)
    return result


def fetch_all_price_data(symbols: list[str]) -> pd.DataFrame:
    """Fetches price/market-cap data for all symbols in parallel, with local caching."""
    cached = {}
    try:
        cache_df = pd.read_csv(PRICE_CACHE_PATH)
        cached = {row["symbol"]: row.to_dict() for _, row in cache_df.iterrows()}
        print(f"Loaded {len(cached)} cached price records from {PRICE_CACHE_PATH}")
    except FileNotFoundError:
        pass

    to_fetch = [s for s in symbols if s not in cached]
    print(f"Fetching fresh price data for {len(to_fetch)} symbols via yfinance...")

    fresh_results = []
    with futures.ThreadPoolExecutor(max_workers=NUM_WORKERS) as pool:
        for i, res in enumerate(pool.map(get_price_and_cap, to_fetch), 1):
            fresh_results.append(res)
            if i % 25 == 0 or i == len(to_fetch):
                print(f"  ...{i}/{len(to_fetch)} done")

    all_rows = list(cached.values()) + fresh_results
    df = pd.DataFrame(all_rows)
    df.to_csv(PRICE_CACHE_PATH, index=False)
    return df


# ============================================================
# STEP 3: Load screener.in fundamentals export
# ============================================================

def load_screener_export(path: str) -> pd.DataFrame:
    try:
        df = pd.read_csv(path)
    except FileNotFoundError:
        print(
            f"ERROR: Could not find '{path}'.\n"
            "Export your fundamentals CSV from screener.in first "
            "(see the instructions at the top of this script) and "
            "place it next to this script, or update SCREENER_CSV_PATH."
        )
        sys.exit(1)

    df.columns = [c.strip() for c in df.columns]
    missing = [v for v in COLUMN_MAP.values() if v not in df.columns and v != COLUMN_MAP["market_cap_screener"]]
    if missing:
        print(
            "WARNING: These expected columns were not found in your screener "
            f"export: {missing}\n"
            "Open the CSV and update COLUMN_MAP at the top of this script to "
            "match your actual column headers."
        )
    return df


# ============================================================
# STEP 4: Apply filters
# ============================================================

def safe_float(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def passes_sales_uptick(row) -> bool:
    latest = safe_float(row.get(COLUMN_MAP["sales_latest"]))
    preceding = safe_float(row.get(COLUMN_MAP["sales_preceding"]))
    year_ago = safe_float(row.get(COLUMN_MAP["sales_year_ago"]))

    if None in (latest, preceding, year_ago) or preceding == 0 or year_ago == 0:
        return False

    growth_latest = (latest - preceding) / abs(preceding) * 100.0
    growth_prior = (preceding - year_ago) / abs(year_ago) * 100.0

    # "Upward tick" = latest growth is positive AND accelerating vs prior period
    return growth_latest > 0 and growth_latest > growth_prior


def passes_holding_filter(row) -> bool:
    promoter_chg = safe_float(row.get(COLUMN_MAP["promoter_change_1yr"]))
    fii_chg = safe_float(row.get(COLUMN_MAP["fii_change_1yr"]))
    dii_chg = safe_float(row.get(COLUMN_MAP["dii_change_1yr"]))

    for chg in (promoter_chg, fii_chg, dii_chg):
        if chg is None:
            return False       # missing data -> can't confirm, exclude
        if chg < -MAX_HOLDING_DROP_PP:
            return False       # sold more than the allowed threshold
    return True


def run_screen():
    print("Step 1/4: Fetching Nifty 500 constituent list...")
    nifty500 = fetch_nifty500_list()
    print(f"  Got {len(nifty500)} constituents.")

    print("Step 2/4: Fetching price history & market cap (yfinance)...")
    price_df = fetch_all_price_data(nifty500["symbol"].tolist())

    merged = nifty500.merge(price_df, on="symbol", how="left")

    print("Step 3/4: Loading screener.in fundamentals export...")
    fundamentals = load_screener_export(SCREENER_CSV_PATH)

    # Try joining on NSE symbol first, fall back to name matching
    key_col = COLUMN_MAP["nse_symbol"]
    if key_col in fundamentals.columns:
        merged = merged.merge(
            fundamentals, left_on="symbol", right_on=key_col, how="inner"
        )
    else:
        merged = merged.merge(
            fundamentals, left_on="name", right_on=COLUMN_MAP["name"], how="inner"
        )

    print(f"  {len(merged)} stocks matched between price data and fundamentals data.")

    print("Step 4/4: Applying filters...")
    before = len(merged)

    merged = merged[merged["pct_off_ath"].notna()]
    merged = merged[merged["pct_off_ath"] <= -MIN_DROP_FROM_ATH_PCT]
    print(f"  After 'down {MIN_DROP_FROM_ATH_PCT}%+ from ATH' filter: {len(merged)} (was {before})")

    before = len(merged)
    merged = merged[merged["market_cap_cr"].notna()]
    merged = merged[merged["market_cap_cr"] >= MIN_MARKET_CAP_CR]
    print(f"  After 'market cap >= {MIN_MARKET_CAP_CR} cr' filter: {len(merged)} (was {before})")

    before = len(merged)
    merged = merged[merged.apply(passes_holding_filter, axis=1)]
    print(f"  After 'promoter/FII/DII holding not cut >{MAX_HOLDING_DROP_PP}pp' filter: {len(merged)} (was {before})")

    if REQUIRE_SALES_UPWARD_TICK:
        before = len(merged)
        merged = merged[merged.apply(passes_sales_uptick, axis=1)]
        print(f"  After 'sales growth upward tick' filter: {len(merged)} (was {before})")

    cols_to_show = [
        "name", "symbol", "current_price", "all_time_high", "pct_off_ath",
        "market_cap_cr", COLUMN_MAP["promoter_change_1yr"],
        COLUMN_MAP["fii_change_1yr"], COLUMN_MAP["dii_change_1yr"],
    ]
    cols_to_show = [c for c in cols_to_show if c in merged.columns]
    result = merged[cols_to_show].sort_values("pct_off_ath")

    result.to_csv(OUTPUT_PATH, index=False)
    print(f"\nDone. {len(result)} stocks matched all criteria.")
    print(f"Saved to: {OUTPUT_PATH}\n")
    print(result.to_string(index=False))
    return result


if __name__ == "__main__":
    run_screen()
