"""documents.py — 测试台用单据模板（移植自 dprinter-web/lib/documents.js）

与 print_docs.py 的区别：
  - print_docs.py  ：业务用，吃 entry 对象（前端 EntryV1/Exit 传来），内部组装字段
  - documents.py   ：测试台用，吃 fields 表单对象（测试台 UI 直接传），5 种模板

5 种模板：
  grainIn(fields, font, model)    粮食入库单
  grainOut(fields, font, model)   粮食出库单
  invoice(fields, font, model)    增值税发票样张
  receipt(fields, font, model)    小票 / 收银票
  triplicate(fields, font, model) 通用三联单（商户/客户/财务存根）

行宽约定：从型号参数取（默认 48 半角列），106列型号用 64。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import printer_models
from escp import EscpBuilder


# ============== 工具 ==============
def _resolve_model(model: Any) -> Dict[str, int]:
    """解析型号 → { lineWidth, feedLines }。"""
    key = model if isinstance(model, str) else (model.get("key") if isinstance(model, dict) else None)
    m = printer_models.get_model(key)
    return {
        "lineWidth": (model.get("lineWidth") if isinstance(model, dict) and model.get("lineWidth") else m["lineWidth"]),
        "feedLines": (model.get("feedLines") if isinstance(model, dict) and model.get("feedLines") else m["feedLines"]),
    }


def _merge(defaults: Dict[str, Any], src: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    out = dict(defaults)
    if src:
        for k, v in src.items():
            if v is not None:
                out[k] = v
    return out


def _header(b: EscpBuilder, w: int, company: str, title: str, no: str, date: str, page: str = "") -> EscpBuilder:
    b.align("center").text(company or "某某粮油有限公司").align("left")
    b.title(title)
    b.kv("单　号", no, w)
    b.kv("日　期", date, w)
    if page:
        b.kv("页　码", page, w)
    b.separator("=")
    return b


def _footer(b: EscpBuilder, w: int, f: Dict[str, Any]) -> EscpBuilder:
    b.separator("=")
    b.kv("制单人", f.get("maker", ""), w)
    if f.get("driverName"):
        b.kv("驾驶员", f["driverName"], w)
    if f.get("driverPhone"):
        b.kv("联系电话", f["driverPhone"], w)
    if f.get("plateNo"):
        b.kv("车牌号", f["plateNo"], w)
    b.separator("-")
    b.text("【收款信息】")
    if f.get("payee"):
        b.kv("收款账户", f["payee"], w)
    if f.get("payeeBank"):
        b.kv("开户银行", f["payeeBank"], w)
    if f.get("payAmount") is not None:
        b.kv("收款金额", "￥ " + str(f["payAmount"]), w)
    if f.get("payMethod"):
        b.kv("收款方式", f["payMethod"], w)
    b.separator("-")
    b.kv("经办人签字", "____________", w // 2)
    b.kv("复核人签字", "____________", w // 2)
    b.feed(1)
    return b


# ============== 粮食入库单 ==============
DEFAULT_GRAIN_IN: Dict[str, Any] = {
    "companyName": "某某粮油有限公司",
    "no": "RK20260617-0001",
    "date": "2026-06-17",
    "goods": "小麦(一等)",
    "outWeight": "1500.5",
    "inWeight": "1498.0",
    "deduction": "2.5",
    "unitPrice": "2.80",
    "amount": "4194.40",
    "maker": "张三",
    "driverName": "李四",
    "driverPhone": "138-0000-0001",
    "plateNo": "豫A·12345",
    "payee": "某某粮油有限公司",
    "payeeBank": "中国农业银行 某某支行",
    "payAmount": "4194.40",
    "payMethod": "银行转账",
}


def grain_in(fields: Optional[Dict[str, Any]] = None, font: Optional[Dict[str, Any]] = None, model: Any = None) -> EscpBuilder:
    f = _merge(DEFAULT_GRAIN_IN, fields)
    rm = _resolve_model(model)
    W = rm["lineWidth"]
    b = EscpBuilder({"lineWidth": W}).init(font or {})
    _header(b, W, f["companyName"], "粮 食 入 库 单", f["no"], f["date"])

    b.text("【货物信息】")
    b.table_row([
        {"text": "货品名称", "align": "center", "width": 18},
        {"text": "出库重量(kg)", "align": "center", "width": 14},
        {"text": "入库重量(kg)", "align": "center", "width": 14},
    ])
    b.table_row([
        {"text": f["goods"], "width": 18},
        {"text": f["outWeight"], "align": "right", "width": 14},
        {"text": f["inWeight"], "align": "right", "width": 14},
    ])
    b.separator("-")
    b.kv("扣减重量(kg)", f["deduction"], W)
    b.kv("单价(元/kg)", f["unitPrice"], W)
    b.kv("结算金额(元)", "￥ " + f["amount"], W)
    _footer(b, W, f)
    b.feed_to_tear(rm["feedLines"])
    return b


# ============== 粮食出库单 ==============
DEFAULT_GRAIN_OUT: Dict[str, Any] = {
    "companyName": "某某粮油有限公司",
    "no": "CK20260617-0001",
    "date": "2026-06-17",
    "goods": "玉米(二等)",
    "inWeight": "2000.0",
    "outWeight": "2000.0",
    "deduction": "0.0",
    "unitPrice": "2.65",
    "amount": "5300.00",
    "maker": "王五",
    "driverName": "赵六",
    "driverPhone": "139-0000-0002",
    "plateNo": "鲁B·66888",
    "payee": "某某粮油有限公司",
    "payeeBank": "中国农业银行 某某支行",
    "payAmount": "5300.00",
    "payMethod": "银行转账",
}


def grain_out(fields: Optional[Dict[str, Any]] = None, font: Optional[Dict[str, Any]] = None, model: Any = None) -> EscpBuilder:
    f = _merge(DEFAULT_GRAIN_OUT, fields)
    rm = _resolve_model(model)
    W = rm["lineWidth"]
    b = EscpBuilder({"lineWidth": W}).init(font or {})
    _header(b, W, f["companyName"], "粮 食 出 库 单", f["no"], f["date"])

    b.text("【货物信息】")
    b.table_row([
        {"text": "货品名称", "align": "center", "width": 18},
        {"text": "库存重量(kg)", "align": "center", "width": 14},
        {"text": "出库重量(kg)", "align": "center", "width": 14},
    ])
    b.table_row([
        {"text": f["goods"], "width": 18},
        {"text": f["inWeight"], "align": "right", "width": 14},
        {"text": f["outWeight"], "align": "right", "width": 14},
    ])
    b.separator("-")
    b.kv("扣减重量(kg)", f["deduction"], W)
    b.kv("单价(元/kg)", f["unitPrice"], W)
    b.kv("结算金额(元)", "￥ " + f["amount"], W)
    _footer(b, W, f)
    b.feed_to_tear(rm["feedLines"])
    return b


# ============== 增值税发票样张 ==============
DEFAULT_INVOICE: Dict[str, Any] = {
    "no": "01100210011112345678",
    "date": "2026-06-17",
    "seller": "某某粮油有限公司  纳税人识别号: 91110100000000000A",
    "sellerAddr": "地址: 河南省郑州市某某路1号  电话: 0371-0000000",
    "sellerBank": "开户行: 农行某某支行  账号: 6228 0000 0000 0000 000",
    "buyer": "某某食品有限公司  纳税人识别号: 91110100000000000B",
    "items": [
        {"name": "小麦(一等)", "spec": "一等", "unit": "kg", "qty": "5000", "price": "2.80", "rate": "9%", "amount": "14000.00", "tax": "1260.00"},
        {"name": "玉米(二等)", "spec": "二等", "unit": "kg", "qty": "3000", "price": "2.65", "rate": "9%", "amount": "7950.00", "tax": "715.50"},
    ],
    "totalAmount": "21950.00",
    "totalTax": "1975.50",
    "total": "23925.50",
    "totalCN": "贰万叁仟玖佰贰拾伍元伍角整",
    "remark": "本发票为样张测试，不作为报销凭证",
    "maker": "张三",
}


def invoice(fields: Optional[Dict[str, Any]] = None, font: Optional[Dict[str, Any]] = None, model: Any = None) -> EscpBuilder:
    f = _merge(DEFAULT_INVOICE, fields)
    rm = _resolve_model(model)
    W = rm["lineWidth"]
    b = EscpBuilder({"lineWidth": W}).init(font or {})
    b.align("center").bold(True).text("★ 增值税专用发票 ★").bold(False).align("left")
    b.kv("发票号码", f["no"], W)
    b.kv("开票日期", f["date"], W)
    b.separator("=")
    b.text("购货方：" + f["buyer"])
    b.separator("-")
    b.table_row([
        {"text": "货物名称", "align": "center", "width": 12},
        {"text": "数量", "align": "right", "width": 6},
        {"text": "单价", "align": "right", "width": 7},
        {"text": "金额", "align": "right", "width": 9},
        {"text": "税率", "align": "center", "width": 5},
        {"text": "税额", "align": "right", "width": 8},
    ])
    b.separator("-")
    for it in f.get("items") or []:
        b.table_row([
            {"text": it.get("name", ""), "width": 12},
            {"text": str(it.get("qty", "")), "align": "right", "width": 6},
            {"text": str(it.get("price", "")), "align": "right", "width": 7},
            {"text": str(it.get("amount", "")), "align": "right", "width": 9},
            {"text": str(it.get("rate", "")), "align": "center", "width": 5},
            {"text": str(it.get("tax", "")), "align": "right", "width": 8},
        ])
    b.separator("-")
    b.kv("价税合计(大写)", f["totalCN"], W)
    b.kv("价税合计(小写)", "￥ " + f["total"], W)
    b.kv("合计金额", "￥ " + f["totalAmount"], W)
    b.kv("合计税额", "￥ " + f["totalTax"], W)
    b.separator("-")
    b.text("销货方：" + f["seller"])
    if f.get("sellerAddr"):
        b.text(f["sellerAddr"])
    if f.get("sellerBank"):
        b.text(f["sellerBank"])
    b.separator("-")
    b.kv("备注", f["remark"], W)
    b.kv("开票人", f["maker"], W)
    b.feed_to_tear(rm["feedLines"])
    return b


# ============== 小票 / 收银票 ==============
DEFAULT_RECEIPT: Dict[str, Any] = {
    "store": "某某粮油便利店",
    "addr": "河南省郑州市某某路88号",
    "phone": "0371-88888888",
    "cashier": "001",
    "no": "20260617001",
    "date": "2026-06-17 14:30:00",
    "items": [
        {"name": "东北大米5kg", "qty": "2", "price": "45.00"},
        {"name": "金龙鱼食用油5L", "qty": "1", "price": "68.00"},
        {"name": "特一粉10kg", "qty": "1", "price": "52.00"},
        {"name": "玉米糁2.5kg", "qty": "3", "price": "12.00"},
    ],
    "payMethod": "微信支付",
    "payAmount": "249.00",
    "change": "0.00",
    "member": "138****0001",
    "points": "1200",
}


def receipt(fields: Optional[Dict[str, Any]] = None, font: Optional[Dict[str, Any]] = None, model: Any = None) -> EscpBuilder:
    f = _merge(DEFAULT_RECEIPT, fields)
    rm = _resolve_model(model)
    b = EscpBuilder({"lineWidth": 32}).init(font or {})  # 小票固定窄版 32 列
    b.align("center")
    b.bold(True).double_height(True).text(f["store"]).normal_size().bold(False)
    b.text(f["addr"])
    b.text("电话: " + f["phone"])
    b.separator("-")
    b.align("left")
    b.kv("单号", f["no"], 32)
    b.kv("时间", f["date"], 32)
    b.kv("收银员", f["cashier"], 32)
    b.separator("-")
    b.table_row([
        {"text": "商品", "width": 16},
        {"text": "数量", "align": "right", "width": 4},
        {"text": "金额", "align": "right", "width": 9},
    ])
    total = 0.0
    items = f.get("items") or []
    for it in items:
        b.table_row([
            {"text": it.get("name", ""), "width": 16},
            {"text": str(it.get("qty", "")), "align": "right", "width": 4},
            {"text": str(it.get("price", "")), "align": "right", "width": 9},
        ])
        try:
            total += float(it.get("price", 0)) * float(it.get("qty", 0))
        except (TypeError, ValueError):
            pass
    b.separator("-")
    b.kv("商品总数", str(len(items)), 32)
    b.kv("合计", "￥%.2f" % total, 32)
    b.separator("-")
    b.kv("付款方式", f["payMethod"], 32)
    b.kv("实付", "￥" + str(f["payAmount"]), 32)
    b.kv("找零", "￥" + str(f["change"]), 32)
    if f.get("member"):
        b.separator("-")
        b.kv("会员", f["member"], 32)
        b.kv("积分余额", f["points"], 32)
    b.separator("=")
    b.align("center")
    b.text("谢谢惠顾，欢迎再次光临！")
    b.text("★ 留存小票作为退换货凭证 ★")
    b.feed(2)
    b.text("▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆")
    b.text("    [ 二维码位置 ]    ")
    b.text("▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆")
    b.feed_to_tear(rm["feedLines"])
    return b


# ============== 通用三联单 ==============
DEFAULT_TRIPLICATE: Dict[str, Any] = {
    "companyName": "某某粮油有限公司",
    "title": "过磅结算单",
    "no": "GB20260617-0001",
    "date": "2026-06-17",
    "fields": [
        {"k": "货品名称", "v": "小麦(一等)"},
        {"k": "毛重(kg)", "v": "1510.0"},
        {"k": "皮重(kg)", "v": "9.5"},
        {"k": "净重(kg)", "v": "1500.5"},
        {"k": "单价(元/kg)", "v": "2.80"},
        {"k": "金额(元)", "v": "4201.40"},
        {"k": "制单人", "v": "张三"},
        {"k": "司机", "v": "李四 138-0000-0001"},
        {"k": "车牌", "v": "豫A·12345"},
    ],
    "remark": "本单一式三联：商户存根(红)/客户存根(蓝)/财务存根(黑)",
}


def triplicate(fields: Optional[Dict[str, Any]] = None, font: Optional[Dict[str, Any]] = None, model: Any = None) -> EscpBuilder:
    f = _merge(DEFAULT_TRIPLICATE, fields)
    rm = _resolve_model(model)
    W = rm["lineWidth"]
    b = EscpBuilder({"lineWidth": W}).init(font or {})
    copies = ["（第一联）商 户 存 根", "（第二联）客 户 存 根", "（第三联）财 务 存 根"]
    for copy_label in copies:
        b.align("center").bold(True).text(copy_label).bold(False).align("left")
        b.title(f["title"])
        b.kv("单号", f["no"], W)
        b.kv("日期", f["date"], W)
        b.kv("单位", f["companyName"], W)
        b.separator("-")
        for item in f.get("fields") or []:
            b.kv(item.get("k", ""), str(item.get("v", "")), W)
        b.separator("-")
        b.kv("经办人签字", "____________", W // 2)
        b.kv("复核签字", "____________", W // 2)
        if f.get("remark"):
            b.separator()
            b.text(f["remark"])
        b.feed(2)
        b.separator("·")
        b.feed(2)
    b.feed_to_tear(rm["feedLines"])
    return b


# ============== 分发 ==============
DOC_BUILDERS = {
    "grainIn": grain_in,
    "grainOut": grain_out,
    "invoice": invoice,
    "receipt": receipt,
    "triplicate": triplicate,
}

DEFAULTS = {
    "grainIn": DEFAULT_GRAIN_IN,
    "grainOut": DEFAULT_GRAIN_OUT,
    "invoice": DEFAULT_INVOICE,
    "receipt": DEFAULT_RECEIPT,
    "triplicate": DEFAULT_TRIPLICATE,
}


def build_doc(doc_type: str, fields: Optional[Dict[str, Any]] = None,
              font: Optional[Dict[str, Any]] = None, model: Any = None) -> EscpBuilder:
    """分发入口：doc_type → 对应模板函数。"""
    if doc_type not in DOC_BUILDERS:
        raise ValueError("未知单据类型: %s（支持 %s）" % (doc_type, " / ".join(DOC_BUILDERS.keys())))
    return DOC_BUILDERS[doc_type](fields, font, model)
