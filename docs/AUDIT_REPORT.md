# FinMatrix — Technical Audit: Findings & Fix Recommendations

**Date:** 2026-11-06
**Scope:** `index.html`, `style.css`, `config.js`, `db.js`, `utils.js`, `main.js`, `sw.js`, `manifest.json` (~2,700 lines)
**Method:** Static review of all source files; the posting function (`generateJournalEntries`) was also executed in isolation to verify rounding and negative-amount behaviour. No repository files were modified.

---

## Executive Summary

FinMatrix is a functional single-page recorder of sales and purchases that derives double-entry journals on the fly. The most important problems are:

| # | Issue | Severity |
|---|---|---|
| 1 | Sales Payment Method is never saved — every sale posts to Accounts Receivable | Critical |
| 2 | Stored XSS in almost every list and report (`innerHTML` with raw user data) | High |
| 3 | Balance Sheet is computed as a period report (respects "From" date), not cumulative "as of" | High |
| 4 | Editing the Chart of Accounts can silently break reports (system accounts are hard-coded by name) | High |
| 5 | No manual journal entries / opening balances / General Ledger — AR & AP can never be settled | High |
| 6 | Sub-cent and negative amounts create unbalanced journal entries | High |
| 7 | PWA fails to launch offline (service worker / `start_url` mismatch) | High |
| 8 | Void removes transactions from history instead of reversing them | Medium |

---

## 1. Architecture Overview

| File | Role |
|---|---|
| `index.html` | Single page; each "page" is a `<section>`. Loads Chart.js (CDN) → `config.js` → `db.js` → `utils.js` → `main.js`, registers service worker. |
| `config.js` | Global state on `window`, `APP_INFO`, default `companyProfile`, default `COA`. |
| `db.js` | IndexedDB wrapper `window.DB` (`sales`, `purchases`, `settings` stores). Loads all data into memory at boot. |
| `utils.js` | Helpers + posting engine `generateJournalEntries` + `renderJournalEntries`. |
| `main.js` | ~1,500-line single closure: routing, Sales, Purchases, Journal, Reports, CSV, Drive backup, COA editor, Company Profile, About, Tutorial. |
| `sw.js` | Cache-first for app/CDN assets, network-first otherwise. |

**Key design observation:** Only source documents are stored. No journal or ledger is persisted; every report regenerates entries from documents **plus the current COA**, so COA edits retroactively change historical reports.

**Dependencies:** Global-script load order (no modules); Chart.js 4.4.2 from jsDelivr (no SRI); Google Fonts via `@import`. Google Identity Services is referenced but never loaded (Drive upload is dead code). No build, lint, or tests.

---

## 2. Confirmed Bugs

### 2.1 Transactions & Posting

**B1 — Sales Payment Method ignored (Critical)**
- **Files:** `main.js:49-53`, `main.js:447-452`, `index.html:129`
- **Issue:** `readPaymentData("sale")` reads radio buttons `salePayType` that do not exist; the HTML has `<select id="salesPaymentMethod">`. Result is always `"Credit"`, so Cash/Bank sales post `DR Accounts Receivable`. `openSale` also never restores the select.
- **Fix:** Read/write `#salesPaymentMethod` exactly as Purchases does with `#purchasePaymentMethod` (`main.js:598, 635`). Remove the unused radio/payment-section code (`main.js:31-164`) or finish implementing it in HTML. Provide a one-time data note: existing sales saved as "Credit" may need user review.

**B2 — Sub-cent amounts produce unbalanced entries**
- **File:** `utils.js:328-331`
- **Issue:** VAT and gross are rounded to 2 decimals, `net` is not. Verified: net 10.005 → DR 11.21 vs CR 11.205; 50 rows of 0.125 → Trial Balance off by 0.25.
- **Fix:** Round `net` to centavos on input/save (`Math.round(n*100)/100`), compute `gross = net + vat` from rounded parts. Preferably store money as integer centavos throughout.

**B3 — Negative amounts accepted and unbalanced**
- **Files:** `utils.js:340, 346`, `main.js:461, 644`
- **Issue:** `min="0"` is not enforced. With net −100, gross −112 is posted but the VAT line is skipped (`if (vat > 0)`) → DR −112 / CR −100. Negative values display blank in TB/Journal (`debit>0 ? … : ""`).
- **Fix:** Validate on Save/Post: net must be > 0. Use `vat !== 0` for the VAT line. Handle returns/credit memos as a separate document type rather than negative lines.

**B4 — Posting not validated, not persisted reliably**
- **Files:** `main.js:465, 471-480, 648, 654-663`
- **Issue:** Documents with no rows, zero totals, or missing dates can be posted. In-memory record is mutated before the DB write, which isn't awaited and has no error handling — UI shows POSTED, may revert on reload.
- **Fix:** Add a `validateForPost()` (≥1 row, every row has date/account/net>0). `await` the write; mutate a copy and commit to memory only on success; show an error on failure (also add `.catch` to Save).

**B5 — Void deletes history instead of reversing**
- **Files:** `main.js:482-492, 665-675`
- **Issue:** Voiding flips status, so the transaction disappears from all prior-period reports.
- **Fix:** Record a void date and generate a reversing entry dated on the void date; reports for periods before the void should still include the original.

**B6 — Sales description editable on posted records**
- **File:** `main.js:317`
- **Fix:** Use `"input,select,textarea"` as in Purchases (`main.js:504`).

### 2.2 Chart of Accounts

**B7 — System accounts hard-coded by name but renamable/deletable**
- **File:** `utils.js:316-347` (also fallbacks at `utils.js:332`)
- **Issue:** Posting uses literal names ("Cash on Hand", "Cash in Bank", "Accounts Receivable", "Accounts Payable", "Input VAT", "Output VAT Payable"). Renaming/deleting them in the COA makes their balances drop off the Balance Sheet while still appearing in the TB.
- **Fix:** Give accounts stable IDs and a `system: true` flag; block delete/rename of the ID (allow display-name changes only). Posting should reference IDs, not names.

**B8 — Group rename can delete accounts**
- **File:** `main.js:1318`
- **Issue:** Renaming a group to an existing name overwrites that key; one group's accounts are lost. Name isn't trimmed.
- **Fix:** Trim, reject empty or existing names before rebuilding the object.

**B9 — Deleting groups/accounts in use silently changes reports**
- **Files:** `main.js:1317-1319`
- **Fix:** Before deleting, check posted/draft usage; block or require reassignment. Long term, store account type on each posted line.

**B10 — Account rename flaws**
- **File:** `main.js:1320-1336`
- **Issues:** (a) `updated` counter never reset per record → every later record is rewritten to DB; (b) no collision check (can merge two accounts); (c) rewrites posted records; (d) matches by name across all categories.
- **Fix:** Track a per-record `changed` flag; check for duplicate names across the whole COA; with IDs (see B7) renames no longer touch transactions at all.

**B11 — Same account name allowed in multiple categories**
- **File:** `main.js:1346`
- **Issue:** Duplicate check is per group only; a name in both assets and liabilities is double-counted on the Balance Sheet.
- **Fix:** Enforce uniqueness across the entire COA (case-insensitive).

**B12 — Group names with `"` crash "Add account"**
- **Files:** `main.js:1344, 1352`
- **Fix:** Find the input via DOM traversal from the button (`btn.previousElementSibling`) or use `CSS.escape()`.

### 2.3 Trial Balance

**B13 — Shows gross debits and credits per account, not net balance**
- **File:** `main.js:752-766`
- **Fix:** Show `net = debit − credit` in the debit column if positive, credit column if negative. Order accounts by COA type (Assets → Liabilities → Equity → Revenue → Expenses) and flag accounts not found in COA.

**B14 — Inconsistent date filtering**
- **Files:** `main.js:745` (header date `rows[0].date`) vs `main.js:716, 1130` (per-row date); also Journal and chart.
- **Issue:** Multi-row documents with different row dates fall into different periods depending on the report. Undated rows appear in "All" but vanish when any filter is set.
- **Fix:** Add a single document-level **transaction date** field (required), and use it everywhere. Remove per-row dates or treat them as informational only.

### 2.4 Income Statement

**B15 — Accounts not in Revenue/Expense COA groups silently dropped**
- **File:** `main.js:772-785`
- **Fix:** Classify by stored account type; show an "Unclassified accounts" warning section so IS reconciles with TB.

**B16 — Incomplete structure**
- **Issue:** No Cost of Sales / Gross Profit subtotal, Other Income/Expenses mixed with operating items, no income tax line.
- **Fix:** Render by COA group with subtotals: Revenue → Cost of Sales → **Gross Profit** → Operating Expenses → **Operating Income** → Other Income/Expenses → Income Tax → **Net Income**.

**B17 — Home "Net Income" disagrees with the Income Statement**
- **File:** `main.js:167-176`
- **Issue:** Computed as sales net − purchases net, so asset purchases count as expenses.
- **Fix:** Reuse the Income Statement calculation (single shared function).

### 2.5 Balance Sheet

**B18 — Respects "From" date**
- **File:** `main.js:816`
- **Fix:** Use `buildLedger(null, to)` — the Balance Sheet is cumulative as of the end date.

**B19 — No Retained Earnings roll-forward**
- **File:** `main.js:843-855`
- **Fix:** Split equity into *Retained Earnings* (net income of all fiscal years before the current one) and *Current Year Net Income* (fiscal-year start → `to`). Add a fiscal-year-start setting in Company Profile.

**B20 — Opening balances, capital, settlements cannot be recorded**
- **Issue:** No manual journal entries → no Owner's Capital/Drawings, loans, AR collections, AP payments, depreciation, accruals, VAT remittance. AR/AP only grow; BS warning points at something the user cannot fix.
- **Fix:** Add (1) a **Manual Journal Entry** module (multi-line, must balance before posting), (2) **Receive Payment** (DR Cash / CR AR) and **Pay Bill** (DR AP / CR Cash) actions on credit documents, (3) an **Opening Balances** wizard that posts to an opening-balance equity account.

### 2.6 General Ledger

**B21 — No General Ledger**
- **File:** `main.js:739-750` (`buildLedger` is just totals for the TB)
- **Fix:** Add a GL report: per account, opening balance, then each line (date, reference, party, description, DR, CR, running balance), closing balance. Build it from one shared `getPostedJournalLines(from, to)` function used by Journal, GL, TB, IS and BS.

### 2.7 Display, UX, PWA

| ID | File | Issue | Fix |
|---|---|---|---|
| B22 | `main.js:690, 794, 870, 907` | `fmtDate("")` returns "—" (truthy) so "All"/"Today" never shows | Use `from ? fmtDate(from) : "All"` |
| B23 | `sw.js:440-463`, `manifest.json:4` | Offline launch fails: `./` doesn't match cached `./index.html` | Add `"./"` to `STATIC_ASSETS` and, for `request.mode === "navigate"`, fall back to `caches.match("./index.html")` |
| B24 | `sw.js:6, 447-451` | Cache-first + fixed cache name → updates never reach users; error responses cached | Derive `CACHE_NAME` from app version; use stale-while-revalidate for app files; cache only `res.ok`; show "Update available — reload" prompt instead of silent `skipWaiting()` |
| B25 | `main.js:1217`, `1233` | Backup blocked offline though it's a local download; no restore feature; misleading "Settings" message | Remove `onLine` check for file download; add **Restore from backup** with schema validation; delay `revokeObjectURL` (e.g. `setTimeout` 1s) |
| B26 | `main.js:342`, `config.js:22` | `companyProfile.nature` (Non-VAT) unused; VAT always defaults on; EWT accounts have no logic | Default tax to "None" for Non-VAT companies and hide Output VAT; add Exempt/Zero-rated codes; add EWT computation if needed |
| B27 | `manifest.json:6` | Orientation forced to landscape on a mobile-first app | Use `"any"` or `"portrait"`; add real screenshots; split `"maskable"` and `"any"` icons |

---

## 3. Security Findings

### 3.1 Confirmed — Stored XSS (B28, High)

User-entered values are inserted into `innerHTML` without escaping:

| Location | Unescaped values |
|---|---|
| `main.js:401, 587` | customer/supplier, TIN, reference |
| `main.js:244` | party name (Home recent) |
| `main.js:694-699` | account, party, reference (Journal) |
| `utils.js:363` | account (journal preview) |
| `main.js:731, 758, 799, 802, 877-887` | account names (reports) |
| `main.js:789, 862` | company name, TIN |
| `main.js:1299-1310` | COA group/account names, including inside `data-*` attributes |
| `main.js:28` | payment method fallback |
| `main.js:334, 521` | `value="${data.date}"` attribute |

Example: a customer named `<img src=x onerror=alert(1)>` executes on the Sales list. Today mostly self-XSS (local data), but becomes exploitable as soon as backup restore, sync, or sharing exists — and any injected script can read all IndexedDB data, including TINs.

**Fix:**
1. Add one helper and use it at every interpolation:
   ```js
   window.esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
     ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
   ```
2. Prefer building rows with `document.createElement` + `textContent` for user data.
3. Validate imported/restored data against a schema before loading.

### 3.2 Potential Risks

| Risk | Location | Recommendation |
|---|---|---|
| CSV / formula injection | `main.js:1156` | Prefix cells starting with `=`, `+`, `-`, `@`, tab or CR with `'` (except known numeric amount columns) |
| No Content-Security-Policy; inline `onerror` handler | `index.html`, `main.js:1421` | Add a CSP meta tag (`default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com`), move inline SW registration script to a file, remove inline handlers |
| CDN script without SRI, cached indefinitely | `index.html:361`, `sw.js:23` | Add `integrity` + `crossorigin` attributes, or self-host Chart.js |
| Plaintext backup containing TINs | `main.js:1169` | Document it; optionally offer password-encrypted backup (Web Crypto AES-GCM) |
| Drive OAuth (if enabled): consent on every run, token not revoked | `main.js:1246-1254` | Use `prompt: ""` after first grant; call `google.accounts.oauth2.revoke` when done |

---

## 4. Other Potential Risks

### Data integrity
- **Accounts identified by name, not ID/type** — root cause of B7, B9, B10, B11, B15. *Fix:* COA entries `{id, name, type, group, system}`; transaction lines store `accountId`.
- **Floating-point money** — ledger sums not rounded; `bal !== 0` can show "(0.00)" rows; VAT rounding differs between `calcGross`/`buildAccTotals` and the journal. *Fix:* integer centavos, or round at each aggregation and compare with `Math.abs(x) >= 0.005`.
- **Any account selectable on any document** (e.g., crediting an expense from a sale). *Fix:* restrict Sales lines to Revenue (plus optional Other Income), Purchases lines to Expenses/Assets.
- **Inconsistent "missing account" defaults** ("Sales Revenue"/"Miscellaneous Expense" vs "(No Account)"). *Fix:* require an account on every line.
- **DB open failure still boots the app** (`main.js:9`) → every save throws. *Fix:* show a blocking error/read-only mode.
- **No multi-tab coordination** → tabs overwrite each other. *Fix:* `BroadcastChannel` to reload state, or reload from DB before writes.
- **No draft deletion**; voided references block reuse (`utils.js:265`).
- **Unstable Journal sort** (`main.js:688`) — comparator never returns 0. *Fix:* `a.date.localeCompare(b.date) || a.id - b.id`.

### Performance
- Entire dataset loaded into memory at boot.
- Search re-renders on every keystroke, no debounce (`main.js:429, 614`).
- `indexOf` inside render loop → O(n²) (`main.js:399, 585`).
- All journal entries regenerated for every report.
- Chart destroyed/recreated on every Home visit (`main.js:205`).
- COA rename rewrites far more records than needed (B10).
- CSV blob URL never revoked (`main.js:1159`).

*Fixes:* debounce search (~200 ms); carry the index in the filter (`map((s,i)=>({s,i}))`); cache generated journal lines and invalidate on save/post/void; `chart.update()` instead of destroy; use IndexedDB indexes on date/status when data grows.

### Maintainability
- `main.js` is one 1,500-line closure; Sales and Purchases are near-duplicate modules that have already drifted (B1, B6).
- Report logic duplicated between HTML renderers and CSV export (`main.js:946-1075`).
- Magic values repeated: VAT 0.12 (6+ places), status strings, hard-coded account names.
- Dead code: payment radio sections, Drive OAuth placeholder.
- No tests, no linter; very long single-line statements.
- App version (`config.js`) and SW cache name (`sw.js`) not linked; no DB migration path for older records (`paymentMethod` vs `payment`).

*Fixes:*
1. Split into ES modules: `accounting/` (posting, ledger, reports — pure functions, no DOM), `ui/` (pages), `data/` (DB, migrations).
2. One generic `DocumentModule({type:"sale"|"purchase"})` replacing the duplicated Sales/Purchases code.
3. Reports produce a data model once, rendered to HTML **and** CSV from the same model.
4. Constants file: `VAT_RATE`, `STATUS`, `SYSTEM_ACCOUNTS`.
5. Unit tests for posting, TB, IS, BS (e.g., Vitest or plain Node test runner) — every JE must balance; BS must balance for any generated dataset.
6. ESLint + Prettier.
7. Versioned DB migrations in `onupgradeneeded` / on load.

---

## 5. Recommended Fix Roadmap

| Phase | Items | Goal |
|---|---|---|
| **1 — Correctness hotfixes** | B1, B2, B3, B4, B6, B12, B18, B22 | Correct postings, valid input, accurate BS date logic |
| **2 — Security** | B28 escaping, CSV injection, CSP, SRI | Close XSS and export risks |
| **3 — PWA reliability** | B23, B24, B25, B27 | Offline start, updates, backup + restore |
| **4 — COA integrity** | B7–B11, account IDs + types, migration | Reports no longer break on COA edits |
| **5 — Accounting completeness** | B5, B13–B17, B19–B21, B26 | Reversing voids, proper TB/IS/BS, manual JEs, payments, opening balances, General Ledger, Non-VAT/EWT |
| **6 — Refactor & tests** | Module split, shared report model, unit tests, lint | Prevent regressions, easier maintenance |

---

*Prepared as an audit only — no code changes were made to the repository.*
