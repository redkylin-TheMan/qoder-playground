// =========================================================
// 粮食出入库小票 — Mock 样例数据
//  字段结构 1:1 对齐主项目 entry:
//   - 出库: liangyizhilian-drying-pc-fe/src/views/Exit.vue
//   - 入库: liangyizhilian-drying-pc-fe/src/views/EntryV1.vue
//  每类小票提供「完整」和「不完整(缺字段)」两组, 验证模板对缺省值的容错。
//
//  type 字段对应 grainTemplates.js 的渲染分派:
//    'exit'    出库结算小票
//    'inbound' 入库结算小票
//    'gross'   入库回皮凭证
// =========================================================

const FACTORY = '安徽舒州生态农业科技股份有限公司';

// QR payload 构造 (与主项目一致)
//   出库: { no, type:'exit', c:验码 }
//   入库结算: { no, type:'inbound' }
//   回皮: { no, type:'tare' }
function qrPayload(type, no, id) {
  if (type === 'exit') return JSON.stringify({ no, type: 'exit', c: String(id || '').slice(-8) });
  if (type === 'tare') return JSON.stringify({ no, type: 'tare' });
  return JSON.stringify({ no, type: 'inbound' });
}

// ---------------- 出库 ----------------
const exitFull = {
  id: '17920123456789012345',
  exitNo: 'CK20260623-0007',
  customerNameSnap: '合肥市金谷粮油贸易有限公司',
  grainNameSnap: '杂交水稻',
  wareareaNameSnap: '1号烘干仓',
  rfidCardNo: 'A017',
  grossWeight: 32180,
  tareWeight: 8620,
  netWeight: 23560,
  unitPrice: 2.88,
  driverPlateSnap: '皖A·B2380',
  adjustedAmount: 67852.8,
  originalAmount: 67852.8,
  createBy: '王库管',
  weighTimeGross: '2026-06-23T14:32:08',
  createTime: '2026-06-23T14:35:20',
  truckNoOfDay: 3,
};

const exitSparse = {
  id: '17920999900000000999',
  exitNo: 'CK20260623-0099',
  customerNameSnap: '',          // 现场散单
  grainNameSnap: '小麦',
  wareareaNameSnap: '',
  rfidCardNo: '',                // 无卡号
  grossWeight: 12300,
  tareWeight: 3000,
  netWeight: 9300,
  unitPrice: 2.45,
  driverPlateSnap: '',
  adjustedAmount: null,          // 用 originalAmount 兜底
  originalAmount: 22785,
  createBy: '李仓管',
  weighTimeGross: '',
  createTime: '2026-06-23T16:01:00',
  truckNoOfDay: 1,
};

// ---------------- 入库结算 ----------------
const inboundFull = {
  id: '17880123456789000111',
  entryNo: 'RK20260623-0042',
  farmerName: '张老三',
  grainType: '杂交水稻',
  wareareaName: '3号烘干仓',
  rfidCardNo: 'B023',
  grossWeight: 12580,
  tareWeight: 3120,
  netWeight: 9460,
  unitPrice: 2.72,
  moisture: 13.8,
  impurity: 1.2,
  adjustedAmount: 25731.2,
  totalAmount: 25731.2,
  operator: '王库管',
  createBy: '王库管',
  createTime: '2026-06-23T09:18:45',
  truckNoOfDay: 2,
};

const inboundSparse = {
  id: '17880999800000000555',
  entryNo: 'RK20260623-0055',
  farmerName: '散农户',
  grainType: '玉米',
  wareareaName: '',
  rfidCardNo: '',
  grossWeight: 8600,
  tareWeight: 2600,
  netWeight: 6000,
  unitPrice: 1.95,
  moisture: 0,                   // 0 也算缺省, 模板用 || 0 兜底
  impurity: null,                // null
  adjustedAmount: null,          // 用 totalAmount 兜底
  totalAmount: 11700,
  operator: '',
  createBy: '刘助理',
  createTime: '2026-06-23T11:02:00',
  truckNoOfDay: 1,
};

// ---------------- 入库回皮凭证 ----------------
const grossFull = {
  id: '17880123456789000110',
  entryNo: 'RK20260623-0041',
  farmerName: '张老三',
  grainType: '杂交水稻',
  wareareaName: '3号烘干仓',
  rfidCardNo: 'B023',
  grossWeight: 12580,
  unitPrice: 2.72,
  createBy: '王库管',
  createTime: '2026-06-23T09:05:12',
};

const grossSparse = {
  id: '17880999800000000444',
  entryNo: 'RK20260623-0044',
  farmerName: '散农户',
  grainType: '玉米',
  wareareaName: '',
  rfidCardNo: '',
  grossWeight: 8600,
  unitPrice: 1.95,
  createBy: '',
  createTime: '2026-06-23T10:40:00',
};

// ---------------- 时间展示辅助 ----------------
// 与主项目对齐: 出库 weighTimeGross || createTime; 入库 createTime; 回皮 createTime
function displayFullOf(type, e) {
  const raw = type === 'exit'
    ? (e.weighTimeGross || e.createTime || '')
    : (e.createTime || '');
  return String(raw).replace('T', ' ').slice(0, 19);
}

// ---------------- 组装成 samples 列表 ----------------
// 每个 sample: { id, kind:'grain', type, name, tag, tagClass, entry, factory, render(opts) }
function buildGrainSamples() {
  const defs = [
    // 出库
    { type: 'exit', key: 'full',  e: exitFull,  name: '出库结算小票 · 完整数据', tag: '完整', tagClass: 'tag-short' },
    { type: 'exit', key: 'sparse',e: exitSparse,name: '出库结算小票 · 缺省数据', tag: '缺省', tagClass: 'tag-long' },
    // 入库结算
    { type: 'inbound', key: 'full',  e: inboundFull,  name: '入库结算小票 · 完整数据', tag: '完整', tagClass: 'tag-short' },
    { type: 'inbound', key: 'sparse',e: inboundSparse,name: '入库结算小票 · 缺省数据', tag: '缺省', tagClass: 'tag-long' },
    // 回皮凭证
    { type: 'gross', key: 'full',  e: grossFull,  name: '入库回皮凭证 · 完整数据', tag: '完整', tagClass: 'tag-short' },
    { type: 'gross', key: 'sparse',e: grossSparse,name: '入库回皮凭证 · 缺省数据', tag: '缺省', tagClass: 'tag-long' },
  ];
  return defs.map((d) => {
    const no = d.type === 'exit' ? d.e.exitNo : d.e.entryNo;
    return {
      id: `grain-${d.type}-${d.key}`,
      kind: 'grain',
      type: d.type,               // exit | inbound | gross
      name: d.name,
      tag: d.tag,
      tagClass: d.tagClass,
      desc: descFor(d.type, d.key),
      entry: d.e,
      factory: FACTORY,
      // 给 QR 用的原始 payload (render 时由 main.js 转成 dataURL)
      qrPayload: qrPayload(d.type === 'gross' ? 'tare' : d.type, no, d.e.id),
      displayFull: displayFullOf(d.type, d.e),
      displayTruckNo: d.e.truckNoOfDay,
      displayTime: displayFullOf(d.type, d.e),
    };
  });
}

function descFor(type, key) {
  const tail = key === 'full' ? '字段齐全, 验证标准排版。' : '故意空关键字段, 验证缺省容错(-/现场散单/兜底金额)。';
  const head = type === 'exit' ? '出库结算小票。'
    : type === 'inbound' ? '入库结算小票。'
    : '入库回皮凭证(毛重保存后)。';
  return head + tail;
}

export const grainSamples = buildGrainSamples();
