# FinMatrix — Accounting & Data-Integrity Test Plan

**Version:** 1.0 · **Date:** 2026-11-06
**Purpose:** Acceptance criteria for every future FinMatrix modification. A change is acceptable only if all **P0** tests pass and no previously passing test regresses.
**Basis:** FinMatrix Technical Audit (findings B1–B28). Expected values in this plan were cross-checked by executing the current `utils.js` posting engine in Node.

---

## 0. How to Use This Plan

### 0.1 Priority levels

| Priority | Meaning | Release rule |
|---|---|---|
| **P0** | Accounting correctness or loss/corruption of existing data | Must pass before any release |
| **P1** | Report accuracy, consistency between views | Must pass, or have a documented, approved exception |
| **P2** | Usability, robustness, future features | Tracked; should pass once the feature exists |

### 0.2 Status column

Each test lists the **current status** against the code as audited:

- **PASS** — current code meets the criterion.
- **FAIL (Bn)** — current code fails; *Bn* is the related audit finding.
- **N/A (feature)** — feature does not exist yet; test is the acceptance criterion for building it.

### 0.3 Universal pass criteria (apply to every test)

These apply to **every** scenario in addition to its own criteria:

1. **U1 — Balanced entry:** For every posted document, Σ debits = Σ credits **to the centavo** (compare `Math.round(x*100)`, never raw floats).
2. **U2 — No silent mutation:** No posted document's lines, amounts, dates, party, or status change unless the test explicitly performs that action.
3. **U3 — Persistence:** Results are identical after a full app reload (IndexedDB round-trip).
4. **U4 — View consistency:** The same figure is identical in the form summary, list view, Journal, report screen, and CSV export.
5. **U5 — Exclusions:** DRAFT documents never appear in Journal, Trial Balance, Income Statement, Balance Sheet, overview, or chart.
6. **U6 — Display:** Amounts display with 2 decimals; negative balances display in parentheses; no "NaN", "undefined", "-0.00", or "(0.00)".

### 0.4 Standard baseline (Initial Condition "BASE")

Unless stated otherwise every test starts from:

- Fresh install: IndexedDB `FinMatrixDB` deleted, then app loaded.
- Default COA from `config.js` (**47 accounts**: Revenue 5, Expenses 14, Assets 9, Liabilities 15, Equity 4).
- Company Profile: Name "Test Co.", Nature **VAT**, TIN "123-456-789-000".
- VAT rate 12%. VAT rounding policy: **per line, half-up to 2 decimals** (the current engine's behaviour; see TC-06).

### 0.5 Standard dataset "D1"

Used by TC-09, TC-10, TC-11, TC-12, TC-13, TC-14. Load onto BASE.

| ID | Type | Date | Payment | Account | Net | Tax | VAT | Gross | Status |
|---|---|---|---|---|---:|---|---:|---:|---|
| S1 | Sale | 2026-01-05 | Cash | Sales Revenue | 10,000.00 | VAT | 1,200.00 | 11,200.00 | POSTED |
| S2 | Sale | 2026-01-20 | Bank | Service Revenue | 50,000.00 | VAT | 6,000.00 | 56,000.00 | POSTED |
| S3 | Sale | 2026-02-10 | Credit | Professional Fees | 5,000.00 | None | 0.00 | 5,000.00 | POSTED |
| P1 | Purchase | 2026-01-08 | Cash | Office Supplies | 1,000.00 | VAT | 120.00 | 1,120.00 | POSTED |
| P2 | Purchase | 2026-01-25 | Credit | Cost of Goods Sold | 6,000.00 | VAT | 720.00 | 6,720.00 | POSTED |
| P3 | Purchase | 2026-02-15 | Bank | Rent Expense | 4,000.00 | VAT | 480.00 | 4,480.00 | POSTED |
| P4 | Purchase | 2026-02-20 | Bank | Property, Plant & Equipment | 30,000.00 | VAT | 3,600.00 | 33,600.00 | POSTED |
| S4 | Sale | 2026-03-05 | Cash | Sales Revenue | 3,000.00 | VAT | 360.00 | 3,360.00 | POSTED, then **VOID on 2026-03-10** |
| S5 | Sale | 2026-02-28 | Cash | Sales Revenue | 9,999.00 | VAT | 1,199.88 | 11,198.88 | DRAFT (never posted) |

**D1 ledger — as of 2026-03-31, excluding S4 (void) and S5 (draft):**

| Account | Type | Debits | Credits | Net balance |
|---|---|---:|---:|---:|
| Cash on Hand | Asset | 11,200.00 | 1,120.00 | 10,080.00 Dr |
| Cash in Bank | Asset | 56,000.00 | 38,080.00 | 17,920.00 Dr |
| Accounts Receivable | Asset | 5,000.00 | — | 5,000.00 Dr |
| Input VAT | Asset | 4,920.00 | — | 4,920.00 Dr |
| Property, Plant & Equipment | Asset | 30,000.00 | — | 30,000.00 Dr |
| Accounts Payable | Liability | — | 6,720.00 | 6,720.00 Cr |
| Output VAT Payable | Liability | — | 7,200.00 | 7,200.00 Cr |
| Sales Revenue | Revenue | — | 10,000.00 | 10,000.00 Cr |
| Service Revenue | Revenue | — | 50,000.00 | 50,000.00 Cr |
| Professional Fees | Revenue | — | 5,000.00 | 5,000.00 Cr |
| Cost of Goods Sold | Expense | 6,000.00 | — | 6,000.00 Dr |
| Office Supplies | Expense | 1,000.00 | — | 1,000.00 Dr |
| Rent Expense | Expense | 4,000.00 | — | 4,000.00 Dr |
| **Totals** | | **118,120.00** | **118,120.00** | **78,920.00 Dr = 78,920.00 Cr** |

**D1 key figures (verified):**

| Figure | Q1 (to 2026-03-31) | January only |
|---|---:|---:|
| Total Revenue | 65,000.00 | 60,000.00 |
| Total Expenses | 11,000.00 | 7,000.00 |
| Net Income | 54,000.00 | 53,000.00 |
| Total Assets (BS as of period end) | 67,920.00 | 66,920.00 |
| Total Liabilities | 13,920.00 | 13,920.00 |
| Total Equity (incl. current NI) | 54,000.00 | 53,000.00 |
| Net-balance TB total | 78,920.00 | 73,920.00 |
| Gross-activity TB total | 118,120.00 | 75,040.00 |

---

## 1. Cash Sales (TC-01)

| ID | P | Scenario | Status |
|---|---|---|---|
| TC-01.1 | P0 | Single-line VAT cash sale | **FAIL (B1)** |
| TC-01.2 | P0 | Single-line non-VAT cash sale | **FAIL (B1)** |
| TC-01.3 | P0 | Multi-line mixed VAT/None cash sale | **FAIL (B1)** |
| TC-01.4 | P0 | Payment method persists and displays | **FAIL (B1)** |

### TC-01.1 — Single-line VAT cash sale
- **Initial conditions:** BASE.
- **Data:** Customer "Juan Cruz", Ref "OR-0001", Payment **Cash**, row: 2026-01-05, "Goods", Sales Revenue, Net 10,000.00, Tax VAT. Save → Post.
- **Expected JE:**

  | Account | Debit | Credit |
  |---|---:|---:|
  | Cash on Hand | 11,200.00 | |
  | Sales Revenue | | 10,000.00 |
  | Output VAT Payable | | 1,200.00 |

- **Totals:** Dr 11,200.00 = Cr 11,200.00.
- **Statement impact:** IS Revenue +10,000.00; NI +10,000.00. BS Cash on Hand +11,200.00; Output VAT +1,200.00; Equity (Current NI) +10,000.00. Assets 11,200.00 = L 1,200.00 + E 10,000.00. **Accounts Receivable = 0.00.**
- **Pass:** JE exactly as above; AR does not appear anywhere; list "Payment" badge shows **Cash**; U1–U6.
- **Current:** posts **DR Accounts Receivable** because `#salesPaymentMethod` is never read.

### TC-01.2 — Non-VAT cash sale
- **Data:** Payment Cash; row 2026-01-06, Service Revenue, Net 5,000.00, Tax None.
- **Expected JE:** Dr Cash on Hand 5,000.00 / Cr Service Revenue 5,000.00. No Output VAT line.
- **Totals:** 5,000.00 = 5,000.00.
- **Impact:** Revenue +5,000.00; Cash +5,000.00; no VAT liability.
- **Pass:** No zero-amount VAT line is generated; U1–U6.

### TC-01.3 — Multi-line mixed cash sale
- **Data:** Payment Cash; row A: Sales Revenue 1,000.00 VAT; row B: Service Revenue 500.00 None (same date 2026-01-07).
- **Expected JE (aggregated by account):** Dr Cash on Hand 1,620.00 / Cr Sales Revenue 1,000.00 / Cr Output VAT Payable 120.00 / Cr Service Revenue 500.00.
- **Totals:** 1,620.00 = 1,620.00.
- **Form summary:** Net (VAT-able) 1,000.00; VAT 120.00; Exempt/None 500.00; Grand Total 1,620.00.
- **Pass:** Cash debit appears once (aggregated); form Grand Total = JE debit total = list Gross (U4).

### TC-01.4 — Payment method persistence
- **Steps:** Create TC-01.1 as Draft with Payment **Cash**; Save; reopen; reload app; reopen.
- **Pass:** Select shows **Cash** after each reopen and reload; stored record `paymentMethod === "Cash"` (and `payment.type === "Cash"` if that structure is retained).

---

## 2. Bank Sales (TC-02)

| ID | P | Scenario | Status |
|---|---|---|---|
| TC-02.1 | P0 | VAT bank sale | **FAIL (B1)** |
| TC-02.2 | P0 | Changing payment method on a draft | **FAIL (B1)** |

### TC-02.1 — VAT bank sale
- **Data:** Payment **Bank**; 2026-01-20; Service Revenue 50,000.00 VAT.
- **Expected JE:** Dr Cash in Bank 56,000.00 / Cr Service Revenue 50,000.00 / Cr Output VAT Payable 6,000.00.
- **Totals:** 56,000.00 = 56,000.00.
- **Impact:** Revenue +50,000.00; Cash in Bank +56,000.00; Output VAT +6,000.00.
- **Pass:** Only Cash in Bank is debited (not Cash on Hand, not AR).

### TC-02.2 — Change payment method before posting
- **Steps:** Save a draft as Credit; reopen; change to Bank; Save; Post.
- **Expected JE:** As TC-02.1 (debit Cash in Bank). No AR entry remains.
- **Pass:** Last saved payment method wins; no residual entries.

---

## 3. Credit Sales (TC-03)

| ID | P | Scenario | Status |
|---|---|---|---|
| TC-03.1 | P0 | Non-VAT credit sale | PASS |
| TC-03.2 | P0 | VAT credit sale | PASS |
| TC-03.3 | P2 | Collection of receivable | **N/A (feature, B20)** |
| TC-03.4 | P2 | Partial collection | **N/A (feature, B20)** |

### TC-03.1 — Non-VAT credit sale
- **Data:** Payment Credit; 2026-02-10; Professional Fees 5,000.00 None.
- **Expected JE:** Dr Accounts Receivable 5,000.00 / Cr Professional Fees 5,000.00.
- **Impact:** Revenue +5,000.00; AR +5,000.00.

### TC-03.2 — VAT credit sale
- **Data:** Payment Credit; Professional Fees 8,000.00 VAT.
- **Expected JE:** Dr AR 8,960.00 / Cr Professional Fees 8,000.00 / Cr Output VAT Payable 960.00.
- **Totals:** 8,960.00 = 8,960.00.

### TC-03.3 — Collection (future feature acceptance)
- **Initial:** TC-03.2 posted.
- **Data:** Receive Payment against that sale, 2026-02-28, Bank, 8,960.00.
- **Expected JE:** Dr Cash in Bank 8,960.00 / Cr Accounts Receivable 8,960.00.
- **Impact:** IS unchanged (no revenue double-count). BS: AR 0.00; Bank +8,960.00.
- **Pass:** Original sale untouched (U2); sale shows "Paid"; collection cannot exceed outstanding balance.

### TC-03.4 — Partial collection (future)
- **Data:** Receive 5,000.00 against the 8,960.00 sale.
- **Expected:** AR outstanding 3,960.00; status "Partially paid"; second collection of 3,960.00 closes it; a further 0.01 is rejected.

---

## 4. Cash Purchases (TC-04)

| ID | P | Scenario | Status |
|---|---|---|---|
| TC-04.1 | P0 | VAT cash purchase (expense) | PASS |
| TC-04.2 | P0 | Cash purchase with no opening cash (negative cash) | PASS (engine); display P1 |
| TC-04.3 | P0 | Bank purchase of fixed asset | PASS (JE) / **FAIL overview (B17)** |

### TC-04.1 — VAT cash purchase
- **Data:** Supplier "ABC Supply", Payment Cash, 2026-01-08, Office Supplies 2,500.00 VAT.
- **Expected JE:** Dr Office Supplies 2,500.00 / Dr Input VAT 300.00 / Cr Cash on Hand 2,800.00.
- **Totals:** 2,800.00 = 2,800.00.
- **Impact:** IS Expense +2,500.00 (NI −2,500.00). BS Cash −2,800.00, Input VAT +300.00, Equity −2,500.00.

### TC-04.2 — Negative cash
- **Initial:** BASE with no sales.
- **Data:** TC-04.1.
- **Expected BS:** Cash on Hand (2,800.00); Input VAT 300.00; Total Assets (2,500.00); Equity (2,500.00). Balanced.
- **Pass:** Negative shown in parentheses; BS balances. *(Future: an optional warning "Cash balance is negative" is acceptable but must not block posting unless a policy is set.)*

### TC-04.3 — Fixed asset purchase via bank
- **Data:** Payment Bank, 2026-02-20, Property, Plant & Equipment 30,000.00 VAT.
- **Expected JE:** Dr PPE 30,000.00 / Dr Input VAT 3,600.00 / Cr Cash in Bank 33,600.00.
- **Impact:** **No IS impact.** BS: PPE +30,000.00, Input VAT +3,600.00, Bank −33,600.00.
- **Pass:** Income Statement and Home "Net Income" are both unchanged by this purchase.
- **Current:** Home overview counts it as an expense (B17).

---

## 5. Credit Purchases (TC-05)

| ID | P | Scenario | Status |
|---|---|---|---|
| TC-05.1 | P0 | VAT credit purchase (COGS) | PASS |
| TC-05.2 | P2 | Payment of payable | **N/A (feature, B20)** |

### TC-05.1
- **Data:** Payment Credit, 2026-01-25, Cost of Goods Sold 6,000.00 VAT.
- **Expected JE:** Dr COGS 6,000.00 / Dr Input VAT 720.00 / Cr Accounts Payable 6,720.00.
- **Impact:** IS Cost of Sales +6,000.00; BS AP +6,720.00, Input VAT +720.00.

### TC-05.2 — Pay bill (future)
- **Data:** Pay 6,720.00 from Bank on 2026-02-25.
- **Expected JE:** Dr Accounts Payable 6,720.00 / Cr Cash in Bank 6,720.00.
- **Pass:** AP 0.00; IS unchanged; original purchase untouched; overpayment rejected.

---

## 6. VAT Calculations & Rounding (TC-06)

**Policy under test:** VAT = round_half_up(net × 0.12, 2) **per line**; gross = net + VAT; all stored amounts are exact centavos.

| ID | P | Scenario | Status |
|---|---|---|---|
| TC-06.1 | P0 | Standard amounts | PASS |
| TC-06.2 | P0 | VAT requiring rounding | PASS |
| TC-06.3 | P0 | Net with more than 2 decimals | **FAIL (B2)** |
| TC-06.4 | P1 | Per-line rounding consistency across views | **FAIL (audit: rounding inconsistency)** |
| TC-06.5 | P0 | Accumulation of many lines | PASS when compared in centavos; raw floats drift |
| TC-06.6 | P0 | Large amount precision | PASS when compared in centavos |
| TC-06.7 | P0 | Exhaustive 2-decimal sweep | PASS |
| TC-06.8 | P1 | Non-VAT company | **FAIL (B26)** |
| TC-06.9 | P1 | Purchase VAT mirrors sales VAT | PASS |

| Case | Net | Expected VAT | Expected Gross | Notes |
|---|---:|---:|---:|---|
| 06.1a | 10,000.00 | 1,200.00 | 11,200.00 | |
| 06.1b | 1.00 | 0.12 | 1.12 | |
| 06.2a | 100.01 | 12.00 | 112.01 | 12.0012 → 12.00 |
| 06.2b | 10.05 | 1.21 | 11.26 | 1.206 → 1.21 |
| 06.2c | 0.04 | 0.00 | 0.04 | 0.0048 → 0.00; no VAT line generated |
| 06.2d | 0.05 | 0.01 | 0.06 | 0.006 → 0.01 |
| 06.6 | 1,234,567.89 | 148,148.15 | 1,382,716.04 | |

### TC-06.3 — More than 2 decimals
- **Data:** Net 10.005 VAT (typed directly; `step="0.01"` is not enforced on save).
- **Expected:** Either (a) rejected with "Amount can have at most 2 decimal places", or (b) normalised to 10.01 before saving. Either way the JE balances to the centavo.
- **Current:** JE Dr 11.21 vs Cr 11.205 (net stays unrounded). 50 lines of 0.125 → TB out by **0.25**.

### TC-06.4 — Per-line rounding consistency
- **Data:** One sale, 3 lines × Net 0.04 VAT.
- **Expected everywhere:** VAT 0.00, Gross 0.12.
- **Pass:** Form total, list "Gross" (`calcGross`), journal, Sales-by-Account report (`buildAccTotals`), and CSV all show **0.12** gross and **0.00** VAT.
- **Current:** List shows **0.13** (unrounded VAT); Sales report shows VAT **0.01**; Journal shows 0.12.

### TC-06.5 — Accumulation
- **Data:** One sale with 1,000 lines × Net 0.10 VAT (VAT 0.01 each).
- **Expected:** Net 100.00, VAT 10.00, Gross 110.00; Dr = Cr = 110.00.
- **Pass:** Totals compared in centavos are exact; display shows 110.00, never 109.99.
- **Note:** Current raw floats are 109.99999999999949 vs 109.99999999999842 — tests **must** compare in centavos, and storing integer centavos is recommended.

### TC-06.7 — Exhaustive sweep (automated)
- **Data:** For every net from 0.01 to 100.00 (10,000 values), VAT and None, Cash/Bank/Credit, sale and purchase.
- **Pass:** 0 unbalanced entries (centavo comparison); VAT = round_half_up(net×12/100). Integer arithmetic reference: `vatCents = Math.round(netCents*12/100)`.
- **Current:** 0 imbalances (verified).

### TC-06.8 — Non-VAT company
- **Initial:** Company Nature = **Non-VAT**.
- **Data:** New sale row, Sales Revenue 1,000.00 (tax left at default).
- **Expected:** Default tax None; JE Dr Cash 1,000.00 / Cr Sales Revenue 1,000.00; no Output VAT; VAT column hidden or zero.
- **Pass:** No VAT is computed unless the user explicitly selects it (or the option is unavailable).

### TC-06.9 — Purchase VAT
- **Data:** Same values as 06.1–06.6 on purchases.
- **Pass:** Input VAT equals the corresponding sales Output VAT for identical nets.

---

## 7. Invalid & Negative Amounts (TC-07)

**General pass rule:** an invalid document is **not saved or posted**, an inline error identifies the field, and any previously stored version of that document is unchanged (U2).

| ID | P | Input | Expected | Status |
|---|---|---|---|---|
| TC-07.1 | P0 | Net −100.00 (VAT) | Rejected on Save | **FAIL (B3)** — saved; JE Dr AR −112.00 / Cr Sales −100.00 (**unbalanced by 12.00**, VAT line dropped) |
| TC-07.2 | P0 | Net 0.00 on the only line | Post rejected ("at least one line with amount > 0") | **FAIL (B4)** |
| TC-07.3 | P0 | Net "abc" / blank | Rejected (currently coerced to 0) | **FAIL (B4)** |
| TC-07.4 | P0 | Document with zero lines | Post rejected | **FAIL (B4)** — posts an empty JE |
| TC-07.5 | P0 | Line with no account | Rejected | **FAIL** — silently posts to Sales Revenue / Miscellaneous Expense |
| TC-07.6 | P0 | Line with no date | Post rejected | **FAIL (B4, B14)** |
| TC-07.7 | P1 | Net "1e3" | Stored as 1,000.00 or rejected; never 1 | Verify |
| TC-07.8 | P1 | Net 1,000,000,000,000.00 | Rejected above a defined maximum (e.g. 999,999,999.99) | Not enforced |
| TC-07.9 | P0 | Net 10.005 | See TC-06.3 | **FAIL (B2)** |
| TC-07.10 | P0 | Customer/Supplier blank | Rejected | PASS |
| TC-07.11 | P1 | Duplicate reference "or-0001" when "OR-0001" exists | Rejected (case-insensitive) | PASS |
| TC-07.12 | P1 | Leading/trailing spaces in reference | Trimmed; duplicate check uses trimmed value | PASS |
| TC-07.13 | P0 | Editing a stored draft to an invalid value, then Save | Rejected; stored draft keeps its previous valid values | **FAIL (B3/B4)** |
| TC-07.14 | P1 | Negative value in a posted line display | n/a once 07.1 passes; until then must not render blank | **FAIL (B3)** |

**Expected JE / totals for valid boundary values:** Net 0.01 VAT → Dr 0.01 / Cr 0.01 (VAT 0.00, no VAT line). Net 999,999,999.99 VAT → VAT 120,000,000.00 (999,999,999.99 × 0.12 = 119,999,999.9988, rounded half-up to 2 dp), Gross 1,119,999,999.99; Dr = Cr.

---

## 8. Debit & Credit Balancing (TC-08)

| ID | P | Scenario | Status |
|---|---|---|---|
| TC-08.1 | P0 | Property test: random valid documents always balance | PASS |
| TC-08.2 | P0 | Every JE has ≥ 2 lines and no zero-amount lines | PASS |
| TC-08.3 | P0 | Settlement account mapping | PASS (engine) / **FAIL UI (B1)** |
| TC-08.4 | P1 | Journal page totals equal entry totals | PASS |
| TC-08.5 | P1 | Account aggregation within one document | PASS |
| TC-08.6 | P1 | A line whose account equals the settlement account | Define policy |

### TC-08.1 — Property test (automated)
- **Data:** 10,000 random documents: type ∈ {sale, purchase}; payment ∈ {Cash, Bank, Credit}; 1–20 lines; net uniform 0.01–1,000,000.00 at 2 dp; tax ∈ {VAT, None}; account from the correct COA category.
- **Expected:** For each, Σ Dr = Σ Cr (centavos). Total gross = Σ(net) + Σ(VAT per line).
- **Pass:** 0 failures; failures print the seed and document for reproduction.

### TC-08.3 — Settlement mapping table

| Document | Payment | Settlement account | Side |
|---|---|---|---|
| Sale | Cash | Cash on Hand | Dr |
| Sale | Bank | Cash in Bank | Dr |
| Sale | Credit | Accounts Receivable | Dr |
| Purchase | Cash | Cash on Hand | Cr |
| Purchase | Bank | Cash in Bank | Cr |
| Purchase | Credit | Accounts Payable | Cr |

- **Pass:** Engine and UI both produce this mapping (UI: select → saved record → JE).

### TC-08.5 — Aggregation
- **Data:** Sale with 3 lines all to Sales Revenue: 100.00 VAT, 200.00 VAT, 300.00 None.
- **Expected JE:** Dr Cash 972.00 / Cr Sales Revenue 600.00 / Cr Output VAT 72.00.

### TC-08.6 — Line account equals settlement account
- **Data:** Purchase, Credit, line account "Accounts Payable" 100.00 None.
- **Expected (policy decision):** Either rejected ("account not allowed on this document") **or** the JE nets to zero and is flagged. Must never produce one account with both Dr and Cr shown as if it were two entries without warning.

---

## 9. Trial Balance Reconciliation (TC-09)

**Initial conditions:** BASE + D1.

| ID | P | Scenario | Status |
|---|---|---|---|
| TC-09.1 | P0 | TB balances | PASS |
| TC-09.2 | P1 | TB shows net balances per account | **FAIL (B13)** |
| TC-09.3 | P0 | TB excludes VOID and DRAFT | PASS |
| TC-09.4 | P0 | TB equals sum of Journal | PASS |
| TC-09.5 | P1 | TB order and classification | **FAIL (B13)** |
| TC-09.6 | P0 | TB ↔ IS ↔ BS reconciliation | PASS on D1 / **FAIL after COA edits (B7, B9, B15)** |
| TC-09.7 | P1 | TB on-screen = CSV | PASS |
| TC-09.8 | P0 | Imbalance detection | **FAIL (B2/B3)** — imbalances are possible |

### TC-09.1 / 09.2 — Balances (to 2026-03-31)
- **Expected net-balance TB:** as in the D1 ledger table — Debit total **78,920.00** = Credit total **78,920.00**. Each account appears once, in its normal-balance column (Cash on Hand 10,080.00 Dr; Cash in Bank 17,920.00 Dr; …).
- **Optional gross-activity view:** if shown, totals 118,120.00 = 118,120.00.
- **Current:** shows gross activity (Cash on Hand Dr 11,200.00 *and* Cr 1,120.00).

### TC-09.3 — Exclusions
- **Pass:** S4 (3,360.00) and S5 (11,198.88) contribute nothing; Sales Revenue = 10,000.00 (not 13,000.00 or 19,999.00).

### TC-09.4 — Journal tie-out
- **Pass:** Σ of every Journal entry's Dr for the period = TB gross Dr (118,120.00); per-account Journal sums = TB per-account values.

### TC-09.5 — Presentation
- **Pass:** Accounts ordered Assets → Liabilities → Equity → Revenue → Expenses (COA order within each); accounts not found in the COA are listed under "Unclassified" with a warning.

### TC-09.6 — Three-way reconciliation
- **Pass:** Σ(revenue balances) − Σ(expense balances) from TB = IS Net Income (54,000.00) = BS "Current Year Net Income" (54,000.00); BS Total Assets (67,920.00) = Total L + E (67,920.00); every TB account appears in exactly one of IS or BS.

### TC-09.8 — Imbalance detection
- **Data:** Inject (via test fixture, not UI) a record that would unbalance, e.g. net 10.005.
- **Pass (target):** Cannot occur once TC-06.3/TC-07.1 pass; if a legacy record is unbalanced, TB shows "⚠ Out of balance by X.XX" and identifies the document.

---

## 10. Income Statement (TC-10)

**Initial conditions:** BASE + D1.

| ID | P | Scenario | Status |
|---|---|---|---|
| TC-10.1 | P0 | Q1 net income | PASS |
| TC-10.2 | P0 | Period filter (January) | PASS |
| TC-10.3 | P1 | Structured statement (Gross Profit etc.) | **FAIL (B16)** |
| TC-10.4 | P0 | Asset purchases excluded | PASS (IS) / **FAIL overview (B17)** |
| TC-10.5 | P0 | Accounts missing from COA | **FAIL (B15)** |
| TC-10.6 | P1 | Net loss presentation | PASS |
| TC-10.7 | P1 | Home overview = IS | **FAIL (B17)** |
| TC-10.8 | P1 | On-screen = CSV | PASS |

### TC-10.1 — Q1 2026 (2026-01-01 → 2026-03-31)

| Line | Amount |
|---|---:|
| Sales Revenue | 10,000.00 |
| Service Revenue | 50,000.00 |
| Professional Fees | 5,000.00 |
| **Total Revenue** | **65,000.00** |
| Cost of Goods Sold | (6,000.00) |
| **Gross Profit** *(target, B16)* | **59,000.00** |
| Office Supplies | (1,000.00) |
| Rent Expense | (4,000.00) |
| **Total Operating Expenses** | **(5,000.00)** |
| **Net Income** | **54,000.00** |

- **Pass:** Net Income 54,000.00; PPE (30,000.00), VAT, and the void/draft are not included.

### TC-10.2 — January 2026
- **Expected:** Revenue 60,000.00 (Sales 10,000.00 + Service 50,000.00); Expenses 7,000.00 (COGS 6,000.00 + Office 1,000.00); **Net Income 53,000.00**.

### TC-10.3 — Structure (target)
- **Pass:** Sections Revenue → Cost of Sales → Gross Profit → Operating Expenses → Operating Income → Other Income / Other Expenses → Income Before Tax → Income Tax → Net Income. Interest Income and "Other Expenses" group accounts appear in the "Other" sections.

### TC-10.5 — Account missing from COA
- **Data:** On D1, delete "Rent Expense" from COA (bypassing any block via fixture if the block is implemented).
- **Expected (target):** IS still shows Rent Expense 4,000.00 (classification stored with the line) or under "Unclassified — review", and Net Income remains 54,000.00.
- **Current:** IS Net Income becomes **58,000.00**, and the BS goes out of balance (A 67,920.00 vs L+E 71,920.00).

### TC-10.6 — Net loss
- **Data:** BASE + P3 only (Rent 4,000.00).
- **Expected:** "NET LOSS (4,000.00)"; BS Equity (4,000.00).

### TC-10.7 — Overview
- **Expected:** Home "Net Income" for all posted data = 54,000.00 on D1.
- **Current:** 24,000.00 (65,000.00 − 41,000.00, because PPE counts as a purchase expense).

---

## 11. Balance Sheet Cumulative Balances (TC-11)

**Initial conditions:** BASE + D1 unless stated.

| ID | P | Scenario | Status |
|---|---|---|---|
| TC-11.1 | P0 | BS as of 2026-03-31 | PASS |
| TC-11.2 | P0 | BS ignores "From" date (cumulative) | **FAIL (B18)** |
| TC-11.3 | P0 | BS as of end of each month | PASS (with From blank) |
| TC-11.4 | P0 | Retained earnings across fiscal years | **FAIL (B19)** |
| TC-11.5 | P0 | BS balances after COA rename of a system account | **FAIL (B7)** |
| TC-11.6 | P2 | Opening balances | **N/A (feature, B20)** |
| TC-11.7 | P2 | Owner's capital via manual journal | **N/A (feature, B20)** |
| TC-11.8 | P1 | "As of" label | **FAIL (B22)** |

### TC-11.1 — As of 2026-03-31

| Section | Account | Amount |
|---|---|---:|
| Assets | Cash on Hand | 10,080.00 |
| | Cash in Bank | 17,920.00 |
| | Accounts Receivable | 5,000.00 |
| | Input VAT | 4,920.00 |
| | Property, Plant & Equipment | 30,000.00 |
| | **Total Assets** | **67,920.00** |
| Liabilities | Accounts Payable | 6,720.00 |
| | Output VAT Payable | 7,200.00 |
| | **Total Liabilities** | **13,920.00** |
| Equity | Current Year Net Income | 54,000.00 |
| | **Total Equity** | **54,000.00** |
| | **Total L + E** | **67,920.00** ✓ |

### TC-11.2 — From date must not reduce balances
- **Data:** From 2026-02-01, To 2026-03-31.
- **Expected:** Identical to TC-11.1 (67,920.00). A BS is a point-in-time statement; "From" is ignored or hidden for BS.
- **Current:** Total Assets **1,000.00** (only Feb–Mar activity; Bank shown as (38,080.00)).

### TC-11.3 — Month-end snapshots

| As of | Total Assets | Total Liabilities | Equity (NI) | Notes |
|---|---:|---:|---:|---|
| 2026-01-31 | 66,920.00 | 13,920.00 | 53,000.00 | Cash 10,080; Bank 56,000; Input VAT 840 |
| 2026-02-28 | 67,920.00 | 13,920.00 | 54,000.00 | S5 draft excluded |
| 2026-03-31 | 67,920.00 | 13,920.00 | 54,000.00 | S4 void nets to zero |

- **Pass:** Each snapshot balances; the date 2026-01-31 is inclusive.

### TC-11.4 — Retained earnings (fiscal year = calendar year)
- **Data:** D1 + S0: Sale, 2025-12-15, Cash, Sales Revenue 2,000.00 None, POSTED.
- **Expected BS as of 2026-03-31:** Cash on Hand 12,080.00; Total Assets 69,920.00; Liabilities 13,920.00; Equity: **Retained Earnings 2,000.00** + **Current Year Net Income 54,000.00** = 56,000.00; L+E 69,920.00.
- **Expected IS for 2026 Q1:** 54,000.00 (S0 excluded). IS for FY2025: 2,000.00.
- **Current:** shows "Current Year Net Income 56,000.00"; Retained Earnings never populated.

### TC-11.5 — System account rename
- **Data:** On D1, rename "Cash on Hand" → "Petty Cash".
- **Expected:** BS shows "Petty Cash 10,080.00"; Total Assets 67,920.00; balanced.
- **Current:** Total Assets 57,840.00; out of balance by 10,080.00 (TB still shows "Cash on Hand").

### TC-11.6 — Opening balances (future)
- **Data:** Opening balance as of 2026-01-01: Cash on Hand 20,000.00; Owner's Capital 20,000.00.
- **Expected JE:** Dr Cash on Hand 20,000.00 / Cr Owner's Capital 20,000.00 (or Opening Balance Equity).
- **BS 2026-03-31 with D1:** Cash 30,080.00; Assets 87,920.00; Equity: Owner's Capital 20,000.00 + NI 54,000.00 = 74,000.00; L+E 87,920.00. **IS unchanged (54,000.00).**

### TC-11.7 — Manual JE (future)
- **Data:** 2026-03-31 Depreciation: Dr Depreciation Expense 500.00 / Cr Accumulated Depreciation 500.00.
- **Expected:** IS NI 53,500.00; BS Accumulated Depreciation (500.00) shown as contra-asset under Non-Current Assets; Total Assets 67,420.00; Equity 53,500.00; balanced.
- **Pass:** An unbalanced manual JE cannot be posted.

---

## 12. Chart of Accounts Modifications (TC-12)

**Initial conditions:** BASE + D1 posted. Record before each test: COA account count (47), number of sales (5) and purchases (4), and a hash of every posted document.

| ID | P | Action | Expected | Status |
|---|---|---|---|---|
| TC-12.1 | P0 | Rename "Sales Revenue" → "Product Sales" | IS shows "Product Sales 10,000.00"; all totals unchanged (NI 54,000.00; TB 78,920.00) | PASS (but rewrites posted records — see 12.10) |
| TC-12.2 | P0 | Rename system account "Cash on Hand" → "Petty Cash" | BS balanced, 67,920.00; future cash sales post to "Petty Cash" | **FAIL (B7)** |
| TC-12.3 | P0 | Delete "Rent Expense" (used by P3) | Blocked with message naming affected documents, or requires reassignment; reports unchanged | **FAIL (B9)** — IS NI 58,000.00; BS out by 4,000.00 |
| TC-12.4 | P0 | Delete group "Operating Expenses" (in use) | Blocked; reports unchanged | **FAIL (B9)** |
| TC-12.5 | P0 | Rename group "Other Expenses" → "Operating Expenses" (existing) | Rejected; COA still has 47 accounts | **FAIL (B8)** — one group's accounts lost |
| TC-12.6 | P0 | Add "Cash on Hand" under Liabilities | Rejected (unique across COA, case-insensitive) | **FAIL (B11)** — BS double-counts |
| TC-12.7 | P0 | Rename "Utilities Expense" → "Rent Expense" | Rejected (would merge accounts) | **FAIL (B10)** |
| TC-12.8 | P1 | Add account `Repairs "Major"` and `<b>X</b>` | Stored and displayed literally (no HTML rendering); Add button works | **FAIL (B12, B28)** |
| TC-12.9 | P1 | Add "Internet Expense" to Operating Expenses; post cash purchase 1,500.00 None | JE Dr Internet Expense 1,500.00 / Cr Cash 1,500.00; IS OpEx 6,500.00; NI 52,500.00 | PASS |
| TC-12.10 | P0 | Any rename: posted document integrity | Posted documents' stored content unchanged (account referenced by ID) **or**, if names are rewritten, only documents using that account are written | **FAIL (B10)** — all later records re-written |
| TC-12.11 | P0 | Reload after each COA change | COA, document count and report totals identical to before reload | PASS |
| TC-12.12 | P1 | Rename with leading/trailing spaces or empty name | Trimmed; empty rejected | Partial (group rename not trimmed) |
| TC-12.13 | P1 | Draft using a renamed/deleted account | Reopening shows the preserved account with a warning; cannot post until resolved | Partial (shown, but posting allowed) |

**Pass criteria for the whole group:** after every *rejected* action, COA, documents, and all report totals are byte-for-byte identical to the "before" snapshot. After every *accepted* action, TB total (78,920.00), IS NI (54,000.00), and BS totals (67,920.00) are unchanged unless the action is a new posting.

---

## 13. Voided Transactions (TC-13)

**Initial conditions:** BASE + D1 with S4 posted on 2026-03-05 (not yet voided) unless stated.

| ID | P | Scenario | Status |
|---|---|---|---|
| TC-13.1 | P0 | Void creates a reversing entry on the void date | **FAIL (B5)** |
| TC-13.2 | P0 | Reports before the void date still include the original | **FAIL (B5)** |
| TC-13.3 | P0 | Reports after the void date net to zero | PASS (by exclusion) |
| TC-13.4 | P0 | Voided document data preserved | PASS |
| TC-13.5 | P0 | Voided document is locked | PASS |
| TC-13.6 | P1 | Void excluded from Sales report, overview, chart | PASS |
| TC-13.7 | P1 | Only POSTED documents can be voided | PASS |
| TC-13.8 | P1 | Void date stored as ISO date | **FAIL** — `voidedAt` is a locale display string |
| TC-13.9 | P2 | Void of a document with collections (future) | N/A |

### TC-13.1 — Reversing entry
- **Action:** Void S4 on 2026-03-10.
- **Expected JEs:**

  | Date | Account | Debit | Credit |
  |---|---|---:|---:|
  | 2026-03-05 (original) | Cash on Hand | 3,360.00 | |
  | | Sales Revenue | | 3,000.00 |
  | | Output VAT Payable | | 360.00 |
  | 2026-03-10 (reversal) | Sales Revenue | 3,000.00 | |
  | | Output VAT Payable | 360.00 | |
  | | Cash on Hand | | 3,360.00 |

- **Totals:** each entry 3,360.00 = 3,360.00.

### TC-13.2 — Report before void date
- **Report:** BS/IS as of 2026-03-07.
- **Expected:** Includes S4: Cash on Hand 13,440.00; Sales Revenue 13,000.00; Output VAT 7,560.00; NI 57,000.00; Total Assets 71,280.00; L 14,280.00; E 57,000.00.
- **Current:** S4 has disappeared from every period (NI 54,000.00).

### TC-13.3 — After void
- **Report:** as of 2026-03-31.
- **Expected:** Identical to TC-11.1 (67,920.00 / NI 54,000.00). March IS: revenue 0.00 net (3,000.00 − 3,000.00).

### TC-13.4 — Data preservation
- **Pass:** After void and reload, S4's customer, reference, lines, amounts, `createdAt`, `postedAt`, `voidedAt` are all present and unchanged; status VOID.

### TC-13.5 — Locked
- **Pass:** No Save/Edit/Post buttons; all inputs **including description textareas** disabled (see B6 for sales).

---

## 14. Historical Reporting (TC-14)

| ID | P | Scenario | Status |
|---|---|---|---|
| TC-14.1 | P0 | Closed-period figures are stable | PASS (absent COA edits / voids) |
| TC-14.2 | P0 | COA edits do not change history | **FAIL (B7, B9)** |
| TC-14.3 | P0 | Voids do not change prior periods | **FAIL (B5)** |
| TC-14.4 | P0 | One date per document | **FAIL (B14)** |
| TC-14.5 | P0 | Date boundaries inclusive | PASS |
| TC-14.6 | P1 | Back-dated entries / period lock | Policy required |
| TC-14.7 | P0 | Backup → restore round-trip | **N/A (feature, B25)** |
| TC-14.8 | P0 | Upgrade/migration preserves legacy data | Must be tested on every release |
| TC-14.9 | P1 | Report labels | **FAIL (B22)** |
| TC-14.10 | P1 | Screen = CSV for every report | PASS (risk of drift) |

### TC-14.1 — Stability
- **Steps:** Run IS for January 2026 → record 53,000.00. Post new documents dated February/March. Re-run January.
- **Pass:** January still 53,000.00; January BS still 66,920.00.

### TC-14.2 — COA edits vs history
- **Steps:** Snapshot all reports for Jan, Feb, Q1. Apply TC-12.1, 12.2, then attempt 12.3.
- **Pass:** All snapshot totals unchanged (names may change; amounts may not).

### TC-14.4 — Document date
- **Data:** Sale S6, Cash, row A dated 2026-01-31 Sales Revenue 1,000.00 None; row B dated 2026-02-01 Sales Revenue 1,000.00 None.
- **Expected (target):** The document has one transaction date; the entire 2,000.00 lands in that period in **every** report (Journal, TB, IS, BS, Sales-by-Account, CSV, chart).
- **Current:** TB/IS/BS/Journal place 2,000.00 in January (first-row date); Sales-by-Account splits 1,000.00 / 1,000.00.

### TC-14.5 — Boundaries
- **Data:** P2 dated 2026-01-25; report From 2026-01-25 To 2026-01-25.
- **Pass:** P2 included; with To 2026-01-24, excluded.

### TC-14.6 — Back-dating policy
- **Pass (if period lock implemented):** posting a document dated in a locked period is rejected. **(If not implemented):** posting is allowed and a warning is shown that a closed report will change.

### TC-14.7 — Backup round-trip (future restore)
- **Steps:** D1 + S0; export backup; delete DB; restore.
- **Pass:** Document counts, IDs, statuses, timestamps identical; every report (TB, IS, BS for Jan/Feb/Q1/FY2025) identical to the centavo; COA and Company Profile identical. A malformed or tampered backup (e.g. a customer name containing `<img src=x onerror=…>`) is rejected or rendered inert.

### TC-14.8 — Migration of legacy data (data preservation)
- **Initial:** IndexedDB populated with records in the **current** format, including:
  - Sales saved with `paymentMethod: "Credit"` and `payment: {type:"Credit"}` (all existing sales, due to B1).
  - Purchases with `paymentMethod` only, no `payment` object.
  - Rows using an account that was later renamed/deleted.
  - A posted sale with no row dates.
- **Action:** Install the new version.
- **Pass:**
  1. Record count and IDs unchanged.
  2. Every posted document's journal entries are identical before and after the upgrade (unless the user explicitly edits it). **The upgrade must not silently reclassify existing sales from AR to Cash.**
  3. Anomalies (undated, orphan accounts) are surfaced in a "Review" list, not deleted or auto-"fixed".
  4. A backup is offered or taken automatically before migration.
  5. Reports for all periods match the pre-upgrade snapshot.

---

## 15. Cross-Cutting Data-Integrity Tests (TC-15)

| ID | P | Scenario | Pass criterion | Status |
|---|---|---|---|---|
| TC-15.1 | P0 | DB write fails during Post (simulate quota/transaction error) | UI stays DRAFT, error shown, memory equals DB | **FAIL (B4)** |
| TC-15.2 | P0 | DB fails to open | App shows blocking error/read-only mode; no data overwritten | **FAIL** |
| TC-15.3 | P1 | Two tabs open; edit in tab A | Tab B refreshes or blocks stale writes | **FAIL** |
| TC-15.4 | P0 | Stored XSS payload in customer, supplier, reference, TIN, account, group, company name | Rendered as literal text in every view; no script executes | **FAIL (B28)** |
| TC-15.5 | P1 | CSV export with party name `=1+1` / `@SUM(A1)` | Cell neutralised (prefixed `'`) | **FAIL** |
| TC-15.6 | P1 | App launched offline from home-screen icon (`./`) | App loads from cache | **FAIL (B23)** |
| TC-15.7 | P1 | Deploy new version | Installed clients receive it on next launch (or after "Update" prompt) | **FAIL (B24)** |
| TC-15.8 | P1 | Backup while offline | File download succeeds | **FAIL (B25)** |

---

## 16. Automation Strategy

### 16.1 Classification

| Level | Runs in | Tooling | Tests |
|---|---|---|---|
| **A — Node, now** | Node ≥ 18, **no browser, no dependencies** | `node:test` + `node:vm` loading `config.js` and `utils.js` with a stub `window` | TC-01…05 (JE level), TC-06.1–06.7, 06.9, TC-07.1/07.4/07.5 (JE level), TC-08.1–08.6, D1 ledger/TB totals, TC-11.1/11.3 and TC-12.2/12.3 balance checks via an independent reference ledger |
| **B — Node, after extracting pure functions** | Node, no browser | Same as A once `buildLedger`, `trialBalance`, `incomeStatement`, `balanceSheet`, `buildAccTotals`, COA operations and validation are moved out of the `main.js` closure into DOM-free functions returning data | All of TC-09, TC-10, TC-11, TC-12 (logic), TC-13 (reversal logic), TC-14.1–14.5, 14.8 (migration functions), TC-15.5 (CSV) |
| **C — Node + DOM emulation** | Node, no real browser | `jsdom` + `fake-indexeddb` (dev dependencies) loading `index.html` and all scripts | UI wiring: TC-01.4, TC-02.2 (**catches B1**), TC-07 form validation, TC-12 COA editor flows, TC-13.5 locking, TC-15.1/15.2 (inject DB errors), TC-15.4 (XSS: assert no element created from payload) |
| **D — Real browser (E2E)** | Chromium via Playwright | Playwright | TC-15.3 (multi-tab), TC-15.6/15.7 (service worker, offline), TC-15.8 and CSV/backup downloads, TC-14.7 end-to-end, visual checks |

**Important:** Level A tests the posting engine with `paymentMethod` supplied directly, so they **pass** even though B1 exists. B1 is only caught at Level C/D, where the payment select is driven through the UI. Both levels are required.

### 16.2 Recommended Level-A conventions
- Compare money as integer centavos: `const c = x => Math.round(x * 100)`.
- **Also assert that every journal line is already a whole number of centavos.** Rounding each line inside the test can hide a half-centavo error (e.g. net 10.005 rounds to 1,001 centavos and appears balanced, while the app itself stores Dr 11.21 / Cr 11.205).
- Use the D1 fixture from §0.5 as a shared JSON file.
- Build an **independent reference ledger** in the test (integer centavos) and compare the app's output to it, rather than re-using the app's own functions to compute expectations.
- Property tests use a seeded PRNG so failures are reproducible.

### 16.3 Example Level-A test (runs today, no browser)

These tests now live in the repository as `tests/engine.test.js` (see `tests/README.md`). Run them with:

```
npm install
npm test
```

They also run automatically on GitHub for every push.

Core pattern:

```js
const fs = require("fs"), vm = require("vm"), path = require("path");
function loadApp(dir) {
  const ctx = { window: {}, document: {} };
  vm.createContext(ctx);
  for (const f of ["config.js", "utils.js"])
    vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), ctx);
  return ctx.window;
}
const W = loadApp(process.env.FINMATRIX_DIR);
const c = x => Math.round(x * 100);
const je = W.generateJournalEntries(
  { paymentMethod: "Cash", rows: [{ net: 10000, tax: "VAT", account: "Sales Revenue" }] }, "sales");
// expect: Cash on Hand Dr 11,200.00 / Sales Revenue Cr 10,000.00 / Output VAT Cr 1,200.00
```

---

## 17. Acceptance Gate for Future Modifications

A modification is accepted only when:

1. All **P0** tests in the areas it touches pass, and all P0 tests across the plan pass before a release.
2. All Level-A (and, once available, Level-B) tests run green in CI or locally with `node --test`.
3. **TC-14.8 (migration)** passes against a copy of real user data for any change touching storage, COA, posting, or dates.
4. No test that previously passed now fails (regression check against the status columns above).
5. Any intentional change to expected values (e.g. choosing per-document instead of per-line VAT rounding) is recorded in this plan with an updated version number before the code change is merged.

---

## Appendix A — Current Status Summary

| Area | P0 failing today | Related findings |
|---|---|---|
| Cash / Bank sales | TC-01.1–01.4, TC-02.1–02.2 | B1 |
| VAT & rounding | TC-06.3 (P1: 06.4, 06.8) | B2, B26 |
| Invalid amounts | TC-07.1–07.6, 07.13 | B2, B3, B4 |
| Trial Balance | TC-09.8 (P1: 09.2, 09.5) | B2, B3, B13 |
| Income Statement | TC-10.5 (P1: 10.3, 10.7) | B15, B16, B17 |
| Balance Sheet | TC-11.2, 11.4, 11.5 | B7, B18, B19 |
| COA | TC-12.2–12.7, 12.10 | B7–B11 |
| Voids | TC-13.1, 13.2 | B5 |
| Historical | TC-14.2, 14.3, 14.4 | B5, B7, B9, B14 |
| Data integrity | TC-15.1, 15.2, 15.4 | B4, B28 |

Passing today: credit sales (TC-03.1–03.2), cash/credit purchases (TC-04, TC-05.1), standard VAT (TC-06.1–06.2, 06.5–06.7, 06.9), engine balancing (TC-08), and D1 baseline TB/IS/BS totals when no COA edits or "From" date are involved.

---

## Appendix B — Level-A Test Run Against Current Code (2026-11-06)

The engine tests against the audited code: **24 tests, 19 pass, 5 fail.** The 5 failures are exactly the tests marked KNOWN FAIL (in the repository they are marked `todo`, so they are reported without failing the build):

| Test | Failure | Finding |
|---|---|---|
| TC-06.3 | Net 10.005 → Sales Revenue Cr 10.005 (not whole centavos); Dr 11.21 vs Cr 11.205 | B2 |
| TC-06.4 | `calcGross` = 0.13 vs journal 0.12 for 3 × 0.04 VAT | Rounding inconsistency |
| TC-07.1 | Net −100 → Dr −112.00 vs Cr −100.00 | B3 |
| TC-11.5 / 12.2 | Renaming "Cash on Hand" → Assets 57,840.00 vs L+E 67,920.00 | B7 |
| TC-12.3 | Deleting "Rent Expense" → NI 58,000.00 instead of 54,000.00 | B9 / B15 |

When a fix lands, its KNOWN FAIL test must turn green and the "KNOWN FAIL" label must be removed.
