/* ============================================================
   Marketing Investment Simulator — calculation model
   Pure functions. No DOM. Change a formula here, the whole UI follows.
   ============================================================ */
(function (global) {
  "use strict";

  var DAYS_PER_MONTH = 30;

  /* ---------- default assumptions (Base Case) ---------- */
  var DEFAULTS = {
    // --- investment ---
    fixedCost: 67000,          // ทีม + ระบบ ต่อเดือน
    contentSpend: 4000,        // คอนเทนต์ / SEO ต่อเดือน
    adsTest: 3500,             // งบโฆษณาต่อเดือน ช่วงทดสอบ
    adsScale: 12000,           // งบโฆษณาต่อเดือน ช่วงขยาย
    months: 8,
    adsStartMonth: 4,          // เดือนแรกที่เริ่มยิงโฆษณา
    launchMonth: 7,            // เดือนแรกที่ระบบเก็บเงินได้
    scaleMonth: 7,             // เดือนแรกที่ใช้งบระดับขยาย

    // --- business model ---
    packages: [
      { key: "perUse", label: "รายครั้ง", price: 3, freq: 6, share: 50 },
      { key: "daily", label: "รายวัน", price: 9, freq: 20, share: 35 },
      { key: "monthly", label: "รายเดือน", price: 99, freq: 1, share: 15 }
    ],
    collectionRate: 82,        // % เรียกเก็บผ่าน
    aisShare: 30,              // % ส่วนแบ่งผู้ให้บริการเครือข่าย
    itShare: 35,               // % ส่วนแบ่งพาร์ตเนอร์
    itBase: "net",             // "net" = หักหลัง AIS · "gross" = หักจากยอดเก็บได้
    lifetimeDays: 60,          // อายุลูกค้าเฉลี่ย

    // --- media ---
    cpm: 100,                  // บาท ต่อการแสดงผล 1,000 ครั้ง
    ctr: 1.2,                  // % คลิกต่อการแสดงผล
    leadRate: 8,               // % คลิก -> รายชื่อ (ช่วงยังขายไม่ได้)
    leadToCustomer: 12,        // % รายชื่อสะสม -> ลูกค้า ตอนเปิดขาย
    cvr: 4,                    // % คลิก -> ลูกค้า (หลังเปิดขาย)

    // --- organic ---
    organicAtEnd: 150          // ลูกค้าจาก organic ต่อเดือน ณ เดือนสุดท้าย
  };

  /* ---------- scenarios ---------- */
  var SCENARIOS = {
    conservative: { cpm: 130, ctr: 0.9, cvr: 3, leadRate: 6, leadToCustomer: 8,
                    collectionRate: 75, lifetimeDays: 45, organicAtEnd: 80 },
    base:         { cpm: 100, ctr: 1.2, cvr: 4, leadRate: 8, leadToCustomer: 12,
                    collectionRate: 82, lifetimeDays: 60, organicAtEnd: 150 },
    aggressive:   { cpm: 80,  ctr: 1.8, cvr: 6, leadRate: 11, leadToCustomer: 18,
                    collectionRate: 88, lifetimeDays: 90, organicAtEnd: 300 }
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
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

    var grossMonth = mix;                                   // ยอดเรียกเก็บต่อเดือน
    var collected = grossMonth * pct(a.collectionRate);     // เก็บผ่านจริง
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

  /* ============================================================
     MEDIA FUNNEL for one month of ad spend
     ============================================================ */
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
     MONTH-BY-MONTH FORECAST
     ============================================================ */
  function forecast(a) {
    var rev = revenuePerCustomer(a);
    var rows = [];
    var active = 0, leadPool = 0, cumulative = 0, cumContribution = 0;
    var organicPeak = a.organicAtEnd;

    for (var m = 1; m <= a.months; m++) {
      var selling = m >= a.launchMonth;
      var adsOn = m >= a.adsStartMonth;
      var adSpend = !adsOn ? 0 : (m >= a.scaleMonth ? a.adsScale : a.adsTest);
      var contentSpend = a.contentSpend;
      var marketingSpend = adSpend + contentSpend;
      var totalCost = marketingSpend + a.fixedCost;

      var f = funnel(adSpend, a);

      // ก่อนเปิดขาย โฆษณาได้รายชื่อ ไม่ได้ลูกค้า
      var newPaid = 0, newFromLeads = 0, newOrganic = 0;
      if (!selling) {
        leadPool += f.leads;
      } else {
        newPaid = f.customers;
        if (leadPool > 0) {                    // รายชื่อที่สะสมไว้แปลงครั้งเดียวตอนเปิดขาย
          newFromLeads = leadPool * pct(a.leadToCustomer);
          leadPool = 0;
        }
        // organic ไต่เป็นเส้นตรงจากเดือนที่เปิดขายถึงเดือนสุดท้าย
        var span = Math.max(1, a.months - a.launchMonth);
        var step = Math.min(1, (m - a.launchMonth) / span);
        newOrganic = organicPeak * (0.35 + 0.65 * step);
      }

      var newCustomers = newPaid + newFromLeads + newOrganic;
      active = active * (1 - rev.monthlyChurn) + newCustomers;

      var grossRevenue = active * rev.grossMonth;
      var netRevenue = active * rev.netMonth;
      var contribution = netRevenue - marketingSpend;   // ยังไม่หักต้นทุนคงที่
      var cashFlow = netRevenue - totalCost;
      cumulative += cashFlow;
      cumContribution += contribution;

      rows.push({
        month: m,
        selling: selling,
        adSpend: adSpend,
        contentSpend: contentSpend,
        marketingSpend: marketingSpend,
        fixedCost: a.fixedCost,
        totalCost: totalCost,
        impressions: f.impressions,
        clicks: f.clicks,
        leads: selling ? 0 : f.leads,
        newPaid: newPaid,
        newFromLeads: newFromLeads,
        newOrganic: newOrganic,
        newCustomers: newCustomers,
        activeCustomers: active,
        grossRevenue: grossRevenue,
        netRevenue: netRevenue,
        contribution: contribution,
        cashFlow: cashFlow,
        cumulativeCash: cumulative,
        paidCPA: safeDiv(adSpend, newPaid),
        blendedCAC: safeDiv(marketingSpend, newCustomers)
      });
    }

    /* ---------- summary ---------- */
    var totalInvestment = rows.reduce(function (s, r) { return s + r.totalCost; }, 0);
    var totalMarketing = rows.reduce(function (s, r) { return s + r.marketingSpend; }, 0);
    var totalAds = rows.reduce(function (s, r) { return s + r.adSpend; }, 0);
    var totalNewCustomers = rows.reduce(function (s, r) { return s + r.newCustomers; }, 0);
    var totalPaidCustomers = rows.reduce(function (s, r) { return s + r.newPaid + r.newFromLeads; }, 0);
    var totalNetRevenue = rows.reduce(function (s, r) { return s + r.netRevenue; }, 0);
    var totalGrossRevenue = rows.reduce(function (s, r) { return s + r.grossRevenue; }, 0);

    var maxExposure = rows.reduce(function (worst, r) {
      return Math.min(worst, r.cumulativeCash);
    }, 0);

    var beMonth = null, beCumMonth = null;
    for (var i = 0; i < rows.length; i++) {
      if (beMonth === null && rows[i].netRevenue >= rows[i].totalCost) beMonth = rows[i].month;
      if (beCumMonth === null && rows[i].cumulativeCash >= 0) beCumMonth = rows[i].month;
    }

    // จำนวนลูกค้าที่ต้องมีพร้อมกัน เพื่อให้รายได้สุทธิคลุมต้นทุนต่อเดือน
    var lastRow = rows[rows.length - 1];
    var breakEvenCustomers = safeDiv(lastRow ? lastRow.totalCost : a.fixedCost, rev.netMonth);

    return {
      assumptions: a,
      revenue: rev,
      rows: rows,
      summary: {
        totalInvestment: totalInvestment,
        totalMarketing: totalMarketing,
        totalAds: totalAds,
        totalNewCustomers: totalNewCustomers,
        totalPaidCustomers: totalPaidCustomers,
        totalGrossRevenue: totalGrossRevenue,
        totalNetRevenue: totalNetRevenue,
        cumulativeContribution: cumContribution,
        cumulativeCash: cumulative,
        maxCashExposure: Math.abs(Math.min(0, maxExposure)),
        breakEvenMonth: beMonth,
        breakEvenCumulativeMonth: beCumMonth,
        breakEvenCustomers: breakEvenCustomers,
        blendedCAC: safeDiv(totalMarketing, totalNewCustomers),
        paidCPA: safeDiv(totalAds, totalPaidCustomers),
        roas: safeDiv(totalNetRevenue, totalAds),
        ltvCacRatio: safeDiv(rev.netLTV, safeDiv(totalMarketing, totalNewCustomers)),
        paybackDays: safeDiv(safeDiv(totalMarketing, totalNewCustomers), rev.netMonth / DAYS_PER_MONTH)
      }
    };
  }

  global.SimModel = {
    DEFAULTS: DEFAULTS,
    SCENARIOS: SCENARIOS,
    clone: clone,
    revenuePerCustomer: revenuePerCustomer,
    funnel: funnel,
    forecast: forecast
  };
})(window);
