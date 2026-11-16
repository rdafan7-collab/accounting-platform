/* ============================================================================
   EDU_Acc — تمارين وحلول وامتحان ذاتي (pro-exercises.js)
   ----------------------------------------------------------------------------
   ملف خارجي مستقل بيُحمَّل بعد pro-mode.js و pro-modules.js:
       <script src="pro-exercises.js"></script>
   وظيفته:
   1) صفحة «تمارين وحلول» فيها بيان كل حالة وحلها خطوة بخطوة.
   2) زر «توزيع الحل على المنصة»: يعيد تنفيذ الحل بالترتيب، وكل عملية تروح
      لمكانها الصح (قيد — أصل وإهلاك — فاتورة — سند قبض/صرف — ضريبة).
      الخاصية دي متاحة للمستوى المبتدئ والمتوسط فقط.
   3) زر «جرّب نفسك»: يعرض البيان، الطالب يحل على المنصة، والنظام يقارن
      أرصدة حله بالنموذج ويعطيه درجة + جدول فروق.
   لا يعدّل أي كود في النواة أو في pro-mode.js.
   ============================================================================ */
(function () {
  'use strict';
  if (window.__PRO_EX_LOADED) return;
  window.__PRO_EX_LOADED = true;

  var P = window.ProMode;
  if (!P || !P.api) { console.warn('[pro-exercises] يحتاج تحميل pro-mode.js أولًا.'); return; }
  var A = P.api, E = A.E, N = A.N, R2 = A.R2, grid = A.grid;
  var Y = new Date().getFullYear();
  var d = function (m, day) { return Y + '-' + ('0' + m).slice(-2) + '-' + ('0' + day).slice(-2); };
  var doc = function (t) { return String(t || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  /* ------------------------------------------------------------------ حالة الصفحة */
  var LS = 'pro_ex_state';
  var ST = { level: 1, caseId: null, sol: false, exam: null, result: null };
  try { ST = Object.assign(ST, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) { }
  function saveST() { try { localStorage.setItem(LS, JSON.stringify(ST)); } catch (e) { } }
  function runsFor(id) {
    var all = {}; try { all = JSON.parse(localStorage.getItem('pro_exRuns') || '{}'); } catch (e) { }
    var sc = A.scope(); all[sc] = all[sc] || {};
    all[sc][id] = all[sc][id] || { n: 0 };
    return { get: function () { return all[sc][id].n || 0; }, set: function (n) { all[sc][id].n = n; try { localStorage.setItem('pro_exRuns', JSON.stringify(all)); } catch (e) { } } };
  }

  /* ------------------------------------------------------------------ مكتبة الحالات
     كل حالة: brief = بيان السؤال، data = العمليات، required = المطلوب،
     solution = شرح الحل بالترتيب، steps = خطوات التوزيع على المنصة،
     expected = الأرصدة النهائية الصحيحة للتصحيح (موجب = مدين، سالب = دائن). */
  var CASES = [
    {
      id: 'ex_birdi', level: 1, name: 'محل البردى للأدوات المنزلية',
      brief: 'بدأ محمد البردى نشاطه في أول يناير برأس مال نقدي 200,000 ج.م، ونفّذ خلال الشهر العمليات الآتية.',
      data: [
        '١) إيداع رأس المال النقدي في خزينة المحل 200,000 ج.م.',
        '٢) شراء أثاث ومعدات للمحل 30,000 ج.م نقدًا (عمر افتراضي 5 سنوات بدون قيمة تخريدية).',
        '٣) شراء بضاعة على الحساب من المورد أحمد 90,000 ج.م.',
        '٤) بيع بضاعة تكلفتها 55,000 ج.م بمبلغ 80,000 ج.م نقدًا.',
        '٥) سداد 40,000 ج.م للمورد أحمد نقدًا.',
        '٦) سداد إيجار المحل 6,000 ج.م نقدًا.'
      ],
      required: ['سجّل القيود اليومية بالترتيب.', 'رحّل تكلفة البضاعة المباعة (نظام الجرد المستمر).', 'أعد ميزان المراجعة وقائمة الدخل وحدد صافي الربح.'],
      solution: [
        'قيد افتتاحي: من ح/ النقدية 200,000 إلى ح/ رأس المال 200,000.',
        'شراء الأثاث: يقفل في سجل الأصول الثابتة بقيمة 30,000، قيده: من ح/ الأثاث والمعدات إلى ح/ النقدية.',
        'شراء البضاعة بالأجل: من ح/ المخزون 90,000 إلى ح/ الموردون - أحمد 90,000.',
        'البيع النقدي: من ح/ النقدية 80,000 إلى ح/ المبيعات 80,000.',
        'تكلفة المبيعات: من ح/ تكلفة المبيعات 55,000 إلى ح/ المخزون 55,000.',
        'سداد المورد: من ح/ الموردون - أحمد 40,000 إلى ح/ النقدية 40,000.',
        'الإيجار: من ح/ مصروف الإيجار 6,000 إلى ح/ النقدية 6,000.',
        'النتيجة: الإيرادات 80,000 − (تكلفة 55,000 + إيجار 6,000) = صافي ربح 19,000.'
      ],
      expected: [
        { label: 'النقدية', keys: ['النقدية'], b: 204000 },
        { label: 'الأثاث والمعدات', keys: ['أثاث ومعدات', 'الأثاث والمعدات'], b: 30000 },
        { label: 'المخزون', keys: ['المخزون'], b: 35000 },
        { label: 'الموردون (أحمد)', keys: ['الموردون - أحمد', 'الموردون'], b: -50000 },
        { label: 'رأس المال', keys: ['رأس المال'], b: -200000 },
        { label: 'المبيعات', keys: ['المبيعات'], b: -80000 },
        { label: 'تكلفة المبيعات', keys: ['تكلفة المبيعات', 'تكلفة البضاعة المباعة'], b: 55000 },
        { label: 'مصروف الإيجار', keys: ['مصروف الإيجار', 'الإيجار'], b: 6000 }
      ],
      steps: [
        {
          page: 'jv', title: 'قيد افتتاحي — رأس المال النقدي 200,000',
          why: 'رأس المال حق ملكية يزيد بالدائن، والنقدية أصل يزيد بالمدين.',
          stmt: 'من حـ/ النقدية 200,000 إلى حـ/ رأس المال 200,000',
          eff: 'النقدية (أصل) تزيد 200,000 مدين، ورأس المال (حق ملكية) يزيد 200,000 دائن.',
          ask: 'إيداع رأس المال النقدي في خزينة المحل 200,000 ج.م.',
          run: function () { A.ensureAcc('النقدية', 'A', '11'); A.ensureAcc('رأس المال', 'E', '3'); return A.postEntry('قيد افتتاحي — رأس المال', [['النقدية', 200000]], [['رأس المال', 200000]], d(1, 1), { src: 'pro-ex', demo: 'ex_birdi' }); }
        },
        {
          page: 'assets', title: 'شراء الأثاث والمعدات 30,000 نقدًا (سجل أصول + قيد)',
          why: 'الأصل الثابت يتسجل في سجل الأصول عشان يتبني له جدول إهلاك على 5 سنوات.',
          stmt: 'تسجيل أصل «أثاث ومعدات» بـ 30,000 نقدًا — من حـ/ الأثاث والمعدات إلى حـ/ النقدية',
          eff: 'الأصول الثابتة تزيد 30,000 والنقدية تنقص 30,000، واتفتح جدول إهلاك سنوي 6,000.',
          ask: 'شراء أثاث ومعدات للمحل 30,000 ج.م نقدًا (عمر افتراضي 5 سنوات بدون قيمة تخريدية).',
          run: function () { return A.addAssetRec({ name: 'أثاث ومعدات', start: d(1, 2), cost: 30000, salvage: 0, life: 5, method: 'sl', buy: 'cash', demo: 'ex_birdi' }); }
        },
        {
          page: 'jv', title: 'شراء بضاعة على الحساب 90,000 من المورد أحمد',
          why: 'المخزون أصل يزيد بالمدين، والموردون خصم يزيد بالدائن.',
          stmt: 'من حـ/ المخزون 90,000 إلى حـ/ الموردون - أحمد 90,000',
          eff: 'المخزون يزيد 90,000 مدين، والمورد أحمد بقى ليه علينا 90,000 دائن.',
          ask: 'شراء بضاعة على الحساب من المورد أحمد 90,000 ج.م.',
          run: function () { A.ensureAcc('المخزون', 'A', '11'); A.ensureAcc('الموردون', 'L', '21'); return A.postEntry('شراء بضاعة على الحساب — المورد أحمد', [['المخزون', 90000]], [[A.subAcc('الموردون', 'أحمد', 'L'), 90000]], d(1, 5), { src: 'pro-ex', demo: 'ex_birdi' }); }
        },
        {
          page: 'sale', title: 'فاتورة بيع نقدي 80,000 ج.م',
          why: 'المبيعات إيراد يزيد بالدائن، والنقدية تزيد بالمدين (بدون ضريبة في هذا المستوى).',
          stmt: 'فاتورة بيع نقدية 80,000 — من حـ/ النقدية إلى حـ/ المبيعات',
          eff: 'النقدية تزيد 80,000 مدين، والمبيعات (إيراد) تزيد 80,000 دائن.',
          ask: 'بيع بضاعة بمبلغ 80,000 ج.م نقدًا.',
          run: function () { return A.addInvoice({ type: 'sale', no: 'S-9001', date: d(1, 10), party: 'عميل نقدي', pay: 'cash', rate: 0, items: [{ n: 'بضاعة', q: 1, p: 80000 }], net: 80000, vat: 0, total: 80000, demo: 'ex_birdi' }); }
        },
        {
          page: 'jv', title: 'إثبات تكلفة البضاعة المباعة 55,000',
          why: 'في الجرد المستمر تُنقل التكلفة من المخزون إلى مصروف تكلفة المبيعات.',
          stmt: 'من حـ/ تكلفة المبيعات 55,000 إلى حـ/ المخزون 55,000',
          eff: 'المخزون ينقص 55,000 ومصروف التكلفة يزيد — وده اللي بيظهر في قائمة الدخل.',
          ask: 'رحّل تكلفة البضاعة المباعة 55,000 (نظام الجرد المستمر).',
          run: function () { A.ensureAcc('تكلفة المبيعات', 'X', '5'); A.ensureAcc('المخزون', 'A', '11'); return A.postEntry('تكلفة البضاعة المباعة', [['تكلفة المبيعات', 55000]], [['المخزون', 55000]], d(1, 10), { src: 'pro-ex', demo: 'ex_birdi' }); }
        },
        {
          page: 'payment', title: 'سند صرف — سداد 40,000 للمورد أحمد',
          why: 'السداد يقلل النقدية (دائن) ويقلل التزام المورد (مدين).',
          stmt: 'سند صرف 40,000 — من حـ/ الموردون - أحمد إلى حـ/ النقدية',
          eff: 'دين أحمد قل من 90,000 لـ 50,000، والنقدية نقصت 40,000.',
          ask: 'سداد 40,000 ج.م للمورد أحمد نقدًا.',
          run: function () { return A.addVoucher({ type: 'payment', no: 'V-9001', date: d(1, 20), method: 'cash', acc: 'الموردون', party: 'أحمد', amount: 40000, desc: 'سداد دفعة للمورد أحمد', demo: 'ex_birdi' }); }
        },
        {
          page: 'payment', title: 'سند صرف — إيجار المحل 6,000',
          why: 'الإيجار مصروف يزيد بالمدين، والنقدية تنقص بالدائن.',
          stmt: 'سند صرف 6,000 — من حـ/ مصروف الإيجار إلى حـ/ النقدية',
          eff: 'مصروف الإيجار يزيد 6,000 (بيقلل الربح) والنقدية نقصت 6,000.',
          ask: 'سداد إيجار المحل 6,000 ج.م نقدًا.',
          run: function () { return A.addVoucher({ type: 'payment', no: 'V-9002', date: d(1, 28), method: 'cash', acc: 'مصروف الإيجار', amount: 6000, desc: 'إيجار المحل', demo: 'ex_birdi' }); }
        },
        {
          page: 'rtrial', title: 'ميزان المراجعة — تأكيد الاتزان وصافي الربح 19,000',
          why: 'كل قيد متزن، فمجموع المدين = مجموع الدائن، والنتيجة 19,000 ربح.',
          stmt: 'مراجعة ميزان المراجعة بعد كل القيود',
          eff: 'الميزان متزن ✅ وصافي الربح = 80,000 − (55,000 + 6,000) = 19,000.',
          ask: 'أعد ميزان المراجعة وقائمة الدخل وحدد صافي الربح.',
          run: function () { return true; }
        }
      ]
    },
    {
      id: 'ex_nokhba', level: 2, name: 'شركة النخبة للتجارة',
      brief: 'شركة تجارية بدأت السنة برأس مال 500,000 ج.م مودع بالبنك، وتستخدم ضريبة قيمة مضافة 14%. نفّذت العمليات الآتية خلال يناير.',
      data: [
        '١) شراء سيارة نقل 120,000 ج.م + ضريبة 16,800 ج.م من البنك (قسط ثابت على 5 سنوات).',
        '٢) شراء بضاعة على الحساب من مورد الشرق 200,000 ج.م + ضريبة 28,000 ج.م.',
        '٣) بيع بضاعة على الحساب لشركة الأمل 300,000 ج.م + ضريبة 42,000 ج.م.',
        '٤) تحصيل 150,000 ج.م من شركة الأمل بالبنك.',
        '٥) سداد 100,000 ج.م لمورد الشرق بالبنك.',
        '٦) سداد رواتب 40,000 ج.م من البنك.',
        '٧) إهلاك السيارة عن السنة 24,000 ج.م.',
        '٨) تسوية ضريبة القيمة المضافة في نهاية الشهر.'
      ],
      required: ['سجّل المصروفات والمبيعات بالضريبة الصحيحة.', 'اعمل إهلاك السيارة وحدد صافي الضريبة المستحقة أو القابلة للاسترداد.', 'أعد قائمة الدخل والمركز المالي.'],
      solution: [
        'رأس المال: من ح/ البنك 500,000 إلى ح/ رأس المال 500,000.',
        'السيارة: من ح/ سيارة النقل 120,000 وضريبة مشتريات 16,800 إلى ح/ البنك 136,800، وتُسجل في سجل الأصول.',
        'الإهلاك: من ح/ مصروف إهلاك السيارة 24,000 إلى ح/ مجمع إهلاك السيارة 24,000 (120,000 ÷ 5).',
        'الشراء الآجل: فاتورة شراء 200,000 + ضريبة 28,000 على المورد مورد الشرق.',
        'البيع الآجل: فاتورة بيع 300,000 + ضريبة 42,000 على العميل شركة الأمل.',
        'التحصيل: سند قبض بنكي 150,000 من شركة الأمل.',
        'السداد: سند صرف بنكي 100,000 لمورد الشرق، ثم رواتب 40,000 من البنك.',
        'الضريبة: مخرجات 42,000 − مدخلات 44,800 = 2,800 قابلة للاسترداد، وتُرحَّل بقيد تسوية.',
        'النتيجة: 300,000 − (200,000 + 40,000 + 24,000) = صافي ربح 36,000.'
      ],
      expected: [
        { label: 'البنك', keys: ['البنك'], b: 373200 },
        { label: 'سيارة النقل', keys: ['سيارة النقل'], b: 120000 },
        { label: 'مجمع إهلاك السيارة', keys: ['مجمع إهلاك سيارة النقل'], b: -24000 },
        { label: 'العملاء (شركة الأمل)', keys: ['العملاء - شركة الأمل', 'العملاء'], b: 192000 },
        { label: 'الموردون (مورد الشرق)', keys: ['الموردون - مورد الشرق', 'الموردون'], b: -128000 },
        { label: 'رأس المال', keys: ['رأس المال'], b: -500000 },
        { label: 'المبيعات', keys: ['المبيعات'], b: -300000 },
        { label: 'المشتريات', keys: ['المشتريات'], b: 200000 },
        { label: 'مصروف الرواتب', keys: ['مصروف الرواتب', 'الرواتب', 'رواتب'], b: 40000 },
        { label: 'مصروف الإهلاك', keys: ['مصروف إهلاك سيارة النقل'], b: 24000 },
        { label: 'صافي ضريبة القيمة المضافة (مدين = قابل للاسترداد)', keys: ['ضريبة مبيعات مستحقة', 'ضريبة مشتريات قابلة للخصم', 'ضريبة القيمة المضافة القابلة للاسترداد', 'ضريبة القيمة المضافة المستحقة السداد'], b: 2800 }
      ],
      steps: [
        {
          page: 'jv', title: 'قيد افتتاحي — رأس المال 500,000 بالبنك',
          why: 'رأس المال حق ملكية دائن، والبنك أصل مدين.',
          stmt: 'من حـ/ البنك 500,000 إلى حـ/ رأس المال 500,000',
          eff: 'البنك يزيد 500,000 مدين، ورأس المال يزيد 500,000 دائن.',
          ask: 'الشركة بدأت السنة برأس مال 500,000 ج.م مودع بالبنك — سجّل قيد الافتتاح.',
          run: function () { A.ensureAcc('البنك', 'A', '11'); A.ensureAcc('رأس المال', 'E', '3'); return A.postEntry('قيد افتتاحي — رأس المال', [['البنك', 500000]], [['رأس المال', 500000]], d(1, 1), { src: 'pro-ex', demo: 'ex_nokhba' }); }
        },
        {
          page: 'assets', title: 'شراء سيارة النقل 120,000 + ضريبة 16,800 من البنك',
          why: 'السيارة أصل ثابت يُسجل في سجل الأصول، وضريبة الشراء تُرحَّل كضريبة مدخلات قابلة للخصم.',
          stmt: 'من حـ/ سيارة النقل 120,000 وحـ/ ضريبة مشتريات قابلة للخصم 16,800 إلى حـ/ البنك 136,800',
          eff: 'أصل السيارة 120,000 + أصل الضريبة 16,800، والبنك نقص 136,800. اتفتح جدول إهلاك سنوي 24,000.',
          ask: 'شراء سيارة نقل 120,000 ج.م + ضريبة 16,800 ج.م من البنك (قسط ثابت على 5 سنوات).',
          run: function () {
            A.ensureAcc('سيارة النقل', 'A', '12'); A.ensureAcc('ضريبة مشتريات قابلة للخصم', 'A', '11'); A.ensureAcc('البنك', 'A', '11');
            var a = A.addAssetRec({ name: 'سيارة النقل', start: d(1, 1), cost: 120000, salvage: 0, life: 5, method: 'sl', demo: 'ex_nokhba' });
            if (!a) return null;
            return A.postEntry('شراء سيارة نقل + ضريبة قيمة مضافة', [['سيارة النقل', 120000], ['ضريبة مشتريات قابلة للخصم', 16800]], [['البنك', 136800]], d(1, 3), { src: 'pro-ex', demo: 'ex_nokhba', vatBase: 120000, vatRate: 14, vatAmt: 16800, vatSide: 'in' });
          }
        },
        {
          page: 'assets', title: 'إهلاك السيارة عن السنة 24,000',
          why: 'القسط الثابت = (التكلفة − التخريدية) ÷ العمر = 120,000 ÷ 5 = 24,000.',
          stmt: 'من حـ/ مصروف إهلاك سيارة النقل 24,000 إلى حـ/ مجمع إهلاك سيارة النقل 24,000',
          eff: 'مصروف الإهلاك يزيد 24,000 (يقلل الربح) ومجمع الإهلاك يقلل صافي قيمة السيارة في المركز المالي.',
          ask: 'سجّل إهلاك السيارة عن السنة 24,000 ج.م.',
          run: function () {
            var a = A.DB.assets.filter(function (x) { return x.demo === 'ex_nokhba' && x.scope === A.scope(); })[0];
            return a ? (A.postDepFor(a, Y) || null) : null;
          }
        },
        {
          page: 'purchase', title: 'فاتورة شراء آجلة 200,000 + ضريبة 28,000 — مورد الشرق',
          why: 'المشتريات مصروف مدين، والضريبة مدخلات، والموردون دائنون بإجمالي 228,000.',
          stmt: 'فاتورة شراء آجلة: من حـ/ المشتريات 200,000 وحـ/ ضريبة مشتريات 28,000 إلى حـ/ الموردون - مورد الشرق 228,000',
          eff: 'مورد الشرق بقى ليه علينا 228,000، والمشتريات مصروف 200,000، والضريبة أصل قابل للخصم 28,000.',
          ask: 'شراء بضاعة على الحساب من مورد الشرق 200,000 ج.م + ضريبة 28,000 ج.م.',
          run: function () { return A.addInvoice({ type: 'purchase', no: 'P-9101', date: d(1, 10), party: 'مورد الشرق', pay: 'credit', rate: 14, items: [{ n: 'بضاعة', q: 1, p: 200000 }], net: 200000, vat: 28000, total: 228000, demo: 'ex_nokhba' }); }
        },
        {
          page: 'sale', title: 'فاتورة بيع آجلة 300,000 + ضريبة 42,000 — شركة الأمل',
          why: 'العملاء مدينون بإجمالي 342,000، والمبيعات إيراد دائن، وضريبة المخرجات مستحقة.',
          stmt: 'فاتورة بيع آجلة: من حـ/ العملاء - شركة الأمل 342,000 إلى حـ/ المبيعات 300,000 وحـ/ ضريبة مبيعات 42,000',
          eff: 'شركة الأمل عليها 342,000 مدين، والمبيعات إيراد 300,000 دائن، وضريبة المخرجات التزام 42,000.',
          ask: 'بيع بضاعة على الحساب لشركة الأمل 300,000 ج.م + ضريبة 42,000 ج.م.',
          run: function () { return A.addInvoice({ type: 'sale', no: 'S-9101', date: d(1, 15), party: 'شركة الأمل', pay: 'credit', rate: 14, items: [{ n: 'بضاعة', q: 1, p: 300000 }], net: 300000, vat: 42000, total: 342000, demo: 'ex_nokhba' }); }
        },
        {
          page: 'receipt', title: 'سند قبض بنكي 150,000 من شركة الأمل',
          why: 'تحصيل جزء من المديونية: البنك يزيد (مدين) والعملاء تنقص (دائن).',
          stmt: 'سند قبظ بنكي 150,000 — من حـ/ البنك إلى حـ/ العملاء - شركة الأمل',
          eff: 'البنك يزيد 150,000 ومديونية الأمل تقل من 342,000 لـ 192,000.',
          ask: 'حصّل 150,000 ج.م من شركة الأمل بالبنك.',
          run: function () { return A.addVoucher({ type: 'receipt', no: 'R-9101', date: d(1, 25), method: 'bank', acc: 'العملاء', party: 'شركة الأمل', amount: 150000, desc: 'تحصيل دفعة من شركة الأمل', demo: 'ex_nokhba' }); }
        },
        {
          page: 'payment', title: 'سند صرف بنكي 100,000 لمورد الشرق',
          why: 'سداد جزء من الالتزام: الموردون تنقص (مدين) والبنك ينقص (دائن).',
          stmt: 'سند صرف بنكي 100,000 — من حـ/ الموردون - مورد الشرق إلى حـ/ البنك',
          eff: 'دين مورد الشرق قل من 228,000 لـ 128,000، والبنك نقص 100,000.',
          ask: 'سدّد 100,000 ج.م لمورد الشرق بالبنك.',
          run: function () { return A.addVoucher({ type: 'payment', no: 'V-9101', date: d(1, 26), method: 'bank', acc: 'الموردون', party: 'مورد الشرق', amount: 100000, desc: 'سداد دفعة لمورد الشرق', demo: 'ex_nokhba' }); }
        },
        {
          page: 'payment', title: 'سند صرف بنكي — رواتب 40,000',
          why: 'الرواتب مصروف يزيد بالمدين، والبنك ينقص بالدائن.',
          stmt: 'سند صرف بنكي 40,000 — من حـ/ مصروف الرواتب إلى حـ/ البنك',
          eff: 'مصروف الرواتب يزيد 40,000 (يقلل الربح) والبنك نقص 40,000.',
          ask: 'سداد رواتب 40,000 ج.م من البنك.',
          run: function () { return A.addVoucher({ type: 'payment', no: 'V-9102', date: d(1, 27), method: 'bank', acc: 'مصروف الرواتب', amount: 40000, desc: 'رواتب يناير', demo: 'ex_nokhba' }); }
        },
        {
          page: 'tax', title: 'قيد تسوية الضريبة — 2,800 قابلة للاسترداد',
          why: 'ضريبة المخرجات 42,000 أقل من المدخلات 44,800، فالفرق 2,800 مستحق لنا (أصل).',
          stmt: 'من حـ/ ضريبة مبيعات 42,000 إلى حـ/ ضريبة مشتريات 44,800 — والفرق 2,800 رصيد مدين قابل للاسترداد',
          eff: 'المخرجات 42,000 أقل من المدخلات 44,800 → صافي 2,800 مستحق لنا من مصلحة الضرائب (أصل مدين).',
          ask: 'نفّذ تسوية ضريبة القيمة المضافة في نهاية الشهر.',
          run: function () { return A.settleVatAt('', '', d(1, 31), 'ex_nokhba'); }
        }
      ]
    },
    {
      id: 'ex_ofoq', level: 3, name: 'شركة الأفق للمقاولات',
      brief: 'شركة مقاولات بدأت السنة برأس مال 800,000 ج.م بالبنك. نفّذت أعمالًا تحت التنفيذ وسلّمت مستخلصًا لعميل مع احتجاز ضمان 5%، وتستخدم ضريبة قيمة مضافة 14%.',
      data: [
        '١) شراء معدات 400,000 ج.م + ضريبة 56,000 ج.م من البنك (إهلاك سنوي 80,000).',
        '٢) شراء مواد بناء على الحساب 300,000 ج.م + ضريبة 42,000 ج.م.',
        '٣) تنفيذ أعمال للعميل: إيراد 680,000 ج.م + ضريبة 95,200 ج.م، مع احتجاز ضمان 5% من قيمة الأعمال (34,000 ج.م).',
        '٤) مستحقات مقاولي باطن 150,000 ج.م على الحساب (بدون ضريبة).',
        '٥) سداد رواتب 120,000 ج.م من البنك.',
        '٦) إهلاك المعدات عن السنة 80,000 ج.م.',
        '٧) تسوية ضريبة القيمة المضافة.'
      ],
      /* القسم المقترح لتسجيل كل عملية من بيان السؤال — بيظهر في زرار «التلميح» أثناء الامتحان */
      dataPages: ['assets', 'purchase', 'contracts', 'jv', 'payment', 'assets', 'tax'],
      required: ['سجّل المستخلص مع الاحتجاز المستحق لدى العميل.', 'حدد نصيب العميل ونصيب محتجز الضمان من إجمالي المستخلص.', 'أعد قائمة الدخل والمركز المالي مع توضيح صافي الربح 30,000.'],
      solution: [
        'المستخلص: إجمالي 775,200 ج.م = 680,000 إيراد + 95,200 ضريبة. يُخصم منه محتجز ضمان 34,000 (5%)، فيصبح المستحق على العميل 741,200.',
        'قيد المستخلص: من ح/ العملاء 741,200 + محتجز ضمان لدى العملاء 34,000 إلى ح/ إيرادات العقود 680,000 + ضريبة مبيعات 95,200.',
        'مواد البناء: من ح/ المشتريات 300,000 + ضريبة مشتريات 42,000 إلى ح/ الموردون 342,000.',
        'مقاولو الباطن: من ح/ تكاليف عقود المقاولات 150,000 إلى ح/ الموردون 150,000.',
        'الإهلاك: من ح/ مصروف الإهلاك 80,000 إلى ح/ مجمع الإهلاك 80,000.',
        'الضريبة: مخرجات 95,200 − مدخلات 98,000 = 2,800 قابلة للاسترداد.',
        'النتيجة: 680,000 − (300,000 + 150,000 + 120,000 + 80,000) = صافي ربح 30,000.',
        'ملاحظة: المستوى المتقدم لا يعرض توزيع الحل تلقائيًا؛ الحل هنا للدراسة والمراجعة مع «جرّب نفسك».'
      ],
      expected: [
        { label: 'البنك', keys: ['البنك'], b: 224000 },
        { label: 'المعدات', keys: ['معدات', 'معدات وآلات'], b: 400000 },
        { label: 'مجمع إهلاك المعدات', keys: ['مجمع إهلاك المعدات'], b: -80000 },
        { label: 'العملاء', keys: ['العملاء'], b: 741200 },
        { label: 'محتجز ضمان لدى العملاء', keys: ['محتجز ضمان لدى العملاء', 'محتجز ضمان أعمال لدى العملاء'], b: 34000 },
        { label: 'الموردون', keys: ['الموردون'], b: -492000 },
        { label: 'رأس المال', keys: ['رأس المال'], b: -800000 },
        { label: 'إيرادات العقود', keys: ['إيرادات عقود المقاولات', 'إيرادات العقود'], b: -680000 },
        { label: 'المشتريات', keys: ['المشتريات'], b: 300000 },
        { label: 'تكاليف العقود', keys: ['تكاليف عقود المقاولات'], b: 150000 },
        { label: 'مصروف الرواتب', keys: ['مصروف الرواتب', 'الرواتب', 'رواتب'], b: 120000 },
        { label: 'مصروف الإهلاك', keys: ['مصروف الإهلاك'], b: 80000 },
        { label: 'صافي الضريبة (قابل للاسترداد)', keys: ['ضريبة مبيعات مستحقة', 'ضريبة مشتريات قابلة للخصم', 'ضريبة القيمة المضافة القابلة للاسترداد', 'ضريبة القيمة المضافة المستحقة السداد'], b: 2800 }
      ],
      steps: []
    }
  ];
  function caseById(id) { return CASES.find(function (c) { return c.id === id; }); }
  var LV = [{ id: 1, name: 'مبتدئ', d: 'قيود أساسية: رأس مال، أصول، مخزون، بيع وتكلفة' }, { id: 2, name: 'متوسط', d: 'ضريبة قيمة مضافة، إهلاك، فواتير آجلة وسندات' }, { id: 3, name: 'متقدم', d: 'مقاولات، مستخلصات، احتجاز ضمان — عرض وحل فقط' }];

  /* ------------------------------------------------------------------ التنفيذ الآلي
     المشغّل بينفذ الخطوات بالترتيب مع تنقل بين الشاشات، عشان الطالب يشوف
     «الحل» وهو بيتوزع في مكانه الصح، وكل خطوة بتتحفظ فعليًا في المنصة.
     الوتيرة بطيئة عمدًا (شرح ← تنفيذ ← وقفة) مع زرار إيقاف مؤقت ومتابعة. */
  var runTok = 0, RUNNING = false, PAUSED = false;
  var PRE_MS = 1600, POST_MS = 1500; /* وقت الشرح قبل التنفيذ، ووقت القراءة بعده */
  var RUN = { label: '', total: 0, i: 0, n: 0, step: null };

  function dockPaint() {
    var box = dockBox(); if (!box) return;
    var span = (RUN.i >= RUN.total && !RUN.step) ? 'تم التوزيع بالكامل ✅' : (RUN.n ? 'الخطوة ' + RUN.n + ' من ' + RUN.total : 'جاهز للبدء');
    /* شرح الخطوة بثلاثة أجزاء واضحة: شكل القيد اللي هيتحط + هدفه المحاسبي + أثره على الحسابات */
    var why = '';
    if (RUN.step) {
      why = '<div class="pmx-why"><b>' + doc(RUN.step.title) + '</b>' +
        (RUN.step.stmt ? '<br><span class="pmx-lb">✍️ القيد:</span> ' + doc(RUN.step.stmt) : '') +
        (RUN.step.why ? '<br><span class="pmx-lb">🎯 الهدف:</span> ' + doc(RUN.step.why) : '') +
        (RUN.step.eff ? '<br><span class="pmx-lb">📈 التأثير:</span> ' + doc(RUN.step.eff) : '') + '</div>';
    }
    box.innerHTML = '<div class="pmx-t"><b>🎬 توزيع الحل — ' + doc(RUN.label) + '</b><span>' + span + '</span></div>' + why +
      '<div class="pmx-p"><div style="width:' + Math.round(RUN.i / Math.max(1, RUN.total) * 100) + '%"></div></div>' +
      '<div class="pmx-b"><button data-x="pause">' + (PAUSED ? '▶ متابعة' : '⏸ وقف مؤقت') + '</button><button data-x="stop">⏹ إيقاف العرض</button></div>';
    box.classList.add('on');
  }
  function wait(ms, fn) {
    /* بنحسب الزمن الفعلي للعرض بس؛ وقت «الوقف المؤقت» ما يتحسبش عشان ما يسرّعش الخطوات بعد المتابعة */
    var active = 0, last = Date.now();
    (function tick() {
      if (!RUNNING) return;
      var now = Date.now();
      if (PAUSED) { last = now; setTimeout(tick, 200); return; }
      active += now - last; last = now;
      if (active >= ms) fn(); else setTimeout(tick, Math.min(200, ms - active));
    })();
  }
  /* نودي الشاشة على العنصر الجديد ونعمل عليه وميض عشان العين تلحق الخطوة */
  function focusStep() {
    var body = document.getElementById('pmBody'); if (!body) return;
    var card = body.querySelector('.pm-card:last-of-type') || body;
    try { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { }
    card.classList.remove('pmx-hit'); void card.offsetWidth; card.classList.add('pmx-hit');
    setTimeout(function () { card.classList.remove('pmx-hit'); }, 1800);
  }
  function togglePause() { if (!RUNNING) return; PAUSED = !PAUSED; dockPaint(); }
  function stopRun() {
    if (!RUNNING) return;
    runTok++; RUNNING = false; PAUSED = false; RUN.step = null;
    if (ST.exam) ensureDock(); else hideDock();
    A.renderPage(); A.toast('تم إيقاف عرض الحل — تقدر ترجع تكمل التوزيع من الأول');
  }
  function runSteps(key, steps, label) {
    var tok = ++runTok, done = runsFor(key);
    RUNNING = true; PAUSED = false;
    RUN = { label: label, total: steps.length, i: 0, n: 0, step: null };
    function next() {
      if (tok !== runTok || !RUNNING) return;
      if (RUN.i >= steps.length) {
        done.set(steps.length);
        RUN.step = null; RUN.n = steps.length;
        dockPaint();
        RUNNING = false; PAUSED = false;
        setTimeout(function () {
          if (tok !== runTok) return;
          if (ST.exam) ensureDock(); else hideDock();
        }, 2600);
        A.toast('تم توزيع الحل بالكامل على المنصة ✅');
        A.renderPage(); return;
      }
      var st = steps[RUN.i];
      RUN.step = st; RUN.n = RUN.i + 1;
      dockPaint();
      /* الأول نشرح الخطوة، وبعد وقفة قصيرة ننفذها قدام الطالب */
      wait(PRE_MS, function () {
        if (tok !== runTok || !RUNNING) return;
        var ok = true;
        try { var r = st.run ? st.run() : true; ok = r !== null && r !== false && r !== 0; } catch (e) { console.error(e); ok = false; }
        st.ok = ok;
        if (st.page) A.state.page = st.page;
        RUN.i++;
        done.set(ok ? RUN.i : RUN.i - 1);
        dockPaint(); A.renderPage();
        if (!ok) {
          RUNNING = false; PAUSED = false;
          A.toast('ما قدرتش أنفذ الخطوة «' + st.title + '»');
          return;
        }
        A.toast('✅ ' + st.title);
        focusStep();
        wait(POST_MS, next);
      });
    }
    next();
  }
  function clearDemo(key) {
    A.allEntries().forEach(function (e) { if (e.demo === key) A.removeEntry(e.id); });
    ['invoices', 'vouchers', 'assets'].forEach(function (k) {
      var before = A.DB[k].length;
      A.DB[k] = A.DB[k].filter(function (x) { return x.demo !== key; });
      if (A.DB[k].length !== before) A.saveDB(k);
    });
    runsFor(key).set(0);
    A.afterChange();
  }
  function demoCount(key) {
    var n = A.allEntries().filter(function (e) { return e.demo === key; }).length;
    ['invoices', 'vouchers', 'assets'].forEach(function (k) { n += A.DB[k].filter(function (x) { return x.demo === key; }).length; });
    return n;
  }

  /* ------------------------------------------------------------------ التصحيح
     المقارنة بالأرصدة: نجمع أرصدة حسابات الحل (مدين − دائن) ونقارنها بالنموذج.
     قيود الطالب اللي اتعملت قبل بداية الامتحان ما تتحسبش، عشان الشيت يبقى نظيف. */
  function grade(expected) {
    var from = (ST.exam && ST.exam.startedAt) || 0;
    /* بنستبعد قيود «توزيع الحل» من التصحيح: دي قيود عرض جاهزة مش حل الطالب */
    var es = A.allEntries().filter(function (e) { return !e.demo && (+e.id || 0) >= from; });
    var bal = {}, td = 0, tc = 0;
    es.forEach(function (e) {
      (e.debits || []).forEach(function (x) { bal[x.a] = (bal[x.a] || 0) + (+x.m || 0); td += +x.m || 0; });
      (e.credits || []).forEach(function (x) { bal[x.a] = (bal[x.a] || 0) - (+x.m || 0); tc += +x.m || 0; });
    });
    var rows = expected.map(function (g) {
      var act = 0; g.keys.forEach(function (k) { if (bal[k] != null) act += bal[k]; });
      var diff = R2(act - g.b), tol = 0.5 + Math.abs(g.b) * 0.001;
      return { label: g.label, act: R2(act), exp: R2(g.b), diff: diff, ok: Math.abs(diff) <= tol };
    });
    var okN = rows.filter(function (r) { return r.ok; }).length;
    return { rows: rows, okN: okN, total: rows.length, score: Math.round(okN / Math.max(1, rows.length) * 100), nEntries: es.length, balanced: Math.abs(td - tc) < 0.005, td: R2(td), tc: R2(tc) };
  }
  function sideTxt(v) { return v === 0 ? '—' : N(Math.abs(v)) + (v > 0 ? ' مدين' : ' دائن'); }
  function resultHtml(res) {
    var tone = res.score >= 85 ? 'g' : res.score >= 60 ? 'o' : 'r';
    return '<div class="pm-card"><h3>🎯 نتيجة التصحيح</h3><div class="pm-kpi">' +
      '<div class="pm-k ' + tone + '"><small>الدرجة</small><b>' + res.score + '%</b></div>' +
      '<div class="pm-k ' + (res.score === 100 ? 'g' : 'o') + '"><small>بنود صحيحة</small><b>' + res.okN + ' / ' + res.total + '</b></div>' +
      '<div class="pm-k"><small>قيودك بعد بداية الامتحان</small><b>' + res.nEntries + '</b></div>' +
      '<div class="pm-k ' + (res.balanced ? 'g' : 'r') + '"><small>اتزان قيودك</small><b>' + (res.balanced ? 'متزن ✅' : 'غير متزن ❌') + '</b></div></div>' +
      '<p class="pm-note">' + (res.score === 100 ? 'إجابة كاملة ✅ كل الأرصدة مطابقة للنموذج.' : res.score >= 60 ? 'قريب جدًا — راجع البنود الحمراء تحت وعدّل قيودك ثم صحّح تاني.' : 'راجع القيود خطوة بخطوة من صفحة «قيد يومية» أو فواتير الشراء والبيع، وبعدها صحّح تاني.') + '</p>' +
      grid(['البند', 'إجابتك', 'النموذج', 'الفرق', 'الحالة'], res.rows.map(function (r) {
        return [r.label, sideTxt(r.act), sideTxt(r.exp), R2(r.diff) === 0 ? '—' : N(Math.abs(r.diff)) + (r.diff > 0 ? ' زيادة مدين' : ' زيادة دائن'), { h: r.ok ? '<span class="pm-badge ok">صحيح</span>' : '<span class="pm-badge e">خطأ</span>' }];
      })) + '</div>';
  }

  /* ------------------------------------------------------------------ واجهة الصفحة */
  function pExer() {
    var lv = ST.level || 1, cur = ST.caseId ? caseById(ST.caseId) : null;
    var tabs = LV.map(function (l) { return '<button class="pm-b ' + (l.id === lv ? 'p' : 'o') + '" data-act="exLevel" data-id="' + l.id + '">' + l.name + '</button>'; }).join('');
    var list = CASES.filter(function (c) { return c.level === lv; }).map(function (c) {
      return '<button class="pm-smp" data-act="exOpen" data-id="' + c.id + '"><span><b>🧪 ' + doc(c.name) + '</b><small>' + doc(c.brief) + '</small></span><span class="pm-smpst">' + (c.steps.length ? c.steps.length + ' خطوة' : 'عرض وحل') + '</span></button>';
    }).join('');
    var head = '<div class="pm-card"><h3>🧠 تمارين وحلول من المنصة</h3><p class="pm-note">كل تمرين فيه: <b>البيان</b> (السؤال والعمليات) ثم <b>الحل</b> خطوة بخطوة. زرار «توزيع الحل على المنصة» بيعيد تنفيذ الحل قدامك بالترتيب وكل عملية تروح لمكانها الصح (قيد/أصل/فاتورة/سند/ضريبة) — متاح للمستوى المبتدئ والمتوسط. وزرار «جرّب نفسك» بيسيبك تحل بنفسك ويصحّح لك ويعطيك درجة.</p>' +
      '<div class="pm-tabs">' + tabs + '</div><div style="margin-bottom:10px"><span class="pm-badge ' + (lv === 3 ? 'w' : 'ok') + '">' + doc((LV.find(function (x) { return x.id === lv; }) || {}).d || '') + '</span></div>' + list + '</div>';
    var coRes = ST.result && ST.result.kind === 'company' ? ST.result : null;
    var coCard = coRes ? '<div class="pm-card"><div class="pm-h"><h3 style="margin:0">🎯 نتيجة امتحان شيت: ' + doc(coRes.name || '') + '</h3><button class="pm-b o" data-act="exGoCo" data-id="' + doc(coRes.id) + '">↩ رجوع للشيت</button></div>' + resultHtml(coRes) + '</div>' : '';
    if (!cur) return head + coCard + '<div class="pm-card">اختر تمرينًا من القائمة لعرض البيان والحل.</div>';

    var canDist = cur.level !== 3 && cur.steps.length > 0;
    var run = runsFor(cur.id), doneN = Math.min(run.get(), cur.steps.length);
    var hasDemo = demoCount(cur.id) > 0;
    var stepsRows = cur.steps.map(function (s, i) {
      return [String(i + 1), s.title, { h: '<span style="font-size:11.5px;white-space:normal;display:block;min-width:230px;max-width:360px;line-height:1.7">' + doc(s.stmt || '—') + '</span>' }, { h: (s.page ? '<span class="pm-badge">' + doc(pageName(s.page)) + '</span>' : '') }, { h: i < doneN ? '<span class="pm-badge ok">تم</span>' : '<span class="pm-badge w">بانتظار التوزيع</span>' }];
    });
    var exam = ST.exam && ST.exam.kind === 'case' && ST.exam.id === cur.id ? ST.exam : null;
    var res = ST.result && ST.result.id === cur.id && ST.result.kind === 'case' ? ST.result : null;

    return head + coCard +
      '<div class="pm-card"><div class="pm-h"><h3 style="margin:0">📋 بيان التمرين — ' + doc(cur.name) + '</h3><span class="pm-badge ok">' + (LV.find(function (x) { return x.id === cur.level; }) || {}).name + '</span></div>' +
      '<p class="pm-note" style="font-size:13px">' + doc(cur.brief) + '</p>' +
      '<div class="pm-prev"><b>العمليات / البيانات:</b><br>' + cur.data.map(function (x) { return doc(x); }).join('<br>') + '</div>' +
      '<div class="pm-prev" style="margin-top:8px;border-style:solid"><b>المطلوب:</b><br>' + cur.required.map(function (x, i) { return (i + 1) + ') ' + doc(x); }).join('<br>') + '</div>' +
      '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">' +
      (canDist ? '<button class="pm-b g" data-act="exRun" data-id="' + cur.id + '">🎬 توزيع الحل على المنصة</button>' : '<button class="pm-b" disabled style="opacity:.45;cursor:not-allowed">🎬 التوزيع للمستوى المبتدئ والمتوسط فقط</button>') +
      '<button class="pm-b p" data-act="exExam" data-id="' + cur.id + '">🧠 جرّب نفسك</button>' +
      '<button class="pm-b o" data-act="exSol" data-id="' + cur.id + '">' + (ST.sol ? '🙈 إخفاء الحل' : '📖 إظهار الحل') + '</button>' +
      (hasDemo ? '<button class="pm-b r" data-act="exClear" data-id="' + cur.id + '">🧹 مسح أثر التوزيع من الشيت</button>' : '') +
      '</div><p class="pm-note" style="margin-top:8px">الترحيل الحالي في: <b>' + (A.journal() === 'pro' ? '📒 دفتر اليومية المهني' : '🎓 المنصة الأكاديمية') + '</b> — تقدر تغيّره من الإعدادات، والتصحيح بيقرأ من الدفترين.</p></div>' +
      (cur.steps.length ? '<div class="pm-card"><h3>🎬 خريطة توزيع الحل (' + doneN + '/' + cur.steps.length + ')</h3>' + grid(['#', 'الخطوة', 'القيد المتوقع', 'الشاشة', 'الحالة'], stepsRows) + '</div>' : '') +
      (exam ? examCard(cur, exam) : '') +
      (res ? resultHtml(res) : '') +
      (ST.sol ? solutionCard(cur) : '');
  }
  function pageName(p) {
    return ({ jv: 'قيد يومية', assets: 'الأصول والإهلاكات', sale: 'فاتورة بيع', purchase: 'فاتورة شراء', receipt: 'سند قبض', payment: 'سند صرف', tax: 'الضريبة', rtrial: 'ميزان المراجعة', rjournal: 'دفتر اليومية', company: 'شيتات الشركات', cstock: 'المخازن' })[p] || p;
  }
  function solutionCard(c) {
    var rows = c.expected.map(function (g) { return [g.label, sideTxt(g.b)]; });
    return '<div class="pm-card"><h3>📖 الحل النموذجي — ' + doc(c.name) + '</h3>' +
      c.solution.map(function (x, i) { return '<p style="margin:0 0 8px;line-height:1.9"><b>' + (i + 1) + ')</b> ' + doc(x) + '</p>'; }).join('') +
      '<h3 style="margin-top:14px;font-size:14.5px">أرصدة الحل بعد كل القيود</h3>' +
      grid(['بند الحل', 'الرصيد النهائي'], rows) +
      (c.level === 3 ? '<p class="pm-note">المستوى المتقدم للحل والمقارنة فقط؛ التوزيع التلقائي مقصور على المبتدئ والمتوسط.</p>' : '') + '</div>';
  }
  function examCard(c, exam) {
    var secs = Math.max(0, Math.round((Date.now() - exam.startedAt) / 1000)), mm = Math.floor(secs / 60), ss = secs % 60;
    return '<div class="pm-card" style="border:2px solid #6d1f9c"><div class="pm-h"><h3 style="margin:0">🧠 وضع «جرّب نفسك» — ' + doc(c.name) + '</h3><span class="pm-badge ok">المدة ' + mm + ':' + ('0' + ss).slice(-2) + '</span></div>' +
      '<p class="pm-note">حل التمرين على المنصة: الدوّالة الصغيرة تحت بتعرض «بيان القيد» خطوة بخطوة — سجّل كل قيد من «قيد يومية» أو الفواتير والسندات، وهيقلب تلقائيًا للي بعده. أي قيد قبل بداية الامتحان ما يتحسبش، وقيود «توزيع الحل» التجريبية محمية ومستبعدة من الدرجة. لما تخلص اضغط «تصحيح إجابتي».</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="pm-b p" data-act="exGrade">🎯 تصحيح إجابتي</button><button class="pm-b o" data-act="exSol">📖 إظهار الحل</button><button class="pm-b r" data-act="exExitExam">✖ إنهاء الامتحان</button></div></div>';
  }

  /* ------------------------------------------------------------------ أفعال الصفحة */
  /* لو الطالب فاتح امتحان وطلب يشوف توزيع الحل، بنسأله ونلغي الامتحان
     عشان قيود العرض ما تتحسبش درجات. بترجع true لو تمام نكمل. */
  function closeExamForDemo() {
    if (!confirm('فيه امتحان مفتوح. عشان نعرض توزيع الحل هنقفل الامتحان الحالي (ومش هيتحسب درجة). نكمل؟')) return false;
    ST.exam = null; ST.result = null; saveST(); hideDock();
    return true;
  }
  var ACTS = {
    exerOpen: function () { ST.caseId = null; saveST(); A.go('exer'); },
    exLevel: function (a) { ST.level = +a.dataset.id || 1; ST.caseId = null; saveST(); A.renderPage(); },
    exOpen: function (a) { ST.caseId = a.dataset.id; ST.sol = false; ST.result = null; saveST(); A.renderPage(); },
    exSol: function () { ST.sol = !ST.sol; saveST(); A.renderPage(); },
    exRun: function (a) {
      var c = caseById(a.dataset.id); if (!c || !c.steps.length) return alert('الحل التفاعلي متاح للمستوى المبتدئ والمتوسط فقط.');
      if (c.level === 3) return alert('التوزيع التلقائي للمستوى المبتدئ والمتوسط فقط. المستوى المتقدم = بيان وحل و«جرّب نفسك».');
      /* توزيع الحل أثناء امتحان مفتوح كان هيحسب قيود العرض كأنها حل الطالب، فبنقفل الامتحان الأول */
      if (ST.exam && !closeExamForDemo()) return;
      var done = runsFor(c.id).get();
      if (done && !confirm('فيه خطوات اتوزعت قبل كده على هذا الشيت. نحذف أثرها ونعيد التوزيع من الأول؟\n(لو موافق هنمسح القيود والمستندات اللي أنشأها التوزيع فقط)')) return;
      if (done) clearDemo(c.id);
      A.toast('هنبدأ توزيع الحل خطوة بخطوة 🎬');
      runSteps(c.id, c.steps, c.name);
    },
    exClear: function (a) {
      var c = caseById(a.dataset.id); if (!c) return;
      if (!confirm('هيتم مسح القيود والمستندات اللي أنشأها «توزيع الحل» لهذا التمرين من الشيت الحالي فقط. متابعة؟')) return;
      clearDemo(c.id); A.toast('تم مسح أثر التوزيع ✅');
    },
    exExam: function (a) {
      var c = caseById(a.dataset.id); if (!c) return;
      if (ST.exam && !confirm('فيه امتحان مفتوح بالفعل. نبدأ امتحان جديد ونلغي القديم؟')) return;
      ST.exam = { kind: 'case', id: c.id, name: c.name, startedAt: Date.now() };
      ST.result = null; EXW.i = 0; saveST(); A.state.page = 'jv'; A.renderPage(); ensureDock(); A.toast('بدأ وضع «جرّب نفسك» — بيان القيد الأول ظاهر في الدوّالة، سجّله على المنصة');
    },
    exGrade: function () { gradeNow(); },
    exExitExam: function () { if (!confirm('إنهاء وضع الامتحان؟ (قيودك هتفضل في الشيت)')) return; ST.exam = null; saveST(); hideDock(); A.renderPage(); },
    exGoCo: function (a) { A.state.cs = { id: a.dataset.id, tab: 'tb' }; A.state.page = 'company'; A.renderPage(); },
    /* شيتات الشركات */
    coDistribute: function () {
      var co = A.DB.companies.find(function (c) { return c.id === A.state.cs.id; }); if (!co) return;
      var lv = +co.level || 0;
      if (lv !== 1 && lv !== 2) return alert('توزيع الحل متاح لشيتات المستوى المبتدئ والمتوسط فقط.\nحدد مستوى الشيت من الكارت العلوي لو الشيت مرفوع يدويًا.');
      if (ST.exam && !closeExamForDemo()) return;
      var key = 'co:' + co.id, done = runsFor(key).get();
      if (done && !confirm('فيه توزيع سابق لهذا الشيت. نمسح أثره ونعيد من الأول؟')) return;
      if (done) clearDemo(key);
      var steps = companySteps(co, key);
      if (!steps.length) return alert('الشيت مفيهوش أرصدة كافية للتوزيع.');
      runSteps(key, steps, co.name);
    },
    coExam: function () {
      var co = A.DB.companies.find(function (c) { return c.id === A.state.cs.id; }); if (!co) return;
      if (ST.exam && !confirm('فيه امتحان مفتوح بالفعل. نبدأ امتحان الشيت ونلغي القديم؟')) return;
      var exp = co.rows.filter(function (r) { return R2((+r.d || 0) - (+r.c || 0)) !== 0; }).map(function (r) { return { label: r.a, keys: [r.a], b: R2((+r.d || 0) - (+r.c || 0)) }; });
      if (!exp.length) return alert('الشيت مفيهوش أرصدة.');
      ST.exam = { kind: 'company', id: co.id, name: co.name, startedAt: Date.now(), expected: exp };
      ST.result = null; EXW.i = 0; saveST(); A.state.page = 'jv'; A.renderPage(); ensureDock();
      A.toast('بدأ امتحان شيت «' + co.name + '» — أول خطوة ظاهرة في الدوّالة');
    }
  };

  /* ------------------------------------------------------------------ خطة توزيع شيت الشركة
     شيت الشركة عبارة عن ميزان مراجعة (أرصدة)، لذلك التوزيع بيشرح مسار الحل:
     قيد افتتاحي ← تسجيل الأصول ← المخازن ← الضريبة ← القوائم المالية ← الإقفال. */
  function companySteps(co, key) {
    var rows = co.rows, steps = [];
    steps.push({
      page: 'jv', title: 'قيد افتتاحي مجمّع لكل أرصدة الشيت',
      why: 'نفس بداية حل أي شيت: نفتح الحسابات بأرصدتها، والمجموع مدين = مجموع دائن.',
      stmt: 'قيد افتتاحي مركّب: من كل حساب مدين برصيده إلى كل حساب دائن برصيده',
      eff: 'كل حساب في الشيت بقى له رصيد مفتوح في دفتر الأستاذ، والميزان فضل متزن بالشكل اللي هو متزن بيه.',
      ask: 'سجّل قيدًا افتتاحيًا يفتح كل أرصدة ميزان المراجعة الظاهرة في بيان السؤال.',
      run: function () {
        var D = [], C = [];
        rows.forEach(function (r) { var b = R2((+r.d || 0) - (+r.c || 0)); if (!b) return; A.ensureAcc(r.a, r.t); (b > 0 ? D : C).push([r.a, Math.abs(b)]); });
        return A.postEntry('قيد افتتاحي — ' + co.name, D, C, Y + '-01-01', { src: 'pro-open', demo: key });
      }
    });
    var contras = rows.filter(function (r) { return r.t === 'A' && /مجمع|مخصص/.test(r.a); });
    var fixed = rows.filter(function (r) { return r.t === 'A' && !/مجمع|مخصص/.test(r.a) && (/^12/.test(r.code || '') || /سيار|معدات|أثاث|آلات|مباني|أراضي|أجهزة|تجهيزات/.test(r.a)); });
    if (fixed.length) steps.push({
      page: 'assets', title: 'تسجيل الأصول الثابتة في سجل الأصول (' + fixed.length + ')',
      why: 'كل أصل ثابت بياخد كارت في «الأصول والإهلاكات» عشان يتبني له جدول إهلاك للسنوات الجاية، والقيمة الافتتاحية = صافي القيمة الدفترية.',
      stmt: 'كارت أصل لكل أصل ثابت: بالتكلفة ناقص مجمع الإهلاك (صافي القيمة الدفترية)',
      eff: fixed.length + ' كارت أصل اتفتحت في سجل الأصول — جاهزة يتنفذ عليها إهلاك أي سنة جاية بضغطة واحدة.',
      ask: 'سجّل الأصول الثابتة في «الأصول والإهلاكات» بصافي قيمتها الدفترية (التكلفة − مجمع الإهلاك).',
      run: function () {
        fixed.forEach(function (r) {
          var accB = R2((+r.d || 0) - (+r.c || 0));
          var accRow = contras.find(function (x) { return r.a.indexOf(x.a.replace(/^مجمع إهلاك\s*/, '')) >= 0 || x.a.indexOf(r.a) >= 0; });
          var accDep = accRow ? Math.abs(R2((+accRow.d || 0) - (+accRow.c || 0))) : 0;
          var net = Math.max(1, R2(Math.abs(accB)) - accDep);
          A.addAssetRec({ name: r.a, start: Y + '-01-01', cost: net, salvage: 0, life: 5, method: 'sl', demo: key });
        });
        return true;
      }
    });
    var invRows = rows.filter(function (r) { return /مخزون/.test(r.a); });
    if (invRows.length) steps.push({
      page: 'cstock', title: 'مراجعة المخزون الافتتاحي في المخازن (' + invRows.length + ' حساب)',
      why: 'أرصدة المخزون اتفتحت في القيد الافتتاحي؛ من هنا تبدأ حركات الوارد والصادر وأوامر التشغيل.',
      stmt: 'فتح شاشة المخازن ومراجعة أرصدة المخزون الافتتاحية',
      eff: 'المخزون ظهر كرصيد افتتاحي في الأستاذ، وجاهز لأي حركة وارد أو صادر على النظام.',
      ask: 'راجع أرصدة المخزون الافتتاحية في شاشة «المخازن».',
      run: function () { return true; }
    });
    var vatRows = rows.filter(function (r) { return /ضريبة/.test(r.a); });
    if (vatRows.length) steps.push({
      page: 'tax', title: 'مراجعة أرصدة الضريبة في الإقرار (' + vatRows.length + ' حساب)',
      why: 'ضريبة المبيعات التزام وضريبة المشتريات أصل؛ الإقرار بيجمعهم ويظهر الصافي المستحق أو القابل للاسترداد.',
      stmt: 'فتح إقرار القيمة المضافة ومراجعة أرصدة الضريبة',
      eff: 'الإقرار بيحسب تلقائي: مخرجات − مدخلات = الصافي المستحق للمصلحة أو القابل للاسترداد لنا.',
      ask: 'راجع أرصدة ضريبة القيمة المضافة في إقرار الضريبة.',
      run: function () { return true; }
    });
    steps.push({
      page: 'rtrial', title: 'ميزان المراجعة — التحقق من الاتزان',
      why: 'بعد قيد الافتتاح لازم يطلع ميزان متزن؛ لو مش متزن يبقى فيه رصيد غلط في الشيت.',
      stmt: 'فتح ميزان المراجعة والتأكد أن إجمالي مدين = إجمالي دائن',
      eff: 'الميزان اتأكدنا منه — كل حساب ظهر برصيده الصحيح مدين أو دائن.',
      ask: 'أعد ميزان المراجعة وتأكد أن إجمالي المدين = إجمالي الدائن.',
      run: function () { return true; }
    });
    steps.push({
      page: 'company', title: 'قائمة الدخل — ناتج النشاط',
      why: 'الإيرادات − المصروفات = صافي الربح أو الخسارة، وده بيدخل في حقوق الملكية بعدين.',
      stmt: 'عرض قائمة الدخل: الإيرادات − المصروفات = صافي الربح/الخسارة',
      eff: 'ظهر ناتج النشاط من الأرصدة المفتوحة — وهو نفس النتيجة اللي هتتقفل في حقوق الملكية.',
      ask: 'أعد قائمة الدخل وحدد صافي الربح أو الخسارة.',
      run: function () { A.state.cs = { id: co.id, tab: 'is' }; return true; }
    });
    steps.push({
      page: 'company', title: 'قيود الإقفال — ترحيل النتيجة للحقوق',
      why: 'إقفال الإيرادات والمصروفات في ملخص الدخل ثم تحويل النتيجة لحقوق الملكية.',
      stmt: 'قائمة الإقفال: إقفال الإيرادات والمصروفات وتحويل النتيجة إلى حقوق الملكية',
      eff: 'الإيرادات والمصروفات اترحلت لملخص الدخل، والنتيجة أصبحت جزءًا من حقوق الملكية في المركز المالي.',
      ask: 'أعد قيود الإقفال ورحّل نتيجة النشاط إلى حقوق الملكية.',
      run: function () { A.state.cs = { id: co.id, tab: 'cl' }; return true; }
    });
    return steps;
  }

  /* ------------------------------------------------------------------ الامتحان: دولاب عائم
     أثناء «جرّب نفسك» الدوّالة بتعرض «بيان العملية من السؤال» خطوة بخطوة قدام الطالب
     (مثال: «إيداع رأس المال النقدي في خزينة المحل 200,000») — من غير شكل القيد ولا الحل،
     وبعد ما يسجل العملية على المنصة بينتقل للي بعدها تلقائيًا (أو بزرارين «التالي/السابق»). */
  var EXW = { i: 0 };
  /* أسماء الأقسام اللي بيستخدمها زرار «التلميح»: بيقول للطالب العملية دي بتتسجل فين بالظبط على المنصة */
  var PAGE_SEC = {
    jv: 'المحاسبة المالية ← «قيد اليومية» (قيد يدوي)',
    sale: '«فاتورة بيع»',
    purchase: '«فاتورة شراء»',
    receipt: '«سند قبض»',
    payment: '«سند صرف»',
    assets: '«الأصول والإهلاكات»',
    tax: '«الضريبة» ← إقرار القيمة المضافة',
    cstock: '«المخازن»',
    contracts: 'المنشآت المتخصصة ← «عقود المقاولات والمستخلصات»',
    rtrial: '«ميزان المراجعة» (للمراجعة فقط)',
    company: '«شيتات الشركات» ← القوائم وقيود الإقفال'
  };
  function examWalkSteps() {
    var ex = ST.exam; if (!ex) return [];
    if (ex.kind === 'company') {
      var co = A.DB.companies.find(function (c) { return c.id === ex.id; });
      return co ? companySteps(co, 'co:' + co.id).map(function (s) { return { ask: s.ask, page: s.page }; }) : [];
    }
    var c = caseById(ex.id); if (!c) return [];
    /* خطوات التمرين عندها بيان المطلوب (ask) والقسم (page)؛ المستوى المتقدم (بدون خطوات) بنمشي على عمليات البيان نفسها */
    if (c.steps.length) return c.steps.map(function (s) { return { ask: s.ask, page: s.page }; });
    return c.data.map(function (x, i) { return { ask: x, page: (c.dataPages || [])[i] || 'jv' }; });
  }
  /* تحريك الدوّالة بحرية: السحب من شريط العنوان، ومكانها بيتحفظ عشان ترجع في نفس المكان حتى بعد التحديث */
  var POS_KEY = 'pmx_dock_pos';
  function applyDockPos(b) {
    try {
      var p = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
      if (p && isFinite(p.left) && isFinite(p.top)) { b.style.left = p.left + 'px'; b.style.top = p.top + 'px'; b.style.bottom = 'auto'; }
    } catch (e) { }
  }
  function initDockDrag(b) {
    var t = null, sx = 0, sy = 0, sl = 0, st = 0;
    b.addEventListener('pointerdown', function (ev) {
      if (!ev.target.closest('.pmx-t') || ev.target.closest('button')) return;
      var r = b.getBoundingClientRect(); t = ev.pointerId; sx = ev.clientX; sy = ev.clientY; sl = r.left; st = r.top;
      try { b.setPointerCapture(ev.pointerId); } catch (e) { }
      ev.preventDefault();
    });
    b.addEventListener('pointermove', function (ev) {
      if (t == null || ev.pointerId !== t) return;
      var W = window.innerWidth, H = window.innerHeight, r = b.getBoundingClientRect();
      /* منعها تخرج بره الشاشة تمامًا — لازم يفضل جزء منها باين عشان تقدر تمسكها تاني */
      var nl = Math.min(Math.max(sl + ev.clientX - sx, 40 - r.width), W - 40);
      var nt = Math.min(Math.max(st + ev.clientY - sy, 0), H - 48);
      b.style.left = nl + 'px'; b.style.top = nt + 'px'; b.style.bottom = 'auto';
    });
    var up = function (ev) {
      if (t == null || (ev.pointerId != null && ev.pointerId !== t)) return;
      t = null;
      try { localStorage.setItem(POS_KEY, JSON.stringify({ left: parseFloat(b.style.left) || 0, top: parseFloat(b.style.top) || 0 })); } catch (e) { }
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
  }
  function dockBox() {
    var b = document.getElementById('pmxDock');
    if (!b) {
      b = document.createElement('div'); b.id = 'pmxDock'; b.setAttribute('dir', 'rtl');
      document.body.appendChild(b);
      applyDockPos(b);
      initDockDrag(b);
      b.addEventListener('click', function (ev) {
        var t = ev.target.closest('[data-x]'); if (!t) return;
        var k = t.dataset.x;
        if (k === 'grade') gradeNow();
        else if (k === 'pause') togglePause();
        else if (k === 'stop') stopRun();
        else if (k === 'page') A.go('exer');
        else if (k === 'sol') { ST.sol = true; saveST(); A.go('exer'); }
        else if (k === 'exit') { ST.exam = null; saveST(); hideDock(); A.renderPage(); }
        /* التلميح: بيظهر القسم المقترح لتسجيل العملية أول ما الطالب يضغط عليه بس، وبيختفي بضغطة تانية */
        else if (k === 'hint') {
          var h = document.getElementById('pmxHint'); if (!h) return;
          if (h.style.display !== 'none') { h.style.display = 'none'; return; }
          var st2 = examWalkSteps(), cu2 = st2[EXW.i] || {};
          h.innerHTML = '<span class="pmx-lb">📍 القسم:</span> ' + doc(PAGE_SEC[cu2.page] || 'قيد يدوي في «قيد اليومية»');
          h.style.display = 'block';
        }
        /* تنقّل في بيانات القيود أثناء الامتحان */
        else if (k === 'next') { var sn = examWalkSteps(); if (EXW.i < sn.length - 1) { EXW.i++; ensureDock(); } }
        else if (k === 'prev') { if (EXW.i > 0) { EXW.i--; ensureDock(); } }
      });
    }
    return b;
  }
  function ensureDock() {
    var b = dockBox(), ex = ST.exam;
    if (!ex) { hideDock(); return; }
    var steps = examWalkSteps(), total = steps.length;
    if (EXW.i > total - 1) EXW.i = Math.max(0, total - 1);
    var cur = total ? steps[EXW.i] : null;
    b.classList.add('on');
    b.innerHTML = '<div class="pmx-t"><b>🧠 جرّب نفسك — ' + doc(ex.name || (caseById(ex.id) || {}).name || '') + '</b><span>' + (total ? 'العملية ' + (EXW.i + 1) + ' من ' + total + ' — سجّل قيدها على المنصة' : 'حل على المنصة ثم اضغط تصحيح') + '</span></div>' +
      (cur ? '<div class="pmx-why">' + (cur.ask ? '<span class="pmx-lb">📋 المطلوب:</span> ' + doc(cur.ask) : '') + '</div>' +
        '<div class="pmx-hint" id="pmxHint" style="display:none"></div>' +
        '<div class="pmx-p"><div style="width:' + Math.round((EXW.i + 1) / Math.max(1, total) * 100) + '%"></div></div>' +
        '<div class="pmx-b">' + (EXW.i > 0 ? '<button data-x="prev">◀ السابق</button>' : '') + (EXW.i < total - 1 ? '<button data-x="next">التالي ▶</button>' : '<span class="pm-badge ok" style="align-self:center">آخر عملية — صحّح إجابتك 🎯</span>') + '<button data-x="hint">💡 فين أسجّلها؟</button></div>' : '') +
      '<div class="pmx-b"><button data-x="grade">🎯 تصحيح إجابتي</button><button data-x="sol">📖 الحل</button><button data-x="page">📋 البيان</button><button data-x="exit">✖</button></div>';
  }
  /* أي قيد جديد يترحّل أثناء الامتحان (من قيد يومية) يقلّب الدوّالة على البيان اللي بعده */
  window.__PMX_POSTED = function () {
    if (!ST.exam || RUNNING) return;
    var steps = examWalkSteps();
    if (EXW.i < steps.length - 1) { EXW.i++; ensureDock(); }
  };
  /* تصفير عدّادات التوزيع: لمفتاح واحد (بعد مسح أثر شركة) أو لكل الشيت (بعد المسح الكامل) */
  window.__PMX_RESET_RUN = function (key) { try { runsFor(key).set(0); } catch (e) { } };
  window.__PMX_RESET_RUNS = function () {
    try {
      var all = JSON.parse(localStorage.getItem('pro_exRuns') || '{}'), sc = A.scope();
      if (all[sc]) { delete all[sc]; localStorage.setItem('pro_exRuns', JSON.stringify(all)); }
    } catch (e) { }
  };
  function hideDock() { var b = document.getElementById('pmxDock'); if (b) { b.classList.remove('on'); b.innerHTML = ''; } }

  /* تصحيح الامتحان الحالي (حالة أو شيت شركة) */
  function gradeNow() {
    var ex = ST.exam; if (!ex) return alert('مفيش امتحان مفتوح. اضغط «جرّب نفسك» الأول.');
    var exp = ex.expected;
    if (!exp) {
      var c = caseById(ex.id); if (!c) return alert('التمرين غير موجود.');
      exp = c.expected;
    }
    var res = grade(exp);
    ST.result = Object.assign({ id: ex.id, kind: ex.kind, at: Date.now(), name: ex.name }, res);
    /* نضبط اللي هيظهر في صفحة التمارين: حالة الشركة نعرض نتيجتها فوق القائمة، والتمرين نفتح بيانه */
    if (ex.kind === 'company') { ST.caseId = null; ST.sol = false; } else { ST.caseId = ex.id; }
    saveST();
    var b = dockBox(); if (b && b.classList.contains('on')) {
      b.innerHTML = '<div class="pmx-t"><b>🎯 نتيجتك: ' + res.score + '%</b><span>' + res.okN + ' من ' + res.total + ' بند صحيح' + (res.balanced ? ' — قيودك متزنة ✅' : ' — قيودك غير متزنة ❌') + '</span></div>' +
        '<div class="pmx-b"><button data-x="page">📋 التفاصيل</button><button data-x="grade">🔄 صحّح تاني</button><button data-x="exit">✖ إنهاء</button></div>';
    }
    A.go('exer');
    A.toast('درجتك ' + res.score + '% — ' + res.okN + '/' + res.total);
  }

  /* ------------------------------------------------------------------ تنسيقات */
  var css = document.createElement('style'); css.id = 'pmxCss';
  css.textContent = '#pmxDock{position:fixed;left:16px;bottom:16px;z-index:9600;display:none;background:#2d1245;color:#fff;border-radius:14px;padding:12px 14px;box-shadow:0 10px 30px rgba(0,0,0,.35);min-width:270px;max-width:360px;direction:rtl;font-size:13px}' +
    '#pmxDock.on{display:block}#pmxDock b{font-size:13.5px;display:block}#pmxDock span{display:block;opacity:.75;font-size:11.5px;margin-top:2px}' +
    '#pmxDock .pmx-b{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}#pmxDock button{border:0;border-radius:8px;padding:6px 10px;font:inherit;font-size:12px;font-weight:700;cursor:pointer;background:#f4eefb;color:#43126a}' +
    '#pmxDock .pmx-p{background:rgba(255,255,255,.2);border-radius:999px;height:6px;margin-top:8px;overflow:hidden}#pmxDock .pmx-p div{height:100%;background:#8ee59b;transition:width .3s}' +
    /* شرح الخطوة جوه الدوّالة + وميض على الكارت اللي اتغيّر */
    '#pmxDock .pmx-why{margin-top:7px;background:rgba(255,255,255,.09);border-radius:9px;padding:7px 9px;font-size:12px;line-height:1.7}#pmxDock .pmx-why b{display:inline;font-size:12.5px}#pmxDock .pmx-why br{display:block;content:"";margin-top:3px}' +
    /* عناوين أجزاء الشرح جوه الدوّالة: القيد / الهدف / التأثير / بيان القيد */
    '#pmxDock .pmx-lb{font-weight:800;color:#ffd97a;font-size:11.5px}' +
    '#pmxDock .pmx-t{cursor:move;user-select:none;-webkit-user-select:none}' +
    '#pmxDock .pmx-hint{display:none;margin-top:7px;background:rgba(255,217,122,.13);border:1px dashed rgba(255,217,122,.55);border-radius:9px;padding:6px 9px;font-size:12px;line-height:1.7}' +
    '.pmx-hit{animation:pmxHit 1.6s ease;outline:2px solid #57c46a;outline-offset:2px;border-radius:12px}' +
    '@keyframes pmxHit{0%{box-shadow:0 0 0 0 rgba(87,196,106,0)}25%{box-shadow:0 0 0 7px rgba(87,196,106,.35)}100%{box-shadow:0 0 0 0 rgba(87,196,106,0)}}' +
    '@media print{#pmxDock{display:none!important}}';
  document.head.appendChild(css);

  /* تزامن الدوّالة مع كل إعادة رسم في مود الاحتراف (خطاف من pro-mode) */
  window.__PMX_RENDER = function () { if (RUNNING) return; if (ST.exam) ensureDock(); else hideDock(); };

  P.register({ pages: { exer: pExer }, acts: ACTS });
  if (ST.exam) ensureDock();
})();
