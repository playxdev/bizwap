/* ============================================================
   Marketing Investment Simulator — presentation layer
   Reads from SimModel, writes to the DOM. No business formula lives here.
   ============================================================ */
(function () {
  "use strict";

  var M = window.SimModel;
  var state = M.clone(M.DEFAULTS);
  var scenario = "base";

  /* ---------- formatting ---------- */
  function n(v, d) {
    if (!isFinite(v)) return "—";
    return v.toLocaleString("en-US", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  }
  function baht(v, d) { return isFinite(v) ? n(v, d) + " ฿" : "—"; }
  function el(id) { return document.getElementById(id); }

  /* ---------- control definitions ----------
     every slider is declared once: where it writes, its range, how it reads back  */
  var CONTROLS = {
    investment: [
      { k: "fixedCost", label: "ต้นทุนคงที่ / เดือน", min: 0, max: 300000, step: 1000, fmt: baht,
        help: "ทีมและระบบ จ่ายเท่ากันทุกเดือนไม่ว่าจะยิงโฆษณาหรือไม่" },
      { k: "contentSpend", label: "งบคอนเทนต์ / เดือน", min: 0, max: 40000, step: 500, fmt: baht,
        help: "SEO, AEO, GEO และการผลิตคอนเทนต์ นับเป็นต้นทุนการตลาด" },
      { k: "adsTest", label: "งบโฆษณา / เดือน · ช่วงทดสอบ", min: 0, max: 50000, step: 500, fmt: baht,
        help: "ช่วงที่ยังหาว่ากลุ่มไหนและชิ้นงานไหนได้ผล" },
      { k: "adsScale", label: "งบโฆษณา / เดือน · ช่วงขยาย", min: 0, max: 150000, step: 1000, fmt: baht,
        help: "ช่วงหลังเปิดขาย เมื่อรู้ต้นทุนต่อลูกค้าจริงแล้ว" },
      { k: "months", label: "ระยะเวลาจำลอง", min: 3, max: 24, step: 1, fmt: function (v) { return n(v) + " เดือน"; },
        help: "จำนวนเดือนที่แบบจำลองคำนวณไปข้างหน้า" },
      { k: "adsStartMonth", label: "เริ่มยิงโฆษณาเดือนที่", min: 1, max: 12, step: 1, fmt: function (v) { return "เดือน " + n(v); },
        help: "ก่อนเปิดขาย โฆษณาได้รายชื่อ ยังไม่ได้ลูกค้าที่จ่ายเงิน" },
      { k: "launchMonth", label: "เปิดขายเดือนที่", min: 1, max: 24, step: 1, fmt: function (v) { return "เดือน " + n(v); },
        help: "เดือนแรกที่ระบบตัดเงินได้ รายได้เริ่มนับจากเดือนนี้", impact: true },
      { k: "scaleMonth", label: "เริ่มใช้งบระดับขยายเดือนที่", min: 1, max: 24, step: 1, fmt: function (v) { return "เดือน " + n(v); },
        help: "เดือนแรกที่สลับจากงบทดสอบไปเป็นงบขยาย" }
    ],
    model: [
      { k: "collectionRate", label: "Collection Rate", min: 0, max: 100, step: 1, fmt: function (v) { return n(v, 0) + " %"; },
        help: "เรียกเก็บผ่านบิลมือถือสำเร็จกี่ % บางวันยอดเงินในซิมไม่พอ", impact: true },
      { k: "aisShare", label: "ส่วนแบ่งเครือข่าย (AIS)", min: 0, max: 60, step: 1, fmt: function (v) { return n(v, 0) + " %"; },
        help: "ค่าช่องทางตัดเงินผ่านบิลมือถือ" },
      { k: "itShare", label: "ส่วนแบ่งพาร์ตเนอร์ (IT)", min: 0, max: 60, step: 1, fmt: function (v) { return n(v, 0) + " %"; },
        help: "หักจากยอดไหน เลือกได้ในช่องถัดไป" },
      { k: "lifetimeDays", label: "อายุลูกค้าเฉลี่ย", min: 7, max: 365, step: 1, fmt: function (v) { return n(v) + " วัน"; },
        help: "อยู่กี่วันก่อนเลิกจ่าย ตัวแปรที่กระทบเพดานค่าโฆษณามากที่สุด", impact: true },
      { k: "organicAtEnd", label: "ลูกค้า Organic / เดือน ณ เดือนสุดท้าย", min: 0, max: 2000, step: 10, fmt: function (v) { return n(v) + " คน"; },
        help: "ลูกค้าที่มาเองจาก Search และ AI ไม่ได้จ่ายค่าโฆษณา", impact: true }
    ],
    media: [
      { k: "cpm", label: "CPM", min: 10, max: 400, step: 5, fmt: baht,
        help: "ค่าโฆษณาต่อการแสดงผล 1,000 ครั้ง" },
      { k: "ctr", label: "CTR", min: 0.1, max: 8, step: 0.1, fmt: function (v) { return n(v, 1) + " %"; },
        help: "คนเห็นโฆษณา 100 คน กดกี่คน" },
      { k: "cvr", label: "CVR · คลิก → ลูกค้า", min: 0.1, max: 25, step: 0.1, fmt: function (v) { return n(v, 1) + " %"; },
        help: "หลังเปิดขาย คนกดเข้าเว็บ 100 คน จ่ายเงินกี่คน", impact: true },
      { k: "leadRate", label: "คลิก → รายชื่อ", min: 0, max: 40, step: 0.5, fmt: function (v) { return n(v, 1) + " %"; },
        help: "ช่วงยังขายไม่ได้ คนกดเข้ามาแล้ว Add LINE หรือทิ้งอีเมลกี่ %" },
      { k: "leadToCustomer", label: "รายชื่อสะสม → ลูกค้า", min: 0, max: 60, step: 1, fmt: function (v) { return n(v, 0) + " %"; },
        help: "ตอนเปิดขาย รายชื่อที่สะสมไว้แปลงเป็นลูกค้ากี่ %" }
    ]
  };

  /* ---------- formula explanations ---------- */
  var FORMULAS = {
    grossMonth: {
      title: "Gross Revenue / ลูกค้า / เดือน",
      body: function (r) {
        return "<p>ยอดที่เรียกเก็บต่อลูกค้า 1 คน ต่อเดือน ก่อนหักอะไรทั้งสิ้น</p>" +
          "<pre>Σ ( สัดส่วนผู้ใช้ × ราคา × ความถี่ต่อเดือน )</pre>" +
          "<table class='plain'><tbody>" +
          state.packages.map(function (p) {
            return "<tr><td>" + p.label + "</td><td>" + p.share + " % × " + p.price + " ฿ × " + p.freq +
              "</td><td class='num'>" + baht(p.share / 100 * p.price * p.freq, 2) + "</td></tr>";
          }).join("") +
          "<tr class='tot'><td>รวม</td><td></td><td class='num'>" + baht(r.grossMonth, 2) + "</td></tr>" +
          "</tbody></table>";
      }
    },
    netMonth: {
      title: "Net Revenue / ลูกค้า / เดือน",
      body: function (r) {
        return "<p>ยอดที่เหลือถึงเราจริง หลังหักการเก็บเงินไม่ผ่านและส่วนแบ่งทุกฝ่าย</p>" +
          "<pre>Gross × Collection Rate × (1 − ส่วนแบ่งเครือข่าย) − ส่วนแบ่งพาร์ตเนอร์</pre>" +
          "<table class='plain'><tbody>" +
          "<tr><td>Gross</td><td></td><td class='num'>" + baht(r.grossMonth, 2) + "</td></tr>" +
          "<tr><td>เก็บสำเร็จ " + state.collectionRate + " %</td><td></td><td class='num'>" + baht(r.collected, 2) + "</td></tr>" +
          "<tr><td>หลังหักเครือข่าย " + state.aisShare + " %</td><td></td><td class='num'>" + baht(r.afterNetwork, 2) + "</td></tr>" +
          "<tr><td>หักพาร์ตเนอร์ " + state.itShare + " % (" + (state.itBase === "gross" ? "ฐาน Gross" : "ฐาน Net") + ")</td><td></td><td class='num'>− " + baht(r.partnerCut, 2) + "</td></tr>" +
          "<tr class='tot'><td>Net</td><td>margin " + n(r.margin, 1) + " %</td><td class='num'>" + baht(r.netMonth, 2) + "</td></tr>" +
          "</tbody></table>";
      }
    },
    grossLTV: {
      title: "Gross LTV",
      body: function (r) {
        return "<p>รายได้รวมตลอดอายุลูกค้า <strong>ก่อน</strong>หักการเก็บเงินไม่ผ่านและส่วนแบ่ง ใช้เทียบราคาขาย ไม่ใช้ตัดสินงบโฆษณา</p>" +
          "<pre>Gross / เดือน × ( อายุลูกค้า ÷ 30 )</pre>" +
          "<p>" + baht(r.grossMonth, 2) + " × " + n(r.lifeMonths, 2) + " เดือน = <strong>" + baht(r.grossLTV, 2) + "</strong></p>";
      }
    },
    netLTV: {
      title: "Net LTV",
      body: function (r) {
        return "<p>เงินที่ลูกค้า 1 คนทำให้เราจริงตลอดอายุการใช้งาน ตัวนี้เท่านั้นที่ใช้ตั้งเพดานค่าได้ลูกค้า</p>" +
          "<pre>Net / เดือน × ( อายุลูกค้า ÷ 30 )</pre>" +
          "<p>" + baht(r.netMonth, 2) + " × " + n(r.lifeMonths, 2) + " เดือน = <strong>" + baht(r.netLTV, 2) + "</strong></p>" +
          "<p class='muted'>Gross LTV คือ " + baht(r.grossLTV, 2) + " — ต่างกัน " + baht(r.grossLTV - r.netLTV, 2) +
          " ถ้าคิดงบโฆษณาจาก Gross จะประเมินสูงเกินจริง " + n(r.grossLTV / Math.max(r.netLTV, 0.0001), 1) + " เท่า</p>";
      }
    },
    paidCPA: {
      title: "Paid CPA",
      body: function (r, f) {
        return "<p>ค่าโฆษณาที่จ่ายไป หารด้วยจำนวนลูกค้าที่ได้จากโฆษณาโดยตรง</p>" +
          "<pre>ค่าโฆษณาสะสม ÷ ลูกค้าที่มาจากโฆษณา</pre>" +
          "<p>" + baht(f.summary.totalAds) + " ÷ " + n(f.summary.totalPaidCustomers) + " คน = <strong>" + baht(f.summary.paidCPA, 2) + "</strong></p>" +
          "<p class='muted'>ใช้ตัดสินใจระดับชุดโฆษณา — เพิ่มงบ คงงบ ลดงบ หรือปิด</p>";
      }
    },
    blendedCAC: {
      title: "Blended CAC",
      body: function (r, f) {
        return "<p>ต้นทุนการตลาดทั้งหมด หารด้วยลูกค้าใหม่ทั้งหมด รวมคนที่มาเองจาก Organic</p>" +
          "<pre>( ค่าโฆษณา + ค่าคอนเทนต์ ) ÷ ลูกค้าใหม่ทั้งหมด</pre>" +
          "<p>" + baht(f.summary.totalMarketing) + " ÷ " + n(f.summary.totalNewCustomers) + " คน = <strong>" + baht(f.summary.blendedCAC, 2) + "</strong></p>" +
          "<p class='muted'>ต่ำกว่า Paid CPA เมื่อ Organic เริ่มทำงาน — นั่นคือผลตอบแทนของงบคอนเทนต์</p>";
      }
    },
    contribution: {
      title: "Contribution",
      body: function (r, f) {
        return "<p>รายได้สุทธิ ลบต้นทุนการตลาดที่ผันแปร — <strong>ยังไม่หักต้นทุนคงที่</strong></p>" +
          "<pre>Net Revenue − ( ค่าโฆษณา + ค่าคอนเทนต์ )</pre>" +
          "<p>สะสม " + n(state.months) + " เดือน = <strong>" + baht(f.summary.cumulativeContribution) + "</strong></p>" +
          "<p class='muted'>Contribution บวก แปลว่าการตลาดเลี้ยงตัวเองได้ แต่ยังไม่ได้แปลว่าธุรกิจกำไร ต้องคลุมต้นทุนคงที่ " +
          baht(state.fixedCost) + " ต่อเดือนก่อน</p>";
      }
    },
    payback: {
      title: "Payback Period",
      body: function (r, f) {
        return "<p>เก็บเงินกี่วัน ถึงคืนค่าที่จ่ายไปเพื่อได้ลูกค้า 1 คน</p>" +
          "<pre>Blended CAC ÷ ( Net Revenue ต่อเดือน ÷ 30 )</pre>" +
          "<p>" + baht(f.summary.blendedCAC, 2) + " ÷ " + baht(r.netMonth / 30, 2) + " ต่อวัน = <strong>" + n(f.summary.paybackDays) + " วัน</strong></p>" +
          "<p class='muted'>ถ้ายาวกว่าอายุลูกค้าเฉลี่ย (" + n(state.lifetimeDays) + " วัน) แปลว่าลูกค้าเลิกจ่ายก่อนจะคืนทุน</p>";
      }
    },
    roas: {
      title: "ROAS",
      body: function (r, f) {
        return "<p>รายได้สุทธิสะสม หารด้วยค่าโฆษณาสะสม</p>" +
          "<pre>Net Revenue ÷ ค่าโฆษณา</pre>" +
          "<p>" + baht(f.summary.totalNetRevenue) + " ÷ " + baht(f.summary.totalAds) + " = <strong>" + n(f.summary.roas, 2) + "</strong></p>" +
          "<p class='muted'>ROAS ไม่ใช่กำไร เพราะยังไม่หักค่าคอนเทนต์ " + baht(f.summary.totalMarketing - f.summary.totalAds) +
          " และต้นทุนคงที่ " + baht(state.fixedCost * state.months) + " ตลอดช่วงจำลอง</p>";
      }
    },
    breakEvenCustomers: {
      title: "ลูกค้าที่ต้องมีพร้อมกัน",
      body: function (r, f) {
        var last = f.rows[f.rows.length - 1];
        return "<p>จำนวนลูกค้าที่ยังจ่ายอยู่พร้อมกัน เพื่อให้รายได้สุทธิคลุมต้นทุนทั้งเดือน</p>" +
          "<pre>ต้นทุนรวมต่อเดือน ÷ Net Revenue ต่อลูกค้าต่อเดือน</pre>" +
          "<p>" + baht(last.totalCost) + " ÷ " + baht(r.netMonth, 2) + " = <strong>" + n(f.summary.breakEvenCustomers) + " คน</strong></p>";
      }
    }
  };

  /* ============================================================
     CONTROL RENDERING
     ============================================================ */
  function sliderHTML(c) {
    var v = state[c.k];
    return '<div class="ctrl">' +
      '<div class="ctrl-top">' +
        '<label for="c-' + c.k + '">' + c.label +
          (c.impact ? ' <span class="impact">HIGH IMPACT</span>' : '') + '</label>' +
        '<output class="ctrl-val" id="v-' + c.k + '">' + c.fmt(v) + '</output>' +
      '</div>' +
      '<input type="range" id="c-' + c.k + '" data-key="' + c.k + '" min="' + c.min + '" max="' + c.max +
        '" step="' + c.step + '" value="' + v + '">' +
      '<span class="ctrl-help">' + c.help + '</span>' +
    '</div>';
  }

  function packageControlsHTML() {
    var out = state.packages.map(function (p, i) {
      var rows = [
        { f: "price", label: "ราคา", min: 0, max: 500, step: 1, suffix: " ฿" },
        { f: "freq", label: p.key === "monthly" ? "ครั้ง / เดือน" : (p.key === "daily" ? "วันที่ใช้ / เดือน" : "ครั้ง / เดือน"),
          min: 0, max: 60, step: 1, suffix: "" },
        { f: "share", label: "สัดส่วนผู้ใช้", min: 0, max: 100, step: 1, suffix: " %" }
      ];
      return '<div class="pkg">' +
        '<div class="pkg-name">' + p.label + '</div>' +
        rows.map(function (r) {
          return '<div class="ctrl compact">' +
            '<div class="ctrl-top"><label for="p-' + i + '-' + r.f + '">' + r.label + '</label>' +
            '<output class="ctrl-val" id="pv-' + i + '-' + r.f + '">' + n(p[r.f], 0) + r.suffix + '</output></div>' +
            '<input type="range" id="p-' + i + '-' + r.f + '" data-pkg="' + i + '" data-field="' + r.f +
            '" data-suffix="' + r.suffix + '" min="' + r.min + '" max="' + r.max + '" step="' + r.step + '" value="' + p[r.f] + '">' +
          '</div>';
        }).join("") +
      '</div>';
    }).join("");

    return out;
  }

  function itBaseHTML() {
    return '<div class="ctrl">' +
      '<div class="ctrl-top"><label for="c-itBase">ฐานที่หักส่วนแบ่งพาร์ตเนอร์</label></div>' +
      '<select id="c-itBase">' +
        '<option value="net"' + (state.itBase === "net" ? " selected" : "") + '>Net Revenue — หักหลังแบ่งเครือข่ายแล้ว</option>' +
        '<option value="gross"' + (state.itBase === "gross" ? " selected" : "") + '>Gross Revenue — หักจากยอดเก็บได้เต็ม</option>' +
      '</select>' +
      '<span class="ctrl-help">สัญญาส่วนใหญ่ใช้ Net · เปลี่ยนแล้วรายได้สุทธิเปลี่ยนทันที</span>' +
    '</div>';
  }

  function buildControls() {
    el("controls-investment").innerHTML = CONTROLS.investment.map(sliderHTML).join("");
    el("controls-model").innerHTML = CONTROLS.model.map(sliderHTML).join("") + itBaseHTML();
    el("controls-media").innerHTML = CONTROLS.media.map(sliderHTML).join("");
    el("controls-packages").innerHTML = packageControlsHTML();
  }

  function syncControlValues() {
    ["investment", "model", "media"].forEach(function (g) {
      CONTROLS[g].forEach(function (c) {
        var input = el("c-" + c.k), out = el("v-" + c.k);
        if (input) input.value = state[c.k];
        if (out) out.textContent = c.fmt(state[c.k]);
      });
    });
    state.packages.forEach(function (p, i) {
      ["price", "freq", "share"].forEach(function (f) {
        var input = el("p-" + i + "-" + f), out = el("pv-" + i + "-" + f);
        if (input) input.value = p[f];
        if (out) out.textContent = n(p[f], 0) + (input ? input.dataset.suffix : "");
      });
    });
    var sel = el("c-itBase");
    if (sel) sel.value = state.itBase;
  }

  /* ============================================================
     OUTPUT RENDERING
     ============================================================ */
  function kpi(label, value, sub, mod, key) {
    return '<div class="kpi' + (mod ? " " + mod : "") + '">' +
      '<small>' + label + '</small>' +
      '<strong>' + value + '</strong>' +
      '<span>' + (sub || "") + '</span>' +
      (key ? '<button class="why" data-explain="' + key + '" type="button" aria-label="วิธีคำนวณ">?</button>' : '') +
    '</div>';
  }

  function renderHero(f) {
    var s = f.summary;
    el("hero-kpis").innerHTML =
      kpi("Required Investment", baht(s.totalInvestment), n(state.months) + " เดือน รวมต้นทุนคงที่") +
      kpi("Max Cash Exposure", baht(s.maxCashExposure), "เงินสดติดลบสูงสุดระหว่างทาง") +
      kpi("Projected Customers", n(s.totalNewCustomers), "ลูกค้าใหม่สะสม") +
      kpi("Break-even", s.breakEvenMonth ? "เดือน " + s.breakEvenMonth : "ยังไม่ถึง",
          s.breakEvenMonth ? "รายได้สุทธิคลุมต้นทุนรวม" : "ภายใน " + n(state.months) + " เดือนนี้");
  }

  function renderStep1(f) {
    var s = f.summary;
    var fixedTotal = state.fixedCost * state.months;
    el("step1-cards").innerHTML =
      '<div class="card"><div class="card-num">' + baht(state.fixedCost) + '</div>' +
        '<h3>ต้นทุนคงที่ / เดือน</h3><p>จ่ายเท่ากันทุกเดือนไม่ว่าจะยิงโฆษณาหรือไม่ รวม ' + n(state.months) +
        ' เดือนเป็น ' + baht(fixedTotal) + '</p></div>' +
      '<div class="card"><div class="card-num orange">' + baht(s.totalMarketing) + '</div>' +
        '<h3>ต้นทุนการตลาดรวม</h3><p>ค่าโฆษณา ' + baht(s.totalAds) + ' + คอนเทนต์ ' +
        baht(s.totalMarketing - s.totalAds) + ' ปรับขึ้นลงได้ทุกเดือน</p></div>' +
      '<div class="card"><div class="card-num blue">' + baht(s.totalInvestment) + '</div>' +
        '<h3>เงินที่ต้องเตรียมทั้งหมด</h3><p>คงที่ + การตลาด ตลอด ' + n(state.months) +
        ' เดือน · เงินสดติดลบสูงสุด ' + baht(s.maxCashExposure) + '</p></div>';
  }

  function renderFunnel(f) {
    var rows = f.rows.filter(function (r) { return r.adSpend > 0; });
    var ref = rows.length ? rows[rows.length - 1] : f.rows[f.rows.length - 1];
    var steps = [
      { label: "Ad Spend", value: baht(ref.adSpend), sub: "เดือน " + ref.month },
      { label: "Impressions", value: n(ref.impressions), sub: "CPM " + baht(state.cpm) },
      { label: "Clicks", value: n(ref.clicks), sub: "CTR " + n(state.ctr, 1) + " %" },
      { label: ref.selling ? "New Customers" : "Leads",
        value: n(ref.selling ? ref.newPaid : ref.leads),
        sub: ref.selling ? "CVR " + n(state.cvr, 1) + " %" : "คลิก → รายชื่อ " + n(state.leadRate, 1) + " %" },
      { label: ref.selling ? "Paid CPA" : "CPL",
        value: baht(ref.selling ? ref.paidCPA : (ref.leads > 0 ? ref.adSpend / ref.leads : NaN), 2),
        sub: ref.selling ? "ต่อลูกค้า 1 คน" : "ต่อรายชื่อ 1 คน" }
    ];
    el("funnel").innerHTML = steps.map(function (s, i) {
      return '<div class="fstep"><small>' + s.label + '</small><strong>' + s.value + '</strong><span>' + s.sub + '</span></div>' +
        (i < steps.length - 1 ? '<div class="farrow" aria-hidden="true">→</div>' : "");
    }).join("");

    el("media-note").textContent = ref.selling
      ? "ตัวเลขนี้คือเดือน " + ref.month + " ซึ่งขายได้แล้ว โฆษณาจึงวัดเป็นลูกค้าและ Paid CPA"
      : "เดือน " + ref.month + " ระบบยังเก็บเงินไม่ได้ โฆษณาจึงวัดเป็นรายชื่อและ CPL — อย่าเอาไปเทียบเพดานค่าได้ลูกค้า";
  }

  function renderMediaMetrics(f) {
    var s = f.summary;
    el("media-metrics").innerHTML =
      kpi("Paid CPA", baht(s.paidCPA, 2), "เฉลี่ยตลอดช่วง", "", "paidCPA") +
      kpi("Blended CAC", baht(s.blendedCAC, 2), "รวม organic แล้ว", "", "blendedCAC") +
      kpi("ลูกค้าจากโฆษณา", n(s.totalPaidCustomers), "รวมที่แปลงจากรายชื่อ") +
      kpi("ลูกค้าทั้งหมด", n(s.totalNewCustomers), "รวม organic");
  }

  function renderWaterfall(f) {
    var r = f.revenue;
    var items = [
      { label: "Gross Revenue", value: baht(r.grossMonth, 2), note: "ยอดเรียกเก็บ / เดือน", key: "grossMonth" },
      { label: "เก็บสำเร็จ " + n(state.collectionRate) + " %", value: baht(r.collected, 2), note: "หลัง Collection Rate" },
      { label: "หลังแบ่งเครือข่าย " + n(state.aisShare) + " %", value: baht(r.afterNetwork, 2), note: "" },
      { label: "หักพาร์ตเนอร์ " + n(state.itShare) + " %", value: "− " + baht(r.partnerCut, 2), note: state.itBase === "gross" ? "ฐาน Gross" : "ฐาน Net", neg: true },
      { label: "Net Revenue", value: baht(r.netMonth, 2), note: "margin " + n(r.margin, 1) + " %", key: "netMonth", final: true }
    ];
    el("waterfall").innerHTML = items.map(function (it) {
      return '<div class="wf' + (it.final ? " wf-final" : "") + (it.neg ? " wf-neg" : "") + '">' +
        '<small>' + it.label + '</small>' +
        '<strong>' + it.value + '</strong>' +
        '<span>' + it.note + '</span>' +
        (it.key ? '<button class="why" data-explain="' + it.key + '" type="button" aria-label="วิธีคำนวณ">?</button>' : '') +
      '</div>';
    }).join("");
  }

  function renderUnitMetrics(f) {
    var r = f.revenue, s = f.summary;
    var healthy = isFinite(s.ltvCacRatio) && s.ltvCacRatio >= 3;
    el("unit-metrics").innerHTML =
      kpi("Gross LTV", baht(r.grossLTV, 2), "ก่อนหักทุกอย่าง", "", "grossLTV") +
      kpi("Net LTV", baht(r.netLTV, 2), "เงินที่ถึงเราจริง", "hl", "netLTV") +
      kpi("Contribution สะสม", baht(s.cumulativeContribution),
          s.cumulativeContribution >= 0 ? "การตลาดเลี้ยงตัวเองได้" : "ยังไม่คุ้มค่าการตลาด",
          s.cumulativeContribution >= 0 ? "pos" : "neg", "contribution") +
      kpi("Net LTV : Blended CAC", n(s.ltvCacRatio, 2) + " : 1", "ต้องได้ 3.00 ขึ้นไป",
          healthy ? "pos" : "neg") +
      kpi("Payback", n(s.paybackDays) + " วัน", "อายุลูกค้า " + n(state.lifetimeDays) + " วัน",
          isFinite(s.paybackDays) && s.paybackDays <= state.lifetimeDays ? "pos" : "neg", "payback") +
      kpi("ลูกค้าที่ต้องมีพร้อมกัน", n(s.breakEvenCustomers), "เพื่อคลุมต้นทุนต่อเดือน", "", "breakEvenCustomers");

    el("roas-note").innerHTML =
      "ROAS ของช่วงจำลองนี้คือ <strong>" + n(f.summary.roas, 2) + "</strong> — คิดจากรายได้สุทธิหารค่าโฆษณาเท่านั้น " +
      "ยังไม่หักค่าคอนเทนต์ " + baht(s.totalMarketing - s.totalAds) + " และต้นทุนคงที่ " + baht(state.fixedCost * state.months) +
      " ตัวเลขที่บอกว่าธุรกิจอยู่ได้หรือไม่คือ Contribution และเงินสดสะสม ไม่ใช่ ROAS " +
      '<button class="why inline" data-explain="roas" type="button">ดูวิธีคำนวณ</button>';
  }

  function renderForecast(f) {
    var cols = [
      ["เดือน", function (r) { return r.month; }, ""],
      ["Marketing", function (r) { return n(r.marketingSpend); }, "num"],
      ["Fixed", function (r) { return n(r.fixedCost); }, "num"],
      ["Total Cost", function (r) { return n(r.totalCost); }, "num"],
      ["New Cust.", function (r) { return r.selling ? n(r.newCustomers) : "—"; }, "num"],
      ["Active", function (r) { return r.selling ? n(r.activeCustomers) : "—"; }, "num"],
      ["Gross Rev.", function (r) { return n(r.grossRevenue); }, "num"],
      ["Net Rev.", function (r) { return n(r.netRevenue); }, "num"],
      ["Contribution", function (r) { return n(r.contribution); }, "num"],
      ["Cumulative Cash", function (r) { return n(r.cumulativeCash); }, "num"]
    ];
    var be = f.summary.breakEvenMonth;
    var html = "<thead><tr>" + cols.map(function (c) {
      return '<th class="' + c[2] + '">' + c[0] + "</th>";
    }).join("") + "</tr></thead><tbody>";
    f.rows.forEach(function (r) {
      html += '<tr class="' + (r.month === be ? "is-be" : "") + '">' + cols.map(function (c) {
        var v = c[1](r);
        var cls = c[2];
        if (c[0] === "Contribution" || c[0] === "Cumulative Cash") {
          var raw = c[0] === "Contribution" ? r.contribution : r.cumulativeCash;
          cls += raw < 0 ? " neg" : " pos";
        }
        return '<td class="' + cls + '">' + v + "</td>";
      }).join("") + "</tr>";
    });
    html += "</tbody>";
    el("forecast-table").innerHTML = html;
    drawChart(f);
  }

  /* ---------- chart: bars = cost vs net revenue, line = cumulative cash ---------- */
  function drawChart(f) {
    var rows = f.rows;
    var W = 760, H = 300, padL = 56, padR = 16, padT = 16, padB = 36;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var maxBar = Math.max.apply(null, rows.map(function (r) { return Math.max(r.totalCost, r.netRevenue); })).valueOf() || 1;
    var cums = rows.map(function (r) { return r.cumulativeCash; });
    var cumMin = Math.min.apply(null, cums.concat([0]));
    var cumMax = Math.max.apply(null, cums.concat([0]));
    var cumSpan = (cumMax - cumMin) || 1;

    var gw = plotW / rows.length;
    var bw = Math.min(18, gw / 3);

    function barY(v) { return padT + plotH - (v / maxBar) * plotH; }
    function barH(v) { return (v / maxBar) * plotH; }
    function cumY(v) { return padT + plotH - ((v - cumMin) / cumSpan) * plotH; }

    var parts = [];
    // grid + y labels for the bar scale
    [0, 0.25, 0.5, 0.75, 1].forEach(function (t) {
      var y = padT + plotH - t * plotH;
      parts.push('<line class="g" x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '"></line>');
      parts.push('<text class="ax" x="' + (padL - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end">' + n(maxBar * t / 1000) + 'K</text>');
    });
    // zero line for cumulative
    var zeroY = cumY(0);
    parts.push('<line class="zero" x1="' + padL + '" y1="' + zeroY.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + zeroY.toFixed(1) + '"></line>');

    rows.forEach(function (r, i) {
      var cx = padL + i * gw + gw / 2;
      parts.push('<rect class="b-cost" x="' + (cx - bw - 2).toFixed(1) + '" y="' + barY(r.totalCost).toFixed(1) +
        '" width="' + bw.toFixed(1) + '" height="' + barH(r.totalCost).toFixed(1) + '" rx="2"></rect>');
      parts.push('<rect class="b-rev" x="' + (cx + 2).toFixed(1) + '" y="' + barY(r.netRevenue).toFixed(1) +
        '" width="' + bw.toFixed(1) + '" height="' + barH(r.netRevenue).toFixed(1) + '" rx="2"></rect>');
      parts.push('<text class="ax" x="' + cx.toFixed(1) + '" y="' + (H - 12) + '" text-anchor="middle">' + r.month + '</text>');
    });

    var pts = rows.map(function (r, i) {
      return (padL + i * gw + gw / 2).toFixed(1) + "," + cumY(r.cumulativeCash).toFixed(1);
    }).join(" ");
    parts.push('<polyline class="cum" points="' + pts + '"></polyline>');
    rows.forEach(function (r, i) {
      parts.push('<circle class="cum-dot" cx="' + (padL + i * gw + gw / 2).toFixed(1) +
        '" cy="' + cumY(r.cumulativeCash).toFixed(1) + '" r="3"></circle>');
    });

    el("chart").innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="กราฟต้นทุนรวม รายได้สุทธิ และเงินสดสะสมรายเดือน">' +
      parts.join("") + "</svg>";
  }

  function renderSummary(f) {
    var s = f.summary;
    var be = s.breakEvenMonth;
    el("investment-summary").innerHTML =
      '<div class="is-head"><span class="is-eyebrow">Investment Summary</span>' +
      '<span class="is-scenario">' + ({ conservative: "Conservative", base: "Base Case", aggressive: "Aggressive" }[scenario]) +
      ' · ' + n(state.months) + ' เดือน</span></div>' +
      '<div class="is-grid">' +
        '<div class="is-cell"><small>Required Investment</small><strong>' + baht(s.totalInvestment) + '</strong><span>ต้นทุนคงที่ + การตลาด ตลอดช่วง</span></div>' +
        '<div class="is-cell"><small>Maximum Cash Exposure</small><strong>' + baht(s.maxCashExposure) + '</strong><span>เงินสดติดลบสูงสุดที่ต้องรองรับ</span></div>' +
        '<div class="is-cell"><small>Projected Customers</small><strong>' + n(s.totalNewCustomers) + '</strong><span>ลูกค้าใหม่สะสม</span></div>' +
        '<div class="is-cell"><small>Projected Net Revenue</small><strong>' + baht(s.totalNetRevenue) + '</strong><span>หลังหักการเก็บเงินและส่วนแบ่ง</span></div>' +
        '<div class="is-cell"><small>Projected Contribution</small><strong class="' + (s.cumulativeContribution >= 0 ? "pos" : "neg") + '">' +
          baht(s.cumulativeContribution) + '</strong><span>รายได้สุทธิ ลบต้นทุนการตลาด</span></div>' +
        '<div class="is-cell is-be"><small>Break-even</small><strong>' + (be ? "เดือน " + be : "ยังไม่ถึง") + '</strong>' +
          '<span>' + (be ? "รายได้สุทธิคลุมต้นทุนรวมของเดือนนั้น" : "ภายใน " + n(state.months) + " เดือนที่จำลอง") + '</span></div>' +
      '</div>' +
      '<p class="is-foot">' + summaryVerdict(f) + '</p>';
  }

  function summaryVerdict(f) {
    var s = f.summary;
    if (!s.breakEvenMonth) {
      return "ภายใน " + n(state.months) + " เดือนนี้ รายได้สุทธิยังไม่คลุมต้นทุนรวมสักเดือน " +
        "ตัวแปรที่ขยับผลได้มากที่สุดคืออายุลูกค้า สัดส่วนแพ็กเกจ และจำนวนลูกค้าจาก organic — ลองเลื่อนดูได้ที่ขั้นตอน 02";
    }
    if (s.cumulativeContribution < 0) {
      return "ถึงจุดที่รายได้สุทธิคลุมต้นทุนได้ในเดือน " + s.breakEvenMonth +
        " แต่ Contribution สะสมยังติดลบ แปลว่ายังต้องเติมเงินอยู่ เงินสดติดลบสูงสุดที่ต้องรองรับคือ " + baht(s.maxCashExposure);
    }
    return "ถึงจุดคุ้มทุนในเดือน " + s.breakEvenMonth + " และ Contribution สะสมเป็นบวก " +
      baht(s.cumulativeContribution) + " เงินสดติดลบสูงสุดระหว่างทาง " + baht(s.maxCashExposure);
  }

  function renderFormulaList(f) {
    var r = f.revenue;
    el("formula-list").innerHTML =
      "<pre>" +
      "Gross Revenue / เดือน   = Σ ( สัดส่วน × ราคา × ความถี่ )\n" +
      "Collected               = Gross × Collection Rate\n" +
      "After Network Share     = Collected × ( 1 − ส่วนแบ่งเครือข่าย )\n" +
      "Partner Cut             = " + (state.itBase === "gross" ? "Collected" : "After Network Share") + " × ส่วนแบ่งพาร์ตเนอร์\n" +
      "Net Revenue / เดือน     = After Network Share − Partner Cut\n\n" +
      "Gross LTV               = Gross / เดือน × ( อายุลูกค้า ÷ 30 )\n" +
      "Net LTV                 = Net / เดือน × ( อายุลูกค้า ÷ 30 )\n\n" +
      "Impressions             = ค่าโฆษณา ÷ CPM × 1,000\n" +
      "Clicks                  = Impressions × CTR\n" +
      "New Paid Customers      = Clicks × CVR\n" +
      "Leads (ก่อนเปิดขาย)      = Clicks × คลิก→รายชื่อ\n\n" +
      "Paid CPA                = ค่าโฆษณา ÷ ลูกค้าจากโฆษณา\n" +
      "Blended CAC             = ( ค่าโฆษณา + ค่าคอนเทนต์ ) ÷ ลูกค้าใหม่ทั้งหมด\n" +
      "Monthly Churn           = 1 ÷ ( อายุลูกค้า ÷ 30 )\n" +
      "Active Customers        = Active ก่อนหน้า × ( 1 − Churn ) + ลูกค้าใหม่\n\n" +
      "Contribution            = Net Revenue − ต้นทุนการตลาด\n" +
      "Cash Flow               = Net Revenue − ( ต้นทุนการตลาด + ต้นทุนคงที่ )\n" +
      "Break-even Month        = เดือนแรกที่ Net Revenue ≥ Total Cost\n" +
      "Max Cash Exposure       = ค่าติดลบสูงสุดของเงินสดสะสม" +
      "</pre>" +
      "<p class='muted'>ค่าปัจจุบัน: Gross " + baht(r.grossMonth, 2) + " / เดือน → Net " + baht(r.netMonth, 2) +
      " / เดือน (margin " + n(r.margin, 1) + " %) · Net LTV " + baht(r.netLTV, 2) + "</p>";
  }

  /* ============================================================
     RENDER ALL
     ============================================================ */
  var latest = null;

  function render() {
    var f = M.forecast(state);
    latest = f;

    var sum = f.revenue.mixShareTotal;
    var mix = el("mix-check");
    mix.textContent = "สัดส่วนผู้ใช้รวม " + n(sum) + " % " + (Math.round(sum) === 100 ? "— ครบพอดี" : "— ควรรวมได้ 100 %");
    mix.className = "mix-check " + (Math.round(sum) === 100 ? "ok" : "bad");

    renderHero(f);
    renderStep1(f);
    renderFunnel(f);
    renderMediaMetrics(f);
    renderWaterfall(f);
    renderUnitMetrics(f);
    renderForecast(f);
    renderSummary(f);
    renderFormulaList(f);
  }

  /* ============================================================
     EVENTS
     ============================================================ */
  function bind() {
    document.addEventListener("input", function (e) {
      var t = e.target;
      if (t.dataset && t.dataset.key) {
        state[t.dataset.key] = parseFloat(t.value);
        var c = [].concat(CONTROLS.investment, CONTROLS.model, CONTROLS.media)
          .filter(function (x) { return x.k === t.dataset.key; })[0];
        if (c) el("v-" + c.k).textContent = c.fmt(state[c.k]);
        render();
      } else if (t.dataset && t.dataset.pkg !== undefined) {
        var i = +t.dataset.pkg, fld = t.dataset.field;
        state.packages[i][fld] = parseFloat(t.value);
        el("pv-" + i + "-" + fld).textContent = n(state.packages[i][fld], 0) + t.dataset.suffix;
        render();
      }
    });

    document.addEventListener("change", function (e) {
      if (e.target.id === "c-itBase") { state.itBase = e.target.value; render(); }
    });

    document.addEventListener("click", function (e) {
      var sc = e.target.closest("[data-scenario]");
      if (sc) {
        scenario = sc.dataset.scenario;
        var preset = M.SCENARIOS[scenario];
        Object.keys(preset).forEach(function (k) { state[k] = preset[k]; });
        document.querySelectorAll("[data-scenario]").forEach(function (b) {
          b.classList.toggle("is-active", b === sc);
        });
        syncControlValues();
        render();
        return;
      }

      if (e.target.closest("#reset-btn")) {
        state = M.clone(M.DEFAULTS);
        scenario = "base";
        document.querySelectorAll("[data-scenario]").forEach(function (b) {
          b.classList.toggle("is-active", b.dataset.scenario === "base");
        });
        buildControls();
        render();
        return;
      }

      var why = e.target.closest("[data-explain]");
      if (why) { openExplain(why.dataset.explain); return; }

      if (e.target.closest(".js-print")) window.print();
    });

    el("explain-close").addEventListener("click", function () { el("explain").close(); });
    el("explain").addEventListener("click", function (e) {
      if (e.target === el("explain")) el("explain").close();
    });
  }

  function openExplain(key) {
    var spec = FORMULAS[key];
    if (!spec || !latest) return;
    el("explain-kicker").textContent = "วิธีคำนวณ";
    el("explain-title").textContent = spec.title;
    el("explain-body").innerHTML = spec.body(latest.revenue, latest);
    el("explain").showModal();
  }

  /* ---------- theme ---------- */
  (function theme() {
    var root = document.documentElement;
    var btn = el("theme-toggle"), icon = el("theme-icon"), label = el("theme-label");
    function stored() { try { return localStorage.getItem("bizwap-theme"); } catch (e) { return null; } }
    function save(v) { try { localStorage.setItem("bizwap-theme", v); } catch (e) {} }
    function sysDark() { return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches; }
    function isDark() { var t = root.getAttribute("data-theme"); return t ? t === "dark" : sysDark(); }
    function paint() {
      var d = isDark();
      icon.textContent = d ? "☀" : "☾";
      label.textContent = d ? "Light" : "Dark";
      btn.setAttribute("aria-label", d ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด");
    }
    var pref = stored();
    if (pref === "dark" || pref === "light") root.setAttribute("data-theme", pref);
    paint();
    btn.addEventListener("click", function () {
      var next = isDark() ? "light" : "dark";
      root.setAttribute("data-theme", next); save(next); paint();
    });
  })();

  buildControls();
  bind();
  render();
})();
