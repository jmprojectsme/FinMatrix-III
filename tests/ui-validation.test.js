// =====================================================
// tests/ui-validation.test.js — Input validation on the real forms (jsdom)
// Audit findings B2 (more than 2 decimals), B3 (negative amounts),
// B4 (posting empty/incomplete documents).
//
// Rules (agreed with the owner):
//  - Save (drafts): amounts must be valid numbers, not negative, max 2 decimals.
//    Drafts may be incomplete (missing date/account, empty amount).
//  - Post: at least one line; every line has date, account, amount > 0;
//    the journal entry must balance to the centavo.
// =====================================================
const test = require("node:test");
const assert = require("node:assert/strict");
const { openApp, IDBFactory, $, tap, fillNew, save, enter, post, errorsShown, KIND } = require("./helpers/app");

const good = { date: "2026-01-05", account: "Sales Revenue", tax: "VAT" };
const goodP = { date: "2026-01-08", account: "Office Supplies", tax: "VAT" };

for (const kind of ["sale", "purchase"]) {
  const k = KIND[kind];
  const line = kind === "sale" ? good : goodP;
  const T = name => `${kind === "sale" ? "Sales" : "Purchases"}: ${name}`;

  // ---------- Save checks ----------
  test(T("TC-07.1 negative amount is rejected on Save"), async () => {
    const w = await openApp();
    fillNew(w, kind, { name: "X", rows: [{ ...line, net: "-100" }] });
    assert.equal(await save(w, kind), false, "must not save");
    assert.equal(w[k.list].length, 0);
    assert.ok(errorsShown(w).includes("Amount cannot be negative"), errorsShown(w).join("|"));
  });

  test(T("TC-06.3 more than 2 decimals is rejected on Save"), async () => {
    const w = await openApp();
    fillNew(w, kind, { name: "X", rows: [{ ...line, net: "10.005" }] });
    assert.equal(await save(w, kind), false);
    assert.ok(errorsShown(w).includes("Use at most 2 decimal places"), errorsShown(w).join("|"));
  });

  test(T("valid 2-decimal amount is saved exactly"), async () => {
    const w = await openApp();
    const i = await enter(w, kind, { name: "X", rows: [{ ...line, net: "1234.56" }] });
    assert.equal(w[k.list][i].rows[0].net, 1234.56);
  });

  test(T("after fixing a bad amount, Save works"), async () => {
    const w = await openApp();
    fillNew(w, kind, { name: "X", rows: [{ ...line, net: "-5" }] });
    assert.equal(await save(w, kind), false);
    const inp = $(w, k.body).querySelector(`.${k.cls}-net`);
    inp.value = "5";
    assert.equal(await save(w, kind), true);
    assert.equal(errorsShown(w).length, 0);
  });

  test(T("incomplete draft (no account, no amount) can still be saved"), async () => {
    const w = await openApp();
    fillNew(w, kind, { name: "X", rows: [{ date: line.date, tax: "VAT" }] });
    assert.equal(await save(w, kind), true);
    assert.equal(w[k.list][0].status, "DRAFT");
  });

  // ---------- Post checks ----------
  test(T("TC-07.5 Post is blocked when a line has no account"), async () => {
    const w = await openApp();
    const i = await enter(w, kind, { name: "X", rows: [{ date: line.date, net: "100", tax: "VAT" }] });
    assert.equal(await post(w, kind, i), false);
    assert.equal(w[k.list][i].status, "DRAFT");
    assert.ok(errorsShown(w).some(e => e.includes("Line 1: account is required")), errorsShown(w).join("|"));
  });

  test(T("TC-07.6 Post is blocked when the document has no date"), async () => {
    const w = await openApp();
    const i = await enter(w, kind, { name: "X", rows: [{ account: line.account, net: "100", tax: "VAT" }] });
    assert.equal(await post(w, kind, i), false);
    assert.ok(errorsShown(w).some(e => e.includes("Date is required")), errorsShown(w).join("|"));
  });

  test(T("TC-07.2 Post is blocked when any line has a zero amount"), async () => {
    const w = await openApp();
    const i = await enter(w, kind, { name: "X", rows: [{ ...line, net: "100" }, { ...line, net: "0" }] });
    assert.equal(await post(w, kind, i), false);
    assert.ok(errorsShown(w).some(e => e.includes("Line 2: amount must be greater than 0")));
  });

  test(T("TC-07.4 Post is blocked when there are no lines"), async () => {
    const w = await openApp();
    fillNew(w, kind, { name: "X", rows: [{ ...line, net: "100" }] });
    $(w, k.body).querySelector(".btn-del").click();          // remove the only line
    assert.equal(await save(w, kind), true);
    assert.equal(await post(w, kind, 0), false);
    assert.ok(errorsShown(w).some(e => e.includes("Add at least one line")));
  });

  test(T("a complete document still posts normally"), async () => {
    const w = await openApp();
    const i = await enter(w, kind, { name: "X", payment: "Cash", rows: [{ ...line, net: "1000" }] });
    assert.equal(await post(w, kind, i), true);
    assert.equal(errorsShown(w).length, 0);
  });

  // ---------- Existing data is preserved ----------
  test(T("TC-14.8 invalid records saved by older versions are not changed"), async () => {
    const idb = new IDBFactory();
    let w = await openApp(idb);
    const nameKey = kind === "sale" ? "customer" : "supplier";
    const base = { reference: "", tin: "", paymentMethod: "Credit", createdAt: "1/1/2026", voidedAt: null };
    const oldDraft  = { ...base, [nameKey]: "Old Draft",  status: "DRAFT",  lastEditedStatus: "Draft",  postedAt: null,
                        rows: [{ ...line, desc: "", net: -100 }] };
    const oldPosted = { ...base, [nameKey]: "Old Posted", status: "POSTED", lastEditedStatus: "Posted", postedAt: "1/1/2026",
                        rows: [{ ...line, desc: "", net: 0 }] };
    const saveFn = kind === "sale" ? "saveSale" : "savePurchase";
    await w.DB[saveFn](oldDraft, null);
    await w.DB[saveFn](oldPosted, null);
    const before = JSON.stringify(w[k.list]);

    w = await openApp(idb);                                  // upgrade: reload with new code
    assert.equal(JSON.stringify(w[k.list]), before, "records unchanged after upgrade");
    assert.equal(await post(w, kind, 0), false, "invalid old draft cannot be posted");
    assert.equal(w[k.list][1].status, "POSTED", "old posted record stays posted");
    assert.equal(JSON.stringify(w[k.list]), before, "still unchanged after blocked post");
  });
}
