// =====================================================
// tests/ui-sales.test.js — Sales form tests in a simulated browser (jsdom)
// Drives the real index.html + app scripts like a user would.
// Covers audit finding B1 (Sales Payment Method was ignored) and
// data preservation for sales saved before the fix.
// =====================================================
const test = require("node:test");
const assert = require("node:assert/strict");
const { openApp, IDBFactory, $, tap, enter, open, post, journal } = require("./helpers/app");

const sale = (o) => ({ name: o.customer, payment: o.payment,
  rows: [{ date: o.date, account: o.account, net: o.net, tax: o.tax }] });

test("TC-01.1 Cash sale posts to Cash on Hand, not Accounts Receivable", async () => {
  const w = await openApp();
  const i = await enter(w, "sale", sale({ customer: "Cust A", payment: "Cash", date: "2026-01-05",
                                          account: "Sales Revenue", net: 10000, tax: "VAT" }));
  assert.ok(await post(w, "sale", i));
  assert.equal(w.savedSales[i].paymentMethod, "Cash");
  assert.deepEqual(journal(w, "sale", i), {
    "Cash on Hand": [11200, 0], "Sales Revenue": [0, 10000], "Output VAT Payable": [0, 1200] });
});

test("TC-02.1 Bank sale posts to Cash in Bank", async () => {
  const w = await openApp();
  const i = await enter(w, "sale", sale({ customer: "Cust B", payment: "Bank", date: "2026-01-20",
                                          account: "Service Revenue", net: 50000, tax: "VAT" }));
  assert.ok(await post(w, "sale", i));
  assert.deepEqual(journal(w, "sale", i), {
    "Cash in Bank": [56000, 0], "Service Revenue": [0, 50000], "Output VAT Payable": [0, 6000] });
});

test("TC-03.1 Credit sale (default) still posts to Accounts Receivable", async () => {
  const w = await openApp();
  const i = await enter(w, "sale", sale({ customer: "Cust C", date: "2026-02-10",
                                          account: "Professional Fees", net: 5000, tax: "None" }));
  assert.ok(await post(w, "sale", i));
  assert.equal(w.savedSales[i].paymentMethod, "Credit");
  assert.deepEqual(journal(w, "sale", i), { "Accounts Receivable": [5000, 0], "Professional Fees": [0, 5000] });
});

test("TC-01.4 Payment method survives reopen and app reload", async () => {
  const idb = new IDBFactory();
  let w = await openApp(idb);
  const i = await enter(w, "sale", sale({ customer: "Cust A", payment: "Cash", date: "2026-01-05",
                                          account: "Sales Revenue", net: 100, tax: "None" }));
  open(w, "sale", i);
  assert.equal($(w, "salesPaymentMethod").value, "Cash", "reopen shows Cash");

  w = await openApp(idb);                                   // reload the app
  assert.equal(w.savedSales[i].paymentMethod, "Cash", "stored after reload");
  open(w, "sale", i);
  assert.equal($(w, "salesPaymentMethod").value, "Cash", "reopen after reload shows Cash");
  assert.match($(w, "salesListTableBody").textContent, /Cash/, "list badge shows Cash");
});

test("TC-02.2 New sale form resets payment method to Credit", async () => {
  const w = await openApp();
  await enter(w, "sale", sale({ customer: "Cust B", payment: "Bank", date: "2026-01-20",
                                account: "Sales Revenue", net: 100, tax: "None" }));
  tap(w, "addNewSaleBtn");
  assert.equal($(w, "salesPaymentMethod").value, "Credit");
});

test("Posted sale: payment method dropdown is locked", async () => {
  const w = await openApp();
  const i = await enter(w, "sale", sale({ customer: "Cust A", payment: "Cash", date: "2026-01-05",
                                          account: "Sales Revenue", net: 100, tax: "None" }));
  assert.ok(await post(w, "sale", i));
  assert.equal($(w, "salesPaymentMethod").disabled, true);
});

test("TC-14.8 Sales saved before the fix are not changed", async () => {
  const idb = new IDBFactory();
  let w = await openApp(idb);
  const legacy = { customer: "Old Customer", reference: "OLD-1", tin: "", payment: { type: "Credit" },
    paymentMethod: "Credit", status: "POSTED", lastEditedStatus: "Posted", createdAt: "1/1/2026 9:00 AM",
    postedAt: "1/1/2026 9:05 AM", voidedAt: null,
    rows: [{ date: "2026-01-02", desc: "", account: "Sales Revenue", net: 1000, tax: "VAT" }] };
  await w.DB.saveSale(legacy, null);
  const stored = JSON.stringify(w.savedSales[0]);

  w = await openApp(idb);                                   // "upgrade": reload with new code
  open(w, "sale", 0);
  assert.equal($(w, "salesPaymentMethod").value, "Credit");
  assert.equal(JSON.stringify(w.savedSales[0]), stored, "record unchanged");
  assert.deepEqual(journal(w, "sale", 0), {
    "Accounts Receivable": [1120, 0], "Sales Revenue": [0, 1000], "Output VAT Payable": [0, 120] });
});
