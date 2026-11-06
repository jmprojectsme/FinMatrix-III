// =====================================================
// tests/ui-sales.test.js — Sales form tests in a simulated browser (jsdom)
// Drives the real index.html + app scripts like a user would:
// fill the form, tap Save twice, open, tap Post twice, reload the app.
// Storage is a simulated IndexedDB (fake-indexeddb), fresh for each test.
//
// Covers audit finding B1 (Sales Payment Method was ignored) and
// data preservation for sales saved before the fix.
// =====================================================
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");
const { IDBFactory, IDBKeyRange } = require("fake-indexeddb");

const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const HTML = read("index.html")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, ""); // scripts are loaded manually below
const SCRIPTS = ["config.js", "db.js", "utils.js", "main.js"].map(f => [f, read(f)]);

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, what, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (fn()) return; await sleep(10); }
  throw new Error("Timed out waiting for: " + what);
}

// Start the app on a given (simulated) IndexedDB, like opening FinMatrix on a phone.
async function openApp(idb) {
  const dom = new JSDOM(HTML, {
    runScripts: "outside-only", pretendToBeVisual: true,
    url: "https://finmatrix.test/", virtualConsole: new VirtualConsole() // silence "not implemented" noise
  });
  const w = dom.window;
  w.indexedDB = idb; w.IDBKeyRange = IDBKeyRange;
  w.scrollTo = () => {}; w.alert = () => {}; w.confirm = () => true;
  for (const [name, code] of SCRIPTS) w.eval(code + "\n//# sourceURL=" + name);
  w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
  await until(() => !w.document.getElementById("home").classList.contains("hidden") &&
                    w.document.getElementById("homeSalesTotal"), "app boot");
  await sleep(20);
  return w;
}

const $ = (w, id) => w.document.getElementById(id);
const tap = (w, id) => $(w, id).click();
function setValue(w, el, value) {
  el.value = value;
  el.dispatchEvent(new w.Event("input", { bubbles: true }));
  el.dispatchEvent(new w.Event("change", { bubbles: true }));
}

// Create and save a sale through the form. Returns its index in savedSales.
async function enterSale(w, { customer, payment, date, account, net, tax }) {
  w.showPage("revenue");
  tap(w, "addNewSaleBtn");
  setValue(w, $(w, "salesCustomer"), customer);
  if (payment) setValue(w, $(w, "salesPaymentMethod"), payment);
  const row = $(w, "salesTableBody").querySelector("tr");
  setValue(w, row.querySelector(".s-date"), date);
  setValue(w, row.querySelector(".account-select"), account);
  setValue(w, row.querySelector(".s-net"), String(net));
  setValue(w, row.querySelector(".s-tax"), tax);
  const before = w.savedSales.length;
  tap(w, "saveSaleBtn"); tap(w, "saveSaleBtn");            // Save, then Confirm Save
  await until(() => w.savedSales.length === before + 1, "sale saved");
  return before;
}

async function postSale(w, index) {
  w.showPage("revenue");
  // open from the list, as a user would
  const rows = [...$(w, "salesListTableBody").querySelectorAll("tr")];
  rows.find(tr => tr.textContent.includes(w.savedSales[index].customer)).click();
  tap(w, "postSaleBtn"); tap(w, "postSaleBtn");            // Post, then Confirm Post
  await until(() => w.savedSales[index].status === "POSTED", "sale posted");
  await sleep(30);                                         // let the DB write finish
}

const journal = (w, i) => Object.fromEntries(
  w.generateJournalEntries(w.savedSales[i], "sales").map(e => [e.account, [e.debit, e.credit]]));

// ---------------------------------------------------------------
test("TC-01.1 Cash sale posts to Cash on Hand, not Accounts Receivable", async () => {
  const w = await openApp(new IDBFactory());
  const i = await enterSale(w, { customer: "Cust A", payment: "Cash", date: "2026-01-05",
                                 account: "Sales Revenue", net: 10000, tax: "VAT" });
  await postSale(w, i);
  assert.equal(w.savedSales[i].paymentMethod, "Cash");
  assert.deepEqual(journal(w, i), {
    "Cash on Hand": [11200, 0], "Sales Revenue": [0, 10000], "Output VAT Payable": [0, 1200] });
});

test("TC-02.1 Bank sale posts to Cash in Bank", async () => {
  const w = await openApp(new IDBFactory());
  const i = await enterSale(w, { customer: "Cust B", payment: "Bank", date: "2026-01-20",
                                 account: "Service Revenue", net: 50000, tax: "VAT" });
  await postSale(w, i);
  assert.deepEqual(journal(w, i), {
    "Cash in Bank": [56000, 0], "Service Revenue": [0, 50000], "Output VAT Payable": [0, 6000] });
});

test("TC-03.1 Credit sale (default) still posts to Accounts Receivable", async () => {
  const w = await openApp(new IDBFactory());
  const i = await enterSale(w, { customer: "Cust C", date: "2026-02-10",
                                 account: "Professional Fees", net: 5000, tax: "None" });
  await postSale(w, i);
  assert.equal(w.savedSales[i].paymentMethod, "Credit");
  assert.deepEqual(journal(w, i), { "Accounts Receivable": [5000, 0], "Professional Fees": [0, 5000] });
});

test("TC-01.4 Payment method survives reopen and app reload", async () => {
  const idb = new IDBFactory();
  let w = await openApp(idb);
  const i = await enterSale(w, { customer: "Cust A", payment: "Cash", date: "2026-01-05",
                                 account: "Sales Revenue", net: 100, tax: "None" });
  w.showPage("revenue");
  [...$(w, "salesListTableBody").querySelectorAll("tr")][0].click();
  assert.equal($(w, "salesPaymentMethod").value, "Cash", "reopen shows Cash");

  w = await openApp(idb);                                   // reload the app
  assert.equal(w.savedSales[i].paymentMethod, "Cash", "stored after reload");
  w.showPage("revenue");
  [...$(w, "salesListTableBody").querySelectorAll("tr")][0].click();
  assert.equal($(w, "salesPaymentMethod").value, "Cash", "reopen after reload shows Cash");
  assert.match($(w, "salesListTableBody").textContent, /Cash/, "list badge shows Cash");
});

test("TC-02.2 New sale form resets payment method to Credit", async () => {
  const w = await openApp(new IDBFactory());
  await enterSale(w, { customer: "Cust B", payment: "Bank", date: "2026-01-20",
                       account: "Sales Revenue", net: 100, tax: "None" });
  tap(w, "addNewSaleBtn");
  assert.equal($(w, "salesPaymentMethod").value, "Credit");
});

test("Posted sale: payment method dropdown is locked", async () => {
  const w = await openApp(new IDBFactory());
  const i = await enterSale(w, { customer: "Cust A", payment: "Cash", date: "2026-01-05",
                                 account: "Sales Revenue", net: 100, tax: "None" });
  await postSale(w, i);
  assert.equal($(w, "salesPaymentMethod").disabled, true);
});

test("TC-14.8 Sales saved before the fix are not changed", async () => {
  // A record exactly as the old version saved it (payment method was always Credit).
  const idb = new IDBFactory();
  let w = await openApp(idb);
  const legacy = { customer: "Old Customer", reference: "OLD-1", tin: "", payment: { type: "Credit" },
    paymentMethod: "Credit", status: "POSTED", lastEditedStatus: "Posted", createdAt: "1/1/2026 9:00 AM",
    postedAt: "1/1/2026 9:05 AM", voidedAt: null,
    rows: [{ date: "2026-01-02", desc: "", account: "Sales Revenue", net: 1000, tax: "VAT" }] };
  await w.DB.saveSale(legacy, null);
  const stored = JSON.stringify(w.savedSales[0]);

  w = await openApp(idb);                                   // "upgrade": reload with new code
  w.showPage("revenue");
  [...$(w, "salesListTableBody").querySelectorAll("tr")][0].click();
  assert.equal($(w, "salesPaymentMethod").value, "Credit");
  assert.equal(JSON.stringify(w.savedSales[0]), stored, "record unchanged");
  assert.deepEqual(journal(w, 0), {
    "Accounts Receivable": [1120, 0], "Sales Revenue": [0, 1000], "Output VAT Payable": [0, 120] });
});
