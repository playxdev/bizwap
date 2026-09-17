/* ============================================================
   Investment Decision Simulator — presentation layer
   Reads SimModel, writes the DOM. No business formula lives here.
   ============================================================ */
(function () {
  "use strict";

  var M = window.SimModel;
  var state = M.clone(M.DEFAULTS);
  var scenario = "viable";
  var stressMul = { cvr: 100, cpm: 100, lifetimeDays: 100, collectionRate: 100, organicAtEnd: 100 };
  var latest = null;

  /* ============================================================
     URL STATE — เก็บสมมติฐานทั้งชุดไว้ใน # ของลิงก์
     เก็บเฉพาะค่าที่ต่างจากค่าตั้งต้น ลิงก์จึงสั้นเมื่อแก้ไม่กี่ตัว
     ============================================================ */
  var SHORT = {
    initialInvestment: "ii", fixedCost: "fc", contentSpend: "cs", adsTest: "at", adsScale: "as",
    months: "mo", adsStartMonth: "asm", launchMonth: "lm", scaleMonth: "sm",
    collectionRate: "cr", aisShare: "ns", itShare: "ps", lifetimeDays: "ld",
    cpm: "cpm", ctr: "ctr", leadRate: "lr", leadToCustomer: "l2c", cvr: "cvr",
    organicAtEnd: "org"
  };
  var LONG = {};
  Object.keys(SHORT).forEach(function (k) { LONG[SHORT[k]] = k; });

  function encodeState() {
    var d = M.DEFAULTS, parts = ["sc=" + scenario];
    Object.keys(SHORT).forEach(function (k) {
      if (state[k] !== d[k]) parts.push(SHORT[k] + "=" + state[k]);
    });
    if (state.itBase !== d.itBase) parts.push("pb=" + state.itBase);

    var pkgChanged = state.packages.some(function (p, i) {
      return p.price !== d.packages[i].price || p.freq !== d.packages[i].freq || p.share !== d.packages[i].share;
    });
    if (pkgChanged) {
      parts.push("pk=" + state.packages.map(function (p) {
        return [p.price, p.freq, p.share].join(".");
      }).join("_"));
    }
    var stressed = Object.keys(stressMul).filter(function (k) { return stressMul[k] !== 100; });
    if (stressed.length) {
      parts.push("st=" + stressed.map(function (k) { return k + "." + stressMul[k]; }).join("_"));
    }
    return parts.join("&");
  }

  function decodeState(hash) {
    var raw = (hash || "").replace(/^#/, "");
    if (!raw) return false;
    var found = false;
    raw.split("&").forEach(function (pair) {
      var i = pair.indexOf("="); if (i < 0) return;
      var k = pair.slice(0, i), v = pair.slice(i + 1);

      if (k === "sc" && M.SCENARIOS[v]) { state = M.applyScenario(state, v); scenario = v; found = true; return; }
      if (k === "pb" && (v === "net" || v === "gross")) { state.itBase = v; found = true; return; }
      if (k === "pk") {
        v.split("_").forEach(function (chunk, idx) {
          var n3 = chunk.split(".").map(parseFloat);
          if (state.packages[idx] && n3.length === 3 && n3.every(isFinite)) {
            state.packages[idx].price = n3[0];
            state.packages[idx].freq = n3[1];
            state.packages[idx].share = n3[2];
          }
        });
        found = true; return;
      }
      if (k === "st") {
        v.split("_").forEach(function (chunk) {
          var bits = chunk.split(".");
          if (stressMul[bits[0]] !== undefined && isFinite(parseFloat(bits[1]))) {
            stressMul[bits[0]] = parseFloat(bits[1]);
          }
        });
        found = true; return;
      }
      if (LONG[k] !== undefined) {
        var num = parseFloat(v);
        if (isFinite(num)) { state[LONG[k]] = num; found = true; }
      }
    });
    return found;
  }

  var hashTimer = null;
  function syncURL() {
    clearTimeout(hashTimer);
    hashTimer = setTimeout(function () {
      try { history.replaceState(null, "", "#" + encodeState()); } catch (e) {}
    }, 250);
  }

  /* ---------- formatting ---------- */
  function n(v, d) {
    if (!isFinite(v)) return "—";
    return v.toLocaleString("en-US", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  }
  function baht(v, d) { return isFinite(v) ? n(v, d) + " ฿" : "—"; }
  function signed(v, d) { return (v > 0 ? "+" : "") + n(v, d) + " ฿"; }
  function el(id) { return document.getElementById(id); }
  function month(v) { return v ? "เดือน " + v : "ยังไม่ถึง"; }

  function confBadge(key) {
    var m = M.META[key];
    if (!m) return "";
    var out = '<span class="badge b-' + m.conf + '">' + M.CONF_LABEL[m.conf] + "</span>";
    if (m.impact) out += '<span class="badge b-impact">HIGH IMPACT</span>';
    return out;
  }

  /* ============================================================
     CONTROL DEFINITIONS — declared once, drive markup and sync
     ============================================================ */
  var CONTROLS = {
    investment: [
      { k: "initialInvestment", label: "Initial Investment", min: 0, max: 2000000, step: 10000, fmt: baht,
        help: "เงินก้อนที่ใส่ก่อนเริ่มเดือนที่ 1 ตั้ง 0 ได้ถ้าใช้เงินหมุนรายเดือนอย่างเดียว" },
      { k: "fixedCost", label: "Fixed Cost / เดือน", min: 0, max: 300000, step: 1000, fmt: baht,
        help: "ทีมและระบบ จ่ายเท่ากันทุกเดือนไม่ว่าจะยิงโฆษณาหรือไม่" },
      { k: "contentSpend", label: "งบคอนเทนต์ / เดือน", min: 0, max: 40000, step: 500, fmt: baht,
        help: "SEO, AEO, GEO และการผลิตคอนเทนต์ นับเป็นต้นทุนการตลาด" },
      { k: "adsTest", label: "งบโฆษณา / เดือน · ช่วงทดสอบ", min: 0, max: 50000, step: 500, fmt: baht,
        help: "ช่วงที่ยังหาว่ากลุ่มไหนและชิ้นงานไหนได้ผล" },
      { k: "adsScale", label: "งบโฆษณา / เดือน · ช่วงขยาย", min: 0, max: 150000, step: 1000, fmt: baht,
        help: "ช่วงหลังเปิดขาย เมื่อรู้ต้นทุนต่อลูกค้าจริงแล้ว" },
      { k: "months", label: "Investment Period", min: 3, max: 36, step: 1, fmt: function (v) { return n(v) + " เดือน"; },
        help: "ช่วงเวลาที่แบบจำลองคำนวณไปข้างหน้า" },
      { k: "adsStartMonth", label: "เริ่มยิงโฆษณาเดือนที่", min: 1, max: 12, step: 1, fmt: function (v) { return "เดือน " + n(v); },
        help: "ก่อนเปิดขาย โฆษณาได้รายชื่อ ยังไม่ได้ลูกค้าที่จ่ายเงิน" },
      { k: "launchMonth", label: "เปิดขายเดือนที่", min: 1, max: 24, step: 1, fmt: function (v) { return "เดือน " + n(v); },
        help: "เดือนแรกที่ระบบตัดเงินได้ รายได้เริ่มนับจากเดือนนี้" },
      { k: "scaleMonth", label: "เริ่มใช้งบระดับขยายเดือนที่", min: 1, max: 24, step: 1, fmt: function (v) { return "เดือน " + n(v); },
        help: "เดือนแรกที่สลับจากงบทดสอบไปเป็นงบขยาย" }
    ],
    model: [
      { k: "collectionRate", label: "Collection Rate", min: 0, max: 100, step: 1, fmt: function (v) { return n(v, 0) + " %"; },
        help: "เรียกเก็บผ่านบิลมือถือสำเร็จกี่ % บางวันยอดเงินในซิมไม่พอ",
        typical: "บริการหักรายวันผ่านบิลมือถือ มักอยู่ราว 70–90 %" },
      { k: "aisShare", label: "Revenue Share — เครือข่าย", min: 0, max: 60, step: 1, fmt: function (v) { return n(v, 0) + " %"; },
        help: "ค่าช่องทางตัดเงินผ่านบิลมือถือ" },
      { k: "itShare", label: "Partner Share — ฝั่ง IT", min: 0, max: 60, step: 1, fmt: function (v) { return n(v, 0) + " %"; },
        help: "หักจากยอดไหน เลือกได้ในช่องถัดไป" },
      { k: "lifetimeDays", label: "Customer Lifetime", min: 7, max: 540, step: 1, fmt: function (v) { return n(v) + " วัน"; },
        help: "อยู่กี่วันก่อนเลิกจ่าย กำหนดทั้ง LTV และอัตราหลุดต่อเดือน",
        typical: "ยังไม่มีข้อมูลจริงของบริการนี้ — ต้องวัดหลังเปิดขายเป็นอันดับแรก" },
      { k: "organicAtEnd", label: "Organic Customers / เดือน", min: 0, max: 3000, step: 10, fmt: function (v) { return n(v) + " คน"; },
        help: "ระดับสูงสุดที่คาดว่าจะไต่ถึงภายใน 12 เดือนหลังเปิดขาย ไม่ได้จ่ายค่าโฆษณา" }
    ],
    media: [
      { k: "cpm", label: "CPM", min: 10, max: 400, step: 5, fmt: baht,
        help: "ค่าโฆษณาต่อการแสดงผล 1,000 ครั้ง",
        typical: "ตลาดไทย Facebook/IG ปกติ 60–150 ฿" },
      { k: "ctr", label: "CTR", min: 0.1, max: 8, step: 0.1, fmt: function (v) { return n(v, 1) + " %"; },
        help: "คนเห็นโฆษณา 100 คน กดกี่คน",
        typical: "ปกติ 0.5–2 % · ชิ้นงานที่เก่งมาก 3–4 % · เพดาน 8 % ตั้งเผื่อไว้แล้ว" },
      { k: "cvr", label: "CVR · คลิก → ลูกค้า", min: 0.1, max: 25, step: 0.1, fmt: function (v) { return n(v, 1) + " %"; },
        help: "หลังเปิดขาย คนกดเข้าเว็บ 100 คน จ่ายเงินกี่คน",
        typical: "เว็บทั่วไป 1–5 % · ดีมาก 10 % · เพดาน 25 % เพราะ DCB กดยืนยันครั้งเดียวจบ" },
      { k: "leadRate", label: "คลิก → รายชื่อ", min: 0, max: 40, step: 0.5, fmt: function (v) { return n(v, 1) + " %"; },
        help: "ช่วงยังขายไม่ได้ คนกดเข้ามาแล้ว Add LINE หรือทิ้งอีเมลกี่ %",
        typical: "ปกติ 10–25 % สูงกว่าการจ่ายเงินเพราะไม่ต้องควักกระเป๋า" },
      { k: "leadToCustomer", label: "รายชื่อสะสม → ลูกค้า", min: 0, max: 60, step: 1, fmt: function (v) { return n(v, 0) + " %"; },
        help: "ตอนเปิดขาย รายชื่อที่สะสมไว้แปลงเป็นลูกค้ากี่ %",
        typical: "แคมเปญที่ดีแปลงรายชื่อได้ 5–20 %" }
    ]
  };

  /* ============================================================
     "WHY THIS NUMBER?" — formula + inputs + confidence
     ============================================================ */
  function conf(key) {
    var m = M.META[key];
    if (!m) return "";
    return "<p class='conf-line'><span class='badge b-" + m.conf + "'>" + M.CONF_LABEL[m.conf] + "</span>" +
      (m.impact ? "<span class='badge b-impact'>HIGH IMPACT</span>" : "") +
      (m.note ? " " + m.note : "") + "</p>";
  }

  var FORMULAS = {
    grossMonth: {
      title: "Gross Revenue ต่อลูกค้า ต่อเดือน",
      body: function (r) {
        return "<p>ยอดที่เรียกเก็บต่อลูกค้า 1 คน ต่อเดือน ก่อนหักอะไรทั้งสิ้น</p>" +
          "<pre>Σ ( สัดส่วนผู้ใช้ × ราคา × ความถี่ต่อเดือน )</pre>" +
          "<table class='plain'><tbody>" +
          state.packages.map(function (p) {
            return "<tr><td>" + p.label + "</td><td>" + p.share + " % × " + p.price + " ฿ × " + p.freq +
              "</td><td class='num'>" + baht(p.share / 100 * p.price * p.freq, 2) + "</td></tr>";
          }).join("") +
          "<tr class='tot'><td>รวม</td><td></td><td class='num'>" + baht(r.grossMonth, 2) + "</td></tr>" +
          "</tbody></table>" + conf("packagePrice");
      }
    },
    netMonth: {
      title: "Net Revenue ต่อลูกค้า ต่อเดือน",
      body: function (r) {
        return "<p>ยอดที่เหลือถึงเราจริง หลังหักการเก็บเงินไม่ผ่านและส่วนแบ่งทุกฝ่าย</p>" +
          "<pre>Gross × Collection Rate × (1 − Revenue Share) − Partner Share</pre>" +
          "<table class='plain'><tbody>" +
          "<tr><td>Gross</td><td class='num'>" + baht(r.grossMonth, 2) + "</td></tr>" +
          "<tr><td>เก็บสำเร็จ " + state.collectionRate + " %</td><td class='num'>" + baht(r.collected, 2) + "</td></tr>" +
          "<tr><td>หลังหักเครือข่าย " + state.aisShare + " %</td><td class='num'>" + baht(r.afterNetwork, 2) + "</td></tr>" +
          "<tr><td>หักพาร์ตเนอร์ " + state.itShare + " % (" + (state.itBase === "gross" ? "ฐาน Gross" : "ฐาน Net") + ")</td><td class='num'>− " + baht(r.partnerCut, 2) + "</td></tr>" +
          "<tr class='tot'><td>Net · margin " + n(r.margin, 1) + " %</td><td class='num'>" + baht(r.netMonth, 2) + "</td></tr>" +
          "</tbody></table>" + conf("collectionRate");
      }
    },
    grossLTV: {
      title: "Gross LTV",
      body: function (r) {
        return "<p>รายได้รวมตลอดอายุลูกค้า <strong>ก่อน</strong>หักการเก็บเงินไม่ผ่านและส่วนแบ่ง ใช้เทียบราคาขาย ไม่ใช้ตัดสินงบโฆษณา</p>" +
          "<pre>Gross ต่อเดือน × ( Customer Lifetime ÷ 30 )</pre>" +
          "<p>" + baht(r.grossMonth, 2) + " × " + n(r.lifeMonths, 2) + " เดือน = <strong>" + baht(r.grossLTV, 2) + "</strong></p>" +
          conf("lifetimeDays");
      }
    },
    netLTV: {
      title: "Net LTV",
      body: function (r) {
        return "<p>เงินที่ลูกค้า 1 คนทำให้เราจริงตลอดอายุการใช้งาน ตัวนี้เท่านั้นที่ใช้ตั้งเพดานค่าได้ลูกค้า</p>" +
          "<pre>Net ต่อเดือน × ( Customer Lifetime ÷ 30 )</pre>" +
          "<p>" + baht(r.netMonth, 2) + " × " + n(r.lifeMonths, 2) + " เดือน = <strong>" + baht(r.netLTV, 2) + "</strong></p>" +
          "<p class='muted'>Gross LTV คือ " + baht(r.grossLTV, 2) + " ถ้าคิดงบโฆษณาจาก Gross จะประเมินสูงเกินจริง " +
          n(r.grossLTV / Math.max(r.netLTV, 0.0001), 1) + " เท่า</p>" + conf("lifetimeDays");
      }
    },
    paidCPA: {
      title: "Paid CPA",
      body: function (r, f) {
        var s = f.summary;
        return "<p>ค่าโฆษณาที่จ่ายไป หารด้วยจำนวนลูกค้าที่ได้จากโฆษณาโดยตรง <strong>ไม่รวม organic</strong></p>" +
          "<pre>ค่าโฆษณาสะสม ÷ ลูกค้าที่มาจากโฆษณา</pre>" +
          "<p>" + baht(s.totalAds) + " ÷ " + n(s.totalPaidCustomers) + " คน = <strong>" + baht(s.paidCPA, 2) + "</strong></p>" +
          "<p class='muted'>ใช้ตัดสินใจระดับชุดโฆษณา — เพิ่มงบ คงงบ ลดงบ หรือปิด</p>";
      }
    },
    blendedCAC: {
      title: "Blended CAC",
      body: function (r, f) {
        var s = f.summary;
        return "<p>ต้นทุนการตลาดทั้งหมด หารด้วยลูกค้าใหม่ทั้งหมด <strong>รวม organic</strong></p>" +
          "<pre>( ค่าโฆษณา + ค่าคอนเทนต์ ) ÷ ลูกค้าใหม่ทั้งหมด</pre>" +
          "<p>" + baht(s.totalMarketing) + " ÷ " + n(s.totalNewCustomers) + " คน = <strong>" + baht(s.blendedCAC, 2) + "</strong></p>" +
          "<p class='muted'>Organic คิดเป็น " + n(s.organicShare, 1) + " % ของลูกค้าใหม่ จึงดึง Blended CAC ให้ต่ำกว่า Paid CPA " +
          baht(s.paidCPA - s.blendedCAC, 2) + " ต่อคน นั่นคือผลตอบแทนของงบคอนเทนต์</p>" + conf("organicAtEnd");
      }
    },
    contribution: {
      title: "Contribution",
      body: function (r, f) {
        var s = f.summary;
        return "<p>รายได้สุทธิ ลบต้นทุนการตลาดที่ผันแปร — <strong>ยังไม่หักต้นทุนคงที่</strong></p>" +
          "<pre>Net Revenue − ( ค่าโฆษณา + ค่าคอนเทนต์ )</pre>" +
          "<p>" + baht(s.totalNetRevenue) + " − " + baht(s.totalMarketing) + " = <strong>" + baht(s.cumulativeContribution) + "</strong></p>" +
          "<p class='muted'>Contribution บวก แปลว่าการตลาดเลี้ยงตัวเองได้ ยังไม่ได้แปลว่าธุรกิจกำไร ต้องคลุมต้นทุนคงที่ " +
          baht(state.fixedCost) + " ต่อเดือนก่อน</p>";
      }
    },
    payback: {
      title: "Payback Period ต่อลูกค้า",
      body: function (r, f) {
        var s = f.summary;
        return "<p>เก็บเงินกี่วัน ถึงคืนค่าที่จ่ายไปเพื่อได้ลูกค้า 1 คน</p>" +
          "<pre>Blended CAC ÷ ( Net Revenue ต่อเดือน ÷ 30 )</pre>" +
          "<p>" + baht(s.blendedCAC, 2) + " ÷ " + baht(r.netMonth / 30, 2) + " ต่อวัน = <strong>" + n(s.paybackDays) + " วัน</strong></p>" +
          "<p class='muted'>ถ้ายาวกว่า Customer Lifetime (" + n(state.lifetimeDays) + " วัน) แปลว่าลูกค้าเลิกจ่ายก่อนจะคืนทุน</p>";
      }
    },
    roas: {
      title: "ROAS",
      body: function (r, f) {
        var s = f.summary;
        return "<p>รายได้สุทธิสะสม หารด้วยค่าโฆษณาสะสม</p>" +
          "<pre>Net Revenue ÷ ค่าโฆษณา</pre>" +
          "<p>" + baht(s.totalNetRevenue) + " ÷ " + baht(s.totalAds) + " = <strong>" + n(s.roas, 2) + "</strong></p>" +
          "<p class='muted'>ไม่ใช่กำไร เพราะยังไม่หักค่าคอนเทนต์ " + baht(s.totalMarketing - s.totalAds) +
          " และต้นทุนคงที่ " + baht(s.totalFixed) + " ตลอดช่วงจำลอง</p>";
      }
    },
    totalInvestment: {
      title: "Total Investment",
      body: function (r, f) {
        var s = f.summary;
        return "<p>เงินออกทั้งหมดตลอดช่วงที่จำลอง</p>" +
          "<pre>Initial Investment + Σ ( ต้นทุนการตลาด + ต้นทุนคงที่ )</pre>" +
          "<table class='plain'><tbody>" +
          "<tr><td>Initial Investment</td><td class='num'>" + baht(s.initialInvestment) + "</td></tr>" +
          "<tr><td>ต้นทุนคงที่ " + n(state.months) + " เดือน</td><td class='num'>" + baht(s.totalFixed) + "</td></tr>" +
          "<tr><td>ค่าโฆษณา</td><td class='num'>" + baht(s.totalAds) + "</td></tr>" +
          "<tr><td>ค่าคอนเทนต์</td><td class='num'>" + baht(s.totalMarketing - s.totalAds) + "</td></tr>" +
          "<tr class='tot'><td>รวม</td><td class='num'>" + baht(s.totalInvestment) + "</td></tr>" +
          "</tbody></table>" +
          "<p class='muted'>ต้นทุนคงที่คิดเป็น " + n(100 - s.marketingShareOfBurn, 1) + " % ของเงินออกทั้งหมด</p>" + conf("fixedCost");
      }
    },
    maxCash: {
      title: "Maximum Cash Exposure",
      body: function (r, f) {
        var s = f.summary;
        var worst = f.rows.reduce(function (a, b) { return b.cumulativeCash < a.cumulativeCash ? b : a; }, f.rows[0]);
        return "<p>จุดต่ำสุดของเงินสดสะสม คือเงินที่ต้องเตรียมรองรับจริง ไม่ใช่ยอดรวมที่จ่ายทั้งหมด</p>" +
          "<pre>| ค่าต่ำสุดของ Cumulative Cash Flow |</pre>" +
          "<p>ต่ำสุดที่เดือน " + worst.month + " = <strong>" + baht(s.maxCashRequired) + "</strong></p>" +
          "<p class='muted'>ต่างจาก Total Investment (" + baht(s.totalInvestment) + ") เพราะรายได้ที่เข้ามาระหว่างทางช่วยชดเชยเงินออกบางส่วน</p>";
      }
    },
    operatingBE: {
      title: "Operating Break-even",
      body: function (r, f) {
        var s = f.summary;
        return "<p>เดือนแรกที่ Contribution คลุมต้นทุนคงที่ได้ — ธุรกิจเลี้ยงตัวเองได้ในเดือนนั้น แต่<strong>ยังไม่ได้เงินลงทุนคืน</strong></p>" +
          "<pre>เดือนแรกที่ Contribution ≥ Fixed Cost</pre>" +
          "<p>ผลตอนนี้: <strong>" + month(s.operatingBreakEven) + "</strong></p>" +
          "<p class='muted'>ต้องมีลูกค้าที่ยังจ่ายอยู่พร้อมกันราว " + n(s.breakEvenCustomers) + " คน</p>";
      }
    },
    investmentPayback: {
      title: "Investment Payback",
      body: function (r, f) {
        var s = f.summary;
        var scan = M.horizonScan(state, 60);
        return "<p>เดือนแรกที่เงินสดสะสมกลับมาเป็นบวก — ได้เงินที่ลงไปทั้งหมดคืนแล้ว</p>" +
          "<pre>เดือนแรกที่ Cumulative Cash Flow ≥ 0</pre>" +
          "<p>ในช่วง " + n(state.months) + " เดือนที่จำลอง: <strong>" + month(s.paybackMonth) + "</strong></p>" +
          (s.paybackMonth ? "" :
            "<p class='muted'>ขยายการมองไปถึง 60 เดือนด้วยสมมติฐานชุดเดียวกัน: " +
            (scan.paybackMonth ? "คืนทุนที่ <strong>เดือน " + scan.paybackMonth + "</strong>" :
              "<strong>ยังไม่คืนทุนเลย</strong> — สมมติฐานชุดนี้ไม่พาไปถึงจุดคืนทุนไม่ว่าจะรอนานแค่ไหน") + "</p>") +
          "<p class='muted'>คนละเรื่องกับ Operating Break-even ซึ่งดูแค่ว่าเดือนนั้นเลี้ยงตัวเองได้หรือไม่</p>";
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
        '<label for="c-' + c.k + '">' + c.label + "</label>" +
        '<output class="ctrl-val" id="v-' + c.k + '">' + c.fmt(v) + "</output>" +
      "</div>" +
      '<div class="ctrl-badges">' + confBadge(c.k) + "</div>" +
      '<input type="range" id="c-' + c.k + '" data-key="' + c.k + '" min="' + c.min + '" max="' + c.max +
        '" step="' + c.step + '" value="' + v + '">' +
      '<span class="ctrl-help">' + c.help + "</span>" +
      (c.typical ? '<span class="ctrl-typical">ช่วงที่พบจริง · ' + c.typical + "</span>" : "") +
      (M.META[c.k] && M.META[c.k].impact ? '<span class="ctrl-sens" id="sens-' + c.k + '"></span>' : "") +
    "</div>";
  }

  function packageControlsHTML() {
    return state.packages.map(function (p, i) {
      var rows = [
        { f: "price", label: "ราคา", min: 0, max: 500, step: 1, suffix: " ฿" },
        { f: "freq", label: p.key === "monthly" ? "ครั้ง / เดือน" : (p.key === "daily" ? "วันที่ใช้ / เดือน" : "ครั้ง / เดือน"), min: 0, max: 60, step: 1, suffix: "" },
        { f: "share", label: "สัดส่วนผู้ใช้", min: 0, max: 100, step: 1, suffix: " %" }
      ];
      return '<div class="pkg"><div class="pkg-name">' + p.label + '<span class="badge b-estimate">ESTIMATE</span></div>' +
        rows.map(function (r) {
          return '<div class="ctrl compact"><div class="ctrl-top">' +
            '<label for="p-' + i + "-" + r.f + '">' + r.label + "</label>" +
            '<output class="ctrl-val" id="pv-' + i + "-" + r.f + '">' + n(p[r.f], 0) + r.suffix + "</output></div>" +
            '<input type="range" id="p-' + i + "-" + r.f + '" data-pkg="' + i + '" data-field="' + r.f +
            '" data-suffix="' + r.suffix + '" min="' + r.min + '" max="' + r.max + '" step="' + r.step + '" value="' + p[r.f] + '"></div>';
        }).join("") + "</div>";
    }).join("");
  }

  function itBaseHTML() {
    return '<div class="ctrl"><div class="ctrl-top"><label for="c-itBase">Partner Share หักจากยอดไหน</label></div>' +
      '<div class="ctrl-badges"><span class="badge b-confirmed">CONFIRMED</span></div>' +
      '<select id="c-itBase">' +
      '<option value="net"' + (state.itBase === "net" ? " selected" : "") + ">Net Revenue — หักหลังแบ่งเครือข่ายแล้ว</option>" +
      '<option value="gross"' + (state.itBase === "gross" ? " selected" : "") + ">Gross Revenue — หักจากยอดเก็บได้เต็ม</option>" +
      "</select><span class='ctrl-help'>สัญญาส่วนใหญ่ใช้ Net · เปลี่ยนแล้วรายได้สุทธิเปลี่ยนทันที</span></div>";
  }

  function stressControlsHTML() {
    return M.STRESS_KEYS.map(function (k) {
      return '<div class="ctrl"><div class="ctrl-top">' +
        '<label for="s-' + k.key + '">' + k.label + "</label>" +
        '<output class="ctrl-val" id="sv-' + k.key + '">' + n(stressMul[k.key]) + " %</output></div>" +
        '<input type="range" id="s-' + k.key + '" data-stress="' + k.key + '" min="40" max="160" step="5" value="' + stressMul[k.key] + '">' +
        '<span class="ctrl-help">' + (k.dir === "up" ? "เลื่อนขึ้น = ต้นทุนแพงขึ้น" : "เลื่อนลง = แย่ลงกว่าที่ตั้งไว้") + "</span></div>";
    }).join("");
  }

  function buildControls() {
    el("controls-investment").innerHTML = CONTROLS.investment.map(sliderHTML).join("");
    el("controls-model").innerHTML = CONTROLS.model.map(sliderHTML).join("") + itBaseHTML();
    el("controls-media").innerHTML = CONTROLS.media.map(sliderHTML).join("");
    el("controls-packages").innerHTML = packageControlsHTML();
    el("controls-stress").innerHTML = stressControlsHTML();
  }

  function syncControls() {
    ["investment", "model", "media"].forEach(function (g) {
      CONTROLS[g].forEach(function (c) {
        var i = el("c-" + c.k), o = el("v-" + c.k);
        if (i) i.value = state[c.k];
        if (o) o.textContent = c.fmt(state[c.k]);
      });
    });
    state.packages.forEach(function (p, i) {
      ["price", "freq", "share"].forEach(function (f) {
        var inp = el("p-" + i + "-" + f), out = el("pv-" + i + "-" + f);
        if (inp) inp.value = p[f];
        if (out) out.textContent = n(p[f], 0) + (inp ? inp.dataset.suffix : "");
      });
    });
    M.STRESS_KEYS.forEach(function (k) {
      var i = el("s-" + k.key), o = el("sv-" + k.key);
      if (i) i.value = stressMul[k.key];
      if (o) o.textContent = n(stressMul[k.key]) + " %";
    });
    if (el("c-itBase")) el("c-itBase").value = state.itBase;
  }

  /* ============================================================
     OUTPUT RENDERING
     ============================================================ */
  function kpi(label, value, sub, mod, key) {
    return '<div class="kpi' + (mod ? " " + mod : "") + '"><small>' + label + "</small>" +
      "<strong>" + value + "</strong><span>" + (sub || "") + "</span>" +
      (key ? '<button class="why" data-explain="' + key + '" type="button" aria-label="ทำไมเป็นตัวเลขนี้">?</button>' : "") +
      "</div>";
  }

  function renderHero(f) {
    var s = f.summary;
    el("hero-kpis").innerHTML =
      kpi("Total Investment", baht(s.totalInvestment), n(state.months) + " เดือน", "", "totalInvestment") +
      kpi("Max Cash Exposure", baht(s.maxCashRequired), "เงินสดต่ำสุดที่ต้องรองรับ", "hl", "maxCash") +
      kpi("Projected Customers", n(s.totalNewCustomers), "paid " + n(s.totalPaidCustomers) + " · organic " + n(s.totalOrganicCustomers)) +
      kpi("Projected Net Revenue", baht(s.totalNetRevenue), "หลังหักส่วนแบ่งทั้งหมด") +
      kpi("Operating Break-even", month(s.operatingBreakEven), "Payback " + month(s.paybackMonth),
          s.operatingBreakEven ? "pos" : "neg", "operatingBE");
  }

  function renderSticky(f) {
    var s = f.summary;
    var items = [
      ["Investment", baht(s.totalInvestment), ""],
      ["Max Cash", baht(s.maxCashRequired), ""],
      ["Customers", n(s.totalNewCustomers), ""],
      ["Net Revenue", baht(s.totalNetRevenue), ""],
      ["Contribution", baht(s.cumulativeContribution), s.cumulativeContribution >= 0 ? "pos" : "neg"],
      ["Op. BE", month(s.operatingBreakEven), s.operatingBreakEven ? "pos" : "neg"],
      ["Payback", month(s.paybackMonth), s.paybackMonth ? "pos" : "neg"]
    ];
    el("ss-items").innerHTML = items.map(function (it) {
      return '<span class="ss-item"><small>' + it[0] + '</small><b class="' + it[2] + '">' + it[1] + "</b></span>";
    }).join("");
  }

  function renderInvestment(f) {
    var s = f.summary;
    el("fixed-hero").innerHTML =
      '<div class="fh-main"><small>Fixed Cost — ตัวขับต้นทุนหลักของธุรกิจนี้</small>' +
      "<strong>" + baht(state.fixedCost) + " <em>/ เดือน</em></strong>" +
      "<span>คิดเป็น " + n(100 - s.marketingShareOfBurn, 1) + " % ของเงินออกทั้งหมด และ " +
      baht(s.totalFixed) + " ตลอด " + n(state.months) + " เดือน · จ่ายเท่ากันทุกเดือนไม่ว่าจะขายได้หรือไม่</span>" +
      '<span class="badge b-confirmed">CONFIRMED</span></div>' +
      '<div class="fh-side"><div class="fh-bar"><i style="width:' + Math.min(100, 100 - s.marketingShareOfBurn) + '%"></i></div>' +
      '<div class="fh-legend"><span><i class="sw sw-fixed"></i>Fixed ' + n(100 - s.marketingShareOfBurn, 0) + " %</span>" +
      '<span><i class="sw sw-mkt"></i>Marketing ' + n(s.marketingShareOfBurn, 0) + " %</span></div></div>";

    el("invest-cards").innerHTML =
      kpi("Total Investment", baht(s.totalInvestment), "Initial " + baht(s.initialInvestment) + " + รายเดือน", "", "totalInvestment") +
      kpi("Monthly Burn", baht(s.monthlyBurn), "เฉลี่ยต่อเดือน") +
      kpi("Maximum Cash Required", baht(s.maxCashRequired), "จุดต่ำสุดของเงินสดสะสม", "hl", "maxCash") +
      kpi("Marketing % of Burn", n(s.marketingShareOfBurn, 1) + " %", "ที่เหลือคือต้นทุนคงที่");
  }

  function renderSensitivityInline(list) {
    list.forEach(function (x) {
      var node = el("sens-" + x.key);
      if (!node) return;
      node.innerHTML = "ถ้า" + x.desc + " (" + n(x.from) + " → " + n(x.to) + ") · Contribution " +
        '<b class="' + (x.deltaContribution < 0 ? "neg" : "pos") + '">' + signed(x.deltaContribution) + "</b>" +
        " · เงินสดที่ต้องเตรียม <b class='" + (x.deltaMaxCash > 0 ? "neg" : "pos") + "'>" + signed(x.deltaMaxCash) + "</b>";
    });
  }

  function renderRisks(list) {
    var html = "<thead><tr><th>#</th><th>สมมติฐาน</th><th>ช็อกที่ทดสอบ</th><th class='num'>Δ Contribution</th>" +
      "<th class='num'>Δ Max Cash</th><th class='num'>Δ ลูกค้า</th><th>Operating BE</th></tr></thead><tbody>";
    list.forEach(function (x, i) {
      html += '<tr data-shock="' + x.key + '"><td>' + (i + 1) + "</td>" +
        "<td><b>" + x.label + "</b><br>" + confBadge(x.key) + "</td>" +
        "<td>" + x.desc + " · " + n(x.from) + " → " + n(x.to) + "</td>" +
        '<td class="num ' + (x.deltaContribution < 0 ? "neg" : "pos") + '">' + signed(x.deltaContribution) + "</td>" +
        '<td class="num ' + (x.deltaMaxCash > 0 ? "neg" : "pos") + '">' + signed(x.deltaMaxCash) + "</td>" +
        '<td class="num">' + n(x.deltaCustomers) + "</td>" +
        "<td>" + month(x.baseOperatingBreakEven) + " → " + month(x.operatingBreakEven) + "</td></tr>";
    });
    el("risk-table").innerHTML = html + "</tbody>";
  }

  function renderStress() {
    var res = M.stress(state, stressMul);
    var d = res.delta;
    el("stress-result").innerHTML =
      kpi("Contribution", baht(res.stressed.cumulativeContribution), "เดิม " + baht(res.base.cumulativeContribution) + " · " + signed(d.contribution),
          d.contribution < 0 ? "neg" : "pos") +
      kpi("Max Cash Required", baht(res.stressed.maxCashRequired), "เดิม " + baht(res.base.maxCashRequired) + " · " + signed(d.maxCashRequired),
          d.maxCashRequired > 0 ? "neg" : "pos") +
      kpi("Customers", n(res.stressed.totalNewCustomers), "เดิม " + n(res.base.totalNewCustomers) + " · " + n(d.customers),
          d.customers < 0 ? "neg" : "pos") +
      kpi("Operating Break-even", month(res.stressed.operatingBreakEven), "เดิม " + month(res.base.operatingBreakEven),
          res.stressed.operatingBreakEven ? "pos" : "neg") +
      kpi("Investment Payback", month(res.stressed.paybackMonth), "เดิม " + month(res.base.paybackMonth),
          res.stressed.paybackMonth ? "pos" : "neg");
  }

  function renderFunnel(f) {
    var withAds = f.rows.filter(function (r) { return r.adSpend > 0; });
    var ref = withAds.length ? withAds[withAds.length - 1] : f.rows[f.rows.length - 1];
    var steps = [
      { label: "Ad Spend", value: baht(ref.adSpend), sub: "เดือน " + ref.month },
      { label: "Impressions", value: n(ref.impressions), sub: "CPM " + baht(state.cpm) },
      { label: "Clicks", value: n(ref.clicks), sub: "CTR " + n(state.ctr, 1) + " %" },
      { label: ref.selling ? "New Customers" : "Leads", value: n(ref.selling ? ref.newPaid : ref.leads),
        sub: ref.selling ? "CVR " + n(state.cvr, 1) + " %" : "คลิก → รายชื่อ " + n(state.leadRate, 1) + " %" },
      { label: ref.selling ? "Paid CPA" : "CPL",
        value: baht(ref.selling ? ref.paidCPA : (ref.leads > 0 ? ref.adSpend / ref.leads : NaN), 2),
        sub: ref.selling ? "ต่อลูกค้า 1 คน" : "ต่อรายชื่อ 1 คน" }
    ];
    el("funnel").innerHTML = steps.map(function (s, i) {
      return '<div class="fstep"><small>' + s.label + "</small><strong>" + s.value + "</strong><span>" + s.sub + "</span></div>" +
        (i < steps.length - 1 ? '<div class="farrow" aria-hidden="true">→</div>' : "");
    }).join("");
    el("media-note").textContent = ref.selling
      ? "ตัวเลขนี้คือเดือน " + ref.month + " ซึ่งขายได้แล้ว โฆษณาจึงวัดเป็นลูกค้าและ Paid CPA"
      : "เดือน " + ref.month + " ระบบยังเก็บเงินไม่ได้ โฆษณาจึงวัดเป็นรายชื่อและ CPL — อย่าเอาไปเทียบเพดานค่าได้ลูกค้า";
  }

  function renderAcquisition(f) {
    var s = f.summary;
    el("acq-split").innerHTML =
      kpi("Paid Customers", n(s.totalPaidCustomers), "มาจากค่าโฆษณา") +
      kpi("Organic Customers", n(s.totalOrganicCustomers), n(s.organicShare, 1) + " % ของลูกค้าใหม่") +
      kpi("Total Customers", n(s.totalNewCustomers), "รวมทั้งสองทาง") +
      kpi("Paid CPA", baht(s.paidCPA, 2), "ค่าโฆษณา ÷ ลูกค้าจากโฆษณา", "", "paidCPA") +
      kpi("Blended CAC", baht(s.blendedCAC, 2), "ต้นทุนการตลาด ÷ ลูกค้าทั้งหมด", "hl", "blendedCAC");
  }

  function renderWaterfall(f) {
    var r = f.revenue;
    var items = [
      { label: "Gross Revenue", value: baht(r.grossMonth, 2), note: "ยอดเรียกเก็บ / เดือน", key: "grossMonth" },
      { label: "เก็บสำเร็จ " + n(state.collectionRate) + " %", value: baht(r.collected, 2), note: "หลัง Collection Rate" },
      { label: "หลังแบ่งเครือข่าย " + n(state.aisShare) + " %", value: baht(r.afterNetwork, 2), note: "" },
      { label: "หัก Partner Share " + n(state.itShare) + " %", value: "− " + baht(r.partnerCut, 2), note: state.itBase === "gross" ? "ฐาน Gross" : "ฐาน Net", neg: true },
      { label: "Net Revenue", value: baht(r.netMonth, 2), note: "margin " + n(r.margin, 1) + " %", key: "netMonth", final: true }
    ];
    el("waterfall").innerHTML = items.map(function (it) {
      return '<div class="wf' + (it.final ? " wf-final" : "") + (it.neg ? " wf-neg" : "") + '">' +
        "<small>" + it.label + "</small><strong>" + it.value + "</strong><span>" + it.note + "</span>" +
        (it.key ? '<button class="why" data-explain="' + it.key + '" type="button" aria-label="ทำไมเป็นตัวเลขนี้">?</button>' : "") + "</div>";
    }).join("");
  }

  function renderUnit(f) {
    var r = f.revenue, s = f.summary;
    var healthy = isFinite(s.ltvCacRatio) && s.ltvCacRatio >= 3;
    el("unit-metrics").innerHTML =
      kpi("Gross LTV", baht(r.grossLTV, 2), "ก่อนหักทุกอย่าง", "", "grossLTV") +
      kpi("Net LTV", baht(r.netLTV, 2), "เงินที่ถึงเราจริง", "hl", "netLTV") +
      kpi("Contribution สะสม", baht(s.cumulativeContribution),
          s.cumulativeContribution >= 0 ? "การตลาดเลี้ยงตัวเองได้" : "ยังไม่คุ้มค่าการตลาด",
          s.cumulativeContribution >= 0 ? "pos" : "neg", "contribution") +
      kpi("Net LTV : Blended CAC", n(s.ltvCacRatio, 2) + " : 1", "ต้องได้ 3.00 ขึ้นไป", healthy ? "pos" : "neg") +
      kpi("Payback ต่อลูกค้า", n(s.paybackDays) + " วัน", "Lifetime " + n(state.lifetimeDays) + " วัน",
          isFinite(s.paybackDays) && s.paybackDays <= state.lifetimeDays ? "pos" : "neg", "payback") +
      kpi("ROAS", n(s.roas, 2), "ไม่ใช่กำไร", "", "roas");

    el("roas-note").innerHTML =
      "ROAS ของช่วงนี้คือ <strong>" + n(s.roas, 2) + "</strong> คิดจากรายได้สุทธิหารค่าโฆษณาเท่านั้น " +
      "ยังไม่หักค่าคอนเทนต์ " + baht(s.totalMarketing - s.totalAds) + " และต้นทุนคงที่ " + baht(s.totalFixed) +
      " ตัวที่บอกว่าธุรกิจอยู่ได้หรือไม่คือ Contribution และเงินสดสะสม ไม่ใช่ ROAS";

    el("cac-note").innerHTML =
      "<strong>Paid CPA " + baht(s.paidCPA, 2) + "</strong> = ค่าโฆษณา ÷ ลูกค้าจากโฆษณา ใช้ตัดสินว่าจะเพิ่มหรือลดงบชุดไหน<br>" +
      "<strong>Blended CAC " + baht(s.blendedCAC, 2) + "</strong> = (ค่าโฆษณา + ค่าคอนเทนต์) ÷ ลูกค้าทั้งหมดรวม organic ใช้ตัดสินว่าธุรกิจทั้งก้อนคุ้มหรือไม่<br>" +
      "ต่างกัน " + baht(Math.abs(s.paidCPA - s.blendedCAC), 2) + " ต่อคน เพราะ organic คิดเป็น " + n(s.organicShare, 1) + " % ของลูกค้าใหม่";
  }

  function renderForecast(f) {
    var cols = [
      ["เดือน", function (r) { return r.month; }, ""],
      ["Marketing", function (r) { return n(r.marketingSpend); }, "num"],
      ["Fixed", function (r) { return n(r.fixedCost); }, "num"],
      ["Cash Out", function (r) { return n(r.cashOut); }, "num strong-col"],
      ["New Cust.", function (r) { return r.selling ? n(r.newCustomers) : "—"; }, "num"],
      ["Active", function (r) { return r.selling ? n(r.activeCustomers) : "—"; }, "num"],
      ["Gross Rev.", function (r) { return n(r.grossRevenue); }, "num"],
      ["Cash In", function (r) { return n(r.cashIn); }, "num strong-col"],
      ["Contribution", function (r) { return n(r.contribution); }, "num"],
      ["Net Cash Flow", function (r) { return n(r.netCashFlow); }, "num"],
      ["Cumulative", function (r) { return n(r.cumulativeCash); }, "num strong-col"]
    ];
    var s = f.summary;
    var html = "<thead><tr>" + cols.map(function (c) { return '<th class="' + c[2] + '">' + c[0] + "</th>"; }).join("") + "</tr></thead><tbody>";
    f.rows.forEach(function (r) {
      var cls = r.month === s.operatingBreakEven ? "is-be" : (r.month === s.paybackMonth ? "is-pb" : "");
      html += '<tr class="' + cls + '">' + cols.map(function (c) {
        var v = c[1](r), cc = c[2];
        if (c[0] === "Contribution") cc += r.contribution < 0 ? " neg" : " pos";
        if (c[0] === "Net Cash Flow") cc += r.netCashFlow < 0 ? " neg" : " pos";
        if (c[0] === "Cumulative") cc += r.cumulativeCash < 0 ? " neg" : " pos";
        return '<td class="' + cc + '">' + v + "</td>";
      }).join("") + "</tr>";
    });
    el("forecast-table").innerHTML = html + "</tbody>";
    el("forecast-note").innerHTML =
      "แถบเขียว = Operating Break-even (" + month(s.operatingBreakEven) + ") · แถบฟ้า = Investment Payback (" + month(s.paybackMonth) + ") · " +
      "จุดต่ำสุดของ Cumulative คือ " + baht(-s.maxCashRequired) + " ซึ่งคือเงินที่ต้องเตรียมจริง";
    drawChart(f);
  }

  function drawChart(f) {
    var rows = f.rows;
    var W = 780, H = 300, padL = 60, padR = 16, padT = 16, padB = 36;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var maxBar = Math.max.apply(null, rows.map(function (r) { return Math.max(r.cashOut, r.cashIn); })) || 1;
    var cums = rows.map(function (r) { return r.cumulativeCash; }).concat([0]);
    var cumMin = Math.min.apply(null, cums), cumMax = Math.max.apply(null, cums);
    var cumSpan = (cumMax - cumMin) || 1;
    var gw = plotW / rows.length, bw = Math.min(16, gw / 3);

    function barY(v) { return padT + plotH - (v / maxBar) * plotH; }
    function barH(v) { return (v / maxBar) * plotH; }
    function cumY(v) { return padT + plotH - ((v - cumMin) / cumSpan) * plotH; }

    var p = [];
    [0, 0.25, 0.5, 0.75, 1].forEach(function (t) {
      var y = padT + plotH - t * plotH;
      p.push('<line class="g" x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '"></line>');
      p.push('<text class="ax" x="' + (padL - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end">' + n(maxBar * t / 1000) + "K</text>");
    });
    p.push('<line class="zero" x1="' + padL + '" y1="' + cumY(0).toFixed(1) + '" x2="' + (W - padR) + '" y2="' + cumY(0).toFixed(1) + '"></line>');

    rows.forEach(function (r, i) {
      var cx = padL + i * gw + gw / 2;
      p.push('<rect class="b-cost" x="' + (cx - bw - 2).toFixed(1) + '" y="' + barY(r.cashOut).toFixed(1) +
        '" width="' + bw.toFixed(1) + '" height="' + barH(r.cashOut).toFixed(1) + '" rx="2"></rect>');
      p.push('<rect class="b-rev" x="' + (cx + 2).toFixed(1) + '" y="' + barY(r.cashIn).toFixed(1) +
        '" width="' + bw.toFixed(1) + '" height="' + barH(r.cashIn).toFixed(1) + '" rx="2"></rect>');
      if (rows.length <= 18 || r.month % 2 === 0) {
        p.push('<text class="ax" x="' + cx.toFixed(1) + '" y="' + (H - 12) + '" text-anchor="middle">' + r.month + "</text>");
      }
    });

    p.push('<polyline class="cum" points="' + rows.map(function (r, i) {
      return (padL + i * gw + gw / 2).toFixed(1) + "," + cumY(r.cumulativeCash).toFixed(1);
    }).join(" ") + '"></polyline>');
    rows.forEach(function (r, i) {
      p.push('<circle class="cum-dot" cx="' + (padL + i * gw + gw / 2).toFixed(1) + '" cy="' + cumY(r.cumulativeCash).toFixed(1) + '" r="2.6"></circle>');
    });

    el("chart").innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="กราฟเงินเข้า เงินออก และเงินสดสะสมรายเดือน">' + p.join("") + "</svg>";
  }

  function renderBreakEven(f) {
    var s = f.summary;
    var scan = M.horizonScan(state, 60);
    el("be-grid").innerHTML =
      '<div class="be-card' + (s.operatingBreakEven ? " ok" : " miss") + '">' +
        '<div class="be-tag">Monthly Operating Break-even</div>' +
        "<strong>" + month(s.operatingBreakEven) + "</strong>" +
        "<p>เดือนแรกที่ Contribution คลุมต้นทุนคงที่ได้ ธุรกิจเลี้ยงตัวเองได้ในเดือนนั้น แต่ยังไม่ได้เงินลงทุนคืน</p>" +
        "<p class='be-sub'>ต้องมีลูกค้าที่ยังจ่ายอยู่พร้อมกันราว <b>" + n(s.breakEvenCustomers) + " คน</b>" +
        (s.operatingBreakEven ? "" : (scan.operatingBreakEven ? " · ถ้าเดินต่อจะถึงที่เดือน " + scan.operatingBreakEven : " · ยังไม่ถึงแม้มองไป 60 เดือน")) + "</p>" +
        '<button class="why inline" data-explain="operatingBE" type="button">ทำไมเป็นตัวเลขนี้</button></div>' +
      '<div class="be-card' + (s.paybackMonth ? " ok" : " miss") + '">' +
        '<div class="be-tag">Investment Payback</div>' +
        "<strong>" + month(s.paybackMonth) + "</strong>" +
        "<p>เดือนแรกที่เงินสดสะสมกลับมาเป็นบวก ได้เงินที่ลงไปทั้งหมดคืนแล้ว</p>" +
        "<p class='be-sub'>เงินสดสะสมตอนจบช่วง <b class='" + (s.cumulativeCash >= 0 ? "pos" : "neg") + "'>" + baht(s.cumulativeCash) + "</b>" +
        (s.paybackMonth ? "" : (scan.paybackMonth ? " · ถ้าเดินต่อจะคืนทุนที่เดือน " + scan.paybackMonth : " · ยังไม่คืนทุนแม้มองไป 60 เดือน")) + "</p>" +
        '<button class="why inline" data-explain="investmentPayback" type="button">ทำไมเป็นตัวเลขนี้</button></div>';
  }

  function isCell(label, value, sub, mod) {
    return '<div class="is-cell' + (mod === "hl" ? " is-hl" : "") + '"><small>' + label + "</small>" +
      '<strong class="' + (mod === "pos" || mod === "neg" ? mod : "") + '">' + value + "</strong><span>" + sub + "</span></div>";
  }

  function verdict(f, risks) {
    var s = f.summary;
    var top = risks[0];
    var head;
    if (!s.operatingBreakEven) {
      head = "ภายใน " + n(state.months) + " เดือนนี้ Contribution ยังไม่คลุมต้นทุนคงที่สักเดือน ต้องเตรียมเงินสดรองรับ " +
        baht(s.maxCashRequired) + " และยังไม่มีเดือนที่ได้เงินลงทุนคืน";
    } else if (!s.paybackMonth) {
      head = "เลี้ยงตัวเองได้ตั้งแต่เดือน " + s.operatingBreakEven + " แต่เงินสดสะสมยังติดลบ " + baht(-s.cumulativeCash) +
        " ตอนจบช่วง ยังไม่ถึงจุดคืนทุน";
    } else {
      head = "เลี้ยงตัวเองได้เดือน " + s.operatingBreakEven + " และคืนทุนเดือน " + s.paybackMonth +
        " เงินสดติดลบสูงสุดระหว่างทาง " + baht(s.maxCashRequired);
    }
    return head + " · ตัวแปรที่ขยับผลมากที่สุดคือ <strong>" + top.label + "</strong> — " + top.desc +
      " ทำให้ Contribution เปลี่ยน " + signed(top.deltaContribution);
  }

  function renderSummary(f, risks) {
    var s = f.summary;
    el("investment-summary").innerHTML =
      '<div class="is-head"><span class="is-eyebrow">Investment Summary</span>' +
      '<span class="is-scenario">' + M.SCENARIO_LABEL[scenario] + " · " + n(state.months) + " เดือน</span></div>" +
      '<div class="is-grid">' +
        isCell("Total Investment", baht(s.totalInvestment), "Initial + ต้นทุนคงที่ + การตลาด") +
        isCell("Maximum Cash Exposure", baht(s.maxCashRequired), "เงินสดต่ำสุดที่ต้องรองรับ", "hl") +
        isCell("Projected Customers", n(s.totalNewCustomers), "paid " + n(s.totalPaidCustomers) + " · organic " + n(s.totalOrganicCustomers)) +
        isCell("Projected Net Revenue", baht(s.totalNetRevenue), "หลังหักส่วนแบ่งทั้งหมด") +
        isCell("Projected Contribution", baht(s.cumulativeContribution), "Net Revenue − ต้นทุนการตลาด", s.cumulativeContribution >= 0 ? "pos" : "neg") +
        isCell("Cumulative Cash Flow", baht(s.cumulativeCash), "ตอนจบช่วงที่จำลอง", s.cumulativeCash >= 0 ? "pos" : "neg") +
        isCell("Operating Break-even", month(s.operatingBreakEven), "Contribution ≥ Fixed Cost", s.operatingBreakEven ? "pos" : "neg") +
        isCell("Investment Payback", month(s.paybackMonth), "Cumulative Cash Flow ≥ 0", s.paybackMonth ? "pos" : "neg") +
      "</div>" +
      '<p class="is-foot">' + verdict(f, risks) + "</p>";
  }

  function renderChangeTable(risks) {
    var html = "<thead><tr><th>สมมติฐาน</th><th>ที่มา</th><th>ถ้าแย่ลง</th><th class='num'>Δ Contribution</th><th class='num'>Δ เงินสดที่ต้องเตรียม</th></tr></thead><tbody>";
    risks.forEach(function (x) {
      html += "<tr><td>" + x.label + "</td><td>" + confBadge(x.key) + "</td><td>" + x.desc + "</td>" +
        '<td class="num ' + (x.deltaContribution < 0 ? "neg" : "pos") + '">' + signed(x.deltaContribution) + "</td>" +
        '<td class="num ' + (x.deltaMaxCash > 0 ? "neg" : "pos") + '">' + signed(x.deltaMaxCash) + "</td></tr>";
    });
    el("change-table").innerHTML = html + "</tbody>";
  }

  function renderScenarioTable() {
    var list = M.compareScenarios(state);
    var html = "<thead><tr><th>Scenario</th><th class='num'>Investment</th><th class='num'>Customers</th>" +
      "<th class='num'>Net Revenue</th><th class='num'>Contribution</th><th class='num'>Max Cash</th>" +
      "<th>Operating BE</th><th>Payback</th></tr></thead><tbody>";
    list.forEach(function (x) {
      var s = x.summary;
      html += '<tr class="' + (x.key === scenario ? "is-current " : "") + (x.key === "viable" ? "is-target" : "") + '" data-scenario-row="' + x.key + '">' +
        "<td><b>" + x.label + "</b><br><small class='sc-note'>" + (x.note || "") + "</small></td>" +
        '<td class="num">' + n(s.totalInvestment) + "</td>" +
        '<td class="num">' + n(s.totalNewCustomers) + "</td>" +
        '<td class="num">' + n(s.totalNetRevenue) + "</td>" +
        '<td class="num ' + (s.cumulativeContribution < 0 ? "neg" : "pos") + '">' + n(s.cumulativeContribution) + "</td>" +
        '<td class="num">' + n(s.maxCashRequired) + "</td>" +
        "<td>" + month(s.operatingBreakEven) + "</td><td>" + month(s.paybackMonth) + "</td></tr>";
    });
    el("scenario-table").innerHTML = html + "</tbody>";
  }

  function renderConfTable() {
    var rows = [
      ["Fixed Cost", "fixedCost"], ["Revenue Share — เครือข่าย", "aisShare"], ["Partner Share", "itShare"],
      ["ราคาแพ็กเกจ", "packagePrice"], ["Collection Rate", "collectionRate"], ["CPM", "cpm"], ["CTR", "ctr"],
      ["Conversion Rate", "cvr"], ["Customer Lifetime", "lifetimeDays"], ["Organic Customers", "organicAtEnd"],
      ["เปิดขายเดือนที่", "launchMonth"]
    ];
    var html = "<thead><tr><th>สมมติฐาน</th><th>ความเชื่อมั่น</th><th>ที่มา</th></tr></thead><tbody>";
    rows.forEach(function (r) {
      var m = M.META[r[1]] || {};
      html += "<tr><td>" + r[0] + "</td><td>" + confBadge(r[1]) + "</td><td>" + (m.note || "—") + "</td></tr>";
    });
    el("conf-table").innerHTML = html + "</tbody>";
  }

  function renderFormulaList(f) {
    var r = f.revenue;
    el("formula-list").innerHTML = "<pre>" +
      "Gross Revenue / เดือน   = Σ ( สัดส่วน × ราคา × ความถี่ )\n" +
      "Collected               = Gross × Collection Rate\n" +
      "After Network Share     = Collected × ( 1 − Revenue Share )\n" +
      "Partner Cut             = " + (state.itBase === "gross" ? "Collected" : "After Network Share") + " × Partner Share\n" +
      "Net Revenue / เดือน     = After Network Share − Partner Cut\n\n" +
      "Gross LTV               = Gross / เดือน × ( Lifetime ÷ 30 )\n" +
      "Net LTV                 = Net / เดือน × ( Lifetime ÷ 30 )\n\n" +
      "Impressions             = ค่าโฆษณา ÷ CPM × 1,000\n" +
      "Clicks                  = Impressions × CTR\n" +
      "New Paid Customers      = Clicks × CVR\n" +
      "Leads (ก่อนเปิดขาย)      = Clicks × คลิก→รายชื่อ\n\n" +
      "Paid CPA                = ค่าโฆษณา ÷ ลูกค้าจากโฆษณา\n" +
      "Blended CAC             = ( ค่าโฆษณา + ค่าคอนเทนต์ ) ÷ ลูกค้าใหม่ทั้งหมด\n" +
      "Monthly Churn           = 1 ÷ ( Lifetime ÷ 30 )\n" +
      "Active Customers        = Active ก่อนหน้า × ( 1 − Churn ) + ลูกค้าใหม่\n\n" +
      "Cash Out                = ต้นทุนการตลาด + ต้นทุนคงที่\n" +
      "Cash In                 = Active Customers × Net Revenue / เดือน\n" +
      "Contribution            = Cash In − ต้นทุนการตลาด\n" +
      "Net Cash Flow           = Cash In − Cash Out\n" +
      "Cumulative Cash Flow    = สะสม Net Cash Flow เริ่มจาก −Initial Investment\n\n" +
      "Operating Break-even    = เดือนแรกที่ Contribution ≥ Fixed Cost\n" +
      "Investment Payback      = เดือนแรกที่ Cumulative Cash Flow ≥ 0\n" +
      "Maximum Cash Exposure   = | ค่าต่ำสุดของ Cumulative Cash Flow |" +
      "</pre><p class='muted'>ค่าปัจจุบัน: Gross " + baht(r.grossMonth, 2) + " → Net " + baht(r.netMonth, 2) +
      " ต่อเดือน (margin " + n(r.margin, 1) + " %) · Net LTV " + baht(r.netLTV, 2) + "</p>";
  }

  /* ============================================================
     ใบสรุปค่าใช้จ่ายรายเดือน — เอกสารหน้าเดียวสำหรับอนุมัติงบ
     ============================================================ */
  function budgetPhases(f) {
    // ยุบเดือนที่ค่าใช้จ่ายเท่ากันให้เป็นช่วงเดียว จะได้อ่านง่าย
    var out = [];
    f.rows.forEach(function (r) {
      var last = out[out.length - 1];
      if (last && last.ads === r.adSpend && last.content === r.contentSpend && last.fixed === r.fixedCost) {
        last.to = r.month;
      } else {
        out.push({ from: r.month, to: r.month, fixed: r.fixedCost, content: r.contentSpend,
                   ads: r.adSpend, total: r.cashOut });
      }
    });
    return out;
  }

  function renderBudget(f) {
    var box = el("budget-sheet");
    if (!box) return;
    var s = f.summary;
    var itemsMatch = M.fixedItemsTotal() === state.fixedCost;
    var today = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });

    var fixedRows = itemsMatch
      ? M.FIXED_ITEMS.map(function (i) {
          return "<tr><td>" + i.label + "</td><td class='bs-scope'>" + i.scope + "</td><td class='num'>" + n(i.amount) + "</td></tr>";
        }).join("")
      : "<tr><td>ต้นทุนคงที่ (ปรับเองในเครื่องคำนวณ)</td><td class='bs-scope'>ไม่ตรงกับรายการตามงบประมาณเดิม " +
        baht(M.fixedItemsTotal()) + "</td><td class='num'>" + n(state.fixedCost) + "</td></tr>";

    var phases = budgetPhases(f);
    var phaseRows = phases.map(function (p) {
      var span = p.from === p.to ? "เดือน " + p.from : "เดือน " + p.from + "–" + p.to;
      return "<tr><td>" + span + "</td><td class='num'>" + n(p.fixed) + "</td><td class='num'>" + n(p.content) +
        "</td><td class='num'>" + (p.ads ? n(p.ads) : "—") + "</td><td class='num bs-total'>" + n(p.total) + "</td></tr>";
    }).join("");

    box.innerHTML =
      '<div class="bsheet">' +
        '<div class="bs-head">' +
          '<div><div class="bs-eyebrow">ใบสรุปค่าใช้จ่ายรายเดือน</div>' +
          "<h3>แพลตฟอร์มดูดวง · ไพ่ทาโรต์ · Direct Carrier Billing</h3></div>" +
          '<div class="bs-meta"><span>จัดทำ ' + today + "</span><span>ขอบเขต " + n(state.months) + " เดือน</span></div>" +
        "</div>" +

        '<div class="bs-sec"><div class="bs-sec-title">ก · ต้นทุนคงที่ — จ่ายเท่ากันทุกเดือน</div>' +
        '<div class="table-wrap"><table class="bs-table"><thead><tr><th>รายการ</th><th>ขอบเขตงาน</th><th class="num">บาท / เดือน</th></tr></thead><tbody>' +
        fixedRows +
        '<tr class="bs-sum"><td>รวมต้นทุนคงที่</td><td></td><td class="num">' + n(state.fixedCost) + "</td></tr>" +
        "</tbody></table></div></div>" +

        '<div class="bs-sec"><div class="bs-sec-title">ข · ต้นทุนผันแปร — ปรับขึ้นลงได้ตามผล</div>' +
        '<div class="table-wrap"><table class="bs-table"><thead><tr><th>รายการ</th><th>ช่วงที่ใช้</th><th class="num">บาท / เดือน</th></tr></thead><tbody>' +
        "<tr><td>คอนเทนต์ · SEO / AEO / GEO</td><td class='bs-scope'>ทุกเดือนตั้งแต่เดือน 1</td><td class='num'>" + n(state.contentSpend) + "</td></tr>" +
        "<tr><td>โฆษณา · ช่วงทดสอบ</td><td class='bs-scope'>เดือน " + n(state.adsStartMonth) + "–" + n(Math.max(state.adsStartMonth, state.scaleMonth - 1)) + " เก็บรายชื่อและหากลุ่มเป้าหมาย</td><td class='num'>" + n(state.adsTest) + "</td></tr>" +
        "<tr><td>โฆษณา · ช่วงขยาย</td><td class='bs-scope'>เดือน " + n(state.scaleMonth) + " เป็นต้นไป หลังรู้ต้นทุนต่อลูกค้าจริง</td><td class='num'>" + n(state.adsScale) + "</td></tr>" +
        "</tbody></table></div></div>" +

        '<div class="bs-sec"><div class="bs-sec-title">ค · รวมที่ต้องเตรียมต่อเดือน</div>' +
        '<div class="table-wrap"><table class="bs-table"><thead><tr><th>ช่วง</th><th class="num">คงที่</th><th class="num">คอนเทนต์</th><th class="num">โฆษณา</th><th class="num">รวม</th></tr></thead><tbody>' +
        phaseRows + "</tbody></table></div></div>" +

        '<div class="bs-sec"><div class="bs-sec-title">ง · ยอดรวมตลอด ' + n(state.months) + " เดือน</div>" +
        '<div class="bs-grid">' +
          '<div class="bs-cell"><small>ต้นทุนคงที่รวม</small><strong>' + baht(s.totalFixed) + "</strong></div>" +
          '<div class="bs-cell"><small>คอนเทนต์รวม</small><strong>' + baht(s.totalMarketing - s.totalAds) + "</strong></div>" +
          '<div class="bs-cell"><small>ค่าโฆษณารวม</small><strong>' + baht(s.totalAds) + "</strong></div>" +
          '<div class="bs-cell bs-hl"><small>รวมทั้งสิ้น</small><strong>' + baht(s.totalInvestment) + "</strong></div>" +
          '<div class="bs-cell"><small>เฉลี่ยต่อเดือน</small><strong>' + baht(s.monthlyBurn) + "</strong></div>" +
          '<div class="bs-cell bs-hl"><small>เงินสดสูงสุดที่ต้องเตรียม</small><strong>' + baht(s.maxCashRequired) + "</strong></div>" +
        "</div></div>" +

        '<p class="bs-foot">ต้นทุนคงที่เป็นตัวเลขตามงบประมาณที่ตกลงแล้ว ส่วนต้นทุนผันแปรเป็นแผนตั้งต้นที่ปรับได้ทุกเดือน · ' +
        "เงินสดสูงสุดที่ต้องเตรียมคือจุดต่ำสุดของเงินสดสะสม ซึ่งน้อยกว่ายอดรวมทั้งสิ้นเพราะมีรายได้เข้ามาชดเชยระหว่างทาง</p>" +
      "</div>";
  }

  /* ---------- floating balloon ---------- */
  var prevContribution = null;
  function renderFab(f) {
    var box = el("fab");
    if (!box) return;
    var s = f.summary, v = s.cumulativeContribution;
    el("fab-value").textContent = baht(v);
    box.classList.toggle("is-pos", v >= 0);
    box.classList.toggle("is-neg", v < 0);

    var d = el("fab-delta");
    if (prevContribution !== null && Math.abs(v - prevContribution) >= 1) {
      var diff = v - prevContribution;
      d.textContent = (diff > 0 ? "▲ +" : "▼ ") + n(diff) + " ฿";
      d.className = "fab-delta show " + (diff > 0 ? "up" : "down");
      box.classList.remove("bump"); void box.offsetWidth; box.classList.add("bump");
    } else if (prevContribution === null) {
      d.textContent = ""; d.className = "fab-delta";
    }
    prevContribution = v;

    var be = el("fab-be"), pb = el("fab-pb");
    be.textContent = month(s.operatingBreakEven);
    be.className = "fab-row-value " + (s.operatingBreakEven ? "reached" : "missed");
    pb.textContent = month(s.paybackMonth);
    pb.className = "fab-row-value " + (s.paybackMonth ? "reached" : "missed");
  }

  /* ============================================================
     RENDER ALL
     ============================================================ */
  function render() {
    syncURL();
    var f = M.forecast(state);
    latest = f;
    var risks = M.sensitivity(state);

    var sum = f.revenue.mixShareTotal;
    var mix = el("mix-check");
    mix.textContent = "สัดส่วนผู้ใช้รวม " + n(sum) + " % " + (Math.round(sum) === 100 ? "— ครบพอดี" : "— ควรรวมได้ 100 %");
    mix.className = "mix-check " + (Math.round(sum) === 100 ? "ok" : "bad");

    var note = el("sb-note");
    if (note) note.textContent = M.SCENARIO_NOTE[scenario] || "";

    renderHero(f);
    renderSticky(f);
    renderInvestment(f);
    renderSensitivityInline(risks);
    renderRisks(risks);
    renderStress();
    renderFunnel(f);
    renderAcquisition(f);
    renderWaterfall(f);
    renderUnit(f);
    renderForecast(f);
    renderBreakEven(f);
    renderSummary(f, risks);
    renderChangeTable(risks);
    renderScenarioTable();
    renderConfTable();
    renderFormulaList(f);
    renderBudget(f);
    renderFab(f);
  }

  /* ============================================================
     EVENTS
     ============================================================ */
  var STRESS_PRESETS = {
    mild:   { cvr: 85, cpm: 115, lifetimeDays: 85, collectionRate: 92, organicAtEnd: 75 },
    severe: { cvr: 60, cpm: 145, lifetimeDays: 55, collectionRate: 80, organicAtEnd: 40 },
    reset:  { cvr: 100, cpm: 100, lifetimeDays: 100, collectionRate: 100, organicAtEnd: 100 }
  };

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
      } else if (t.dataset && t.dataset.stress) {
        stressMul[t.dataset.stress] = parseFloat(t.value);
        el("sv-" + t.dataset.stress).textContent = n(stressMul[t.dataset.stress]) + " %";
        renderStress();
      }
    });

    document.addEventListener("change", function (e) {
      if (e.target.id === "c-itBase") { state.itBase = e.target.value; render(); }
    });

    document.addEventListener("click", function (e) {
      var sc = e.target.closest("[data-scenario]") || e.target.closest("[data-scenario-row]");
      if (sc) {
        scenario = sc.dataset.scenario || sc.dataset.scenarioRow;
        state = M.applyScenario(state, scenario);
        buildControls();
        document.querySelectorAll("[data-scenario]").forEach(function (b) {
          b.classList.toggle("is-active", b.dataset.scenario === scenario);
        });
        render();
        return;
      }

      var sp = e.target.closest("[data-stress-preset]");
      if (sp) {
        stressMul = M.clone(STRESS_PRESETS[sp.dataset.stressPreset]);
        syncControls(); renderStress();
        return;
      }

      var shockRow = e.target.closest("[data-shock]");
      if (shockRow) {
        var key = shockRow.dataset.shock;
        var def = M.SHOCKS.filter(function (x) { return x.key === key; })[0];
        if (def) { state[key] = def.apply(state[key]); syncControls(); render(); }
        return;
      }

      if (e.target.closest("#reset-btn")) {
        state = M.clone(M.DEFAULTS);
        stressMul = M.clone(STRESS_PRESETS.reset);
        scenario = "viable";
        document.querySelectorAll("[data-scenario]").forEach(function (b) {
          b.classList.toggle("is-active", b.dataset.scenario === "viable");
        });
        buildControls(); render();
        return;
      }

      var why = e.target.closest("[data-explain]");
      if (why) { openExplain(why.dataset.explain); return; }

      if (e.target.closest("#fab") || e.target.closest("#ss-jump")) {
        var card = el("investment-summary");
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.focus({ preventScroll: true });
        card.classList.remove("is-focus"); void card.offsetWidth; card.classList.add("is-focus");
        setTimeout(function () { card.classList.remove("is-focus"); }, 1600);
        return;
      }

      var copyBtn = e.target.closest("#copy-link");
      if (copyBtn) {
        try { history.replaceState(null, "", "#" + encodeState()); } catch (err) {}
        var url = location.href;
        var done = function () {
          copyBtn.textContent = "คัดลอกแล้ว ✓";
          setTimeout(function () { copyBtn.textContent = "คัดลอกลิงก์"; }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(done, function () { window.prompt("คัดลอกลิงก์นี้", url); });
        } else {
          window.prompt("คัดลอกลิงก์นี้", url);
        }
        return;
      }

      if (e.target.closest("#print-budget")) {
        document.body.classList.add("print-budget");
        window.print();
        setTimeout(function () { document.body.classList.remove("print-budget"); }, 500);
        return;
      }

      if (e.target.closest(".js-print")) window.print();
    });

    el("explain-close").addEventListener("click", function () { el("explain").close(); });
    el("explain").addEventListener("click", function (e) { if (e.target === el("explain")) el("explain").close(); });
  }

  function openExplain(key) {
    var spec = FORMULAS[key];
    if (!spec || !latest) return;
    el("explain-kicker").textContent = "ทำไมเป็นตัวเลขนี้";
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

  /* ---------- balloon steps aside when the summary is on screen ---------- */
  (function watchSummary() {
    var card = el("investment-summary"), box = el("fab");
    if (!card || !box || !("IntersectionObserver" in window)) return;
    new IntersectionObserver(function (entries) {
      box.classList.toggle("is-hidden", entries[0].isIntersecting);
    }, { threshold: 0.3 }).observe(card);
  })();

  /* ---------- sticky summary appears once the hero is scrolled past ---------- */
  (function watchHero() {
    var hero = document.querySelector(".hero"), bar = el("sticky-summary");
    if (!hero || !bar || !("IntersectionObserver" in window)) return;
    new IntersectionObserver(function (entries) {
      bar.classList.toggle("is-on", !entries[0].isIntersecting);
    }, { threshold: 0, rootMargin: "-120px 0px 0px 0px" }).observe(hero);
  })();

  var fromURL = decodeState(location.hash);
  if (fromURL) {
    document.querySelectorAll("[data-scenario]").forEach(function (b) {
      b.classList.toggle("is-active", b.dataset.scenario === scenario);
    });
  }

  buildControls();
  bind();
  render();
})();
