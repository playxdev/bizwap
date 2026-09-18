/* ============================================================
   Investment Decision Simulator — calculation model
   Pure functions. No DOM. Every formula the product uses lives here.
   ============================================================ */
(function (global) {
  "use strict";

  var DAYS_PER_MONTH = 30;

  /* ---------- default assumptions (Base Case) ---------- */
  var DEFAULTS = {
    // --- investment ---
    initialInvestment: 0,      // เงินก้อนที่ใส่ก่อนเริ่มเดือนที่ 1
    fixedCost: 67000,          // ทีม + ระบบ ต่อเดือน
    contentSpend: 4000,        // คอนเทนต์ / SEO ต่อเดือน
    adsTest: 3500,             // งบโฆษณาต่อเดือน ช่วงทดสอบ
    adsScale: 40000,           // งบโฆษณาต่อเดือน ช่วงขยาย
    months: 24,
    adsStartMonth: 4,
    launchMonth: 7,            // เดือนแรกที่ระบบเก็บเงินได้
    scaleMonth: 7,

    // --- business model ---
    packages: [
      { key: "perUse", label: "รายครั้ง", price: 5, freq: 6, share: 25 },
      { key: "daily", label: "รายวัน", price: 12, freq: 22, share: 40 },
      { key: "monthly", label: "รายเดือน", price: 159, freq: 1, share: 35 }
    ],
    collectionRate: 88,
    aisShare: 30,
    itShare: 35,
    itBase: "net",
    lifetimeDays: 120,

    // --- media ---
    cpm: 100,
    ctr: 1.6,
    leadRate: 8,
    leadToCustomer: 12,
    cvr: 6,

    // --- organic ---
    organicAtEnd: 600
  };

  /* ---------- แจกแจงต้นทุนคงที่ ----------
     รวมกันต้องเท่ากับ DEFAULTS.fixedCost ถ้าผู้ใช้เลื่อน slider
     จนไม่ตรง ใบสรุปจะบอกว่าเป็นค่าที่ปรับเอง ไม่ใช่ตัวเลขตามสัญญา */
  var FIXED_ITEMS = [
    { label: "Project Manager", scope: "ควบคุมระยะเวลา ถ่ายทอดลอจิกงาน และประสานงานเครือข่าย AIS", amount: 26000 },
    { label: "Senior Developer", scope: "Consultant วาง Architecture, คุมเรื่อง Security และตรวจ Code Review แกนหลัก", amount: 26000 },
    { label: "Infrastructure", scope: "Cloud Server, VPS, FrontEnd/BackEnd, Staging/Production", amount: 5000 },
    { label: "SEO, Coding Tools", scope: "เครื่องมือ Dev ที่ใช้ในการทำงาน", amount: 10000 }
  ];
  function fixedItemsTotal() {
    return FIXED_ITEMS.reduce(function (s, i) { return s + i.amount; }, 0);
  }

  /* ---------- where each assumption comes from ----------
     confirmed  : มาจากข้อมูลจริงของโครงการ
     estimate   : ประมาณการจากกรอบตลาด ยังไม่ได้วัดเอง
     validate   : ยังไม่มีข้อมูล ต้องวัดหลังเปิดบริการ           */
  var META = {
    initialInvestment: { conf: "confirmed" },
    fixedCost:      { conf: "confirmed", note: "งบประมาณจริงของโครงการ" },
    contentSpend:   { conf: "confirmed" },
    adsTest:        { conf: "confirmed" },
    adsScale:       { conf: "confirmed" },
    months:         { conf: "confirmed" },
    adsStartMonth:  { conf: "confirmed" },
    launchMonth:    { conf: "estimate", impact: true, note: "ขึ้นกับความคืบหน้าของทีมพัฒนา" },
    scaleMonth:     { conf: "confirmed" },
    collectionRate: { conf: "validate", impact: true, note: "ต้องวัดจากรายงานการเรียกเก็บจริง" },
    aisShare:       { conf: "confirmed", note: "โครงสร้างข้อตกลง" },
    itShare:        { conf: "confirmed", note: "โครงสร้างข้อตกลง" },
    lifetimeDays:   { conf: "validate", impact: true, note: "ยังไม่มีข้อมูล ต้องวัดหลังเปิดขาย" },
    organicAtEnd:   { conf: "validate", impact: true, note: "ประมาณการจากแผนคอนเทนต์" },
    cpm:            { conf: "estimate", note: "กรอบตลาดไทย ไม่ใช่บัญชีเรา" },
    ctr:            { conf: "estimate", note: "กรอบตลาดไทย ไม่ใช่บัญชีเรา" },
    cvr:            { conf: "validate", impact: true, note: "ต้องวัดจากหน้า Landing จริง" },
    leadRate:       { conf: "estimate" },
    leadToCustomer: { conf: "estimate" },
    packagePrice:   { conf: "estimate", note: "แผนผลิตภัณฑ์ ยังปรับได้" }
  };

  var CONF_LABEL = {
    confirmed: "CONFIRMED",
    estimate: "ESTIMATE",
    validate: "REQUIRES VALIDATION"
  };

  /* ---------- scenarios ---------- */
  /* ทุก scenario ต้องกำหนดคีย์ชุดเดียวกันให้ครบ
     ไม่งั้นการสลับไปมาจะทิ้งค่าของชุดก่อนหน้าไว้ปนกัน */
  var SCENARIOS = {
    conservative: { months: 24, cpm: 130, ctr: 0.9, cvr: 3, leadRate: 6, leadToCustomer: 8,
                    collectionRate: 75, lifetimeDays: 45, organicAtEnd: 80, adsScale: 12000,
                    packages: [
                      { key: "perUse", label: "รายครั้ง", price: 3, freq: 6, share: 50 },
                      { key: "daily", label: "รายวัน", price: 9, freq: 20, share: 35 },
                      { key: "monthly", label: "รายเดือน", price: 99, freq: 1, share: 15 }
                    ] },
    base:         { months: 8,  cpm: 100, ctr: 1.2, cvr: 4, leadRate: 8, leadToCustomer: 12,
                    collectionRate: 82, lifetimeDays: 60, organicAtEnd: 150, adsScale: 12000,
                    packages: [
                      { key: "perUse", label: "รายครั้ง", price: 3, freq: 6, share: 50 },
                      { key: "daily", label: "รายวัน", price: 9, freq: 20, share: 35 },
                      { key: "monthly", label: "รายเดือน", price: 99, freq: 1, share: 15 }
                    ] },
    aggressive:   { months: 24, cpm: 80,  ctr: 1.8, cvr: 6, leadRate: 11, leadToCustomer: 18,
                    collectionRate: 88, lifetimeDays: 90, organicAtEnd: 300, adsScale: 20000,
                    packages: [
                      { key: "perUse", label: "รายครั้ง", price: 3, freq: 6, share: 50 },
                      { key: "daily", label: "รายวัน", price: 9, freq: 20, share: 35 },
                      { key: "monthly", label: "รายเดือน", price: 99, freq: 1, share: 15 }
                    ] },
    // ระดับผลลัพธ์ขั้นต่ำที่ธุรกิจต้องบรรลุเพื่อคืนทุน — หาโดยไล่ปรับทีละคาน
    viable:       { months: 24, cpm: 100, ctr: 1.6, cvr: 6, leadRate: 8, leadToCustomer: 12,
                    collectionRate: 88, lifetimeDays: 120, organicAtEnd: 600, adsScale: 40000,
                    packages: [
                      { key: "perUse", label: "รายครั้ง", price: 5, freq: 6, share: 25 },
                      { key: "daily", label: "รายวัน", price: 12, freq: 22, share: 40 },
                      { key: "monthly", label: "รายเดือน", price: 159, freq: 1, share: 35 }
                    ] }
  };
  var SCENARIO_LABEL = {
    conservative: "Conservative", base: "Base Case",
    aggressive: "Aggressive", viable: "Viable Path"
  };
  var SCENARIO_NOTE = {
    conservative: "สมมติฐานระมัดระวัง",
    base: "สมมติฐานยังไม่ถึงจุดคืนทุน",
    aggressive: "สมมติฐานเชิงบวก",
    viable: "ค่าตั้งต้น — (จุดคืนทุน)"
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* คัดลอกค่าจาก scenario ทับ assumptions โดยไม่แชร์ reference ของ array */
  function applyScenario(a, key) {
    var out = clone(a), preset = SCENARIOS[key] || {};
    Object.keys(preset).forEach(function (k) { out[k] = clone(preset[k]); });
    return out;
  }
  function pct(x) { return x / 100; }
  function safeDiv(a, b) { return b > 0 ? a / b : NaN; }

  /* ============================================================
     REVENUE PER CUSTOMER
     gross → collection → network share → partner share → net
     ============================================================ */
  function revenuePerCustomer(a) {
    var mix = a.packages.reduce(function (sum, p) {
      return sum + pct(p.share) * p.price * p.freq;
    }, 0);

    var grossMonth = mix;
    var collected = grossMonth * pct(a.collectionRate);
    var afterNetwork = collected * (1 - pct(a.aisShare));
    var partnerCut = a.itBase === "gross"
      ? collected * pct(a.itShare)
      : afterNetwork * pct(a.itShare);
    var netMonth = Math.max(0, afterNetwork - partnerCut);
    var lifeMonths = a.lifetimeDays / DAYS_PER_MONTH;

    return {
      mixShareTotal: a.packages.reduce(function (s, p) { return s + p.share; }, 0),
      grossMonth: grossMonth,
      collected: collected,
      afterNetwork: afterNetwork,
      partnerCut: partnerCut,
      netMonth: netMonth,
      margin: safeDiv(netMonth, grossMonth) * 100,
      lifeMonths: lifeMonths,
      grossLTV: grossMonth * lifeMonths,
      netLTV: netMonth * lifeMonths,
      monthlyChurn: lifeMonths > 0 ? Math.min(1, 1 / lifeMonths) : 1
    };
  }

  /* ---------- media funnel for one month of ad spend ---------- */
  function funnel(spend, a) {
    var impressions = a.cpm > 0 ? (spend / a.cpm) * 1000 : 0;
    var clicks = impressions * pct(a.ctr);
    return {
      spend: spend,
      impressions: impressions,
      clicks: clicks,
      leads: clicks * pct(a.leadRate),
      customers: clicks * pct(a.cvr)
    };
  }

  /* ============================================================
     MONTH-BY-MONTH CASH FLOW
     cash out = marketing + fixed · cash in = net revenue
     cumulative starts at −initialInvestment
     ============================================================ */
  function forecast(a) {
    var rev = revenuePerCustomer(a);
    var rows = [];
    var active = 0, leadPool = 0;
    var cumulative = -a.initialInvestment;
    var cumContribution = 0;

    for (var m = 1; m <= a.months; m++) {
      var selling = m >= a.launchMonth;
      var adsOn = m >= a.adsStartMonth;
      var adSpend = !adsOn ? 0 : (m >= a.scaleMonth ? a.adsScale : a.adsTest);
      var contentSpend = a.contentSpend;
      var marketingSpend = adSpend + contentSpend;
      var cashOut = marketingSpend + a.fixedCost;

      var f = funnel(adSpend, a);

      var newPaid = 0, newFromLeads = 0, newOrganic = 0;
      if (!selling) {
        leadPool += f.leads;
      } else {
        newPaid = f.customers;
        if (leadPool > 0) {
          newFromLeads = leadPool * pct(a.leadToCustomer);
          leadPool = 0;
        }
        // organic ไต่ถึงระดับสูงสุดภายใน 12 เดือนหลังเปิดขาย
        // ผูกกับเวลา ไม่ผูกกับความยาวของช่วงที่จำลอง ผลจึงไม่เพี้ยนเมื่อเปลี่ยน months
        var step = Math.min(1, (m - a.launchMonth) / 12);
        newOrganic = a.organicAtEnd * (0.35 + 0.65 * step);
      }

      var newCustomers = newPaid + newFromLeads + newOrganic;
      active = active * (1 - rev.monthlyChurn) + newCustomers;

      var grossRevenue = active * rev.grossMonth;
      var cashIn = active * rev.netMonth;
      var contribution = cashIn - marketingSpend;   // ยังไม่หักต้นทุนคงที่
      var netCashFlow = cashIn - cashOut;
      cumulative += netCashFlow;
      cumContribution += contribution;

      rows.push({
        month: m,
        selling: selling,
        adSpend: adSpend,
        contentSpend: contentSpend,
        marketingSpend: marketingSpend,
        fixedCost: a.fixedCost,
        cashOut: cashOut,
        impressions: f.impressions,
        clicks: f.clicks,
        leads: selling ? 0 : f.leads,
        newPaid: newPaid + newFromLeads,
        newOrganic: newOrganic,
        newCustomers: newCustomers,
        activeCustomers: active,
        grossRevenue: grossRevenue,
        cashIn: cashIn,
        netRevenue: cashIn,
        contribution: contribution,
        netCashFlow: netCashFlow,
        cumulativeCash: cumulative,
        paidCPA: safeDiv(adSpend, newPaid + newFromLeads),
        blendedCAC: safeDiv(marketingSpend, newCustomers)
      });
    }

    /* ---------- roll-ups ---------- */
    function sum(field) { return rows.reduce(function (s, r) { return s + r[field]; }, 0); }

    var totalCashOut = sum("cashOut");
    var totalInvestment = a.initialInvestment + totalCashOut;
    var totalMarketing = sum("marketingSpend");
    var totalAds = sum("adSpend");
    var totalFixed = sum("fixedCost");
    var totalNewCustomers = sum("newCustomers");
    var totalPaidCustomers = sum("newPaid");
    var totalOrganicCustomers = sum("newOrganic");
    var totalNetRevenue = sum("cashIn");
    var totalGrossRevenue = sum("grossRevenue");

    var lowestCash = rows.reduce(function (worst, r) {
      return Math.min(worst, r.cumulativeCash);
    }, -a.initialInvestment);

    // จุดคุ้มทุนสองแบบ คนละความหมาย
    var operatingBreakEven = null;   // เดือนที่ contribution คลุมต้นทุนคงที่
    var paybackMonth = null;         // เดือนที่เงินสดสะสมกลับมาเป็นบวก
    for (var i = 0; i < rows.length; i++) {
      if (operatingBreakEven === null && rows[i].contribution >= rows[i].fixedCost) {
        operatingBreakEven = rows[i].month;
      }
      if (paybackMonth === null && rows[i].cumulativeCash >= 0) paybackMonth = rows[i].month;
    }

    var last = rows[rows.length - 1] || { cashOut: a.fixedCost };
    var blendedCAC = safeDiv(totalMarketing, totalNewCustomers);

    return {
      assumptions: a,
      revenue: rev,
      rows: rows,
      summary: {
        initialInvestment: a.initialInvestment,
        totalCashOut: totalCashOut,
        totalInvestment: totalInvestment,
        monthlyBurn: safeDiv(totalCashOut, a.months),
        marketingShareOfBurn: safeDiv(totalMarketing, totalCashOut) * 100,
        totalMarketing: totalMarketing,
        totalAds: totalAds,
        totalFixed: totalFixed,
        totalNewCustomers: totalNewCustomers,
        totalPaidCustomers: totalPaidCustomers,
        totalOrganicCustomers: totalOrganicCustomers,
        organicShare: safeDiv(totalOrganicCustomers, totalNewCustomers) * 100,
        totalGrossRevenue: totalGrossRevenue,
        totalNetRevenue: totalNetRevenue,
        cumulativeContribution: cumContribution,
        cumulativeCash: cumulative,
        maxCashRequired: Math.abs(Math.min(0, lowestCash)),
        operatingBreakEven: operatingBreakEven,
        paybackMonth: paybackMonth,
        breakEvenCustomers: safeDiv(last.cashOut, rev.netMonth),
        blendedCAC: blendedCAC,
        paidCPA: safeDiv(totalAds, totalPaidCustomers),
        roas: safeDiv(totalNetRevenue, totalAds),
        ltvCacRatio: safeDiv(rev.netLTV, blendedCAC),
        paybackDays: safeDiv(blendedCAC, rev.netMonth / DAYS_PER_MONTH)
      }
    };
  }

  /* ============================================================
     HORIZON SCAN — ถ้าสมมติฐานชุดนี้เดินต่อไปเรื่อย ๆ
     จะถึงจุดคุ้มทุนและคืนทุนเมื่อไร (ไม่แตะ months ที่ผู้ใช้ตั้งไว้)
     ============================================================ */
  function horizonScan(a, maxMonths) {
    var probe = clone(a);
    probe.months = maxMonths || 60;
    var s = forecast(probe).summary;
    return {
      horizon: probe.months,
      operatingBreakEven: s.operatingBreakEven,
      paybackMonth: s.paybackMonth
    };
  }

  /* ============================================================
     SENSITIVITY — ช็อกสมมติฐานทีละตัว วัดผลเป็นเงิน
     จัดอันดับด้วยผลกระทบจริง ไม่ใช่ความเห็น
     ============================================================ */
  var SHOCKS = [
    { key: "lifetimeDays",   label: "Customer Lifetime",  desc: "สั้นลง 25 %",      apply: function (v) { return Math.round(v * 0.75); } },
    { key: "cvr",            label: "Conversion Rate",    desc: "ต่ำลง 25 %",       apply: function (v) { return +(v * 0.75).toFixed(2); } },
    { key: "collectionRate", label: "Collection Rate",    desc: "ต่ำลง 10 จุด",     apply: function (v) { return Math.max(0, v - 10); } },
    { key: "cpm",            label: "Paid CPA (ผ่าน CPM)", desc: "แพงขึ้น 25 %",     apply: function (v) { return Math.round(v * 1.25); } },
    { key: "organicAtEnd",   label: "Organic Customers",  desc: "เหลือครึ่งเดียว",  apply: function (v) { return Math.round(v * 0.5); } }
  ];

  function sensitivity(a) {
    var base = forecast(a);
    return SHOCKS.map(function (s) {
      var shocked = clone(a);
      shocked[s.key] = s.apply(shocked[s.key]);
      var f = forecast(shocked);
      return {
        key: s.key,
        label: s.label,
        desc: s.desc,
        from: a[s.key],
        to: shocked[s.key],
        contribution: f.summary.cumulativeContribution,
        deltaContribution: f.summary.cumulativeContribution - base.summary.cumulativeContribution,
        maxCashRequired: f.summary.maxCashRequired,
        deltaMaxCash: f.summary.maxCashRequired - base.summary.maxCashRequired,
        operatingBreakEven: f.summary.operatingBreakEven,
        baseOperatingBreakEven: base.summary.operatingBreakEven,
        paybackMonth: f.summary.paybackMonth,
        basePaybackMonth: base.summary.paybackMonth,
        customers: f.summary.totalNewCustomers,
        deltaCustomers: f.summary.totalNewCustomers - base.summary.totalNewCustomers
      };
    }).sort(function (x, y) {
      return Math.abs(y.deltaContribution) - Math.abs(x.deltaContribution);
    });
  }

  /* ============================================================
     SCENARIO COMPARISON — คำนวณทั้งสามชุดพร้อมกันบนค่าตั้งอื่นชุดเดียวกัน
     ============================================================ */
  function compareScenarios(a) {
    return Object.keys(SCENARIOS).map(function (key) {
      var f = forecast(applyScenario(a, key));
      return { key: key, label: SCENARIO_LABEL[key], note: SCENARIO_NOTE[key], summary: f.summary };
    });
  }

  /* ============================================================
     STRESS TEST — คูณตัวแปรเสี่ยงพร้อมกันหลายตัว
     multipliers เป็น % เทียบกับค่าปัจจุบัน (100 = ไม่เปลี่ยน)
     ============================================================ */
  var STRESS_KEYS = [
    { key: "cvr",            label: "Conversion Rate",   dir: "down" },
    { key: "cpm",            label: "CPM (ต้นทุนสื่อ)",   dir: "up" },
    { key: "lifetimeDays",   label: "Customer Lifetime", dir: "down" },
    { key: "collectionRate", label: "Collection Rate",   dir: "down", cap: 100 },
    { key: "organicAtEnd",   label: "Organic Growth",    dir: "down" }
  ];

  function applyStress(a, multipliers) {
    var s = clone(a);
    STRESS_KEYS.forEach(function (k) {
      var m = multipliers[k.key];
      if (m === undefined || m === 100) return;
      var v = s[k.key] * (m / 100);
      if (k.cap) v = Math.min(k.cap, v);
      s[k.key] = k.key === "lifetimeDays" || k.key === "organicAtEnd" || k.key === "cpm"
        ? Math.round(v) : +v.toFixed(2);
    });
    return s;
  }

  function stress(a, multipliers) {
    var base = forecast(a);
    var f = forecast(applyStress(a, multipliers));
    return {
      base: base.summary,
      stressed: f.summary,
      delta: {
        contribution: f.summary.cumulativeContribution - base.summary.cumulativeContribution,
        maxCashRequired: f.summary.maxCashRequired - base.summary.maxCashRequired,
        customers: f.summary.totalNewCustomers - base.summary.totalNewCustomers,
        netRevenue: f.summary.totalNetRevenue - base.summary.totalNetRevenue
      }
    };
  }

  global.SimModel = {
    DAYS_PER_MONTH: DAYS_PER_MONTH,
    DEFAULTS: DEFAULTS,
    FIXED_ITEMS: FIXED_ITEMS,
    fixedItemsTotal: fixedItemsTotal,
    META: META,
    CONF_LABEL: CONF_LABEL,
    SCENARIOS: SCENARIOS,
    SCENARIO_LABEL: SCENARIO_LABEL,
    SCENARIO_NOTE: SCENARIO_NOTE,
    applyScenario: applyScenario,
    SHOCKS: SHOCKS,
    STRESS_KEYS: STRESS_KEYS,
    clone: clone,
    revenuePerCustomer: revenuePerCustomer,
    funnel: funnel,
    forecast: forecast,
    horizonScan: horizonScan,
    sensitivity: sensitivity,
    compareScenarios: compareScenarios,
    applyStress: applyStress,
    stress: stress
  };
})(window);
