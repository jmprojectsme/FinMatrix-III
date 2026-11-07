# FinMatrix — Sample Transaction Test Sheet

**Version tested:** branch `claude/finmatrix-technical-audit-mrn1mm` (includes B1 fix: Sales Payment Method)
**Tester:** ______________________ **Date:** ______________ **Device / browser:** ______________________

---

## Before you start

1. Use a **fresh, empty copy** of the app (Spck preview, Incognito tab, or the private test link) — **never** the installed app that holds real records.
2. Company Profile: leave default (VAT registered).
3. How to enter each document:
   - **Sales** or **Purchases** → **+ Add New**
   - Fill Date (top of the form), Name, Payment Method, and the row (Account, Net, Tax)
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

---

## Part 4 — Input validation (B2, B3, B4)

Use a fresh, empty copy. For each check, start with **+ Add New**.

| # | Do this | Expected | Actual | ✓/✗ |
|---|---|---|---|---|
| V1 | Sale, Net **-100**, tap Save | Red message under the amount: **"Amount cannot be negative"**; nothing saved | | |
| V2 | Sale, Net **10.005**, tap Save | **"Use at most 2 decimal places"**; nothing saved | | |
| V3 | Change V2's amount to **10.05**, tap Save twice | Saves normally | | |
| V4 | Purchase, Net **-50**, tap Save | **"Amount cannot be negative"**; nothing saved | | |
| V5 | Sale with date and amount but **no account**, Save, open it, tap Post | Saves as Draft; Post shows **"Cannot post: Line 1: account is required"**; stays DRAFT | | |
| V6 | Sale with account and amount but **no date**, Save, Post | **"Cannot post: Line 1: date is required"** | | |
| V7 | Sale with two lines: line 1 = 100, line 2 = **0**, Save, Post | **"Cannot post: Line 2: amount must be greater than 0"** | | |
| V8 | Sale, delete the only line (×), Save, Post | **"Cannot post: Add at least one line before posting"** | | |
| V9 | Open V5, tap **Edit**, choose an account, Save, open, Post | Posts normally | | |
| V10 | Complete Cash sale (date, account, 1000, VAT) → Save → Post | Posts normally: Dr Cash on Hand 1,120 / Cr Sales Revenue 1,000 / Cr Output VAT 120 | | |

---

## Part 5 — Security: text is never treated as code (B28, B12)

Use a fresh, empty copy. Type the text **exactly** as shown, including the `< >` and quotes.

| # | Do this | Expected | Actual | ✓/✗ |
|---|---|---|---|---|
| X1 | New sale, Customer **`<b>Test</b>`**, date, Sales Revenue, 100, VAT → Save twice | The Sales list shows **`<b>Test</b>`** exactly as typed — **not** the word "Test" in bold | | |
| X2 | Open it → Post twice | Journal preview shows normally; the customer name above still shows `<b>Test</b>` | | |
| X3 | Home page | Recent Sales shows `<b>Test</b>` as text | | |
| X4 | Journal → Run | The entry shows `<b>Test</b>` as text | | |
| X5 | Settings → Company Profile → Name **`<i>My Co</i>`** → Save; Reports → Income Statement → Run | Header shows `<i>My Co</i>` as text, not in italics | | |
| X6 | Settings → Chart of Accounts → Revenue → new group **`Owner's "Special" Fees`** → + Group | Group appears with the quotes shown correctly | | |
| X7 | In that group, type account **`Tip Income`** → Add | Account is added to that group (before the fix, Add did nothing for names with quotes) | | |
| X8 | New sale using account **Tip Income**, 100, None → Save → Post; run Trial Balance | Shows Tip Income 100.00 normally | | |

---

## Part 6 — One date per document (B14)

From this version, the **Date** is at the top of the Sales and Purchases forms (next to Customer/Supplier), not on each line.

| # | Do this | Expected | Actual | ✓/✗ |
|---|---|---|---|---|
| D1 | Sales → + Add New | A **Date** field at the top; the lines have **no** date column | | |
| D2 | Date **2026-01-31**, Customer "Two Lines", Cash. Line 1: Sales Revenue 10000 VAT. **+ Add Row**. Line 2: Service Revenue 5000 None → Save twice → open → Post twice | Journal: Dr Cash on Hand 16,200 / Cr Sales Revenue 10,000 / Cr Service Revenue 5,000 / Cr Output VAT 1,200 | | |
| D3 | Reports, From 2026-01-01 To 2026-01-31, **Income Statement** | Total Revenue **15,000.00** | | |
| D4 | Same period, **Sales Only** | TOTAL Net **15,000.00**, VAT **1,200.00**, Gross **16,200.00** | | |
| D5 | From 2026-02-01 To 2026-02-28, Income Statement and Sales Only | Revenue **0.00** / "No posted transactions" — the sale is only in January | | |
| D6 | Open the posted sale | Date shows **Jan 31, 2026** and is greyed out (locked) | | |
| D7 | New sale with **no date** → Save → open → Post | Saves as Draft; Post shows **"Cannot post: Date is required"** | | |
| D8 | Purchases → + Add New | Same **Date** field at the top | | |

---

## Sign-off

| | Result |
|---|---|
| Part 1 — B1 fix | ☐ All pass ☐ Some fail |
| Part 2 — Month-end figures | ☐ All pass ☐ Some fail |
| Part 3 — Known bugs recorded | ☐ Done |
| Part 4 — Input validation | ☐ All pass ☐ Some fail |
| Part 5 — Security (text never runs as code) | ☐ All pass ☐ Some fail |
| Part 6 — One date per document | ☐ All pass ☐ Some fail |

**Comments:** _______________________________________________________________

**Tester signature:** ______________________
