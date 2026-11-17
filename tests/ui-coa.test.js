// =====================================================
// tests/ui-coa.test.js — Step 6a: protect the Chart of Accounts
//  - Accounts used in any transaction cannot be deleted; they can be ARCHIVED
//    (hidden for new entries, kept in every report and in history) and restored.
//  - Unused accounts can still be deleted (nothing to lose), like Xero.
//  - Groups containing used accounts cannot be deleted (B9).
//  - No duplicate account names anywhere in the COA, no merging by rename (B10, B11).
//  - No renaming a group onto another group (B8).
//  - Renaming an account rewrites only the documents that use it (B10).
// =====================================================
const test = require("node:test");
const assert = require("node:assert/strict");
const { openApp, IDBFactory, $, tap, setValue, enter, post, open } = require("./helpers/app");

const CATS = { sales: "coaSalesGroups", purchases: "coaPurchasesGroups", assets: "coaAssetsGroups",
               liabilities: "coaLiabilitiesGroups", equity: "coaEquityGroups" };
const countAccounts = w => Object.values(w.COA).reduce((n, g) => n + Object.values(g).flat().length, 0);

// Finds an account row on the Chart of Accounts screen and taps one of its buttons.
function accountRow(w, cat, name) {
  w.showPage("coa");
  return [...$(w, CATS[cat]).querySelectorAll(".coa-acc-row")]
    .find(r => r.querySelector("span").firstChild.textContent.trim() === name);
}
function tapAccount(w, cat, name, action) {
  const btn = accountRow(w, cat, name)?.querySelector(`[data-action="${action}"]`);
  assert.ok(btn, `"${action}" button for ${name}`);
  btn.click();
}
function tapGroup(w, cat, group, action) {
  w.showPage("coa");
  const btn = [...$(w, CATS[cat]).querySelectorAll(`[data-action="${action}"]`)].find(b => b.dataset.group === group);
  assert.ok(btn, `"${action}" button for group ${group}`);
  btn.click();
}
// Captures alert() messages and answers prompt() with the given text.
function dialogs(w, promptAnswer) {
  const alerts = [];
  w.alert = m => alerts.push(String(m));
  w.prompt = () => promptAnswer;
  w.confirm = () => true;
  return alerts;
}
function incomeStatement(w) {
  w.showPage("summary-report");
  setValue(w, $(w, "reportFromDate"), ""); setValue(w, $(w, "reportToDate"), "");
  setValue(w, $(w, "reportType"), "is");
  tap(w, "runReportBtn");
  return $(w, "reportOutput").textContent;
}
async function appWithRent() {
  const w = await openApp();
  const i = await enter(w, "purchase", { name: "Metro Space Leasing", payment: "Cash", date: "2026-01-25",
    rows: [{ account: "Rent Expense", net: "12000", tax: "VAT" }] });
  assert.ok(await post(w, "purchase", i));
  return w;
}

// ---------- Delete vs Archive ----------
test("TC-12.3 a used account shows Archive (not Delete), and reports keep it", async () => {
  const w = await appWithRent();
  assert.ok(accountRow(w, "purchases", "Rent Expense").querySelector('[data-action="archive-acc"]'), "Archive offered");
  assert.equal(accountRow(w, "purchases", "Rent Expense").querySelector('[data-action="delete-acc"]'), null, "no Delete");
  assert.match(incomeStatement(w), /Rent Expense\s*\(12000\.00\)/);
});

test("Delete re-checks usage: an account used after the screen was opened is not deleted", async () => {
  const w = await openApp();
  // Chart of Accounts opened while Rent Expense is still unused: Delete is shown
  const del = accountRow(w, "purchases", "Rent Expense").querySelector('[data-action="delete-acc"]');
  assert.ok(del, "Delete shown while unused");
  // ...then Rent Expense gets used in a posted purchase
  const i = await enter(w, "purchase", { name: "Metro Space Leasing", payment: "Cash", date: "2026-01-25",
    rows: [{ account: "Rent Expense", net: "12000", tax: "VAT" }] });
  assert.ok(await post(w, "purchase", i));
  // ...and the old Delete button is tapped
  const alerts = dialogs(w);
  del.click();
  assert.match(alerts[0] || "", /Can't delete "Rent Expense": it is used in 1 transaction/);
  assert.ok(w.COA.purchases["Operating Expenses"].includes("Rent Expense"), "account kept");
  assert.match(incomeStatement(w), /Rent Expense\s*\(12000\.00\)/, "reports unchanged");
});

test("archive: hidden for new entries, kept in reports and in old documents; restore brings it back", async () => {
  const idb = new IDBFactory();
  let w = await openApp(idb);
  const i = await enter(w, "purchase", { name: "Metro Space Leasing", payment: "Cash", date: "2026-01-25",
    rows: [{ account: "Rent Expense", net: "12000", tax: "VAT" }] });
  assert.ok(await post(w, "purchase", i));
  dialogs(w);
  tapAccount(w, "purchases", "Rent Expense", "archive-acc");
  assert.match(accountRow(w, "purchases", "Rent Expense").textContent, /Archived/);

  // New purchase: Rent Expense is not offered
  w.showPage("bills"); tap(w, "addNewPurchaseBtn");
  const options = [...$(w, "purchaseTableBody").querySelectorAll(".account-select option")].map(o => o.value);
  assert.ok(!options.includes("Rent Expense"), "hidden for new entries");
  assert.ok(options.includes("Utilities Expense"), "other accounts still offered");

  // Old document still shows it; reports still include it
  open(w, "purchase", i);
  assert.equal($(w, "purchaseTableBody").querySelector(".account-select").value, "Rent Expense");
  assert.match(incomeStatement(w), /Rent Expense\s*\(12000\.00\)/);

  // Survives an app reload
  w = await openApp(idb);
  assert.ok(w.isArchivedAccount("Rent Expense"), "archive saved");
  assert.match(incomeStatement(w), /Rent Expense\s*\(12000\.00\)/);

  // Restore
  dialogs(w);
  tapAccount(w, "purchases", "Rent Expense", "restore-acc");
  assert.equal(w.isArchivedAccount("Rent Expense"), false);
  w.showPage("bills"); tap(w, "addNewPurchaseBtn");
  assert.ok([...$(w, "purchaseTableBody").querySelectorAll(".account-select option")].some(o => o.value === "Rent Expense"));
});

test("an unused account can still be deleted (nothing to lose)", async () => {
  const w = await appWithRent();
  dialogs(w);
  tapAccount(w, "purchases", "Insurance Expense", "delete-acc");
  assert.ok(!w.COA.purchases["Operating Expenses"].includes("Insurance Expense"));
  assert.equal(countAccounts(w), 46);
});

// ---------- Groups ----------
test("TC-12.4 a group with used accounts cannot be deleted", async () => {
  const w = await appWithRent();
  const alerts = dialogs(w);
  tapGroup(w, "purchases", "Operating Expenses", "delete-group");
  assert.ok(w.COA.purchases["Operating Expenses"], "group kept");
  assert.match(alerts[0] || "", /Can't delete group "Operating Expenses".*Rent Expense/s);
  assert.equal(countAccounts(w), 47);
});

test("a group with only unused accounts can be deleted", async () => {
  const w = await appWithRent();
  dialogs(w);
  tapGroup(w, "liabilities", "Non-Current Liabilities", "delete-group");
  assert.equal(w.COA.liabilities["Non-Current Liabilities"], undefined);
});

test("TC-12.5 renaming a group onto an existing group is blocked (no accounts lost)", async () => {
  const w = await openApp();
  const alerts = dialogs(w, "operating expenses");          // different capitalisation
  tapGroup(w, "purchases", "Other Expenses", "rename-group");
  assert.match(alerts[0] || "", /already exists/);
  assert.equal(countAccounts(w), 47);
  assert.equal(w.COA.purchases["Other Expenses"].length, 4);
});

test("renaming a group to a new name keeps its accounts and order", async () => {
  const w = await openApp();
  dialogs(w, "  Travel & Meals  ");
  tapGroup(w, "purchases", "Other Expenses", "rename-group");
  assert.deepEqual(Object.keys(w.COA.purchases), ["Cost of Sales", "Operating Expenses", "Travel & Meals"]);
  assert.equal(w.COA.purchases["Travel & Meals"].length, 4);
});

// ---------- Unique names ----------
test("TC-12.6 an account name cannot be added twice anywhere in the COA", async () => {
  const w = await openApp();
  const alerts = dialogs(w);
  w.showPage("coa");
  const input = [...$(w, "coaLiabilitiesGroups").querySelectorAll(".new-acc-input")][0];
  setValue(w, input, "cash on hand");                        // exists under Assets
  input.parentElement.querySelector(".btn-add-acc").click();
  assert.match(alerts[0] || "", /already exists \(Current Assets\)/);
  assert.equal(countAccounts(w), 47);
});

test("TC-12.7 renaming an account onto another account's name is blocked", async () => {
  const w = await appWithRent();
  const alerts = dialogs(w, "Rent Expense");
  tapAccount(w, "purchases", "Utilities Expense", "rename-acc");
  assert.match(alerts[0] || "", /already exists/);
  assert.ok(w.COA.purchases["Operating Expenses"].includes("Utilities Expense"));
});

test("renaming an account can change only its capitalisation", async () => {
  const w = await openApp();
  const alerts = dialogs(w, "GAS & OIL");
  tapAccount(w, "purchases", "Gas & Oil", "rename-acc");
  assert.equal(alerts.length, 0);
  assert.ok(w.COA.purchases["Other Expenses"].includes("GAS & OIL"));
});

// ---------- Rename updates only documents that use the account ----------
test("TC-12.10 rename updates only the documents that use the account; totals unchanged", async () => {
  const w = await appWithRent();
  const j = await enter(w, "purchase", { name: "Office Depot", payment: "Cash", date: "2026-01-26",
    rows: [{ account: "Office Supplies", net: "500", tax: "None" }] });
  let writes = 0;
  const orig = w.DB.updatePurchase; w.DB.updatePurchase = async i => { writes++; return orig(i); };
  dialogs(w, "Studio Rent");
  tapAccount(w, "purchases", "Rent Expense", "rename-acc");
  assert.equal(writes, 1, "only the one document that used Rent Expense was rewritten");
  assert.equal(w.savedPurchases[0].rows[0].account, "Studio Rent");
  assert.equal(w.savedPurchases[j].rows[0].account, "Office Supplies");
  assert.match(incomeStatement(w), /Studio Rent\s*\(12000\.00\)/);
});

test("renaming an archived account keeps it archived", async () => {
  const w = await appWithRent();
  dialogs(w);
  tapAccount(w, "purchases", "Rent Expense", "archive-acc");
  dialogs(w, "Old Studio Rent");
  tapAccount(w, "purchases", "Rent Expense", "rename-acc");
  assert.ok(w.isArchivedAccount("Old Studio Rent"));
  assert.equal(w.isArchivedAccount("Rent Expense"), false);
});

test("TC-14.8 older data: existing Chart of Accounts and documents load unchanged", async () => {
  const idb = new IDBFactory();
  let w = await appWithRentOn(idb);
  const before = JSON.stringify({ coa: w.COA, docs: w.savedPurchases });
  w = await openApp(idb);
  assert.equal(JSON.stringify({ coa: w.COA, docs: w.savedPurchases }), before);
  assert.deepEqual([...w.COA_META.archived], []);
});
async function appWithRentOn(idb) {
  const w = await openApp(idb);
  const i = await enter(w, "purchase", { name: "Metro Space Leasing", payment: "Cash", date: "2026-01-25",
    rows: [{ account: "Rent Expense", net: "12000", tax: "VAT" }] });
  assert.ok(await post(w, "purchase", i));
  return w;
}
