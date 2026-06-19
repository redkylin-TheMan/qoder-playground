'use strict';
/*
 * lib/documents.js — 四种单据工厂
 * ---------------------------------------------------------------------------
 * 每个导出函数签名: function(fields, font, model) -> EscpBuilder
 *   fields: 可选，缺省字段用 DEFAULT_* 填充（网页表单可覆盖）
 *   font:   可选，字体配置（见 escp.js 的 init(font)）
 *   model:  可选，型号配置（字符串key 或 {key,lineWidth,feedLines}）
 *
 * 单据类型：
 *   grainIn(fields,font,model)   粮食入库单
 *   grainOut(fields,font,model)  粮食出库单
 *   invoice(fields,font,model)   增值税发票样张
 *   receipt(fields,font,model)   小票 / 收银票
 *   triplicate(fields,font,model) 通用三联单（商户/客户/财务存根）
 *
 * 行宽约定：从型号参数取（默认 48 半角列），106列型号用 64。
 */

var EscpBuilder = require('./escp').EscpBuilder;
var models = require('./models');

// 解析型号 → { lineWidth, feedLines }
function resolveModel(model) {
  var m = models.getModel(typeof model === 'string' ? model : (model && model.key));
  return {
    lineWidth: (model && model.lineWidth) || m.lineWidth || 48,
    feedLines: (model && model.feedLines) || m.feedLines || 5
  };
}

// 字段合并工具
function merge(def, src) {
  var out = {};
  Object.keys(def).forEach(function (k) { out[k] = def[k]; });
  if (src) Object.keys(src).forEach(function (k) { out[k] = src[k]; });
  return out;
}

// 表头：单位 + 单据标题 + 单号/日期/页码。w=行宽
function header(b, w, companyName, docTitle, no, date, page) {
  b.align('center').text(companyName || '某某粮油有限公司').align('left');
  b.title(docTitle);
  b.kv('单　号', no, w);
  b.kv('日　期', date, w);
  if (page) b.kv('页　码', page, w);
  b.separator('=');
  return b;
}

// 表尾：制单人 / 司机 / 收款 / 签字栏。w=行宽
function footer(b, w, f) {
  b.separator('=');
  b.kv('制单人', f.maker, w);
  if (f.driverName) b.kv('驾驶员', f.driverName, w);
  if (f.driverPhone) b.kv('联系电话', f.driverPhone, w);
  if (f.plateNo) b.kv('车牌号', f.plateNo, w);
  b.separator('-');
  b.text('【收款信息】');
  if (f.payee) b.kv('收款账户', f.payee, w);
  if (f.payeeBank) b.kv('开户银行', f.payeeBank, w);
  if (f.payAmount != null) b.kv('收款金额', '￥ ' + f.payAmount, w);
  if (f.payMethod) b.kv('收款方式', f.payMethod, w);
  b.separator('-');
  b.kv('经办人签字', '____________', w / 2);
  b.kv('复核人签字', '____________', w / 2);
  b.feed(1);
  return b;
}

// ======================== 粮食入库单 ========================
var DEFAULT_GRAIN_IN = {
  companyName: '某某粮油有限公司',
  no: 'RK20260617-0001',
  date: '2026-06-17',
  goods: '小麦(一等)',
  outWeight: '1500.5',
  inWeight: '1498.0',
  deduction: '2.5',
  unitPrice: '2.80',
  amount: '4194.40',
  maker: '张三',
  driverName: '李四',
  driverPhone: '138-0000-0001',
  plateNo: '豫A·12345',
  payee: '某某粮油有限公司',
  payeeBank: '中国农业银行 某某支行',
  payAmount: '4194.40',
  payMethod: '银行转账'
};

function grainIn(fields, font, model) {
  var f = merge(DEFAULT_GRAIN_IN, fields);
  var rm = resolveModel(model);
  var W = rm.lineWidth;
  var b = new EscpBuilder({ lineWidth: W }).init(font || {});
  header(b, W, f.companyName, '粮 食 入 库 单', f.no, f.date);

  b.text('【货物信息】');
  b.tableRow([
    { text: '货品名称', align: 'center', width: 18 },
    { text: '出库重量(kg)', align: 'center', width: 14 },
    { text: '入库重量(kg)', align: 'center', width: 14 }
  ]);
  b.tableRow([
    { text: f.goods, width: 18 },
    { text: f.outWeight, align: 'right', width: 14 },
    { text: f.inWeight, align: 'right', width: 14 }
  ]);
  b.separator('-');
  b.kv('扣减重量(kg)', f.deduction, W);
  b.kv('单价(元/kg)', f.unitPrice, W);
  b.kv('结算金额(元)', '￥ ' + f.amount, W);
  footer(b, W, f);
  b.feedToTear(rm.feedLines);
  return b;
}

// ======================== 粮食出库单 ========================
var DEFAULT_GRAIN_OUT = {
  companyName: '某某粮油有限公司',
  no: 'CK20260617-0001',
  date: '2026-06-17',
  goods: '玉米(二等)',
  inWeight: '2000.0',
  outWeight: '2000.0',
  deduction: '0.0',
  unitPrice: '2.65',
  amount: '5300.00',
  maker: '王五',
  driverName: '赵六',
  driverPhone: '139-0000-0002',
  plateNo: '鲁B·66888',
  payee: '某某粮油有限公司',
  payeeBank: '中国农业银行 某某支行',
  payAmount: '5300.00',
  payMethod: '银行转账'
};

function grainOut(fields, font, model) {
  var f = merge(DEFAULT_GRAIN_OUT, fields);
  var rm = resolveModel(model);
  var W = rm.lineWidth;
  var b = new EscpBuilder({ lineWidth: W }).init(font || {});
  header(b, W, f.companyName, '粮 食 出 库 单', f.no, f.date);

  b.text('【货物信息】');
  b.tableRow([
    { text: '货品名称', align: 'center', width: 18 },
    { text: '库存重量(kg)', align: 'center', width: 14 },
    { text: '出库重量(kg)', align: 'center', width: 14 }
  ]);
  b.tableRow([
    { text: f.goods, width: 18 },
    { text: f.inWeight, align: 'right', width: 14 },
    { text: f.outWeight, align: 'right', width: 14 }
  ]);
  b.separator('-');
  b.kv('扣减重量(kg)', f.deduction, W);
  b.kv('单价(元/kg)', f.unitPrice, W);
  b.kv('结算金额(元)', '￥ ' + f.amount, W);
  footer(b, W, f);
  b.feedToTear(rm.feedLines);
  return b;
}

// ======================== 增值税发票样张 ========================
var DEFAULT_INVOICE = {
  no: '01100210011112345678',
  date: '2026-06-17',
  seller: '某某粮油有限公司  纳税人识别号: 91110100000000000A',
  sellerAddr: '地址: 河南省郑州市某某路1号  电话: 0371-0000000',
  sellerBank: '开户行: 农行某某支行  账号: 6228 0000 0000 0000 000',
  buyer: '某某食品有限公司  纳税人识别号: 91110100000000000B',
  items: [
    { name: '小麦(一等)', spec: '一等', unit: 'kg', qty: '5000', price: '2.80', rate: '9%', amount: '14000.00', tax: '1260.00' },
    { name: '玉米(二等)', spec: '二等', unit: 'kg', qty: '3000', price: '2.65', rate: '9%', amount: '7950.00', tax: '715.50' }
  ],
  totalAmount: '21950.00',
  totalTax: '1975.50',
  total: '23925.50',
  totalCN: '贰万叁仟玖佰贰拾伍元伍角整',
  remark: '本发票为样张测试，不作为报销凭证',
  maker: '张三'
};

function invoice(fields, font, model) {
  var f = merge(DEFAULT_INVOICE, fields);
  var rm = resolveModel(model);
  var W = rm.lineWidth;
  var b = new EscpBuilder({ lineWidth: W }).init(font || {});
  b.align('center').bold(true).text('★ 增值税专用发票 ★').bold(false).align('left');
  b.kv('发票号码', f.no, W);
  b.kv('开票日期', f.date, W);
  b.separator('=');
  b.text('购货方：' + f.buyer);
  b.separator('-');
  b.tableRow([
    { text: '货物名称', align: 'center', width: 12 },
    { text: '数量', align: 'right', width: 6 },
    { text: '单价', align: 'right', width: 7 },
    { text: '金额', align: 'right', width: 9 },
    { text: '税率', align: 'center', width: 5 },
    { text: '税额', align: 'right', width: 8 }
  ]);
  b.separator('-');
  var items = f.items || [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    b.tableRow([
      { text: it.name, width: 12 },
      { text: it.qty, align: 'right', width: 6 },
      { text: it.price, align: 'right', width: 7 },
      { text: it.amount, align: 'right', width: 9 },
      { text: it.rate, align: 'center', width: 5 },
      { text: it.tax, align: 'right', width: 8 }
    ]);
  }
  b.separator('-');
  b.kv('价税合计(大写)', f.totalCN, W);
  b.kv('价税合计(小写)', '￥ ' + f.total, W);
  b.kv('合计金额', '￥ ' + f.totalAmount, W);
  b.kv('合计税额', '￥ ' + f.totalTax, W);
  b.separator('-');
  b.text('销货方：' + f.seller);
  if (f.sellerAddr) b.text(f.sellerAddr);
  if (f.sellerBank) b.text(f.sellerBank);
  b.separator('-');
  b.kv('备注', f.remark, W);
  b.kv('开票人', f.maker, W);
  b.feedToTear(rm.feedLines);
  return b;
}

// ======================== 小票 / 收银票 ========================
var DEFAULT_RECEIPT = {
  store: '某某粮油便利店',
  addr: '河南省郑州市某某路88号',
  phone: '0371-88888888',
  cashier: '001',
  no: '20260617001',
  date: '2026-06-17 14:30:00',
  items: [
    { name: '东北大米5kg', qty: '2', price: '45.00' },
    { name: '金龙鱼食用油5L', qty: '1', price: '68.00' },
    { name: '特一粉10kg', qty: '1', price: '52.00' },
    { name: '玉米糁2.5kg', qty: '3', price: '12.00' }
  ],
  payMethod: '微信支付',
  payAmount: '249.00',
  change: '0.00',
  member: '138****0001',
  points: '1200'
};

function receipt(fields, font, model) {
  var f = merge(DEFAULT_RECEIPT, fields);
  var rm = resolveModel(model);
  var b = new EscpBuilder({ lineWidth: 32 }).init(font || {});  // 小票固定窄版 32 列
  b.align('center');
  b.bold(true).doubleHeight(true).text(f.store).normalSize().bold(false);
  b.text(f.addr);
  b.text('电话: ' + f.phone);
  b.separator('-');
  b.align('left');
  b.kv('单号', f.no, 32);
  b.kv('时间', f.date, 32);
  b.kv('收银员', f.cashier, 32);
  b.separator('-');
  b.tableRow([
    { text: '商品', width: 16 },
    { text: '数量', align: 'right', width: 4 },
    { text: '金额', align: 'right', width: 9 }
  ]);
  var total = 0;
  var items = f.items || [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    b.tableRow([
      { text: it.name, width: 16 },
      { text: it.qty, align: 'right', width: 4 },
      { text: it.price, align: 'right', width: 9 }
    ]);
    total += parseFloat(it.price) * parseFloat(it.qty);
  }
  b.separator('-');
  b.kv('商品总数', String(items.length), 32);
  b.kv('合计', '￥' + (total).toFixed(2), 32);
  b.separator('-');
  b.kv('付款方式', f.payMethod, 32);
  b.kv('实付', '￥' + f.payAmount, 32);
  b.kv('找零', '￥' + f.change, 32);
  if (f.member) {
    b.separator('-');
    b.kv('会员', f.member, 32);
    b.kv('积分余额', f.points, 32);
  }
  b.separator('=');
  b.align('center');
  b.text('谢谢惠顾，欢迎再次光临！');
  b.text('★ 留存小票作为退换货凭证 ★');
  b.feed(2);
  b.text('▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆');
  b.text('    [ 二维码位置 ]    ');
  b.text('▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆');
  b.feedToTear(rm.feedLines);
  return b;
}

// ======================== 通用三联单 ========================
var DEFAULT_TRIPLICATE = {
  companyName: '某某粮油有限公司',
  title: '过磅结算单',
  no: 'GB20260617-0001',
  date: '2026-06-17',
  fields: [
    { k: '货品名称', v: '小麦(一等)' },
    { k: '毛重(kg)', v: '1510.0' },
    { k: '皮重(kg)', v: '9.5' },
    { k: '净重(kg)', v: '1500.5' },
    { k: '单价(元/kg)', v: '2.80' },
    { k: '金额(元)', v: '4201.40' },
    { k: '制单人', v: '张三' },
    { k: '司机', v: '李四 138-0000-0001' },
    { k: '车牌', v: '豫A·12345' }
  ],
  remark: '本单一式三联：商户存根(红)/客户存根(蓝)/财务存根(黑)'
};

// 三联：在一卷纸上连续打印三份，每份顶部标注存根类型
function triplicate(fields, font, model) {
  var f = merge(DEFAULT_TRIPLICATE, fields);
  var rm = resolveModel(model);
  var W = rm.lineWidth;
  var b = new EscpBuilder({ lineWidth: W }).init(font || {});
  var copies = ['（第一联）商 户 存 根', '（第二联）客 户 存 根', '（第三联）财 务 存 根'];
  for (var c = 0; c < copies.length; c++) {
    b.align('center').bold(true).text(copies[c]).bold(false).align('left');
    b.title(f.title);
    b.kv('单号', f.no, W);
    b.kv('日期', f.date, W);
    b.kv('单位', f.companyName, W);
    b.separator('-');
    var ff = f.fields || [];
    for (var i = 0; i < ff.length; i++) {
      b.kv(ff[i].k, ff[i].v, W);
    }
    b.separator('-');
    b.kv('经办人签字', '____________', W / 2);
    b.kv('复核签字', '____________', W / 2);
    if (f.remark) {
      b.separator();
      b.text(f.remark);
    }
    b.feed(2);
    b.separator('·');
    b.feed(2);
  }
  b.feedToTear(rm.feedLines);
  return b;
}

module.exports = {
  grainIn: grainIn,
  grainOut: grainOut,
  invoice: invoice,
  receipt: receipt,
  triplicate: triplicate,
  resolveModel: resolveModel,
  defaults: {
    grainIn: DEFAULT_GRAIN_IN,
    grainOut: DEFAULT_GRAIN_OUT,
    invoice: DEFAULT_INVOICE,
    receipt: DEFAULT_RECEIPT,
    triplicate: DEFAULT_TRIPLICATE
  }
};
