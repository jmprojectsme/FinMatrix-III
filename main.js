// =====================================================
// main.js — FinMatrix Full App
// =====================================================

window.addEventListener("DOMContentLoaded", function () {

  window.DB.init()
    .then(boot)
    .catch(err => { console.error("DB failed", err); boot(); });

  // =====================================================
  function boot() {

    let overviewChart = null;
    function nowTS()    { return window.nowTimestamp(); }
    function fmtDate(s) { return window.formatDate(s); }

    function paymentBadge(pm) {
      if (pm === "Cash") return `<span class="badge cash">Cash</span>`;
      if (pm === "Bank") return `<span class="badge bank">Bank</span>`;
      return `<span class="badge credit">Credit</span>`;
    }

    // ── Overview ─────────────────────────────────────
    window.updateOverview = function () {
      const sTotal = window.savedSales.filter(x=>x.status==="POSTED").reduce((s,x)=>s+window.calcNet(x.rows),0);
      const pTotal = window.savedPurchases.filter(x=>x.status==="POSTED").reduce((s,x)=>s+window.calcNet(x.rows),0);
      const net = sTotal - pTotal;
      document.getElementById("homeSalesTotal").textContent     = sTotal.toFixed(2);
      document.getElementById("homePurchasesTotal").textContent = pTotal.toFixed(2);
      const nEl = document.getElementById("homeNetIncome");
      nEl.textContent = net.toFixed(2);
      nEl.style.color = net >= 0 ? "#15803d" : "#b91c1c";
    };

    // ── Chart (inline Chart.js fallback) ─────────────
    function renderChart() {
      const canvas = document.getElementById("overviewChart");
      if (!canvas) return;

      if (typeof Chart === "undefined") {
        canvas.parentElement.innerHTML = `<div class="chart-offline">📶 Chart requires internet connection</div>`;
        return;
      }

      const now = new Date();
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
        months.push({
          label: d.toLocaleDateString(undefined,{month:"short",year:"2-digit"}),
          key:   `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`,
          s:0, p:0
        });
      }
      window.savedSales.filter(x=>x.status==="POSTED").forEach(x=>{
        const d=x.rows[0]?.date||""; const m=months.find(mo=>d.startsWith(mo.key)); if(m) m.s+=window.calcNet(x.rows);
      });
      window.savedPurchases.filter(x=>x.status==="POSTED").forEach(x=>{
        const d=x.rows[0]?.date||""; const m=months.find(mo=>d.startsWith(mo.key)); if(m) m.p+=window.calcNet(x.rows);
      });

      if (overviewChart) { try { overviewChart.destroy(); } catch(e){} }

      try {
        overviewChart = new Chart(canvas, {
          type:"bar",
          data:{
            labels: months.map(m=>m.label),
            datasets:[
              {label:"Sales",     data:months.map(m=>m.s), backgroundColor:"rgba(30,64,175,0.75)", borderRadius:4, borderSkipped:false},
              {label:"Purchases", data:months.map(m=>m.p), backgroundColor:"rgba(220,38,38,0.6)",  borderRadius:4, borderSkipped:false}
            ]
          },
          options:{
            responsive:true, maintainAspectRatio:false,
            plugins:{
              legend:{labels:{font:{family:"DM Sans",size:12},color:"#475569"}},
              tooltip:{callbacks:{label:ctx=>` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}`}}
            },
            scales:{
              x:{grid:{display:false},ticks:{color:"#64748b",font:{family:"DM Sans"}}},
              y:{beginAtZero:true,grid:{color:"#f1f5f9"},ticks:{color:"#64748b",font:{family:"DM Sans"},callback:v=>v.toLocaleString()}}
            }
          }
        });
      } catch(e) { console.error("Chart error:", e); }
    }

    // ── Recent Activity ───────────────────────────────
    function renderRecent() {
      window.updateOverview();
      renderChart();

      const buildList = (list, nameKey, type) =>
        [...list].map((x,i)=>({...x,_i:i}))
          .filter(x=>x.status==="POSTED")
          .slice(-5).reverse()
          .map(x=>`
            <div class="recent-item" data-type="${type}" data-index="${x._i}">
              <div>
                <div class="ri-name">${x[nameKey]}</div>
                <div class="ri-date">${fmtDate(x.rows[0]?.date||"")}</div>
              </div>
              <div class="ri-amount">${window.calcGross(x.rows).toFixed(2)}</div>
            </div>`).join("") || `<div class="recent-empty">No posted records yet.</div>`;

      document.getElementById("homeRecentSales").innerHTML     = buildList(window.savedSales,     "customer","sale");
      document.getElementById("homeRecentPurchases").innerHTML = buildList(window.savedPurchases, "supplier","purchase");

      document.querySelectorAll(".recent-item").forEach(el => {
        el.onclick = () => {
          if (el.dataset.type==="sale") { showPage("revenue"); openSale(+el.dataset.index); }
          else                          { showPage("bills");   openPurchase(+el.dataset.index); }
        };
      });
    }

    // ── Routing ───────────────────────────────────────
    function showPage(id) {
      document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
      document.getElementById(id)?.classList.remove("hidden");
      document.querySelectorAll(".nav-link").forEach(a=>
        a.classList.toggle("active", a.getAttribute("href")==="#"+id)
      );
      if (id==="home")           renderRecent();
      if (id==="revenue")        { showSalesList(); renderSalesList(); }
      if (id==="bills")          { showPurchaseList(); renderPurchaseList(); }
      if (id==="coa")            renderCOA();
      if (id==="company-profile") renderCompanyProfile();
      if (id==="about")          renderAbout();
      if (id==="tutorial")       renderTutorial();
    }
    window.showPage = showPage;

    document.querySelectorAll(".nav-link").forEach(a =>
      a.addEventListener("click", e => {
        e.preventDefault();
        document.getElementById("settingsDropdown")?.classList.add("hidden");
        showPage(a.getAttribute("href").substring(1));
      })
    );

    // Settings dropdown
    document.getElementById("settingsBtn").onclick = e => {
      e.stopPropagation();
      document.getElementById("settingsDropdown").classList.toggle("hidden");
    };
    document.addEventListener("click", () =>
      document.getElementById("settingsDropdown")?.classList.add("hidden")
    );

    // ══════════════════════════════════════════════════
    // SALES MODULE
    // ══════════════════════════════════════════════════
    const salesBody = document.getElementById("salesTableBody");

    function showSalesList() {
      document.getElementById("salesFormView").classList.add("hidden");
      document.getElementById("salesListView").classList.remove("hidden");
    }
    function showSalesForm() {
      document.getElementById("salesListView").classList.add("hidden");
      document.getElementById("salesFormView").classList.remove("hidden");
      window.scrollTo({top:0,behavior:"smooth"});
    }
    function setSalesStatus(s) {
      const el = document.getElementById("salesStatus");
      el.textContent=s; el.className="txn-status "+s.toLowerCase();
    }
    function lockSalesForm(lock) {
      ["salesCustomer","salesTin","salesReference","salesPaymentMethod"].forEach(id=>{
        const el=document.getElementById(id); if(el) el.disabled=lock;
      });
      salesBody.querySelectorAll("input,select").forEach(el=>el.disabled=lock);
      salesBody.querySelectorAll(".btn-del").forEach(b=>b.disabled=lock);
      const addBtn=document.getElementById("addSalesRowBtn");
      addBtn.disabled=lock; addBtn.classList.toggle("hidden",lock);
    }
    function toggleSaleBtns(state) {
      document.getElementById("saveSaleBtn").classList.toggle("hidden", state==="posted"||state==="void");
      document.getElementById("editSaleBtn").classList.toggle("hidden", state!=="saved");
      document.getElementById("postSaleBtn").classList.toggle("hidden", state!=="saved");
      document.getElementById("voidSaleBtn").classList.toggle("hidden", state!=="posted");
    }
    function addSalesRow(data) {
      data=data||{};
      const tr=document.createElement("tr");
      const acc=window.createAccountDropdown("sales",data.account||"");
      tr.innerHTML=`
        <td><input type="date" class="s-date" value="${data.date||""}"></td>
        <td><textarea class="s-desc row-textarea" rows="1" placeholder="Description">${(data.desc||"").replace(/</g,"&lt;")}</textarea></td>
        <td class="acc-cell"></td>
        <td><input type="number" class="s-net" min="0" step="0.01" value="${data.net||""}"></td>
        <td class="s-vat num">0.00</td>
        <td><select class="s-tax"><option value="VAT">VAT</option><option value="None">None</option></select></td>
        <td><button type="button" class="btn-del" title="Remove">×</button></td>`;
      tr.querySelector(".acc-cell").appendChild(acc);
      tr.querySelector(".s-tax").value=data.tax||"VAT";
      // Auto-expand textarea
      const ta=tr.querySelector(".s-desc");
      ta.addEventListener("input",()=>{ ta.style.height="auto"; ta.style.height=ta.scrollHeight+"px"; calcSalesTotals(); });
      if(data.desc){ setTimeout(()=>{ ta.style.height="auto"; ta.style.height=ta.scrollHeight+"px"; },0); }
      tr.querySelector(".btn-del").onclick=()=>{ tr.remove(); calcSalesTotals(); };
      tr.querySelectorAll("input,select").forEach(el=>el.addEventListener("input",calcSalesTotals));
      salesBody.appendChild(tr);
      calcSalesTotals();
    }
    function calcSalesTotals() {
      let net=0,vat=0,ex=0;
      salesBody.querySelectorAll("tr").forEach(r=>{
        const n=parseFloat(r.querySelector(".s-net").value)||0;
        const t=r.querySelector(".s-tax").value;
        const v=t==="VAT"?+(n*0.12).toFixed(2):0;
        r.querySelector(".s-vat").textContent=v.toFixed(2);
        if(t==="VAT"){net+=n;vat+=v;}else{ex+=n;}
      });
      const grand=net+vat+ex;
      document.getElementById("salesTotal").textContent        =grand.toFixed(2);
      document.getElementById("salesSummaryNet").textContent   =net.toFixed(2);
      document.getElementById("salesSummaryVat").textContent   =vat.toFixed(2);
      document.getElementById("salesSummaryExempt").textContent=ex.toFixed(2);
      document.getElementById("salesSummaryGrand").textContent =grand.toFixed(2);
    }
    function resetSaleForm(withRow) {
      salesBody.innerHTML="";
      ["salesCustomer","salesTin","salesReference"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
      const pm=document.getElementById("salesPaymentMethod"); if(pm) pm.value="Credit";
      ["salesCustomer","salesReference"].forEach(id=>window.clearInlineError(document.getElementById(id)));
      [["saveSaleBtn","Save"],["postSaleBtn","Post"],["voidSaleBtn","Void"]].forEach(([id,lbl])=>{
        const b=document.getElementById(id); if(b){b.dataset.confirmed="";b.textContent=lbl;}
      });
      document.getElementById("salesJournalPreview").classList.add("hidden");
      if(withRow) addSalesRow();
      calcSalesTotals();
    }
    function showSaleJournal(txn) {
      if(!txn||txn.status==="DRAFT"){document.getElementById("salesJournalPreview").classList.add("hidden");return;}
      window.renderJournalEntries(window.generateJournalEntries(txn,"sales",txn.paymentMethod||"Credit"),document.getElementById("salesJournalBody"));
      document.getElementById("salesJournalPreview").classList.remove("hidden");
    }
    function renderSalesList() {
      const from=document.getElementById("salesFromDate").value;
      const to=document.getElementById("salesToDate").value;
      const search=document.getElementById("salesSearch").value.toLowerCase().trim();
      const tbody=document.getElementById("salesListTableBody");
      tbody.innerHTML="";
      const list=window.savedSales.filter(s=>{
        const d=s.rows[0]?.date||"";
        if(from&&d<from) return false; if(to&&d>to) return false;
        if(search&&!s.customer.toLowerCase().includes(search)&&!(s.reference||"").toLowerCase().includes(search)&&!(s.tin||"").toLowerCase().includes(search)) return false;
        return true;
      });
      if(!list.length){tbody.innerHTML=`<tr class="no-hover"><td colspan="7" class="empty-state">No sales found.</td></tr>`;return;}
      [...list].reverse().forEach(s=>{
        const i=window.savedSales.indexOf(s);
        const tr=document.createElement("tr");
        tr.innerHTML=`<td>${fmtDate(s.rows[0]?.date||"")}</td><td>${s.customer}</td><td>${s.tin||"—"}</td><td>${s.reference||"—"}</td><td>${paymentBadge(s.paymentMethod||"Credit")}</td><td class="amount-cell">${window.calcGross(s.rows).toFixed(2)}</td><td>${window.statusBadge(s.status)}</td>`;
        tr.onclick=()=>openSale(i);
        tbody.appendChild(tr);
      });
    }
    function openSale(i) {
      const s=window.savedSales[i]; window.currentSaleIndex=i;
      resetSaleForm(false);
      document.getElementById("salesCustomer").value =s.customer;
      document.getElementById("salesTin").value      =s.tin||"";
      document.getElementById("salesReference").value=s.reference||"";
      const pm=document.getElementById("salesPaymentMethod"); if(pm) pm.value=s.paymentMethod||"Credit";
      s.rows.forEach(r=>addSalesRow(r));
      setSalesStatus(s.status);
      lockSalesForm(s.status!=="DRAFT");
      toggleSaleBtns(s.status==="DRAFT"?"saved":s.status.toLowerCase());
      window.loadAuditLog("sales"); showSaleJournal(s); showSalesForm();
    }

    document.getElementById("addNewSaleBtn").onclick=()=>{
      window.currentSaleIndex=null; resetSaleForm(true); setSalesStatus("DRAFT");
      lockSalesForm(false); toggleSaleBtns("new"); window.loadAuditLog("sales"); showSalesForm();
    };
    document.getElementById("addSalesRowBtn").onclick =()=>addSalesRow();
    document.getElementById("editSaleBtn").onclick    =()=>{lockSalesForm(false);toggleSaleBtns("saved");};
    document.getElementById("cancelSaleBtn").onclick  =()=>{resetSaleForm(false);showSalesList();};
    document.getElementById("filterSalesBtn").onclick =renderSalesList;
    document.getElementById("salesSearch").oninput    =renderSalesList;
    document.getElementById("clearSalesSearch").onclick=()=>{
      document.getElementById("salesSearch").value="";
      document.getElementById("salesFromDate").value="";
      document.getElementById("salesToDate").value="";
      renderSalesList();
    };

    document.getElementById("saveSaleBtn").onclick=function(){
      const cEl=document.getElementById("salesCustomer");
      const rEl=document.getElementById("salesReference");
      const customer=cEl.value.trim(); const reference=rEl.value.trim();
      window.clearInlineError(cEl); window.clearInlineError(rEl);
      if(!customer){window.showInlineError(cEl,"Customer name is required");return;}
      if(reference&&window.isDuplicateRef(window.savedSales,reference,window.currentSaleIndex)){window.showInlineError(rEl,"Reference already exists");return;}
      if(!this.dataset.confirmed){window.showInlineError(cEl,"Tap Save again to confirm",true);this.dataset.confirmed="true";this.textContent="Confirm Save";return;}
      this.dataset.confirmed="";this.textContent="Save";
      const existing=window.currentSaleIndex!==null?window.savedSales[window.currentSaleIndex]:null;
      const sale={
        customer,reference,
        tin:document.getElementById("salesTin").value.trim(),
        paymentMethod:document.getElementById("salesPaymentMethod").value,
        status:"DRAFT",lastEditedStatus:"Draft",
        createdAt:existing?.createdAt||nowTS(),
        postedAt:existing?.postedAt||null,
        voidedAt:existing?.voidedAt||null,
        rows:[...salesBody.children].map(r=>({
          date:r.querySelector(".s-date").value,
          desc:r.querySelector(".s-desc").value,
          account:r.querySelector(".account-select").value,
          net:parseFloat(r.querySelector(".s-net").value)||0,
          tax:r.querySelector(".s-tax").value
        }))
      };
      window.DB.saveSale(sale,window.currentSaleIndex).then(()=>{
        if(window.currentSaleIndex===null) window.currentSaleIndex=window.savedSales.length-1;
        renderSalesList(); window.updateOverview(); showSalesList();
      });
    };

    document.getElementById("postSaleBtn").onclick=function(){
      if(window.currentSaleIndex===null) return;
      const cEl=document.getElementById("salesCustomer");
      if(!this.dataset.confirmed){window.showInlineError(cEl,"Tap Post again to finalize",true);this.dataset.confirmed="true";this.textContent="Confirm Post";return;}
      this.dataset.confirmed="";this.textContent="Post";
      const rec=window.savedSales[window.currentSaleIndex];
      rec.status="POSTED";rec.lastEditedStatus="Posted";rec.postedAt=rec.postedAt||nowTS();
      window.DB.updateSale(window.currentSaleIndex);
      window.loadAuditLog("sales");setSalesStatus("POSTED");lockSalesForm(true);toggleSaleBtns("posted");showSaleJournal(rec);window.updateOverview();
    };

    document.getElementById("voidSaleBtn").onclick=function(){
      if(window.currentSaleIndex===null) return;
      const cEl=document.getElementById("salesCustomer");
      if(!this.dataset.confirmed){window.showInlineError(cEl,"Tap Void again to confirm",true);this.dataset.confirmed="true";this.textContent="Confirm Void";return;}
      this.dataset.confirmed="";this.textContent="Void";
      const rec=window.savedSales[window.currentSaleIndex];
      rec.status="VOID";rec.lastEditedStatus="Voided";rec.voidedAt=rec.voidedAt||nowTS();
      window.DB.updateSale(window.currentSaleIndex);
      window.loadAuditLog("sales");setSalesStatus("VOID");lockSalesForm(true);toggleSaleBtns("void");
      document.getElementById("salesJournalPreview").classList.add("hidden");window.updateOverview();
    };

    // ══════════════════════════════════════════════════
    // PURCHASES MODULE
    // ══════════════════════════════════════════════════
    const purchaseBody=document.getElementById("purchaseTableBody");

    function showPurchaseList(){document.getElementById("purchaseFormView").classList.add("hidden");document.getElementById("purchaseListView").classList.remove("hidden");}
    function showPurchaseForm(){document.getElementById("purchaseListView").classList.add("hidden");document.getElementById("purchaseFormView").classList.remove("hidden");window.scrollTo({top:0,behavior:"smooth"});}
    function setPurchaseStatus(s){const el=document.getElementById("purchaseStatus");el.textContent=s;el.className="txn-status "+s.toLowerCase();}
    function lockPurchaseForm(lock){
      ["purchaseSupplier","purchaseTin","purchaseReference","purchasePaymentMethod"].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=lock;});
      purchaseBody.querySelectorAll("input,select,textarea").forEach(el=>el.disabled=lock);
      purchaseBody.querySelectorAll(".btn-del").forEach(b=>b.disabled=lock);
      const addBtn=document.getElementById("addPurchaseRowBtn");
      addBtn.disabled=lock; addBtn.classList.toggle("hidden",lock);
    }
    function togglePurchaseBtns(state){
      document.getElementById("savePurchaseBtn").classList.toggle("hidden",state==="posted"||state==="void");
      document.getElementById("editPurchaseBtn").classList.toggle("hidden",state!=="saved");
      document.getElementById("postPurchaseBtn").classList.toggle("hidden",state!=="saved");
      document.getElementById("voidPurchaseBtn").classList.toggle("hidden",state!=="posted");
    }
    function addPurchaseRow(data){
      data=data||{};
      const tr=document.createElement("tr");
      const acc=window.createAccountDropdown("purchases",data.account||"");
      tr.innerHTML=`
        <td><input type="date" class="p-date" value="${data.date||""}"></td>
        <td><textarea class="p-desc row-textarea" rows="1" placeholder="Description">${(data.desc||"").replace(/</g,"&lt;")}</textarea></td>
        <td class="acc-cell"></td>
        <td><input type="number" class="p-net" min="0" step="0.01" value="${data.net||""}"></td>
        <td class="p-vat num">0.00</td>
        <td><select class="p-tax"><option value="VAT">VAT</option><option value="None">None</option></select></td>
        <td><button type="button" class="btn-del" title="Remove">×</button></td>`;
      tr.querySelector(".acc-cell").appendChild(acc);
      tr.querySelector(".p-tax").value=data.tax||"VAT";
      const ta=tr.querySelector(".p-desc");
      ta.addEventListener("input",()=>{ ta.style.height="auto"; ta.style.height=ta.scrollHeight+"px"; calcPurchaseTotals(); });
      if(data.desc){ setTimeout(()=>{ ta.style.height="auto"; ta.style.height=ta.scrollHeight+"px"; },0); }
      tr.querySelector(".btn-del").onclick=()=>{tr.remove();calcPurchaseTotals();};
      tr.querySelectorAll("input,select").forEach(el=>el.addEventListener("input",calcPurchaseTotals));
      purchaseBody.appendChild(tr);
      calcPurchaseTotals();
    }
    function calcPurchaseTotals(){
      let net=0,vat=0,ex=0;
      purchaseBody.querySelectorAll("tr").forEach(r=>{
        const n=parseFloat(r.querySelector(".p-net").value)||0;
        const t=r.querySelector(".p-tax").value;
        const v=t==="VAT"?+(n*0.12).toFixed(2):0;
        r.querySelector(".p-vat").textContent=v.toFixed(2);
        if(t==="VAT"){net+=n;vat+=v;}else{ex+=n;}
      });
      const grand=net+vat+ex;
      document.getElementById("purchaseTotal").textContent        =grand.toFixed(2);
      document.getElementById("purchaseSummaryNet").textContent   =net.toFixed(2);
      document.getElementById("purchaseSummaryVat").textContent   =vat.toFixed(2);
      document.getElementById("purchaseSummaryExempt").textContent=ex.toFixed(2);
      document.getElementById("purchaseSummaryGrand").textContent =grand.toFixed(2);
    }
    function resetPurchaseForm(withRow){
      purchaseBody.innerHTML="";
      ["purchaseSupplier","purchaseTin","purchaseReference"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
      const pm=document.getElementById("purchasePaymentMethod"); if(pm) pm.value="Credit";
      ["purchaseSupplier","purchaseReference"].forEach(id=>window.clearInlineError(document.getElementById(id)));
      [["savePurchaseBtn","Save"],["postPurchaseBtn","Post"],["voidPurchaseBtn","Void"]].forEach(([id,lbl])=>{
        const b=document.getElementById(id); if(b){b.dataset.confirmed="";b.textContent=lbl;}
      });
      document.getElementById("purchaseJournalPreview").classList.add("hidden");
      if(withRow) addPurchaseRow();
      calcPurchaseTotals();
    }
    function showPurchaseJournal(txn){
      if(!txn||txn.status==="DRAFT"){document.getElementById("purchaseJournalPreview").classList.add("hidden");return;}
      window.renderJournalEntries(window.generateJournalEntries(txn,"purchases",txn.paymentMethod||"Credit"),document.getElementById("purchaseJournalBody"));
      document.getElementById("purchaseJournalPreview").classList.remove("hidden");
    }
    function renderPurchaseList(){
      const from=document.getElementById("purchaseFromDate").value;
      const to=document.getElementById("purchaseToDate").value;
      const search=document.getElementById("purchaseSearch").value.toLowerCase().trim();
      const tbody=document.getElementById("purchaseListTableBody");
      tbody.innerHTML="";
      const list=window.savedPurchases.filter(p=>{
        const d=p.rows[0]?.date||"";
        if(from&&d<from) return false; if(to&&d>to) return false;
        if(search&&!p.supplier.toLowerCase().includes(search)&&!(p.reference||"").toLowerCase().includes(search)&&!(p.tin||"").toLowerCase().includes(search)) return false;
        return true;
      });
      if(!list.length){tbody.innerHTML=`<tr class="no-hover"><td colspan="7" class="empty-state">No purchases found.</td></tr>`;return;}
      [...list].reverse().forEach(p=>{
        const i=window.savedPurchases.indexOf(p);
        const tr=document.createElement("tr");
        tr.innerHTML=`<td>${fmtDate(p.rows[0]?.date||"")}</td><td>${p.supplier}</td><td>${p.tin||"—"}</td><td>${p.reference||"—"}</td><td>${paymentBadge(p.paymentMethod||"Credit")}</td><td class="amount-cell">${window.calcGross(p.rows).toFixed(2)}</td><td>${window.statusBadge(p.status)}</td>`;
        tr.onclick=()=>openPurchase(i);
        tbody.appendChild(tr);
      });
    }
    function openPurchase(i){
      const p=window.savedPurchases[i]; window.currentPurchaseIndex=i;
      resetPurchaseForm(false);
      document.getElementById("purchaseSupplier").value =p.supplier;
      document.getElementById("purchaseTin").value      =p.tin||"";
      document.getElementById("purchaseReference").value=p.reference||"";
      const pm=document.getElementById("purchasePaymentMethod"); if(pm) pm.value=p.paymentMethod||"Credit";
      p.rows.forEach(r=>addPurchaseRow(r));
      setPurchaseStatus(p.status);
      lockPurchaseForm(p.status!=="DRAFT");
      togglePurchaseBtns(p.status==="DRAFT"?"saved":p.status.toLowerCase());
      window.loadAuditLog("purchases"); showPurchaseJournal(p); showPurchaseForm();
    }

    document.getElementById("addNewPurchaseBtn").onclick=()=>{
      window.currentPurchaseIndex=null; resetPurchaseForm(true); setPurchaseStatus("DRAFT");
      lockPurchaseForm(false); togglePurchaseBtns("new"); window.loadAuditLog("purchases"); showPurchaseForm();
    };
    document.getElementById("addPurchaseRowBtn").onclick =()=>addPurchaseRow();
    document.getElementById("editPurchaseBtn").onclick   =()=>{lockPurchaseForm(false);togglePurchaseBtns("saved");};
    document.getElementById("cancelPurchaseBtn").onclick =()=>{resetPurchaseForm(false);showPurchaseList();};
    document.getElementById("filterPurchasesBtn").onclick=renderPurchaseList;
    document.getElementById("purchaseSearch").oninput    =renderPurchaseList;
    document.getElementById("clearPurchaseSearch").onclick=()=>{
      document.getElementById("purchaseSearch").value="";
      document.getElementById("purchaseFromDate").value="";
      document.getElementById("purchaseToDate").value="";
      renderPurchaseList();
    };

    document.getElementById("savePurchaseBtn").onclick=function(){
      const sEl=document.getElementById("purchaseSupplier");
      const rEl=document.getElementById("purchaseReference");
      const supplier=sEl.value.trim(); const reference=rEl.value.trim();
      window.clearInlineError(sEl); window.clearInlineError(rEl);
      if(!supplier){window.showInlineError(sEl,"Supplier name is required");return;}
      if(reference&&window.isDuplicateRef(window.savedPurchases,reference,window.currentPurchaseIndex)){window.showInlineError(rEl,"Reference already exists");return;}
      if(!this.dataset.confirmed){window.showInlineError(sEl,"Tap Save again to confirm",true);this.dataset.confirmed="true";this.textContent="Confirm Save";return;}
      this.dataset.confirmed="";this.textContent="Save";
      const existing=window.currentPurchaseIndex!==null?window.savedPurchases[window.currentPurchaseIndex]:null;
      const purchase={
        supplier,reference,
        tin:document.getElementById("purchaseTin").value.trim(),
        paymentMethod:document.getElementById("purchasePaymentMethod").value,
        status:"DRAFT",lastEditedStatus:"Draft",
        createdAt:existing?.createdAt||nowTS(),
        postedAt:existing?.postedAt||null,
        voidedAt:existing?.voidedAt||null,
        rows:[...purchaseBody.children].map(r=>({
          date:r.querySelector(".p-date").value,
          desc:r.querySelector(".p-desc").value,
          account:r.querySelector(".account-select").value,
          net:parseFloat(r.querySelector(".p-net").value)||0,
          tax:r.querySelector(".p-tax").value
        }))
      };
      window.DB.savePurchase(purchase,window.currentPurchaseIndex).then(()=>{
        if(window.currentPurchaseIndex===null) window.currentPurchaseIndex=window.savedPurchases.length-1;
        renderPurchaseList(); window.updateOverview(); showPurchaseList();
      });
    };

    document.getElementById("postPurchaseBtn").onclick=function(){
      if(window.currentPurchaseIndex===null) return;
      const sEl=document.getElementById("purchaseSupplier");
      if(!this.dataset.confirmed){window.showInlineError(sEl,"Tap Post again to finalize",true);this.dataset.confirmed="true";this.textContent="Confirm Post";return;}
      this.dataset.confirmed="";this.textContent="Post";
      const rec=window.savedPurchases[window.currentPurchaseIndex];
      rec.status="POSTED";rec.lastEditedStatus="Posted";rec.postedAt=rec.postedAt||nowTS();
      window.DB.updatePurchase(window.currentPurchaseIndex);
      window.loadAuditLog("purchases");setPurchaseStatus("POSTED");lockPurchaseForm(true);togglePurchaseBtns("posted");showPurchaseJournal(rec);window.updateOverview();
    };

    document.getElementById("voidPurchaseBtn").onclick=function(){
      if(window.currentPurchaseIndex===null) return;
      const sEl=document.getElementById("purchaseSupplier");
      if(!this.dataset.confirmed){window.showInlineError(sEl,"Tap Void again to confirm",true);this.dataset.confirmed="true";this.textContent="Confirm Void";return;}
      this.dataset.confirmed="";this.textContent="Void";
      const rec=window.savedPurchases[window.currentPurchaseIndex];
      rec.status="VOID";rec.lastEditedStatus="Voided";rec.voidedAt=rec.voidedAt||nowTS();
      window.DB.updatePurchase(window.currentPurchaseIndex);
      window.loadAuditLog("purchases");setPurchaseStatus("VOID");lockPurchaseForm(true);togglePurchaseBtns("void");
      document.getElementById("purchaseJournalPreview").classList.add("hidden");window.updateOverview();
    };

    // ══════════════════════════════════════════════════
    // JOURNAL PAGE
    // ══════════════════════════════════════════════════
    document.getElementById("runJournalBtn").onclick=function(){
      const from=document.getElementById("journalFromDate").value;
      const to=document.getElementById("journalToDate").value;
      const out=document.getElementById("journalOutput");
      const all=[
        ...window.savedSales.filter(x=>x.status==="POSTED").map(x=>({...x,_type:"sale",_party:x.customer})),
        ...window.savedPurchases.filter(x=>x.status==="POSTED").map(x=>({...x,_type:"purchase",_party:x.supplier}))
      ].filter(t=>{const d=t.rows[0]?.date||"";return(!from||d>=from)&&(!to||d<=to);})
       .sort((a,b)=>(a.rows[0]?.date||"")<(b.rows[0]?.date||"")?-1:1);
      if(!all.length){out.innerHTML=`<div class="report-empty">No posted transactions for this period.</div>`;return;}
      out.innerHTML=`<p class="report-period">Period: ${fmtDate(from)||"All"} → ${fmtDate(to)||"All"}</p>`+
        all.map(t=>{
          const entries=window.generateJournalEntries(t,t._type==="sale"?"sales":"purchases");
          let rows="";let dr=0,cr=0;
          entries.forEach(e=>{dr+=e.debit;cr+=e.credit;rows+=`<tr><td class="${e.debit>0?"":"cr-indent"}">${e.account}</td><td class="num">${e.debit>0?e.debit.toFixed(2):""}</td><td class="num">${e.credit>0?e.credit.toFixed(2):""}</td></tr>`;});
          return `<div class="je-block">
            <div class="je-header">
              <span class="je-date">${fmtDate(t.rows[0]?.date||"")}</span>
              <span class="je-party">${t._party}</span>
              <span class="je-ref">${t.reference||"—"}</span>
              <span class="je-badge ${t._type}">${t._type==="sale"?"Sale":"Purchase"}</span>
            </div>
            <table class="journal-table"><thead><tr><th>Account</th><th>Debit</th><th>Credit</th></tr></thead>
            <tbody>${rows}<tr class="j-total"><td><strong>Total</strong></td><td class="num"><strong>${dr.toFixed(2)}</strong></td><td class="num"><strong>${cr.toFixed(2)}</strong></td></tr></tbody></table></div>`;
        }).join("");
    };

    // ══════════════════════════════════════════════════
    // REPORTS PAGE
    // ══════════════════════════════════════════════════
    let _lastReport=null;

    function buildAccTotals(list,from,to){
      const map={};
      list.filter(x=>x.status==="POSTED").forEach(t=>{
        t.rows.forEach(r=>{
          const d=r.date||""; if(from&&d<from) return; if(to&&d>to) return;
          const acc=r.account||"(No Account)";
          if(!map[acc]) map[acc]={net:0,vat:0,gross:0};
          const v=r.tax==="VAT"?r.net*0.12:0;
          map[acc].net+=r.net; map[acc].vat+=v; map[acc].gross+=r.net+v;
        });
      });
      return map;
    }

    function accTable(title,map){
      const entries=Object.entries(map);
      if(!entries.length) return `<div class="report-section"><h3>${title}</h3><div class="report-empty">No posted transactions.</div></div>`;
      let tN=0,tV=0,tG=0;
      const rows=entries.map(([a,t])=>{tN+=t.net;tV+=t.vat;tG+=t.gross;
        return `<tr><td>${a}</td><td class="num">${t.net.toFixed(2)}</td><td class="num">${t.vat.toFixed(2)}</td><td class="num"><strong>${t.gross.toFixed(2)}</strong></td></tr>`;
      }).join("");
      return `<div class="report-section"><h3>${title}</h3>
        <table class="report-table"><thead><tr><th>Account</th><th class="num">Net</th><th class="num">VAT</th><th class="num">Gross</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td><strong>TOTAL</strong></td><td class="num">${tN.toFixed(2)}</td><td class="num">${tV.toFixed(2)}</td><td class="num">${tG.toFixed(2)}</td></tr></tfoot></table></div>`;
    }

    function buildLedger(from,to){
      const ledger={};
      const add=(acc,dr,cr)=>{if(!ledger[acc]) ledger[acc]={debit:0,credit:0};ledger[acc].debit+=dr;ledger[acc].credit+=cr;};
      [...window.savedSales.filter(x=>x.status==="POSTED").map(x=>({t:x,type:"sales"})),
       ...window.savedPurchases.filter(x=>x.status==="POSTED").map(x=>({t:x,type:"purchases"}))
      ].forEach(({t,type})=>{
        const d=t.rows[0]?.date||"";
        if(from&&d<from) return; if(to&&d>to) return;
        window.generateJournalEntries(t,type).forEach(e=>add(e.account,e.debit,e.credit));
      });
      return ledger;
    }

    function trialBalance(from,to){
      const ledger=buildLedger(from,to);
      const entries=Object.entries(ledger);
      if(!entries.length) return `<div class="report-section"><h3>Trial Balance</h3><div class="report-empty">No posted transactions.</div></div>`;
      let dr=0,cr=0;
      const rows=entries.map(([a,v])=>{dr+=v.debit;cr+=v.credit;
        return `<tr><td>${a}</td><td class="num">${v.debit>0?v.debit.toFixed(2):""}</td><td class="num">${v.credit>0?v.credit.toFixed(2):""}</td></tr>`;
      }).join("");
      const balanced=Math.abs(dr-cr)<0.01;
      return `<div class="report-section"><h3>Trial Balance</h3>
        <div class="${balanced?"tb-ok":"tb-err"}">${balanced?"✓ Balanced":"⚠ Out of balance"}</div>
        <table class="report-table"><thead><tr><th>Account</th><th class="num">Debit</th><th class="num">Credit</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td><strong>TOTAL</strong></td><td class="num">${dr.toFixed(2)}</td><td class="num">${cr.toFixed(2)}</td></tr></tfoot></table></div>`;
    }

    function incomeStatement(from,to){
      // Revenue = sum of CR on revenue accounts (Sales, Service etc.)
      // Expenses = sum of DR on expense accounts
      const ledger=buildLedger(from,to);
      const revenueAccts  = Object.values(window.COA.sales||{}).flat();
      const expenseAccts  = Object.values(window.COA.purchases||{}).flat();

      let totalRevenue=0, totalExpense=0;
      const revRows=[], expRows=[];

      Object.entries(ledger).forEach(([acc,v])=>{
        const net=v.credit-v.debit; // revenue accounts are CR
        if(revenueAccts.includes(acc)&&net!==0){ totalRevenue+=net; revRows.push([acc,net]); }
      });
      Object.entries(ledger).forEach(([acc,v])=>{
        const net=v.debit-v.credit; // expense accounts are DR
        if(expenseAccts.includes(acc)&&net!==0){ totalExpense+=net; expRows.push([acc,net]); }
      });

      const netIncome=totalRevenue-totalExpense;
      const comp=window.companyProfile;
      const header=comp.name?`<div class="fs-company"><strong>${comp.name}</strong>${comp.tin?` | TIN: ${comp.tin}`:""}</div>`:"";

      return `<div class="report-section">
        <h3>Income Statement (Statement of Financial Performance)</h3>
        ${header}
        <p class="report-period">Period: ${fmtDate(from)||"All"} → ${fmtDate(to)||"All"}</p>
        <table class="report-table">
          <thead><tr><th>Account</th><th class="num">Amount</th></tr></thead>
          <tbody>
            <tr class="fs-section-header"><td colspan="2"><strong>REVENUE</strong></td></tr>
            ${revRows.map(([a,v])=>`<tr><td class="fs-indent">${a}</td><td class="num">${v.toFixed(2)}</td></tr>`).join("")}
            <tr class="fs-subtotal"><td><strong>Total Revenue</strong></td><td class="num"><strong>${totalRevenue.toFixed(2)}</strong></td></tr>
            <tr class="fs-section-header"><td colspan="2"><strong>EXPENSES</strong></td></tr>
            ${expRows.map(([a,v])=>`<tr><td class="fs-indent">${a}</td><td class="num">(${v.toFixed(2)})</td></tr>`).join("")}
            <tr class="fs-subtotal"><td><strong>Total Expenses</strong></td><td class="num"><strong>(${totalExpense.toFixed(2)})</strong></td></tr>
          </tbody>
          <tfoot>
            <tr class="${netIncome>=0?"fs-profit":"fs-loss"}">
              <td><strong>${netIncome>=0?"NET INCOME":"NET LOSS"}</strong></td>
              <td class="num"><strong>${netIncome>=0?netIncome.toFixed(2):"("+Math.abs(netIncome).toFixed(2)+")"}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>`;
    }

    function balanceSheet(from,to){
      const ledger=buildLedger(from,to);
      const assetAccts     = Object.values(window.COA.assets||{}).flat();
      const liabAccts      = Object.values(window.COA.liabilities||{}).flat();
      const equityAccts    = Object.values(window.COA.equity||{}).flat();

      let totalAssets=0, totalLiab=0, totalEquity=0;
      const assetRows=[], liabRows=[], equityRows=[];

      Object.entries(ledger).forEach(([acc,v])=>{
        const dr=v.debit-v.credit;
        const cr=v.credit-v.debit;
        if(assetAccts.includes(acc)&&dr!==0)  { totalAssets+=dr;  assetRows.push([acc,dr]); }
        if(liabAccts.includes(acc)&&cr!==0)   { totalLiab+=cr;    liabRows.push([acc,cr]); }
        if(equityAccts.includes(acc)&&cr!==0) { totalEquity+=cr;  equityRows.push([acc,cr]); }
      });

      // Add net income to equity
      const lisTb=buildLedger(from,to);
      const revenueAccts=Object.values(window.COA.sales||{}).flat();
      const expenseAccts=Object.values(window.COA.purchases||{}).flat();
      let rev=0,exp=0;
      Object.entries(lisTb).forEach(([acc,v])=>{
        if(revenueAccts.includes(acc)) rev+=v.credit-v.debit;
        if(expenseAccts.includes(acc)) exp+=v.debit-v.credit;
      });
      const netIncome=rev-exp;
      if(netIncome!==0){ totalEquity+=netIncome; equityRows.push(["Current Year Net Income",netIncome]); }

      const comp=window.companyProfile;
      const header=comp.name?`<div class="fs-company"><strong>${comp.name}</strong>${comp.tin?` | TIN: ${comp.tin}`:""}</div>`:"";

      return `<div class="report-section">
        <h3>Balance Sheet (Statement of Financial Position)</h3>
        ${header}
        <p class="report-period">As of: ${fmtDate(to)||"Today"}</p>
        <table class="report-table">
          <thead><tr><th>Account</th><th class="num">Amount</th></tr></thead>
          <tbody>
            <tr class="fs-section-header"><td colspan="2"><strong>ASSETS</strong></td></tr>
            ${assetRows.map(([a,v])=>`<tr><td class="fs-indent">${a}</td><td class="num">${v.toFixed(2)}</td></tr>`).join("")||"<tr><td class='fs-indent' colspan='2' style='color:#94a3b8'>No asset balances recorded</td></tr>"}
            <tr class="fs-subtotal"><td><strong>Total Assets</strong></td><td class="num"><strong>${totalAssets.toFixed(2)}</strong></td></tr>
            <tr class="fs-section-header"><td colspan="2"><strong>LIABILITIES</strong></td></tr>
            ${liabRows.map(([a,v])=>`<tr><td class="fs-indent">${a}</td><td class="num">${v.toFixed(2)}</td></tr>`).join("")||"<tr><td class='fs-indent' colspan='2' style='color:#94a3b8'>No liability balances recorded</td></tr>"}
            <tr class="fs-subtotal"><td><strong>Total Liabilities</strong></td><td class="num"><strong>${totalLiab.toFixed(2)}</strong></td></tr>
            <tr class="fs-section-header"><td colspan="2"><strong>EQUITY</strong></td></tr>
            ${equityRows.map(([a,v])=>`<tr><td class="fs-indent">${a}</td><td class="num">${v.toFixed(2)}</td></tr>`).join("")||"<tr><td class='fs-indent' colspan='2' style='color:#94a3b8'>No equity balances recorded</td></tr>"}
            <tr class="fs-subtotal"><td><strong>Total Equity</strong></td><td class="num"><strong>${totalEquity.toFixed(2)}</strong></td></tr>
          </tbody>
          <tfoot>
            <tr class="${Math.abs(totalAssets-(totalLiab+totalEquity))<0.01?"fs-profit":"fs-loss"}">
              <td><strong>Total Liabilities + Equity</strong></td>
              <td class="num"><strong>${(totalLiab+totalEquity).toFixed(2)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>`;
    }

    document.getElementById("runReportBtn").onclick=function(){
      const from=document.getElementById("reportFromDate").value;
      const to=document.getElementById("reportToDate").value;
      const type=document.getElementById("reportType").value;
      const out=document.getElementById("reportOutput");
      _lastReport={from,to,type};
      let html=`<p class="report-period">Period: ${fmtDate(from)||"All"} → ${fmtDate(to)||"All"} | Posted only</p>`;
      if(type==="trial")   html+=trialBalance(from,to);
      else if(type==="is") html+=incomeStatement(from,to);
      else if(type==="bs") html+=balanceSheet(from,to);
      else {
        if(type==="both"||type==="sales")     html+=accTable("Sales by Account",    buildAccTotals(window.savedSales,from,to));
        if(type==="both"||type==="purchases") html+=accTable("Purchases by Account",buildAccTotals(window.savedPurchases,from,to));
      }
      out.innerHTML=html;
    };

    document.getElementById("exportCsvBtn").onclick=function(){
      if(!_lastReport){alert("Run a report first.");return;}
      const{from,to,type}=_lastReport;
      const rows=[["FinMatrix Export"],[`Period: ${from||"all"} to ${to||"all"}`],[`Generated: ${nowTS()}`],[]];
      if(type==="trial"){
        rows.push(["TRIAL BALANCE"],["Account","Debit","Credit"]);
        const ledger=buildLedger(from,to); let dr=0,cr=0;
        Object.entries(ledger).forEach(([a,v])=>{dr+=v.debit;cr+=v.credit;rows.push([a,v.debit||"",v.credit||""]);});
        rows.push(["TOTAL",dr.toFixed(2),cr.toFixed(2)]);
      } else if(type==="is"){
        rows.push(["INCOME STATEMENT"],["Account","Amount"]);
        const ledger=buildLedger(from,to);
        const revAccts=Object.values(window.COA.sales||{}).flat();
        const expAccts=Object.values(window.COA.purchases||{}).flat();
        let rev=0,exp=0;
        Object.entries(ledger).forEach(([a,v])=>{
          const net=v.credit-v.debit;
          if(revAccts.includes(a)&&net!==0){rev+=net;rows.push([a,net.toFixed(2)]);}
        });
        rows.push(["Total Revenue",rev.toFixed(2)],[]);
        Object.entries(ledger).forEach(([a,v])=>{
          const net=v.debit-v.credit;
          if(expAccts.includes(a)&&net!==0){exp+=net;rows.push([a,net.toFixed(2)]);}
        });
        rows.push(["Total Expenses",exp.toFixed(2)],["Net Income",(rev-exp).toFixed(2)]);
      } else {
        if(type==="both"||type==="sales"){
          rows.push(["SALES BY ACCOUNT"],["Account","Net","VAT","Gross"]);
          let tN=0,tV=0,tG=0;
          Object.entries(buildAccTotals(window.savedSales,from,to)).forEach(([a,t])=>{tN+=t.net;tV+=t.vat;tG+=t.gross;rows.push([a,t.net.toFixed(2),t.vat.toFixed(2),t.gross.toFixed(2)]);});
          rows.push(["TOTAL",tN.toFixed(2),tV.toFixed(2),tG.toFixed(2)],[]);
        }
        if(type==="both"||type==="purchases"){
          rows.push(["PURCHASES BY ACCOUNT"],["Account","Net","VAT","Gross"]);
          let tN=0,tV=0,tG=0;
          Object.entries(buildAccTotals(window.savedPurchases,from,to)).forEach(([a,t])=>{tN+=t.net;tV+=t.vat;tG+=t.gross;rows.push([a,t.net.toFixed(2),t.vat.toFixed(2),t.gross.toFixed(2)]);});
          rows.push(["TOTAL",tN.toFixed(2),tV.toFixed(2),tG.toFixed(2)]);
        }
      }
      // Transaction detail
      rows.push([],["TRANSACTION DETAIL"],["Type","Date","Party","TIN","Reference","Account","Net","VAT","Gross","Tax"]);
      const addDetail=(list,label,nameKey)=>{
        list.filter(x=>x.status==="POSTED").forEach(t=>{
          t.rows.forEach(r=>{
            const d=r.date||""; if(from&&d<from) return; if(to&&d>to) return;
            const v=r.tax==="VAT"?r.net*0.12:0;
            rows.push([label,r.date,t[nameKey],t.tin||"",t.reference||"",r.account||"",r.net.toFixed(2),v.toFixed(2),(r.net+v).toFixed(2),r.tax]);
          });
        });
      };
      if(type==="both"||type==="sales")     addDetail(window.savedSales,    "Sale",    "customer");
      if(type==="both"||type==="purchases") addDetail(window.savedPurchases,"Purchase","supplier");
      const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\r\n");
      const a=document.createElement("a");
      a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
      a.download=`FinMatrix_${from||"all"}_${to||"all"}.csv`;
      a.click();
    };

    // Google Drive backup button
    document.getElementById("driveBackupBtn").onclick=function(){
      if(!navigator.onLine){
        alert("You are offline. Please go online to back up to Google Drive.");
        return;
      }
      const data={
        exportedAt: nowTS(),
        version: window.APP_INFO.version,
        companyProfile: window.companyProfile,
        COA: window.COA,
        sales: window.savedSales,
        purchases: window.savedPurchases
      };
      const json=JSON.stringify(data,null,2);
      const blob=new Blob([json],{type:"application/json"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url;
      a.download=`FinMatrix_Backup_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      // Note: Full Google Drive API integration requires OAuth — this downloads
      // the file which user can manually save to Drive. True API integration
      // will be added in PWA version.
      alert("Backup file downloaded! Save it to your Google Drive manually.\n\nFull auto-backup to Drive will be available in the PWA version.");
    };

    // ══════════════════════════════════════════════════
    // COA MODULE
    // ══════════════════════════════════════════════════
    function renderCOA(){
      ["sales","purchases","assets","liabilities","equity"].forEach(type=>{
        const cap=type.charAt(0).toUpperCase()+type.slice(1);
        const container=document.getElementById("coa"+cap+"Groups");
        if(!container) return;
        container.innerHTML="";
        const groups=window.COA[type]||{};
        Object.keys(groups).forEach(group=>{
          const accs=groups[group];
          const div=document.createElement("div");
          div.className="coa-group";
          div.innerHTML=`
            <div class="coa-group-header">
              <span class="coa-group-name">${group}</span>
              <div class="coa-group-actions">
                <button class="btn-coa-action" data-action="rename-group" data-type="${type}" data-group="${group}">✎</button>
                <button class="btn-coa-action" data-action="delete-group" data-type="${type}" data-group="${group}">×</button>
              </div>
            </div>
            <div class="coa-accounts">
              ${accs.map((a,i)=>`<div class="coa-acc-row"><span>${a}</span><div><button class="btn-coa-action" data-action="rename-acc" data-type="${type}" data-group="${group}" data-index="${i}">✎</button><button class="btn-coa-action" data-action="delete-acc" data-type="${type}" data-group="${group}" data-index="${i}">×</button></div></div>`).join("")||`<div class="coa-empty">No accounts yet.</div>`}
            </div>
            <div class="coa-add-row">
              <input type="text" class="new-acc-input" data-type="${type}" data-group="${group}" placeholder="New account name">
              <button class="btn-add-acc" data-type="${type}" data-group="${group}">Add</button>
            </div>`;
          container.appendChild(div);
        });
        container.querySelectorAll(".btn-coa-action").forEach(btn=>{
          btn.onclick=()=>{
            const{action,type:t,group:g,index}=btn.dataset;
            if(action==="delete-group"){if(!confirm(`Delete group "${g}" and all accounts?`)) return;delete window.COA[t][g];}
            else if(action==="rename-group"){const n=prompt(`Rename "${g}":`,g);if(!n||n===g) return;const newG={};Object.keys(window.COA[t]).forEach(k=>{newG[k===g?n:k]=window.COA[t][k];});window.COA[t]=newG;}
            else if(action==="delete-acc"){if(!confirm(`Remove "${window.COA[t][g][+index]}"?`)) return;window.COA[t][g].splice(+index,1);}
            else if(action==="rename-acc"){const cur=window.COA[t][g][+index];const n=prompt(`Rename "${cur}":`,cur);if(!n||n===cur) return;window.COA[t][g][+index]=n.trim();}
            window.DB.saveCOA();renderCOA();
          };
        });
        container.querySelectorAll(".btn-add-acc").forEach(btn=>{
          btn.onclick=()=>{
            const{type:t,group:g}=btn.dataset;
            const input=container.querySelector(`.new-acc-input[data-group="${g}"]`);
            const val=input.value.trim(); if(!val) return;
            if(window.COA[t][g].includes(val)){alert("Already exists.");return;}
            window.COA[t][g].push(val);input.value="";
            window.DB.saveCOA();renderCOA();
          };
        });
        container.querySelectorAll(".new-acc-input").forEach(inp=>{
          inp.onkeydown=e=>{if(e.key==="Enter"){const b=container.querySelector(`.btn-add-acc[data-group="${inp.dataset.group}"]`);if(b)b.click();}};
        });
      });
    }

    ["sales","purchases","assets","liabilities","equity"].forEach(type=>{
      const cap=type.charAt(0).toUpperCase()+type.slice(1);
      const btn=document.getElementById("add"+cap+"GroupBtn");
      const input=document.getElementById("new"+cap+"GroupName");
      if(!btn||!input) return;
      const doAdd=()=>{
        const name=input.value.trim(); if(!name) return;
        if(!window.COA[type]) window.COA[type]={};
        if(window.COA[type][name]){alert("Group already exists.");return;}
        window.COA[type][name]=[];input.value="";
        window.DB.saveCOA();renderCOA();
      };
      btn.onclick=doAdd;
      input.onkeydown=e=>{if(e.key==="Enter")doAdd();};
    });

    document.querySelectorAll(".coa-tab").forEach(tab=>{
      tab.onclick=()=>{
        document.querySelectorAll(".coa-tab").forEach(t=>t.classList.remove("active"));
        document.querySelectorAll(".coa-panel").forEach(p=>p.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById("coa-panel-"+tab.dataset.coaTab)?.classList.add("active");
      };
    });

    // ══════════════════════════════════════════════════
    // COMPANY PROFILE
    // ══════════════════════════════════════════════════
    function renderCompanyProfile(){
      const p=window.companyProfile;
      document.getElementById("cpName").value     = p.name||"";
      document.getElementById("cpAddress").value  = p.address||"";
      document.getElementById("cpNature").value   = p.nature||"VAT";
      document.getElementById("cpTin").value      = p.tin||"";
      document.getElementById("cpRdo").value      = p.rdo||"";
      document.getElementById("cpBirReg").value   = p.bir_reg_no||"";
      document.getElementById("cpContact").value  = p.contact||"";
    }
    document.getElementById("saveCompanyProfileBtn").onclick=function(){
      window.companyProfile={
        name:     document.getElementById("cpName").value.trim(),
        address:  document.getElementById("cpAddress").value.trim(),
        nature:   document.getElementById("cpNature").value,
        tin:      document.getElementById("cpTin").value.trim(),
        rdo:      document.getElementById("cpRdo").value.trim(),
        bir_reg_no: document.getElementById("cpBirReg").value.trim(),
        contact:  document.getElementById("cpContact").value.trim()
      };
      window.DB.saveCompanyProfile();
      // Update header if company name is set
      if(window.companyProfile.name){
        document.querySelector(".company-sub").textContent = window.companyProfile.name;
        document.querySelector(".company-sub").classList.remove("hidden");
      }
      alert("Company profile saved!");
    };

    // ══════════════════════════════════════════════════
    // ABOUT PAGE
    // ══════════════════════════════════════════════════
    function renderAbout(){
      const a=window.APP_INFO;
      document.getElementById("aboutContent").innerHTML=`
        <div class="about-logo-wrap">
          <img src="logo.png" alt="FinMatrix" class="about-logo" onerror="this.style.display='none'">
        </div>
        <div class="about-card">
          <div class="about-row"><span>App Name</span><strong>${a.name}</strong></div>
          <div class="about-row"><span>Version</span><strong>${a.version}</strong></div>
          <div class="about-row"><span>Developer</span><strong>${a.developer}</strong></div>
          <div class="about-row"><span>Last Updated</span><strong>${a.updated}</strong></div>
          <div class="about-row"><span>Description</span><span>${a.description}</span></div>
        </div>
        <div class="about-card about-disclaimer">
          <p>⚠️ FinMatrix is a bookkeeping aid and does not replace a licensed accountant or CPA. Always consult a professional for BIR compliance and tax filing.</p>
        </div>`;
    }

    // ══════════════════════════════════════════════════
    // TUTORIAL PAGE
    // ══════════════════════════════════════════════════
    function renderTutorial(){
      document.getElementById("tutorialContent").innerHTML=`
        <div class="tutorial-steps">
          <div class="tut-step">
            <div class="tut-num">1</div>
            <div class="tut-body">
              <h4>Set Up Company Profile</h4>
              <p>Go to <strong>Settings → Company Profile</strong> and enter your business name, TIN, and BIR registration details. This appears on your reports.</p>
            </div>
          </div>
          <div class="tut-step">
            <div class="tut-num">2</div>
            <div class="tut-body">
              <h4>Review Chart of Accounts</h4>
              <p>Go to <strong>Settings → COA</strong> to review and customize your accounts. Add accounts specific to your business (e.g. custom expense types).</p>
            </div>
          </div>
          <div class="tut-step">
            <div class="tut-num">3</div>
            <div class="tut-body">
              <h4>Record a Purchase</h4>
              <p>Tap <strong>Purchases → + Add New</strong>. Fill in supplier, TIN, reference number, and payment method (Cash / Bank / Credit). Add line items with description, account, and amount. Tap <strong>Save</strong> then <strong>Post</strong> to finalize.</p>
            </div>
          </div>
          <div class="tut-step">
            <div class="tut-num">4</div>
            <div class="tut-body">
              <h4>Record a Sale</h4>
              <p>Tap <strong>Sales → + Add New</strong>. Fill in customer details and line items. The app automatically computes <strong>Output VAT (12%)</strong> for VAT transactions.</p>
            </div>
          </div>
          <div class="tut-step">
            <div class="tut-num">5</div>
            <div class="tut-body">
              <h4>Draft → Post → Void</h4>
              <p><strong>Draft</strong> = saved but not yet finalized. <strong>Post</strong> = locked and recorded in journal. <strong>Void</strong> = cancelled (excluded from all reports).</p>
            </div>
          </div>
          <div class="tut-step">
            <div class="tut-num">6</div>
            <div class="tut-body">
              <h4>View Journal Entries</h4>
              <p>Tap <strong>Journal</strong> to see all posted transactions in double-entry format (Debit / Credit). Every posted transaction generates a balanced journal entry automatically.</p>
            </div>
          </div>
          <div class="tut-step">
            <div class="tut-num">7</div>
            <div class="tut-body">
              <h4>Run Reports</h4>
              <p>Tap <strong>Reports</strong> and select a report type: <strong>Sales & Purchases by Account</strong>, <strong>Trial Balance</strong>, <strong>Income Statement</strong>, or <strong>Balance Sheet</strong>. Filter by date and export to CSV.</p>
            </div>
          </div>
          <div class="tut-step">
            <div class="tut-num">8</div>
            <div class="tut-body">
              <h4>Back Up Your Data</h4>
              <p>Go to <strong>Settings → Backup</strong> and tap <strong>Download Backup</strong>. Save the JSON file to Google Drive or cloud storage. Do this weekly to prevent data loss.</p>
            </div>
          </div>
        </div>`;
    }

    // Update header company name if set
    if(window.companyProfile?.name){
      document.querySelector(".company-sub")?.classList.remove("hidden");
      const sub=document.querySelector(".company-sub");
      if(sub) sub.textContent=window.companyProfile.name;
    }

    // ══════════════════════════════════════════════════
    // BOOT
    // ══════════════════════════════════════════════════
    window.updateOverview();
    showPage("home");

  } // end boot
}); // end DOMContentLoaded
