# FinMatrix — Changelog

The version number is shown in **Settings → About**. Every release updates it in three places,
which must match (checked automatically by `tests/pwa.test.js`):
`config.js` (APP_INFO.version and updated), `sw.js` (CACHE_NAME), and `package.json`.

---

## 2.0.5 — November 2026 *(step 5 of Phase A)*
- **Balance Sheet "as of"** (B18): the Balance Sheet always includes every posted transaction up to the
  **To** date; the From date is not used (on screen and in the CSV). Header shows "As of: <date>".
- **Report labels** (B22): "Period: All → All" / "As of: Today" when no dates are chosen (was "— → —").
- **Purchases**: Payment Method resets to Credit on **+ Add New** and is locked on posted purchases (same as Sales).
- **Settings → About** now shows the real version and update month.

## 2.0.4 — November 2026 *(PR #4)*
- **One date per document** (B14): a Date field at the top of Sales and Purchases; every report puts a
  document in the same period. Older documents use their first line's date (stored data unchanged).
- Posting without a date: "Cannot post: Date is required".

## 2.0.3 — November 2026 *(PR #3)*
- **Security** (B28): text typed by users is always shown as plain text and can never run as code.
- Chart of Accounts group names with quotes now work (B12).

## 2.0.2 — November 2026 *(PR #2)*
- **Input validation** (B2, B3, B4): negative amounts and more than 2 decimals rejected on Save;
  Post blocked for missing date/account, zero amounts, or no lines; every posted entry balances to the centavo.

## 2.0.1 — November 2026 *(PR #1)*
- **Sales payment method** (B1): Cash → Cash on Hand, Bank → Cash in Bank, Credit → Accounts Receivable
  (before, every sale went to Accounts Receivable).
- Automated tests added and run on GitHub for every change.

## 2.0.0 — April 2026
- FinMatrix-III: double-entry bookkeeping PWA — Sales, Purchases, Journal, Trial Balance, Income Statement,
  Balance Sheet, editable Chart of Accounts, Company Profile, CSV export, backup download, offline support.

---

## Earlier versions
- **FinMatrix (v1)** and **FinMatrix-II** — earlier builds by the same developer (separate repositories).
