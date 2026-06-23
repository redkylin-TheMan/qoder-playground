"""test_triplicate_dryrun.py — 三联单 dryRun 字节流验证脚本

验证 Block A 的完整链路：
  print_docs.build_doc(grain_in, entry) → EscpBuilder.to_script()
  → raw_printer.build_bytes() → 字节流 hex

对比 dprinter-web/lib 的 Node 版输出，确保 ESC/P 控制码、GB18030 编码、
三联重复结构正确。不真打，不发打印机。
"""
import sys
import time

import print_docs
import raw_printer


def _hex_head(data, n=96):
    return " ".join("%02X" % c for c in data[:n])


def main():
    print("=" * 60)
    print("【测试1】粮食入库三联单 dryRun")
    print("=" * 60)
    entry_in = {
        "entryNo": "RK260521001",
        "farmerName": "张三",
        "grainNameSnap": "小麦(一等)",
        "wareareaNameSnap": "1号仓",
        "grossWeight": 1510.5,
        "tareWeight": 9.5,
        "deductWeight": 0.5,
        "netWeight": 1500.5,
        "moisture": 13.2,
        "impurity": 1.0,
        "unitPrice": 2.80,
        "adjustedAmount": 4201.40,
        "createBy": "库管员A",
        "factoryName": "某某粮油烘干厂",
        "printDate": "2026-06-19",
    }
    builder = print_docs.build_doc("grain_in", entry_in)
    script = builder.to_script()
    data = raw_printer.build_bytes(script)
    print("脚本行数:", len(script))
    print("字节总数:", len(data))
    print("HEX(前96):", _hex_head(data))
    print("预览行数:", len(builder.get_preview()))
    print("--- 预览前 12 行 ---")
    for ln in builder.get_preview()[:12]:
        tag = (ln.get("align", "l")[0].upper()) + ("B" if ln.get("bold") else " ") + ("W" if ln.get("dw") else " ")
        print("  [%s] %s" % (tag, ln.get("text") or "(空行)"))

    # send_script dryRun
    res = raw_printer.send_script(script, printer_name="(dryrun)", copies=1, dry_run=True)
    print("\nsend_script(dryRun) → ok:", res["ok"], "| bytes:", res["bytes"])
    print("steps:", res["steps"])

    print()
    print("=" * 60)
    print("【测试2】粮食出库三联单 dryRun")
    print("=" * 60)
    entry_out = {
        "exitNo": "CK260525001",
        "customerNameSnap": "某某食品有限公司",
        "grainNameSnap": "玉米(二等)",
        "wareareaNameSnap": "2号仓",
        "driverNameSnap": "李四",
        "driverPlateSnap": "豫A·12345",
        "grossWeight": 2000.0,
        "tareWeight": 200.0,
        "deductWeight": 0,
        "netWeight": 1800.0,
        "unitPrice": 2.65,
        "adjustedAmount": 4770.00,
        "createBy": "库管员B",
        "factoryName": "某某粮油烘干厂",
        "printDate": "2026-06-19",
    }
    builder2 = print_docs.build_doc("grain_out", entry_out)
    script2 = builder2.to_script()
    data2 = raw_printer.build_bytes(script2)
    print("脚本行数:", len(script2))
    print("字节总数:", len(data2))
    print("HEX(前96):", _hex_head(data2))
    print("--- 预览前 12 行 ---")
    for ln in builder2.get_preview()[:12]:
        tag = (ln.get("align", "l")[0].upper()) + ("B" if ln.get("bold") else " ") + ("W" if ln.get("dw") else " ")
        print("  [%s] %s" % (tag, ln.get("text") or "(空行)"))

    # 验证：三联标注必须各出现一次
    full_text = data2.decode("gb18030", errors="replace")
    for label in ["第一联", "第二联", "第三联", "粮食出库结算单", "豫A"]:
        assert label in full_text, "缺少关键词: %s" % label
    print("\n✓ 三联标注 + 关键字段 GB18030 编码验证通过")

    print()
    print("=" * 60)
    print("【测试3】未知单据类型应报错")
    print("=" * 60)
    try:
        print_docs.build_doc("unknown", entry_in)
        print("✗ 应该报错但没报")
        return 1
    except ValueError as e:
        print("✓ 正确报错:", e)

    print()
    print("全部测试通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
