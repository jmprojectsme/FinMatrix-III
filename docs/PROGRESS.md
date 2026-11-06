# FinMatrix — Progress & Handoff Notes

**Last updated:** 2026-11-06
**Working branch:** `claude/finmatrix-technical-audit-mrn1mm`
**Owner / product owner:** Jaymar Reperuga (accountant; former audit firm staff; builds on a phone with Spck Editor)

> **To resume in a new session:** "Read `docs/PROGRESS.md` in the repo and continue from there. Branch: `claude/finmatrix-technical-audit-mrn1mm`."

---

## 1. Goal

Make FinMatrix a real, usable bookkeeping app for Philippine small businesses and freelancers: correct double-entry accounting, safe data, BIR-aware, simple to use (Xero-like navigation, with custom Philippine features). Build slowly, one small tested change at a time.

---

## 2. Working agreement (how we work)

1. **One fix per change**, small and explained in plain language.
2. Every fix comes with **automated tests** (`tests/`), which run on GitHub for every push.
3. Changes go to the **working branch**, never directly to `main`.
4. **Push only with the owner's approval.** The owner tests the change on the phone (Spck preview, separate test data) before anything is merged.
5. **Merge into `main` only when the owner says "merge"**, via a pull request with ✅ tests.
6. **Never modify or reclassify existing records silently.** Data preservation comes first.
7. Accounting logic first, cosmetic polish later.

---

## 3. Done

- [x] Technical audit — `docs/AUDIT_REPORT.md` (findings B1–B28)
- [x] Accounting & data-integrity test plan — `docs/TEST_PLAN.md` (acceptance criteria)
- [x] Sample transaction test sheet for manual testing — `docs/SAMPLE_TRANSACTION_TEST.md`
- [x] Automated tests on GitHub Actions — `.github/workflows/tests.yml`, `tests/` (see `tests/README.md`)
  - 35 tests: 30 pass, 5 `todo` (known bugs, reported but not failing the build)
- [x] **B1 fix — Sales Payment Method is saved and used for posting** (commit `d709dbe`, merged into `main` via PR #1)
  - Cash → Dr Cash on Hand, Bank → Dr Cash in Bank, Credit → Dr Accounts Receivable
  - Existing records unchanged
  - **Tested by the owner in Spck preview: all results correct** (Cash 11,200; Bank 56,000; AR 5,000; BS 72,200 balanced; IS 65,000)

## 4. Waiting on the owner

- [ ] Protect `main` in GitHub: Settings → Branches/Rulesets → require pull request + status check `test`
- [ ] Answer the open policy questions (section 7) so `ACCOUNTING_RULES.md` can be written

---

## 5. Roadmap (agreed order)

### Phase A — Accounting logic (make it robust)
1. [x] B1 — Sales payment method *(merged, PR #1)*
2. [ ] Input validation — reject negative amounts, more than 2 decimals, empty documents, lines without account/date (B2, B3, B4)
3. [ ] XSS escaping of user text (B28) — small, protects client data; do early
4. [ ] One date per document (B14)
5. [ ] Balance Sheet cumulative "as of"; "Period: All" labels (B18, B22)
6. [ ] Chart of Accounts safety — account IDs & types, protected system accounts, no duplicates/lost accounts (B7–B11)
7. [ ] Report accuracy — TB net balances & ordering, IS sections (Gross Profit etc.), Home Net Income = IS (B13, B16, B17)
8. [ ] Voids as reversing entries (B5)
9. [ ] **Opening balances** (owner request; Xero "conversion balances")
10. [ ] **Receive Payment / Pay Bill**, manual journal entries, General Ledger (B20, B21) — statuses Posted · Unpaid / Partially Paid / Paid
11. [ ] **Fiscal year, Retained Earnings, year-end close, lock date** (B19; owner request)

### Phase B — Data safety & reliability
- [ ] Backup **restore**, backup reminders, `navigator.storage.persist()`, delete draft
- [ ] Offline start from home screen; "new version available" update prompt (service worker B23, B24, B25)
- [ ] Portrait orientation (manifest B27)

### Phase C — Compliance & reports
- [ ] Sequential document numbering (invoices/ORs)
- [ ] TIN format validation
- [ ] VAT summary (quarterly VAT return), Non-VAT / percentage tax (B26), EWT
- [ ] Printable/PDF statements, General Ledger, AR/AP aging, BIR-format books (sales, purchase, cash receipts, cash disbursements journals)

### Phase D — Usability polish
- [ ] ₱ and thousands separators
- [ ] Default row date = today
- [ ] Clear "Tap Post/Save again" hint after the action completes *(noticed during B1 testing)*
- [ ] Purchases payment dropdown: reset to Credit on new purchase; lock when posted *(noticed during B1)*
- [ ] Customer/supplier list with TIN autofill; duplicate document
- [ ] Split `main.js` into smaller files (easier to edit on a phone)

### Pilot & release
- [ ] Pilot: run in parallel with real books for 2–3 months (owner's brother's photography business; CPA friends review)
- [ ] Release 1.0

### Feature requests to schedule
- Down payments / deposits → **Unearned Revenue** (needed by the photography pilot)
- Multiple companies/clients in one app
- Specific bank and e-wallet accounts (BDO, BPI, GCash) in the COA (after account IDs)
- Recurring transactions, receipt photos, comparative reports, cash flow statement, Excel export

---

## 6. Decisions made

| Topic | Decision |
|---|---|
| Existing sales saved as "Credit" before B1 | Left unchanged; owner may void and re-enter if some were really cash/bank |
| App updates reaching installed phones | Bump `CACHE_NAME` in `sw.js` in every release that changes app files (2.0.1 = B1 fix). Proper fix for updates is in Phase B |
| Known bugs in tests | Marked `todo` until fixed; remove `todo` when the fix lands |
| Money in tests | Compared in centavos; every journal line must be whole centavos |
| Scope | Xero-level core bookkeeping + Philippine/BIR features; not ERP scope (no inventory/payroll/manufacturing for now) |
| Branding | Follow familiar accounting conventions, keep FinMatrix's own name and look |

## 7. Open questions for the owner (for `ACCOUNTING_RULES.md`)

1. Positioning: aim for BIR-registered books of accounts, or a bookkeeping aid that prepares records/reports? (sister — CPA lawyer — can advise)
2. VAT rounding: per line (current) or per invoice?
3. Voids: reversing entry on the void date?
4. Back-dated entries: allow, warn, or lock closed periods?
5. Fiscal year: calendar only, or custom?
6. First target users: freelancers (Non-VAT, percentage tax, EWT) or VAT-registered small businesses?
7. Opening balances that don't balance: block saving, or post the difference to Opening Balance Equity? Editable later or locked?
8. Year-end close: automatic (lock date, like Xero) or closing entries? (Recommendation: automatic + lock date)
9. Cash/Bank sales: post directly to Cash/Bank (current), or through AR then immediately paid (Xero-style)?
10. CPA feedback: any specific notes from the CPA who tested the app?

---

## 8. Testing notes (phone)

- **Never test in the installed app with real data.** Use Spck preview (separate storage) or an Incognito tab.
- Getting the branch into Spck: clone `https://github.com/jmprojectsme/FinMatrix-III.git` as a separate project (e.g. "FinMatrix-test"), then switch to the working branch. Alternative: download
  `https://github.com/jmprojectsme/FinMatrix-III/archive/refs/heads/claude/finmatrix-technical-audit-mrn1mm.zip`
- If Spck says *"Unable to resolve host github.com"*: check Android Private DNS (set Automatic/Off), VPN/ad-blockers, or switch Wi-Fi ↔ mobile data.
- GitHub test results: repo → latest commit → ✅/❌ → Details. "Post ..." steps are just cleanup.

## 9. People

| Role | Person |
|---|---|
| Product owner, accountant, reviewer | Jaymar (owner) |
| Accounting review | CPA friends |
| Compliance & legal review | Owner's sister (CPA lawyer) |
| First pilot user | Owner's brother (photography business) |

---

## 10. After FinMatrix

The owner has two other PWAs to improve afterwards, using the same workflow (tests, branches, review before merge).
