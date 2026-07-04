"""printer_models.py — 针式打印机型号参数表 + 自动探测

移植自 dprinter-web/lib/models.js，扩展了得实 DS-600T。
得力全系针打均为 ESC/P-K 兼容，指令通用。型号差异只有数值参数：
  columns  : 物理列宽（半角位）
  copies   : 复写能力（1+N 联）
  lineWidth: 单据默认行宽（半角位），通常 columns-左右边距
  feedLines: 走纸到撕纸位的行数（因进纸机构不同略有差异）
  hwIds    : Windows PnP 硬件ID（USBPRINT\\...），用于自动探测匹配
  driverUrl: 驱动下载链接（OSS），"<OSS:型号>" 为占位符

数据来源：得力官方/驱动天空/打印机驱动网规格页（2026-06 调研）。
部分罕见面市型号的精确 feedLines/columns 若与实物有出入，
可在使用中微调 —— 不影响指令正确性，只影响撕纸位置和行宽。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

# ============== 型号表 ==============
MODELS: Dict[str, Dict[str, Any]] = {
    # ==================== 82列平推主力（发票/票据/入库出库单）====================
    "DB-618KII": {
        "name": "得力 DB-618KII", "series": "DB", "columns": 82, "copies": 4,
        "lineWidth": 48, "feedLines": 5, "hwIds": ["DELIDB-618KII", "DELIDB-618KII"],
        "driverUrl": "<OSS:DB-618KII>", "notes": "平推式 1+3联，发票/票据主力（本项目实测机型）",
    },
    "DB-615K": {
        "name": "得力 DB-615K", "series": "DB", "columns": 82, "copies": 4,
        "lineWidth": 48, "feedLines": 5, "hwIds": ["DELIDB-615K", "DELIDB-615KII"],
        "driverUrl": "<OSS:DB-615K>", "notes": "平推式 1+3联",
    },
    "DB-630K": {
        "name": "得力 DB-630K", "series": "DB", "columns": 82, "copies": 4,
        "lineWidth": 48, "feedLines": 5, "hwIds": ["DELIDB-630K"],
        "driverUrl": "<OSS:DB-630K>", "notes": "平推式 1+3联",
    },
    "DB-680K": {
        "name": "得力 DB-680K", "series": "DB", "columns": 82, "copies": 5,
        "lineWidth": 48, "feedLines": 5, "hwIds": ["DELIDB-680K"],
        "driverUrl": "<OSS:DB-680K>", "notes": "平推式 1+4联",
    },
    "DL-610KII": {
        "name": "得力 DL-610KII", "series": "DL", "columns": 82, "copies": 4,
        "lineWidth": 48, "feedLines": 5, "hwIds": ["DELIDL-610KII", "DELIDL-610K"],
        "driverUrl": "<OSS:DL-610KII>", "notes": "平推式 1+3联",
    },
    "DL-630K": {
        "name": "得力 DL-630K", "series": "DL", "columns": 82, "copies": 4,
        "lineWidth": 48, "feedLines": 5, "hwIds": ["DELIDL-630K"],
        "driverUrl": "<OSS:DL-630K>", "notes": "平推式 1+3联，USB+并口",
    },
    "DL-605K": {
        "name": "得力 DL-605K", "series": "DL", "columns": 82, "copies": 4,
        "lineWidth": 48, "feedLines": 5, "hwIds": ["DELIDL-605K"],
        "driverUrl": "<OSS:DL-605K>", "notes": "24针 82列",
    },
    "DL-830K": {
        "name": "得力 DL-830K", "series": "DL", "columns": 85, "copies": 5,
        "lineWidth": 48, "feedLines": 5, "hwIds": ["DELIDL-830K"],
        "driverUrl": "<OSS:DL-830K>", "notes": "85列",
    },
    # ==================== 106列宽幅（报表/宽单据）====================
    "DB-690K": {
        "name": "得力 DB-690K", "series": "DB", "columns": 106, "copies": 5,
        "lineWidth": 64, "feedLines": 5, "hwIds": ["DELIDB-690K"],
        "driverUrl": "<OSS:DB-690K>", "notes": "106列宽幅",
    },
    "DE-620KII": {
        "name": "得力 DE-620KII", "series": "DE", "columns": 85, "copies": 5,
        "lineWidth": 50, "feedLines": 5, "hwIds": ["DELIDE-620KII", "DELIDE-620K"],
        "driverUrl": "<OSS:DE-620KII>", "notes": "85~106列，前后进纸",
    },
    "DL-735K": {
        "name": "得力 DL-735K", "series": "DL", "columns": 82, "copies": 5,
        "lineWidth": 48, "feedLines": 5, "hwIds": ["DELIDL-735K"],
        "driverUrl": "<OSS:DL-735K>", "notes": "82列 1+4联",
    },
    # ==================== 高速/重型（多联复写）====================
    "DL-730K": {
        "name": "得力 DL-730K", "series": "DL", "columns": 82, "copies": 7,
        "lineWidth": 48, "feedLines": 5, "hwIds": ["DELIDL-730K"],
        "driverUrl": "<OSS:DL-730K>", "notes": "高速 1+7联，复写多联首选",
    },
    "DL-805K": {
        "name": "得力 DL-805K", "series": "DL", "columns": 82, "copies": 6,
        "lineWidth": 48, "feedLines": 5, "hwIds": ["DELIDL-805K"],
        "driverUrl": "<OSS:DL-805K>", "notes": "24针 1+5联",
    },
    "DL-940K": {
        "name": "得力 DL-940K", "series": "DL", "columns": 82, "copies": 7,
        "lineWidth": 48, "feedLines": 5, "hwIds": ["DELIDL-940K"],
        "driverUrl": "<OSS:DL-940K>", "notes": "1+6联",
    },
    "DE-600K": {
        "name": "得力 DE-600K", "series": "DE", "columns": 82, "copies": 5,
        "lineWidth": 48, "feedLines": 5, "hwIds": ["DELIDE-600K"],
        "driverUrl": "<OSS:DE-600K>", "notes": "前进纸 1+4联",
    },
    # ==================== 得实（另一品牌，ESC/P 兼容）====================
    "DS-600T": {
        "name": "得实 DS-600T", "series": "DS", "columns": 106, "copies": 4,
        "lineWidth": 48, "feedLines": 5, "hwIds": [],
        "driverUrl": "<OSS:DS-600T>", "notes": "超高速24针专业发票打印机 106列",
    },
    # ==================== 通用兜底（未知型号也能用）====================
    "GENERIC_82": {
        "name": "通用 82列针式打印机", "series": "GENERIC", "columns": 82, "copies": 4,
        "lineWidth": 48, "feedLines": 5, "hwIds": [],
        "driverUrl": "<OSS:UNIVERSAL_X64>", "notes": "未知型号兜底，适用大多数82列针打",
    },
    "GENERIC_106": {
        "name": "通用 106列针式打印机", "series": "GENERIC", "columns": 106, "copies": 5,
        "lineWidth": 64, "feedLines": 5, "hwIds": [],
        "driverUrl": "<OSS:UNIVERSAL_X64>", "notes": "未知型号兜底，106列宽幅",
    },
}

# 综合驱动索引页（网页"查看全部驱动"按钮用）
DRIVER_INDEX_PAGES = [
    {"name": "得力官方客服网盘（推荐）", "url": "https://netdisk.nbdeli.com:4436/l/YFgaYD"},
    {"name": "中关村在线·得力驱动合集", "url": "https://driver.zol.com.cn/print_drivers/33499_page_1.html"},
    {"name": "打印机驱动网·得力专页", "url": "https://www.dyjqd.com/driver/deli/list_277_1.html"},
    {"name": "驱动天空·得力针打专区", "url": "https://www.drvsky.com/sort/863_1.htm"},
]

# 通用驱动（兜底下载）
UNIVERSAL_DRIVERS = {
    "x64": "<OSS:UNIVERSAL_X64>",
    "x86": "<OSS:UNIVERSAL_X86>",
    "officialNetdisk": "https://netdisk.nbdeli.com:4436/l/YFgaYD",
}


# ============== 工具函数 ==============
def detect_model(hw_id_list: Optional[List[str]]) -> Optional[str]:
    """按硬件ID匹配型号。hw_id_list 来自 WMI 的 PNPDeviceID。返回 modelKey 或 None。"""
    if not hw_id_list:
        return None
    # 把硬件ID统一格式：去空格、转大写
    norm = [str(s or "").replace(" ", "").upper() for s in hw_id_list]
    for key, m in MODELS.items():
        hwids = m.get("hwIds") or []
        if not hwids:
            continue
        for hwid in hwids:
            h = hwid.replace(" ", "").upper()
            for n in norm:
                if h in n or n in h:
                    return key
    return None


def get_model(key: Optional[str]) -> Dict[str, Any]:
    """取型号配置（带 GENERIC_82 兜底）。"""
    if key and key in MODELS:
        return MODELS[key]
    return MODELS["GENERIC_82"]


def list_models() -> List[Dict[str, Any]]:
    """导出给前端用的精简清单（不含 hwIds 细节）。"""
    out: List[Dict[str, Any]] = []
    for key, m in MODELS.items():
        out.append({
            "key": key,
            "name": m["name"],
            "series": m["series"],
            "columns": m["columns"],
            "copies": m["copies"],
            "lineWidth": m["lineWidth"],
            "feedLines": m["feedLines"],
            "driverUrl": m["driverUrl"],
            "notes": m["notes"],
        })
    return out
