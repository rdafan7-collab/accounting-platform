/* ========================================================================
   EDU_Acc — smart-parser.js
   مساعد ذكي لتحليل حقل "البيان" واستخراج القيد المحاسبي تلقائياً
   ======================================================================== */
(function(){
'use strict';

/* ===== قاموس الكلمات المفتاحية ===== */
const KW_ASSETS = {
  'أثاث':'الأثاث','مفروشات':'الأثاث','أثاث مكتبي':'الأثاث',
  'سيارة':'السيارات','سيارات':'السيارات','عربية':'السيارات','مركبة':'السيارات',
  'أرض':'الأراضي','أراضي':'الأراضي',
  'مبنى':'المباني','مباني':'المباني','عقار':'العقارات','عقارات':'العقارات',
  'معدات':'المعدات','تجهيزات':'المعدات',
  'أجهزة':'الأجهزة','جهاز':'الأجهزة',
  'آلات':'الآلات','آلة':'الآلات','ماكينة':'الآلات',
  'حاسب':'أجهزة الحاسب','كمبيوتر':'أجهزة الحاسب','لابتوب':'أجهزة الحاسب'
};
const KW_EXPENSES = {
  'أجور':'مصروف الأجور','مرتبات':'مصروف الأجور','رواتب':'مصروف الأجور',
  'إيجار':'مصروف الإيجار','ايجار':'مصروف الإيجار',
  'كهرباء':'مصروف الكهرباء',
  'مياه':'مصروف المياه','ماء':'مصروف المياه',
  'تليفون':'مصروف الهاتف','هاتف':'مصروف الهاتف','اتصالات':'مصروف الهاتف',
  'إنترنت':'مصروف الإنترنت','انترنت':'مصروف الإنترنت',
  'صيانة':'مصروف الصيانة',
  'نقل':'مصروف النقل','مواصلات':'مصروف النقل',
  'إعلان':'مصروف الإعلان','اعلان':'مصروف الإعلان','دعاية':'مصروف الإعلان',
  'تأمين':'مصروف التأمين',
  'قرطاسية':'مصروف القرطاسية','أدوات مكتبية':'مصروف القرطاسية',
  'فوائد':'مصروف الفوائد','فائدة':'مصروف الفوائد'
};

/* ===== دوال مساعدة ===== */
function normalize(text){
  return text.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
             .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0));
}
function extractAmount(text){
  const t = normalize(text);
  const matches = t.match(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g);
  if(!matches || !matches.length) return null;
  const nums = matches.map(x => parseFloat(x.replace(/,/g, ''))).filter(n => !isNaN(n) && n > 0);
  if(!nums.length) return null;
  let max = Math.max(...nums);
  const idx = t.indexOf(String(max));
  if(idx >= 0){
    const around = t.substring(Math.max(0, idx - 15), Math.min(t.length, idx + String(max).length + 15));
    if(/ألف|الف/.test(around)) max *= 1000;
    else if(/مليون/.test(around)) max *= 1000000;
    else if(/مليار/.test(around)) max *= 1000000000;
  }
  return max;
}
function detectItem(text){
  for(const [kw, name] of Object.entries(KW_ASSETS)) if(text.includes(kw)) return {name, type:'asset'};
  for(const [kw, name] of Object.entries(KW_EXPENSES)) if(text.includes(kw)) return {name, type:'expense'};
  return null;
}

/* ===== المحرك الأساسي: تحليل نص البيان ===== */
function smartParse(rawText){
  const text = (rawText || '').trim();
  if(!text) return {error:'✍️ اكتب وصف العملية في حقل «البيان» الأول.'};
  const amount = extractAmount(text);
  if(!amount) return {error:'❓ مفيش مبلغ واضح في البيان. اكتب المبلغ بالأرقام (مثال: 5000).'};

  const payCash  = /نقدا|نقداً|كاش/.test(text);
  const payCheque= /شيك|بالبنك|من البنك|تحويل بنكي/.test(text);
  const onCredit = /على الحساب|بالأجل|على حساب|أجل|آجل/.test(text);
  const payMethod = payCash ? 'النقدية' : payCheque ? 'البنك' : null;

  const isBuy      = /شراء|اشترى|اشترت|أشترى|بتشتري/.test(text);
  const isSell     = /بيع|باع|باعت|بيعت/.test(text);
  const isPay      = /دفع|سدد|سداد|سـدد|دفعت/.test(text);
  const isCollect  = /حصل|حصّل|استلم|تحصيل/.test(text);
  const isCapital  = /رأس المال|رأس مال|بدأ|بدء|افتتح|تأسيس/.test(text);
  const isWithdraw = /سحب|مسحوبات|سحب شخصي/.test(text);
  const isLoan     = /قرض|اقترض/.test(text);
  const isDeposit  = /أودع|ايداع|إيداع/.test(text);

  const item = detectItem(text);
  const debit = [], credit = [], notes = [];

  /* 1) رأس المال */
  if(isCapital){
    debit.push({a: payMethod || 'النقدية', m: amount});
    credit.push({a:'رأس المال', m: amount});
    notes.push('قيد افتتاحي: الأصول المقدمة مدين، رأس المال دائن.');
    return {debits:debit, credits:credit, amount, type:'capital', notes};
  }
  /* 2) قرض */
  if(isLoan){
    debit.push({a: payMethod || 'النقدية', m: amount});
    credit.push({a:'قرض بنكي', m: amount});
    notes.push('قرض جديد: النقدية/البنك مدين، القرض دائن.');
    return {debits:debit, credits:credit, amount, type:'loan', notes};
  }
  /* 3) شراء */
  if(isBuy){
    const debitAcc = (item && item.type === 'asset') ? item.name : 'المشتريات';
    debit.push({a: debitAcc, m: amount});
    if(onCredit){
      credit.push({a:'الموردون', m: amount});
      notes.push('شراء آجل: التزام على المنشأة تجاه الموردين.');
    } else {
      credit.push({a: payMethod || 'النقدية', m: amount});
      notes.push(payMethod === 'البنك' ? 'شراء بشيك على البنك.' : 'شراء نقدي.');
    }
    return {debits:debit, credits:credit, amount, type:'buy', notes};
  }
  /* 4) بيع */
  if(isSell){
    if(onCredit) debit.push({a:'العملاء', m: amount});
    else debit.push({a: payMethod || 'النقدية', m: amount});
    credit.push({a:'المبيعات', m: amount});
    notes.push(onCredit ? 'بيع آجل: يصبح مديونية على العملاء.' : 'بيع نقدي.');
    return {debits:debit, credits:credit, amount, type:'sell', notes};
  }
  /* 5) تحصيل من العملاء */
  if(isCollect){
    debit.push({a: payMethod || 'النقدية', m: amount});
    credit.push({a:'العملاء', m: amount});
    notes.push('تحصيل: النقدية/البنك مدين، والعملاء دائن.');
    return {debits:debit, credits:credit, amount, type:'collect', notes};
  }
  /* 6) سحب شخصي */
  if(isWithdraw){
    debit.push({a:'المسحوبات', m: amount});
    credit.push({a: payMethod || 'النقدية', m: amount});
    notes.push('مسحوبات المالك: تُسجل بالمدين.');
    return {debits:debit, credits:credit, amount, type:'withdraw', notes};
  }
  /* 7) دفع مصروف */
  if(isPay || isDeposit){
    if(item && item.type === 'expense') debit.push({a: item.name, m: amount});
    else if(item) debit.push({a: item.name, m: amount});
    else { debit.push({a:'مصروف', m: amount}); notes.push('⚠️ نوع المصروف غير محدد بدقة — راجع الحساب.'); }
    credit.push({a: payMethod || 'النقدية', m: amount});
    return {debits:debit, credits:credit, amount, type:'expense', notes};
  }

  /* مفيش تطابق واضح */
  return {error:'❓ لم أستطع تحديد نوع العملية. جرّب صياغة أوضح (زي: شراء بضاعة نقداً 5000).'};
}

/* ===== ضمان وجود الحساب في الدليل ===== */
function guessType(name){
  if(/نقدية|بنك|عملاء|أثاث|سيارات|أرض|مباني|أجهزة|معدات|آلات|مخزون|مصروفات مقدمة|إيرادات مستحقة/.test(name)) return 'A';
  if(/موردون|قرض|مصروفات مستحقة|إيرادات مقدمة|ضريبة مبيعات|أوراق دفع/.test(name)) return 'L';
  if(/رأس المال|مسحوبات|ملخص الدخل/.test(name)) return 'E';
  if(/مبيعات|إيرادات|إيراد|خصم مكتسب|مردودات المشتريات/.test(name)) return 'R';
  if(/مصروف|مشتريات|خصم مسموح|مردودات المبيعات/.test(name)) return 'X';
  return 'A';
}
function ensureAccount(name){
  if(!name) return;
  if(accounts.includes(name)) return;
  const t = guessType(name);
  accounts.push(name);
  types[name] = t;
  if(!codes[name]) codes[name] = autoCode({A:'11',L:'21',E:'3',R:'4',X:'5'}[t] || '11');
  try{
    store.set('acc_list', accounts);
    store.set('acc_types', types);
    store.set('acc_codes', codes);
  }catch(e){}
}

/* ===== مقارنة قيد المستخدم مع القيد المقترح ===== */
function compare(user, smart){
  const uD = user.debits.map(x => x.a + ':' + (+x.m).toFixed(2)).sort().join('|');
  const uC = user.credits.map(x => x.a + ':' + (+x.m).toFixed(2)).sort().join('|');
  const sD = smart.debits.map(x => x.a + ':' + (+x.m).toFixed(2)).sort().join('|');
  const sC = smart.credits.map(x => x.a + ':' + (+x.m).toFixed(2)).sort().join('|');
  if(!user.debits.length && !user.credits.length) return {status:'empty', msg:'لم تكتب قيداً بعد — شوف الاقتراح 👇'};
  if(uD === sD && uC === sC) return {status:'perfect', msg:'🎉 ممتاز! قيدك مطابق تماماً للقيد الصحيح.'};
  if(uD === sC && uC === sD) return {status:'swapped', msg:'⚠️ الأطراف صحيحة بس الموضوعين بالمقلوب (مدين ↔ دائن).'};
  const uAcc = [...user.debits, ...user.credits].map(x => x.a).sort().join(',');
  const sAcc = [...smart.debits, ...smart.credits].map(x => x.a).sort().join(',');
  if(uAcc === sAcc) return {status:'amount', msg:'⚠️ الحسابات صحيحة، لكن المبالغ مش مطابقة.'};
  return {status:'diff', msg:'❌ القيد مختلف — راجع الأطراف والمبالغ.'};
}

/* ===== العرض ===== */
window._lastSuggestion = null;
function showResult(res){
  const box = document.getElementById('verifyResult');
  if(!box) return;
  if(res.error){
    box.className = 'mt-3 text-right rounded-lg p-3 bg-rose-50 border border-rose-300 text-rose-800 text-sm no-print';
    box.innerHTML = res.error;
    box.classList.remove('hidden');
    return;
  }
  const {parsed, user, cmp} = res;
  const colorMap = {
    perfect:'bg-emerald-50 border-emerald-300 text-emerald-900',
    swapped:'bg-amber-50 border-amber-300 text-amber-900',
    amount :'bg-amber-50 border-amber-300 text-amber-900',
    diff   :'bg-rose-50 border-rose-300 text-rose-900',
    empty  :'bg-indigo-50 border-indigo-300 text-indigo-900'
  };
  const cls = colorMap[cmp.status] || 'bg-slate-50 border-slate-300';
  const fmtNum = n => (typeof fmt === 'function') ? fmt(n) : n.toLocaleString('ar-EG');
  const fmtLines = (list, label) => list.map(x =>
    `<div class="flex justify-between gap-2 py-0.5"><span>${label} ${x.a}</span><span class="font-mono font-bold">${fmtNum(x.m)}</span></div>`
  ).join('');
  box.className = `mt-3 text-right rounded-lg p-4 border ${cls} no-print`;
  box.classList.remove('hidden');
  box.innerHTML = `
    <div class="font-bold mb-3 text-base">${cmp.msg}</div>
    <div class="grid md:grid-cols-2 gap-3 text-sm">
      <div class="bg-white rounded-lg p-3 border shadow-sm">
        <div class="font-bold text-indigo-700 mb-2">💡 القيد المقترح تلقائياً:</div>
        <div class="text-emerald-700 font-bold mb-1">من حـ/ (مدين)</div>
        ${fmtLines(parsed.debits, '')}
        <div class="text-rose-700 font-bold mt-2 mb-1">إلى حـ/ (دائن)</div>
        ${fmtLines(parsed.credits, '')}
      </div>
      ${(user.debits.length || user.credits.length) ? `
      <div class="bg-white rounded-lg p-3 border shadow-sm">
        <div class="font-bold text-slate-700 mb-2">📝 قيدك إنت:</div>
        <div class="text-emerald-700 font-bold mb-1">من حـ/ (مدين)</div>
        ${fmtLines(user.debits, '')}
        <div class="text-rose-700 font-bold mt-2 mb-1">إلى حـ/ (دائن)</div>
        ${fmtLines(user.credits, '')}
      </div>` : ''}
    </div>
    ${parsed.notes && parsed.notes.length ? `<div class="text-xs text-slate-700 mt-3 italic">📖 ${parsed.notes.join(' • ')}</div>` : ''}
    <div class="flex flex-wrap gap-2 mt-3 pt-3 border-t">
      <button type="button" onclick="window.applySuggestion()" class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded">📥 استخدم القيد المقترح</button>
      <button type="button" onclick="window.closeSmartResult()" class="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs px-4 py-2 rounded">إغلاق</button>
      <span class="text-xs text-slate-500 self-center mr-auto">💡 عدّل قيدك واتحقق تاني</span>
    </div>
  `;
}
window.closeSmartResult = function(){
  const box = document.getElementById('verifyResult');
  if(box){ box.classList.add('hidden'); box.innerHTML = ''; }
};

/* ===== زر التحقق ===== */
window.checkEntrySmart = function(){
  const descEl = document.getElementById('desc');
  const desc = (descEl && descEl.value || '').trim();
  if(!desc){ showResult({error:'✍️ اكتب وصف العملية في حقل «البيان» الأول.'}); return; }
  const parsed = smartParse(desc);
  if(parsed.error){ showResult({error: parsed.error}); return; }
  let userDebits = [], userCredits = [];
  try{
    if(typeof readRows === 'function'){
      userDebits  = readRows('d');
      userCredits = readRows('c');
    }
  }catch(e){}
  const cmp = compare({debits:userDebits, credits:userCredits}, parsed);
  window._lastSuggestion = parsed;
  showResult({parsed, user:{debits:userDebits, credits:userCredits}, cmp});
};

/* ===== تطبيق القيد المقترح على الفورم ===== */
window.applySuggestion = function(){
  const p = window._lastSuggestion;
  if(!p) return;
  // ضمان وجود كل الحسابات في الدليل
  [...p.debits, ...p.credits].forEach(x => ensureAccount(x.a));
  if(typeof refreshSelects === 'function') refreshSelects();

  const dBox = document.getElementById('dRows');
  const cBox = document.getElementById('cRows');
  if(!dBox || !cBox || typeof addRow !== 'function') return;
  dBox.innerHTML = ''; cBox.innerHTML = '';

  p.debits.forEach(item => {
    addRow('d');
    const rows = dBox.querySelectorAll('.row');
    const last = rows[rows.length - 1];
    const sel = last.querySelector('select');
    const amt = last.querySelector('.amt');
    sel.value = item.a;
    if(sel.value !== item.a){
      // fallback: أضف الخيار يدوياً
      const opt = document.createElement('option');
      opt.value = item.a; opt.textContent = item.a;
      sel.appendChild(opt); sel.value = item.a;
    }
    amt.value = item.m;
  });
  p.credits.forEach(item => {
    addRow('c');
    const rows = cBox.querySelectorAll('.row');
    const last = rows[rows.length - 1];
    const sel = last.querySelector('select');
    const amt = last.querySelector('.amt');
    sel.value = item.a;
    if(sel.value !== item.a){
      const opt = document.createElement('option');
      opt.value = item.a; opt.textContent = item.a;
      sel.appendChild(opt); sel.value = item.a;
    }
    amt.value = item.m;
  });
  if(typeof calc === 'function') calc();
  closeSmartResult();
  // scroll للفورم
  const form = document.getElementById('f');
  if(form) form.scrollIntoView({behavior:'smooth', block:'center'});
};

/* ===== حقن الزر داخل الفورم ===== */
function injectVerifyButton(){
  const form = document.getElementById('f');
  if(!form || document.getElementById('verifyBtn')) return;
  const saveBtn = form.querySelector('button.w-full') || form.querySelector('button[type="submit"]');
  const wrap = document.createElement('div');
  wrap.className = 'space-y-2';
  wrap.innerHTML = `
    <div class="text-center no-print">
      <button type="button" id="verifyBtn" onclick="window.checkEntrySmart()"
        class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-lg shadow inline-flex items-center gap-2">
        🔍 تحقق من القيود (مساعد ذكي)
      </button>
      <span class="block text-xs text-slate-500 mt-1">اكتب البيان (مثال: شراء بضاعة نقداً 5000) ثم اضغط التحقق</span>
    </div>
    <div id="verifyResult" class="hidden"></div>
  `;
  if(saveBtn && saveBtn.parentNode) saveBtn.parentNode.insertBefore(wrap, saveBtn);
  else form.appendChild(wrap);
}

/* ===== التهيئة ===== */
function init(){
  if(typeof window.addRow !== 'function' || typeof window.readRows !== 'function'){
    setTimeout(init, 250);
    return;
  }
  injectVerifyButton();
  console.log('✅ Smart parser ready');
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();