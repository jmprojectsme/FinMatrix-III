# FinMatrix — Sample Transaction Test Sheet

**Version tested:** branch `claude/finmatrix-technical-audit-mrn1mm` (includes B1 fix: Sales Payment Method)
**Tester:** ______________________ **Date:** ______________ **Device / browser:** ______________________

---

## Before you start

1. Use a **fresh, empty copy** of the app (Spck preview, Incognito tab, or the private test link) — **never** the installed app that holds real records.
2. Company Profile: leave default (VAT registered).
3. How to enter each document:
   - **Sales** or **Purchases** → **+ Add New**
   - Fill Name, Payment Method, and the row (Date, Account, Net, Tax)
   - Tap **Save** → **Confirm Save**
   - Tap the document in the list → **Post** → **Confirm Post**
4. The app shows amounts without commas (e.g. `11200.00`).
5. Mark each check **✓ Pass** or **✗ Fail**. For any fail, write what you saw and take a screenshot.

---

## Part 1 — Quick test of the B1 fix (3 sales, ~5 minutes)

### 1A. Enter

| # | Customer | Payment Method | Date | Account | Net | Tax | Action |
|---|---|---|---|---|---:|---|---|
| S1 | Cust A | **Cash** | 2026-01-05 | Sales Revenue | 10000 | VAT | Post |
| S2 | Cust B | **Bank Transfer** | 2026-01-20 | Service Revenue | 50000 | VAT | Post |
| S3 | Cust C | **Credit (AR)** | 2026-02-10 | Professional Fees | 5000 | None | Post |

### 1B. Check journal entries (shown under the form after posting)

| Doc | Account | Expected Debit | Expected Credit | Actual | ✓/✗ |
|---|---|---:|---:|---|---|
| S1 | **Cash on Hand** | 11,200.00 | | | |
| | Sales Revenue | | 10,000.00 | | |
| | Output VAT Payable | | 1,200.00 | | |
| | **Total** | **11,200.00** | **11,200.00** | | |
| S2 | **Cash in Bank** | 56,000.00 | | | |
| | Service Revenue | | 50,000.00 | | |
| | Output VAT Payable | | 6,000.00 | | |
| | **Total** | **56,000.00** | **56,000.00** | | |
| S3 | **Accounts Receivable** | 5,000.00 | | | |
| | Professional Fees | | 5,000.00 | | |
| | **Total** | **5,000.00** | **5,000.00** | | |

### 1C. Check the form behaviour

| Check | Expected | Actual | ✓/✗ |
|---|---|---|---|
| Sales list "Payment" column | S1 = Cash, S2 = Bank, S3 = Credit | | |
| Reopen S1 | Dropdown shows **Cash** and is greyed out (locked) | | |
| Tap **+ Add New** | Dropdown starts at **Credit (AR)** | | |
| Close and reopen the app, open S1 | Still **Cash** | | |

### 1D. Check reports (Reports → From blank, To **2026-03-31** → Run Report)

**Balance Sheet**

| Line | Expected | Actual | ✓/✗ |
|---|---:|---|---|
| Cash on Hand | 11,200.00 | | |
| Cash in Bank | 56,000.00 | | |
| Accounts Receivable | 5,000.00 | | |
| **Total Assets** | **72,200.00** | | |
| Output VAT Payable | 7,200.00 | | |
| **Total Liabilities** | **7,200.00** | | |
| Current Year Net Income | 65,000.00 | | |
| **Total Liabilities + Equity** | **72,200.00** | | |

**Income Statement:** Total Revenue **65,000.00**, Total Expenses **0.00**, Net Income **65,000.00** ☐

**Trial Balance:** Total Debit **72,200.00** = Total Credit **72,200.00**, shows "✓ Balanced" ☐

> **Before the B1 fix**, S1 and S2 would show **Accounts Receivable** instead of Cash on Hand / Cash in Bank, and the Balance Sheet would show AR 72,200.00 with no cash at all.

---

## Part 2 — Full month-end test (9 documents, ~20 minutes)

Start from an **empty** app again (or continue after Part 1 — if you continue, skip S1–S3 below, they are the same).

### 2A. Enter

| # | Page | Name | Payment Method | Date | Account | Net | Tax | Action |
|---|---|---|---|---|---|---:|---|---|
| S1 | Sales | Cust A | Cash | 2026-01-05 | Sales Revenue | 10000 | VAT | Post |
| S2 | Sales | Cust B | Bank Transfer | 2026-01-20 | Service Revenue | 50000 | VAT | Post |
| S3 | Sales | Cust C | Credit (AR) | 2026-02-10 | Professional Fees | 5000 | None | Post |
| P1 | Purchases | Supp A | Cash | 2026-01-08 | Office Supplies | 1000 | VAT | Post |
| P2 | Purchases | Supp B | Credit (AP) | 2026-01-25 | Cost of Goods Sold | 6000 | VAT | Post |
| P3 | Purchases | Supp C | Bank Transfer | 2026-02-15 | Rent Expense | 4000 | VAT | Post |
| P4 | Purchases | Supp D | Bank Transfer | 2026-02-20 | Property, Plant & Equipment | 30000 | VAT | Post |
| S4 | Sales | Cust D | Cash | 2026-03-05 | Sales Revenue | 3000 | VAT | Post, then **Void** |
| S5 | Sales | Cust E | Cash | 2026-02-28 | Sales Revenue | 9999 | VAT | **Save only** (Draft) |

### 2B. Expected journal entries

| Doc | Debit | Amount | Credit | Amount |
|---|---|---:|---|---:|
| S1 | Cash on Hand | 11,200.00 | Sales Revenue / Output VAT | 10,000.00 / 1,200.00 |
| S2 | Cash in Bank | 56,000.00 | Service Revenue / Output VAT | 50,000.00 / 6,000.00 |
| S3 | Accounts Receivable | 5,000.00 | Professional Fees | 5,000.00 |
| P1 | Office Supplies / Input VAT | 1,000.00 / 120.00 | Cash on Hand | 1,120.00 |
| P2 | Cost of Goods Sold / Input VAT | 6,000.00 / 720.00 | Accounts Payable | 6,720.00 |
| P3 | Rent Expense / Input VAT | 4,000.00 / 480.00 | Cash in Bank | 4,480.00 |
| P4 | Property, Plant & Equipment / Input VAT | 30,000.00 / 3,600.00 | Cash in Bank | 33,600.00 |
| S4 | *(voided — must not appear in Journal or reports)* | | | |
| S5 | *(draft — must not appear in Journal or reports)* | | | |

**Journal page** (From 2026-01-01, To 2026-03-31 → Run): exactly **7 entries**, each with Debit total = Credit total. ☐

### 2C. Income Statement (From 2026-01-01, To 2026-03-31)

| Line | Expected | Actual | ✓/✗ |
|---|---:|---|---|
| Sales Revenue | 10,000.00 | | |
| Service Revenue | 50,000.00 | | |
| Professional Fees | 5,000.00 | | |
| **Total Revenue** | **65,000.00** | | |
| Cost of Goods Sold | (6,000.00) | | |
| Office Supplies | (1,000.00) | | |
| Rent Expense | (4,000.00) | | |
| **Total Expenses** | **(11,000.00)** | | |
| **NET INCOME** | **54,000.00** | | |

Must **not** include: PPE 30,000 (asset), S4 3,000 (void), S5 9,999 (draft). ☐

### 2D. Balance Sheet (From **blank**, To 2026-03-31)

| Line | Expected | Actual | ✓/✗ |
|---|---:|---|---|
| Cash on Hand | 10,080.00 | | |
| Cash in Bank | 17,920.00 | | |
| Accounts Receivable | 5,000.00 | | |
| Input VAT | 4,920.00 | | |
| Property, Plant & Equipment | 30,000.00 | | |
| **Total Assets** | **67,920.00** | | |
| Accounts Payable | 6,720.00 | | |
| Output VAT Payable | 7,200.00 | | |
| **Total Liabilities** | **13,920.00** | | |
| Current Year Net Income | 54,000.00 | | |
| **Total Liabilities + Equity** | **67,920.00** | | |

### 2E. Trial Balance (From 2026-01-01, To 2026-03-31)

The current app lists total debits and total credits per account (not the net balance — that is known bug B13).

| Account | Expected Debit | Expected Credit | Actual | ✓/✗ |
|---|---:|---:|---|---|
| Cash on Hand | 11,200.00 | 1,120.00 | | |
| Cash in Bank | 56,000.00 | 38,080.00 | | |
| Accounts Receivable | 5,000.00 | | | |
| Input VAT | 4,920.00 | | | |
| Property, Plant & Equipment | 30,000.00 | | | |
| Accounts Payable | | 6,720.00 | | |
| Output VAT Payable | | 7,200.00 | | |
| Sales Revenue | | 10,000.00 | | |
| Service Revenue | | 50,000.00 | | |
| Professional Fees | | 5,000.00 | | |
| Office Supplies | 1,000.00 | | | |
| Cost of Goods Sold | 6,000.00 | | | |
| Rent Expense | 4,000.00 | | | |
| **TOTAL** | **118,120.00** | **118,120.00** | | |

Net balances (what a proper TB will show after B13 is fixed): Debit **78,920.00** = Credit **78,920.00**.

### 2F. January-only reports (From 2026-01-01, To 2026-01-31)

| Check | Expected | Actual | ✓/✗ |
|---|---:|---|---|
| Income Statement — Total Revenue | 60,000.00 | | |
| Income Statement — Total Expenses | (7,000.00) | | |
| Income Statement — Net Income | 53,000.00 | | |
| Balance Sheet — Total Assets | 66,920.00 | | |
| Balance Sheet — Total Liabilities + Equity | 66,920.00 | | |

---

## Part 3 — Known bugs NOT fixed yet (expected to fail — record but don't worry)

These are already in the audit and will be fixed one by one. Record what you see so we can confirm each fix later.

| Check | Correct result | What the app shows today | Bug | Actual |
|---|---|---|---|---|
| Home page → Net Income (after Part 2) | 54,000.00 | 24,000.00 (counts PPE as expense) | B17 | |
| Balance Sheet with From **2026-02-01**, To 2026-03-31 | Total Assets 67,920.00 (BS is cumulative) | Total Assets 1,000.00 | B18 | |
| Report header with no dates | "Period: All → All" | "Period: — → —" | B22 | |
| Sale with Net **-100** | Rejected with an error | Accepted | B3 | |
| Sale with Net **10.005** | Rejected or rounded to 10.01 | Accepted; entry off by 0.005 | B2 | |
| Customer name `<b>Test</b>` | Shows the text `<b>Test</b>` literally | Shows **Test** in bold (HTML runs) | B28 | |

---

## Sign-off

| | Result |
|---|---|
| Part 1 — B1 fix | ☐ All pass ☐ Some fail |
| Part 2 — Month-end figures | ☐ All pass ☐ Some fail |
| Part 3 — Known bugs recorded | ☐ Done |

**Comments:** _______________________________________________________________

**Tester signature:** ______________________
