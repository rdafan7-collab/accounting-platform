/* ============================================================================
   EDU_Acc — smart-parser.js  (المحرك الذكي V4 — قارئ ديناميكي للمكتبة)
   ----------------------------------------------------------------------------
   فكرة العمل:
   - هذا الملف لا يحتوي أي قالب محاسبي مكتوب يدويًا (No Hardcoded Rules).
   - يقرأ الكيانات (ENT) وقاموس الحسابات (ACCT) والقوالب (T) من window.ACC_KB
     التي تُحمَّل قبله من ملف accounting-kb.js.
   - خطوات التحليل:
       1) تطبيع النص العربي (إزالة التشكيل وتوحيد الحروف والأرقام).
       2) استخراج كل الأرقام مع وحدتها (نسبة / سنوات / أشهر / أيام / ساعات / كمية).
       3) اختيار القالب المناسب من المكتبة حسب كلمات الشرط والاستبعاد والأولوية.
       4) ربط كل رقم بالدور المناسب (roles) اعتمادًا على الكلمات التي قبله أو بعده.
       5) حل المعادلات (a=b+c) عكسيًا عند نقص أحد المتغيرات.
       6) بناء سطور القيد من القالب، ثم التحقق من التوازن قبل العرض.
   ============================================================================ */
(function (root) {
'use strict';

/* ============================================================================
   ٠) أدوات عامة
   ============================================================================ */

// كائن المكتبة يُقرأ وقت التنفيذ حتى لا يحدث تعارض في ترتيب تحميل السكربتات
function kb() { return root.ACC_KB || null; }

var PREPARED = null; // نسخة القوالب بعد تطبيع أنماطها النصية

// تطبيع النص العربي: إزالة التشكيل والتطويل وتوحيد (أ/إ/آ) و(ى/ي) و(ة/ه) و(ؤ/و) و(ئ/ي)
function normalize(value) {
  var t = String(value == null ? '' : value);
  t = t.replace(/[\u064B-\u0652\u0670\u0640]/g, '');      // تشكيل + تطويل
  t = t.replace(/[أإآٱ]/g, 'ا')
       .replace(/ى/g, 'ي')
       .replace(/ة/g, 'ه')
       .replace(/ؤ/g, 'و')
       .replace(/ئ/g, 'ي');
  t = t.replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); }); // أرقام عربية
  t = t.replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); }); // أرقام فارسية
  t = t.replace(/[٪]/g, '%');
  t = t.replace(/[ \t\r\n]+/g, ' ');
  return t.trim().toLowerCase();
}

// حروف الجر والوصل التي يجوز أن تسبق الكلمة العربية داخل النص
// الهدف: منع مطابقة "باع" داخل "المباعة" أو "عماله" داخل "استعماله"
var OK_PREFIX_END = { 'و': 1, 'ف': 1, 'ب': 1, 'ل': 1, 'ك': 1 };

function boundaryOk(text, start) {
  if (start <= 0) return true;
  var ch = text.charAt(start - 1);
  if (!/[\u0621-\u064A]/.test(ch)) return true; // مسافة أو رقم أو ترقيم
  return !!OK_PREFIX_END[ch];
}

// كل مواضع النمط الصحيحة داخل النص (مع احترام حدود الكلمة العربية)
function matchRanges(text, pattern) {
  var out = [], re;
  if (!pattern) return out;
  try { re = new RegExp('(?:' + pattern + ')', 'g'); } catch (e) { return out; }
  var m;
  while ((m = re.exec(text))) {
    if (!m[0].length) { re.lastIndex++; continue; }
    if (boundaryOk(text, m.index)) out.push({ start: m.index, end: re.lastIndex });
  }
  return out;
}

// اختبار نمط من أنماط المكتبة (كل نمط عبارة عن بدائل مفصولة بـ |)
function testAlt(text, pattern) {
  return matchRanges(text, pattern).length > 0;
}

// تطبيع نمط نصي داخل القالب (الحروف فقط، مع الحفاظ على رموز التعبير النمطي)
function normPat(p) { return typeof p === 'string' ? normalize(p) : p; }

// تجهيز القوالب مرة واحدة: تطبيع كل أنماط المطابقة والاستبعاد والأدوار
function templates() {
  if (PREPARED) return PREPARED;
  var lib = kb();
  if (!lib || !lib.T || !lib.T.length) return [];
  PREPARED = lib.T.map(function (src) {
    var t = {};
    for (var k in src) t[k] = src[k];
    if (src.k) t.k = src.k.map(normPat);
    if (src.x) t.x = src.x.map(normPat);
    if (src.o) t.o = src.o.map(function (p) { return [normPat(p[0]), p[1]]; });
    if (src.r) {
      t.r = {};
      for (var rk in src.r) {
        var r = src.r[rk], rr = {};
        for (var pk in r) rr[pk] = (pk === 'h' || pk === 'a') ? normPat(r[pk]) : r[pk];
        t.r[rk] = rr;
      }
    }
    if (src.flags) {
      t.flags = {};
      for (var fk in src.flags) t.flags[fk] = normPat(src.flags[fk]);
    }
    return t;
  });
  return PREPARED;
}

// تنسيق الأرقام بشكل عربي مقروء
function fmt(n) {
  if (n == null || isNaN(n)) return '—';
  try {
    return Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 });
  } catch (e) {
    return String(Math.round(Number(n) * 100) / 100);
  }
}

function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
function clone(o) { var c = {}; for (var k in o) c[k] = o[k]; return c; }

// الهروب من HTML قبل العرض في الواجهة
function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ============================================================================
   ١) الكيانات (ENT) من المكتبة: أصل / مصروف / إيراد / مركز خدمة
   ============================================================================ */

// البحث عن أول كيان مطابق وإرجاع الحساب المقابل له
function findEnt(text, kind) {
  var lib = kb();
  var rows = (lib && lib.ENT && lib.ENT[kind]) || [];
  for (var i = 0; i < rows.length; i++) {
    if (testAlt(text, normPat(rows[i][0]))) return { acc: rows[i][1], pat: rows[i][0] };
  }
  return null;
}

// هل النص يذكر أصلًا ثابتًا؟ نعتمد تصنيف المكتبة: أصل (A) ومجموعته 12.
/* الأصول المتداولة (نقدية/بنك/بضاعة/عملاء/أوراق قبض) موجودة في ENT.asset
   أيضًا، لكنها لا تصلح لتشغيل قوالب «الأصول الثابتة»، فنفحص المجموعة. */
function isFixedAssetAcc(acc) {
  var lib = kb();
  var e = lib && lib.ACCT && lib.ACCT[acc];
  return !!(e && e.k === 'A' && e.g === '12');
}

function hasFixedAsset(text) {
  return entMatches(text, 'asset').some(function (m) { return isFixedAssetAcc(m.acc); });
}

// كل حالات الكيان داخل النص مع مواضعها (تُستخدم للقيود المركّبة مثل المصروفات المتعددة)
// نستخدم matchRanges حتى لا يُطابق "عماله" داخل كلمة مثل "استعماله"
function entMatches(text, kind) {
  var lib = kb();
  var rows = (lib && lib.ENT && lib.ENT[kind]) || [];
  var out = [];
  rows.forEach(function (row) {
    matchRanges(text, normPat(row[0])).forEach(function (r) {
      out.push({ acc: row[1], start: r.start, end: r.end });
    });
  });
  return out;
}

/* ============================================================================
   ٢) استخراج الأرقام مع وحداتها
   ============================================================================ */

// حجب التواريخ حتى لا تُقرأ كأرقام مبالغ (مثال: 2025/01/15)
function maskDates(t) {
  return t.replace(/\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4}/g, function (m) {
    return new Array(m.length + 1).join(' ');
  });
}

// تحديد وحدة الرقم من الكلمات التي بعده أو قبله
function unitOf(t, start, end) {
  var after = t.slice(end, Math.min(t.length, end + 18));
  var before = t.slice(Math.max(0, start - 16), start);
  if (/^\s*(?:%|بالميه|في الميه|نسبه مئويه)/.test(after) ||
      /(?:نسبه|بمعدل|معدل|بنسبه)\s*$/.test(before)) return 'pct';
  if (/^\s*(?:ساعه|ساعات|ساعة)/.test(after) || /(?:لمده|مدة)\s*$/.test(before) && /ساع/.test(after)) return 'hours';
  if (/^\s*(?:يوم|ايام|أيام)/.test(after)) return 'days';
  if (/^\s*(?:شهر|اشهر|أشهر|شهور)/.test(after)) return 'months';
  if (/^\s*(?:سنه|سنوات|سنين|عام|اعوام|أعوام)/.test(after)) return 'years';
  if (/^\s*(?:وحده|وحدات|قطعه|قطع|كرتونه|كيلو|طن|لتر|متر|عدد|عبوه|علبه|سهم|اسهم|شيك|شيكات)/.test(after)) return 'qty';
  return '';
}

// استخراج الأرقام: القيمة + موضع البداية والنهاية + الوحدة
function extractNumbers(text) {
  var t = normalize(text);
  var masked = maskDates(t);
  var re = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;
  var out = [], m;
  while ((m = re.exec(masked))) {
    var start = m.index, end = re.lastIndex;
    var val = parseFloat(m[0].replace(/,/g, ''));
    if (isNaN(val)) continue;
    // دعم الألف والمليون: "100 ألف"
    var tail = t.slice(end, end + 12);
    if (/^\s*(?:الف|الاف|آلاف)/.test(tail)) val *= 1000;
    else if (/^\s*(?:مليون|ملايين)/.test(tail)) val *= 1000000;
    out.push({ value: val, start: start, end: end, raw: m[0], unit: unitOf(t, start, end) });
  }
  return out;
}

// تقييم مدى توافق وحدة الرقم مع نوع الدور (نسبة/سنوات/كمية...)
function unitScore(type, unit) {
  if (!type) { // دور مبلغ نقدي
    if (unit === 'pct') return -120;
    if (unit === 'years' || unit === 'months' || unit === 'days' || unit === 'hours') return -60;
    if (unit === 'qty') return -30;
    return 0;
  }
  if (type === 'pct') return unit === 'pct' ? 60 : -90;
  if (type === 'years') return unit === 'years' ? 60 : -90;
  if (type === 'months') return unit === 'months' ? 60 : -90;
  if (type === 'days') return unit === 'days' ? 60 : -70;
  if (type === 'hours') return unit === 'hours' ? 60 : -70;
  if (type === 'qty') return unit === 'qty' ? 60 : -40;
  if (type === 'rate') return unit ? -20 : 0;
  return 0;
}

/* ============================================================================
   ٣) تقييم التعبيرات الرياضية الموجودة في القوالب
   ============================================================================ */

var FN_NAMES = { max: 1, min: 1, abs: 1, round: 1, floor: 1, ceil: 1, sqrt: 1 };

function idsOf(expr) {
  var out = [], m, re = /[A-Za-z_][A-Za-z0-9_]*/g;
  while ((m = re.exec(String(expr)))) {
    if (!FN_NAMES[m[0]]) out.push(m[0]);
  }
  return out;
}

// مقيّم تعبير حسابي بسيط يدعم + - * / والأقواس ودوال max/min/abs/round/floor/ceil/sqrt
// overrideKey/overrideVal يُستخدمان لمعرفة معامل المتغير المجهول عند الحل العكسي
function evalExpr(expr, vars, overrideKey, overrideVal) {
  var s = String(expr == null ? '' : expr).replace(/\s+/g, '');
  var i = 0;
  if (!s) return NaN;

  function parseE() {
    var v = parseT();
    while (i < s.length && (s[i] === '+' || s[i] === '-')) {
      var op = s[i++], r = parseT();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  function parseT() {
    var v = parseF();
    while (i < s.length && (s[i] === '*' || s[i] === '/')) {
      var op = s[i++], r = parseF();
      v = op === '*' ? v * r : (r === 0 ? NaN : v / r);
    }
    return v;
  }
  function parseF() {
    if (s[i] === '-') { i++; return -parseF(); }
    if (s[i] === '+') { i++; return parseF(); }
    if (s[i] === '(') {
      i++; var v = parseE();
      if (s[i] === ')') i++;
      return v;
    }
    if (/[0-9.]/.test(s[i])) {
      var st = i;
      while (i < s.length && /[0-9.]/.test(s[i])) i++;
      return parseFloat(s.slice(st, i));
    }
    if (/[A-Za-z_]/.test(s[i])) {
      var st2 = i;
      while (i < s.length && /[A-Za-z0-9_]/.test(s[i])) i++;
      var name = s.slice(st2, i);
      if (s[i] === '(') {
        i++;
        var a1 = parseE(), a2 = null;
        if (s[i] === ',') { i++; a2 = parseE(); }
        if (s[i] === ')') i++;
        switch (name) {
          case 'max': return Math.max(a1, a2 == null ? a1 : a2);
          case 'min': return Math.min(a1, a2 == null ? a1 : a2);
          case 'abs': return Math.abs(a1);
          case 'round': return Math.round(a1);
          case 'floor': return Math.floor(a1);
          case 'ceil': return Math.ceil(a1);
          case 'sqrt': return Math.sqrt(a1);
          default: return NaN;
        }
      }
      if (overrideKey && name === overrideKey) return overrideVal;
      var val = vars ? vars[name] : undefined;
      return (val === undefined || val === null || isNaN(val)) ? NaN : Number(val);
    }
    return NaN;
  }

  var result = parseE();
  if (i < s.length) return NaN; // بقايا غير مفهومة في التعبير
  return result;
}

// أول متغير مجهول داخل تعبير
function firstUnknown(expr, vars) {
  var ids = idsOf(expr);
  for (var i = 0; i < ids.length; i++) {
    var v = vars[ids[i]];
    if (v === undefined || v === null || isNaN(v)) return ids[i];
  }
  return null;
}

// حل معادلة واحدة:
//   name:=expr  → تعريف باتجاه واحد
//   a=b+c       → حل عكسي لأحد المتغيرات المجهولة (لأن المعادلة خطية)
function solveEq(eq, vars) {
  eq = String(eq).trim();
  var def = eq.indexOf(':=');
  if (def >= 0) {
    var name = eq.slice(0, def).trim();
    var val = evalExpr(eq.slice(def + 2), vars);
    if (isNaN(val) || !isFinite(val)) return false;
    if (vars[name] !== undefined && Math.abs(vars[name] - val) < 0.005) return false;
    vars[name] = round2(val);
    return true;
  }
  var parts = eq.split('=');
  if (parts.length !== 2) return false;
  var lhs = parts[0].trim(), rhs = parts[1].trim();
  var lv = evalExpr(lhs, vars), rv = evalExpr(rhs, vars);
  if (!isNaN(lv) && !isNaN(rv)) return false; // الطرفان معروفان، لا شيء نحله

  var unknown = firstUnknown(lhs, vars) || firstUnknown(rhs, vars);
  if (!unknown) return false;

  // f(u) = f(0) + u * (f(1) - f(0)) لأن التعبيرات خطية في المتغير
  var l0 = evalExpr(lhs, vars, unknown, 0), l1 = evalExpr(lhs, vars, unknown, 1);
  var r0 = evalExpr(rhs, vars, unknown, 0), r1 = evalExpr(rhs, vars, unknown, 1);
  if (isNaN(l0) || isNaN(l1) || isNaN(r0) || isNaN(r1)) return false;

  var k = (l1 - l0) - (r1 - r0);
  if (Math.abs(k) < 1e-9) return false;
  var u = (r0 - l0) / k;
  if (!isFinite(u)) return false;
  vars[unknown] = round2(u);
  return true;
}

// تشغيل كل معادلات القالب عدة مرات حتى تستقر القيم
function applyEquations(tpl, vars) {
  var eqs = tpl.e || [];
  for (var pass = 0; pass < 8; pass++) {
    var changed = false;
    for (var i = 0; i < eqs.length; i++) {
      if (solveEq(eqs[i], vars)) changed = true;
    }
    if (!changed) break;
  }
}

/* ============================================================================
   ٤) ربط الأرقام بأدوار القالب (roles)
   ============================================================================ */

// أقرب كلمة مطابقة للنمط قبل موضع معين (نرجع المسافة بعد نهاية الكلمة)
// نعتمد على matchRanges حتى نحترم حدود الكلمات العربية
function distBefore(text, pattern, idx) {
  var rs = matchRanges(text, pattern);
  var bestEnd = -1;
  for (var i = 0; i < rs.length; i++) {
    var end = rs[i].end;
    if (end <= idx && end > bestEnd) bestEnd = end;
    if (rs[i].start > idx) break;
  }
  return bestEnd < 0 ? -1 : idx - bestEnd;
}

// أقرب كلمة مطابقة للنمط بعد موضع معين
function distAfter(text, pattern, idx) {
  var rs = matchRanges(text, pattern);
  for (var i = 0; i < rs.length; i++) {
    if (rs[i].start >= idx) return rs[i].start - idx;
  }
  return -1;
}

// مضاعف ترجيح بسيط لبعض الأدوار حتى لا تُسرق أرقامها بواسطة دور عام
function keyBonus(key) {
  if (key === 'pr') return 14;
  if (key === 'rate') return 14;
  if (key === 'rt') return 10;
  if (key === 'fp') return 10;
  if (key === 'p' || key === 'd') return 4;
  return 0;
}

function scoreRole(role, text, num, key) {
  if (!role) return 0;
  var base = 0;
  if (role.h) {
    var d = distBefore(text, role.h, num.start);
    if (d >= 0) base += Math.max(12, 48 - d * 0.6);
  }
  if (role.a) {
    var d2 = distAfter(text, role.a, num.end);
    if (d2 >= 0) base += Math.max(10, 42 - d2 * 0.6);
  }
  base += unitScore(role.t, num.unit);
  if (base <= 0) return base;
  return base + keyBonus(key);
}

// التوزيع الجشع: نأخذ أقوى الأزواج (دور + رقم) أولًا
function assignRoles(text, nums, roles) {
  var keys = Object.keys(roles);
  var pairs = [];
  keys.forEach(function (key) {
    nums.forEach(function (num, idx) {
      var sc = scoreRole(roles[key], text, num, key);
      if (sc > 8) pairs.push({ key: key, idx: idx, sc: sc });
    });
  });
  pairs.sort(function (a, b) {
    if (b.sc !== a.sc) return b.sc - a.sc;
    return keys.indexOf(a.key) - keys.indexOf(b.key);
  });
  var usedKey = {}, usedNum = {}, vars = {}, owner = {};
  pairs.forEach(function (p) {
    if (usedKey[p.key] || usedNum[p.idx]) return;
    usedKey[p.key] = 1;
    usedNum[p.idx] = 1;
    vars[p.key] = nums[p.idx].value;
    owner[p.idx] = p.key;
  });
  return { vars: vars, usedNum: usedNum, owner: owner };
}

// هل الرقم متوافق مع نوع الدور؟ (نسبة لا تُستخدم كمبلغ، وهكذا)
function compatible(role, num) {
  if (!role || !num) return false;
  if (role.t === 'pct') return num.unit === 'pct';
  if (num.unit === 'pct') return false;
  if (role.t && num.unit && role.t !== num.unit) return false;
  return true;
}

// أولوية تعبئة الأدوار الفارغة بالأرقام المتبقية
function fillPriority(key, roles, vars) {
  var r = roles[key] || {}, p = 0;
  if (r.t === 'pct') p += 40;
  if (key === 'pr' && vars.qty !== undefined) p += 35; // "10 أجهزة بسعر 5000" → 5000 سعر الوحدة
  if (key === 'rate') p += 30;
  if (!r.opt) p += 20;
  if (key === 't') p += 5;
  return p;
}

function permute(arr) {
  if (!arr.length) return [[]];
  var out = [];
  arr.forEach(function (item, idx) {
    var rest = arr.slice(0, idx).concat(arr.slice(idx + 1));
    permute(rest).forEach(function (p) { out.push([item].concat(p)); });
  });
  return out;
}

// توليد محاولات متعددة لتوزيع الأرقام المتبقية على الأدوار الفارغة
function buildAttempts(text, nums, roles, base) {
  var out = [clone(base.vars)];
  var leftovers = [], used = base.usedNum;
  nums.forEach(function (num, idx) {
    if (!used[idx]) leftovers.push({ idx: idx, value: num.value, unit: num.unit });
  });
  if (!leftovers.length) return out;

  var unfilled = Object.keys(roles).filter(function (k) {
    return base.vars[k] === undefined;
  });
  if (!unfilled.length) return out;

  unfilled.sort(function (a, b) {
    return fillPriority(b, roles, base.vars) - fillPriority(a, roles, base.vars);
  });

  // نستبعد الأدوار التي لا يقبل نوعها أي رقم متبقٍ (مثل دور نسبة مئوية بلا نسبة)
  // حتى لا تُستهلك الأرقام في دور غير مناسب ويُترك الدور الأساسي فارغًا
  var usable = unfilled.filter(function (key) {
    return leftovers.some(function (lf) { return compatible(roles[key], lf); });
  });
  if (!usable.length) return out;

  // لا حد أعلى لعدد الأدوار: نوزّع كل الأدوار القابلة للتعبئة على الأرقام المتبقية.
  // الحد الوحيد هنا هو «عدد ترتيبات» الأرقام لحماية سرعة المتصفح، وليس عدد السطور.
  var takeRoles = usable.slice(0, leftovers.length);
  var takeNums = leftovers.slice(0, takeRoles.length);
  var orders = takeNums.length <= 6 ? permute(takeNums) : rotateOrders(takeNums);

  orders.forEach(function (order) {
    var v = clone(base.vars), ok = true;
    takeRoles.forEach(function (key, i) {
      if (!compatible(roles[key], order[i])) { ok = false; }
      v[key] = order[i].value;
    });
    if (ok) out.push(v);
  });
  return out;
}

// بديل خفيف لتبديلات الأرقام الكثيرة: كل إزاحة دورية للقائمة
function rotateOrders(arr) {
  var out = [], n = arr.length;
  for (var r = 0; r < n; r++) out.push(arr.slice(r).concat(arr.slice(0, r)));
  return out;
}

/* ============================================================================
   ٥) الحسابات النقدية والوسيطة (نقدية / بنك / موردون / أوراق)
   ============================================================================ */

var BANK_WORDS = 'شيك|بالبنك|من البنك|في البنك|ف البنك|علي البنك|بنكي|تحويل|حواله|ايداع|ايدع|فيزا|كارد|محفظه|انستا|فودافون كاش|ماستر كارد';
var CREDIT_WORDS = 'علي الحساب|علي حساب|بالاجل|اجل|الاجل|الباقي|باقي|بقيه|المتبقي|علي المورد|علي العميل|علي النوته|علي الحساب';
var CASH_WORDS = 'نقدا|كاش|الخزينه|خزنه|صندوق';

function isBank(text) { return testAlt(text, BANK_WORDS); }
function isCredit(text) { return testAlt(text, CREDIT_WORDS); }
function isNoteOut(text) { return /ورقه دفع|اوراق دفع|سند اذني|سندات اذنيه|كمبياله دفع/.test(text); }
function isNoteIn(text) { return /ورقه قبض|اوراق قبض|سند قبض|كمبياله قبض/.test(text); }

// حساب النقدية/البنك الحر (لأطراف {cb})
function cashAccount(text) { return isBank(text) ? 'البنك' : 'النقدية'; }

/* ----------------------------------------------------------------------------
   ٢.١) محرك التسوية متعدد القنوات (Multi-Channel Settlement Engine)
   ----------------------------------------------------------------------------
   المشكلة: جملة مثل «دفعنا 10000 نقدًا و5000 بشيك والباقي على الحساب» فيها
   أكثر من قناة سداد. لو جمعناها في حساب واحد (البنك مثلًا) يظهر القيد متوازنًا
   لكنه محاسبيًا خطأ، لأن كل قناة لها حسابها المستقل.

   الحل: نمرّ على البيان كله ونربط كل قناة سداد بالمبلغ الملاصق لها:
     نقدًا / كاش / الخزينة            → حـ/ النقدية
     شيك / تحويل / فيزا / من البنك     → حـ/ البنك
     ورقة دفع / كمبيالة / شيك مؤجل     → حـ/ أوراق دفع   (التزام)
     ورقة قبض / كمبيالة قبض            → حـ/ أوراق قبض  (أصل)
   وما تبقّى من الإجمالي يُقيَّد على حساب الباقي: الموردون أو العملاء.
   ---------------------------------------------------------------------------- */
var PAY_VERB = 'دفع|دفعت|دفعنا|سدد|سددت|سددنا|حصل|حصلت|حصلنا|استلم|استلمت|استلمنا|قبض|قبضت|صرف|صرفت';

// صيغ الأوراق التجارية (قناة سداد رابعة غير النقدية والبنك)
var NOTE_OUT_WORDS = 'ورقه دفع|اوراق دفع|سند اذني|سندات اذنيه|كمبياله دفع|شيك مؤجل|شيك اجل';
var NOTE_IN_WORDS = 'ورقه قبض|اوراق قبض|سند قبض|كمبياله قبض|شيك مؤجل عند القبض';

// القالب يعلن صراحة أنه يقبل تفصيل قنوات السداد:
//   إمّا سطر قديم {cb} بمقدار p، أو سطر جديد {legs} يمثل مجموعة قنوات
function hasCbRow(tpl) {
  return (tpl.L || []).some(function (row) { return row[1] === '{cb}' && row[2] === 'p'; });
}
function hasLegsRow(tpl) {
  return (tpl.L || []).some(function (row) { return row[1] === '{legs}'; });
}
function canSplitPay(tpl) { return hasCbRow(tpl) || hasLegsRow(tpl); }

// اتجاه حركة القناة: out = نقود خارجة (شراء/سداد)، in = نقود داخلة (بيع/تحصيل)
function payDirOf(tpl) {
  var dir = 'out';
  (tpl.L || []).forEach(function (row) {
    if (row[1] === '{cb}' && row[2] === 'p') dir = row[0] === 'D' ? 'in' : 'out';
    else if (row[1] === '{legs}') dir = row[0] === 'D' ? 'in' : 'out';
  });
  return dir;
}

// اسم حساب الباقي حسب نص البيان (بورقة دفع؟ موردون؟ عملاء؟)
function restAccountOf(text, dir) {
  /* الأولوية للتصريح الصريح: «والباقي على الحساب/للمورد» يعني أن الباقي دين
     تجاري، حتى لو ذُكرت ورقة دفع لسداد جزء آخر — الورقة نفسها صارت سطرًا
     مستقلاً في {legs} ولا يصح تجميع الباقي عليها. */
  if (testAlt(text, 'علي الحساب|علي حساب|للمورد|للموردين|علي المورد|للعميل|علي العميل')) {
    return dir === 'in' ? 'العملاء' : 'الموردون';
  }
  if (testAlt(text, 'بورقه دفع|بكمبياله دفع|بسند اذني|بشيك مؤجل|بشيك اجل|اوراق دفع')) return 'أوراق دفع';
  if (testAlt(text, 'بورقه قبض|بكمبياله قبض|بسند قبض|اوراق قبض')) return 'أوراق قبض';
  return dir === 'in' ? 'العملاء' : 'الموردون';
}

// يرجّع مصفوفة قنوات مرتبة حسب موضعها في الجملة:
// [{acc:'النقدية', m:10000}, {acc:'البنك', m:5000}]
function settlementLegs(text, nums, total, dir) {
  if (!(total > 0) || !nums || nums.length < 3) return null;
  var t = normalize(text);
  var verbs = matchRanges(t, PAY_VERB);
  var from = verbs.length ? verbs[0].start : 0; // نتجاهل الإجمالي المذكور قبل فعل السداد

  var notePat = dir === 'in' ? NOTE_IN_WORDS : NOTE_OUT_WORDS;
  var noteRanges = matchRanges(t, notePat);

  // هل الموضع داخل عبارة ورقة تجارية؟ (حتى لا تُقرأ «شيك مؤجل» كشيك بنكي)
  function insideNote(pos) {
    for (var i = 0; i < noteRanges.length; i++) {
      if (pos >= noteRanges[i].start && pos < noteRanges[i].end) return true;
    }
    return false;
  }

  var marks = [];
  noteRanges.forEach(function (r) {
    marks.push({ start: r.start, end: r.end, acc: dir === 'in' ? 'أوراق قبض' : 'أوراق دفع' });
  });
  matchRanges(t, CASH_WORDS).forEach(function (r) {
    marks.push({ start: r.start, end: r.end, acc: 'النقدية' });
  });
  matchRanges(t, BANK_WORDS).forEach(function (r) {
    if (insideNote(r.start)) return;
    marks.push({ start: r.start, end: r.end, acc: 'البنك' });
  });
  marks.sort(function (a, b) { return a.start - b.start; });

  var used = {}, legs = [];
  marks.forEach(function (mk) {
    if (mk.start < from) return;
    // لا نمنع تكرار نفس القناة: «3000 بشيك و3000 بشيك» دفعتان منفصلتان على البنك.
    // عبارة «بشيك من البنك» لا تسبب تكرارًا لأن أول علامة تستهلك المبلغ،
    // والعلامة الثانية لا تجد مبلغًا غير مستخدم ملاصقًا لها.
    var bestIdx = -1, bestDist = 0;
    for (var i = 0; i < nums.length; i++) {
      var n = nums[i];
      if (used[i] || n.start < from) continue;
      if (n.value >= total) continue;                     // الإجمالي ليس قناة سداد
      if (n.unit === 'pct' || n.unit === 'years' || n.unit === 'months') continue;
      var d = mk.start - n.end;                            // المبلغ يجب أن يلاصق قناة السداد
      if (d < -6 || d > 28) continue;
      if (bestIdx < 0 || Math.abs(d) < Math.abs(bestDist)) { bestIdx = i; bestDist = d; }
    }
    if (bestIdx < 0) return;
    used[bestIdx] = 1;
    legs.push({ acc: mk.acc, m: round2(nums[bestIdx].value) });
  });

  return legs.length >= 2 ? legs : null;                   // قناة واحدة = لا حاجة للتقسيم
}

// احتياطي للقوالب القديمة: استبدال سطر الدفع الموحّد بأسطر القنوات بنفس الطرف
function splitPayLines(lines, ctx, paid) {
  var legs = ctx.legs, out = [], done = false;
  lines.forEach(function (l) {
    if (!done && l.acc === ctx.cb && Math.abs(l.m - paid) < 0.01) {
      legs.forEach(function (x) { out.push({ side: l.side, acc: x.acc, m: round2(x.m) }); });
      done = true;
    } else out.push(l);
  });
  return done ? out : null;
}

// حساب الطرف المقابل للدفع (خارج) أو التحصيل (داخل)
function payAccount(text, dir, tpl) {
  var dp = tpl && tpl.dp;
  var cashWord = testAlt(text, CASH_WORDS);
  if (dir === 'out') {
    if (dp === 'credit') return cashWord ? 'النقدية' : 'الموردون';
    if (dp === 'bank' || isBank(text)) return 'البنك';
    if (isNoteOut(text)) return 'أوراق دفع';
    if (isCredit(text)) return 'الموردون';
    return 'النقدية';
  }
  if (dp === 'credit') return cashWord ? 'النقدية' : 'العملاء';
  if (dp === 'bank' || isBank(text)) return 'البنك';
  if (isNoteIn(text)) return 'أوراق قبض';
  if (isCredit(text)) return 'العملاء';
  return 'النقدية';
}

// عبارة عربية تشرح طريقة السداد تظهر داخل ملخص القالب
function payPhrase(acc) {
  if (acc === 'البنك') return 'بشيك / من البنك';
  if (acc === 'النقدية') return 'نقدًا';
  if (acc === 'الموردون') return 'على الحساب (آجل)';
  if (acc === 'العملاء') return 'على الحساب (آجل)';
  if (acc === 'أوراق دفع') return 'بورقة دفع';
  if (acc === 'أوراق قبض') return 'بورقة قبض';
  return acc ? ('بـ' + acc) : 'نقدًا';
}

/* ============================================================================
   ٦) بناء سياق القالب: الأطراف + الأعلام
   ============================================================================ */

function flagsOf(text, tpl) {
  var flags = {};
  if (tpl && tpl.flags) {
    Object.keys(tpl.flags).forEach(function (k) {
      flags[k] = testAlt(text, tpl.flags[k]);
    });
  }
  return flags;
}

function buildCtx(text, tpl) {
  var ctx = {};
  var asset = findEnt(text, 'asset');
  var exp = findEnt(text, 'exp');
  var rev = findEnt(text, 'rev');
  var center = findEnt(text, 'center');

  ctx.cb = cashAccount(text);
  ctx.payOut = payAccount(text, 'out', tpl);
  ctx.payIn = payAccount(text, 'in', tpl);
  ctx.asset = asset ? asset.acc : null;
  ctx.exp = exp ? exp.acc : 'مصروفات عمومية وإدارية';
  ctx.rev = rev ? rev.acc : 'إيرادات متنوعة';
  ctx.center = center ? center.acc : null;
  ctx.fx = /بنك|مصرف|وديعه/.test(text) ? 'البنك' : 'العملاء';
  ctx.goods = /بضاعه|مخزون|بضاعة/.test(text);
  ctx.withdraw = /سحب|مسحوبات|شخصي|شخصيه|المالك|صاحب المنشاه/.test(text);
  ctx.flags = flagsOf(text, tpl);
  ctx.text = text;
  return ctx;
}

// تحويل رموز الحسابات في القالب مثل {cb} و{payOut} و{asset|بديل} إلى اسم حساب حقيقي
function resolveAccount(token, ctx) {
  if (!token) return null;
  var s = String(token).trim();
  var m = /^\{([^}]+)\}$/.exec(s);
  if (!m) return s;
  var parts = m[1].split('|');
  var key = parts[0].trim();
  var fallback = parts[1] ? parts[1].trim() : null;
  var val;
  if (key === 'cb') val = ctx.cb;
  else if (key === 'legs') val = ctx.legs;          // مجموعة قنوات السداد (تُفكّ في buildLines)
  else if (key === 'restAcc') val = ctx.restAcc;    // حساب الباقي: موردون/عملاء/أوراق
  else if (key === 'payOut') val = ctx.payOut;
  else if (key === 'payIn') val = ctx.payIn;
  else if (key === 'asset') val = ctx.asset;
  else if (key === 'exp') val = ctx.exp;
  else if (key === 'rev') val = ctx.rev;
  else if (key === 'center') val = ctx.center;
  else if (key === 'fx') val = ctx.fx;
  else val = ctx[key];
  return val || fallback;
}

/* ============================================================================
   ٧) شروط سطور القيد
   ============================================================================ */

function flagOrVar(key, vars, ctx) {
  if (key === 'goods') return !!ctx.goods;
  if (key === 'withdraw') return !!ctx.withdraw;
  if (ctx.flags && key in ctx.flags) return !!ctx.flags[key];
  var v = vars[key];
  return v !== undefined && !isNaN(v) && Math.abs(v) > 1e-9;
}

function condTrue(cond, vars, ctx) {
  cond = String(cond || '').trim();
  if (!cond) return true;
  if (cond.charAt(0) === '!') return !flagOrVar(cond.slice(1), vars, ctx);
  var m = /^([A-Za-z_][A-Za-z0-9_]*)\s*(>=|<=|==|>|<)\s*(-?\d+(?:\.\d+)?)$/.exec(cond);
  if (m) {
    var v = Number(vars[m[1]]);
    var x = Number(m[3]);
    if (isNaN(v)) return false;
    if (m[2] === '>') return v > x;
    if (m[2] === '<') return v < x;
    if (m[2] === '>=') return v >= x;
    if (m[2] === '<=') return v <= x;
    return Math.abs(v - x) < 0.005;
  }
  return flagOrVar(cond, vars, ctx);
}

/* ============================================================================
   ٨) بناء سطور القيد من القالب
   ============================================================================ */

/* ============================================================================
   ٨) بناء سطور القيد من القالب — مولّد N:M ديناميكي
   ============================================================================
   القالب في المكتبة عبارة عن «وصفة» من سطور ثابتة الشكل. لكي ندعم عددًا غير
   محدود من السطور (مدين N / دائن M) نسمح لسطر واحد أن يمثّل مجموعة كاملة:
       ['C', '{legs}', 'legs']
   فيتوسّع تلقائيًا إلى سطر مستقل لكل قناة سداد (نقدية، بنك، أوراق...).
   وبذلك لا يوجد أي حد أعلى لعدد السطور، سواء كانت 2 أو 3 أو 20 سطرًا.

   كما يدعم السطر قيمة خاصة اسمها plug:
       ['C', '{restAcc}', 'plug']
   أي «ضع هنا الفرق المتبقي لكي يتوازن القيد» — وهذا هو القابس المحاسبي
   الذي يضمن: مجموع المدين = مجموع الدائن دائمًا، حتى لو تغيّرت قنوات السداد.
   ============================================================================ */

// توسيع أي سطر حسابه اسم مجموعة داخل السياق، مثل {legs}
function expandRows(tpl, ctx) {
  var rows = [];
  (tpl.L || []).forEach(function (row) {
    var tok = row[1];
    var m = typeof tok === 'string' && /^\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(tok);
    var col = m ? ctx[m[1]] : null;
    if (col && col.length && typeof col[0] === 'object') {
      // سطر واحد ← عدة سطور، بعدد عناصر المجموعة بلا حد
      col.forEach(function (x) { rows.push([row[0], x.acc, String(x.m), row[3]]); });
    } else {
      rows.push(row);
    }
  });
  return rows;
}

function buildLines(tpl, vars, ctx) {
  var lines = [];
  var failed = false;
  var plugs = []; // سطور «الباقي» التي نحسب مبلغها في النهاية

  expandRows(tpl, ctx).forEach(function (row) {
    var side = row[0], accTok = row[1], expr = row[2], cond = row[3];
    if (expr === 'plug' || cond === 'plug') {
      var plugAcc = resolveAccount(accTok, ctx);
      if (!plugAcc) { failed = true; return; }
      plugs.push({ side: side, acc: plugAcc });
      return;
    }
    if (cond && !condTrue(cond, vars, ctx)) return;
    var acc = resolveAccount(accTok, ctx);
    if (!acc) { if (!cond) failed = true; return; }
    var val = evalExpr(expr, vars);
    if (isNaN(val) || !isFinite(val)) {
      if (!cond) failed = true; // سطر إلزامي بلا قيمة = فشل المحاولة
      return;
    }
    if (Math.abs(val) < 0.005) return;
    lines.push({ side: side, acc: acc, m: round2(Math.abs(val)) });
  });

  if (failed) return null;

  // قابس التوازن: نضع الفرق في سطر الباقي بدل تركه ناقصًا
  if (plugs.length) {
    if (plugs.length > 1) return null; // قابسان = غموض محاسبي، نرفض المحاولة
    var p = plugs[0];
    var diff = round2(sumSide(lines, 'D') - sumSide(lines, 'C'));
    var need = p.side === 'D' ? -diff : diff;
    if (need < -0.005) return null;    // قابس سالب مرفوض
    if (need > 0.005) lines.push({ side: p.side, acc: p.acc, m: round2(need) });
  }

  return lines;
}

// دمج السطور المتكررة على نفس الحساب في نفس الطرف
function mergeLines(lines) {
  var map = {}, order = [];
  lines.forEach(function (l) {
    var key = l.side + '|' + l.acc;
    if (map[key]) map[key].m = round2(map[key].m + l.m);
    else { map[key] = { side: l.side, acc: l.acc, m: l.m }; order.push(key); }
  });
  return order.map(function (k) { return map[k]; });
}

function sumSide(lines, side) {
  return round2(lines.filter(function (l) { return l.side === side; })
    .reduce(function (s, l) { return s + l.m; }, 0));
}

// التحقق من التوازن + تسوية فروق التقريب الصغيرة (أقل من قرشين)
function balanceLines(lines) {
  var d = sumSide(lines, 'D'), c = sumSide(lines, 'C');
  var diff = round2(d - c);
  if (Math.abs(diff) <= 0.02 && Math.abs(diff) > 0.0001) {
    var side = diff > 0 ? 'C' : 'D'; // نزيد الطرف الأقل
    var target = null;
    lines.forEach(function (l) { if (l.side === side && (!target || l.m > target.m)) target = l; });
    if (target) target.m = round2(target.m + Math.abs(diff));
    d = sumSide(lines, 'D'); c = sumSide(lines, 'C');
  }
  return Math.abs(d - c) <= 0.02 && d > 0;
}

/* ============================================================================
   ٩) تفسير القيد تعليميًا (لماذا مدين ولماذا دائن)
   ============================================================================ */

function accountKind(acc) {
  var lib = kb();
  var e = lib && lib.ACCT && lib.ACCT[acc];
  if (e && e.k) return e.k;
  if (/^مصروف|^خسائر|^تكاليف|^عجز|^خصم مسموح|^مردودات المبيعات/.test(acc)) return 'X';
  if (/^إيراد|^ايراد|^فوائد دائنة|^أرباح|^ارباح|^خصم مكتسب|^زيادة الخزينة|^ديون معدومة محصلة/.test(acc)) return 'R';
  if (/رأس المال|رأس مال|احتياطي|أرباح محتجزة|جاري الشريك/.test(acc)) return 'E';
  if (/مورد|دائن|قروض|مستحق|مقدمة من عملاء|أوراق دفع/.test(acc)) return 'L';
  return 'A';
}

var KIND_LABEL = { A: 'أصل', L: 'التزام', E: 'حقوق ملكية', R: 'إيراد', X: 'مصروف', CA: 'حساب مقابل للأصل', CR: 'حساب مقابل للإيراد', CX: 'حساب مقابل للمصروف', CE: 'مسحوبات' };
var KIND_RULE = {
  A: 'الأصول تزيد بالمدين وتنقص بالدائن',
  L: 'الالتزامات تزيد بالدائن وتنقص بالمدين',
  E: 'حقوق الملكية تزيد بالدائن وتنقص بالمدين',
  R: 'الإيرادات تزيد بالدائن وتنقص بالمدين',
  X: 'المصروفات تزيد بالمدين وتنقص بالدائن',
  CA: 'حساب مقابل للأصل طبيعته دائنة فيزيد بالدائن',
  CR: 'حساب مقابل للإيراد طبيعته مدينة فيزيد بالمدين',
  CX: 'حساب مقابل للمصروف طبيعته دائنة فيزيد بالدائن',
  CE: 'حساب مسحوبات مقابل لرأس المال طبيعته مدينة'
};

function kindReason(acc) {
  var k = accountKind(acc);
  return (KIND_LABEL[k] || 'حساب') + ' — ' + (KIND_RULE[k] || '');
}

function accountNote(acc) {
  var lib = kb();
  var e = lib && lib.ACCT && lib.ACCT[acc];
  return e && e.n ? e.n : '';
}

/* ============================================================================
   ١٠) الملخص النصي والملاحظات
   ============================================================================ */

function buildTexts(vars, ctx, tpl) {
  var tx = {};
  tx.cbTxt = ctx.cb === 'البنك' ? 'بالبنك' : 'نقدًا';
  if (ctx.legs && ctx.legs.length > 1) {
    // بيان متعدد القنوات: نوضح كل قناة بمبلغها في الملخص
    tx.cbTxt = ctx.legs.map(function (l) {
      return fmt(l.m) + (l.acc === 'البنك' ? ' بشيك' : l.acc === 'النقدية' ? ' نقدًا' : ' بـ' + l.acc);
    }).join(' + ');
  }
  tx.payTxt = payPhrase(ctx.payOut);
  tx.payInTxt = payPhrase(ctx.payIn);
  tx.goodsTxt = ctx.goods ? 'من البضاعة' : '';
  if (vars.prem > 0) tx.premTxt = ' بعلاوة إصدار ' + fmt(vars.prem);
  else tx.premTxt = '';
  if (vars.cost !== undefined && vars.life !== undefined) {
    tx.depBasis = 'على أساس تكلفة ' + fmt(vars.cost) + ' وعمر إنتاجي ' + fmt(vars.life) + ' سنة';
  } else tx.depBasis = '';
  tx.resTxt = ctx.flags && ctx.flags.loss ? 'الخسارة' : 'الربح';
  tx.ltTxt = (ctx.flags && ctx.flags.lt) ? ' طويل الأجل' : '';
  tx.insTxt = (ctx.flags && ctx.flags.ins) ? 'التأمينات الاجتماعية' : 'ضريبة كسب العمل';
  if (vars.net !== undefined) {
    tx.netTxt = vars.net >= 0 ? ('المستحق للمصلحة ' + fmt(vars.net)) : ('القابل للاسترداد ' + fmt(-vars.net));
  } else tx.netTxt = '';
  if (vars.diff !== undefined) {
    tx.diffTxt = vars.diff >= 0 ? ('التحميل ناقص ' + fmt(vars.diff)) : ('التحميل زائد ' + fmt(-vars.diff));
  } else tx.diffTxt = '';
  tx.empTxt = (ctx.flags && ctx.flags.emp) ? ' وحُمِّل على أمين الخزينة' : '';
  tx.provTxt = vars.prov > 0 ? (' مع استنفاد مخصص ' + fmt(vars.prov)) : '';
  return tx;
}

function interpolate(str, vars, ctx, texts) {
  return String(str == null ? '' : str).replace(/\$\{([^}]+)\}/g, function (_, raw) {
    var key = raw.trim();
    if (texts && texts[key] !== undefined) return texts[key];
    if (ctx && ctx[key] !== undefined && typeof ctx[key] !== 'object') return String(ctx[key]);
    if (vars && vars[key] !== undefined && !isNaN(vars[key])) return fmt(vars[key]);
    var v = evalExpr(key, vars || {});
    return (isNaN(v) || !isFinite(v)) ? '' : fmt(v);
  });
}

function makeNotes(debits, credits, tpl, vars, ctx, texts) {
  var notes = [];
  notes.push('القالب المستخدم: ' + tpl.t + ' — القطاع: ' + tpl.c + ' (' + tpl.id + ')');
  debits.forEach(function (l) {
    notes.push('مدين: حـ/ ' + l.a + ' بمبلغ ' + fmt(l.m) + ' — ' + kindReason(l.a) + '.');
  });
  credits.forEach(function (l) {
    notes.push('دائن: حـ/ ' + l.a + ' بمبلغ ' + fmt(l.m) + ' — ' + kindReason(l.a) + '.');
  });
  var d = debits.reduce(function (s, x) { return s + x.m; }, 0);
  notes.push('مجموع المدين = مجموع الدائن = ' + fmt(d) + '، أي أن القيد متوازن.');
  var mentioned = {};
  debits.concat(credits).forEach(function (l) {
    if (mentioned[l.a]) return;
    mentioned[l.a] = 1;
    var n = accountNote(l.a);
    if (n) notes.push('ملاحظة على حـ/ ' + l.a + ': ' + n);
  });
  (tpl.tips || []).forEach(function (tip) {
    notes.push(interpolate(tip, vars, ctx, texts));
  });
  return notes;
}

/* ============================================================================
   ١١) إنهاء النتيجة
   ============================================================================ */

function finalize(tpl, vars, ctx, lines, summaryOverride) {
  var debits = lines.filter(function (l) { return l.side === 'D'; })
    .map(function (l) { return { a: l.acc, m: l.m }; });
  var credits = lines.filter(function (l) { return l.side === 'C'; })
    .map(function (l) { return { a: l.acc, m: l.m }; });
  var texts = buildTexts(vars, ctx, tpl);
  var summary = summaryOverride || interpolate(tpl.s || tpl.t, vars, ctx, texts);
  var notes = makeNotes(debits, credits, tpl, vars, ctx, texts);
  return { debits: debits, credits: credits, notes: notes, summary: summary, template: tpl, vars: vars, ctx: ctx };
}

// هل اكتملت المتغيرات المطلوبة للقالب؟
function requirementsMet(tpl, vars) {
  if (tpl.need) {
    for (var i = 0; i < tpl.need.length; i++) {
      var v = vars[tpl.need[i]];
      if (v === undefined || isNaN(v)) return false;
    }
  }
  var roles = tpl.r || {};
  var keys = Object.keys(roles);
  for (var j = 0; j < keys.length; j++) {
    var r = roles[keys[j]];
    if (!r.opt && r.def === undefined && !r.d0) {
      var val = vars[keys[j]];
      if (val === undefined || isNaN(val)) return false;
    }
  }
  return true;
}

/* ============================================================================
   ١٢) حل قالب عادي (سطور مباشرة من المكتبة)
   ============================================================================ */

function resolveTemplate(text, tpl) {
  var nums = extractNumbers(text);
  if (!nums.length) return null;
  var roles = tpl.r || {};
  var base = assignRoles(text, nums, roles);

  /* احتياطي الإجمالي:
     جمل مثل «شراء بضاعة بـ 20000 بشيك 12000 والباقي…» لا تحمل كلمة إجمالي
     صريحة («بقيمة/بمبلغ»)، فيظل دور t فارغًا وتفشل كل المحاولات.
     القاعدة المحاسبية هنا: أكبر مبلغ مذكور في العملية هو الإجمالي.
     لا نطبّق القاعدة إذا كان القالب يحسب t بمعادلة (مثل t=qty*pr). */
  var tByEq = (tpl.e || []).some(function (eq) { return /^\s*t\s*=/.test(eq); });
  if (roles.t && base.vars.t === undefined && !tByEq) {
    var bigIdx = -1;
    nums.forEach(function (n, idx) {
      if (!compatible(roles.t, n)) return;
      if (bigIdx < 0 || n.value > nums[bigIdx].value) bigIdx = idx;
    });
    if (bigIdx >= 0) {
      // أكبر رقم أُسند لدور آخر بلا كلمة إجمالي صريحة؟ نعيده للإجمالي (t)
      // لأن الإجمالي في أي عملية لا يمكن أن يكون أصغر من الجزء المدفوع.
      var ownerKey = base.owner && base.owner[bigIdx];
      if (ownerKey && ownerKey !== 't') {
        delete base.vars[ownerKey];
        delete base.usedNum[bigIdx];
        delete base.owner[bigIdx];
      }
      base.vars.t = nums[bigIdx].value;
      base.usedNum[bigIdx] = 1;
      if (base.owner) base.owner[bigIdx] = 't';
    }
  }

  var attempts = buildAttempts(text, nums, roles, base);

  for (var i = 0; i < attempts.length; i++) {
    var vars = attempts[i];
    Object.keys(roles).forEach(function (key) {
      if (vars[key] === undefined) {
        if (roles[key].def !== undefined) vars[key] = roles[key].def;
        else if (roles[key].d0) vars[key] = 0;
      }
    });
    applyEquations(tpl, vars);
    if (!requirementsMet(tpl, vars)) continue;
    var ctx = buildCtx(text, tpl);
    var dir = payDirOf(tpl);
    ctx.restAcc = restAccountOf(text, dir); // حساب «الباقي»: الموردون/العملاء أو أوراق دفع/قبض

    // نستخرج كل قنوات السداد (نقدية + بنك + أوراق) ثم نعيد حساب الباقي كقابس توازن
    var paidBefore = vars.p, restBefore = vars.rest;
    var parts = canSplitPay(tpl) ? settlementLegs(text, nums, vars.t, dir) : null;
    if (parts) {
      var paidSum = round2(parts.reduce(function (s, x) { return s + x.m; }, 0));
      if (paidSum > 0 && paidSum <= vars.t + 0.01) {
        vars.p = paidSum;
        if (vars.rest !== undefined) vars.rest = round2(vars.t - paidSum);
      } else parts = null;
    }
    if (parts) ctx.legs = parts;
    else if (hasLegsRow(tpl)) {
      // قناة واحدة: القالب قد لا يملك دور p (شراء كامل الدفع)، فنستخدم الإجمالي
      ctx.legs = [{ acc: ctx.cb, m: round2(vars.p !== undefined ? vars.p : vars.t) }];
    }

    var raw = buildLines(tpl, vars, ctx);
    if (!raw || !raw.length) continue;
    if (hasCbRow(tpl) && parts) {
      var split = splitPayLines(raw, ctx, vars.p);
      if (split) raw = split;
      else {
        // لم نجد سطر الدفع المطلوب: نرجع القيم الأصلية بدل إنتاج قيد خاطئ
        vars.p = paidBefore;
        if (restBefore !== undefined) vars.rest = restBefore;
        ctx.legs = null;
      }
    }
    var lines = mergeLines(raw);
    if (lines.length < 2) continue;
    if (!balanceLines(lines)) continue;
    return finalize(tpl, vars, ctx, lines);
  }
  return null;
}

/* ============================================================================
   ١٣) القيود المركّبة (multi): مصروفات متعددة / تأسيس / قيد افتتاحي
   ============================================================================ */

// أقرب رقم لمسمى معين: نبحث بعده أولًا ثم قبله
function nearestNumber(nums, pos, used, maxAfter, maxBefore) {
  var best = null, i;
  for (i = 0; i < nums.length; i++) {
    if (used[i]) continue;
    var n = nums[i];
    if (n.start >= pos && n.start - pos <= maxAfter) {
      if (!best || n.start < best.num.start) best = { num: n, idx: i };
    }
  }
  if (best) return best;
  for (i = 0; i < nums.length; i++) {
    if (used[i]) continue;
    var b = nums[i];
    if (b.end <= pos && pos - b.end <= maxBefore) {
      if (!best || b.end > best.num.end) best = { num: b, idx: i };
    }
  }
  return best;
}

// القيد المركّب للمصروفات المتعددة: إيجار وكهرباء ومرتبات... في قيد واحد
function buildExpenseMulti(text, tpl) {
  var nums = extractNumbers(text);
  if (!nums.length) return null;
  var items = entMatches(text, 'exp');
  if (!items.length) return null;

  var used = {}, linesItems = [];
  items.sort(function (a, b) { return a.start - b.start; });
  items.forEach(function (it) {
    var near = nearestNumber(nums, it.end, used, 38, 16);
    if (!near) return;
    used[near.idx] = 1;
    linesItems.push({ acc: it.acc, m: near.num.value });
  });
  if (!linesItems.length) return null;

  var total = linesItems.reduce(function (s, x) { return s + x.m; }, 0);
  if (total <= 0) return null;

  var ctx = buildCtx(text, tpl);
  var lines = [];
  linesItems.forEach(function (x) { lines.push({ side: 'D', acc: x.acc, m: round2(x.m) }); });
  lines.push({ side: 'C', acc: resolveAccount('{payOut|مصروفات مستحقة}', ctx), m: round2(total) });
  lines = mergeLines(lines);
  if (!balanceLines(lines)) return null;

  var parts = linesItems.map(function (x) { return x.acc + ' ' + fmt(x.m); }).join(' + ');
  var summary = 'تحمّلت المنشأة مصروفات: ' + parts + '، بإجمالي ' + fmt(total) +
                '، والسداد ' + payPhrase(ctx.payOut) + '.';
  var vars = { t: round2(total) };
  return finalize(tpl, vars, ctx, lines, summary);
}

// عناصر أصول/خصوم من نص التأسيس أو القيد الافتتاحي
function collectAssetItems(text, nums, used) {
  /* كلمات الأصول كلها الآن في ENT.asset بمكتبة الحسابات (أصول ثابتة ومتداولة).
     نعالجها بترتيب ظهورها في النص لا بترتيب الفئات: في «أوراق قبض ٣٠٠٠٠،
     ونقدية ٧٠٠٠٠» لو عالجنا النقدية أولًا لالتقطت ٣٠٠٠٠ لأنه أقرب رقم إليها
     وضاع ٧٠٠٠٠. ترتيب النص يجعل كل بند يأخذ رقمه قبل جاره. */
  var DIRS = {
    // «١٠٠٠٠٠ جنيه بالبنك» الرقم قبل العبارة
    'البنك': 'before',
    // «نقدية بالخزينة بمبلغ ٧٠٠٠٠» أو «١٠٠٠٠٠ نقدًا» قد يكون الرقم بعده أو قبله
    'النقدية': 'either',
    // «بضاعة بمبلغ…»، «عملاء بمبلغ…»، «أوراق قبض بمبلغ…» الرقم بعد العبارة
    'مخزون البضاعة': 'after',
    'العملاء': 'after',
    'أوراق قبض': 'after'
  };

  var matches = entMatches(text, 'asset');
  matches.sort(function (a, b) { return a.start - b.start; });

  var items = [], lastSame = {};
  matches.forEach(function (it) {
    /* «نقدية بالخزينة» كلمتان لنفس القناة؛ نأخذ أول كلمة فقط
       حتى لا تُقرأ العبارة الواحدة مبلغين وتسرق رقم البند التالي. */
    var prev = lastSame[it.acc];
    if (prev !== undefined && it.start - prev < 12) { lastSame[it.acc] = it.start; return; }
    lastSame[it.acc] = it.start;

    var dir = DIRS[it.acc];
    var near = dir
      ? nearestDir(nums, it.end, used, 30, dir)
      : nearestNumber(nums, it.end, used, 38, 16); // أصول ثابتة: الرقم غالبًا بعدها
    if (!near) return;
    used[near.idx] = 1;
    items.push({ acc: it.acc, m: near.num.value });
  });
  return items;
}

// أقرب رقم غير مستخدم في اتجاه مفضل، مع محاولة الاتجاه الآخر عند عدم وجوده
function nearestDir(nums, pos, used, maxDist, dir) {
  // either: أقرب رقم في أي اتجاه (للعبارات التي قد يسبقها أو يتبعها المبلغ)
  if (dir === 'either') {
    var best = null;
    for (var i = 0; i < nums.length; i++) {
      if (used[i]) continue;
      var n = nums[i];
      var d = n.start >= pos ? n.start - pos : pos - n.end;
      if (d < 0 || d > maxDist) continue;
      if (!best || d < best.d) best = { num: n, idx: i, d: d };
    }
    return best;
  }
  var first = dir === 'before'
    ? nearestNumber(nums, pos, used, 0, maxDist)
    : nearestNumber(nums, pos, used, maxDist, 0);
  if (first) return first;
  return dir === 'before'
    ? nearestNumber(nums, pos, used, maxDist, 0)
    : nearestNumber(nums, pos, used, 0, maxDist);
}

/* عناصر الخصوم التي قد تظهر مع أصول التأسيس:
   دين مورد، قرض، مصروف مستحق، أو ورقة دفع أصدرتها المنشأة.
   هذه ليست أصولًا بل التزامات تُقيَّد دائنة، وتُخصم من رأس المال.
   الكلمات صارت في ENT.liab بمكتبة الحسابات، والمحرك لا يعرفها بنفسه. */
function collectLiabilityItems(text, nums, used) {
  var lib = kb();
  var rows = (lib && lib.ENT && lib.ENT.liab) || [];
  var items = [];
  var covered = [];
  function overlaps(s, e) {
    for (var i = 0; i < covered.length; i++) {
      if (s < covered[i].e && e > covered[i].s) return true;
    }
    return false;
  }
  /* نبحث عن كل الكلمات أولًا ثم نرتّبها بترتيب النص، فيأخذ كل التزام
     رقمه الخاص قبل أن يقرأ جاره. حماية التداخل تمنع «إيرادات مقدمة»
     من أن تُقرأ أيضًا كـ«مقدم». */
  var marks = [];
  rows.forEach(function (row) {
    matchRanges(text, normPat(row[0])).forEach(function (r) {
      marks.push({ acc: row[1], start: r.start, end: r.end });
    });
  });
  marks.sort(function (a, b) { return a.start - b.start; });

  var lastSame = {};
  marks.forEach(function (mk) {
    if (overlaps(mk.start, mk.end)) return;
    var prev = lastSame[mk.acc];
    if (prev !== undefined && mk.start - prev < 12) { lastSame[mk.acc] = mk.start; return; }
    lastSame[mk.acc] = mk.start;
    // الالتزام رقمه غالبًا بعد الكلمة، و«٣٠٠٠٠ قرض» نادرة لكنها مقبولة
    var near = nearestDir(nums, mk.end, used, 32, 'either');
    if (!near) return;
    covered.push({ s: mk.start, e: mk.end });
    used[near.idx] = 1;
    items.push({ acc: mk.acc, m: near.num.value });
  });
  return items;
}

// القيد المركّب للتأسيس بأصول متنوعة وخصوم (إن وُجدت)
function buildCapitalMulti(text, tpl) {
  var nums = extractNumbers(text);
  if (!nums.length) return null;
  var used = {};
  var items = collectAssetItems(text, nums, used);
  if (!items.length) return null;
  var liabilities = collectLiabilityItems(text, nums, used);

  // رأس المال المذكور صراحة (إن وُجد)
  var capNum = null;
  var m = /(?:راس\s*مال|راسمال|اجمالي راس المال)[^0-9]{0,22}(\d[\d,]*(?:\.\d+)?)/.exec(text);
  if (m) {
    var v = parseFloat(m[1].replace(/,/g, ''));
    if (!isNaN(v)) {
      capNum = v;
      nums.forEach(function (n, idx) {
        if (n.value === v && !used[idx]) used[idx] = 1;
      });
    }
  }

  /* معادلة المركز المالي: الأصول = الخصوم + رأس المال
     لذلك رأس المال = مجموع الأصول − مجموع الخصوم (الباقي للمالك). */
  var sumItems = items.reduce(function (s, x) { return s + x.m; }, 0);
  var sumLiab = liabilities.reduce(function (s, x) { return s + x.m; }, 0);
  var capital = capNum != null ? capNum : round2(sumItems - sumLiab);

  if (capital <= 0) return null;

  // لو صُرّح برأس مال يخالف الأصول − الخصوم نضبط النقدية بفرق التسوية
  if (capNum != null) {
    var diff = round2(sumItems - sumLiab - capNum);
    if (Math.abs(diff) > 0.02) {
      var cashItem = items.filter(function (x) { return x.acc === 'النقدية'; })[0];
      if (cashItem) cashItem.m = round2(cashItem.m - diff);
      else if (diff > 0) items.push({ acc: 'النقدية', m: diff });
    }
  }

  var totalAssets = items.reduce(function (s, x) { return s + x.m; }, 0);
  var min = (tpl.minItems && tpl.minItems.cap) || 1;
  var filled = items.length + liabilities.length;
  if (filled < Math.min(min, 2)) return null;

  var ctx = buildCtx(text, tpl);
  var lines = items.map(function (x) { return { side: 'D', acc: x.acc, m: round2(x.m) }; });
  liabilities.forEach(function (x) { lines.push({ side: 'C', acc: x.acc, m: round2(x.m) }); });
  lines.push({ side: 'C', acc: 'رأس المال', m: round2(capital) });
  lines = mergeLines(lines);
  if (!balanceLines(lines)) return null;

  var parts = items.map(function (x) { return x.acc + ' ' + fmt(x.m); }).join(' + ');
  var summary = 'قدّم المالك للمنشأة: ' + parts + '، بإجمالي أصول ' + fmt(totalAssets) +
                (sumLiab > 0 ? '، وبعد خصم التزامات ' + fmt(sumLiab) + ' يكون رأس المال ' + fmt(capital) : '، بإجمالي رأس مال ' + fmt(capital)) + '.';
  var vars = { t: round2(capital) };
  return finalize(tpl, vars, ctx, lines, summary);
}

// القيد الافتتاحي: أصول مدينة وخصوم دائنة والفرق رأس مال
function buildOpenMulti(text, tpl) {
  var nums = extractNumbers(text);
  if (!nums.length) return null;
  var used = {};
  var assets = collectAssetItems(text, nums, used);
  var liabilities = collectLiabilityItems(text, nums, used);

  // رأس المال المذكور صراحة
  var capNum = null;
  var cm = /(?:راس\s*مال|راسمال)[^0-9]{0,22}(\d[\d,]*(?:\.\d+)?)/.exec(text);
  if (cm) {
    var cv = parseFloat(cm[1].replace(/,/g, ''));
    if (!isNaN(cv)) {
      capNum = cv;
      nums.forEach(function (n, idx) { if (n.value === cv && !used[idx]) used[idx] = 1; });
    }
  }

  var sumAssets = assets.reduce(function (s, x) { return s + x.m; }, 0);
  var sumLiab = liabilities.reduce(function (s, x) { return s + x.m; }, 0);
  var capital = capNum != null ? capNum : round2(sumAssets - sumLiab);

  if (capNum != null) {
    var diff = round2(sumAssets - sumLiab - capNum);
    if (Math.abs(diff) > 0.02) {
      var cash = assets.filter(function (x) { return x.acc === 'النقدية'; })[0];
      if (cash) cash.m = round2(cash.m - diff);
      else if (diff > 0) assets.push({ acc: 'النقدية', m: diff });
    }
  }

  var min = (tpl.minItems && tpl.minItems.open) || 2;
  if (assets.length + liabilities.length < min) return null;
  if (capital <= 0) return null;

  var ctx = buildCtx(text, tpl);
  var lines = [];
  assets.forEach(function (x) { lines.push({ side: 'D', acc: x.acc, m: round2(x.m) }); });
  liabilities.forEach(function (x) { lines.push({ side: 'C', acc: x.acc, m: round2(x.m) }); });
  lines.push({ side: 'C', acc: 'رأس المال', m: round2(capital) });
  lines = mergeLines(lines);
  if (!balanceLines(lines)) return null;

  var summary = 'قيد افتتاحي: أصول بقيمة ' + fmt(sumAssets) + '، وخصوم بقيمة ' + fmt(sumLiab) +
                '، ورأس المال ' + fmt(capital) + '.';
  var vars = { t: round2(capital) };
  return finalize(tpl, vars, ctx, lines, summary);
}

function buildMulti(text, tpl) {
  var kind = tpl.multi && tpl.multi.kind;
  var res = null;
  if (kind === 'exp') res = buildExpenseMulti(text, tpl);
  else if (kind === 'cap') res = buildCapitalMulti(text, tpl);
  else if (kind === 'open') res = buildOpenMulti(text, tpl);
  if (res) return res;
  // احتياطي: بعض قوالب multi يمكن حلها كقالب عادي إن كانت العملية بسيطة
  if (kind === 'exp') return resolveTemplate(text, tpl);
  return null;
}

/* ============================================================================
   ١٤) اختيار القالب المناسب
   ============================================================================ */

function kMatches(text, pattern, tpl) {
  if (pattern === '@exp') return !!findEnt(text, 'exp');
  /* @asset في القوالب تعني «أصل ثابت» لا أي أصل: «شراء بضاعة» مشتريات
     وليست شراء أصل ثابت، ولو قبلنا كل أصول ENT لاختلط قالب الأصل بقالب الشراء. */
  if (pattern === '@asset') return hasFixedAsset(text);
  if (pattern === '@rev') return !!findEnt(text, 'rev');
  if (pattern === '@center') return !!findEnt(text, 'center');
  if (pattern === 'دفع|سدد|سداد|صرف|اوفي|وفي|ادي|تسديد|تسدد' &&
      tpl.k && tpl.k.indexOf('@exp') >= 0) {
    // السماح بصيغة "إيجار 5000 نقدًا" بدون فعل دفع صريح
    if (testAlt(text, pattern)) return true;
    return testAlt(text, CASH_WORDS + '|مصروف|مصروفات|مصاريف');
  }
  return testAlt(text, pattern);
}

function templateScore(text, tpl) {
  var s = (tpl.p || 1) * 100;
  s += (tpl.k ? tpl.k.length : 0) * 22;
  if (tpl.o) {
    tpl.o.forEach(function (p) { if (testAlt(text, p[0])) s += (p[1] || 0) * 8; });
  }
  if (tpl.multi) s += 3;
  return s;
}

function templatesFor(text) {
  var list = templates();
  var out = [];
  list.forEach(function (tpl) {
    if (!tpl.k || !tpl.k.length) return;
    var ok = true;
    for (var i = 0; i < tpl.k.length; i++) {
      if (!kMatches(text, tpl.k[i], tpl)) { ok = false; break; }
    }
    if (!ok) return;
    if (tpl.x) {
      for (var j = 0; j < tpl.x.length; j++) {
        if (testAlt(text, tpl.x[j])) return;
      }
    }
    if (tpl.requireNoDisc && testAlt(text, 'خصم|حسم|سماح|سامح|تخفيض|تنازل')) return;
    out.push({ tpl: tpl, score: templateScore(text, tpl) });
  });
  out.sort(function (a, b) { return b.score - a.score; });
  return out.map(function (o) { return o.tpl; });
}

/* ============================================================================
   ١٥) واجهة التحليل الرئيسية
   ============================================================================ */

function categories() {
  var lib = kb();
  if (!lib || !lib.T) return [];
  var seen = {}, out = [];
  lib.T.forEach(function (t) {
    if (t.c && !seen[t.c]) { seen[t.c] = 1; out.push(t.c); }
  });
  return out;
}

function parseOne(rawText) {
  var raw = String(rawText == null ? '' : rawText).trim();
  if (!raw) return { error: 'اكتب وصف العملية أولًا حتى أستطيع تحليلها.' };

  var lib = kb();
  if (!lib || !lib.T || !lib.T.length) {
    return { error: 'لم أجد مكتبة القوالب المحاسبية. تأكد أن ملف accounting-kb.js محمَّل قبل المحلل الذكي.' };
  }

  var text = normalize(raw);
  var nums = extractNumbers(text);
  if (!nums.length) {
    return { error: 'لم أجد أي أرقام في البيان. اكتب المبلغ بوضوح (مثال: اشترت بضاعة بـ 5000 نقدًا).' };
  }

  var cands = templatesFor(text);
  if (!cands.length) {
    return {
      error: 'لم أتعرف على نوع العملية من صياغة البيان. القطاعات المتاحة: ' + categories().join('، ') +
             '. جرّب صياغة أوضح مثل: دفع إيجار 5000 نقدًا، أو بيع بضاعة بـ 12000 على الحساب.'
    };
  }

  var tried = [];
  var limit = Math.min(cands.length, 30);
  for (var i = 0; i < limit; i++) {
    var tpl = cands[i];
    var res = tpl.multi ? buildMulti(text, tpl) : resolveTemplate(text, tpl);
    if (res) {
      res.raw = raw;
      res.normalized = text;
      return res;
    }
    if (tried.indexOf(tpl.c) < 0) tried.push(tpl.c);
  }

  return {
    error: 'فهمت أن العملية من نوع (' + tried.join(' / ') + ') لكنني لم أستطع توزيع المبالغ على أطراف القيد بشكل متوازن. ' +
           'أعد كتابة البيان موضحًا المبلغ وطريقة السداد، مثل: اشترت بضاعة بـ 5000 نقدًا.'
  };
}

/* ============================================================================
   ١٦) واجهة المقارنة والعرض داخل المنصة
   ============================================================================ */

/* ============================================================================
   ١٦) المقارنة الذكية (تدعم أي عدد من السطور)
   ============================================================================
   لا نقارن السطر الأول بالحل الأول، لأن الطالب قد يكتب النقدية والبنك
   بترتيب مختلف، أو يجزّئ الحساب إلى سطرين. لذلك:
     1) ندمج كل حساب مع نفسه (لو تكرر في سطرين).
     2) نقارن بمفتاح «اسم الحساب + الاتجاه (مدين/دائن)».
     3) نسمح بفرق قرشين للتقريب فقط.
   ============================================================================ */

function sideMapOf(list) {
  var map = {};
  (list || []).forEach(function (x) {
    var acc = String(x && x.a || '').trim();
    var m = Number(x && x.m);
    if (!acc || isNaN(m)) return;
    map[acc] = round2((map[acc] || 0) + m);
  });
  return map;
}

function sameSide(a, b) {
  var ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (var i = 0; i < ka.length; i++) {
    if (b[ka[i]] === undefined || Math.abs(a[ka[i]] - b[ka[i]]) > 0.02) return false;
  }
  return true;
}

function compare(user, smart) {
  var uD = sideMapOf(user.debits), uC = sideMapOf(user.credits);
  var sD = sideMapOf(smart.debits), sC = sideMapOf(smart.credits);

  if (!Object.keys(uD).length && !Object.keys(uC).length) {
    return { status: 'empty', msg: 'لم تكتب قيدًا بعد — راجع مقترح المحرك بالأسفل.' };
  }
  if (sameSide(uD, sD) && sameSide(uC, sC)) {
    return { status: 'perfect', msg: 'قيدك مطابق تمامًا للقيد المقترح.' };
  }
  if (sameSide(uD, sC) && sameSide(uC, sD)) {
    return { status: 'swapped', msg: 'الأطراف صحيحة لكن المدين والدائن معكوسان.' };
  }

  // تشخيص مفيد للطالب: ماذا ينقص، ماذا زاد، وأي مبلغ غير صحيح
  var missing = [], extra = [], wrong = [];
  function scan(u, s, label) {
    Object.keys(s).forEach(function (a) {
      if (u[a] === undefined) missing.push(label + ' ' + a);
      else if (Math.abs(u[a] - s[a]) > 0.02) {
        wrong.push(label + ' ' + a + ' (' + fmt(u[a]) + ' بدل ' + fmt(s[a]) + ')');
      }
    });
    Object.keys(u).forEach(function (a) {
      if (s[a] === undefined) extra.push(label + ' ' + a);
    });
  }
  scan(uD, sD, 'مدين');
  scan(uC, sC, 'دائن');

  var bits = [];
  if (missing.length) bits.push('ينقصك: ' + missing.join('، '));
  if (extra.length) bits.push('غير مطلوب: ' + extra.join('، '));
  if (wrong.length) bits.push('مبلغ غير صحيح: ' + wrong.join('، '));

  return {
    status: 'diff',
    msg: bits.length ? ('القيد غير مطابق — ' + bits.join(' | ') + '.') : 'القيد غير مطابق — راجع التفسير بالأسفل لمعرفة السبب.',
    details: { missing: missing, extra: extra, wrong: wrong }
  };
}

// عرض النتيجة في صندوق verifyResult
function showResult(res) {
  if (typeof document === 'undefined') return;
  var box = document.getElementById('verifyResult');
  if (!box) return;

  if (res.error) {
    box.className = 'mt-3 text-right rounded-xl p-4 bg-rose-50 border-2 border-rose-300 text-rose-800 text-sm shadow-inner no-print';
    box.innerHTML = escHtml(res.error);
    box.classList.remove('hidden');
    return;
  }

  var parsed = res.parsed, user = res.user, cmp = res.cmp;
  var colors = {
    perfect: 'bg-emerald-50 border-emerald-400 text-emerald-900',
    swapped: 'bg-amber-50 border-amber-400 text-amber-900',
    diff: 'bg-rose-50 border-rose-400 text-rose-900',
    empty: 'bg-indigo-50 border-indigo-400 text-indigo-900'
  };
  var cls = colors[cmp.status] || 'bg-slate-50 border-slate-300';
  var tpl = parsed.template || {};

  function linesHtml(list) {
    return list.map(function (x) {
      return '<div class="flex justify-between py-1 border-b border-dashed border-gray-200 last:border-0">' +
        '<span class="font-bold text-gray-700">حـ/ ' + escHtml(x.a) + '</span>' +
        '<span class="font-mono font-bold">' + fmt(x.m) + '</span></div>';
    }).join('') || '<div class="text-gray-400 text-sm py-1">لا توجد سطور</div>';
  }
  function total(list) {
    return list.reduce(function (s, x) { return s + Number(x.m || 0); }, 0);
  }

  box.className = 'mt-4 text-right rounded-xl p-5 border-2 ' + cls + ' shadow-sm no-print transition-all';
  box.classList.remove('hidden');

  box.innerHTML = '' +
    '<div class="flex flex-wrap items-center justify-between gap-2 border-b pb-3 mb-3">' +
      '<div class="font-bold text-lg">' + escHtml(tpl.t || 'قيد محاسبي') + '</div>' +
      '<span class="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700">' +
        escHtml(tpl.c || '') + ' — ' + escHtml(tpl.id || '') + '</span>' +
    '</div>' +
    '<div class="text-sm text-slate-700 mb-3 leading-relaxed">' + escHtml(parsed.summary || '') + '</div>' +
    '<div class="text-sm font-bold mb-3">' + escHtml(cmp.msg) + '</div>' +
    '<div class="grid md:grid-cols-2 gap-4 text-sm">' +
      '<div class="bg-white rounded-xl p-4 border border-indigo-100 shadow-sm">' +
        '<div class="text-indigo-700 font-bold mb-2">مقترح المحرك الذكي</div>' +
        '<div class="text-emerald-700 font-bold mb-1">من حـ/ (المدين)</div>' + linesHtml(parsed.debits) +
        '<div class="text-xs text-gray-500 mt-1">الإجمالي: ' + fmt(total(parsed.debits)) + '</div>' +
        '<div class="text-rose-700 font-bold mt-3 mb-1">إلى حـ/ (الدائن)</div>' + linesHtml(parsed.credits) +
        '<div class="text-xs text-gray-500 mt-1">الإجمالي: ' + fmt(total(parsed.credits)) + '</div>' +
      '</div>' +
      ((user.debits.length || user.credits.length) ?
        '<div class="bg-gray-50 rounded-xl p-4 border border-gray-200 shadow-sm">' +
          '<div class="text-gray-700 font-bold mb-2">قيدك أنت</div>' +
          '<div class="text-emerald-700 font-bold mb-1">من حـ/ (المدين)</div>' + linesHtml(user.debits) +
          '<div class="text-rose-700 font-bold mt-3 mb-1">إلى حـ/ (الدائن)</div>' + linesHtml(user.credits) +
        '</div>' : '') +
    '</div>' +
    '<div class="mt-4 p-4 bg-white rounded-lg border border-gray-200 shadow-inner">' +
      '<div class="font-bold text-indigo-800 mb-2">كيف استنتج المحرك هذا القيد؟</div>' +
      '<div class="space-y-1 text-sm text-gray-700 leading-relaxed">' +
        parsed.notes.map(function (n) { return '<div class="p-1 rounded hover:bg-gray-50">• ' + escHtml(n) + '</div>'; }).join('') +
      '</div>' +
    '</div>' +
    '<div class="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-200">' +
      '<button type="button" onclick="window.applySuggestion()" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2 rounded-lg shadow transition-colors">اعتماد هذا القيد في الدفتر</button>' +
      '<button type="button" onclick="window.closeSmartResult()" class="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold px-6 py-2 rounded-lg transition-colors">إغلاق</button>' +
    '</div>';
}

/* ============================================================================
   ١٧) إدارة الحسابات الجديدة داخل المنصة
   ============================================================================ */

var UI_KIND = { A: 'A', L: 'L', E: 'E', R: 'R', X: 'X', CA: 'A', CR: 'R', CX: 'X', CE: 'E' };

function metaOf(name) {
  var lib = kb();
  var e = lib && lib.ACCT && lib.ACCT[name];
  var k = e && e.k ? e.k : accountKind(name);
  var g = e && e.g ? e.g : (k === 'CA' ? '12' : k === 'CE' ? '3' : k === 'A' ? '11' : k === 'L' ? '21' : k === 'E' ? '3' : k === 'R' ? '4' : '5');
  return { k: UI_KIND[k] || 'A', g: g };
}

function ensureAccount(name) {
  if (!name) return;
  if (typeof accounts === 'undefined') return; // خارج المنصة (اختبارات)
  var meta = metaOf(name);
  var changed = false;
  try {
    if (accounts.indexOf(name) < 0) { accounts.push(name); changed = true; }
    if (typeof types !== 'undefined' && !types[name]) { types[name] = meta.k; changed = true; }
    if (typeof codes !== 'undefined' && !codes[name] && typeof autoCode === 'function') {
      codes[name] = autoCode(meta.g); changed = true;
    }
  } catch (e) { return; }
  if (!changed) return;
  try { store.set('acc_list', accounts); } catch (e) {}
  try { if (typeof types !== 'undefined') store.set('acc_types', types); } catch (e) {}
  try { if (typeof codes !== 'undefined') store.set('acc_codes', codes); } catch (e) {}
}

/* ============================================================================
   ١٨) أزرار واجهة المنصة
   ============================================================================ */

function closeResult() {
  if (typeof document === 'undefined') return;
  var box = document.getElementById('verifyResult');
  if (box) { box.classList.add('hidden'); box.innerHTML = ''; }
}

function checkEntrySmart() {
  if (typeof document === 'undefined') return;
  var descEl = document.getElementById('desc');
  var desc = (descEl && descEl.value || '').trim();
  if (!desc) { showResult({ error: 'اكتب وصف العملية في حقل «البيان» أولًا.' }); return; }

  // نمسح الاقتراح القديم أولًا حتى لا يظل زر «اعتماد القيد» يحمل نتيجة جملة سابقة
  root._lastSuggestion = null;
  var parsed = parseOne(desc);
  if (parsed.error) { showResult({ error: parsed.error }); return; }

  var userDebits = [], userCredits = [];
  try {
    if (typeof readRows === 'function') {
      userDebits = readRows('d');
      userCredits = readRows('c');
    }
  } catch (e) {}

  var cmp = compare({ debits: userDebits, credits: userCredits }, parsed);
  root._lastSuggestion = parsed;
  showResult({ parsed: parsed, user: { debits: userDebits, credits: userCredits }, cmp: cmp });
}

function applySuggestion() {
  var p = root._lastSuggestion;
  if (!p) return;
  if (typeof document === 'undefined') return;

  p.debits.concat(p.credits).forEach(function (x) { ensureAccount(x.a); });
  if (typeof refreshSelects === 'function') refreshSelects();

  var dBox = document.getElementById('dRows');
  var cBox = document.getElementById('cRows');
  if (!dBox || !cBox || typeof addRow !== 'function') return;
  dBox.innerHTML = '';
  cBox.innerHTML = '';

  function fill(box, side, list) {
    list.forEach(function (item) {
      addRow(side);
      var rows = box.querySelectorAll('.row');
      var row = rows[rows.length - 1];
      var sel = row.querySelector('select');
      var amt = row.querySelector('.amt');
      if (sel) sel.value = item.a;
      if (amt) amt.value = item.m;
    });
  }
  fill(dBox, 'd', p.debits);
  fill(cBox, 'c', p.credits);
  if (typeof calc === 'function') calc();
  closeResult();
}

function injectVerifyButton() {
  if (typeof document === 'undefined') return;
  var form = document.getElementById('f');
  if (!form || document.getElementById('verifyBtn')) return;
  var saveBtn = form.querySelector('button.w-full') || form.querySelector('button[type="submit"]');
  var wrap = document.createElement('div');
  wrap.className = 'space-y-2 w-full mt-4';
  wrap.innerHTML = '' +
    '<div class="text-center no-print">' +
      '<button type="button" id="verifyBtn" onclick="window.checkEntrySmart()" ' +
        'class="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold px-8 py-3 rounded-xl shadow-lg inline-flex items-center gap-2 transform transition hover:scale-105 w-full md:w-auto justify-center">' +
        'تحليل القيد بالمكتبة المحاسبية' +
      '</button>' +
      '<span class="block text-xs text-gray-500 mt-2">اكتب العملية بأي صياغة، والمحرك يقرأ القالب من المكتبة ويشرح لك خطوات الحل.</span>' +
    '</div>' +
    '<div id="verifyResult" class="hidden"></div>';
  if (saveBtn && saveBtn.parentNode) saveBtn.parentNode.insertBefore(wrap, saveBtn);
  else form.appendChild(wrap);
}

function init() {
  if (typeof document === 'undefined') return; // تشغيل اختبارات Node
  if (typeof window.addRow !== 'function' || typeof window.readRows !== 'function') {
    setTimeout(init, 250);
    return;
  }
  injectVerifyButton();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}

/* ============================================================================
   ١٩) التصدير
   ============================================================================ */

root.smartParse = parseOne;
root.checkEntrySmart = checkEntrySmart;
root.applySuggestion = applySuggestion;
root.closeSmartResult = closeResult;
root.ACC_SMART = {
  version: '4.0',
  kbVersion: (kb() && kb().version) || '-',
  templates: function () { return templates().length; },
  categories: categories,
  parse: parseOne,
  normalize: normalize,
  extractNumbers: extractNumbers
};

})(typeof window !== 'undefined' ? window : globalThis);
