// =====================================================
// utils.js — Shared Helpers
// =====================================================

// B28: makes text safe to put inside HTML (customer names, accounts, references, etc.)
// so that something like "<img onerror=...>" is shown as text instead of running.
window.escapeHtml = function (value) {
  return String(value ?? "").replace(/[&<>"']/g, c =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
};

window.nowTimestamp = function () {
  const n = new Date();
  return n.toLocaleDateString() + " " + n.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
};

window.formatDate = function (s) {
  if (!s) return "—";
  const [y,m,d] = s.split("-").map(Number);
  if (!y||!m||!d) return s;
  return new Date(y, m-1, d).toLocaleDateString(undefined, { year:"numeric", month:"short", day:"numeric" });
};

window.calcGross = function (rows) {
  return (rows||[]).reduce((s,r) => {
    const net = parseFloat(r.net) || 0;
    return s + net + (r.tax === "VAT" ? net * 0.12 : 0);
  }, 0);
};

window.calcNet = function (rows) {
  return (rows||[]).reduce((s,r) => s + (parseFloat(r.net) || 0), 0);
};

// Account dropdown — shows all COA categories, natural category first
// If selected account no longer exists in COA (renamed/deleted), still shows it
window.createAccountDropdown = function (type, selected) {
  const sel = document.createElement("select");
  sel.className = "account-select";
  sel.innerHTML = `<option value="">— Account —</option>`;

  const catLabels = {
    sales:"Revenue", purchases:"Expenses",
    assets:"Assets", liabilities:"Liabilities", equity:"Equity"
  };
  const naturalFirst = type === "sales" ? "sales" : "purchases";
  const ordered = [naturalFirst, ...Object.keys(window.COA).filter(c => c !== naturalFirst)];

  let foundSelected = false;

  ordered.forEach(cat => {
    const groups = window.COA[cat] || {};
    Object.keys(groups).forEach(g => {
      const og = document.createElement("optgroup");
      og.label = `[${catLabels[cat]||cat}] ${g}`;
      groups[g].forEach(acc => {
        const o = document.createElement("option");
        o.value = acc; o.textContent = acc;
        if (acc === selected) { o.selected = true; foundSelected = true; }
        og.appendChild(o);
      });
      sel.appendChild(og);
    });
  });

  // If selected account was renamed/deleted, add it as a preserved option
  if (selected && !foundSelected) {
    const og = document.createElement("optgroup");
    og.label = "⚠ Preserved (renamed/removed from COA)";
    const o = document.createElement("option");
    o.value = selected; o.textContent = selected; o.selected = true;
    og.appendChild(o);
    sel.insertBefore(og, sel.children[1]); // insert after blank option
  }

  return sel;
};

window.showInlineError = function (input, msg, isWarn) {
  window.clearInlineError(input);
  input.classList.add(isWarn ? "input-warning" : "input-error");
  const d = document.createElement("div");
  d.className = isWarn ? "validation-warning" : "validation-error";
  d.textContent = msg;
  input.parentNode.appendChild(d);
};

window.clearInlineError = function (input) {
  if (!input) return;
  input.classList.remove("input-error","input-warning");
  input.parentNode.querySelector(".validation-error,.validation-warning")?.remove();
};

window.isDuplicateRef = function (list, ref, currentIndex) {
  if (!ref) return false;
  const lo = ref.toLowerCase();
  return list.some((x,i) => i !== currentIndex && x.reference?.toLowerCase() === lo);
};

// ── Document date (audit B14) ─────────────────────
// Each sale/purchase has ONE date that decides its period in every report.
// Documents saved before this change have no "date" field: their first line's date is used.
window.docDate = function (doc) {
  return doc?.date || doc?.rows?.[0]?.date || "";
};

// ── Validation (audit B2, B3, B4) ─────────────────
window.MAX_AMOUNT = 999999999.99;

// Checks one amount as typed in an input box (a string).
// Returns { ok, value, empty, error }. An empty box is allowed on Save (draft).
window.validateAmount = function (raw) {
  const s = String(raw ?? "").trim();
  if (s === "") return { ok:true, value:0, empty:true, error:null };
  if (s.startsWith("-")) return { ok:false, value:null, empty:false, error:"Amount cannot be negative" };
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(s)) return { ok:false, value:null, empty:false, error:"Enter a valid amount" };
  const v = Number(s);
  if (Math.abs(v*100 - Math.round(v*100)) > 1e-6)
    return { ok:false, value:null, empty:false, error:"Use at most 2 decimal places" };
  if (v > window.MAX_AMOUNT) return { ok:false, value:null, empty:false, error:"Amount is too large" };
  return { ok:true, value:Math.round(v*100)/100, empty:false, error:null };
};

// Full checks before a saved document is posted.
// Returns a list of error messages; an empty list means it can be posted.
window.validateDocumentForPost = function (doc, type) {
  const errors = [];
  const rows = doc?.rows || [];
  if (!rows.length) return ["Add at least one line before posting"];
  if (!window.docDate(doc)) errors.push("Date is required");
  rows.forEach((r, i) => {
    const n = `Line ${i+1}`;
    if (!r.account) errors.push(`${n}: account is required`);
    const net = r.net;
    if (typeof net !== "number" || !isFinite(net))      errors.push(`${n}: enter a valid amount`);
    else if (net < 0)                                   errors.push(`${n}: amount cannot be negative`);
    else if (net === 0)                                 errors.push(`${n}: amount must be greater than 0`);
    else if (Math.abs(net*100 - Math.round(net*100)) > 1e-6) errors.push(`${n}: use at most 2 decimal places`);
    else if (net > window.MAX_AMOUNT)                   errors.push(`${n}: amount is too large`);
    if (r.tax !== "VAT" && r.tax !== "None")            errors.push(`${n}: tax must be VAT or None`);
  });
  if (!errors.length) {
    // Final guard: the journal entry must balance to the centavo
    const c = x => Math.round(x * 100);
    const e = window.generateJournalEntries(doc, type);
    const dr = e.reduce((s, l) => s + c(l.debit), 0), cr = e.reduce((s, l) => s + c(l.credit), 0);
    if (dr !== cr) errors.push("Journal entry does not balance");
  }
  return errors;
};

window.statusBadge = function (s) {
  if (s === "VOID")   return `<span class="badge void">VOID</span>`;
  if (s === "POSTED") return `<span class="badge posted">POSTED</span>`;
  return `<span class="badge draft">DRAFT</span>`;
};

window.loadAuditLog = function (type) {
  const isSale  = type === "sales";
  const list    = isSale ? window.savedSales    : window.savedPurchases;
  const index   = isSale ? window.currentSaleIndex : window.currentPurchaseIndex;
  const prefix  = isSale ? "sales" : "purchase";
  const cEl     = document.getElementById(prefix + "CreatedAt");
  const pEl     = document.getElementById(prefix + "PostedAt");
  const vEl     = document.getElementById(prefix + "VoidedAt");
  const sEl     = document.getElementById(prefix + "RecordStatus");
  if (!cEl) return;
  if (index === null || !list[index]) {
    cEl.textContent = "Created: —";
    pEl?.classList.add("hidden"); vEl?.classList.add("hidden");
    if (sEl) sEl.textContent = "New Draft";
    return;
  }
  const rec = list[index];
  cEl.textContent = "Created: " + (rec.createdAt || "—");
  if (rec.postedAt) { pEl.textContent = "Posted: " + rec.postedAt; pEl.classList.remove("hidden"); }
  else pEl?.classList.add("hidden");
  if (rec.voidedAt) { vEl.textContent = "Voided: " + rec.voidedAt; vEl.classList.remove("hidden"); }
  else vEl?.classList.add("hidden");
  if (sEl) sEl.textContent = rec.lastEditedStatus || "Draft";
};

// Double-entry journal entries
// paymentInfo = { type, date, bankName, checkNo, accountName, refNo, walletName, amount }
window.generateJournalEntries = function (txn, type, paymentInfo) {
  const pm   = paymentInfo?.type || txn.paymentMethod || txn.payment?.type || "Credit";
  const map  = {};
  const add  = (acc, dr, cr) => {
    if (!map[acc]) map[acc] = { debit:0, credit:0 };
    map[acc].debit += dr; map[acc].credit += cr;
  };

  // Determine settlement account from payment type
  // Maps to actual COA account names used in Balance Sheet
  function settlementAccount(side) {
    switch(pm) {
      case "Cash":    return "Cash on Hand";
      case "Check":   return "Cash in Bank";     // Check clears through bank
      case "GCash":   return "Cash on Hand";     // GCash is treated as cash equivalent
      case "Maya":    return "Cash on Hand";     // Maya is treated as cash equivalent
      case "EWallet": return "Cash on Hand";     // E-wallets are cash equivalents
      case "Bank":    return "Cash in Bank";
      case "Credit":
      default:
        return side === "debit" ? "Accounts Receivable" : "Accounts Payable";
    }
  }

  (txn.rows || []).forEach(r => {
    const net   = parseFloat(r.net) || 0;
    const vat   = r.tax === "VAT" ? +(net * 0.12).toFixed(2) : 0;
    const gross = +(net + vat).toFixed(2);
    const acct  = r.account || (type === "sales" ? "Sales Revenue" : "Miscellaneous Expense");

    if (type === "sales") {
      // DR  settlement account  (gross — full amount received/receivable)
      // CR  revenue account     (net)
      // CR  Output VAT Payable  (vat)
      add(settlementAccount("debit"), gross, 0);
      add(acct,                       0,     net);
      if (vat > 0) add("Output VAT Payable", 0, vat);
    } else {
      // DR  expense account     (net)
      // DR  Input VAT           (vat)
      // CR  settlement account  (gross — full amount paid/payable)
      add(acct,                        net,   0);
      if (vat > 0) add("Input VAT",    vat,   0);
      add(settlementAccount("credit"), 0,     gross);
    }
  });

  return Object.entries(map).map(([account,v]) => ({
    account, debit: v.debit, credit: v.credit
  }));
};

window.renderJournalEntries = function (entries, tbody) {
  tbody.innerHTML = "";
  let totDr = 0, totCr = 0;
  entries.forEach(e => {
    totDr += e.debit; totCr += e.credit;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="${e.debit>0?"":"cr-indent"}">${window.escapeHtml(e.account)}</td>
      <td class="num">${e.debit>0?e.debit.toFixed(2):""}</td>
      <td class="num">${e.credit>0?e.credit.toFixed(2):""}</td>`;
    tbody.appendChild(tr);
  });
  const tot = document.createElement("tr");
  tot.className = "j-total";
  tot.innerHTML = `<td><strong>Total</strong></td><td class="num"><strong>${totDr.toFixed(2)}</strong></td><td class="num"><strong>${totCr.toFixed(2)}</strong></td>`;
  tbody.appendChild(tot);
};
