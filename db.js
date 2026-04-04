// =====================================================
// db.js — IndexedDB Persistence
// =====================================================
const DB_NAME    = "FinMatrixDB";
const DB_VERSION = 2;
let _db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("sales"))     db.createObjectStore("sales",     { keyPath:"id", autoIncrement:true });
      if (!db.objectStoreNames.contains("purchases")) db.createObjectStore("purchases", { keyPath:"id", autoIncrement:true });
      if (!db.objectStoreNames.contains("settings"))  db.createObjectStore("settings",  { keyPath:"key" });
    };
    req.onsuccess = e => { _db = e.target.result; resolve(); };
    req.onerror   = e => reject(e.target.error);
  });
}

function getAll(store) {
  return new Promise((resolve, reject) => {
    const req = _db.transaction(store,"readonly").objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = e => reject(e.target.error);
  });
}

function putRecord(store, record) {
  return new Promise((resolve, reject) => {
    const req = _db.transaction(store,"readwrite").objectStore(store).put(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = e => reject(e.target.error);
  });
}

function getSetting(key) {
  return new Promise(resolve => {
    const req = _db.transaction("settings","readonly").objectStore("settings").get(key);
    req.onsuccess = () => resolve(req.result?.value || null);
    req.onerror   = () => resolve(null);
  });
}

window.DB = {
  init: async function () {
    await openDB();
    const sales = await getAll("sales");
    sales.sort((a,b) => a.id - b.id);
    window.savedSales = sales;
    const purchases = await getAll("purchases");
    purchases.sort((a,b) => a.id - b.id);
    window.savedPurchases = purchases;
    const coa = await getSetting("coa");
    if (coa) window.COA = coa;
    const profile = await getSetting("companyProfile");
    if (profile) window.companyProfile = profile;
  },

  saveSale: async function (sale, index) {
    const rec = { ...sale };
    if (index !== null && window.savedSales[index]?.id) rec.id = window.savedSales[index].id;
    const id = await putRecord("sales", rec);
    rec.id = id;
    if (index !== null) window.savedSales[index] = rec;
    else                window.savedSales.push(rec);
    return id;
  },
  updateSale: async function (index) {
    if (window.savedSales[index]?.id) await putRecord("sales", window.savedSales[index]);
  },

  savePurchase: async function (purchase, index) {
    const rec = { ...purchase };
    if (index !== null && window.savedPurchases[index]?.id) rec.id = window.savedPurchases[index].id;
    const id = await putRecord("purchases", rec);
    rec.id = id;
    if (index !== null) window.savedPurchases[index] = rec;
    else                window.savedPurchases.push(rec);
    return id;
  },
  updatePurchase: async function (index) {
    if (window.savedPurchases[index]?.id) await putRecord("purchases", window.savedPurchases[index]);
  },

  saveCOA: async function () {
    await putRecord("settings", { key:"coa", value:window.COA });
  },
  saveCompanyProfile: async function () {
    await putRecord("settings", { key:"companyProfile", value:window.companyProfile });
  }
};
