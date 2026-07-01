// =========================================================
// 粮食出入库小票模板 — 58mm 纵向卷纸新版式
//  与主项目新版式 (2026-06-23) 完全对齐:
//   - PrintDialog.vue (出库)
//   - EntryV1.vue    (入库结算 + 入库回皮凭证)
//  CSS 类名: rcpt-* (与主项目一致), 样式见 grain-print.css / grain-preview.css
// =========================================================
import { formatN, amountInWords, tail8 } from './formatUtil.js';

// 转义, 防 mock 数据里有尖括号
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * 出库结算小票
 * 字段对齐主项目 Exit.vue 的 entry:
 *   exitNo / customerNameSnap / grainNameSnap / wareareaNameSnap / rfidCardNo
 *   grossWeight / tareWeight / netWeight / unitPrice / driverPlateSnap
 *   adjustedAmount / originalAmount / createBy
 * @param {object} e      entry 数据
 * @param {object} opt    { factoryName, displayFull (时间), qrUrl }
 */
export function tplExitReceipt(e, opt = {}) {
  const factory = opt.factoryName || '安徽舒州生态农业科技股份有限公司';
  const time = opt.displayFull || '';
  const qr = opt.qrUrl || '';
  const amount = e.adjustedAmount != null ? e.adjustedAmount : e.originalAmount;
  return `
    <div class="rcpt">
      <div class="rcpt-head">
        <div class="rcpt-factory">${esc(factory)}</div>
        <div class="rcpt-sub">粮食出库结算小票</div>
        <div class="rcpt-copy">客户联</div>
      </div>
      <div class="rcpt-sep"></div>
      <div class="rcpt-no">单号 ${esc(e.exitNo)}</div>
      ${time ? `<div class="rcpt-time">${esc(time)}</div>` : ''}
      <div class="rcpt-sep"></div>
      <div class="rcpt-grid">
        <div class="rcpt-field"><span>客户</span><b>${esc(e.customerNameSnap || '现场散单')}</b></div>
        <div class="rcpt-field"><span>品种</span><b>${esc(e.grainNameSnap || '-')}</b></div>
        <div class="rcpt-field"><span>仓位</span><b>${esc(e.wareareaNameSnap || '-')}</b></div>
        <div class="rcpt-field"><span>卡号</span><b>${e.rfidCardNo ? '#' + esc(e.rfidCardNo) : '-'}</b></div>
      </div>
      <div class="rcpt-weight">
        <div><span>毛重</span><b>${formatN(e.grossWeight)}</b><em>KG</em></div>
        <div><span>皮重</span><b>${formatN(e.tareWeight)}</b><em>KG</em></div>
        <div><span>净重</span><b>${formatN(e.netWeight)}</b><em>KG</em></div>
      </div>
      <div class="rcpt-extras">
        <span>单价 ¥${formatN(e.unitPrice)}/KG</span>
        <span>车牌 ${esc(e.driverPlateSnap || '-')}</span>
      </div>
      <div class="rcpt-amount">
        <span class="lbl">应收</span>
        <strong>¥${formatN(amount)}</strong>
      </div>
      <div class="rcpt-amount-cn">（大写）${amountInWords(amount)}</div>
      <div class="rcpt-qr">
        ${qr ? `<img src="${qr}" alt="QR" />` : `<div class="qr-empty">QR</div>`}
        <div class="rcpt-qr-label">扫码核对单据</div>
      </div>
      <div class="rcpt-foot">
        <span>库管员: ${esc(e.createBy || '')}</span>
        <span>此联客户留存</span>
      </div>
    </div>
  `;
}

/**
 * 入库结算小票
 * 字段对齐主项目 EntryV1.vue 的 printDialog.entry:
 *   entryNo / farmerName / grainType / wareareaName / rfidCardNo
 *   grossWeight / tareWeight / netWeight / unitPrice / moisture / impurity
 *   adjustedAmount / totalAmount / operator
 * @param {object} e      entry 数据
 * @param {object} opt    { factoryName, displayFull, displayTruckNo, qrUrl }
 */
export function tplInboundReceipt(e, opt = {}) {
  const factory = opt.factoryName || '安徽舒州生态农业科技股份有限公司';
  const time = opt.displayFull || '';
  const truckNo = opt.displayTruckNo != null ? opt.displayTruckNo : '';
  const qr = opt.qrUrl || '';
  const amount = e.adjustedAmount != null ? e.adjustedAmount : e.totalAmount;
  const timeLine = [time, truckNo ? `第${truckNo}车` : ''].filter(Boolean).join(' · ');
  return `
    <div class="rcpt">
      <div class="rcpt-head">
        <div class="rcpt-factory">${esc(factory)}</div>
        <div class="rcpt-sub">粮食入库结算小票</div>
        <div class="rcpt-copy">客户联</div>
      </div>
      <div class="rcpt-sep"></div>
      <div class="rcpt-no">单号 ${esc(e.entryNo)}</div>
      ${timeLine ? `<div class="rcpt-time">${esc(timeLine)}</div>` : ''}
      <div class="rcpt-sep"></div>
      <div class="rcpt-grid">
        <div class="rcpt-field"><span>农户</span><b>${esc(e.farmerName)}</b></div>
        <div class="rcpt-field"><span>品种</span><b>${esc(e.grainType)}</b></div>
        <div class="rcpt-field"><span>仓位</span><b>${esc(e.wareareaName || '-')}</b></div>
        <div class="rcpt-field"><span>卡号</span><b>${e.rfidCardNo ? '#' + esc(e.rfidCardNo) : '-'}</b></div>
      </div>
      <div class="rcpt-weight">
        <div><span>毛重</span><b>${formatN(e.grossWeight)}</b><em>KG</em></div>
        <div><span>皮重</span><b>${formatN(e.tareWeight)}</b><em>KG</em></div>
        <div><span>净重</span><b>${formatN(e.netWeight)}</b><em>KG</em></div>
      </div>
      <div class="rcpt-extras">
        <span>单价 ¥${formatN(e.unitPrice)}/KG</span>
        <span>水分 ${formatN(e.moisture || 0)}% · 杂质 ${formatN(e.impurity || 0)}%</span>
      </div>
      <div class="rcpt-amount">
        <span class="lbl">结算金额</span>
        <strong>¥${formatN(amount)}</strong>
      </div>
      <div class="rcpt-amount-cn">（大写）${amountInWords(amount)}</div>
      <div class="rcpt-qr">
        ${qr ? `<img src="${qr}" alt="QR" />` : `<div class="qr-empty">QR</div>`}
        <div class="rcpt-qr-label">扫码核对单据</div>
      </div>
      <div class="rcpt-foot">
        <span>库管员: ${esc(e.operator || '')}</span>
        <span>此联客户留存</span>
      </div>
    </div>
  `;
}

/**
 * 入库回皮凭证 (gross-ticket)
 * 字段对齐主项目 EntryV1.vue 回皮凭证模板 (type === 'gross-ticket'):
 *   entryNo / farmerName / grainType / wareareaName / rfidCardNo
 *   grossWeight / unitPrice / createBy
 * @param {object} e      entry 数据
 * @param {object} opt    { factoryName, displayTime, qrUrl }
 */
export function tplGrossTicket(e, opt = {}) {
  const factory = opt.factoryName || '安徽舒州生态农业科技股份有限公司';
  const time = opt.displayTime || '';
  const qr = opt.qrUrl || '';
  return `
    <div class="rcpt">
      <div class="rcpt-head">
        <div class="rcpt-factory">${esc(factory)}</div>
        <div class="rcpt-sub">粮食入库回皮凭证</div>
        <div class="rcpt-copy">回皮用</div>
      </div>
      <div class="rcpt-sep"></div>
      <div class="rcpt-no">单号 ${esc(e.entryNo)}</div>
      ${time ? `<div class="rcpt-time">${esc(time)}</div>` : ''}
      <div class="rcpt-sep"></div>
      <div class="rcpt-grid">
        <div class="rcpt-field"><span>农户</span><b>${esc(e.farmerName)}</b></div>
        <div class="rcpt-field"><span>品种</span><b>${esc(e.grainType)}</b></div>
        <div class="rcpt-field"><span>仓位</span><b>${esc(e.wareareaName || '-')}</b></div>
        <div class="rcpt-field"><span>NFC</span><b>${e.rfidCardNo ? '#' + esc(e.rfidCardNo) : '-'}</b></div>
      </div>
      <div class="rcpt-gross">
        <span>毛重</span>
        <b>${formatN(e.grossWeight)}</b>
        <em>KG</em>
      </div>
      <div class="rcpt-extras">
        <span>单价 ¥${formatN(e.unitPrice)}/KG</span>
      </div>
      <div class="rcpt-note">卸货后回上磅, 刷 NFC 或扫码调出回皮单</div>
      <div class="rcpt-qr">
        ${qr ? `<img src="${qr}" alt="QR" />` : `<div class="qr-empty">QR</div>`}
        <div class="rcpt-qr-label">扫码回皮</div>
      </div>
      <div class="rcpt-foot">
        <span>库管员: ${esc(e.createBy || '')}</span>
        <span>${esc(tail8(e.id || e.entryNo))}</span>
      </div>
    </div>
  `;
}

/** 三类小票的渲染分派 */
export const GRAIN_RENDERERS = {
  exit: tplExitReceipt,
  inbound: tplInboundReceipt,
  gross: tplGrossTicket,
};
