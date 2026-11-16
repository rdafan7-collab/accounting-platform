/* ============================================================================
   EDU_Acc — باتش الواقعية / مود الاحتراف (Pro-Mode Module)  v1.0
   ----------------------------------------------------------------------------
   ملف خارجي مستقل: لا يعدّل أي سطر في كود النواة. يُحمَّل بسطر واحد في آخر index.html:
       <script src="pro-mode.js"></script>      (بعد patches.js و smart-parser.js)
   - يضيف زر "مود الاحتراف / الواقعية" أعلى الواجهة (للفرقة 3 و4 وللمعلم).
   - عند الضغط يتحول التصميم لنظام ERP كامل: فواتير، سندات، أصول وإهلاك،
     ضرائب، مراجعة، تقارير (يومية/أستاذ/ميزان/أرباح وخسائر)، وشيتات شركات حقيقية.
   - كل القيود الناتجة تُكتب في نفس مخزن النواة (acc_entries) فتظهر في كل شاشات المنصة.
   إعدادات اختيارية قبل تحميل الملف:
       window.PROMODE_CONFIG = { allowedYears:[1,2,3,4], vatRate:14, currency:'ج.م' }
   ============================================================================ */
(function () {
  'use strict';
  if (window.__PRO_MODE_LOADED) return;
  window.__PRO_MODE_LOADED = true;

  var CFG = Object.assign({ allowedYears: [3, 4], teacherAlways: true }, window.PROMODE_CONFIG || {});

  /* ---------------------------------------------------------------- أدوات عامة */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var E = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var R2 = function (x) { return Math.round((+x || 0) * 100) / 100; };
  var today = function () { var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
  var uid = function () { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  var LOCALE = function () { try { return LOC; } catch (e) { return 'ar-EG'; } };
  var N = function (n) { return R2(n).toLocaleString(LOCALE(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  var TN_ = { A: 'أصول', L: 'خصوم', E: 'حقوق ملكية', R: 'إيرادات', X: 'مصروفات' };
  var pad = function (n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; };

  /* ---------------------------------------------------------------- الوصول لمخزن النواة */
  var coreOK = function () {
    try { return typeof entries !== 'undefined' && typeof accounts !== 'undefined' && typeof types !== 'undefined' && typeof codes !== 'undefined' && typeof store !== 'undefined'; }
    catch (e) { return false; }
  };
  var S = {
    get: function (k, d) { try { if (typeof store !== 'undefined') return store.get(k, d); var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { if (typeof store !== 'undefined') store.set(k, v); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  };

  /* بيانات الاحتراف الخاصة بالموديول */
  var DB = { invoices: [], vouchers: [], assets: [], companies: [], settings: {} };
  var KEYS = { invoices: 'pro_invoices', vouchers: 'pro_vouchers', assets: 'pro_assets', companies: 'pro_companies', settings: 'pro_settings' };
  /* ----------------------------------------------------------------------------
     وجهة ترحيل القيود
     ----------------------------------------------------------------------------
     قبل كده كل قيد بيتكتب تلقائيًا في دفتر المنصة الأكاديمية (acc_entries).
     دلوقتي المستخدم بيختار: إما «المنصة الأكاديمية» أو «دفتر اليومية المهني»
     (pro_entries) وهو دفتر مستقل بيظهر جوه مود الاحتراف فقط.
     كل دفتر بقى له نطاقه: القيود والمستندات بتاعة كل دفتر ما بتختلطش ببعض.
     ---------------------------------------------------------------------------- */
  var PRO_BOOK = { sheets: {} };
  function journalNow() { return DB.settings.journal === 'pro' ? 'pro' : 'academic'; }
  /* الدفتر المهني مخزّن لكل شيت على حدة، زي دفتر المنصة بالظبط */
  function proList() {
    var s = scopeNow();
    if (!PRO_BOOK.sheets) PRO_BOOK.sheets = {};
    if (!Array.isArray(PRO_BOOK.sheets[s])) PRO_BOOK.sheets[s] = [];
    return PRO_BOOK.sheets[s];
  }
  function jEntries() { return journalNow() === 'pro' ? proList() : entries; }
  function jSave() { if (journalNow() === 'pro') S.set('pro_entries', PRO_BOOK); else S.set('acc_entries', entries); }
  function jAll() { return entries.concat(proList()); }
  function loadDB() {
    _probe = null; _scope = '';
    DB.invoices = S.get(KEYS.invoices, []); DB.vouchers = S.get(KEYS.vouchers, []);
    DB.assets = S.get(KEYS.assets, []); DB.companies = S.get(KEYS.companies, []);
    var book = S.get('pro_entries', null);
    PRO_BOOK = (book && book.sheets) ? book : { sheets: {} };
    /* ترحيل شكل قديم (مصفوفة عامة) إلى الشيت الحالي */
    if (Array.isArray(book) && book.length) PRO_BOOK.sheets[scopeNow()] = book;
    DB.settings = Object.assign({ company: 'شركتي التجريبية', currency: 'ج.م', vat: 14, journal: 'academic' }, CFG.vatRate != null ? { vat: CFG.vatRate } : {}, CFG.currency ? { currency: CFG.currency } : {}, S.get(KEYS.settings, {}));
    try { if (typeof SYNC_KEYS !== 'undefined' && Array.isArray(SYNC_KEYS)) [KEYS.invoices, KEYS.vouchers, KEYS.assets, KEYS.settings, 'pro_entries'].forEach(function (k) { if (SYNC_KEYS.indexOf(k) < 0) SYNC_KEYS.push(k); }); } catch (e) { }
    migrateScopes();
  }
  var saveDB = function (k) { S.set(KEYS[k], DB[k]); };

  /* ----------------------------------------------------------------------------
     نطاق بيانات الاحتراف (Scope)
     ----------------------------------------------------------------------------
     المشكلة: سجلات الفواتير/السندات/الأصول/المخازن/العقود كانت مخزنة بشكل عام،
     بينما القيود نفسها مخزنة داخل «شيت» (سيناريو محلي أو شيت سحابي). فلو فُتح
     المود على شيت آخر، كانت مراجعة السجلات تحذف أي سجل قيده غير موجود في الشيت
     الحالي. الحل: كل سجل يحمل كود الشيت الذي أُنشئ فيه، والعرض والمراجعة يحصلان
     على سجلات الشيت الحالي فقط، مع ترحيل السجلات القديمة تلقائيًا عند أول تحميل.
     ---------------------------------------------------------------------------- */
  var _scope = '', _probe = null, _scopeAt = 0;
  function scenarioId() {
    var probe;
    try {
      probe = (typeof activeSheet !== 'undefined' && activeSheet && activeSheet.sheetId)
        ? 'cloud:' + activeSheet.sheetId
        : 'local:' + (localStorage.getItem('acc_active_scenario') || 0);
    } catch (e) { return 'sheet:local'; }
    /* التخزين المؤقت يقلل قراءة الشيتات الكبيرة أثناء الرسم، ويتجدد تلقائيًا لو تغيّر الشيت */
    if (probe === _probe && _scope && (Date.now() - _scopeAt) < 1200) return _scope;
    _probe = probe; _scopeAt = Date.now();
    if (probe.indexOf('cloud:') === 0) _scope = probe;
    else {
      try {
        var list = JSON.parse(localStorage.getItem('acc_scenarios') || '[]'), i = +probe.slice(6);
        _scope = (list[i] && list[i].id) ? 'sheet:' + list[i].id : 'sheet:local';
      } catch (e) { _scope = 'sheet:local'; }
    }
    return _scope;
  }
  function scopeNow() { return scenarioId(); }
  /* اسم الشيت الحالي لعرضه أعلى مساحة العمل */
  function sheetName() {
    try {
      if (typeof activeSheet !== 'undefined' && activeSheet && activeSheet.name) return activeSheet.name;
      var i = +(localStorage.getItem('acc_active_scenario') || 0);
      var list = JSON.parse(localStorage.getItem('acc_scenarios') || '[]');
      return (list[i] && list[i].name) || 'شيت محلي';
    } catch (e) { return ''; }
  }
  /* ---------------------------- شريط الشيتات داخل المود
     بيقرأ نفس قائمة الشيتات اللي في الوضع الأكاديمي (acc_scenarios)
     عشان الطالب يروح لشيت قديم من هنا بدل ما يخرج ويرجع. */
  function sheetsNow() {
    try {
      var list = JSON.parse(localStorage.getItem('acc_scenarios') || '[]');
      var act = +(localStorage.getItem('acc_active_scenario') || 0);
      return { list: Array.isArray(list) ? list : [], act: isNaN(act) ? 0 : act };
    } catch (e) { return { list: [], act: 0 }; }
  }
  function renderSheetBar() {
    var box = $('#pmSheets'); if (!box) return;
    var d = sheetsNow();
    var newBtn = '<button class="pm-b o" data-act="newSheet" style="margin-inline-start:auto">＋ شيت جديد</button>';
    if (!d.list.length) { box.innerHTML = '<span class="pm-shlab">📑 الشيتات:</span>' + newBtn; return; }
    box.innerHTML = '<span class="pm-shlab">📑 الشيتات:</span>' + d.list.map(function (s, i) {
      return '<button class="pm-chip' + (i === d.act ? ' on' : '') + '" data-sheet="' + i + '" title="اضغط للتبديل — دبل كليك لإعادة التسمية">' +
        E(s.name || ('شيت ' + (i + 1))) + ' <small>(' + ((s.entries || []).length) + ')</small></button>';
    }).join('') + newBtn + (d.list.length > 1 ? '<button class="pm-b s r" data-sheet-del="1" title="حذف الشيت الحالي">🗑</button>' : '');
  }
  function switchSheet(i) {
    var d = sheetsNow();
    if (!Number.isInteger(i) || i < 0 || !d.list[i] || i === d.act) return;
    if (typeof window.loadScenario !== 'function') return;
    /* تنظيف اختيارات الشيت القديم (شركة/أصل) قبل ما نعرض بيانات الشيت الجديد */
    state.cs = { id: null, tab: 'tb' }; state.selAsset = null;
    try { window.loadScenario(i); } catch (e) { console.error(e); }
    loadDB(); renderPage();
    toast('تم التبديل إلى «' + (d.list[i].name || ('شيت ' + (i + 1))) + '» 📑');
  }
  var inScope = function (x) { if (!_scope) scenarioId(); return !!x && x.scope === _scope; };
  /* المستند بيتبع الشيت + الدفتر: مستندات الدفتر الأكاديمي ما تظهرش جوه الدفتر المهني والعكس */
  var scoped = function (arr) {
    scenarioId(); var j = journalNow();
    return (arr || []).filter(function (x) { return inScope(x) && (x.jrn || 'academic') === j; });
  };
  function migrateScopes() {
    var sc = scopeNow(), chI = false, chV = false, chA = false;
    DB.invoices.forEach(function (x) { if (!x.scope) { x.scope = sc; chI = true; } if (!x.jrn) { x.jrn = 'academic'; chI = true; } });
    DB.vouchers.forEach(function (x) { if (!x.scope) { x.scope = sc; chV = true; } if (!x.jrn) { x.jrn = 'academic'; chV = true; } });
    DB.assets.forEach(function (x) { if (!x.scope) { x.scope = sc; chA = true; } if (!x.jrn) { x.jrn = 'academic'; chA = true; } });
    if (chI) saveDB('invoices'); if (chV) saveDB('vouchers'); if (chA) saveDB('assets');
  }

  /* ---------------------------------------------------------------- المنطق المحاسبي (بدون DOM) */
  var typeOf = function (a) { return types[a] || ''; };
  var codeOf = function (a) { return codes[a] || ''; };
  var byCodeAcc = function (x, y) { return (codes[x] || '~').localeCompare(codes[y] || '~') || String(x).localeCompare(String(y)); };
  var isCash = function (a) { return typeOf(a) === 'A' && (/^(النقدية|البنك|الصندوق|الخزينة|الخزنة)/.test(a) || /^11(01|02)/.test(codeOf(a))); };
  var isContra = function (a) { return /مجمع|مخصص|محملة/.test(a); };

  function allLines() {
    var out = [];
    jEntries().forEach(function (e, i) {
      (e.debits || []).forEach(function (x) { out.push({ no: i + 1, id: e.id, date: e.date || '', desc: e.desc || '', a: x.a, d: +x.m || 0, c: 0, e: e }); });
      (e.credits || []).forEach(function (x) { out.push({ no: i + 1, id: e.id, date: e.date || '', desc: e.desc || '', a: x.a, d: 0, c: +x.m || 0, e: e }); });
    });
    return out;
  }
  var inR = function (d, f, t) { return (!f || d >= f) && (!t || d <= t); };
  var cmpDN = function (x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : x.no - y.no; };

  function trialData(from, to) {
    var m = {};
    allLines().forEach(function (l) {
      var r = m[l.a] || (m[l.a] = { a: l.a, pd: 0, pc: 0, d: 0, c: 0 });
      if (from && l.date < from) { r.pd += l.d; r.pc += l.c; }
      else if (!to || l.date <= to) { r.d += l.d; r.c += l.c; }
    });
    var rows = Object.keys(m).sort(byCodeAcc).map(function (a) {
      var r = m[a], pn = r.pd - r.pc, en = pn + r.d - r.c;
      return { a: a, code: codeOf(a), pD: pn > 0 ? pn : 0, pC: pn < 0 ? -pn : 0, d: r.d, c: r.c, eD: en > 0.0049 ? en : 0, eC: en < -0.0049 ? -en : 0 };
    });
    var t = rows.reduce(function (s, r) { ['pD', 'pC', 'd', 'c', 'eD', 'eC'].forEach(function (k) { s[k] += r[k]; }); return s; }, { pD: 0, pC: 0, d: 0, c: 0, eD: 0, eC: 0 });
    return { rows: rows, tot: t };
  }

  function ledgerData(acc, from, to) {
    var ls = allLines().filter(function (l) { return l.a === acc; }).sort(cmpDN);
    var open = 0, rows = [], bal, td = 0, tc = 0;
    ls.forEach(function (l) { if (from && l.date < from) open += l.d - l.c; });
    bal = open;
    ls.forEach(function (l) {
      if (!inR(l.date, from, to) || (from && l.date < from)) return;
      var others = (l.d ? l.e.credits : l.e.debits).map(function (x) { return x.a; });
      others = others.filter(function (v, i) { return others.indexOf(v) === i; });
      bal += l.d - l.c; td += l.d; tc += l.c;
      rows.push({ date: l.date, no: l.no, desc: l.desc, other: others.length === 1 ? others[0] : 'متعددة (مذكورين)', d: l.d, c: l.c, bal: bal });
    });
    return { open: open, rows: rows, td: td, tc: tc, end: bal };
  }

  function monthlyPL(year) {
    var R = {}, X = {};
    allLines().forEach(function (l) {
      if (String(l.date).slice(0, 4) !== String(year)) return;
      var t = typeOf(l.a), mo = (+String(l.date).slice(5, 7)) - 1;
      if (mo < 0 || mo > 11) return;
      if (t === 'R') (R[l.a] || (R[l.a] = new Array(12).fill(0)))[mo] += l.c - l.d;
      else if (t === 'X') (X[l.a] || (X[l.a] = new Array(12).fill(0)))[mo] += l.d - l.c;
    });
    var mk = function (o) { return Object.keys(o).sort(byCodeAcc).map(function (a) { return { a: a, m: o[a], tot: o[a].reduce(function (s, v) { return s + v; }, 0) }; }); };
    var rev = mk(R), exp = mk(X);
    var sum12 = function (arr) { var t = new Array(12).fill(0); arr.forEach(function (r) { r.m.forEach(function (v, i) { t[i] += v; }); }); return t; };
    var tr = sum12(rev), te = sum12(exp);
    return { rev: rev, exp: exp, totRev: tr, totExp: te, net: tr.map(function (v, i) { return v - te[i]; }) };
  }

  function lastYear() {
    var y = 0; allLines().forEach(function (l) { var v = +String(l.date).slice(0, 4); if (v > y) y = v; });
    return y || new Date().getFullYear();
  }

  /* الإهلاك: جدول سنوي (قسط ثابت أو متناقص بضعف المعدل مع تناسب شهور السنة الأولى) */
  function depSchedule(a) {
    var life = +a.life || 1, total = Math.max(1, Math.round(life * 12)), cost = +a.cost || 0, sal = +a.salvage || 0, base = Math.max(0, cost - sal);
    var y0 = +String(a.start).slice(0, 4), m0 = (+String(a.start).slice(5, 7) || 1) - 1;
    var chunks = [], left = total, y = y0, m = 12 - m0;
    while (left > 0) { var k = Math.min(m, left); chunks.push({ y: y, m: k }); left -= k; y++; m = 12; }
    var rows = [], open = cost, acc = 0, rate = 2 / life;
    chunks.forEach(function (c, i) {
      var d;
      if (i === chunks.length - 1) d = base - acc;
      else if (a.method === 'db') d = Math.min(open * rate * c.m / 12, open - sal);
      else d = base * c.m / total;
      d = R2(Math.max(0, d)); acc = R2(acc + d);
      rows.push({ y: c.y, open: R2(open), dep: d, acc: acc, close: R2(cost - acc) });
      open = cost - acc;
    });
    return rows;
  }

  /* ضريبة القيمة المضافة */
  var OUT_RE = /ضريبة.*مبيعات|ضريبة القيمة المضافة.*مخرجات/, IN_RE = /ضريبة.*مشتريات|ضريبة القيمة المضافة.*مدخلات/;
  function vatData(from, to) {
    var out = 0, inn = 0;
    allLines().forEach(function (l) {
      if (l.e.src === 'pro-vat' || !inR(l.date, from, to)) return;
      if (OUT_RE.test(l.a)) out += l.c - l.d;
      else if (IN_RE.test(l.a)) inn += l.d - l.c;
    });
    /* القيمة الخاضعة تُقرأ من المستندات الوسمية (فاتورة / مستخلص / خصم وإضافة)
       المخزّنة على القيد نفسه، عشان تبقى القاعدة = الضريبة ÷ النسبة بدون تعارض. */
    var sb = 0, pb = 0, tOut = 0, tIn = 0, mix = 0;
    jEntries().forEach(function (e) {
      if (e.src === 'pro-vat' || e.vatBase == null || !inR(e.date, from, to)) return;
      if (e.vatSide === 'in') { pb += +e.vatBase || 0; tIn += +e.vatAmt || 0; }
      else { sb += +e.vatBase || 0; tOut += +e.vatAmt || 0; }
    });
    /* فواتير قديمة اتسجلت قبل إضافة الوسم: تُقرأ من سجل الفواتير */
    scoped(DB.invoices).forEach(function (v) {
      if (!inR(v.date, from, to)) return;
      var e = jEntries().find(function (x) { return x.id === v.entryId; });
      if (e && e.vatBase != null) return;
      if (v.type === 'sale') sb += +v.net || 0; else pb += +v.net || 0;
    });
    var rate = +DB.settings.vat || 0, dOut = R2(out - tOut), dIn = R2(inn - tIn);
    if (Math.abs(dOut) > 0.005 && rate > 0) { sb += dOut * 100 / rate; mix = 1; }
    if (Math.abs(dIn) > 0.005 && rate > 0) { pb += dIn * 100 / rate; mix = 1; }
    return { out: R2(out), inn: R2(inn), net: R2(out - inn), salesBase: R2(sb), purBase: R2(pb), rate: rate, mix: mix };
  }

  /* المراجعة وتتبع أخطاء القيود */
  function runAudit() {
    var issues = [], t0 = today(), seen = {};
    var add = function (sev, msg, e, i) { issues.push({ sev: sev, msg: msg, no: i + 1, id: e ? e.id : null }); };
    jEntries().forEach(function (e, i) {
      var D = e.debits || [], Cc = e.credits || [];
      var sd = D.reduce(function (s, x) { return s + (+x.m || 0); }, 0), sc = Cc.reduce(function (s, x) { return s + (+x.m || 0); }, 0);
      if (Math.abs(sd - sc) >= 0.005) add('error', 'القيد غير متزن: المدين ' + N(sd) + ' والدائن ' + N(sc), e, i);
      if (D.some(function (x) { return Cc.some(function (y) { return y.a === x.a; }); })) add('error', 'نفس الحساب ظهر في الطرف المدين والدائن معًا', e, i);
      if (D.concat(Cc).some(function (x) { return !(+x.m > 0); })) add('error', 'يوجد سطر بمبلغ صفر أو سالب', e, i);
      D.concat(Cc).forEach(function (x) { if (accounts.indexOf(x.a) < 0) add('error', 'الحساب «' + x.a + '» غير موجود في دليل الحسابات', e, i); else if (!TN_[typeOf(x.a)]) add('warn', 'الحساب «' + x.a + '» غير مصنف (لن يظهر في القوائم المالية)', e, i); });
      if (!String(e.desc || '').trim()) add('warn', 'القيد بدون بيان', e, i);
      if (!e.date || isNaN(Date.parse(e.date))) add('error', 'تاريخ القيد غير صالح', e, i);
      else if (e.date > t0 && e.src !== 'pro-dep') add('warn', 'تاريخ القيد في المستقبل (' + e.date + ')', e, i);
      var sig = [e.date, String(e.desc || '').trim(), R2(sd)].join('|');
      if (seen[sig] != null) add('warn', 'يُحتمل أنه مكرر للقيد رقم ' + (seen[sig] + 1), e, i); else seen[sig] = i;
    });
    var bal = {};
    allLines().forEach(function (l) { bal[l.a] = (bal[l.a] || 0) + l.d - l.c; });
    Object.keys(bal).forEach(function (a) {
      var t = typeOf(a), b = R2(bal[a]);
      if (!b || isContra(a) || /سحوبات|جاري/.test(a)) return;
      if ((t === 'A' || t === 'X') && b < 0) issues.push({ sev: 'warn', msg: 'رصيد غير طبيعي: «' + a + '» (' + TN_[t] + ') رصيده دائن ' + N(-b), no: '—', id: null });
      if ((t === 'L' || t === 'E' || t === 'R') && b > 0) issues.push({ sev: 'warn', msg: 'رصيد غير طبيعي: «' + a + '» (' + TN_[t] + ') رصيده مدين ' + N(b), no: '—', id: null });
    });
    var tb = trialData('', ''), ok = Math.abs(tb.tot.eD - tb.tot.eC) < 0.005;
    if (!ok) issues.unshift({ sev: 'error', msg: 'ميزان المراجعة غير متزن: الفرق ' + N(Math.abs(tb.tot.eD - tb.tot.eC)), no: '—', id: null });
    var bad = {}; issues.forEach(function (x) { if (typeof x.no === 'number') bad[x.no] = 1; });
    var nb = Object.keys(bad).length, nE = jEntries().length;
    return { issues: issues, total: nE, clean: nE - nb, balanced: ok };
  }

  /* إنشاء الحسابات والقيود داخل مخزن النواة */
  function newCode(g) {
    try { if (typeof autoCode === 'function') return autoCode(g); } catch (e) { }
    var n = +(g.length === 1 ? g + '101' : g + '01'), used = {}; Object.keys(codes).forEach(function (k) { used[codes[k]] = 1; });
    while (used[String(n)]) n++; return String(n);
  }
  function ensureAcc(n, t, g) {
    if (accounts.indexOf(n) < 0) { accounts.push(n); S.set('acc_list', accounts); }
    if (!types[n] && t) { types[n] = t; S.set('acc_types', types); }
    if (!codes[n]) { codes[n] = newCode(g || ({ A: '11', L: '21', E: '3', R: '4', X: '5' })[t] || '11'); S.set('acc_codes', codes); }
  }
  function subAcc(base, party, t) {
    ensureAcc(base, t);
    party = String(party || '').trim(); if (!party) return base;
    var n = base + ' - ' + party;
    if (accounts.indexOf(n) < 0) {
      accounts.push(n); S.set('acc_list', accounts); types[n] = typeOf(base) || t; S.set('acc_types', types);
      var bc = codes[base] || '', used = {}; Object.keys(codes).forEach(function (k) { used[codes[k]] = 1; });
      var c = '', i = 1; if (bc) { do { c = bc + pad(i++, 2); } while (used[c] && i < 100); if (used[c]) c = ''; }
      codes[n] = c || newCode((codes[base] || '11').slice(0, 2)); S.set('acc_codes', codes);
    }
    return n;
  }
  function postEntry(desc, D, C, date, extra) {
    var f = function (l) { return l.filter(function (x) { return x[1] > 0.0049; }).map(function (x) { return { a: x[0], m: R2(x[1]) }; }); };
    var d = f(D), c = f(C), sd = d.reduce(function (s, x) { return s + x.m; }, 0), sc = c.reduce(function (s, x) { return s + x.m; }, 0);
    if (!d.length || !c.length || Math.abs(sd - sc) >= 0.005) return null;
    if (d.some(function (x) { return c.some(function (y) { return y.a === x.a; }); })) return null;
    var arr = jEntries();
    var id = Date.now(); arr.forEach(function (e) { if ((+e.id || 0) >= id) id = +e.id + 1; });
    var no = arr.reduce(function (m, e) { return Math.max(m, +e.no || 0); }, 0) + 1;
    arr.push(Object.assign({ id: id, no: no, date: date || today(), desc: desc, debits: d, credits: c }, extra || {}));
    jSave();
    return id;
  }
  function removeEntry(id) {
    var arr = jEntries(), i = arr.findIndex(function (e) { return e.id === id; });
    if (i >= 0) { arr.splice(i, 1); jSave(); }
  }
  /* حذف قيد من أي دفتر (مهني أو أكاديمي) بالمعرّف — بنستخدمه في مسح أثر التوزيع التجريبي.
     القيود التجريبية محمية من التعديل لكن مسموح حذفها عشان الطالب يفضّي الشيت ويجرّب بنفسه. */
  function removeEntryAny(id) {
    var pl = proList(), i = pl.findIndex(function (e) { return String(e.id) === String(id); });
    if (i >= 0) { pl.splice(i, 1); S.set('pro_entries', PRO_BOOK); return true; }
    try {
      if (typeof entries !== 'undefined') {
        var j = entries.findIndex(function (e) { return String(e.id) === String(id); });
        if (j >= 0) { entries.splice(j, 1); if (typeof store !== 'undefined') store.set('acc_entries', entries); return true; }
      }
    } catch (e) { }
    return false;
  }
  /* كل القيود التجريبية (توزيع الحل) في الشيت الحالي — الدفترين مع بعض */
  function demoEntriesAll() { return jAll().filter(function (e) { return !!e.demo; }); }
  /* مسح أثر مفتاح تجريبي واحد (تمرين أو شيت شركة): قيود الدفترين + فواتيره وسنداته وأصوله */
  function clearDemoKey(key) {
    var n = 0;
    var rm = function (arr) { for (var i = arr.length - 1; i >= 0; i--) { if (arr[i] && arr[i].demo === key) { arr.splice(i, 1); n++; } } };
    rm(proList());
    try { if (typeof entries !== 'undefined') rm(entries); } catch (e) { }
    S.set('pro_entries', PRO_BOOK);
    try { if (typeof store !== 'undefined') store.set('acc_entries', entries); } catch (e) { }
    ['invoices', 'vouchers', 'assets'].forEach(function (k) {
      var b = DB[k].length;
      DB[k] = DB[k].filter(function (x) { return x.demo !== key; });
      if (DB[k].length !== b) saveDB(k);
    });
    return n;
  }
  /* مسح كل أثر التوزيع التجريبي في الشيت الحالي مهما كان مصدره (كل التمارين وكل الشركات) */
  function clearAllDemo() {
    var n = 0;
    var rm = function (arr) { for (var i = arr.length - 1; i >= 0; i--) { if (arr[i] && arr[i].demo) { arr.splice(i, 1); n++; } } };
    rm(proList());
    try { if (typeof entries !== 'undefined') rm(entries); } catch (e) { }
    S.set('pro_entries', PRO_BOOK);
    try { if (typeof store !== 'undefined') store.set('acc_entries', entries); } catch (e) { }
    ['invoices', 'vouchers', 'assets'].forEach(function (k) {
      var b = DB[k].length;
      DB[k] = DB[k].filter(function (x) { return !x.demo; });
      if (DB[k].length !== b) saveDB(k);
    });
    return n;
  }

  /* شيتات الشركات: تصنيف الحسابات وحساب القوائم */
  function guessType(name, code) {
    var n = String(name || ''), c = String(code || '').trim();
    if (/مجمع|مخصص/.test(n)) return 'A';
    if (/مصروفات مستحقة|إيرادات مقدمة|ايرادات مقدمة/.test(n)) return 'L';
    if (/مصروفات مقدمة|إيرادات مستحقة|ايرادات مستحقة/.test(n)) return 'A';
    if (/^[1-5]/.test(c) && c.length >= 2) return ({ '1': 'A', '2': 'L', '3': 'E', '4': 'R', '5': 'X' })[c[0]];
    if (/رأس المال|راس المال|احتياطي|أرباح محتجزة|ارباح محتجزة|حقوق|جاري الشريك|سحوبات/.test(n)) return 'E';
    if (/مصروف|مصاريف|تكلفة|مشتريات|رواتب|أجور|اجور|إيجار|ايجار|إهلاك|اهلاك|فوائد مدينة|خصم مسموح|عمولات بنكية|مرتبات/.test(n)) return 'X';
    if (/موردون|دائنون|قروض|قرض|أوراق دفع|اوراق دفع|مستحق|التزام|خصوم|ضريبة.*مبيعات|ضرائب مستحقة/.test(n)) return 'L';
    if (/مبيعات|إيراد|ايراد|فوائد دائنة|عمولة مكتسبة|خصم مكتسب/.test(n)) return 'R';
    return 'A';
  }
  function statements(rows) {
    var by = { A: [], L: [], E: [], R: [], X: [] };
    rows.forEach(function (r) { var b = (+r.d || 0) - (+r.c || 0), t = r.t; if (!by[t]) return; by[t].push({ a: r.a, v: (t === 'A' || t === 'X') ? b : -b }); });
    var tot = function (k) { return by[k].reduce(function (s, x) { return s + x.v; }, 0); };
    var ni = tot('R') - tot('X'), eq = tot('E') + ni;
    return { by: by, tot: tot, ni: ni, eq: eq, ok: Math.abs(tot('A') - (tot('L') + eq)) < 0.005 };
  }
  /* ----------------------------------------------------------------------------
     مكتبة الشيتات التدريبية
     كل شيت = ميزان مراجعة جاهز (كود — الحساب — مدين — دائن) مقسّم لثلاثة مستويات.
     الكود بيحدد نوع الحساب تلقائيًا (1 أصول / 2 خصوم / 3 حقوق ملكية / 4 إيرادات / 5 مصروفات)
     عشان التصنيف يطلع صحيح في القوائم المالية من غير تدخل يدوي.
     ---------------------------------------------------------------------------- */
  var CO_LEVELS = [
    { id: 1, name: 'مستوى مبتدئ', desc: 'شركات صغيرة بدون مخزون أو ضريبة — تمارين على ميزان المراجعة وقائمة الدخل' },
    { id: 2, name: 'مستوى متوسط', desc: 'شركات تجارية وصناعية ومقاولات — مخزون وضريبة قيمة مضافة وإهلاك' },
    { id: 3, name: 'مستوى متقدم', desc: 'شركات مساهمة وفروع وعقود متعددة — هيكل حسابات معقّد وقوائم كاملة' }
  ];
  var SAMPLES = [
    /* ---------- المستوى الأول ---------- */
    {
      id: 'svc_noor', level: 1, name: 'مكتب خدمات النور', note: 'مكتب خدمات صغير — إيرادات خدمات ومصروفات تشغيل وإهلاك',
      rows: [
        ['1110', 'النقدية', 45000, 0], ['1120', 'البنك', 90000, 0], ['1130', 'العملاء', 30000, 0], ['1140', 'مصروفات مقدمة', 8000, 0],
        ['1210', 'أجهزة حاسب وأثاث', 60000, 0], ['1215', 'مجمع إهلاك الأجهزة والأثاث', 0, 12000],
        ['2110', 'الموردون', 0, 25000], ['2120', 'مصروفات مستحقة', 0, 4000], ['2130', 'ضريبة الدخل المستحقة', 0, 3000],
        ['3100', 'رأس المال', 0, 120000], ['3200', 'الأرباح المحتجزة', 0, 12000],
        ['4100', 'إيرادات الخدمات', 0, 235000],
        ['5100', 'رواتب', 95000, 0], ['5200', 'إيجار', 42000, 0], ['5300', 'كهرباء ومياه', 9000, 0],
        ['5400', 'مصروف الإهلاك', 12000, 0], ['5500', 'مصروفات إدارية', 20000, 0]
      ]
    },
    {
      id: 'retail_salam', level: 1, name: 'محل تجزئة السلام', note: 'محل تجزئة — مخزون وتكلفة مبيعات بسيطة بدون ضريبة',
      rows: [
        ['1110', 'النقدية', 22000, 0], ['1120', 'البنك', 48000, 0], ['1130', 'العملاء', 12000, 0], ['1140', 'المخزون', 85000, 0],
        ['1210', 'أثاث ومعدات المعرض', 40000, 0], ['1215', 'مجمع إهلاك الأثاث والمعدات', 0, 9000],
        ['2110', 'الموردون', 0, 46000], ['2120', 'مصروفات مستحقة', 0, 5000],
        ['3100', 'رأس المال', 0, 90000], ['3200', 'الأرباح المحتجزة', 0, 8000],
        ['4100', 'المبيعات', 0, 310000],
        ['5100', 'تكلفة المبيعات', 186000, 0], ['5200', 'رواتب البائعين', 36000, 0], ['5300', 'إيجار المحل', 24000, 0],
        ['5400', 'مصروف الإهلاك', 9000, 0], ['5500', 'مصروفات تشغيل', 6000, 0]
      ]
    },
    {
      id: 'clean_amal', level: 1, name: 'شركة نظافة الأمل', note: 'عقود نظافة — أجور عمالة ومواد مستهلكة وسيارات',
      rows: [
        ['1110', 'النقدية', 15000, 0], ['1120', 'البنك', 26000, 0], ['1130', 'العملاء', 9000, 0],
        ['1210', 'سيارات ومعدات نظافة', 70000, 0], ['1215', 'مجمع إهلاك السيارات والمعدات', 0, 14000],
        ['2110', 'الموردون', 0, 8000], ['2120', 'رواتب مستحقة', 0, 6000],
        ['3100', 'رأس المال', 0, 60000], ['3200', 'الأرباح المحتجزة', 0, 4000],
        ['4100', 'إيرادات عقود النظافة', 0, 121000],
        ['5100', 'أجور العمالة', 58000, 0], ['5200', 'مواد ومستلزمات', 9000, 0], ['5300', 'وقود وصيانة', 7000, 0],
        ['5400', 'مصروف الإهلاك', 14000, 0], ['5500', 'مصروفات إدارية', 5000, 0]
      ]
    },
    /* ---------- المستوى الثاني ---------- */
    {
      id: 'trade_haditha', level: 2, name: 'شركة التجارة الحديثة', note: 'تجارة جملة — مخزون وضريبة قيمة مضافة وقرض بنكي وسيارات توزيع',
      rows: [
        ['1110', 'النقدية', 35000, 0], ['1120', 'البنك', 115000, 0], ['1130', 'العملاء', 95000, 0], ['1140', 'المخزون', 160000, 0],
        ['1210', 'سيارات التوزيع', 140000, 0], ['1215', 'مجمع إهلاك سيارات التوزيع', 0, 28000], ['1220', 'ضريبة مشتريات قابلة للخصم', 18000, 0],
        ['2110', 'الموردون', 0, 110000], ['2120', 'ضريبة مبيعات مستحقة', 0, 27000], ['2130', 'مصروفات مستحقة', 0, 12000], ['2140', 'قروض بنكية قصيرة الأجل', 0, 60000],
        ['3100', 'رأس المال', 0, 250000], ['3200', 'الأرباح المحتجزة', 0, 40000],
        ['4100', 'المبيعات', 0, 680000],
        ['5100', 'تكلفة المبيعات', 420000, 0], ['5200', 'رواتب', 78000, 0], ['5300', 'إيجار المخازن', 36000, 0],
        ['5400', 'مصروف الإهلاك', 28000, 0], ['5500', 'مصروفات بيع وتوزيع', 22000, 0], ['5600', 'مصروفات إدارية', 24000, 0], ['5700', 'مصروفات متنوعة', 36000, 0]
      ]
    },
    {
      id: 'build_ittihad', level: 2, name: 'شركة البناء المتحد', note: 'مقاولات — أعمال تحت التنفيذ ومحتجز ضمان ومعدات ومستحقات مقاولي باطن',
      rows: [
        ['1110', 'النقدية', 40000, 0], ['1120', 'البنك', 130000, 0], ['1130', 'العملاء', 175000, 0], ['1140', 'مخزون مواد البناء', 120000, 0],
        ['1150', 'أعمال تحت التنفيذ', 210000, 0], ['1210', 'معدات وآلات', 320000, 0], ['1215', 'مجمع إهلاك المعدات والآلات', 0, 80000],
        ['1220', 'محتجز ضمان أعمال لدى العملاء', 25000, 0],
        ['2110', 'الموردون', 0, 145000], ['2120', 'مستحقات مقاولي الباطن', 0, 88000], ['2130', 'قروض بنكية طويلة الأجل', 0, 200000], ['2140', 'مصروفات مستحقة', 0, 17000],
        ['3100', 'رأس المال', 0, 400000], ['3200', 'الأرباح المحتجزة', 0, 60000],
        ['4100', 'إيرادات عقود المقاولات', 0, 705000],
        ['5100', 'تكاليف عقود المقاولات', 455000, 0], ['5200', 'رواتب إدارية وفنية', 85000, 0], ['5300', 'إيجار المعدات', 30000, 0],
        ['5400', 'مصروف الإهلاك', 80000, 0], ['5500', 'مصروفات إدارية وعمومية', 25000, 0]
      ]
    },
    {
      id: 'factory_huda', level: 2, name: 'مصنع الهدى للتصنيع', note: 'صناعة — مواد خام وتحت التشغيل وتام الصنع وتكاليف صناعية مباشرة وغير مباشرة',
      rows: [
        ['1110', 'النقدية', 28000, 0], ['1120', 'البنك', 96000, 0], ['1130', 'العملاء', 142000, 0],
        ['1140', 'مخزون المواد الخام', 95000, 0], ['1150', 'مخزون تحت التشغيل', 48000, 0], ['1160', 'مخزون تام الصنع', 76000, 0],
        ['1210', 'آلات ومعدات المصنع', 380000, 0], ['1215', 'مجمع إهلاك آلات ومعدات المصنع', 0, 95000], ['1220', 'قطع غيار ومهمات', 12000, 0],
        ['2110', 'الموردون', 0, 120000], ['2120', 'مصروفات مستحقة', 0, 15000], ['2130', 'قروض صناعية', 0, 150000],
        ['3100', 'رأس المال', 0, 350000], ['3200', 'الأرباح المحتجزة', 0, 45000],
        ['4100', 'إيرادات بيع الإنتاج', 0, 610000],
        ['5100', 'تكلفة المواد المستخدمة', 175000, 0], ['5200', 'أجور الإنتاج المباشرة', 140000, 0], ['5300', 'تكاليف صناعية غير مباشرة', 85000, 0],
        ['5400', 'مصروف الإهلاك', 70000, 0], ['5500', 'مصروفات بيع وإدارية', 38000, 0]
      ]
    },
    {
      id: 'alnoor', level: 2, name: 'شركة النور للتجارة', note: 'النموذج الأصلي بعد التصحيح — ميزان متزن بالكامل وصافي ربح 30,000',
      rows: [
        ['1110', 'النقدية', 48000, 0], ['1120', 'البنك', 125000, 0], ['1130', 'العملاء', 86000, 0], ['1140', 'المخزون', 140000, 0],
        ['1210', 'الأثاث والمعدات', 90000, 0], ['1215', 'مجمع إهلاك الأثاث والمعدات', 0, 18000],
        ['2110', 'الموردون', 0, 72000], ['2120', 'قروض قصيرة الأجل', 0, 40000], ['2130', 'مصروفات مستحقة', 0, 9000],
        ['3100', 'رأس المال', 0, 300000], ['3200', 'الأرباح المحتجزة', 0, 20000],
        ['4100', 'المبيعات', 0, 580000],
        ['5100', 'المشتريات', 380000, 0], ['5200', 'مصروف الأجور', 95000, 0], ['5300', 'مصروف الإيجار', 36000, 0],
        ['5400', 'مصروف الإهلاك', 9000, 0], ['5500', 'مصروفات إدارية وعمومية', 30000, 0]
      ]
    },
    /* ---------- المستوى الثالث ---------- */
    {
      id: 'nile_jsc', level: 3, name: 'شركة النيل المساهمة', note: 'شركة مساهمة — أراضي ومبانٍ وشهرة وأوراق مالية وسندات دفع واحتياطي قانوني',
      rows: [
        ['1110', 'النقدية', 60000, 0], ['1120', 'البنك', 240000, 0], ['1130', 'أوراق مالية متداولة', 90000, 0], ['1140', 'العملاء', 320000, 0],
        ['1150', 'المخزون', 410000, 0], ['1210', 'الأراضي', 500000, 0], ['1220', 'المباني', 700000, 0], ['1225', 'مجمع إهلاك المباني', 0, 140000],
        ['1230', 'آلات ومعدات', 450000, 0], ['1235', 'مجمع إهلاك الآلات والمعدات', 0, 150000], ['1240', 'شهرة', 80000, 0], ['1250', 'مصروفات مقدمة', 30000, 0],
        ['2110', 'الموردون', 0, 280000], ['2120', 'قروض بنكية طويلة الأجل', 0, 620000], ['2130', 'سندات دفع', 0, 250000],
        ['2140', 'مصروفات مستحقة', 0, 45000], ['2150', 'ضريبة الدخل المستحقة', 0, 35000], ['2160', 'توزيعات أرباح مستحقة', 0, 25000],
        ['3100', 'رأس المال', 0, 900000], ['3200', 'الاحتياطي القانوني', 0, 120000], ['3300', 'الأرباح المحتجزة', 0, 180000],
        ['4100', 'المبيعات', 0, 1560000], ['4200', 'إيرادات استثمارات', 0, 25000],
        ['5100', 'تكلفة المبيعات', 940000, 0], ['5200', 'رواتب وأجور', 210000, 0], ['5300', 'مصروف الإهلاك', 95000, 0],
        ['5400', 'مصروفات بيع وتوزيع', 60000, 0], ['5500', 'مصروفات إدارية وعمومية', 75000, 0], ['5600', 'مصروف الفوائد', 55000, 0], ['5700', 'خسائر فروق عملة', 15000, 0]
      ]
    },
    {
      id: 'ufuq_branches', level: 3, name: 'مجموعة الأفق — فرعان', note: 'محاسبة فروع — نقدية ومخزون وعملاء مفصّلين لكل فرع مع مصروفات مركزية',
      rows: [
        ['1110', 'النقدية - الفرع الرئيسي', 18000, 0], ['1115', 'النقدية - فرع الإسكندرية', 22000, 0], ['1120', 'البنك', 145000, 0],
        ['1130', 'العملاء - الجملة', 118000, 0], ['1135', 'العملاء - التجزئة', 34000, 0],
        ['1140', 'المخزون - الجملة', 190000, 0], ['1145', 'المخزون - التجزئة', 62000, 0],
        ['1210', 'تجهيزات الفروع', 160000, 0], ['1215', 'مجمع إهلاك تجهيزات الفروع', 0, 40000],
        ['2110', 'الموردون', 0, 130000], ['2120', 'مصروفات مستحقة', 0, 14000], ['2130', 'قروض', 0, 80000],
        ['3100', 'رأس المال', 0, 300000], ['3200', 'الأرباح المحتجزة', 0, 40000],
        ['4100', 'مبيعات الجملة', 0, 650000], ['4150', 'مبيعات التجزئة', 0, 175000],
        ['5100', 'تكلفة مبيعات الجملة', 350000, 0], ['5150', 'تكلفة مبيعات التجزئة', 92000, 0], ['5200', 'رواتب الفروع', 96000, 0],
        ['5300', 'إيجارات الفروع', 54000, 0], ['5400', 'مصروف الإهلاك', 40000, 0], ['5500', 'مصروفات إدارية مركزية', 48000, 0]
      ]
    },
    {
      id: 'gulf_contract', level: 3, name: 'شركة الخليج للمقاولات', note: 'عقود مقاولات متقدمة — معدات ثقيلة ومحتجزات والتزامات عقود متوقعة',
      rows: [
        ['1110', 'النقدية', 30000, 0], ['1120', 'البنك', 175000, 0], ['1130', 'العملاء', 190000, 0], ['1140', 'مخزون مواد', 88000, 0],
        ['1150', 'أعمال تحت التنفيذ', 265000, 0], ['1210', 'معدات ثقيلة', 520000, 0], ['1215', 'مجمع إهلاك المعدات الثقيلة', 0, 130000],
        ['1220', 'محتجز ضمان أعمال لدى العملاء', 45000, 0], ['1230', 'مصروفات مقدمة', 12000, 0],
        ['2110', 'الموردون', 0, 165000], ['2120', 'مستحقات مقاولي الباطن', 0, 95000], ['2130', 'قروض بنكية', 0, 350000],
        ['2140', 'مصروفات مستحقة', 0, 22000], ['2150', 'التزامات عقود متوقعة', 0, 18000],
        ['3100', 'رأس المال', 0, 450000], ['3200', 'الأرباح المحتجزة', 0, 55000],
        ['4100', 'إيرادات عقود المقاولات', 0, 933000],
        ['5100', 'تكاليف عقود المقاولات', 570000, 0], ['5200', 'رواتب وأجور', 110000, 0], ['5300', 'مصروف الإهلاك', 130000, 0],
        ['5400', 'مصروفات إدارية', 65000, 0], ['5500', 'خسائر عقود متوقعة', 18000, 0]
      ]
    }
  ];
  /* تحويل صفوف الشيت لمصفوفة حسابات مصنّفة جاهزة للعرض */
  function sampleRows(s) { return (s.rows || []).map(function (r) { return { code: String(r[0] || ''), a: r[1], d: +r[2] || 0, c: +r[3] || 0, t: guessType(r[1], r[0]) }; }); }
  /* فحص توازن الشيت قبل إضافته (حماية من أي نموذج غير متزن) */
  function sampleBalanced(s) {
    var td = 0, tc = 0;
    (s.rows || []).forEach(function (r) { td += (+r[2] || 0); tc += (+r[3] || 0); });
    return { ok: Math.abs(td - tc) < 0.005, td: td, tc: tc };
  }
  function sampleById(id) { return SAMPLES.find(function (s) { return s.id === id; }); }

  /* ---------------------------------------------------------------- الواجهة */
  var state = { page: 'dash', open: false, F: { from: '', to: '', acc: '', year: 0 }, cs: { id: null, tab: 'tb' }, selAsset: null, depYear: 0, navOpen: false, coLevel: 1 };
  var REP = null, root = null, active = false, busy = false;

  var CSS = '' +
    '.pm{position:fixed;inset:0;z-index:9000;display:none;background:#f4f2f8;color:#1e1b2e;direction:rtl;font-family:inherit;font-size:14px}' +
    '.pm.on{display:flex}.pm *{box-sizing:border-box}' +
    'body.pm-active #appRoot{display:none!important}body.pm-active{padding:0!important}' +
    '.pm-side{width:250px;flex-shrink:0;background:linear-gradient(180deg,#43126a,#6d1f9c);color:#efe3fa;overflow-y:auto;display:flex;flex-direction:column;z-index:3}' +
    '.pm-brand{padding:18px 14px;text-align:center;border-bottom:1px solid rgba(255,255,255,.14)}.pm-brand b{display:block;font-size:18px;letter-spacing:.5px}.pm-brand span{font-size:11px;opacity:.7}' +
    '.pm-g{font-size:11px;opacity:.6;padding:14px 16px 4px}' +
    '.pm-nav{display:flex;align-items:center;gap:9px;width:100%;padding:9px 16px;background:none;border:0;color:inherit;font:inherit;font-size:13.5px;cursor:pointer;text-align:right}' +
    '.pm-nav:hover{background:rgba(255,255,255,.1)}.pm-nav.act{background:#f4f2f8;color:#43126a;font-weight:700;border-radius:10px 0 0 10px;margin-right:8px;width:calc(100% - 8px)}' +
    '.pm-main{flex:1;display:flex;flex-direction:column;min-width:0}' +
    '.pm-top{background:#fff;border-bottom:1px solid #e6e0ef;padding:8px 14px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.pm-top .pm-sp{flex:1}' +
    /* شريط الشيتات داخل مود الاحتراف: تنقّل بين الشيتات القديمة من غير الخروج للأكاديمي */
    '.pm-sheets{display:flex;gap:6px;align-items:center;overflow-x:auto;padding:7px 14px;background:#f7f2fb;border-bottom:1px solid #e6e0ef;flex-wrap:nowrap}' +
    '.pm-sheets .pm-shlab{font-size:12px;font-weight:700;color:#5b4a73;white-space:nowrap}' +
    '.pm-chip{border:1px solid #d9cfe8;background:#fff;color:#4a3566;border-radius:9px 9px 0 0;padding:5px 10px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap}' +
    '.pm-chip.on{background:#43126a;border-color:#43126a;color:#fff}.pm-chip small{opacity:.72;font-weight:600}.pm-chip:hover{border-color:#9b7cc0}' +
    /* زرار إخفاء/إظهار الشريط (زي الوضع الأكاديمي): الكلاس بيتحط على الجذر .pm */
    '.pm.sheets-off .pm-sheets{display:none!important}' +
    '.pm-body{flex:1;overflow:auto;padding:16px}' +
    '.pm-card{background:#fff;border:1px solid #e6e0ef;border-radius:12px;padding:14px;margin-bottom:14px}.pm-card h3{margin:0 0 10px;font-size:16px;color:#43126a}' +
    '.pm-h{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:12px}.pm-h h2{margin:0;font-size:20px;color:#2d1245}' +
    '.pm-b{border:0;border-radius:8px;padding:7px 13px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;background:#ece6f5;color:#43126a}.pm-b:hover{filter:brightness(.95)}' +
    '.pm-b.p{background:#6d1f9c;color:#fff}.pm-b.g{background:#16a34a;color:#fff}.pm-b.r{background:#e11d48;color:#fff}.pm-b.s{padding:3px 9px;font-size:12px}.pm-b.o{background:#fff;border:1px solid #d6cbe6}' +
    '.pm-in{border:1px solid #d6cbe6;border-radius:8px;padding:7px 9px;font:inherit;font-size:13.5px;background:#fff;width:100%;min-width:0}.pm-in:focus{outline:2px solid #b78be0;border-color:#8b3fc4}' +
    '.pm-grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}.pm-grid label{display:block;font-size:12px;color:#5b4a73;font-weight:600}.pm-grid label .pm-in{margin-top:4px;font-weight:400}' +
    '.pm-kpi{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));margin-bottom:14px}.pm-k{background:#fff;border:1px solid #e6e0ef;border-radius:12px;padding:14px;border-right:5px solid #6d1f9c}.pm-k small{color:#6b5b82;font-size:12px}.pm-k b{display:block;font-size:20px;margin-top:4px}.pm-k.g{border-right-color:#16a34a}.pm-k.r{border-right-color:#e11d48}.pm-k.o{border-right-color:#f59e0b}.pm-k.b{border-right-color:#2563eb}' +
    '.pm-tw{overflow:auto;border:1px solid #e6e0ef;border-radius:10px}.pm-t{border-collapse:collapse;width:100%;font-size:13px;background:#fff}' +
    '.pm-t th{background:#efe8f8;color:#43126a;padding:8px 9px;text-align:right;white-space:nowrap;position:sticky;top:0}.pm-t td{padding:7px 9px;border-top:1px solid #eee7f6;white-space:nowrap}' +
    '.pm-t th.pm-n{text-align:center}.pm-t td.pm-n{text-align:center;font-variant-numeric:tabular-nums}.pm-t tr.pm-sep td{background:#dcf5e3;color:#14532d;font-weight:700}.pm-t tr.pm-tot td{background:#f4eefb;font-weight:800;border-top:2px solid #cdbbe6}' +
    '.pm-t tr.pm-sub td{background:#faf7fd;font-weight:700;color:#43126a}.pm-z{color:#b8aecb}.pm-t tr.pm-pos td{color:#047857}.pm-t tr.pm-neg td{color:#be123c}' +
    '.pm-filter{display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:12px}.pm-filter label{font-size:12px;font-weight:600;color:#5b4a73}.pm-filter .pm-in{width:auto;display:block;margin-top:3px}' +
    '.pm-badge{display:inline-block;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:700}.pm-badge.e{background:#ffe4ea;color:#be123c}.pm-badge.w{background:#fef3c7;color:#b45309}.pm-badge.ok{background:#dcfce7;color:#15803d}' +
    '.pm-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.pm-tabs .pm-b.on{background:#6d1f9c;color:#fff}' +
    '.pm-toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#2d1245;color:#fff;padding:10px 18px;border-radius:10px;z-index:9500;font-size:14px;box-shadow:0 6px 20px rgba(0,0,0,.25)}' +
    '.pm-prev{background:#faf7fd;border:1px dashed #b78be0;border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.9;margin-top:10px}' +
    '.pm-note{font-size:12px;color:#6b5b82;line-height:1.8}.pm-menu{display:none}' +
    '.pm-lv{display:flex;flex-direction:column;gap:4px;text-align:right;background:#fff;border:2px solid #e6e0ef;border-radius:12px;padding:12px;font:inherit;cursor:pointer;transition:.15s}.pm-lv b{font-size:14.5px;color:#43126a}.pm-lv small{font-size:11.5px;color:#6b5b82;line-height:1.7}.pm-lv span{font-size:11px;font-weight:700;color:#6d1f9c;background:#f1e9fb;border-radius:999px;padding:2px 8px;align-self:flex-start}' +
    '.pm-lv:hover{border-color:#b78be0}.pm-lv.on{border-color:#6d1f9c;background:#f7f1fd;box-shadow:0 0 0 3px rgba(109,31,156,.12)}' +
    '.pm-smp{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;text-align:right;width:100%;background:#fff;border:1px solid #d6cbe6;border-radius:10px;padding:10px 12px;font:inherit;cursor:pointer;margin-bottom:8px}.pm-smp:hover{border-color:#6d1f9c;background:#faf7fd}.pm-smp b{font-size:14px;color:#2d1245}.pm-smp small{display:block;font-size:11.5px;color:#6b5b82;line-height:1.7;margin-top:2px}.pm-smp .pm-smpst{font-size:12px;font-weight:800;white-space:nowrap;color:#15803d}.pm-smp .pm-smpst.bad{color:#be123c}' +
    '#pmToggle{background:linear-gradient(135deg,#6d1f9c,#a1349f);color:#fff;border:0;border-radius:999px;padding:5px 14px;font:inherit;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(109,31,156,.35)}' +
    '.pm-it td:first-child{min-width:150px}#pmPrint{display:none}' +
    '@media(max-width:860px){.pm-side{position:fixed;top:0;bottom:0;right:0;transform:translateX(100%);transition:transform .25s}.pm-side.open{transform:none}.pm-menu{display:inline-block}}' +
    '@media print{body>*:not(#pmPrint){display:none!important}#pmPrint{display:block!important;direction:rtl;padding:10mm;color:#000;background:#fff}#pmPrint .pm-t th{background:#eee!important;color:#000;position:static}#pmPrint .pm-t tr.pm-sep td{background:#dcf5e3!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}#pmPrint .pm-tw{overflow:visible;border:0}#pmPrint .pm-t{font-size:11px}}';

  var NAV = [
    { g: 'الرئيسية', i: [['dash', '🏠', 'لوحة التحكم'], ['agg', '📈', 'التقارير المجمعة (أثر العمليات)']] },
    { g: '١) المحاسبة المالية', i: [['sale', '🧾', 'فاتورة بيع'], ['purchase', '🛒', 'فاتورة شراء'], ['receipt', '📥', 'سند قبض'], ['payment', '📤', 'سند صرف'], ['jv', '✍️', 'قيد يومية'], ['treasury', '🏦', 'حركة الخزينة والبنك'], ['assets', '🏗️', 'الأصول الثابتة والإهلاكات']] },
    { g: '٢) محاسبة التكاليف', i: [['cstock', '📦', 'المخازن (وارد / صادر)'], ['cjobs', '🏭', 'أوامر التشغيل']] },
    { g: '٣) المنشآت المتخصصة', i: [['contracts', '🧱', 'المقاولات (عقود ومستخلصات)']] },
    { g: '٤) المحاسبة الضريبية', i: [['tax', '🧮', 'ضريبة القيمة المضافة'], ['whtax', '✂️', 'الخصم والإضافة']] },
    { g: 'التدريب والامتحانات', i: [['exer', '🧠', 'تمارين وحلول وامتحان ذاتي']] },
    { g: 'التقييم والمخرجات', i: [['audit', '🔍', 'المراجعة وتتبع الأخطاء'], ['rjournal', '📒', 'دفتر اليومية'], ['rledger', '📚', 'دفتر الأستاذ'], ['rtrial', '⚖️', 'ميزان المراجعة'], ['rpl', '📊', 'الربح والخسارة (شهري)'], ['company', '🏢', 'شيتات شركات حقيقية']] },
    { g: 'النظام', i: [['settings', '⚙️', 'الإعدادات']] }
  ];
  var TITLES = {}; NAV.forEach(function (g) { g.i.forEach(function (i) { TITLES[i[0]] = i[2]; }); });

  /* مساعدات العرض */
  var cellH = function (v) { return v == null || v === '' ? '' : typeof v === 'number' ? (v === 0 ? '<span class="pm-z">-</span>' : N(v)) : (v && v.h != null ? v.h : E(v)); };
  function grid(head, rows, opt) {
    opt = opt || {};
    var num = head.map(function (_, i) { return rows.some(function (r) { return r && r.sep == null && typeof (r.cells || r)[i] === 'number'; }); });
    var h = '<div class="pm-tw"><table class="pm-t"><thead><tr>' + head.map(function (x, i) { return '<th' + (num[i] ? ' class="pm-n"' : '') + '>' + E(x) + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r) {
      if (r && r.sep != null) { h += '<tr class="pm-sep"><td colspan="' + head.length + '">' + E(r.sep) + '</td></tr>'; return; }
      var cells = r.cells || r, cls = r.cls || '';
      h += '<tr class="' + cls + '">' + cells.map(function (v, i) { return '<td' + (num[i] ? ' class="pm-n"' : '') + '>' + cellH(v) + '</td>'; }).join('') + '</tr>';
    });
    if (!rows.length) h += '<tr><td colspan="' + head.length + '" style="text-align:center;color:#8a7aa3;padding:22px">لا توجد بيانات في هذه الفترة.</td></tr>';
    return h + '</tbody></table></div>';
  }
  function setRep(title, sub, head, rows) { REP = { title: title, sub: sub, head: head, rows: rows }; return grid(head, rows); }
  var periodTxt = function () { var f = state.F; return f.from || f.to ? 'الفترة: ' + (f.from || 'البداية') + ' ← ' + (f.to || 'اليوم') : 'كل الفترات'; };
  var toast = function (m) { $$('.pm-toast').forEach(function (x) { x.remove(); }); var t = document.createElement('div'); t.className = 'pm-toast'; t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600); };
  var accOptions = function (sel, filter) {
    return accounts.slice().sort(byCodeAcc).filter(function (a) { return !filter || filter(a); }).map(function (a) { return '<option value="' + E(a) + '"' + (a === sel ? ' selected' : '') + '>' + (codes[a] ? E(codes[a]) + ' - ' : '') + E(a) + '</option>'; }).join('');
  };
  function filterBar(extra, noExport) {
    var f = state.F;
    return '<div class="pm-filter"><label>من<input class="pm-in" type="date" id="fFrom" value="' + E(f.from) + '"></label><label>إلى<input class="pm-in" type="date" id="fTo" value="' + E(f.to) + '"></label>' + (extra || '') +
      '<button class="pm-b p" data-act="applyF">تطبيق</button><button class="pm-b o" data-act="clearF">كل الفترات</button>' +
      (noExport ? '' : '<span style="flex:1"></span><button class="pm-b g" data-act="xlsx">📊 Excel</button><button class="pm-b r" data-act="print">📄 PDF / طباعة</button>') + '</div>';
  }
  var readF = function () { var a = $('#fFrom'), b = $('#fTo'); if (a) state.F.from = a.value; if (b) state.F.to = b.value; var c = $('#fAcc'); if (c) state.F.acc = c.value; var y = $('#fYear'); if (y) state.F.year = +y.value; };

  /* ------------------------------------------------ الصفحات */
  function pDash() {
    var bal = {}, rev = 0, exp = 0, cash = 0, ar = 0, ap = 0;
    allLines().forEach(function (l) { bal[l.a] = (bal[l.a] || 0) + l.d - l.c; });
    Object.keys(bal).forEach(function (a) {
      var t = typeOf(a), b = bal[a];
      if (t === 'R') rev -= b; else if (t === 'X') exp += b;
      if (isCash(a)) cash += b;
      if (/^العملاء/.test(a)) ar += b; if (/^الموردون/.test(a)) ap -= b;
    });
    var y = lastYear(), m = monthlyPL(y), vat = vatData('', '');
    var max = Math.max.apply(null, m.totRev.concat(m.totExp).concat([1])), bw = 22, svg = '<svg viewBox="0 0 640 190" style="width:100%;height:auto"><g>';
    for (var i = 0; i < 12; i++) {
      var x = 20 + (11 - i) * 51, h1 = m.totRev[i] / max * 130, h2 = m.totExp[i] / max * 130;
      svg += '<rect x="' + x + '" y="' + (150 - h1) + '" width="' + bw + '" height="' + h1 + '" fill="#6d1f9c" rx="3"/><rect x="' + (x + bw + 2) + '" y="' + (150 - h2) + '" width="' + bw + '" height="' + h2 + '" fill="#f59e0b" rx="3"/><text x="' + (x + bw) + '" y="170" font-size="10" text-anchor="middle" fill="#5b4a73">' + MONTHS[i].slice(0, 3) + '</text>';
    }
    svg += '</g></svg>';
    var last = jEntries().map(function (e, i) { return { e: e, no: i + 1 }; }).sort(function (a, b) { return (b.e.date || '') < (a.e.date || '') ? -1 : 1; }).slice(0, 8);
    return '<div class="pm-kpi">' +
      '<div class="pm-k g"><small>إجمالي الإيرادات</small><b>' + N(rev) + ' ' + E(DB.settings.currency) + '</b></div>' +
      '<div class="pm-k r"><small>إجمالي المصروفات</small><b>' + N(exp) + ' ' + E(DB.settings.currency) + '</b></div>' +
      '<div class="pm-k ' + (rev - exp >= 0 ? 'g' : 'r') + '"><small>' + (rev - exp >= 0 ? 'صافي الربح' : 'صافي الخسارة') + '</small><b>' + N(Math.abs(rev - exp)) + '</b></div>' +
      '<div class="pm-k b"><small>رصيد الخزينة والبنك</small><b>' + N(cash) + '</b></div>' +
      '<div class="pm-k o"><small>مديونيات العملاء</small><b>' + N(ar) + '</b></div>' +
      '<div class="pm-k o"><small>مستحقات الموردين</small><b>' + N(ap) + '</b></div>' +
      '<div class="pm-k"><small>ضريبة القيمة المضافة المستحقة</small><b>' + N(vat.net) + '</b></div></div>' +
      '<div class="pm-card"><h3>الإيرادات والمصروفات الشهرية — ' + y + ' <span class="pm-note">(بنفسجي: إيرادات، برتقالي: مصروفات)</span></h3>' + svg + '</div>' +
      '<div class="pm-card"><h3>آخر القيود</h3>' + grid(['رقم القيد', 'التاريخ', 'البيان', 'المبلغ'], last.map(function (x) { return [String(x.no), x.e.date || '', x.e.desc || '', (x.e.debits || []).reduce(function (s, d) { return s + (+d.m || 0); }, 0)]; })) + '</div>';
  }

  /* الفواتير */
  function invRow() {
    return '<tr class="pm-it"><td><input class="pm-in" data-f="n" placeholder="اسم البند / الصنف"></td><td style="width:100px"><input class="pm-in" data-f="q" type="number" step="any" min="0" value="1"></td><td style="width:130px"><input class="pm-in" data-f="p" type="number" step="any" min="0" placeholder="0.00"></td><td class="pm-n" data-f="t" style="width:120px">0.00</td><td style="width:40px"><button class="pm-b s r" data-act="delRow" title="حذف السطر">✕</button></td></tr>';
  }
  function pInvoice(type) {
    var sale = type === 'sale', list = scoped(DB.invoices).filter(function (v) { return v.type === type; });
    var no = (sale ? 'S-' : 'P-') + pad(list.length + 1, 4);
    var rows = list.slice().reverse().map(function (v) {
      return [v.no, v.date, v.party || '—', ({ cash: 'نقدي', bank: 'بنك', credit: 'آجل' })[v.pay], v.net, v.vat, v.total, { h: '<button class="pm-b s o" data-act="printInv" data-id="' + v.id + '">طباعة</button> <button class="pm-b s r" data-act="delInv" data-id="' + v.id + '">حذف</button>' }];
    });
    return '<div class="pm-card"><h3>' + (sale ? 'فاتورة بيع جديدة' : 'فاتورة شراء جديدة') + '</h3><div id="pmInv" data-type="' + type + '">' +
      '<div class="pm-grid"><label>رقم الفاتورة<input class="pm-in" id="iNo" value="' + no + '" readonly></label><label>التاريخ<input class="pm-in" type="date" id="iDate" value="' + today() + '"></label>' +
      '<label>' + (sale ? 'العميل' : 'المورد') + '<input class="pm-in" id="iParty" list="pmParties" placeholder="' + (sale ? 'اسم العميل' : 'اسم المورد') + '"></label>' +
      '<label>طريقة الدفع<select class="pm-in" id="iPay"><option value="cash">نقدي (خزينة)</option><option value="bank">بنك</option><option value="credit">آجل (' + (sale ? 'على العميل' : 'للمورد') + ')</option></select></label>' +
      '<label>نسبة الضريبة %<input class="pm-in" id="iRate" type="number" step="any" min="0" value="' + (+DB.settings.vat || 0) + '"></label></div>' +
      '<datalist id="pmParties">' + accounts.filter(function (a) { return new RegExp('^' + (sale ? 'العملاء' : 'الموردون') + ' - ').test(a); }).map(function (a) { return '<option value="' + E(a.split(' - ').slice(1).join(' - ')) + '">'; }).join('') + '</datalist>' +
      '<div class="pm-tw" style="margin-top:12px"><table class="pm-t"><thead><tr><th>البند</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th><th></th></tr></thead><tbody id="iRows">' + invRow() + '</tbody></table></div>' +
      '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="pm-b o" data-act="addRow">+ إضافة بند</button><span style="flex:1"></span>' +
      '<div style="min-width:240px;line-height:2">الإجمالي قبل الضريبة: <b id="iNet">0.00</b><br>الضريبة: <b id="iVat">0.00</b><br>الصافي المستحق: <b id="iTot" style="color:#6d1f9c;font-size:17px">0.00</b></div></div>' +
      '<div class="pm-prev" id="iPrev">القيد الناتج سيظهر هنا.</div>' +
      '<div style="margin-top:10px"><button class="pm-b p" data-act="saveInv">💾 حفظ الفاتورة وترحيل القيد</button></div></div></div>' +
      '<div class="pm-card"><h3>سجل ' + (sale ? 'فواتير البيع' : 'فواتير الشراء') + '</h3>' + grid(['الرقم', 'التاريخ', sale ? 'العميل' : 'المورد', 'الدفع', 'قبل الضريبة', 'الضريبة', 'الإجمالي', 'إجراءات'], rows) + '</div>';
  }
  function readInv() {
    var f = $('#pmInv'); if (!f) return null;
    var items = $$('.pm-it', f).map(function (tr) { return { n: $('[data-f=n]', tr).value.trim(), q: +$('[data-f=q]', tr).value || 0, p: +$('[data-f=p]', tr).value || 0 }; }).filter(function (x) { return x.n || x.q * x.p > 0; });
    var net = R2(items.reduce(function (s, x) { return s + x.q * x.p; }, 0)), rate = +$('#iRate').value || 0, vat = R2(net * rate / 100);
    return { type: f.dataset.type, no: $('#iNo').value, date: $('#iDate').value, party: $('#iParty').value.trim(), pay: $('#iPay').value, rate: rate, items: items, net: net, vat: vat, total: R2(net + vat) };
  }
  function invAccounts(v) {
    var sale = v.type === 'sale';
    var cashAcc = v.pay === 'cash' ? 'النقدية' : v.pay === 'bank' ? 'البنك' : (sale ? subAcc('العملاء', v.party, 'A') : subAcc('الموردون', v.party, 'L'));
    if (v.pay !== 'credit') ensureAcc(cashAcc, 'A', '11');
    if (sale) { ensureAcc('المبيعات', 'R'); ensureAcc('ضريبة مبيعات مستحقة', 'L', '21'); return { dr: [[cashAcc, v.total]], cr: [['المبيعات', v.net], ['ضريبة مبيعات مستحقة', v.vat]] }; }
    ensureAcc('المشتريات', 'X'); ensureAcc('ضريبة مشتريات قابلة للخصم', 'A', '11');
    return { dr: [['المشتريات', v.net], ['ضريبة مشتريات قابلة للخصم', v.vat]], cr: [[cashAcc, v.total]] };
  }
  function previewInv() {
    var v = readInv(); if (!v) return;
    $('#iNet').textContent = N(v.net); $('#iVat').textContent = N(v.vat); $('#iTot').textContent = N(v.total);
    $$('.pm-it').forEach(function (tr) { var t = $('[data-f=t]', tr); t.textContent = N((+$('[data-f=q]', tr).value || 0) * (+$('[data-f=p]', tr).value || 0)); });
    var sale = v.type === 'sale', pay = ({ cash: 'النقدية', bank: 'البنك', credit: (sale ? 'العملاء' : 'الموردون') + (v.party ? ' - ' + v.party : '') })[v.pay];
    var l = function (a, m) { return m > 0 ? E(a) + ' <b>' + N(m) + '</b>' : ''; };
    $('#iPrev').innerHTML = v.net <= 0 ? 'أدخل بنود الفاتورة لتظهر القيد الناتج.' :
      '<b>القيد الناتج في دفتر اليومية:</b><br>' + (sale ? 'من حـ/ ' + l(pay, v.total) + '<br>إلى مذكورين: ' + l('المبيعات', v.net) + (v.vat > 0 ? ' — ' + l('ضريبة مبيعات مستحقة', v.vat) : '') :
        'من مذكورين: ' + l('المشتريات', v.net) + (v.vat > 0 ? ' — ' + l('ضريبة مشتريات قابلة للخصم', v.vat) : '') + '<br>إلى حـ/ ' + l(pay, v.total));
  }
  /* إنشاء فاتورة كاملة (قيد + سجل مستند) — تُستخدم من الشاشة ومن «توزيع الحل» */
  function addInvoice(v) {
    if (!v || !(v.net > 0)) return null;
    var ac = invAccounts(v), sale = v.type === 'sale';
    var id = postEntry((sale ? 'فاتورة بيع رقم ' : 'فاتورة شراء رقم ') + v.no + (v.party ? ' — ' + v.party : ''), ac.dr, ac.cr, v.date || today(), { src: 'pro-inv', ref: v.no, vatBase: v.net, vatRate: +v.rate || 0, vatAmt: +v.vat || 0, vatSide: sale ? 'out' : 'in', demo: v.demo });
    if (id == null) return null;
    v.id = uid(); v.entryId = id; v.scope = scopeNow(); v.jrn = journalNow(); DB.invoices.push(v); saveDB('invoices');
    return v;
  }
  function saveInv() {
    var v = readInv(); if (!v) return;
    if (!v.date) return alert('اختر تاريخ الفاتورة.');
    if (v.net <= 0) return alert('أضف بندًا واحدًا على الأقل بكمية وسعر أكبر من صفر.');
    if (v.pay === 'credit' && !v.party && !confirm('لم تكتب اسم ' + (v.type === 'sale' ? 'العميل' : 'المورد') + '. سيُسجل على الحساب العام. متابعة؟')) return;
    if (!addInvoice(v)) return alert('تعذر إنشاء القيد (تحقق من الأرقام).');
    afterChange(); toast('تم حفظ الفاتورة ' + v.no + ' وترحيل القيد ✅');
  }
  function invHtml(v) {
    var sale = v.type === 'sale';
    return '<div style="max-width:720px;margin:auto"><h2 style="text-align:center;margin:0">' + E(DB.settings.company) + '</h2><h3 style="text-align:center;margin:4px 0 14px">' + (sale ? 'فاتورة مبيعات' : 'فاتورة مشتريات') + ' رقم ' + E(v.no) + '</h3>' +
      '<p>التاريخ: ' + E(v.date) + ' &nbsp;|&nbsp; ' + (sale ? 'العميل' : 'المورد') + ': ' + E(v.party || '—') + ' &nbsp;|&nbsp; الدفع: ' + ({ cash: 'نقدي', bank: 'بنك', credit: 'آجل' })[v.pay] + '</p>' +
      grid(['البند', 'الكمية', 'السعر', 'الإجمالي'], v.items.map(function (x) { return [x.n, { h: E(x.q) }, x.p, R2(x.q * x.p)]; })) +
      '<p style="margin-top:12px;line-height:2">الإجمالي قبل الضريبة: <b>' + N(v.net) + '</b><br>ضريبة القيمة المضافة (' + v.rate + '%): <b>' + N(v.vat) + '</b><br>الصافي المستحق: <b>' + N(v.total) + ' ' + E(DB.settings.currency) + '</b></p>' +
      '<p style="margin-top:40px;display:flex;justify-content:space-between"><span>توقيع المحاسب: ..............</span><span>توقيع ' + (sale ? 'المستلم' : 'المورد') + ': ..............</span></p></div>';
  }

  /* السندات */
  function pVoucher(type) {
    var rec = type === 'receipt', list = scoped(DB.vouchers).filter(function (v) { return v.type === type; });
    var no = (rec ? 'R-' : 'V-') + pad(list.length + 1, 4);
    var rows = list.slice().reverse().map(function (v) { return [v.no, v.date, v.acc, ({ cash: 'خزينة', bank: 'بنك' })[v.method], v.desc || '', v.amount, { h: '<button class="pm-b s o" data-act="printVou" data-id="' + v.id + '">طباعة</button> <button class="pm-b s r" data-act="delVou" data-id="' + v.id + '">حذف</button>' }]; });
    return '<div class="pm-card"><h3>' + (rec ? 'سند قبض جديد' : 'سند صرف جديد') + '</h3><div id="pmVou" data-type="' + type + '"><div class="pm-grid">' +
      '<label>رقم السند<input class="pm-in" id="vNo" value="' + no + '" readonly></label><label>التاريخ<input class="pm-in" type="date" id="vDate" value="' + today() + '"></label>' +
      '<label>' + (rec ? 'قُبض في' : 'صُرف من') + '<select class="pm-in" id="vMeth"><option value="cash">الخزينة (النقدية)</option><option value="bank">البنك</option></select></label>' +
      '<label>' + (rec ? 'الحساب الدائن (مقابل القبض)' : 'الحساب المدين (مقابل الصرف)') + '<select class="pm-in" id="vAcc">' + accOptions(rec ? 'العملاء' : 'الموردون', function (a) { return !isCash(a); }) + '</select></label>' +
      '<label>أو حساب جديد (اكتب اسمه)<input class="pm-in" id="vNew" list="pmNewAcc" placeholder="مثال: مصروف الإيجار"></label>' +
      '<label>تصنيف الحساب الجديد<select class="pm-in" id="vNewT"><option value="">تلقائي حسب الاسم</option><option value="X">مصروف</option><option value="R">إيراد</option><option value="A">أصل</option><option value="L">خصم</option><option value="E">حقوق ملكية</option></select></label>' +
      '<datalist id="pmNewAcc">' + Object.keys(codes).filter(function (k) { return accounts.indexOf(k) < 0; }).map(function (k) { return '<option value="' + E(k) + '">'; }).join('') + '</datalist>' +
      '<label>اسم الطرف (اختياري: ينشئ حسابًا فرعيًا)<input class="pm-in" id="vParty" placeholder="مثال: أحمد محمد"></label>' +
      '<label>المبلغ<input class="pm-in" id="vAmt" type="number" step="any" min="0" placeholder="0.00"></label></div>' +
      '<label style="display:block;margin-top:10px;font-size:12px;font-weight:600;color:#5b4a73">البيان<input class="pm-in" id="vDesc" placeholder="' + (rec ? 'مثال: تحصيل دفعة من العميل' : 'مثال: سداد جزء من مستحقات المورد') + '"></label>' +
      '<div style="margin-top:10px"><button class="pm-b p" data-act="saveVou">💾 حفظ السند وترحيل القيد</button></div></div></div>' +
      '<div class="pm-card"><h3>سجل ' + (rec ? 'سندات القبض' : 'سندات الصرف') + '</h3>' + grid(['الرقم', 'التاريخ', 'الحساب', 'الوسيلة', 'البيان', 'المبلغ', 'إجراءات'], rows) + '</div>';
  }
  /* إنشاء سند كامل (قيد + سجل) — تُستخدم من الشاشة ومن «توزيع الحل» */
  function addVoucher(v) {
    if (!v || !(v.amount > 0) || !v.acc) return null;
    var rec = v.type === 'receipt', cashAcc = v.method === 'cash' ? 'النقدية' : 'البنك';
    ensureAcc(cashAcc, 'A', '11');
    ensureAcc(v.acc, guessType(v.acc, codes[v.acc]));
    var other = v.party ? subAcc(v.acc, v.party, typeOf(v.acc) || 'A') : v.acc;
    if (other === cashAcc) return null;
    var id = postEntry((rec ? 'سند قبض رقم ' : 'سند صرف رقم ') + v.no + ' — ' + (v.desc || other), rec ? [[cashAcc, v.amount]] : [[other, v.amount]], rec ? [[other, v.amount]] : [[cashAcc, v.amount]], v.date || today(), { src: 'pro-vou', ref: v.no, demo: v.demo });
    if (id == null) return null;
    v.acc = other; v.id = uid(); v.entryId = id; v.scope = scopeNow(); v.jrn = journalNow(); DB.vouchers.push(v); saveDB('vouchers');
    return v;
  }
  function saveVou() {
    var f = $('#pmVou'), type = f.dataset.type, rec = type === 'receipt';
    var v = { type: type, no: $('#vNo').value, date: $('#vDate').value, method: $('#vMeth').value, acc: $('#vAcc').value, party: $('#vParty').value.trim(), amount: R2(+$('#vAmt').value), desc: $('#vDesc').value.trim() };
    if (!v.date) return alert('اختر التاريخ.'); if (!(v.amount > 0)) return alert('اكتب مبلغًا أكبر من صفر.'); if (!v.acc) return alert('اختر الحساب المقابل.');
    var nn = $('#vNew').value.trim(); if (nn) { ensureAcc(nn, $('#vNewT').value || guessType(nn, codes[nn])); v.acc = nn; }
    if (!addVoucher(v)) return alert('تعذر إنشاء القيد (تأكد أن الحساب المقابل ليس نفس الخزينة/البنك).');
    afterChange(); toast('تم حفظ السند ' + v.no + ' ✅');
  }
  function vouHtml(v) {
    var rec = v.type === 'receipt';
    return '<div style="max-width:640px;margin:auto;border:2px solid #000;padding:18px"><h2 style="text-align:center;margin:0">' + E(DB.settings.company) + '</h2><h3 style="text-align:center;margin:6px 0 16px">' + (rec ? 'سند قبض' : 'سند صرف') + ' رقم ' + E(v.no) + '</h3>' +
      '<p style="line-height:2.2">التاريخ: ' + E(v.date) + '<br>' + (rec ? 'استلمنا من' : 'صرفنا إلى') + ': <b>' + E(v.acc) + '</b><br>مبلغ وقدره: <b>' + N(v.amount) + ' ' + E(DB.settings.currency) + '</b><br>وذلك عن: ' + E(v.desc || '—') + '<br>الوسيلة: ' + ({ cash: 'نقدًا (الخزينة)', bank: 'عن طريق البنك' })[v.method] + '</p>' +
      '<p style="margin-top:36px;display:flex;justify-content:space-between"><span>المحاسب: ..............</span><span>المستلم: ..............</span></p></div>';
  }

  /* حركة الخزينة والبنك */
  function pTreasury() {
    readF(); var f = state.F, cashAccs = accounts.filter(isCash).sort(byCodeAcc), cards = '';
    var bal = {}; allLines().forEach(function (l) { if (isCash(l.a)) bal[l.a] = (bal[l.a] || 0) + l.d - l.c; });
    cashAccs.forEach(function (a) { cards += '<div class="pm-k b"><small>' + E(a) + '</small><b>' + N(bal[a] || 0) + '</b></div>'; });
    var ls = allLines().filter(function (l) { return isCash(l.a) && inR(l.date, f.from, f.to); }).sort(cmpDN), run = 0, td = 0, tc = 0;
    var rows = ls.map(function (l) { run += l.d - l.c; td += l.d; tc += l.c; return [l.date, String(l.no), l.a, l.desc, l.d, l.c, run]; });
    rows.push({ cls: 'pm-tot', cells: ['', '', '', 'الإجمالي', td, tc, td - tc] });
    return '<div class="pm-kpi">' + (cards || '<div class="pm-k"><small>لا توجد حسابات خزينة أو بنك بعد.</small></div>') + '</div>' + filterBar() +
      '<div class="pm-card" id="pmRep">' + setRep('حركة الخزينة والبنك', periodTxt(), ['التاريخ', 'رقم القيد', 'الحساب', 'البيان', 'وارد (مدين)', 'منصرف (دائن)', 'الرصيد'], rows) + '</div>';
  }

  /* الأصول الثابتة والإهلاكات */
  function pAssets() {
    var A = scoped(DB.assets), y = state.depYear || lastYear();
    var rows = A.map(function (a) {
      var s = depSchedule(a), posted = Object.keys(a.posted || {}).length, acc = s.reduce(function (t, r) { return a.posted && a.posted[r.y] ? t + r.dep : t; }, 0);
      return [a.name, a.start, a.cost, a.salvage, a.life + ' سنة', a.method === 'db' ? 'قسط متناقص' : 'قسط ثابت', acc, R2(a.cost - acc), { h: '<button class="pm-b s o" data-act="selAsset" data-id="' + a.id + '">الجدول</button> <button class="pm-b s r" data-act="delAsset" data-id="' + a.id + '">حذف</button>' }];
    });
    var cur = A.find(function (a) { return a.id === state.selAsset; }), sched = '';
    if (cur) {
      sched = '<div class="pm-card"><h3>جدول إهلاك: ' + E(cur.name) + '</h3>' + grid(['السنة', 'القيمة الدفترية أول السنة', 'قسط الإهلاك', 'مجمع الإهلاك', 'القيمة الدفترية آخر السنة', 'الحالة'], depSchedule(cur).map(function (r) {
        var done = cur.posted && cur.posted[r.y]; return [String(r.y), r.open, r.dep, r.acc, r.close, { h: done ? '<span class="pm-badge ok">مُرحَّل</span>' : '<span class="pm-badge w">غير مُرحَّل</span>' }];
      })) + '</div>';
    }
    return '<div class="pm-card"><h3>إضافة أصل ثابت</h3><div class="pm-grid" id="pmAsset">' +
      '<label>اسم الأصل<input class="pm-in" id="aName" placeholder="مثال: سيارة نقل"></label><label>تاريخ الشراء / بدء الاستخدام<input class="pm-in" type="date" id="aStart" value="' + today() + '"></label>' +
      '<label>تكلفة الأصل<input class="pm-in" type="number" step="any" id="aCost"></label><label>القيمة التخريدية<input class="pm-in" type="number" step="any" id="aSal" value="0"></label>' +
      '<label>العمر الإنتاجي (سنوات)<input class="pm-in" type="number" step="any" id="aLife" value="5"></label>' +
      '<label>طريقة الإهلاك<select class="pm-in" id="aMeth"><option value="sl">القسط الثابت</option><option value="db">القسط المتناقص (ضعف المعدل)</option></select></label>' +
      '<label>قيد شراء الأصل<select class="pm-in" id="aBuy"><option value="">لا تسجل قيد الشراء</option><option value="النقدية">سجّل: نقدًا</option><option value="البنك">سجّل: من البنك</option><option value="الموردون">سجّل: آجل (موردون)</option></select></label></div>' +
      '<div style="margin-top:10px"><button class="pm-b p" data-act="addAsset">+ إضافة الأصل</button></div></div>' +
      '<div class="pm-card"><h3>سجل الأصول الثابتة</h3>' + grid(['الأصل', 'تاريخ البدء', 'التكلفة', 'التخريدية', 'العمر', 'الطريقة', 'المجمع المُرحَّل', 'القيمة الدفترية', 'إجراءات'], rows) + '</div>' + sched +
      '<div class="pm-card"><h3>قيود التسوية الجردية (الإهلاك)</h3><div class="pm-filter"><label>سنة الإهلاك<input class="pm-in" type="number" id="dYear" value="' + y + '" style="width:110px"></label><button class="pm-b g" data-act="postDep">⚙️ ترحيل قيود إهلاك السنة لكل الأصول</button></div>' +
      '<p class="pm-note">يُنشأ لكل أصل قيد بتاريخ 31 ديسمبر: من حـ/ مصروف إهلاك الأصل — إلى حـ/ مجمع إهلاك الأصل. ولا يُرحَّل نفس القسط مرتين.</p></div>';
  }
  /* إضافة أصل ثابت (سجل + قيد شراء اختياري) */
  function addAssetRec(a) {
    if (!a) return null;
    a.salvage = +a.salvage || 0; a.life = +a.life || 1; a.cost = R2(+a.cost || 0); a.method = a.method || 'sl';
    if (!a.name || !(a.cost > 0) || !(a.life > 0) || !(a.salvage < a.cost)) return null;
    a.id = uid(); a.start = a.start || today(); a.posted = a.posted || {}; ensureAcc(a.name, 'A', '12');
    if (a.buy) {
      var buyName = a.buy === 'cash' ? 'النقدية' : a.buy === 'bank' ? 'البنك' : a.buy;
      var cr = buyName === 'الموردون' ? subAcc('الموردون', 'موردو الأصول', 'L') : (ensureAcc(buyName, 'A', '11'), buyName);
      var id = postEntry('شراء أصل ثابت: ' + a.name, [[a.name, a.cost]], [[cr, a.cost]], a.start, { src: 'pro-asset', demo: a.demo });
      if (id == null) return null; a.buyEntry = id;
    }
    a.scope = scopeNow(); a.jrn = journalNow(); DB.assets.push(a); saveDB('assets');
    return a;
  }
  function addAsset() {
    var a = { name: $('#aName').value.trim(), start: $('#aStart').value, cost: R2(+$('#aCost').value), salvage: R2(+$('#aSal').value), life: +$('#aLife').value, method: $('#aMeth').value, posted: {} };
    if (!a.name) return alert('اكتب اسم الأصل.'); if (!a.start) return alert('اختر التاريخ.');
    if (!(a.cost > 0)) return alert('اكتب تكلفة الأصل.'); if (!(a.life > 0)) return alert('العمر الإنتاجي لازم يكون أكبر من صفر.'); if (a.salvage >= a.cost) return alert('القيمة التخريدية لازم تكون أقل من التكلفة.');
    a.buy = $('#aBuy').value;
    var r = addAssetRec(a); if (!r) return alert('تعذر إنشاء قيد الشراء.');
    state.selAsset = r.id; afterChange(); toast('تمت إضافة الأصل ✅');
  }
  /* ترحيل قسط إهلاك سنة واحدة لأصل واحد (يُرجع قيمة القسط أو صفر) */
  function postDepFor(a, y) {
    var r = depSchedule(a).find(function (x) { return x.y === y; }); a.posted = a.posted || {};
    if (!r || !(r.dep > 0) || a.posted[y]) return 0;
    var ex = 'مصروف إهلاك ' + a.name, ac = 'مجمع إهلاك ' + a.name; ensureAcc(ex, 'X', '5'); ensureAcc(ac, 'A', '12');
    var id = postEntry('قيد إهلاك ' + a.name + ' عن سنة ' + y, [[ex, r.dep]], [[ac, r.dep]], y + '-12-31', { src: 'pro-dep', demo: a.demo });
    if (id == null) return 0;
    a.posted[y] = id; return r.dep;
  }
  function postDep() {
    var y = +$('#dYear').value || lastYear(), n = 0, tot = 0; state.depYear = y;
    scoped(DB.assets).forEach(function (a) { var d = postDepFor(a, y); if (d) { n++; tot += d; } });
    saveDB('assets'); afterChange(); toast(n ? 'تم ترحيل ' + n + ' قيد إهلاك بإجمالي ' + N(tot) : 'لا توجد أقساط جديدة لهذه السنة.');
  }

  /* الضرائب */
  function pTax() {
    readF(); var f = state.F, v = vatData(f.from, f.to), rate = +DB.settings.vat || 0;
    return '<div class="pm-card"><h3>حاسبة ضريبة القيمة المضافة</h3><div class="pm-grid" id="pmCalc"><label>المبلغ<input class="pm-in" id="cAmt" type="number" step="any" placeholder="0.00"></label><label>النسبة %<input class="pm-in" id="cRate" type="number" step="any" value="' + rate + '"></label>' +
      '<label>المبلغ المدخل<select class="pm-in" id="cMode"><option value="ex">قبل الضريبة (صافي)</option><option value="in">شامل الضريبة</option></select></label></div><div class="pm-prev" id="cOut">أدخل المبلغ لحساب الضريبة.</div></div>' +
      filterBar('', true) +
      '<div class="pm-card" id="pmRep"><h3>الإقرار الضريبي — ' + periodTxt() + '</h3>' + setRep('إقرار ضريبة القيمة المضافة', periodTxt(), ['البند', 'القيمة الخاضعة', 'مبلغ الضريبة', 'النسبة المحتسبة'], [
        ['المبيعات (ضريبة المخرجات)', v.salesBase, v.out, v.salesBase ? (v.out / v.salesBase * 100).toFixed(2) + '%' : '—'], ['المشتريات (ضريبة المدخلات)', v.purBase, v.inn, v.purBase ? (v.inn / v.purBase * 100).toFixed(2) + '%' : '—'],
        { cls: 'pm-tot ' + (v.net >= 0 ? 'pm-neg' : 'pm-pos'), cells: [v.net >= 0 ? 'صافي الضريبة المستحقة للسداد' : 'صافي ضريبة قابلة للاسترداد', '', Math.abs(v.net), ''] }]) +
      '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button class="pm-b g" data-act="xlsx">📊 Excel</button><button class="pm-b r" data-act="print">📄 PDF / طباعة</button><button class="pm-b p" data-act="settleVat">⚖️ ترحيل قيد تسوية الضريبة</button></div>' +
      '<p class="pm-note">القيمة الخاضعة تُجمَع من المستندات اللي أنشأها النظام (فواتير البيع والشراء، المستخلصات، الخصم والإضافة) ومسجّلة على القيد نفسه، فتبقى النسبة المحتسبة = نسبة الضريبة في الإعدادات (' + rate + '%).' +
      (v.mix ? '<br><b style="color:#b45309">تنبيه:</b> فيه حركة ضريبة مسجّلة يدويًا في دفتر اليومية من غير مستند، فاتحسبت قيمتها الخاضعة = الضريبة ÷ ' + rate + '%. راجعها لو الأرقام غير مطابقة.' : '') + '</p></div>';
  }
  /* ترحيل قيد تسوية الضريبة (يُرجع رقم القيد أو null) */
  function postVatSettlement(from, to, date, demo) {
    var v = vatData(from, to);
    if (!v.out && !v.inn) return null;
    ensureAcc('ضريبة مبيعات مستحقة', 'L', '21'); ensureAcc('ضريبة مشتريات قابلة للخصم', 'A', '11');
    var D = [['ضريبة مبيعات مستحقة', v.out]], C = [['ضريبة مشتريات قابلة للخصم', v.inn]];
    if (v.net > 0) { ensureAcc('ضريبة القيمة المضافة المستحقة السداد', 'L', '21'); C.push(['ضريبة القيمة المضافة المستحقة السداد', v.net]); }
    else if (v.net < 0) { ensureAcc('ضريبة القيمة المضافة القابلة للاسترداد', 'A', '11'); D.push(['ضريبة القيمة المضافة القابلة للاسترداد', -v.net]); }
    return postEntry('قيد تسوية ضريبة القيمة المضافة عن الفترة ' + (from || 'البداية') + ' إلى ' + (to || today()), D, C, date || to || today(), { src: 'pro-vat', demo: demo });
  }
  function settleVat() {
    readF(); var f = state.F, v = vatData(f.from, f.to), to = f.to || today();
    if (!v.out && !v.inn) return alert('لا توجد حركة ضريبية في هذه الفترة.');
    if (!confirm('سيتم إنشاء قيد تسوية بتاريخ ' + to + ' بصافي ' + N(v.net) + '. متابعة؟')) return;
    if (postVatSettlement(f.from, f.to, to) == null) return alert('تعذر إنشاء القيد.');
    afterChange(); toast('تم ترحيل قيد التسوية ✅');
  }
  function calcVat() {
    var a = +$('#cAmt').value || 0, r = +$('#cRate').value || 0, inc = $('#cMode').value === 'in', net = inc ? a / (1 + r / 100) : a, vat = inc ? a - net : a * r / 100;
    $('#cOut').innerHTML = a ? 'قبل الضريبة: <b>' + N(net) + '</b> &nbsp;|&nbsp; الضريبة (' + r + '%): <b>' + N(vat) + '</b> &nbsp;|&nbsp; الإجمالي شامل الضريبة: <b>' + N(net + vat) + '</b>' : 'أدخل المبلغ لحساب الضريبة.';
  }

  /* المراجعة */
  function pAudit() {
    var r = runAudit(), er = r.issues.filter(function (x) { return x.sev === 'error'; }).length, wr = r.issues.length - er;
    var rows = r.issues.map(function (x) {
      return [{ h: '<span class="pm-badge ' + (x.sev === 'error' ? 'e">خطأ' : 'w">تنبيه') + '</span>' }, String(x.no), x.msg, { h: x.id != null ? '<button class="pm-b s r" data-act="delEntry" data-id="' + x.id + '">حذف القيد</button>' : '' }];
    });
    return '<div class="pm-kpi"><div class="pm-k ' + (r.balanced ? 'g' : 'r') + '"><small>ميزان المراجعة</small><b>' + (r.balanced ? 'متزن ✅' : 'غير متزن ❌') + '</b></div><div class="pm-k"><small>إجمالي القيود</small><b>' + r.total + '</b></div>' +
      '<div class="pm-k g"><small>قيود سليمة</small><b>' + r.clean + '</b></div><div class="pm-k r"><small>أخطاء</small><b>' + er + '</b></div><div class="pm-k o"><small>تنبيهات</small><b>' + wr + '</b></div></div>' +
      '<div class="pm-card" id="pmRep"><h3>نتائج المراجعة</h3>' + setRep('تقرير المراجعة وتتبع أخطاء القيود', 'إجمالي القيود: ' + r.total, ['النوع', 'رقم القيد', 'الملاحظة', 'إجراء'], rows.map(function (x, i) { return [r.issues[i].sev === 'error' ? 'خطأ' : 'تنبيه', x[1], x[2], x[3]]; })).replace(/<td>خطأ<\/td>/g, '<td><span class="pm-badge e">خطأ</span></td>').replace(/<td>تنبيه<\/td>/g, '<td><span class="pm-badge w">تنبيه</span></td>') +
      (r.issues.length ? '' : '<p style="color:#15803d;font-weight:700;text-align:center">✅ لا توجد أخطاء أو ملاحظات. القيود سليمة.</p>') +
      '<div style="margin-top:10px"><button class="pm-b g" data-act="xlsx">📊 Excel</button> <button class="pm-b r" data-act="print">📄 PDF / طباعة</button></div></div>' +
      '<p class="pm-note">الفحوصات: اتزان القيد، تكرار الحساب في الطرفين، مبالغ صفر/سالبة، حسابات غير موجودة أو غير مصنفة، بيان فارغ، تواريخ مستقبلية أو غير صالحة، قيود مكررة، وأرصدة غير طبيعية.</p>';
  }

  /* التقارير */
  function pJournal() {
    readF(); var f = state.F, rows = [], td = 0, tc = 0, n = 0;
    jEntries().map(function (e, i) { return { e: e, no: i + 1, date: e.date || '' }; }).filter(function (x) { return inR(x.date, f.from, f.to); }).sort(cmpDN).forEach(function (x) {
      rows.push({ sep: 'سند قيد: ' + x.no + '   —   \u2066' + x.date + '\u2069' });
      var side = function (l, o, dr) { l.forEach(function (ln) { var other = o.map(function (y) { return y.a; }); other = other.filter(function (v, i) { return other.indexOf(v) === i; }); n++; var m = +ln.m || 0; if (dr) td += m; else tc += m; rows.push([String(n), x.date, ln.a, other.length === 1 ? other[0] : 'متعددة', dr ? m : null, dr ? null : m, x.e.desc || '']); }); };
      side(x.e.debits || [], x.e.credits || [], true); side(x.e.credits || [], x.e.debits || [], false);
    });
    if (rows.length) rows.push({ cls: 'pm-tot', cells: ['', '', '', 'الإجمالي', td, tc, ''] });
    return filterBar() + '<div class="pm-card" id="pmRep">' + setRep('دفتر اليومية', periodTxt(), ['#', 'التاريخ', 'الحساب', 'الحساب المقابل', 'مدين', 'دائن', 'البيان'], rows) + '</div>';
  }
  function pLedger() {
    readF(); var f = state.F, used = Object.keys(trialData('', '').rows.reduce(function (o, r) { o[r.a] = 1; return o; }, {})).sort(byCodeAcc);
    if (!f.acc || used.indexOf(f.acc) < 0) f.acc = used[0] || '';
    var extra = '<label>الحساب<select class="pm-in" id="fAcc">' + used.map(function (a) { return '<option value="' + E(a) + '"' + (a === f.acc ? ' selected' : '') + '>' + (codes[a] ? E(codes[a]) + ' - ' : '') + E(a) + '</option>'; }).join('') + '</select></label>';
    if (!f.acc) return filterBar(extra) + '<div class="pm-card">لا توجد قيود بعد.</div>';
    var L = ledgerData(f.acc, f.from, f.to), sg = function (b) { return N(Math.abs(b)) + (b >= 0 ? ' م' : ' د'); };
    var rows = [{ cls: 'pm-sub', cells: [f.from || '', '', 'رصيد سابق', '', null, null, sg(L.open)] }].concat(L.rows.map(function (r) { return [r.date, String(r.no), r.desc, r.other, r.d, r.c, sg(r.bal)]; }));
    rows.push({ cls: 'pm-tot', cells: ['', '', 'الإجمالي', '', L.td, L.tc, sg(L.end)] });
    return filterBar(extra) + '<div class="pm-card" id="pmRep">' + setRep('دفتر الأستاذ: ' + f.acc, periodTxt(), ['التاريخ', 'رقم القيد', 'البيان', 'الحساب المقابل', 'مدين', 'دائن', 'الرصيد (م=مدين / د=دائن)'], rows) + '</div>';
  }
  function pTrial() {
    readF(); var f = state.F, T = trialData(f.from, f.to), t = T.tot;
    var rows = T.rows.map(function (r) { return [r.code, r.a, r.pD, r.pC, r.d, r.c, r.eD, r.eC]; });
    rows.push({ cls: 'pm-tot', cells: ['', 'الإجمالي', t.pD, t.pC, t.d, t.c, t.eD, t.eC] });
    var ok = Math.abs(t.eD - t.eC) < 0.005;
    return filterBar() + '<div class="pm-card" id="pmRep">' + setRep('ميزان المراجعة', periodTxt(), ['الكود', 'الحساب', 'رصيد سابق مدين', 'رصيد سابق دائن', 'حركة الفترة مدين', 'حركة الفترة دائن', 'رصيد آخر مدين', 'رصيد آخر دائن'], rows) +
      '<p style="text-align:center;font-weight:800;color:' + (ok ? '#15803d' : '#be123c') + '">' + (ok ? 'الميزان متوازن ✅' : 'الميزان غير متوازن ❌ — الفرق ' + N(Math.abs(t.eD - t.eC))) + '</p></div>';
  }
  function pPL() {
    readF(); var y = state.F.year || lastYear(), m = monthlyPL(y);
    var yrs = {}; allLines().forEach(function (l) { yrs[String(l.date).slice(0, 4)] = 1; }); yrs[y] = 1;
    var extra = '<label>السنة<select class="pm-in" id="fYear">' + Object.keys(yrs).sort().map(function (k) { return '<option' + (+k === y ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select></label>';
    var line = function (r) { return [r.a].concat(r.m).concat([r.tot]); }, sum = function (a) { return a.reduce(function (s, v) { return s + v; }, 0); };
    var rows = [{ sep: 'الدخل' }].concat(m.rev.map(line), [{ cls: 'pm-tot', cells: ['مجموع الدخل'].concat(m.totRev, [sum(m.totRev)]) }], [{ sep: 'المصروفات' }], m.exp.map(line), [{ cls: 'pm-tot', cells: ['مجموع المصروفات'].concat(m.totExp, [sum(m.totExp)]) }],
      [{ cls: 'pm-tot ' + (sum(m.net) >= 0 ? 'pm-pos' : 'pm-neg'), cells: [sum(m.net) >= 0 ? 'صافي الربح' : 'صافي الخسارة'].concat(m.net, [sum(m.net)]) }]);
    return filterBar(extra, false).replace(/<label>من[\s\S]*?<\/label><label>إلى[\s\S]*?<\/label>/, '') + '<div class="pm-card" id="pmRep">' + setRep('بيان الربح والخسارة — شهري (سنة ' + y + ')', 'سنة ' + y, ['البند'].concat(MONTHS, ['المجموع']), rows) + '</div>';
  }

  /* شيتات الشركات */
  function coLevelOf(co) { var l = co && +co.level; return l >= 1 && l <= 3 ? l : 0; }
  function coLvName(l) { var x = CO_LEVELS.find(function (v) { return v.id === l; }); return x ? x.name : 'غير محدد'; }
  /* بيان الشيت (السؤال) — يتولّد من أرصدة الشيت نفسها قبل عرض الحل */
  function coBrief(cur) {
    var st = statements(cur.rows), lv = coLevelOf(cur), n = cur.rows.length;
    var td = cur.rows.reduce(function (s, r) { return s + (+r.d || 0); }, 0), tc = cur.rows.reduce(function (s, r) { return s + (+r.c || 0); }, 0);
    var canDist = lv === 1 || lv === 2;
    /* لو فيه أثر لتوزيع الحل على الشيت ده نظهر زرار مسح واضح — الحذف مسموح للقيود التجريبية، التعديل محمي */
    var coKey = 'co:' + cur.id, hasDemo = jAll().some(function (e) { return e.demo === coKey; }) || DB.invoices.concat(DB.vouchers, DB.assets).some(function (x) { return x.demo === coKey; });
    var req = [
      'راجع اتزان ميزان المراجعة وصنّف كل حساب (أصول / خصوم / حقوق ملكية / إيرادات / مصروفات).',
      'أعد قائمة الدخل وحدد صافي الربح أو الخسارة.',
      'أعد قائمة المركز المالي وتحقق أن الأصول = الخصوم + حقوق الملكية.',
      'أعد قيود الإقفال اللازمة لإقفال الإيرادات والمصروفات.',
      canDist ? 'وزّع الحل على المنصة خطوة بخطوة، وجرّب نفسك بعدها في وضع الامتحان.' : 'استخدم الشيت كحالة متقدمة: راجع الحل ثم اختبر نفسك عليه.'
    ];
    var data = '<details open><summary style="cursor:pointer;font-weight:700;color:#43126a;margin-bottom:8px">بيانات السؤال — أرصدة ميزان المراجعة (' + n + ' حساب)</summary><div style="max-height:340px;overflow:auto">' +
      grid(['الكود', 'الحساب', 'مدين', 'دائن'], cur.rows.map(function (r) { return [r.code || '', r.a, r.d, r.c]; }).concat([{ cls: 'pm-tot', cells: ['', 'الإجمالي', td, tc] }])) + '</div></details>';
    return '<div class="pm-card"><div class="pm-h"><h3 style="margin:0">📋 بيان الشيت (السؤال)</h3><span class="pm-badge ' + (lv ? 'ok' : 'w') + '">' + E(coLvName(lv)) + '</span></div>' +
      '<p class="pm-note" style="font-size:13px">في نهاية الفترة أظهرت دفاتر <b>«' + E(cur.name) + '»</b> الأرصدة الموضحة في بيانات السؤال: <b>' + n + '</b> حسابًا، بإجمالي مدين <b>' + N(td) + '</b> = إجمالي دائن <b>' + N(tc) + '</b>' + (Math.abs(td - tc) < 0.005 ? ' (ميزان متزن ✅).' : ' (الميزان غير متزن ❌).') + ' المطلوب إعداد القوائم المالية كاملةً من هذه الأرصدة.</p>' +
      '<div class="pm-kpi" style="margin-bottom:10px"><div class="pm-k b"><small>إجمالي الأصول</small><b>' + N(st.tot('A')) + '</b></div><div class="pm-k o"><small>إجمالي الخصوم</small><b>' + N(st.tot('L')) + '</b></div>' +
      '<div class="pm-k"><small>حقوق الملكية + النتيجة</small><b>' + N(st.eq) + '</b></div><div class="pm-k ' + (st.ni >= 0 ? 'g' : 'r') + '"><small>' + (st.ni >= 0 ? 'صافي الربح' : 'صافي الخسارة') + '</small><b>' + N(Math.abs(st.ni)) + '</b></div></div>' +
      '<div class="pm-prev"><b>المطلوب:</b><br>' + req.map(function (x, i) { return (i + 1) + ') ' + E(x); }).join('<br>') + '</div>' + data +
      '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
      (canDist ? '<button class="pm-b g" data-act="coDistribute">🎬 توزيع الحل على المنصة (خطوة بخطوة)</button>' : '<button class="pm-b" disabled style="opacity:.45;cursor:not-allowed">🎬 توزيع الحل — للمستوى المبتدئ والمتوسط فقط</button>') +
      '<button class="pm-b p" data-act="coExam">🧠 جرّب نفسك واختبر حلك</button>' +
      (hasDemo ? '<button class="pm-b r" data-act="coClearDemo">🧹 مسح أثر التوزيع التجريبي</button>' : '') +
      '<label style="font-size:12px;color:#5b4a73;font-weight:600">مستوى الشيت: <select class="pm-in" data-chg="coLv" style="width:auto;display:inline-block">' +
      [0, 1, 2, 3].map(function (l) { return '<option value="' + l + '"' + (l === lv ? ' selected' : '') + '>' + (l ? coLvName(l) : 'غير محدد') + '</option>'; }).join('') + '</select></label></div>' +
      '<p class="pm-note" style="margin-top:6px">التوزيع بيحكي قصة الحل: يبدأ بقيد افتتاحي، بعدها يسجّل الأصول الثابتة والمخزون والضريبة كلٌّ في شاشته، وينتهي بالقوائم المالية — نفس ترتيب حل الشيت على المنصة.</p></div>';
  }
  function pCompany() {
    var cs = state.cs, list = DB.companies, cur = list.find(function (c) { return c.id === cs.id; });
    var lv = state.coLevel || 1, lvInfo = CO_LEVELS.find(function (l) { return l.id === lv; }) || CO_LEVELS[0];
    var lvCards = CO_LEVELS.map(function (l) {
      var cnt = SAMPLES.filter(function (s) { return s.level === l.id; }).length;
      return '<button class="pm-lv' + (l.id === lv ? ' on' : '') + '" data-act="coLevel" data-id="' + l.id + '"><b>' + E(l.name) + '</b><small>' + E(l.desc) + '</small><span>' + cnt + ' شيت تدريبي</span></button>';
    }).join('');
    var smpList = SAMPLES.filter(function (s) { return s.level === lv; }).map(function (s) {
      var b = sampleBalanced(s), n = sampleRows(s).length;
      return '<button class="pm-smp" data-act="sampleCo" data-id="' + s.id + '"><span><b>🧪 ' + E(s.name) + '</b><small>' + E(s.note) + '</small></span><span class="pm-smpst' + (b.ok ? '' : ' bad') + '">' + n + ' حساب · ' + (b.ok ? 'متزن ✅' : 'غير متزن ❌') + '</span></button>';
    }).join('');
    var top = '<div class="pm-card"><h3>تحميل بيانات شركة حقيقية</h3><p class="pm-note">ارفع ملف Excel أو CSV فيه أعمدة: <b>الكود (اختياري) — الحساب — مدين — دائن</b> (ميزان مراجعة الشركة). يصنّف النظام الحسابات تلقائيًا وتقدر تعدّل التصنيف، ثم تستعرض القوائم وتراجعها وتحمّلها في المنصة.</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><label class="pm-b p" style="cursor:pointer">📂 رفع ملف Excel / CSV<input type="file" id="pmFile" accept=".xlsx,.xls,.csv,.txt" style="display:none"></label><button class="pm-b o" data-act="tplFile">⬇️ تحميل نموذج الملف</button></div></div>' +
      '<div class="pm-card"><h3>اختر مستوى الشيت التدريبي أولًا</h3><p class="pm-note">حدّد المستوى المناسب لمستواك في المحاسبة، وبعدها اختر الشيت اللي عايز تتدرب عليه من قائمة المستوى. كل شيت ميزان مراجعة كامل ومتزن وجاهز للتحميل في المنصة.</p>' +
      '<div class="pm-grid" style="grid-template-columns:repeat(auto-fit,minmax(210px,1fr));margin-bottom:12px">' + lvCards + '</div>' +
      '<div class="pm-h"><h3 style="margin:0;font-size:14.5px">شيتات ' + E(lvInfo.name) + '</h3><span class="pm-badge ok">' + SAMPLES.filter(function (s) { return s.level === lv; }).length + ' نموذج</span></div>' + smpList + '</div>';
    var cards = list.length ? '<div class="pm-tabs">' + list.map(function (c) { return '<button class="pm-b ' + (cur && c.id === cur.id ? 'p' : 'o') + '" data-act="openCo" data-id="' + c.id + '">🏢 ' + E(c.name) + '</button>'; }).join('') + '</div>' : '';
    if (!cur) return top + cards + (list.length ? '<div class="pm-card">اختر شركة من الأعلى.</div>' : '');
    var tabs = [['tb', 'ميزان المراجعة'], ['is', 'قائمة الدخل'], ['bs', 'المركز المالي'], ['cl', 'قيود الإقفال']].map(function (t) { return '<button class="pm-b ' + (cs.tab === t[0] ? 'on' : 'o') + '" data-act="coTab" data-id="' + t[0] + '">' + t[1] + '</button>'; }).join('');
    var st = statements(cur.rows), body = '', ttl = cur.name;
    var sec = function (title, k) { var r = [{ sep: title }].concat(st.by[k].map(function (x) { return [x.a, x.v]; })); r.push({ cls: 'pm-tot', cells: ['إجمالي ' + title, st.tot(k)] }); return r; };
    if (cs.tab === 'tb') {
      var td = 0, tc = 0, rows = cur.rows.map(function (r, i) { td += r.d; tc += r.c; return [r.code || '', r.a, r.d, r.c, { h: '<select class="pm-in" data-chg="coType" data-i="' + i + '" style="width:130px">' + Object.keys(TN_).map(function (k) { return '<option value="' + k + '"' + (r.t === k ? ' selected' : '') + '>' + TN_[k] + '</option>'; }).join('') + '</select>' }]; });
      rows.push({ cls: 'pm-tot', cells: ['', 'الإجمالي', td, tc, Math.abs(td - tc) < 0.005 ? '✅ متوازن' : '❌ غير متوازن'] });
      body = setRep('ميزان المراجعة — ' + ttl, '', ['الكود', 'الحساب', 'مدين', 'دائن', 'التصنيف'], rows);
    } else if (cs.tab === 'is') {
      body = setRep('قائمة الدخل — ' + ttl, '', ['البند', 'المبلغ'], sec('الإيرادات', 'R').concat(sec('المصروفات', 'X'), [{ cls: 'pm-tot ' + (st.ni >= 0 ? 'pm-pos' : 'pm-neg'), cells: [st.ni >= 0 ? 'صافي الربح' : 'صافي الخسارة', Math.abs(st.ni)] }]));
    } else if (cs.tab === 'bs') {
      var eqRows = [{ sep: 'حقوق الملكية' }].concat(st.by.E.map(function (x) { return [x.a, x.v]; }), [[st.ni >= 0 ? 'صافي ربح الفترة' : 'صافي خسارة الفترة', st.ni], { cls: 'pm-tot', cells: ['إجمالي حقوق الملكية', st.eq] }]);
      body = setRep('قائمة المركز المالي — ' + ttl, '', ['البند', 'المبلغ'], sec('الأصول', 'A').concat(sec('الخصوم', 'L'), eqRows, [{ cls: 'pm-tot', cells: ['إجمالي الخصوم وحقوق الملكية', st.tot('L') + st.eq] }])) +
        '<p style="text-align:center;font-weight:800;color:' + (st.ok ? '#15803d' : '#be123c') + '">' + (st.ok ? 'الأصول = الخصوم + حقوق الملكية ✅' : 'القائمة غير متزنة ❌ — راجع تصنيف الحسابات') + '</p>';
    } else {
      var cl = [], isum = 'ملخص الدخل';
      st.by.R.forEach(function (x) { if (x.v) cl.push([x.a, x.v, null]); }); if (st.tot('R')) cl.push([isum, null, st.tot('R')]);
      var r2 = []; if (st.tot('X')) r2.push([isum, st.tot('X'), null]); st.by.X.forEach(function (x) { if (x.v) r2.push([x.a, null, x.v]); });
      var cap = (st.by.E.find(function (x) { return /أرباح محتجزة|ارباح محتجزة/.test(x.a); }) || st.by.E.find(function (x) { return /رأس المال|راس المال/.test(x.a); }) || { a: 'الأرباح المحتجزة' }).a;
      var r3 = st.ni >= 0 ? [[isum, st.ni, null], [cap, null, st.ni]] : [[cap, -st.ni, null], [isum, null, -st.ni]];
      body = setRep('قيود الإقفال — ' + ttl, '', ['الحساب', 'مدين', 'دائن'], [{ sep: '1) إقفال الإيرادات في ملخص الدخل' }].concat(cl.map(function (x) { return [x[0], x[1] === null ? null : x[1], x[2]]; }).map(function (x, i, a) { return x; }),
        [{ sep: '2) إقفال المصروفات في ملخص الدخل' }], r2, [{ sep: '3) ترحيل صافي ' + (st.ni >= 0 ? 'الربح' : 'الخسارة') + ' إلى حقوق الملكية' }], r3)).replace('<tr class="pm-sep">', '<tr class="pm-sep">');
    }
    return top + cards + coBrief(cur) + '<div class="pm-card" id="pmRep"><div class="pm-h"><h3 style="margin:0">✅ الحل — ' + E(cur.name) + '</h3><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="pm-b p" data-act="coLoad">⬆️ تحميل كقيد افتتاحي في المنصة</button><button class="pm-b g" data-act="xlsx">📊 Excel</button><button class="pm-b r" data-act="print">📄 PDF</button><button class="pm-b s r" data-act="coDel">حذف</button></div></div><div class="pm-tabs">' + tabs + '</div>' + body + '</div>';
  }
  function numv(v) { if (v == null || v === '') return 0; var s = String(v).replace(/[\u0660-\u0669]/g, function (d) { return d.charCodeAt(0) - 0x660; }).replace(/[\u06F0-\u06F9]/g, function (d) { return d.charCodeAt(0) - 0x6F0; }).replace(/[,\s٬]/g, '').replace(/[()]/g, ''); var n = parseFloat(s); return isNaN(n) ? 0 : n; }
  function parseTB(aoa) {
    var hi = -1, ia = -1, id = -1, ic = -1, ik = -1;
    for (var i = 0; i < Math.min(aoa.length, 15) && hi < 0; i++) {
      var r = aoa[i] || [];
      r.forEach(function (c, j) { var s = String(c || ''); if (/مدين|debit/i.test(s)) id = j; if (/دائن|credit/i.test(s)) ic = j; if (/^(الحساب|اسم الحساب|البيان|account|name)/i.test(s.trim())) ia = j; if (/^(الكود|كود|رقم الحساب|code)/i.test(s.trim())) ik = j; });
      if (id >= 0 && ic >= 0) hi = i; else { id = ic = ia = ik = -1; }
    }
    if (hi < 0) { hi = -1; var r0 = aoa[0] || []; if (r0.length >= 4 && !isNaN(numv(r0[0])) && isNaN(parseFloat(String(r0[1])))) { ik = 0; ia = 1; id = 2; ic = 3; } else { ia = 0; id = 1; ic = 2; ik = -1; } }
    if (ia < 0) { ia = 0; for (var j = 0; j < 4; j++) { if (j !== id && j !== ic && j !== ik) { ia = j; break; } } }
    var out = [];
    aoa.slice(hi + 1).forEach(function (r) { r = r || []; var a = String(r[ia] == null ? '' : r[ia]).trim(); if (!a || /^(الإجمالي|اجمالي|المجموع|total)/i.test(a)) return; var d = numv(r[id]), c = numv(r[ic]); if (!d && !c) return; var code = ik >= 0 ? String(r[ik] == null ? '' : r[ik]).trim() : ''; out.push({ code: code, a: a, d: d, c: c, t: guessType(a, code) }); });
    return out;
  }
  function readFile(file) {
    var name = file.name.replace(/\.[^.]+$/, ''), rd = new FileReader(), isCsv = /\.(csv|txt)$/i.test(file.name);
    rd.onerror = function () { alert('تعذر قراءة الملف.'); };
    rd.onload = function () {
      try {
        var aoa;
        if (isCsv || typeof XLSX === 'undefined') {
          if (!isCsv) return alert('مكتبة Excel غير محمّلة (تحتاج إنترنت). احفظ الملف بصيغة CSV وارفعه.');
          var txt = rd.result; aoa = txt.split(/\r?\n/).map(function (l) { var sep = l.indexOf('\t') >= 0 ? '\t' : (l.indexOf(';') >= 0 ? ';' : ','); return l.split(sep).map(function (x) { return x.replace(/^"|"$/g, ''); }); });
        } else { var wb = XLSX.read(rd.result, { type: 'array' }); aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }); }
        var rows = parseTB(aoa); if (!rows.length) return alert('لم أجد أرصدة في الملف. تأكد من وجود أعمدة: الحساب / مدين / دائن.');
        var co = { id: uid(), name: name, rows: rows }; DB.companies.push(co); saveDB('companies'); state.cs = { id: co.id, tab: 'tb' }; renderPage(); toast('تم تحميل ' + rows.length + ' حساب ✅');
      } catch (e) { console.error(e); alert('الملف غير صالح أو غير مدعوم.'); }
    };
    if (isCsv || typeof XLSX === 'undefined') rd.readAsText(file); else rd.readAsArrayBuffer(file);
  }

  function pSettings() {
    var s = DB.settings, j = journalNow();
    return '<div class="pm-card"><h3>إعدادات مود الاحتراف</h3><div class="pm-grid"><label>اسم الشركة (يظهر في الفواتير والتقارير)<input class="pm-in" id="sCo" value="' + E(s.company) + '"></label><label>العملة<input class="pm-in" id="sCur" value="' + E(s.currency) + '"></label><label>نسبة ضريبة القيمة المضافة %<input class="pm-in" type="number" step="any" id="sVat" value="' + (+s.vat || 0) + '"></label></div>' +
      '<div style="margin-top:10px"><button class="pm-b p" data-act="saveSet">💾 حفظ الإعدادات</button></div></div>' +
      '<div class="pm-card"><h3>وجهة ترحيل القيود — افصل الاحتراف عن المنصة</h3>' +
      '<div class="pm-grid"><label>كل قيد جديد (فاتورة/سند/إهلاك/قيد يدوي) يُرحَّل إلى<select class="pm-in" id="sJrn">' +
      '<option value="academic"' + (j === 'academic' ? ' selected' : '') + '>🎓 المنصة الأكاديمية (شيت المنصة نفسه)</option>' +
      '<option value="pro"' + (j === 'pro' ? ' selected' : '') + '>📒 دفتر اليومية المهني (دفتر مستقل داخل مود الاحتراف)</option></select></label></div>' +
      '<p class="pm-note">الدفتان منفصلان تمامًا وكل واحد له قيوده ومستنداته: قيود المنصة تظهر في الوضع الأكاديمي وكل شاشاته، وقيود الدفتر المهني تظهر في تقارير مود الاحتراف فقط. تغيير الوجهة لا ينقل القيود القديمة، بيبدأ يكتب الجديد في الدفتر المختار. ' +
      'عدد قيود المنصة الحالي: <b>' + entries.length + '</b> — عدد قيود الدفتر المهني لهذا الشيت: <b>' + proList().length + '</b>.</p></div>' +
      '<div class="pm-card"><h3>إدارة البيانات</h3><p class="pm-note">القيود الناتجة عن الفواتير والسندات والإهلاك محفوظة في الدفتر المختار أعلاه، وتظهر في تقارير المود، وتدخل في النسخة الاحتياطية العادية.</p>' +
      '<button class="pm-b r" data-act="resetPro">🧹 مسح سجلات هذا الشيت فقط (الفواتير/السندات/الأصول) مع إبقاء القيود</button></div>' +
      '<div class="pm-card"><h3>عن الموديول</h3><p class="pm-note">باتش الواقعية v1.0 — ملف خارجي مستقل (pro-mode.js) لا يعدّل كود النواة، ويمكن إزالته بحذف سطر الـ script بدون التأثير على المنصة الأساسية.</p></div>';
  }

  var PAGES = { dash: pDash, sale: function () { return pInvoice('sale'); }, purchase: function () { return pInvoice('purchase'); }, receipt: function () { return pVoucher('receipt'); }, payment: function () { return pVoucher('payment'); }, treasury: pTreasury, assets: pAssets, tax: pTax, audit: pAudit, rjournal: pJournal, rledger: pLedger, rtrial: pTrial, rpl: pPL, company: pCompany, settings: pSettings };

  var CHG = {
    /* تحديد مستوى الشيت يدويًا (مهم للشيتات المرفوعة عشان يتفتح ليها التوزيع والتصحيح) */
    coLv: function (t) { var co = DB.companies.find(function (c) { return c.id === state.cs.id; }); if (!co) return; co.level = +t.value || 0; saveDB('companies'); renderPage(); toast(co.level ? 'تم تحديد ' + coLvName(co.level) : 'تم إلغاء تحديد المستوى'); }
  }, INP = {}, RECON = [], BAR = null;
  function navHtml() {
    return NAV.map(function (g) {
      var it = g.i.filter(function (i) { return PAGES[i[0]]; });
      if (!it.length) return '';
      return '<div class="pm-g">' + g.g + '</div>' + it.map(function (i) { return '<button class="pm-nav" data-go="' + i[0] + '"><span>' + i[1] + '</span>' + i[2] + '</button>'; }).join('');
    }).join('');
  }
  /* واجهة التسجيل: تسمح لملفات خارجية (مثل pro-modules.js) بإضافة صفحات ووحدات بدون تعديل هذا الملف */
  function register(d) {
    Object.assign(PAGES, d.pages || {}); Object.assign(ACT, d.acts || {}); Object.assign(CHG, d.chg || {}); Object.assign(INP, d.inp || {});
    if (d.reconcile) RECON.push(d.reconcile); if (d.bar) BAR = d.bar;
    if (root) { var n = $('#pmNav'); if (n) n.innerHTML = navHtml(); }
  }

  /* ------------------------------------------------ الهيكل والتفاعل */
  function buildShell() {
    if (root) return;
    var st = document.createElement('style'); st.id = 'pmCss'; st.textContent = CSS; document.head.appendChild(st);
    root = document.createElement('div'); root.className = 'pm'; root.id = 'proRoot'; root.setAttribute('dir', 'rtl');
    root.innerHTML = '<aside class="pm-side" id="pmSide"><div class="pm-brand"><b>EDU_Acc ERP</b><span>مود الاحتراف والواقعية</span></div>' +
      '<div id="pmNav">' + navHtml() + '</div><div style="flex:1"></div><div style="padding:12px 14px"><button class="pm-b" style="width:100%" data-act="exit">← العودة للوضع الأكاديمي</button></div></aside>' +
      '<div class="pm-main"><div class="pm-top"><button class="pm-b o pm-menu" data-act="menu">☰</button><b id="pmTitle" style="font-size:15px"></b><span id="pmSheetTag" class="pm-note"></span><span id="pmJrnTag" class="pm-note"></span><span class="pm-sp"></span><button class="pm-b o" data-act="toggleSheets" id="pmShToggle" title="إخفاء/إظهار شريط الشيتات">📑</button><button class="pm-b o" data-act="newSheet">＋ شيت جديد</button><button class="pm-b g" data-go="sale">+ فاتورة بيع</button><button class="pm-b o" data-go="receipt">+ سند قبض</button><button class="pm-b o" data-go="payment">+ سند صرف</button><span id="pmWho" class="pm-note"></span></div><div class="pm-sheets" id="pmSheets"></div><div id="pmBar"></div><div class="pm-body" id="pmBody"></div></div>';
    document.body.appendChild(root);
    /* استرجاع تفضيل إخفاء شريط الشيتات (بيتحفظ زي الوضع الأكاديمي) */
    try { if (localStorage.getItem('pm_sheets_off') === '1') { root.classList.add('sheets-off'); var tb = document.getElementById('pmShToggle'); if (tb) tb.textContent = '📑 إظهار الشيتات'; } } catch (e) { }
    var pr = document.createElement('div'); pr.id = 'pmPrint'; document.body.appendChild(pr);
    root.addEventListener('click', function (ev) {
      var sdel = ev.target.closest('[data-sheet-del]');
      if (sdel) {
        var d0 = sheetsNow();
        if (typeof window.deleteScenario !== 'function') return alert('حذف الشيت متاح من شريط الشيتات في الوضع الأكاديمي.');
        state.cs = { id: null, tab: 'tb' }; state.selAsset = null;
        window.deleteScenario(d0.act); return;
      }
      var sh = ev.target.closest('[data-sheet]');
      if (sh) { switchSheet(+sh.dataset.sheet); return; }
      var g = ev.target.closest('[data-go]'); if (g) { state.page = g.dataset.go; state.navOpen = false; renderPage(); return; }
      var a = ev.target.closest('[data-act]'); if (!a) return;
      var fn = ACT[a.dataset.act]; if (fn) { try { fn(a); } catch (e) { console.error(e); alert('حدث خطأ: ' + e.message); } }
    });
    root.addEventListener('input', function (ev) {
      var di = ev.target.dataset && ev.target.dataset.inp; if (di && INP[di]) { try { INP[di](ev.target, ev); } catch (e) { console.error(e); } }
      if (ev.target.closest('#pmInv')) previewInv();
      if (ev.target.closest('#pmCalc')) calcVat();
    });
    /* دبل كليك على اسم شيت = إعادة تسمية (زي الشريط الأكاديمي) */
    root.addEventListener('dblclick', function (ev) {
      var sh = ev.target.closest('[data-sheet]'); if (!sh) return;
      if (typeof window.renameScenario !== 'function') return;
      try { window.renameScenario(+sh.dataset.sheet); } catch (e) { console.error(e); }
      renderSheetBar();
    });
    root.addEventListener('change', function (ev) {
      var t = ev.target;
      if (t.id === 'pmFile') { if (t.files[0]) readFile(t.files[0]); t.value = ''; return; }
      if (t.dataset.chg === 'coType') { var co = DB.companies.find(function (c) { return c.id === state.cs.id; }); if (co) { co.rows[+t.dataset.i].t = t.value; saveDB('companies'); renderPage(); } return; }
      var dc = t.dataset && t.dataset.chg; if (dc && CHG[dc]) { try { CHG[dc](t, ev); } catch (e) { console.error(e); } return; }
      if (t.id === 'fAcc' || t.id === 'fYear') { readF(); renderPage(); }
      if (t.closest('#pmInv')) previewInv();
      if (t.closest('#pmCalc')) calcVat();
    });
  }
  var ACT = {
    exit: function () { setMode(false); },
    menu: function () { $('#pmSide').classList.toggle('open'); },
    newSheet: function () {
      if (typeof window.newScenario !== 'function') return alert('إنشاء شيت جديد متاح من شريط الشيتات في الوضع الأكاديمي.');
      window.newScenario();
      setTimeout(function () { loadDB(); renderPage(); }, 80);
    },
    /* إخفاء/إظهار شريط الشيتات — التفضيل بيتحفظ عشان يفضل زي ما الطالب سابه */
    toggleSheets: function () {
      var h = root.classList.toggle('sheets-off');
      try { localStorage.setItem('pm_sheets_off', h ? '1' : '0'); } catch (e) { }
      var b = $('#pmShToggle'); if (b) b.textContent = h ? '📑 إظهار الشيتات' : '📑 إخفاء الشيتات';
    },
    applyF: function () { readF(); renderPage(); },
    clearF: function () { state.F.from = state.F.to = ''; renderPage(); },
    addRow: function () { $('#iRows').insertAdjacentHTML('beforeend', invRow()); previewInv(); },
    delRow: function (a) { var tr = a.closest('tr'); if ($$('.pm-it').length > 1) { tr.remove(); previewInv(); } },
    saveInv: saveInv, saveVou: saveVou, addAsset: addAsset, postDep: postDep, settleVat: settleVat,
    delInv: function (a) { var v = scoped(DB.invoices).find(function (x) { return x.id === a.dataset.id; }); if (!v || !confirm('حذف الفاتورة ' + v.no + ' وقيدها المحاسبي؟')) return; removeEntry(v.entryId); DB.invoices = DB.invoices.filter(function (x) { return x !== v; }); saveDB('invoices'); afterChange(); },
    delVou: function (a) { var v = scoped(DB.vouchers).find(function (x) { return x.id === a.dataset.id; }); if (!v || !confirm('حذف السند ' + v.no + ' وقيده المحاسبي؟')) return; removeEntry(v.entryId); DB.vouchers = DB.vouchers.filter(function (x) { return x !== v; }); saveDB('vouchers'); afterChange(); },
    printInv: function (a) { var v = scoped(DB.invoices).find(function (x) { return x.id === a.dataset.id; }); if (v) printHtml(invHtml(v)); },
    printVou: function (a) { var v = scoped(DB.vouchers).find(function (x) { return x.id === a.dataset.id; }); if (v) printHtml(vouHtml(v)); },
    selAsset: function (a) { state.selAsset = a.dataset.id; renderPage(); },
    delAsset: function (a) { var x = scoped(DB.assets).find(function (v) { return v.id === a.dataset.id; }); if (!x || !confirm('حذف الأصل «' + x.name + '» من السجل وحذف قيود الإهلاك المرتبطة به؟ (قيد الشراء يبقى)')) return; Object.keys(x.posted || {}).forEach(function (y) { removeEntry(x.posted[y]); }); DB.assets = DB.assets.filter(function (v) { return v !== x; }); saveDB('assets'); afterChange(); },
    delEntry: function (a) { var id = +a.dataset.id; if (!confirm('حذف هذا القيد نهائيًا؟')) return; var e = jEntries().find(function (x) { return String(x.id) === String(a.dataset.id); }); if (e) removeEntry(e.id); afterChange(); },
    xlsx: exportXlsx, print: function () { if (REP) printHtml(repHtml()); },
    saveSet: function () {
      var s = DB.settings, sel = $('#sJrn'), want = sel ? sel.value : journalNow();
      if (want !== journalNow()) {
        var nOld = jEntries().length;
        if (!confirm('هتحوّل الترحيل من «' + (want === 'pro' ? 'الدفتر الأكاديمي للدفتر المهني' : 'الدفتر المهني للمنصة الأكاديمية') + '».\nالقيود الموجودة (' + nOld + ') هتفضل في دفترها زي ما هي، والقيود الجديدة هتكتب في الدفتر الجديد. متابعة؟')) { renderPage(); return; }
      }
      DB.settings = { company: $('#sCo').value.trim() || 'شركتي', currency: $('#sCur').value.trim() || 'ج.م', vat: +$('#sVat').value || 0, journal: want };
      saveDB('settings'); toast('تم حفظ الإعدادات — الترحيل الآن إلى ' + (want === 'pro' ? 'الدفتر المهني 📒' : 'المنصة الأكاديمية 🎓')); renderPage();
    },
    resetPro: function () { if (!confirm('سيتم مسح سجلات هذا الشيت فقط (الفواتير والسندات والأصول) مع إبقاء القيود وشيتات الشركات. متابعة؟')) return; DB.invoices = DB.invoices.filter(function (x) { return !inScope(x); }); DB.vouchers = DB.vouchers.filter(function (x) { return !inScope(x); }); DB.assets = DB.assets.filter(function (x) { return !inScope(x); }); ['invoices', 'vouchers', 'assets'].forEach(saveDB); renderPage(); toast('تم مسح سجلات الشيت الحالي.'); },
    openCo: function (a) { state.cs = { id: a.dataset.id, tab: 'tb' }; renderPage(); },
    /* مسح أثر «توزيع الحل» لشيت شركة معيّن: القيود والمستندات التجريبية بتاعته بس (الحذف مسموح، التعديل محمي) */
    coClearDemo: function () {
      var co = DB.companies.find(function (c) { return c.id === state.cs.id }); if (!co) return;
      var key = 'co:' + co.id;
      var has = jAll().some(function (e) { return e.demo === key; }) || ['invoices', 'vouchers', 'assets'].some(function (k) { return DB[k].some(function (x) { return x.demo === key; }); });
      if (!has) return alert('مفيش أثر لتوزيع الحل على هذا الشيت — الشيت نظيف.');
      if (!confirm('هيتم مسح قيود «توزيع الحل» التجريبية الخاصة بشيت «' + co.name + '» فقط (من الدفترين)، مع فواتيره وسنداته وأصوله التجريبية. قيودك أنت هتفضل زي ما هي. متابعة؟')) return;
      var n = clearDemoKey(key);
      try { if (typeof window.__PMX_RESET_RUN === 'function') window.__PMX_RESET_RUN(key); } catch (e) { }
      afterChange(); toast('تم مسح أثر التوزيع التجريبي (' + n + ' قيد) ✅ — تقدر تبدأ حلك بنفسك');
    },
    coTab: function (a) { state.cs.tab = a.dataset.id; renderPage(); },
    coDel: function () { if (!confirm('حذف هذه الشركة من القائمة؟')) return; DB.companies = DB.companies.filter(function (c) { return c.id !== state.cs.id; }); saveDB('companies'); state.cs = { id: null, tab: 'tb' }; renderPage(); },
    coLevel: function (a) { state.coLevel = +(a.dataset.id || 1) || 1; renderPage(); },
    sampleCo: function (a) {
      var s = sampleById(a.dataset.id); if (!s) return;
      var b = sampleBalanced(s), n = sampleRows(s).length;
      if (!b.ok) return alert('هذا النموذج غير متزن (مدين ' + N(b.td) + ' / دائن ' + N(b.tc) + ') ولا يمكن إضافته.');
      if (DB.companies.some(function (c) { return c.name === s.name; })) return alert('النموذج «' + s.name + '» مضاف بالفعل في القائمة.');
      if (!confirm('إضافة شيت «' + s.name + '» للتدريب؟\n' + n + ' حساب — إجمالي مدين ' + N(b.td) + ' = إجمالي دائن ' + N(b.tc) + ' ✅')) return;
      var co = { id: uid(), name: s.name, level: s.level, note: s.note, rows: sampleRows(s) };
      DB.companies.push(co); saveDB('companies'); state.cs = { id: co.id, tab: 'tb' }; renderPage(); toast('تمت إضافة الشيت ✅');
    },
    tplFile: function () {
      var aoa = [['الكود', 'الحساب', 'مدين', 'دائن'], ['1101', 'النقدية', 50000, 0], ['1103', 'العملاء', 30000, 0], ['2101', 'الموردون', 0, 20000], ['3101', 'رأس المال', 0, 60000], ['4101', 'المبيعات', 0, 40000], ['5101', 'المشتريات', 40000, 0]];
      dl(aoa, 'نموذج_ميزان_مراجعة_شركة', 'ميزان');
    },
    coLoad: function () {
      var co = DB.companies.find(function (c) { return c.id === state.cs.id; }); if (!co) return;
      var D = [], C = []; co.rows.forEach(function (r) { var b = R2(r.d - r.c); if (!b) return; ensureAcc(r.a, r.t, r.code && /^[1-5]/.test(r.code) ? (/^[12]/.test(r.code) ? r.code.slice(0, 2) : r.code[0]) : undefined); if (r.code && !codes[r.a]) { } (b > 0 ? D : C).push([r.a, Math.abs(b)]); });
      var sd = D.reduce(function (s, x) { return s + x[1]; }, 0), sc = C.reduce(function (s, x) { return s + x[1]; }, 0);
      if (Math.abs(sd - sc) >= 0.005) return alert('الميزان غير متوازن (الفرق ' + N(Math.abs(sd - sc)) + '). صحّح الأرصدة أولًا.');
      if (!confirm('سيُضاف قيد افتتاحي مركّب بـ ' + (D.length + C.length) + ' حساب إلى دفتر يومية المنصة. متابعة؟')) return;
      var id = postEntry('قيد افتتاحي — ' + co.name, D, C, today(), { src: 'pro-open' }); if (id == null) return alert('تعذر إنشاء القيد.');
      afterChange(); toast('تم تحميل بيانات الشركة في المنصة ✅');
    }
  };

  /* التصدير والطباعة */
  function dl(aoa, name, sheet, title) {
    if (typeof XLSX !== 'undefined') {
      var ws = XLSX.utils.aoa_to_sheet(aoa), wb = XLSX.utils.book_new(); ws['!cols'] = (aoa[aoa.length > 3 ? 3 : 0] || []).map(function (_, i) { return { wch: i === 0 && aoa[0].length > 6 ? 30 : 16 }; });
      XLSX.utils.book_append_sheet(wb, ws, String(sheet || 'Sheet1').slice(0, 30)); wb.Workbook = { Views: [{ RTL: true }] };
      XLSX.writeFile(wb, name + '.xlsx');
    } else {
      var csv = '\ufeff' + aoa.map(function (r) { return r.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = name + '.csv'; a.click();
    }
  }
  var strip = function (v) { if (v && v.h != null) { var d = document.createElement('div'); d.innerHTML = v.h; return d.textContent; } return v == null ? '' : v; };
  function exportXlsx() {
    if (!REP) return alert('لا يوجد تقرير لتصديره.');
    var aoa = [[DB.settings.company], [REP.title], [REP.sub || ''], REP.head];
    REP.rows.forEach(function (r) { if (r && r.sep != null) aoa.push([String(r.sep).replace(/[\u2066\u2069]/g, '')]); else aoa.push((r.cells || r).map(strip)); });
    dl(aoa, REP.title.replace(/[\\/:*?"<>|]/g, ' ').slice(0, 60) + '_' + today(), REP.title);
  }
  function repHtml() { return '<h2 style="text-align:center;margin:0">' + E(DB.settings.company) + '</h2><h3 style="text-align:center;margin:4px 0">' + E(REP.title) + '</h3><p style="text-align:center;margin:0 0 10px">' + E(REP.sub || '') + '</p>' + grid(REP.head, REP.rows); }
  function printHtml(html) { var p = $('#pmPrint'); p.innerHTML = html; setTimeout(function () { window.print(); }, 60); }

  /* العرض والتحكم */
  function renderPage() {
    if (!root || !coreOK()) return;
    RECON.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
    renderSheetBar();
    var f = PAGES[state.page] || pDash; REP = null;
    $('#pmBody').innerHTML = f();
    var bar = $('#pmBar'); if (bar) { try { bar.innerHTML = BAR ? BAR() : ''; } catch (e) { console.error(e); } }
    $('#pmTitle').textContent = TITLES[state.page] || '';
    var tag = $('#pmSheetTag'); if (tag) tag.textContent = '📑 ' + sheetName();
    var jt = $('#pmJrnTag'); if (jt) jt.textContent = journalNow() === 'pro' ? '📒 دفتر مهني' : '🎓 أكاديمي';
    $$('.pm-nav', root).forEach(function (b) { b.classList.toggle('act', b.dataset.go === state.page); });
    $('#pmSide').classList.remove('open');
    try { var p = getProfile(); $('#pmWho').textContent = p ? (p.role === 'teacher' ? '👨‍🏫 معلم' : '👤 ' + (p.name || '')) : ''; } catch (e) { }
    if (state.page === 'sale' || state.page === 'purchase') previewInv();
    /* خطاف خارجي (تمارين/امتحان) يتظبط مع كل إعادة رسم بدون تعديل النواة */
    try { if (typeof window.__PMX_RENDER === 'function') window.__PMX_RENDER(); } catch (e) { }
  }
  function afterChange() {
    busy = true; try { if (typeof refreshSelects === 'function') refreshSelects(); } catch (e) { } try { if (typeof renderAll === 'function') renderAll(); } catch (e) { } busy = false;
    renderPage();
  }
  function setMode(on) {
    if (on && !allowed()) return;
    buildShell(); active = !!on; root.classList.toggle('on', active); document.body.classList.toggle('pm-active', active);
    try { localStorage.setItem('pro_on', active ? '1' : '0'); } catch (e) { }
    if (active) { loadDB(); renderPage(); window.scrollTo(0, 0); }
    syncBtn();
  }
  function allowed() {
    try { var p = getProfile(); if (!p) return false; if (p.role === 'teacher') return !!CFG.teacherAlways; return CFG.allowedYears.indexOf(+p.year) >= 0; } catch (e) { return false; }
  }
  function syncBtn() {
    var ok = allowed(), b = $('#pmToggle');
    if (!b) {
      var host = $('header.no-print .flex.flex-wrap.items-center.gap-2') || $('header');
      b = document.createElement('button'); b.id = 'pmToggle'; b.type = 'button'; b.textContent = '🏢 مود الاحتراف / الواقعية'; b.title = 'تحويل المنصة إلى نظام ERP احترافي';
      b.addEventListener('click', function () { setMode(true); });
      if (host) host.insertBefore(b, host.firstChild); else { b.style.cssText += ';position:fixed;top:10px;left:10px;z-index:100'; document.body.appendChild(b); }
    }
    b.style.display = ok ? '' : 'none';
    if (active && !ok) setMode(false);
  }
  function init() {
    if (!coreOK()) { console.warn('[pro-mode] لم يتم العثور على نواة المنصة؛ تأكد أن السطر موجود بعد سكريبت النواة.'); return; }
    loadDB();
    /* ربط خفيف بالنواة بدون تعديلها: تحديث الزر عند تسجيل الدخول، وإعادة رسم الصفحة عند تغيّر القيود */
    ['renderProfile', 'renderAll'].forEach(function (fn) {
      var orig = window[fn]; if (typeof orig !== 'function') return;
      window[fn] = function () { var r = orig.apply(this, arguments); try { if (fn === 'renderProfile') syncBtn(); else if (active && !busy) renderPage(); } catch (e) { } return r; };
    });
    syncBtn(); setInterval(syncBtn, 2000);
    try { if (localStorage.getItem('pro_on') === '1' && allowed()) setMode(true); } catch (e) { }
  }
  var api = {
    E: E, N: N, R2: R2, pad: pad, today: today, uid: uid, $: $, $$: $$, S: S, MONTHS: MONTHS, TN: TN_, DB: DB, saveDB: saveDB,
    get state() { return state; }, grid: grid, setRep: setRep, filterBar: filterBar, readF: readF, periodTxt: periodTxt, toast: toast, accOptions: accOptions,
    ensureAcc: ensureAcc, subAcc: subAcc, postEntry: postEntry, removeEntry: removeEntry, removeEntryAny: removeEntryAny,
    demoEntries: demoEntriesAll, clearDemoKey: clearDemoKey, clearAllDemo: clearAllDemo,
    afterChange: afterChange, renderPage: function () { renderPage(); },
    go: function (p) { state.page = p; if (active) renderPage(); },
    isCash: isCash, typeOf: typeOf, codeOf: codeOf, allLines: allLines, trialData: trialData, monthlyPL: monthlyPL, lastYear: lastYear, statements: statements, guessType: guessType,
    printHtml: printHtml, exportXlsx: exportXlsx, dl: dl, vatData: vatData, cmpDN: cmpDN, inR: inR,
    entries: function () { return jEntries(); }, accounts: function () { return accounts; },
    journal: journalNow, proEntries: proList, allEntries: jAll, sheet: sheetName,
    addInvoice: addInvoice, addVoucher: addVoucher, addAssetRec: addAssetRec, postDepFor: postDepFor, settleVatAt: postVatSettlement,
    depSchedule: depSchedule,
    bal: function (a) { var s = 0; allLines().forEach(function (l) { if (l.a === a) s += l.d - l.c; }); return R2(s); },
    syncKey: function (k) { try { if (typeof SYNC_KEYS !== 'undefined' && Array.isArray(SYNC_KEYS) && SYNC_KEYS.indexOf(k) < 0) SYNC_KEYS.push(k); } catch (e) { } },
    setBar: function (fn) { BAR = fn; },
    scope: scopeNow, scoped: scoped,
  };
  window.ProMode = { api: api, register: register, open: function () { setMode(true); }, close: function () { setMode(false); }, go: function (p) { state.page = p; if (active) renderPage(); }, version: '2.0',
    _t: { trialData: trialData, ledgerData: ledgerData, monthlyPL: monthlyPL, depSchedule: depSchedule, vatData: vatData, runAudit: runAudit, guessType: guessType, statements: statements, parseTB: parseTB, postEntry: postEntry, subAcc: subAcc } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
