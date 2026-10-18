/* ========================================================================
   EDU_Acc — patches.js (نسخة محسنة بدون أخطاء القائمة الجانبية)
   ======================================================================== */
(function(){
'use strict';

function init(){
  if(typeof window.tab !== 'function' || typeof window.renderAll !== 'function'){
    setTimeout(init, 200);
    return;
  }
  console.log('✅ EDU_Acc patches loaded');
  const $ = id => document.getElementById(id);

  /* PATCH 1: تعديل القيد */
  window.edOpts = function(sel){
    const list = (typeof sortedAcc === 'function' ? sortedAcc() : accounts).slice();
    if(sel && !list.includes(sel)) list.push(sel);
    let h = `<option value="">اختر الحساب...</option>`;
    h += list.map(a => `<option value="${esc(a)}" ${a===sel?'selected':''}>${a}</option>`).join('');
    h += `<option value="__new_ed__" style="font-weight:bold;color:#4f46e5">➕ إضافة حساب جديد...</option>`;
    return h;
  };
  window.edRow = function(side, x){
    const container = $(side === 'd' ? 'edD' : 'edC');
    const div = document.createElement('div');
    div.className = 'flex gap-2 items-center';
    div.innerHTML =
      `<select class="flex-1 min-w-0 p-2 rounded border bg-white" onchange="window._edSelChange(this)">${window.edOpts(x && x.a)}</select>
       <input type="number" min="0" step="0.01" placeholder="المبلغ" class="em w-28 p-2 rounded border" value="${x ? x.m : ''}" oninput="edCalc()">
       <button type="button" onclick="edDel(this)" class="text-slate-400 hover:text-red-600 px-1">🗑</button>`;
    container.appendChild(div);
  };
  window._edSelChange = function(sel){
    if(sel.value === '__new_ed__'){
      const name = prompt('📝 اكتب اسم الحساب الجديد:');
      if(!name || !name.trim()){ sel.value = ''; return; }
      const cleanName = name.trim();
      if(accounts.includes(cleanName)){
        sel.innerHTML = window.edOpts(cleanName);
        sel.value = cleanName; edCalc(); return;
      }
      const t = prompt('⚙️ نوع الحساب:\n1) أصول\n2) خصوم\n3) حقوق ملكية\n4) إيرادات\n5) مصروفات\n\nاكتب الرقم:', '1');
      const typeMap = {'1':'A','2':'L','3':'E','4':'R','5':'X'};
      const tc = typeMap[t] || 'A';
      accounts.push(cleanName);
      types[cleanName] = tc;
      codes[cleanName] = autoCode({A:'11',L:'21',E:'3',R:'4',X:'5'}[tc] || '11');
      store.set('acc_list', accounts);
      store.set('acc_types', types);
      store.set('acc_codes', codes);
      sel.innerHTML = window.edOpts(cleanName);
      sel.value = cleanName;
      edCalc();
      if(typeof refreshSelects === 'function') refreshSelects();
    } else { edCalc(); }
  };

  /* PATCH 2: قسم الإهلاك */
  function injectAddAssetButton(){
    const dpOut = $('dpOut'); if(!dpOut || $('dpAddAssetBtn')) return;
    const depParent = dpOut.closest('details'); if(!depParent) return;
    const btn = document.createElement('button');
    btn.id = 'dpAddAssetBtn';
    btn.className = 'bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded font-bold mt-3';
    btn.innerHTML = '➕ إضافة أصل جديد';
    btn.onclick = window.openAssetForm;
    const formGrid = depParent.querySelector('.grid.md\\:grid-cols-3');
    if(formGrid && formGrid.parentElement) formGrid.parentElement.insertBefore(btn, formGrid);
    else depParent.appendChild(btn);
  }
  window.openAssetForm = function(){
    let modal = $('assetOv');
    if(!modal){
      modal = document.createElement('div');
      modal.id = 'assetOv';
      modal.style.cssText = 'position:fixed;inset:0;z-index:10045;background:rgba(15,23,42,.8);overflow:auto;display:none';
      modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-xl max-w-lg mx-auto my-8 p-5 space-y-3">
          <div class="flex justify-between items-center">
            <h3 class="text-lg font-bold">🏭 إضافة أصل جديد</h3>
            <button type="button" onclick="window.closeAssetForm()" class="text-slate-400 text-2xl leading-none">✕</button>
          </div>
          <div class="grid gap-2">
            <label class="text-sm font-semibold">اسم الأصل<input id="assetName" class="w-full p-2 rounded border mt-1"></label>
            <label class="text-sm font-semibold">التكلفة<input id="assetCost" type="number" min="0" step="0.01" class="w-full p-2 rounded border mt-1"></label>
            <div class="grid grid-cols-2 gap-2">
              <label class="text-sm font-semibold">الخردة<input id="assetSalvage" type="number" min="0" step="0.01" value="0" class="w-full p-2 rounded border mt-1"></label>
              <label class="text-sm font-semibold">العمر<input id="assetLife" type="number" min="1" max="50" value="5" class="w-full p-2 rounded border mt-1"></label>
            </div>
            <label class="text-sm font-semibold">طريقة الإهلاك<select id="assetMethod" class="w-full p-2 rounded border bg-white mt-1"><option value="sl">القسط الثابت</option><option value="db">القسط المتناقص</option></select></label>
            <label class="text-sm font-semibold">نسبة المتناقص %<input id="assetRate" type="number" min="0" max="100" step="0.1" class="w-full p-2 rounded border mt-1"></label>
            <label class="text-sm font-semibold">تاريخ البدء<input id="assetDate" type="date" class="w-full p-2 rounded border mt-1"></label>
          </div>
          <div class="flex gap-2 justify-end pt-3 border-t">
            <button type="button" onclick="window.closeAssetForm()" class="bg-slate-200 px-4 py-2 rounded">إلغاء</button>
            <button type="button" onclick="window.submitAssetForm()" class="bg-indigo-600 text-white px-4 py-2 rounded font-bold">💾 إنشاء</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }
    modal.style.display = 'block';
    setTimeout(() => { const d = $('assetDate'); if(d && !d.value) d.valueAsDate = new Date(); }, 50);
  };
  window.closeAssetForm = function(){ const m = $('assetOv'); if(m) m.style.display = 'none'; };
  window.submitAssetForm = function(){
    const name = ($('assetName').value || '').trim();
    const cost = parseFloat($('assetCost').value) || 0;
    const salv = parseFloat($('assetSalvage').value) || 0;
    const life = parseInt($('assetLife').value) || 0;
    const method = $('assetMethod').value;
    let rate = (parseFloat($('assetRate').value) || 0) / 100;
    const startDate = $('assetDate').value;
    if(!name || cost <= 0 || life < 1 || salv >= cost) return alert('⚠️ راجع البيانات');
    if(method === 'db' && !rate) rate = 2 / life;
    if(!accounts.includes(name)){
      accounts.push(name); types[name] = 'A'; codes[name] = autoCode('12');
      store.set('acc_list', accounts); store.set('acc_types', types); store.set('acc_codes', codes);
      if(typeof refreshSelects === 'function') refreshSelects();
    }
    if(typeof dpFill === 'function') dpFill();
    const s = id => $(id);
    if(s('dpA')) s('dpA').value = name;
    if(s('dpC')) s('dpC').value = cost;
    if(s('dpS')) s('dpS').value = salv;
    if(s('dpL')) s('dpL').value = life;
    if(s('dpM')) s('dpM').value = method;
    if(s('dpR') && method === 'db') s('dpR').value = (rate * 100).toFixed(1);
    if(s('dpY') && startDate) s('dpY').value = new Date(startDate).getFullYear();
    window.closeAssetForm();
    if(typeof dpBuild === 'function') dpBuild();
    setTimeout(() => { const out = $('dpOut'); if(out) out.scrollIntoView({behavior:'smooth',block:'center'}); }, 200);
  };

  /* PATCH 3: مركز الطباعة */
  window.openPrintCenter = function(){
    let modal = $('printOv');
    if(!modal){
      modal = document.createElement('div');
      modal.id = 'printOv';
      modal.style.cssText = 'position:fixed;inset:0;z-index:10045;background:rgba(15,23,42,.8);overflow:auto;display:none';
      modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-xl max-w-2xl mx-auto my-8 p-5 space-y-3">
          <div class="flex justify-between items-center">
            <h3 class="text-xl font-bold">🖨️ مركز الطباعة</h3>
            <button onclick="window.closePrintCenter()" class="text-slate-400 text-2xl">✕</button>
          </div>
          <div class="grid md:grid-cols-2 gap-2">
            <label class="flex items-center gap-2 p-2 border rounded cursor-pointer"><input type="checkbox" class="pcb" value="journal">📒 دفتر اليومية</label>
            <label class="flex items-center gap-2 p-2 border rounded cursor-pointer"><input type="checkbox" class="pcb" value="ledger">📚 دفتر الأستاذ</label>
            <label class="flex items-center gap-2 p-2 border rounded cursor-pointer"><input type="checkbox" class="pcb" value="trial">⚖️ ميزان المراجعة</label>
            <label class="flex items-center gap-2 p-2 border rounded cursor-pointer"><input type="checkbox" class="pcb" value="fin">📊 القوائم المالية</label>
            <label class="flex items-center gap-2 p-2 border rounded cursor-pointer"><input type="checkbox" class="pcb" value="dash">📈 المؤشرات</label>
            <label class="flex items-center gap-2 p-2 border rounded cursor-pointer"><input type="checkbox" class="pcb" value="tables">📋 الجداول</label>
          </div>
          <div class="flex gap-2 justify-end pt-3 border-t mt-3">
            <button onclick="window.closePrintCenter()" class="bg-slate-200 px-4 py-2 rounded">إلغاء</button>
            <button onclick="window.doPrintSelected()" class="bg-indigo-600 text-white px-4 py-2 rounded font-bold">🖨️ طباعة</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }
    modal.style.display = 'block';
  };
  window.closePrintCenter = function(){ const m = $('printOv'); if(m) m.style.display = 'none'; };
  window.doPrintSelected = function(){
    const selected = [...document.querySelectorAll('.pcb:checked')].map(c => c.value);
    if(!selected.length) return alert('⚠️ اختر قسماً');
    alert('جاري تحضير الطباعة للأقسام: ' + selected.join(', '));
    window.closePrintCenter();
  };

  /* PATCH 4: الشيتات المتعددة */
  let scenarios = [];
  try { scenarios = JSON.parse(localStorage.getItem('acc_scenarios') || '[]'); } catch(e) { scenarios = []; }
  let activeScenario = parseInt(localStorage.getItem('acc_active_scenario') || '0', 10) || 0;

  function saveLS(){
    try { localStorage.setItem('acc_scenarios', JSON.stringify(scenarios)); localStorage.setItem('acc_active_scenario', String(activeScenario)); } catch(e){}
  }
  window.saveCurrentScenario = function(){
    if(!scenarios[activeScenario]) return;
    scenarios[activeScenario].entries = JSON.parse(JSON.stringify(entries));
    scenarios[activeScenario].accounts = [...accounts];
    scenarios[activeScenario].types = {...types};
    scenarios[activeScenario].codes = {...codes};
    saveLS();
  };
  window.loadScenario = function(i){
    if(i === activeScenario) return;
    window.saveCurrentScenario();
    activeScenario = i;
    const s = scenarios[i]; if(!s) return;
    entries = JSON.parse(JSON.stringify(s.entries || []));
    accounts = [...(s.accounts || [])];
    types = {...(s.types || {})};
    codes = {...(s.codes || {})};
    try {
      localStorage.setItem('acc_entries', JSON.stringify(entries));
      localStorage.setItem('acc_list', JSON.stringify(accounts));
      localStorage.setItem('acc_types', JSON.stringify(types));
      localStorage.setItem('acc_codes', JSON.stringify(codes));
      localStorage.setItem('acc_active_scenario', String(activeScenario));
    } catch(e){}
    if(typeof refreshSelects === 'function') refreshSelects();
    if(typeof renderAll === 'function') renderAll();
    renderScenarioTabs();
  };
  window.newScenario = function(){
    window.saveCurrentScenario();
    const name = prompt('📑 اسم الشيت:', 'السيناريو ' + (scenarios.length + 1));
    if(name === null) return;
    scenarios.push({ id: 's'+Date.now(), name: (name||'').trim() || ('شيت '+(scenarios.length+1)), entries: [], accounts: [...DEF], types: {...DT}, codes: {...DC} });
    saveLS(); window.loadScenario(scenarios.length - 1);
  };
  window.renameScenario = function(i){
    const n = prompt('📝 اسم الشيت:', scenarios[i].name);
    if(n && n.trim()){ scenarios[i].name = n.trim().slice(0,30); saveLS(); renderScenarioTabs(); }
  };
  window.deleteScenario = function(i){
    if(scenarios.length <= 1){ alert('⚠️ لا يمكن حذف آخر شيت'); return; }
    if(!confirm('🗑 حذف الشيت؟')) return;
    scenarios.splice(i,1);
    if(activeScenario >= scenarios.length) activeScenario = scenarios.length - 1;
    saveLS(); window.loadScenario(activeScenario);
  };
  window.renderScenarioTabs = function(){
    let box = $('scenarioTabs');
    if(!box){
      const appRoot = $('appRoot'); if(!appRoot) return;
      const bar = document.createElement('div');
      bar.id = 'scenarioTabs';
      bar.className = 'bg-slate-100 rounded-xl p-2 shadow flex flex-wrap gap-1 items-center no-print';
      bar.style.cssText = 'margin-bottom:8px;overflow-x:auto';
      const header = appRoot.querySelector('header');
      if(header) appRoot.insertBefore(bar, header.nextSibling);
      else appRoot.insertBefore(bar, appRoot.firstChild);
      box = bar;
    }
    let html = '<span class="text-xs text-slate-600 font-bold mx-1 shrink-0">📑 الشيتات:</span>';
    html += scenarios.map((s,i) => {
      const cnt = (s.entries||[]).length;
      const act = i === activeScenario;
      return `<button onclick="window.loadScenario(${i})" ondblclick="window.renameScenario(${i})" class="px-3 py-1 text-sm rounded-t border shrink-0 ${act?'bg-white font-bold text-indigo-700 border-indigo-400 shadow':'bg-slate-200 border-slate-300 text-slate-600 hover:bg-slate-300'}">${esc(s.name)} <span class="text-xs ${act?'text-indigo-500':'text-slate-400'}">(${cnt})</span></button>`;
    }).join('');
    html += `<button onclick="window.newScenario()" class="px-3 py-1 text-sm bg-indigo-100 rounded-t border border-indigo-300 text-indigo-700 font-bold shrink-0">＋ شيت جديد</button>`;
    if(scenarios.length > 1) html += `<button onclick="window.deleteScenario(${activeScenario})" class="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded mr-auto shrink-0">🗑 حذف</button>`;
    box.innerHTML = html;
  };
  const _origSet = store.set.bind(store);
  store.set = function(k, v){
    _origSet(k, v);
    if(['acc_entries','acc_list','acc_types','acc_codes'].includes(k)){
      try { window.saveCurrentScenario(); clearTimeout(window._scTabTimer); window._scTabTimer = setTimeout(window.renderScenarioTabs, 400); } catch(e){}
    }
  };

  function initScenarios(){
    if(!scenarios.length){
      scenarios = [{id:'s'+Date.now(), name:'السيناريو 1', entries: JSON.parse(JSON.stringify(entries)), accounts: [...accounts], types: {...types}, codes: {...codes}}];
      activeScenario = 0; saveLS();
    } else {
      activeScenario = Math.min(activeScenario, scenarios.length - 1);
      const s = scenarios[activeScenario];
      entries = JSON.parse(JSON.stringify(s.entries || []));
      accounts = [...(s.accounts || [])];
      types = {...(s.types || {})};
      codes = {...(s.codes || {})};
      try {
        localStorage.setItem('acc_entries', JSON.stringify(entries));
        localStorage.setItem('acc_list', JSON.stringify(accounts));
        localStorage.setItem('acc_types', JSON.stringify(types));
        localStorage.setItem('acc_codes', JSON.stringify(codes));
      } catch(e){}
      if(typeof refreshSelects === 'function') refreshSelects();
      if(typeof renderAll === 'function') renderAll();
    }
    window.renderScenarioTabs();
  }

  function addSidebarButtons(){
    const nav = $('sbNav'); if(!nav || $('sbPrintBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'sbPrintBtn';
    btn.className = 'navBtn w-full text-right px-3 py-2.5 rounded-lg font-bold transition text-slate-700 hover:bg-slate-100';
    btn.innerHTML = '🖨️ مركز الطباعة';
    btn.onclick = function(){ window.openPrintCenter(); if(typeof closeSidebar === 'function') closeSidebar(); };
    const tools = $('t-tools');
    if(tools && tools.parentNode) tools.parentNode.insertBefore(btn, tools.nextSibling);
    else nav.appendChild(btn);
  }

  initScenarios();
  addSidebarButtons();
  injectAddAssetButton();

  const _origTab = window.tab;
  window.tab = function(n){
    if(typeof _origTab === 'function') _origTab.call(this, n);
    setTimeout(function(){ addSidebarButtons(); injectAddAssetButton(); }, 100);
  };
  document.addEventListener('toggle', function(ev){
    if(ev.target && ev.target.tagName === 'DETAILS') setTimeout(injectAddAssetButton, 100);
  }, true);
  console.log('✅ EDU_Acc patches ready');
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
