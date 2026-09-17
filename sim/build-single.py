#!/usr/bin/env python3
"""รวม sim ทั้งชุดเป็นไฟล์เดียว สำหรับสำรองไว้หรือส่งต่อ

    python3 sim/build-single.py           -> เขียน sim-single.html ที่รากโปรเจกต์
    python3 sim/build-single.py out.html  -> เลือกปลายทางเอง

ไฟล์ที่ได้ไม่พึ่งอะไรเลยนอกจาก Google Fonts เปิดจากดิสก์ได้ตรง ๆ
"""
import re
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else SRC.parent / "sim-single.html"


def read(rel):
    return (SRC / rel).read_text(encoding="utf-8")


def main():
    html = read("sim.html")
    css = read("css/app.css")
    # model ต้องมาก่อน ui เสมอ — ui อ่าน window.SimModel ตอนรัน
    js = read("js/model.js") + "\n\n" + read("js/ui.js")

    # กันสตริงที่จะปิดแท็กก่อนเวลา
    css = css.replace("</style", "<\\/style")
    js = js.replace("</script", "<\\/script")

    html = html.replace(
        '<link rel="stylesheet" href="css/app.css">',
        "<style>\n" + css + "\n</style>",
    )
    # ใช้ lambda เป็นตัวแทนที่ ไม่งั้น re.sub จะตีความ \\n ใน JS เป็นขึ้นบรรทัดจริง
    # แล้วสตริงในโค้ดจะขาดกลางคัน
    html = re.sub(
        r'<script src="js/model\.js"></script>\s*<script src="js/ui\.js" defer></script>',
        lambda m: "<script>\n" + js + "\n</script>",
        html,
    )

    stamp = ("<!-- single-file build · สร้างจาก sim/ ด้วย sim/build-single.py\n"
             "     แก้ที่ sim/ แล้วสร้างใหม่ อย่าแก้ไฟล์นี้ตรง ๆ -->\n")
    html = stamp + html

    OUT.write_text(html, encoding="utf-8")

    leftovers = re.findall(r'(?:src|href)="(?!https?:|#)([^"]+)"', html)
    print("เขียน %s (%s bytes)" % (OUT, format(len(html.encode()), ",")))
    print("ไฟล์ภายนอกที่ยังอ้างถึง:", leftovers or "ไม่มี")


if __name__ == "__main__":
    main()
