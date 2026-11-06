// =====================================================
// tests/helpers/app.js — open FinMatrix in a simulated browser for tests
// Uses jsdom (simulated page) + fake-indexeddb (simulated storage).
// =====================================================
const fs = require("fs"), path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");
const { IDBFactory, IDBKeyRange } = require("fake-indexeddb");

const ROOT = path.join(__dirname, "..", "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const HTML = read("index.html").replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
const SCRIPTS = ["config.js", "db.js", "utils.js", "main.js"].map(f => [f, read(f)]);

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, what, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (fn()) return; await sleep(10); }
  throw new Error("Timed out waiting for: " + what);
}

// Start the app on a given simulated IndexedDB, like opening FinMatrix on a phone.
async function openApp(idb = new IDBFactory()) {
  const dom = new JSDOM(HTML, {
    runScripts: "outside-only", pretendToBeVisual: true,
    url: "https://finmatrix.test/", virtualConsole: new VirtualConsole()
  });
  const w = dom.window;
  w.indexedDB = idb; w.IDBKeyRange = IDBKeyRange;
  w.scrollTo = () => {}; w.alert = () => {}; w.confirm = () => true;
  for (const [name, code] of SCRIPTS) w.eval(code + "\n//# sourceURL=" + name);
  w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
  // The app is ready when boot() has run (it defines showPage after the database has loaded).
  // Note: the Home page is visible from the start, so it is NOT a sign that the app is ready.
  await until(() => typeof w.showPage === "function", "app boot", 10000);
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

// Settings for the two document types (sales / purchases).
const KIND = {
  sale: { page: "revenue", list: "savedSales", name: "salesCustomer", pay: "salesPaymentMethod",
          body: "salesTableBody", listBody: "salesListTableBody", add: "addNewSaleBtn",
          addRow: "addSalesRowBtn", save: "saveSaleBtn", post: "postSaleBtn", cls: "s", type: "sales" },
  purchase: { page: "bills", list: "savedPurchases", name: "purchaseSupplier", pay: "purchasePaymentMethod",
          body: "purchaseTableBody", listBody: "purchaseListTableBody", add: "addNewPurchaseBtn",
          addRow: "addPurchaseRowBtn", save: "savePurchaseBtn", post: "postPurchaseBtn", cls: "p", type: "purchases" }
};

// Fill a new document form. rows: [{date, account, net, tax}]. Does not save.
function fillNew(w, kind, { name, payment, rows }) {
  const k = KIND[kind];
  w.showPage(k.page);
  tap(w, k.add);
  setValue(w, $(w, k.name), name);
  if (payment) setValue(w, $(w, k.pay), payment);
  rows.forEach((r, i) => {
    if (i > 0) tap(w, k.addRow);
    const tr = $(w, k.body).querySelectorAll("tr")[i];
    if (r.date !== undefined)    setValue(w, tr.querySelector(`.${k.cls}-date`), r.date);
    if (r.account !== undefined) setValue(w, tr.querySelector(".account-select"), r.account);
    if (r.net !== undefined)     setValue(w, tr.querySelector(`.${k.cls}-net`), String(r.net));
    if (r.tax !== undefined)     setValue(w, tr.querySelector(`.${k.cls}-tax`), r.tax);
  });
}

// Error messages currently shown on the form.
const errorsShown = w => [...w.document.querySelectorAll(".validation-error")].map(e => e.textContent);

// Tap Save then Confirm Save. Returns true if a new record was stored.
// A rejected Save shows its error message immediately, so no waiting is needed for that case;
// an accepted Save is given up to 3 seconds (the simulated storage can be slow on a busy machine).
async function save(w, kind) {
  const k = KIND[kind];
  const before = w[k.list].length;
  tap(w, k.save); tap(w, k.save);
  if (errorsShown(w).length) return false;
  await until(() => w[k.list].length === before + 1, "record saved");
  return true;
}

// Create and save a document; returns its index.
async function enter(w, kind, doc) {
  fillNew(w, kind, doc);
  const k = KIND[kind];
  const before = w[k.list].length;
  if (!(await save(w, kind))) throw new Error("Save was rejected");
  return before;
}

// Open a saved document from the list, as a user would.
function open(w, kind, index) {
  const k = KIND[kind];
  w.showPage(k.page);
  const name = w[k.list][index][kind === "sale" ? "customer" : "supplier"];
  [...$(w, k.listBody).querySelectorAll("tr")].find(tr => tr.textContent.includes(name)).click();
}

// Open, then tap Post twice. Returns true if the document became POSTED.
// A blocked Post shows "Cannot post: ..." immediately; a successful one is given up to 3 seconds.
async function post(w, kind, index) {
  const k = KIND[kind];
  open(w, kind, index);
  tap(w, k.post); tap(w, k.post);
  if (errorsShown(w).length) return false;
  await until(() => w[k.list][index].status === "POSTED", "posted");
  await sleep(30);                                         // let the storage write finish
  return true;
}

const journal = (w, kind, i) => Object.fromEntries(
  w.generateJournalEntries(w[KIND[kind].list][i], KIND[kind].type).map(e => [e.account, [e.debit, e.credit]]));

module.exports = { openApp, IDBFactory, $, tap, setValue, sleep, until, KIND,
                   fillNew, save, enter, open, post, errorsShown, journal };
