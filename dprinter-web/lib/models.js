'use strict';
/*
 * lib/models.js — 得力针式打印机全系型号参数表
 * ---------------------------------------------------------------------------
 * 得力全系针打均为 ESC/P-K 兼容，指令通用。型号差异只有数值参数：
 *   columns  : 物理列宽（半角位）
 *   copies   : 复写能力（1+N 联）
 *   lineWidth: 单据默认行宽（半角位），通常 columns-左右边距
 *   feedLines: 走纸到撕纸位的行数（因进纸机构不同略有差异）
 *   hwIds    : Windows PnP 硬件ID（USBPRINT\...），用于自动探测匹配
 *   driverUrl: 驱动下载链接（OSS），用户点按钮直达。"<OSS:型号>" 为占位符
 *
 * 数据来源：得力官方/驱动天空/打印机驱动网规格页（2026-06 调研）。
 * 部分罕见面市型号的精确 feedLines/columns 若与实物有出入，
 * 可在使用中微调 —— 不影响指令正确性，只影响撕纸位置和行宽。
 */

var MODELS = {
  // ==================== 82列平推主力（发票/票据/入库出库单）====================
  'DB-618KII': {
    name: '得力 DB-618KII', series: 'DB', columns: 82, copies: 4,
    lineWidth: 48, feedLines: 5, hwIds: ['DELIDB-618KII', 'DELIDB-618KII'],
    driverUrl: '<OSS:DB-618KII>', notes: '平推式 1+3联，发票/票据主力（本项目实测机型）'
  },
  'DB-615K': {
    name: '得力 DB-615K', series: 'DB', columns: 82, copies: 4,
    lineWidth: 48, feedLines: 5, hwIds: ['DELIDB-615K', 'DELIDB-615KII'],
    driverUrl: '<OSS:DB-615K>', notes: '平推式 1+3联'
  },
  'DB-630K': {
    name: '得力 DB-630K', series: 'DB', columns: 82, copies: 4,
    lineWidth: 48, feedLines: 5, hwIds: ['DELIDB-630K'],
    driverUrl: '<OSS:DB-630K>', notes: '平推式 1+3联'
  },
  'DB-680K': {
    name: '得力 DB-680K', series: 'DB', columns: 82, copies: 5,
    lineWidth: 48, feedLines: 5, hwIds: ['DELIDB-680K'],
    driverUrl: '<OSS:DB-680K>', notes: '平推式 1+4联'
  },
  'DL-610KII': {
    name: '得力 DL-610KII', series: 'DL', columns: 82, copies: 4,
    lineWidth: 48, feedLines: 5, hwIds: ['DELIDL-610KII', 'DELIDL-610K'],
    driverUrl: '<OSS:DL-610KII>', notes: '平推式 1+3联'
  },
  'DL-630K': {
    name: '得力 DL-630K', series: 'DL', columns: 82, copies: 4,
    lineWidth: 48, feedLines: 5, hwIds: ['DELIDL-630K'],
    driverUrl: '<OSS:DL-630K>', notes: '平推式 1+3联，USB+并口'
  },
  'DL-605K': {
    name: '得力 DL-605K', series: 'DL', columns: 82, copies: 4,
    lineWidth: 48, feedLines: 5, hwIds: ['DELIDL-605K'],
    driverUrl: '<OSS:DL-605K>', notes: '24针 82列'
  },
  'DL-830K': {
    name: '得力 DL-830K', series: 'DL', columns: 85, copies: 5,
    lineWidth: 48, feedLines: 5, hwIds: ['DELIDL-830K'],
    driverUrl: '<OSS:DL-830K>', notes: '85列'
  },

  // ==================== 106列宽幅（报表/宽单据）====================
  'DB-690K': {
    name: '得力 DB-690K', series: 'DB', columns: 106, copies: 5,
    lineWidth: 64, feedLines: 5, hwIds: ['DELIDB-690K'],
    driverUrl: '<OSS:DB-690K>', notes: '106列宽幅'
  },
  'DE-620KII': {
    name: '得力 DE-620KII', series: 'DE', columns: 85, copies: 5,
    lineWidth: 50, feedLines: 5, hwIds: ['DELIDE-620KII', 'DELIDE-620K'],
    driverUrl: '<OSS:DE-620KII>', notes: '85~106列，前后进纸'
  },
  'DL-735K': {
    name: '得力 DL-735K', series: 'DL', columns: 82, copies: 5,
    lineWidth: 48, feedLines: 5, hwIds: ['DELIDL-735K'],
    driverUrl: '<OSS:DL-735K>', notes: '82列 1+4联'
  },

  // ==================== 高速/重型（多联复写）====================
  'DL-730K': {
    name: '得力 DL-730K', series: 'DL', columns: 82, copies: 7,
    lineWidth: 48, feedLines: 5, hwIds: ['DELIDL-730K'],
    driverUrl: '<OSS:DL-730K>', notes: '高速 1+7联，复写多联首选'
  },
  'DL-805K': {
    name: '得力 DL-805K', series: 'DL', columns: 82, copies: 6,
    lineWidth: 48, feedLines: 5, hwIds: ['DELIDL-805K'],
    driverUrl: '<OSS:DL-805K>', notes: '24针 1+5联'
  },
  'DL-940K': {
    name: '得力 DL-940K', series: 'DL', columns: 82, copies: 7,
    lineWidth: 48, feedLines: 5, hwIds: ['DELIDL-940K'],
    driverUrl: '<OSS:DL-940K>', notes: '1+6联'
  },
  'DE-600K': {
    name: '得力 DE-600K', series: 'DE', columns: 82, copies: 5,
    lineWidth: 48, feedLines: 5, hwIds: ['DELIDE-600K'],
    driverUrl: '<OSS:DE-600K>', notes: '前进纸 1+4联'
  },

  // ==================== 通用兜底（未知型号也能用）====================
  'GENERIC_82': {
    name: '通用 82列针式打印机', series: 'GENERIC', columns: 82, copies: 4,
    lineWidth: 48, feedLines: 5, hwIds: [],
    driverUrl: '<OSS:UNIVERSAL_X64>', notes: '未知型号兜底，适用大多数得力82列针打'
  },
  'GENERIC_106': {
    name: '通用 106列针式打印机', series: 'GENERIC', columns: 106, copies: 5,
    lineWidth: 64, feedLines: 5, hwIds: [],
    driverUrl: '<OSS:UNIVERSAL_X64>', notes: '未知型号兜底，106列宽幅'
  }
};

// 综合驱动索引页（网页"查看全部驱动"按钮用）
var DRIVER_INDEX_PAGES = [
  { name: '得力官方客服网盘（推荐）', url: 'https://netdisk.nbdeli.com:4436/l/YFgaYD' },
  { name: '中关村在线·得力驱动合集', url: 'https://driver.zol.com.cn/print_drivers/33499_page_1.html' },
  { name: '打印机驱动网·得力专页', url: 'https://www.dyjqd.com/driver/deli/list_277_1.html' },
  { name: '驱动天空·得力针打专区', url: 'https://www.drvsky.com/sort/863_1.htm' }
];

// 通用驱动（兜底下载）
var UNIVERSAL_DRIVERS = {
  x64: '<OSS:UNIVERSAL_X64>',   // 得力针打通用驱动 64位
  x86: '<OSS:UNIVERSAL_X86>',   // 得力针打通用驱动 32位
  officialNetdisk: 'https://netdisk.nbdeli.com:4436/l/YFgaYD'
};

// ---------- 工具函数 ----------

// 按硬件ID匹配型号。hwIdList: 字符串数组（来自 WMI 的 PNPDeviceID）
// 返回 modelKey 或 null
function detectModel(hwIdList) {
  if (!hwIdList || !hwIdList.length) return null;
  // 把硬件ID统一格式：去空格、转大写
  var norm = hwIdList.map(function (s) {
    return String(s || '').replace(/\s+/g, '').toUpperCase();
  });
  var keys = Object.keys(MODELS);
  for (var i = 0; i < keys.length; i++) {
    var m = MODELS[keys[i]];
    if (!m.hwIds || !m.hwIds.length) continue;
    for (var j = 0; j < m.hwIds.length; j++) {
      var hwid = m.hwIds[j].replace(/\s+/g, '').toUpperCase();
      for (var k = 0; k < norm.length; k++) {
        if (norm[k].indexOf(hwid) >= 0 || hwid.indexOf(norm[k]) >= 0) {
          return keys[i];
        }
      }
    }
  }
  return null;
}

// 取型号配置（带兜底）
function getModel(key) {
  if (key && MODELS[key]) return MODELS[key];
  return MODELS.GENERIC_82;
}

// 导出给前端用的精简清单（不含 hwIds 细节）
function listModels() {
  var out = [];
  Object.keys(MODELS).forEach(function (k) {
    var m = MODELS[k];
    out.push({
      key: k,
      name: m.name,
      series: m.series,
      columns: m.columns,
      copies: m.copies,
      lineWidth: m.lineWidth,
      feedLines: m.feedLines,
      driverUrl: m.driverUrl,
      notes: m.notes
    });
  });
  return out;
}

module.exports = {
  MODELS: MODELS,
  DRIVER_INDEX_PAGES: DRIVER_INDEX_PAGES,
  UNIVERSAL_DRIVERS: UNIVERSAL_DRIVERS,
  detectModel: detectModel,
  getModel: getModel,
  listModels: listModels
};
