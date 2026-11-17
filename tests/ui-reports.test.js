// =====================================================
// tests/ui-reports.test.js — Step 5
//  - B18: the Balance Sheet is cumulative "as of" the To date (From is not used)
//  - B22: report labels show "All"/"Today" instead of "—" when no date is chosen
//  - Purchases payment dropdown resets to Credit on New and is locked when posted
// =====================================================
const test = require("node:test");
const assert = require("node:assert/strict");
const { openApp, $, tap, setValue, enter, post, open } = require("./helpers/app");

function report(w, type, from, to) {
  w.showPage("summary-report");
  setValue(w, $(w, "reportFromDate"), from);
  setValue(w, $(w, "reportToDate"), to);
  setValue(w, $(w, "reportType"), type);
  tap(w, "runReportBtn");
  return $(w, "reportOutput").textContent;
}

// Exports the last report as CSV and returns its text.
async function exportCsv(w) {
  let blob = null;
  w.URL.createObjectURL = b => { blob = b; return "blob:test"; };
  w.HTMLAnchorElement.prototype.click = () => {};          // don't navigate
  tap(w, "exportCsvBtn");
  assert.ok(blob, "CSV was created");
  return await new Promise((resolve, reject) => {          // jsdom's Blob has no .text()
    const r = new w.FileReader();
    r.onload = () => resolve(r.result); r.onerror = reject;
    r.readAsText(blob);
  });
}

// January: Cash sale 10,000 + VAT.  February: PPE bought by bank 30,000 + VAT; credit sale 5,000 (no VAT).
// As of Feb 28: Cash 11,200; Bank (33,600); PPE 30,000; Input VAT 3,600; AR 5,000 => Total Assets 16,200
//               Output VAT 1,200; Net income 15,000 => L + E 16,200
async function appWithJanFeb() {
  const w = await openApp();
  const docs = [
    ["sale", { name: "Jan Cash Sale", payment: "Cash", date: "2026-01-05", rows: [{ account: "Sales Revenue", net: "10000", tax: "VAT" }] }],
    ["purchase", { name: "Feb Equipment", payment: "Bank", date: "2026-02-20", rows: [{ account: "Property, Plant & Equipment", net: "30000", tax: "VAT" }] }],
    ["sale", { name: "Feb Credit Sale", payment: "Credit", date: "2026-02-10", rows: [{ account: "Professional Fees", net: "5000", tax: "None" }] }],
  ];
  for (const [kind, d] of docs) {
    const i = await enter(w, kind, d);
    assert.ok(await post(w, kind, i), `${d.name} posted`);
  }
  return w;
}

test("TC-11.2 Balance Sheet with a From date still shows all balances up to the To date", async () => {
  const w = await appWithJanFeb();
  const all = report(w, "bs", "", "2026-02-28");
  const withFrom = report(w, "bs", "2026-02-01", "2026-02-28");
  assert.match(all, /Total Assets\s*16200\.00/);
  assert.match(withFrom, /Total Assets\s*16200\.00/, "the From date must not shrink the Balance Sheet");
  assert.match(withFrom, /Cash on Hand\s*11200\.00/, "January cash is still included");
  assert.match(withFrom, /Total Liabilities \+ Equity\s*16200\.00/);
  assert.doesNotMatch(withFrom, /does not balance/);
  assert.match(withFrom, /As of: Feb 28, 2026/);
  assert.match(withFrom, /From date is not used/);
  assert.doesNotMatch(withFrom, /Period:/, "a Balance Sheet is 'as of', not a period");
});

test("TC-11.3 Balance Sheet as of month-ends", async () => {
  const w = await appWithJanFeb();
  assert.match(report(w, "bs", "", "2026-01-31"), /Total Assets\s*11200\.00/);
  assert.match(report(w, "bs", "", "2026-02-28"), /Total Assets\s*16200\.00/);
});

test("Income Statement still uses the From date (it is a period report)", async () => {
  const w = await appWithJanFeb();
  assert.match(report(w, "is", "2026-02-01", "2026-02-28"), /Total Revenue\s*5000\.00/);
  assert.match(report(w, "is", "2026-01-01", "2026-02-28"), /Total Revenue\s*15000\.00/);
});

test("B18 CSV export of the Balance Sheet matches the screen", async () => {
  const w = await appWithJanFeb();
  report(w, "bs", "2026-02-01", "2026-02-28");
  const csv = await exportCsv(w);
  assert.match(csv, /"TOTAL ASSETS","16200\.00"/, csv);
  assert.match(csv, /"TOTAL LIABILITIES \+ EQUITY","16200\.00"/);
  assert.match(csv, /BALANCED/);
});

test("B22 report labels show All / Today when no dates are chosen", async () => {
  const w = await appWithJanFeb();
  const is = report(w, "is", "", "");
  assert.match(is, /Period: All → All/);
  assert.doesNotMatch(is, /—\s*→\s*—/);
  assert.match(report(w, "bs", "", ""), /As of: Today/);
  w.showPage("journal");
  tap(w, "runJournalBtn");
  assert.match($(w, "journalOutput").textContent, /Period: All → All/);
});

test("Purchases payment dropdown resets to Credit on New and is locked when posted", async () => {
  const w = await openApp();
  const i = await enter(w, "purchase", { name: "Supp", payment: "Bank", date: "2026-01-08",
    rows: [{ account: "Office Supplies", net: "1000", tax: "VAT" }] });
  open(w, "purchase", i);
  assert.equal($(w, "purchasePaymentMethod").value, "Bank");
  tap(w, "addNewPurchaseBtn");
  assert.equal($(w, "purchasePaymentMethod").value, "Credit", "new purchase starts at Credit");
  assert.ok(await post(w, "purchase", i));
  assert.equal($(w, "purchasePaymentMethod").disabled, true, "locked when posted");
  assert.equal($(w, "purchasePaymentMethod").value, "Bank", "shows the saved method");
});
