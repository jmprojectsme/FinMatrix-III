// =====================================================
// tests/engine.test.js — Accounting engine tests (Node only, no browser)
// Run:  npm test      (or)  node --test tests/
//
// Test IDs (TC-xx) refer to the FinMatrix Accounting & Data-Integrity Test Plan.
// Tests marked { todo: "Bn ..." } document KNOWN bugs from the technical audit.
// They run and are reported as TODO, but do not fail the build.
// When you fix a bug, remove its `todo` option so the test protects the fix.
// =====================================================

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");

const DIR = path.join(__dirname, "..");
function loadApp() {
  const ctx = { window: {}, document: {} };
  vm.createContext(ctx);
  for (const f of ["config.js", "utils.js"])
    vm.runInContext(fs.readFileSync(path.join(DIR, f), "utf8"), ctx);
  return ctx.window;
}
const W = loadApp();
const c = x => Math.round(x * 100);                       // money -> centavos
const doc = (pm, rows) => ({ paymentMethod: pm, rows });
const je = (type, pm, rows) => W.generateJournalEntries(doc(pm, rows), type);
const asMap = e => Object.fromEntries(e.map(l => [l.account, [c(l.debit), c(l.credit)]]));
const totals = e => [e.reduce((s, l) => s + c(l.debit), 0), e.reduce((s, l) => s + c(l.credit), 0)];

// ---------- TC-01 / 02 / 03 / 04 / 05 : posting at engine level ----------
test("TC-01.1 cash VAT sale", () => {
  const e = je("sales", "Cash", [{ net: 10000, tax: "VAT", account: "Sales Revenue" }]);
  assert.deepEqual(asMap(e), {
    "Cash on Hand": [1120000, 0], "Sales Revenue": [0, 1000000], "Output VAT Payable": [0, 120000] });
});
test("TC-01.3 multi-line mixed cash sale aggregates", () => {
  const e = je("sales", "Cash", [
    { net: 1000, tax: "VAT", account: "Sales Revenue" },
    { net: 500, tax: "None", account: "Service Revenue" }]);
  assert.deepEqual(asMap(e), {
    "Cash on Hand": [162000, 0], "Sales Revenue": [0, 100000],
    "Output VAT Payable": [0, 12000], "Service Revenue": [0, 50000] });
});
test("TC-02.1 bank VAT sale", () => {
  const e = je("sales", "Bank", [{ net: 50000, tax: "VAT", account: "Service Revenue" }]);
  assert.deepEqual(asMap(e), {
    "Cash in Bank": [5600000, 0], "Service Revenue": [0, 5000000], "Output VAT Payable": [0, 600000] });
});
test("TC-03.2 credit VAT sale", () => {
  const e = je("sales", "Credit", [{ net: 8000, tax: "VAT", account: "Professional Fees" }]);
  assert.deepEqual(asMap(e), {
    "Accounts Receivable": [896000, 0], "Professional Fees": [0, 800000], "Output VAT Payable": [0, 96000] });
});
test("TC-04.1 cash VAT purchase", () => {
  const e = je("purchases", "Cash", [{ net: 2500, tax: "VAT", account: "Office Supplies" }]);
  assert.deepEqual(asMap(e), {
    "Office Supplies": [250000, 0], "Input VAT": [30000, 0], "Cash on Hand": [0, 280000] });
});
test("TC-05.1 credit VAT purchase", () => {
  const e = je("purchases", "Credit", [{ net: 6000, tax: "VAT", account: "Cost of Goods Sold" }]);
  assert.deepEqual(asMap(e), {
    "Cost of Goods Sold": [600000, 0], "Input VAT": [72000, 0], "Accounts Payable": [0, 672000] });
});

// ---------- TC-06 : VAT & rounding ----------
for (const [net, vat, gross] of [[100.01, 12.00, 112.01], [10.05, 1.21, 11.26], [0.05, 0.01, 0.06],
                                 [1234567.89, 148148.15, 1382716.04]]) {
  test(`TC-06 VAT net ${net}`, () => {
    const m = asMap(je("sales", "Cash", [{ net, tax: "VAT", account: "Sales Revenue" }]));
    assert.equal(m["Cash on Hand"][0], c(gross));
    assert.equal((m["Output VAT Payable"] || [0, 0])[1], c(vat));
  });
}
test("TC-06.2c tiny VAT produces no VAT line", () => {
  const m = asMap(je("sales", "Cash", [{ net: 0.04, tax: "VAT", account: "Sales Revenue" }]));
  assert.equal(m["Output VAT Payable"], undefined);
});
test("TC-06.4 calcGross matches journal (3 x 0.04)", { todo: "Audit: calcGross does not round VAT per line" }, () => {
  const rows = [0.04, 0.04, 0.04].map(net => ({ net, tax: "VAT", account: "Sales Revenue" }));
  const [dr] = totals(je("sales", "Cash", rows));
  assert.equal(c(W.calcGross(rows)), dr);
});
// TC-06.3 (B2): amounts with more than 2 decimals are rejected before they reach the
// posting engine (policy: reject, do not auto-round). See also tests/ui-validation.test.js.
test("TC-06.3 more than 2 decimals is rejected (Save and Post)", () => {
  assert.equal(W.validateAmount("10.005").ok, false);
  assert.equal(W.validateAmount("10.005").error, "Use at most 2 decimal places");
  const errs = W.validateDocumentForPost(doc("Cash", [{ date: "2026-01-05", net: 10.005, tax: "VAT", account: "Sales Revenue" }]), "sales");
  assert.ok(errs.some(e => e.includes("at most 2 decimal places")), errs.join("|"));
});
test("TC-06.5 1000 lines x 0.10 VAT = 110.00", () => {
  const rows = Array.from({ length: 1000 }, () => ({ net: 0.10, tax: "VAT", account: "Sales Revenue" }));
  const [dr, cr] = totals(je("sales", "Cash", rows));
  assert.equal(dr, 11000); assert.equal(cr, 11000);
});
test("TC-06.7 exhaustive 0.01..100.00 balances", () => {
  for (let n = 1; n <= 10000; n++)
    for (const tax of ["VAT", "None"])
      for (const type of ["sales", "purchases"]) {
        const [dr, cr] = totals(je(type, "Cash", [{ net: n / 100, tax, account: "X" }]));
        assert.equal(dr, cr, `net ${n / 100} ${tax} ${type}`);
      }
});

// ---------- TC-07 : invalid amounts ----------
// TC-07.1 (B3): negative amounts are rejected before they reach the posting engine.
test("TC-07.1 negative amount is rejected (Save and Post)", () => {
  assert.equal(W.validateAmount("-100").error, "Amount cannot be negative");
  const errs = W.validateDocumentForPost(doc("Cash", [{ date: "2026-01-05", net: -100, tax: "VAT", account: "Sales Revenue" }]), "sales");
  assert.ok(errs.some(e => e.includes("cannot be negative")), errs.join("|"));
});

test("validateAmount: what is accepted on Save", () => {
  const ok = { "": 0, "0": 0, "100": 100, "100.5": 100.5, "100.50": 100.5, "1234.56": 1234.56,
               "10.500": 10.5, ".5": 0.5, " 25 ": 25, "999999999.99": 999999999.99 };
  for (const [raw, value] of Object.entries(ok)) {
    const r = W.validateAmount(raw);
    assert.ok(r.ok, `"${raw}" should be accepted: ${r.error}`);
    assert.equal(r.value, value, `"${raw}"`);
  }
});
test("validateAmount: what is rejected on Save", () => {
  const bad = { "-1": "Amount cannot be negative", "-0.01": "Amount cannot be negative",
                "10.005": "Use at most 2 decimal places", "0.001": "Use at most 2 decimal places",
                "abc": "Enter a valid amount", "1e3": "Enter a valid amount", "1,000": "Enter a valid amount",
                "12.3.4": "Enter a valid amount", "1000000000": "Amount is too large" };
  for (const [raw, error] of Object.entries(bad)) assert.equal(W.validateAmount(raw).error, error, `"${raw}"`);
});

test("validateDocumentForPost: complete document has no errors", () => {
  assert.deepEqual([...W.validateDocumentForPost(doc("Bank", [
    { date: "2026-01-05", net: 100, tax: "VAT", account: "Sales Revenue" },
    { date: "2026-01-05", net: 50.25, tax: "None", account: "Service Revenue" }]), "sales")], []);
});
test("validateDocumentForPost: lists every problem by line", () => {
  const errs = [...W.validateDocumentForPost(doc("Cash", [
    { date: "", net: 100, tax: "VAT", account: "Rent Expense" },
    { date: "2026-01-05", net: 0, tax: "VAT", account: "" }]), "purchases")];
  assert.deepEqual(errs, ["Line 1: date is required", "Line 2: account is required", "Line 2: amount must be greater than 0"]);
});
test("validateDocumentForPost: no lines", () => {
  assert.deepEqual([...W.validateDocumentForPost(doc("Cash", []), "sales")], ["Add at least one line before posting"]);
});

// ---------- TC-08 : property test ----------
test("TC-08.1 random documents always balance", () => {
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 5000; i++) {
    const type = rnd() < 0.5 ? "sales" : "purchases";
    const pm = ["Cash", "Bank", "Credit"][Math.floor(rnd() * 3)];
    const rows = Array.from({ length: 1 + Math.floor(rnd() * 20) }, () => ({
      net: Math.floor(1 + rnd() * 100000000) / 100, tax: rnd() < 0.5 ? "VAT" : "None",
      account: type === "sales" ? "Sales Revenue" : "Rent Expense" }));
    const [dr, cr] = totals(je(type, pm, rows));
    assert.equal(dr, cr, `seed-iteration ${i}`);
  }
});

// ---------- TC-09 / 10 / 11 : D1 via independent reference ledger ----------
const D1 = [
  ["sales", "2026-01-05", "Cash", "Sales Revenue", 10000, "VAT", "POSTED"],
  ["sales", "2026-01-20", "Bank", "Service Revenue", 50000, "VAT", "POSTED"],
  ["sales", "2026-02-10", "Credit", "Professional Fees", 5000, "None", "POSTED"],
  ["purchases", "2026-01-08", "Cash", "Office Supplies", 1000, "VAT", "POSTED"],
  ["purchases", "2026-01-25", "Credit", "Cost of Goods Sold", 6000, "VAT", "POSTED"],
  ["purchases", "2026-02-15", "Bank", "Rent Expense", 4000, "VAT", "POSTED"],
  ["purchases", "2026-02-20", "Bank", "Property, Plant & Equipment", 30000, "VAT", "POSTED"],
  ["sales", "2026-03-05", "Cash", "Sales Revenue", 3000, "VAT", "VOID"],
  ["sales", "2026-02-28", "Cash", "Sales Revenue", 9999, "VAT", "DRAFT"],
].map(([type, date, pm, account, net, tax, status]) => ({ type, status, ...doc(pm, [{ date, account, net, tax }]) }));

function statements(docs, to, coa = W.COA) {
  const L = {};
  docs.filter(d => d.status === "POSTED" && (!to || d.rows[0].date <= to)).forEach(d =>
    W.generateJournalEntries(d, d.type).forEach(l => {
      L[l.account] ??= 0; L[l.account] += c(l.debit) - c(l.credit); }));
  const cat = k => Object.values(coa[k]).flat();
  const sum = (k, sign) => Object.entries(L).filter(([a]) => cat(k).includes(a)).reduce((s, [, v]) => s + sign * v, 0);
  const rev = sum("sales", -1), exp = sum("purchases", 1);
  const A = sum("assets", 1), Li = sum("liabilities", -1), E = sum("equity", -1) + rev - exp;
  const tbDr = Object.values(L).filter(v => v > 0).reduce((s, v) => s + v, 0);
  const tbCr = -Object.values(L).filter(v => v < 0).reduce((s, v) => s + v, 0);
  return { rev, exp, ni: rev - exp, A, Li, E, tbDr, tbCr };
}
test("TC-09.1 D1 net-balance TB = 78,920.00", () => {
  const s = statements(D1, "2026-03-31");
  assert.equal(s.tbDr, 7892000); assert.equal(s.tbCr, 7892000);
});
test("TC-10.1 D1 Q1 net income = 54,000.00", () => {
  const s = statements(D1, "2026-03-31");
  assert.equal(s.rev, 6500000); assert.equal(s.exp, 1100000); assert.equal(s.ni, 5400000);
});
test("TC-11.1 D1 BS as of 2026-03-31 balances at 67,920.00", () => {
  const s = statements(D1, "2026-03-31");
  assert.equal(s.A, 6792000); assert.equal(s.Li, 1392000); assert.equal(s.E, 5400000);
});
test("TC-11.3 D1 BS as of 2026-01-31 = 66,920.00", () => {
  const s = statements(D1, "2026-01-31");
  assert.equal(s.A, 6692000); assert.equal(s.A, s.Li + s.E);
});
test("TC-11.5 / 12.2 renaming Cash on Hand keeps BS balanced", { todo: "B7: system accounts hard-coded by name" }, () => {
  const coa = JSON.parse(JSON.stringify(W.COA)); coa.assets["Current Assets"][0] = "Petty Cash";
  const s = statements(D1, "2026-03-31", coa);
  assert.equal(s.A, s.Li + s.E);
});
test("TC-12.3 deleting Rent Expense does not change NI", { todo: "B9/B15: reports classify by current COA" }, () => {
  const coa = JSON.parse(JSON.stringify(W.COA));
  coa.purchases["Operating Expenses"] = coa.purchases["Operating Expenses"].filter(a => a !== "Rent Expense");
  assert.equal(statements(D1, "2026-03-31", coa).ni, 5400000);
});
test("BASE: default COA has 47 accounts", () => {
  assert.equal(Object.values(W.COA).reduce((s, g) => s + Object.values(g).flat().length, 0), 47);
});
