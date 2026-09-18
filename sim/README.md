# sim — Investment Decision Simulator

จำลองงบการตลาด จำนวนลูกค้า รายได้ หน่วยเศรษฐศาสตร์ และคาดการณ์รายเดือน ก่อนตัดสินใจลงเงิน

## โครงสร้าง

```
sim.html        โครงหน้าและ step ทั้งหมด
css/app.css     ทั้ง theme, dashboard และ print report
js/model.js     ตรรกะคำนวณล้วน ไม่แตะ DOM เลย
js/ui.js        อ่านผลจาก model แล้ววาดหน้า ไม่มีสูตรธุรกิจอยู่ในนี้
```

แก้สูตรที่ `js/model.js` ที่เดียว ทั้งหน้าเปลี่ยนตาม ไม่มีตัวเลขไหนถูกเขียนตายไว้ใน HTML

## สิ่งที่โมเดลแยกให้ชัด

| | |
|---|---|
| Gross vs Net Revenue | Gross คือยอดเรียกเก็บ · Net คือยอดหลังหักการเก็บเงินไม่ผ่านและส่วนแบ่งทุกฝ่าย |
| Gross vs Net LTV | คิดงบ ADS จาก Net เท่านั้น |
| Paid CPA vs Blended CAC | Paid CPA ใช้ตัดสินระดับชุดโฆษณา · Blended CAC ใช้ตัดสินธุรกิจทั้งก้อน |
| ROAS vs Contribution | ROAS ไม่หัก Content และต้นทุนคงที่ จึงไม่ใช่กำไร |
| Contribution vs Cash Flow | Contribution ไม่หักต้นทุนคงที่ · Cash Flow หัก |
| Operating Break-even vs Payback | เดือนที่เลี้ยงตัวเองได้ ≠ เดือนที่ได้เงินลงทุนคืน |

## Scenario

`Conservative` `Base Case` `Aggressive` ไม่มีชุดไหนถูกหรือดีกว่า ทั้งสามคือสมมติฐานคนละระดับความระมัดระวัง
ทุกค่ายังเลื่อนเองได้ทีละตัวหลังเลือกชุดแล้ว

## ทดสอบโมเดลโดยไม่เปิดเบราว์เซอร์

```bash
node -e 'global.window=global; require("./js/model.js");
  var f=SimModel.forecast(SimModel.DEFAULTS);
  console.log(f.summary);'
```

## ข้อควรรู้

ตัวเลขทั้งหมดเป็นผลจากสมมติฐานในหน้านี้ ไม่ใช่ผลประกอบการจริง
ตัวที่ยังไม่มีข้อมูลจริงและกระทบผลมากที่สุดคือ **อายุลูกค้าเฉลี่ย** และ **ลูกค้าจาก Organic**
