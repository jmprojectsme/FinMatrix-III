// =====================================================
// tests/ui-dates.test.js — One date per document (audit B14)
// Each sale/purchase has ONE date at the top of the form, and every report
// (Journal, Trial Balance, Income Statement, Balance Sheet, Sales/Purchases
// by Account, lists, chart) puts the whole document in that date's period.
// Documents saved by older versions (date only on the lines) use their
// first line's date, and are not changed.
// =====================================================
const test = require("node:test");
const assert = require("node:assert/strict");
const { openApp, IDBFactory, $, tap, setValue, enter, open, post } = require("./helpers/app");

// Runs a report for a period and returns its text.
function report(w, type, from, to) {
  w.showPage("summary-report");
  setValue(w, $(w, "reportFromDate"), from);
  setValue(w, $(w, "reportToDate"), to);
  setValue(w, $(w, "reportType"), type);
  tap(w, "runReportBtn");
  return $(w, "reportOutput").textContent;
}
function journalPage(w, from, to) {
  w.showPage("journal");
  setValue(w, $(w, "journalFromDate"), from);
  setValue(w, $(w, "journalToDate"), to);
  tap(w, "runJournalBtn");
  return $(w, "journalOutput").textContent;
}
const JAN = ["2026-01-01", "2026-01-31"], FEB = ["2026-02-01", "2026-02-28"];

// A two-line sale: 10,000 VAT + 5,000 non-VAT = net 15,000, VAT 1,200, gross 16,200
const twoLines = [{ account: "Sales Revenue", net: "10000", tax: "VAT" },
                  { account: "Service Revenue", net: "5000", tax: "None" }];

test("Date field: saved on the document and on every line; shown again when reopened", async () => {
  const idb = new IDBFactory();
  let w = await openApp(idb);
  const i = await enter(w, "sale", { name: "Cust", date: "2026-01-31", rows: twoLines });
  assert.equal(w.savedSales[i].date, "2026-01-31");
  assert.deepEqual([...w.savedSales[i].rows.map(r => r.date)], ["2026-01-31", "2026-01-31"]);
  open(w, "sale", i);
  assert.equal($(w, "salesDate").value, "2026-01-31");

  w = await openApp(idb);                                   // reload the app
  open(w, "sale", i);
  assert.equal($(w, "salesDate").value, "2026-01-31", "kept after reload");
  assert.equal($(w, "salesTableBody").querySelector('input[type="date"]'), null, "no date box on lines");
});

test("Date field: locked on posted documents; empty on a new document", async () => {
  const w = await openApp();
  const i = await enter(w, "purchase", { name: "Supp", date: "2026-01-08",
    rows: [{ account: "Office Supplies", net: "1000", tax: "VAT" }] });
  assert.ok(await post(w, "purchase", i));
  assert.equal($(w, "purchaseDate").disabled, true);
  tap(w, "addNewPurchaseBtn");
  assert.equal($(w, "purchaseDate").value, "");
  assert.equal($(w, "purchaseDate").disabled, false);
});

test("TC-14.4 a two-line sale lands in ONE period in every report", async () => {
  const w = await openApp();
  const i = await enter(w, "sale", { name: "Cust", payment: "Cash", date: "2026-01-31", rows: twoLines });
  assert.ok(await post(w, "sale", i));

  // January: everything
  assert.match(report(w, "is", ...JAN), /Total Revenue\s*15000\.00/);
  assert.match(report(w, "sales", ...JAN), /TOTAL\s*15000\.00\s*1200\.00\s*16200\.00/);
  assert.match(report(w, "trial", ...JAN), /TOTAL\s*16200\.00\s*16200\.00/);
  assert.match(report(w, "bs", "", "2026-01-31"), /Total Assets\s*16200\.00/);
  assert.match(journalPage(w, ...JAN), /Cust/);

  // February: nothing
  assert.match(report(w, "is", ...FEB), /Total Revenue\s*0\.00/);
  assert.match(report(w, "sales", ...FEB), /No posted transactions/);
  assert.match(report(w, "trial", ...FEB), /No posted transactions/);
  assert.match(journalPage(w, ...FEB), /No posted transactions/);
});

test("TC-14.8 older documents (dates only on lines) use the first line's date in every report, unchanged", async () => {
  const idb = new IDBFactory();
  let w = await openApp(idb);
  // Saved by the previous version: no document date; lines dated Jan 31 and Feb 1.
  const legacy = { customer: "Old Cust", reference: "", tin: "", payment: { type: "Cash" }, paymentMethod: "Cash",
    status: "POSTED", lastEditedStatus: "Posted", createdAt: "1/31/2026", postedAt: "1/31/2026", voidedAt: null,
    rows: [{ date: "2026-01-31", desc: "", account: "Sales Revenue", net: 10000, tax: "VAT" },
           { date: "2026-02-01", desc: "", account: "Service Revenue", net: 5000, tax: "None" }] };
  await w.DB.saveSale(legacy, null);
  const stored = JSON.stringify(w.savedSales[0]);

  w = await openApp(idb);                                   // upgrade: reload with new code
  // Before this change the Sales report split it 10,000 / 5,000 while the Income Statement said 15,000 / 0.
  assert.match(report(w, "is", ...JAN), /Total Revenue\s*15000\.00/);
  assert.match(report(w, "sales", ...JAN), /TOTAL\s*15000\.00\s*1200\.00\s*16200\.00/);
  assert.match(report(w, "sales", ...FEB), /No posted transactions/);
  assert.match(report(w, "is", ...FEB), /Total Revenue\s*0\.00/);

  open(w, "sale", 0);
  assert.equal($(w, "salesDate").value, "2026-01-31", "shown with its first line's date");
  assert.equal(JSON.stringify(w.savedSales[0]), stored, "stored record unchanged");
});

test("Sales list date filter and display use the document date", async () => {
  const w = await openApp();
  await enter(w, "sale", { name: "January Cust", date: "2026-01-15", rows: [{ account: "Sales Revenue", net: "100", tax: "None" }] });
  await enter(w, "sale", { name: "March Cust", date: "2026-03-15", rows: [{ account: "Sales Revenue", net: "100", tax: "None" }] });
  w.showPage("revenue");
  setValue(w, $(w, "salesFromDate"), "2026-03-01");
  setValue(w, $(w, "salesToDate"), "2026-03-31");
  tap(w, "filterSalesBtn");
  const text = $(w, "salesListTableBody").textContent;
  assert.match(text, /March Cust/);
  assert.doesNotMatch(text, /January Cust/);
});

test("Journal page lists documents in date order", async () => {
  const w = await openApp();
  for (const [name, date] of [["Third", "2026-03-01"], ["First", "2026-01-01"], ["Second", "2026-02-01"]]) {
    const i = await enter(w, "sale", { name, payment: "Cash", date, rows: [{ account: "Sales Revenue", net: "100", tax: "None" }] });
    assert.ok(await post(w, "sale", i));
  }
  const text = journalPage(w, "", "");
  assert.ok(text.indexOf("First") < text.indexOf("Second") && text.indexOf("Second") < text.indexOf("Third"), text);
});
