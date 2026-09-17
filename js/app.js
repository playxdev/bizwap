/* ---------- theme toggle ---------- */
(function(){
  var root = document.documentElement;
  var btn = document.getElementById("theme-toggle");
  var icon = document.getElementById("theme-icon");
  var label = document.getElementById("theme-label");

  function stored(){ try { return localStorage.getItem("wap-theme"); } catch(e){ return null; } }
  function save(v){ try { localStorage.setItem("wap-theme", v); } catch(e){} }
  function systemDark(){ return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches; }
  function isDark(){ var t = root.getAttribute("data-theme"); return t ? t === "dark" : systemDark(); }
  function paint(){
    var dark = isDark();
    icon.textContent = dark ? "☀" : "☾";
    label.textContent = dark ? "โหมดสว่าง" : "โหมดมืด";
    btn.setAttribute("aria-label", dark ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด");
  }

  var pref = stored();
  if (pref === "dark" || pref === "light") root.setAttribute("data-theme", pref);
  paint();

  btn.addEventListener("click", function(){
    var next = isDark() ? "light" : "dark";
    root.setAttribute("data-theme", next);
    save(next);
    paint();
  });
})();

/* ---------- card detail modal ---------- */
(function(){
  var dlg = document.getElementById("info-modal");
  var body = document.getElementById("modal-body");
  var kicker = document.getElementById("modal-kicker");
  var title = document.getElementById("modal-title");

  document.addEventListener("click", function(e){
    var btn = e.target.closest(".more-btn");
    if (!btn) return;
    var card = btn.closest("[data-title]");
    var more = card && card.querySelector(".more");
    if (!more) return;
    kicker.textContent = card.getAttribute("data-kicker") || "";
    title.textContent = card.getAttribute("data-title") || "";
    body.innerHTML = more.innerHTML;
    dlg.showModal();
  });

  document.getElementById("modal-close").addEventListener("click", function(){ dlg.close(); });
  dlg.addEventListener("click", function(e){ if (e.target === dlg) dlg.close(); });
})();

/* ---------- ad performance calculator ---------- */
(function(){
  var ids = ["f-spend","f-impr","f-click","f-conv","f-days",
             "f-p1","f-u1","f-s1","f-p2","f-u2","f-s2","f-p3","f-s3",
             "f-collect","f-ais","f-it","f-itbase","f-life","f-team","f-server","f-dau","f-dauconv"];

  // slider readouts: id -> [suffix, decimals, prefix]
  var readouts = {
    "f-dau":      ["", 0, ""],
    "f-dauconv":  ["%", 1, ""],
    "f-p1":       [" ฿", 0, ""],
    "f-u1":       [" ครั้ง", 0, ""],
    "f-s1":       ["%", 0, ""],
    "f-p2":       [" ฿", 0, ""],
    "f-u2":       [" วัน", 0, ""],
    "f-s2":       ["%", 0, ""],
    "f-p3":       [" ฿", 0, ""],
    "f-s3":       ["%", 0, ""],
    "f-collect":  ["%", 0, ""],
    "f-ais":      ["%", 0, ""],
    "f-it":       ["%", 0, ""],
    "f-life":     [" วัน", 0, ""],
    "f-team":     ["", 0, "฿"],
    "f-server":   ["", 0, "฿"]
  };

  var PRESETS = {
    ours: {"f-team":52000, "f-server":14500, "f-dau":2000, "f-dauconv":8}
  };
  var mEl = document.getElementById("metrics");
  var eEl = document.getElementById("econ");
  var bEl = document.getElementById("biz");
  var vEl = document.getElementById("verdict");
  var btn = document.getElementById("calc-btn");
  var dirtyNote = document.getElementById("calc-dirty");

  function num(id){ var v = parseFloat(document.getElementById(id).value); return isFinite(v) && v >= 0 ? v : 0; }
  function fmt(v, d){
    if (!isFinite(v)) return "—";
    return v.toLocaleString("en-US", {minimumFractionDigits:d, maximumFractionDigits:d});
  }
  function div(a, b){ return b > 0 ? a / b : NaN; }
  function tile(lab, val, sub, cls){
    return '<div class="metric"><small>' + lab + '</small><strong' + (cls ? ' class="' + cls + '"' : '') +
           '>' + val + '</strong><span>' + sub + '</span></div>';
  }
  function flash(){
    [mEl, eEl, bEl].forEach(function(box){
      Array.prototype.forEach.call(box.children, function(el){
        el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
      });
    });
    vEl.classList.remove("flash"); void vEl.offsetWidth; vEl.classList.add("flash");
  }
  function setDirty(on){
    btn.classList.toggle("dirty", on);
    dirtyNote.hidden = !on;
  }

  function render(){
    var spend = num("f-spend"), impr = num("f-impr"), clicks = num("f-click"),
        conv = num("f-conv"), days = Math.max(1, num("f-days")),
        collect = num("f-collect"),
        ais = num("f-ais"), it = num("f-it"),
        life = Math.max(1, num("f-life")),
        team = num("f-team"), server = num("f-server"),
        dau = num("f-dau"), dauConv = num("f-dauconv");
    var fixed = team + server;

    // ARPU ผสมจากสามแพ็กเกจ (ต่อสมาชิกที่จ่ายเงิน 1 คน ต่อเดือน)
    var arpu1 = num("f-p1") * num("f-u1");          // รายครั้ง
    var arpu2 = num("f-p2") * num("f-u2");          // รายวัน
    var arpu3 = num("f-p3");                        // รายเดือน
    var s1 = num("f-s1"), s2 = num("f-s2"), s3 = num("f-s3");
    var mixSum = s1 + s2 + s3;
    var grossArpu = (s1 * arpu1 + s2 * arpu2 + s3 * arpu3) / 100;

    // สายน้ำของเงิน: เรียกเก็บ -> เก็บสำเร็จ -> หัก AIS -> หัก IT partner
    var itBase     = document.getElementById("f-itbase").value;
    var collected  = grossArpu * (collect / 100);
    var afterAis   = collected * (1 - ais / 100);
    var itCut      = itBase === "gross" ? collected * (it / 100) : afterAis * (it / 100);
    var netPerMo   = Math.max(0, afterAis - itCut);
    var netPerDay  = netPerMo / 30;
    var margin     = div(netPerMo, grossArpu) * 100;

    var sumEl = document.getElementById("mix-sum");
    sumEl.textContent = "— รวมตอนนี้ " + fmt(mixSum, 0) + " %";
    sumEl.style.color = Math.round(mixSum) === 100 ? "var(--good)" : "var(--bad)";
    sumEl.style.fontWeight = "600";

    var cpm  = div(spend, impr) * 1000;
    var ctr  = div(clicks, impr) * 100;
    var cpc  = div(spend, clicks);
    var cvr  = div(conv, clicks) * 100;
    var cpa  = div(spend, conv);
    var rev  = conv * netPerMo;
    var roas = div(rev, spend);
    var ltv  = netPerMo * (life / 30);
    var target = ltv / 3;
    var ratio = div(cpa, target);
    var payback = div(cpa, netPerDay);   // เป็นวัน
    var ltvCac = div(ltv, cpa);
    var beSubs = div(fixed, netPerMo);

    // ฐานผู้ใช้ -> สมาชิกที่จ่ายจริง -> กำไรขาดทุนต่อเดือน
    var paying   = dau * (dauConv / 100);
    var bizRev   = paying * netPerMo;
    var bizCost  = fixed + spend;
    var profit   = bizRev - bizCost;
    var beDau    = dauConv > 0 ? beSubs / (dauConv / 100) : NaN;
    var dauGap   = dau - beDau;

    document.getElementById("waterfall").innerHTML =
      '<div><span>ARPU ผสม ก่อนหัก</span><b>' + fmt(grossArpu, 2) + ' ฿</b></div>' +
      '<div><span>เก็บสำเร็จ ' + fmt(collect, 0) + ' %</span><b>' + fmt(collected, 2) + ' ฿</b></div>' +
      '<div><span>หลังหัก AIS ' + fmt(ais, 0) + ' %</span><b>' + fmt(afterAis, 2) + ' ฿</b></div>' +
      '<div><span>หัก IT Partner ' + fmt(it, 0) + ' % ' + (itBase === "gross" ? "(Gross)" : "(Net)") + '</span><b>− ' + fmt(itCut, 2) + ' ฿</b></div>' +
      '<div><span>สุทธิถึงเรา · margin ' + fmt(margin, 1) + ' %</span><b style="color:var(--orange)">' + fmt(netPerMo, 2) + ' ฿</b></div>';

    mEl.innerHTML =
      tile("CPM", fmt(cpm, 2), "บาท ต่อการเห็น 1,000 ครั้ง") +
      tile("CTR", fmt(ctr, 2) + " %", "เห็น 100 คน คลิก " + fmt(ctr, 1) + " คน") +
      tile("CPC", fmt(cpc, 2), "บาท ต่อคนที่เข้าเว็บ 1 คน") +
      tile("CVR", fmt(cvr, 2) + " %", "เข้าเว็บ 100 คน สมัคร " + fmt(cvr, 1) + " คน") +
      tile("CPA", fmt(cpa, 2), "บาท ต่อลูกค้า 1 ราย") +
      tile("ROAS 30 วัน", fmt(roas, 2), "ใส่ 1 บาท คืนสุทธิ " + fmt(roas, 2) + " บาท");

    eEl.innerHTML =
      tile("สุทธิ / เดือน", fmt(netPerMo, 2), "บาท ต่อสมาชิก 1 คน") +
      tile("CPA เป้าหมาย", fmt(target, 2), "LTV " + fmt(ltv, 0) + " ÷ 3") +
      tile("LTV สุทธิ", fmt(ltv, 0), "บาท ตลอด " + fmt(life, 0) + " วัน") +
      tile("LTV : CAC", fmt(ltvCac, 2) + " : 1", "ต้องได้ 3.00 ขึ้นไป") +
      tile("คืนทุนใน", fmt(payback, 0), "วัน จากรายได้สุทธิ") +
      tile("สมาชิกคุ้มทุน", fmt(beSubs, 0), "คน ครอบคลุมต้นทุนคงที่");

    bEl.innerHTML =
      tile("สมาชิกจ่ายจริง", fmt(paying, 0), "คน จาก DAU " + fmt(dau, 0) + " × " + fmt(dauConv, 1) + " %") +
      tile("รายได้สุทธิ", fmt(bizRev, 0), "บาท/เดือน หลังหักส่วนแบ่งทั้งหมด") +
      tile("ต้นทุนรวม", fmt(bizCost, 0), "บาท/เดือน คงที่ " + fmt(fixed, 0) + " + โฆษณา") +
      tile(profit >= 0 ? "กำไร" : "ขาดทุน", fmt(Math.abs(profit), 0), "บาท/เดือน", profit >= 0 ? "pos" : "neg") +
      tile("DAU คุ้มทุน", fmt(beDau, 0), "ต้องมี DAU เท่านี้ถึงเสมอตัว") +
      tile(dauGap >= 0 ? "DAU เกินจุดคุ้มทุน" : "DAU ยังขาด", fmt(Math.abs(dauGap), 0),
           dauGap >= 0 ? "คน เหนือเส้นคุ้มทุน" : "คน กว่าจะถึงเส้นคุ้มทุน", dauGap >= 0 ? "pos" : "neg");

    var cls, title, action;
    if (spend <= 0 || impr <= 0) {
      cls = "warn"; title = "ยังกรอกตัวเลขไม่ครบ";
      action = "ใส่งบที่จ่ายไปจริง และจำนวนครั้งที่โฆษณาถูกแสดง (Impressions) ก่อน แล้วกดคำนวณอีกครั้ง";
    } else if (conv === 0 && target > 0 && spend >= target * 2) {
      cls = "bad"; title = "หยุดโฆษณาชุดนี้เดี๋ยวนี้";
      action = "จ่ายไปแล้ว " + fmt(spend, 0) + " บาท มากกว่าราคาที่เรารับได้ต่อลูกค้า 1 คน (" + fmt(target, 0) + " บาท) ถึงสองเท่า แต่ยังไม่มีใครสมัครเลยสักคน ยิ่งปล่อยต่อยิ่งเสียเงินเปล่า เข้าไปปิดชุดโฆษณานี้ใน Ads Manager";
    } else if (clicks < 50 && conv < 3) {
      cls = "warn"; title = "ยังสรุปอะไรไม่ได้ อย่าเพิ่งแตะ";
      action = "ตอนนี้มีคนกดเข้ามาแค่ " + fmt(clicks, 0) + " คน และสมัคร " + fmt(conv, 0) + " คน น้อยเกินกว่าจะบอกได้ว่าโฆษณาดีหรือแย่ ปล่อยให้ยิงต่อจนครบ 50 คลิก หรือมีคนสมัคร 3 คนก่อน แล้วค่อยกลับมาดู";
    } else if (days < 3) {
      cls = "warn"; title = "รออีก " + fmt(3 - days, 0) + " วัน";
      action = "โฆษณาเพิ่งยิงมา " + fmt(days, 0) + " วัน ช่วง 3 วันแรกระบบยังทดลองหาว่าควรแสดงให้ใครดู ตัวเลขจึงยังแกว่ง ถ้าไปแก้อะไรตอนนี้ ระบบจะเริ่มเรียนรู้ใหม่หมดและต้นทุนจะพุ่ง";
    } else if (!isFinite(ratio)) {
      cls = "bad"; title = "ยังไม่มีใครสมัคร แต่ยังไม่ถึงเวลาปิด";
      action = "ปล่อยต่อจนกว่าจะจ่ายครบ " + fmt(target * 2, 0) + " บาท ซึ่งเป็นสองเท่าของราคาที่เรารับได้ต่อลูกค้า 1 คน ถ้าถึงตอนนั้นยังไม่มีใครสมัคร ให้ปิดชุดนี้";
    } else if (ratio < 0.7) {
      cls = "good"; title = "ได้ลูกค้าถูกกว่าที่ตั้งไว้ เพิ่มงบได้";
      action = "ตอนนี้ได้ลูกค้า 1 คนในราคา " + fmt(cpa, 0) + " บาท ถูกกว่าเพดานที่เรารับได้ (" + fmt(target, 0) + " บาท) ยิ่งยิงยิ่งคุ้ม เพิ่มงบรายวันได้เลย แต่ครั้งละไม่เกิน 30 % เพราะถ้าเพิ่มทีเดียวเยอะ ระบบจะกลับไปเริ่มเรียนรู้ใหม่และต้นทุนจะแพงขึ้นชั่วคราว เพิ่มแล้วเว้น 3 วันค่อยเพิ่มรอบถัดไป";
    } else if (ratio <= 1) {
      cls = "good"; title = "กำลังดี ปล่อยไว้แบบนี้";
      action = "ได้ลูกค้า 1 คนในราคา " + fmt(cpa, 0) + " บาท ยังไม่เกินเพดาน " + fmt(target, 0) + " บาท ถือว่าผ่าน อย่าเพิ่งไปปรับอะไร ปล่อยให้ระบบทำงานต่อแล้วกลับมาดูอีกครั้งใน 3 วัน";
    } else if (ratio <= 1.5) {
      cls = "warn"; title = "เริ่มแพง ให้เปลี่ยนภาพและข้อความโฆษณา";
      action = "ได้ลูกค้า 1 คนในราคา " + fmt(cpa, 0) + " บาท แพงกว่าเพดาน " + fmt(target, 0) + " บาท แต่ยังไม่ถึงขั้นต้องหยุด อย่าเพิ่งลดงบ ให้เปลี่ยนภาพหรือข้อความโฆษณาเป็นชุดใหม่ก่อน เพราะส่วนใหญ่ปัญหาอยู่ที่ตัวโฆษณาไม่ดึงดูดพอ แล้วดูผลอีก 3 วัน";
    } else if (days < 7) {
      cls = "warn"; title = "แพงเกินไป ลดงบลงครึ่งหนึ่ง";
      action = "ได้ลูกค้า 1 คนในราคา " + fmt(cpa, 0) + " บาท แพงกว่าเพดาน " + fmt(target, 0) + " บาทเกินครึ่ง และเป็นแบบนี้มา " + fmt(days, 0) + " วันแล้ว ลดงบรายวันของชุดนี้ลงครึ่งหนึ่งเพื่อจำกัดความเสียหาย แล้วดูต่ออีก 3 วัน ถ้ายังไม่ดีขึ้นค่อยปิด";
    } else {
      cls = "bad"; title = "ปิดชุดนี้ แล้วย้ายงบไปชุดที่ถูกกว่า";
      action = "ได้ลูกค้า 1 คนในราคา " + fmt(cpa, 0) + " บาท ทั้งที่เรารับได้แค่ " + fmt(target, 0) + " บาท และเป็นแบบนี้ต่อเนื่องมา " + fmt(days, 0) + " วันแล้ว ทุกวันที่ปล่อยไว้คือขาดทุนเพิ่ม ให้เข้าไปปิดชุดโฆษณานี้ใน Ads Manager แล้วเอางบรายวันของมันไปเติมให้ชุดอื่นที่ได้ลูกค้าถูกกว่า ถ้าไม่มีชุดไหนดีเลย ให้หยุดทั้งหมดก่อน แล้วกลับไปแก้ภาพ ข้อความ และหน้าเว็บปลายทาง ค่อยเริ่มใหม่";
    }

    var diag;
    if (impr <= 0 || clicks <= 0) {
      diag = "";
    } else if (ctr < 0.7) {
      diag = "สาเหตุ: คนเห็นโฆษณาแล้วไม่กด กดแค่ " + fmt(ctr, 2) + " % จาก 100 คนที่เห็น แปลว่าภาพหรือพาดหัวยังไม่สะดุดตา ลองเปลี่ยนภาพ เปลี่ยนพาดหัว หรือทำ 3 วินาทีแรกของวิดีโอให้น่าดูกว่านี้";
    } else if (cvr < 1.5) {
      diag = "สาเหตุ: คนกดเข้าเว็บแล้วแต่ไม่สมัคร สมัครแค่ " + fmt(cvr, 2) + " % ปัญหาอยู่ที่หน้าเว็บปลายทาง ไม่ใช่ตัวโฆษณา เช็กว่าหน้าโหลดช้าไหม สมัครกี่ขั้นตอน และบอกชัดหรือยังว่าจ่ายเท่าไรแล้วได้อะไร";
    } else if (isFinite(ratio) && ratio > 1) {
      diag = "สาเหตุ: คนกดและคนสมัครอยู่ในเกณฑ์ปกติ แต่ต้นทุนต่อคนยังแพง แปลว่ายิงไปโดนคนผิดกลุ่ม ลองแคบกลุ่มเป้าหมายลง หรือให้ระบบไปหาคนที่คล้ายกับคนที่ซื้อเราแล้ว (Lookalike)";
    } else if (isFinite(ltvCac) && ltvCac < 3) {
      diag = "สาเหตุ: ตัวโฆษณาไม่ได้มีปัญหา แต่ลูกค้า 1 คนทำเงินให้เราได้แค่ " + fmt(ltvCac, 2) + " เท่าของค่าที่จ่ายไปเพื่อได้เขามา ควรได้อย่างน้อย 3 เท่า ทางแก้คือขึ้นราคา ขายพ่วง หรือทำให้ลูกค้าอยู่กับเรานานขึ้น";
    } else {
      diag = "สาเหตุ: ทุกตัวเลขผ่านเกณฑ์ ลูกค้า 1 คนทำเงินให้เรา " + fmt(ltvCac, 2) + " เท่าของค่าที่จ่ายไปเพื่อได้เขามา ขยายงบได้ตามกฎ เพิ่มครั้งละไม่เกิน 30 % แล้วเว้น 3 วัน";
    }

    vEl.className = "verdict " + cls;
    vEl.innerHTML =
      '<div class="vhead"><span class="vtitle">' + title + '</span><span class="pill ' + cls + '">คำแนะนำ</span></div>' +
      "<p>" + action + "</p>" + (diag ? '<p class="diag">' + diag + "</p>" : "");
  }

  function syncReadouts(){
    Object.keys(readouts).forEach(function(id){
      var out = document.getElementById("v-" + id.slice(2));
      if (!out) return;
      var cfg = readouts[id];
      out.textContent = cfg[2] + num(id).toLocaleString("en-US", {minimumFractionDigits:cfg[1], maximumFractionDigits:cfg[1]}) + cfg[0];
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll(".preset-btn"), function(b){
    b.addEventListener("click", function(){
      var preset = PRESETS[b.getAttribute("data-preset")];
      if (!preset) return;
      Object.keys(preset).forEach(function(id){ document.getElementById(id).value = preset[id]; });
      syncReadouts();
      render(); flash(); setDirty(false);
    });
  });

  ids.forEach(function(id){
    var el = document.getElementById(id);
    el.addEventListener("input", function(){ syncReadouts(); setDirty(true); });
    el.addEventListener("change", function(){ setDirty(true); });
    el.addEventListener("keydown", function(e){ if (e.key === "Enter") { e.preventDefault(); btn.click(); } });
  });
  btn.addEventListener("click", function(){ render(); flash(); setDirty(false); });
  syncReadouts();
  render();
})();

/* export to PDF — the browser's own print dialog, "Save as PDF" */
(function(){
  var btn = document.getElementById("pdf-btn");
  if (btn) btn.addEventListener("click", function(){ window.print(); });
})();
