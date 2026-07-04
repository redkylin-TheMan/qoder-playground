"""print_docs.py — 三联针式打印单据模板（移植自 dprinter-web/lib/documents.js）

本模块只保留烘干厂需要的两种三联单：
  grain_in_triplicate(fields, font, model)   粮食入库结算单（一式三联）
  grain_out_triplicate(fields, font, model)  粮食出库结算单（一式三联）

字段来源：烘干厂前端 EntryV1.vue / Exit.vue 的单据详情对象（printDialog.entry）。
前端按 build_grain_in_fields / build_grain_out_fields 组装 fields 后 POST 给本服务；
本服务再喂给 triplicate() 构建 ESC/P 指令。

三联实现：在一卷连续纸上打印 3 份同样内容，每份顶部标注存根类型：
  （第一联）商户存根 / （第二联）客户存根 / （第三联）财务存根
物理复写由纸张层数决定（得力 DB-618KII 1+3 联，装 4 层纸一次打 4 份）。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from escp import EscpBuilder


# ============== 型号解析 ==============
# 得力 DB-618KII 实测机型参数（lineWidth=48 半角列，feedLines=5 走纸到撕纸位）。
# 首期只支持这一种；其它型号可在 models 表里追加。
# pageHeightLines: 连续纸物理页高(行数, 1/6"行距)，用于 ESC C 设页长 + FF 精确对齐穿孔。
#   7.5cm ≈ 18 行、9cm ≈ 21 行、11cm ≈ 26 行、14cm ≈ 33 行。
#   调参口诀：间距太大→数字调小，间距太小→数字调大。每次调 1~2 行试。
MODELS: Dict[str, Dict[str, Any]] = {
    "DB-618KII": {"name": "得力 DB-618KII", "columns": 82, "copies": 4, "lineWidth": 48, "feedLines": 5, "pageHeightLines": 18},
    "DS-600T": {"name": "得实 DS-600T", "columns": 106, "copies": 4, "lineWidth": 48, "feedLines": 5, "pageHeightLines": 18},
    "GENERIC_82": {"name": "通用 82列针式打印机", "columns": 82, "copies": 4, "lineWidth": 48, "feedLines": 5, "pageHeightLines": 18},
}


def resolve_model(model: Optional[Any]) -> Dict[str, Any]:
    """model: 字符串 key / {key, lineWidth, feedLines, pageHeightLines} / None
    → {lineWidth, feedLines, pageHeightLines}
    """
    if isinstance(model, str):
        m = MODELS.get(model, MODELS["GENERIC_82"])
        key = model
    elif isinstance(model, dict):
        key = model.get("key", "GENERIC_82")
        m = MODELS.get(key, MODELS["GENERIC_82"])
    else:
        m = MODELS["GENERIC_82"]
        key = "GENERIC_82"
    d = model if isinstance(model, dict) else {}
    return {
        "lineWidth": (d.get("lineWidth") if d.get("lineWidth") else m["lineWidth"]),
        "feedLines": (d.get("feedLines") if d.get("feedLines") else m["feedLines"]),
        "pageHeightLines": (d.get("pageHeightLines") if d.get("pageHeightLines") else m.get("pageHeightLines", 18)),
    }


def _merge(defaults: Dict[str, Any], src: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    out = dict(defaults)
    if src:
        for k, v in src.items():
            if v is not None:  # None 不覆盖，让默认值兜底
                out[k] = v
    return out


# ============== 字段组装（前端按这个结构传，也可前端直接传 fields 数组） ==============
def build_grain_in_fields(entry: Dict[str, Any]) -> Dict[str, Any]:
    """从烘干厂入库单 entry 组装三联单字段。

    entry 关键字段（来自 TblDryingGrainInbound / EntryV1.vue printDialog.entry）：
      entryNo, farmerName, grainNameSnap, wareareaNameSnap,
      grossWeight, tareWeight, deductWeight, netWeight,
      moisture, impurity, unitPrice, adjustedAmount, originalAmount,
      createBy, factoryName(本厂名)
    """
    def s(v):
        return "" if v is None or v == "" else str(v)

    amount = entry.get("adjustedAmount")
    if amount in (None, "", 0, "0"):
        amount = entry.get("originalAmount")

    fields: List[Tuple[str, str]] = [
        ("农　户", s(entry.get("farmerName")) or "现场散单"),
        ("身份证", s(entry.get("farmerIdCardSnap")) or s(entry.get("farmerIdCard"))),
        ("电　话", s(entry.get("farmerPhone")) or s(entry.get("farmerPhoneSnap"))),
        ("品　种", s(entry.get("grainNameSnap")) or s(entry.get("grainType"))),
        ("仓　位", s(entry.get("wareareaNameSnap")) or s(entry.get("wareareaName"))),
        ("车牌号", s(entry.get("driverPlateSnap")) or s(entry.get("driverPlate"))),
        ("毛重(kg)", s(entry.get("grossWeight"))),
        ("皮重(kg)", s(entry.get("tareWeight"))),
        ("扣重(kg)", s(entry.get("deductWeight")) or "0"),
        ("净重(kg)", s(entry.get("netWeight"))),
        ("水分/杂质", "%s%% / %s%%" % (s(entry.get("moisture")) or "-", s(entry.get("impurity")) or "-")),
        ("单价(元/kg)", s(entry.get("unitPrice"))),
        ("结算金额", "￥" + s(amount)),
        ("库管员", s(entry.get("createBy"))),
    ]
    # 去掉值为空的行（除"农户"外）
    fields = [(k, v) for k, v in fields if v not in ("", "None")]
    return {
        "companyName": s(entry.get("factoryName")) or "烘干厂",
        "title": "粮食入库结算单",
        "no": s(entry.get("entryNo")),
        "date": s(entry.get("printDate")),  # 前端可传，否则服务端用今天
        "fields": [{"k": k, "v": v} for k, v in fields],
        "remark": "",
    }


def build_grain_out_fields(entry: Dict[str, Any]) -> Dict[str, Any]:
    """从烘干厂出库单 entry 组装三联单字段。

    entry 关键字段（来自 TblDryingGrainOutbound / Exit.vue printDialog.entry）：
      exitNo, customerNameSnap, grainNameSnap, wareareaNameSnap,
      driverNameSnap, driverPlateSnap,
      grossWeight, tareWeight, deductWeight, netWeight,
      unitPrice, adjustedAmount, originalAmount, collectedAmount,
      createBy, factoryName(本厂名)
    """
    def s(v):
        return "" if v is None or v == "" else str(v)

    amount = entry.get("adjustedAmount")
    if amount in (None, "", 0, "0"):
        amount = entry.get("originalAmount")

    fields: List[Tuple[str, str]] = [
        ("客　户", s(entry.get("customerNameSnap")) or "现场散单"),
        ("品　种", s(entry.get("grainNameSnap"))),
        ("仓　位", s(entry.get("wareareaNameSnap"))),
        ("车牌号", s(entry.get("driverPlateSnap"))),
        ("毛重(kg)", s(entry.get("grossWeight"))),
        ("皮重(kg)", s(entry.get("tareWeight"))),
        ("扣重(kg)", s(entry.get("deductWeight")) or "0"),
        ("净重(kg)", s(entry.get("netWeight"))),
        ("单价(元/kg)", s(entry.get("unitPrice"))),
        ("应收金额", "￥" + s(amount)),
        ("库管员", s(entry.get("createBy"))),
    ]
    fields = [(k, v) for k, v in fields if v not in ("", "None")]
    return {
        "companyName": s(entry.get("factoryName")) or "烘干厂",
        "title": "粮食出库结算单",
        "no": s(entry.get("exitNo")),
        "date": s(entry.get("printDate")),
        "fields": [{"k": k, "v": v} for k, v in fields],
        "remark": "",
    }


# ============== 三联单构建 ==============
# ⚠️ "三联" 指的是物理三层复写纸（针头击打一次穿透碳复写 → 一张纸打出来就自带三联），
#    软件只需打印一遍。早期实现误把内容循环打 3 遍，会打出 3 倍内容 + 3 倍走纸。
# 字体预设（由前端 fontPreset 选中后作为 font 传入；未配置时用 DEFAULT_FONT 兜底）：
#   standard (默认) {bold:true, font:'hei', doubleStrike:true}  粗黑体 + 双重打印，复写穿透力最强
#   clear          {bold:false, font:'song'}                    清晰宋体，不晕染省墨
#   compact        {bold:false, font:'song', compact:true}      紧凑：标题也不倍高倍宽，最省纸
DEFAULT_FONT = {"bold": True, "font": "hei", "doubleStrike": True}  # = standard 预设；测试台/无 font 参数时兜底


def _build_triplicate(fields: Dict[str, Any], font: Optional[Dict[str, Any]], model: Optional[Any]) -> EscpBuilder:
    """通用三联单构建。fields 至少含 title/no/date/companyName/fields/remark。

    ⚠️ 三联 = 物理三层复写纸（针头击打一次穿透碳复写），软件只打印一遍。
    早期实现误循环打 3 遍 → 3 倍内容 + 3 倍走纸，已废弃。

    走纸对齐：用 ESC C 设页长(=物理纸高) + FF 换页，替代手动数行(feed_top/feed_to_tear)。
    打印机内部走纸计数器保证每页精确对齐穿孔，残差不累积。
    （7.5cm纸 ≈ 3英寸，旧方案每张走纸19行 vs 物理高17.7行，残差1.3行/张 → 第2张骑纸）

    布局：标准纸字段按 3 列分布（kv_triple，占满 82 列纸宽），窄纸自动降级。
    """
    rm = resolve_model(model)
    W = rm["lineWidth"]
    # 设定页长 = 物理纸高，让 FF(换页)精确走到下页顶部，根治连续打印骑纸。
    # 必须在 init 之后、内容之前发送（页长作用于后续 FF）。
    b = EscpBuilder({"lineWidth": W}).init(font or DEFAULT_FONT)
    b.set_page_length(lines=rm.get("pageHeightLines", 18))

    title = fields.get("title") or "结算单"
    no = fields.get("no") or ""
    date = fields.get("date") or ""
    company = fields.get("companyName") or ""
    ff = fields.get("fields") or []

    # 标题（居中加粗，非 compact 还倍高倍宽）
    b.separator("═")  # 双横线顶边
    b.title(title)
    # 表头信息（3列分布，窄纸降级 2 列/单列）
    header_items = []
    if no:
        header_items.append(("单　号", no))
    if date:
        header_items.append(("日　期", date))
    if company:
        header_items.append(("单　位", company))
    b.kv_triple(header_items, W)
    b.separator("─")  # 单横线分隔 表头↔字段
    # 字段区：过滤空值后按 3 列分布（窄纸自动降级）
    items = [(item.get("k", ""), item.get("v", "")) for item in ff if item.get("v") not in (None, "")]
    b.kv_triple(items, W)
    b.separator("─")  # 单横线分隔 字段↔签字
    # 签字栏：2 列左右排一行（窄纸降级单列）
    b.kv_pairs([("经办人签字", "____________"), ("复核签字", "____________")], W)
    b.separator("═")  # 双横线底边
    # FF(换页)：按 ESC C 设的页长精确走纸到下一页顶部。
    # 替代 feed_top/feed_to_tear：不再手动数行，零残差对齐穿孔。
    b.form_feed()
    return b


def grain_in_triplicate(fields: Dict[str, Any], font: Optional[Dict[str, Any]] = None, model: Optional[Any] = None) -> EscpBuilder:
    """粮食入库三联单。fields 可直接是 build_grain_in_fields 的产物。"""
    return _build_triplicate(fields, font, model)


def grain_out_triplicate(fields: Dict[str, Any], font: Optional[Dict[str, Any]] = None, model: Optional[Any] = None) -> EscpBuilder:
    """粮食出库三联单。fields 可直接是 build_grain_out_fields 的产物。"""
    return _build_triplicate(fields, font, model)


# ============== 分发 ==============
# 单据类型 → (构建函数, 字段组装函数)
DOC_BUILDERS = {
    "grain_in": (grain_in_triplicate, build_grain_in_fields),
    "grain_out": (grain_out_triplicate, build_grain_out_fields),
}


def build_doc(doc_type: str, entry: Dict[str, Any], font: Optional[Dict[str, Any]] = None, model: Optional[Any] = None) -> EscpBuilder:
    """分发入口：doc_type 决定用哪个模板，entry 喂给对应的字段组装函数。

    也可由调用方先调 build_grain_*_fields 得到 fields，再直接调 grain_*_triplicate。
    """
    if doc_type not in DOC_BUILDERS:
        raise ValueError("未知单据类型: %s（支持 grain_in / grain_out）" % doc_type)
    build_fn, fields_fn = DOC_BUILDERS[doc_type]
    fields = fields_fn(entry)
    return build_fn(fields, font, model)
