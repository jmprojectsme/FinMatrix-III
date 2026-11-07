// =====================================================
// tests/ui-xss.test.js — User text must never run as code (audit B28)
// Stores HTML/script-like text in every field a user can type into,
// opens every screen, and checks the text is shown literally:
// no extra HTML elements are created and no script runs.
// Also covers B12: Chart of Accounts group names containing quotes.
// =====================================================
const test = require("node:test");
const assert = require("node:assert/strict");
const { openApp, $, tap, setValue, enter, post, open } = require("./helpers/app");

// If this text were treated as HTML, it would create an <img>, a <b> and run onerror.
const EVIL = `<img src=x onerror="window.__xss=1"><b id="evil">bold</b>"'&`;

// Checks a part of the page: the evil text must not have turned into elements.
function assertInert(w, el, where) {
  assert.ok(el, `${where}: element exists`);
  assert.equal(el.querySelector("img"), null, `${where}: an <img> was created from user text`);
  assert.equal(el.querySelector("#evil"), null, `${where}: a <b> was created from user text`);
  assert.equal(w.__xss, undefined, `${where}: script ran`);
}

async function appWithEvilData() {
  const w = await openApp();
  // Company profile
  w.showPage("company-profile");
  setValue(w, $(w, "cpName"), "Co " + EVIL);
  setValue(w, $(w, "cpTin"), "TIN " + EVIL);
  tap(w, "saveCompanyProfileBtn");
  // A new Chart of Accounts group and account with dangerous names (incl. quotes)
  w.showPage("coa");
  setValue(w, $(w, "newSalesGroupName"), `Grp "${EVIL}`);
  tap(w, "addSalesGroupBtn");
  const grpInput = [...$(w, "coaSalesGroups").querySelectorAll(".new-acc-input")].pop();
  setValue(w, grpInput, "Acc " + EVIL);
  grpInput.parentElement.querySelector(".btn-add-acc").click();
  // A posted sale and purchase using that account, with dangerous names/refs/descriptions
  const sale = await enter(w, "sale", { name: "Cust " + EVIL, payment: "Cash",
    rows: [{ date: "2026-01-05", account: "Acc " + EVIL, net: "100", tax: "VAT" }] });
  w.savedSales[sale].reference = "REF " + EVIL;      // reference and TIN typed by the user
  w.savedSales[sale].tin = "TIN " + EVIL;
  w.savedSales[sale].rows[0].desc = "Desc " + EVIL;
  await w.DB.updateSale(sale);
  assert.ok(await post(w, "sale", sale));
  const pur = await enter(w, "purchase", { name: "Supp " + EVIL, payment: "Cash",
    rows: [{ date: "2026-01-06", account: "Rent Expense", net: "50", tax: "None" }] });
  assert.ok(await post(w, "purchase", pur));
  return w;
}

test("B28: customer name with HTML is shown as text in the Sales list", async () => {
  const w = await openApp();
  await enter(w, "sale", { name: "Cust " + EVIL,
    rows: [{ date: "2026-01-05", account: "Sales Revenue", net: "100", tax: "VAT" }] });
  w.showPage("revenue");
  assertInert(w, $(w, "salesListTableBody"), "Sales list");
  assert.match($(w, "salesListTableBody").textContent, /Cust <img src=x/);
});

test("B28: dangerous text is shown as plain text on every screen", async () => {
  const w = await appWithEvilData();

  w.showPage("revenue");
  assertInert(w, $(w, "salesListTableBody"), "Sales list");
  assert.match($(w, "salesListTableBody").textContent, /Cust <img src=x/, "Sales list shows the text literally");
  assert.match($(w, "salesListTableBody").textContent, /REF <img/, "reference shown literally");

  w.showPage("bills");
  assertInert(w, $(w, "purchaseListTableBody"), "Purchases list");

  w.showPage("home");
  assertInert(w, $(w, "homeRecentSales"), "Home recent sales");
  assertInert(w, $(w, "homeRecentPurchases"), "Home recent purchases");

  open(w, "sale", 0);
  assertInert(w, $(w, "salesJournalBody"), "Journal preview on the sale");
  assertInert(w, $(w, "salesTableBody"), "Sale form rows");
  assert.equal($(w, "salesTableBody").querySelector(".s-desc").value, "Desc " + EVIL, "description kept exactly");

  w.showPage("journal");
  tap(w, "runJournalBtn");
  assertInert(w, $(w, "journalOutput"), "Journal page");
  assert.match($(w, "journalOutput").textContent, /Acc <img src=x/);

  w.showPage("summary-report");
  for (const type of ["both", "trial", "is", "bs"]) {
    setValue(w, $(w, "reportType"), type);
    tap(w, "runReportBtn");
    assertInert(w, $(w, "reportOutput"), `Report "${type}"`);
  }
  assert.match($(w, "reportOutput").textContent, /Co <img src=x/, "company name shown literally on statements");

  w.showPage("coa");
  assertInert(w, $(w, "coaSalesGroups"), "Chart of Accounts");
  assert.match($(w, "coaSalesGroups").textContent, /Grp "<img src=x/);
});

test("B12: Chart of Accounts groups with quotes in the name still work", async () => {
  const w = await openApp();
  w.showPage("coa");
  setValue(w, $(w, "newPurchasesGroupName"), `Owner's "Special" Costs`);
  tap(w, "addPurchasesGroupBtn");
  const g = `Owner's "Special" Costs`;
  assert.ok(w.COA.purchases[g], "group created");
  const input = [...$(w, "coaPurchasesGroups").querySelectorAll(".new-acc-input")].pop();
  assert.equal(input.dataset.group, g, "group name stored exactly in the page");
  setValue(w, input, "Gift Expense");
  input.parentElement.querySelector(".btn-add-acc").click();   // used to crash on the quote
  assert.deepEqual([...w.COA.purchases[g]], ["Gift Expense"]);
  // pressing Enter in the box also works
  const input2 = [...$(w, "coaPurchasesGroups").querySelectorAll(".new-acc-input")].pop();
  setValue(w, input2, "Token Expense");
  input2.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter" }));
  assert.deepEqual([...w.COA.purchases[g]], ["Gift Expense", "Token Expense"]);
});

test("B28: stored data is not changed by escaping (only the display is)", async () => {
  const w = await appWithEvilData();
  assert.equal(w.savedSales[0].customer, "Cust " + EVIL);
  assert.equal(w.companyProfile.name, "Co " + EVIL);
  assert.ok(w.COA.sales[`Grp "${EVIL}`].includes("Acc " + EVIL));
});
