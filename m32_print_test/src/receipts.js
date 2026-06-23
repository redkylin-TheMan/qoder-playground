// =========================================================
// 四张长度不一的测试小票模板
// 每个 sample 返回一段 HTML，同时用于：
//   1) 屏幕预览（套 .preview-receipt 样式）
//   2) 打印输出（套 .receipt 样式，见 print.css）
// =========================================================

// 工具：两位金额
const money = (n) => '¥' + Number(n).toFixed(2);

// ---------------------------------------------------------
// 1) 极简纯文字测试（最短，约 5~6 行）
// ---------------------------------------------------------
export function tplMinimal() {
  return `
    <h2>打印自检</h2>
    <hr class="hr" />
    <p class="center">这是一条极简测试。</p>
    <p class="center">1234567890</p>
    <p class="center">ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>
    <hr class="hr" />
    <p class="center">如果清晰可见，说明打印机正常。</p>
  `;
}

// ---------------------------------------------------------
// 2) 模拟收银小票（中等偏长：商品明细 + 合计 + 二维码）
// ---------------------------------------------------------
export function tplReceipt(data) {
  const items = data.items
    .map(
      (it) => `
      <div class="item">
        <div class="name">${it.name}</div>
        <div class="sub">
          <span>${it.qty} x ${money(it.price)}</span>
          <span>${money(it.qty * it.price)}</span>
        </div>
      </div>`
    )
    .join('');

  return `
    <h1>${data.shop}</h1>
    <p class="center">${data.addr}</p>
    <p class="center">电话：${data.tel}</p>
    <hr class="hr" />
    <p>单号：${data.orderNo}</p>
    <p>时间：${data.time}</p>
    <p>收银：${data.cashier}</p>
    <hr class="hr" />
    <h3>商品明细</h3>
    ${items}
    <hr class="hr" />
    <div class="row"><span class="label">商品总数</span><span class="value">${data.totalQty}</span></div>
    <div class="row"><span class="label">小计</span><span class="value">${money(data.subtotal)}</span></div>
    <div class="row"><span class="label">会员折扣</span><span class="value">-${money(data.discount)}</span></div>
    <div class="row"><span class="label">支付方式</span><span class="value">${data.payType}</span></div>
    <hr class="hr-solid" />
    <div class="row">
      <span class="label" style="font-weight:700;">实付</span>
      <span class="value" style="font-weight:700;font-size:13px;">${money(data.total)}</span>
    </div>
    <hr class="hr" />
    <div class="qr"></div>
    <p class="qr-note">扫码查看电子小票</p>
    <p class="footer">谢谢惠顾，欢迎再次光临！</p>
    <p class="footer">*** ${data.shop} ***</p>
  `;
}

// ---------------------------------------------------------
// 3) 模拟快递/取件码单（中等：大号取件码 + 时间线）
// ---------------------------------------------------------
export function tplPickup(data) {
  const steps = data.timeline
    .map(
      (s) => `
      <div class="step">
        <span>${s.label}</span>
        <span>${s.time}</span>
      </div>`
    )
    .join('');

  return `
    <h1>${data.company}</h1>
    <p class="center">自助取件凭条</p>
    <hr class="hr-solid" />
    <p>取件码</p>
    <div class="big-code">${data.code}</div>
    <hr class="hr" />
    <div class="row"><span class="label">运单号</span><span class="value">${data.waybill}</span></div>
    <div class="row"><span class="label">收件人</span><span class="value">${data.recipient}</span></div>
    <div class="row"><span class="label">手机号</span><span class="value">${data.phone}</span></div>
    <div class="row"><span class="label">格口</span><span class="value">${data.box}</span></div>
    <div class="row"><span class="label">存放时间</span><span class="value">${data.storedAt}</span></div>
    <hr class="hr" />
    <h3>物流轨迹</h3>
    <div class="timeline">
      ${steps}
    </div>
    <hr class="hr" />
    <div class="barcode"></div>
    <div class="barcode-text">${data.code}</div>
    <hr class="hr" />
    <p class="footer">凭此码至 ${data.company} 取件</p>
    <p class="footer">超 ${data.freeHours} 小时将收取保管费</p>
    <p class="footer">客服电话：${data.serviceTel}</p>
  `;
}

// ---------------------------------------------------------
// 4) 模拟长文本/分页测试（最长：用于验证连续走纸）
// ---------------------------------------------------------
export function tplLong(data) {
  const paragraphs = data.body
    .map(
      (p, i) => `
      <p>${i + 1}. ${p}</p>`
    )
    .join('');

  return `
    <h1>${data.title}</h1>
    <p class="center">${data.subtitle}</p>
    <hr class="hr" />
    <p>编号：${data.docNo}</p>
    <p>日期：${data.date}</p>
    <p>签发：${data.issuer}</p>
    <hr class="hr" />
    <h3>${data.sectionTitle}</h3>
    ${paragraphs}
    <hr class="hr" />
    <h3>说明</h3>
    <p>${data.note}</p>
    <p>${data.note}</p>
    <hr class="hr" />
    <div class="row"><span class="label">本条文字总数(约)</span><span class="value">${data.charCount}</span></div>
    <div class="row"><span class="label">预计走纸长度</span><span class="value">${data.lengthLabel}</span></div>
    <hr class="hr-solid" />
    <p class="footer">— 本测试项用于验证长内容连续走纸 —</p>
    <p class="footer">如内容被截断，请检查打印机纸张长度/驱动设置</p>
    <p class="footer">${data.foot}</p>
  `;
}

// 样例数据（写死，便于复现测试结果）
export const samples = [
  {
    id: 'minimal',
    name: '极简纯文字自检',
    desc: '约 5~6 行，验证最小高度与基本清晰度。',
    tag: '短',
    tagClass: 'tag-short',
    render: () => tplMinimal(),
  },
  {
    id: 'receipt',
    name: '模拟收银小票',
    desc: '商品明细 + 合计 + 二维码，长度中等偏长。',
    tag: '中',
    tagClass: 'tag-mid',
    render: () =>
      tplReceipt({
        shop: '杯中影咖啡',
        addr: '合肥市蜀山区长江西路 888 号',
        tel: '0551-88886666',
        orderNo: 'NO20260616-00001',
        time: '2026-06-16 14:32:08',
        cashier: '店员 小李',
        items: [
          { name: '美式咖啡(中)', qty: 1, price: 18.0 },
          { name: '拿铁(大)', qty: 2, price: 25.0 },
          { name: '焦糖玛奇朵', qty: 1, price: 28.0 },
          { name: '蓝莓松饼', qty: 1, price: 15.0 },
          { name: '巧克力曲奇', qty: 3, price: 6.0 },
        ],
        totalQty: 8,
        subtotal: 129.0,
        discount: 12.9,
        payType: '微信支付',
        total: 116.1,
      }),
  },
  {
    id: 'pickup',
    name: '模拟快递取件码单',
    desc: '大号取件码 + 物流轨迹时间线 + 条码。',
    tag: '中',
    tagClass: 'tag-mid',
    render: () =>
      tplPickup({
        company: '丰巢智能柜',
        code: '8A21',
        waybill: 'SF1234567890',
        recipient: '张先生',
        phone: '138****6688',
        box: 'A-12',
        storedAt: '06-16 09:10',
        timeline: [
          { label: '已入柜', time: '06-16 09:10' },
          { label: '到达驿站', time: '06-16 08:30' },
          { label: '派送中', time: '06-16 07:15' },
          { label: '已发车', time: '06-16 05:40' },
          { label: '已揽收', time: '06-15 22:08' },
        ],
        freeHours: 12,
        serviceTel: '95333',
      }),
  },
  {
    id: 'long',
    name: '模拟长文本/分页测试',
    desc: '多段正文 + 重复说明，验证连续走纸不截断。',
    tag: '长',
    tagClass: 'tag-long',
    render: () =>
      tplLong({
        title: '系统公告与使用须知',
        subtitle: '面向全体用户的测试性长文本',
        docNo: 'DOC-2026-0616-007',
        date: '2026年06月16日',
        issuer: 'm32_print_test 测试组',
        sectionTitle: '一、内容概述',
        body: [
          '本小票用于验证 57mm 热敏纸在长内容下的连续走纸表现，请检查是否存在中途截断、错位或空白区域。',
          '若打印过程中出现卡纸或缺纸提示，请检查纸卷是否安装到位，并确认打印驱动中纸张规格设置为 57mm 宽、长度自动。',
          '浏览器无法直接指定打印机型号，请在弹出的系统打印对话框中手动选择对应的热敏小票打印机。',
          '建议先在「打印预览」中确认实际走纸页数与方向，再执行最终打印，以避免浪费纸卷。',
          '如同一台机器连接了多台打印机，请在对话框顶部下拉框中仔细核对当前选中的设备名称。',
          '部分浏览器需要勾选「背景图形」选项才能完整打印条码与二维码占位块，可根据实际机型决定是否需要。',
          '打印字体建议使用等宽字体以保证金额、编号等内容的对齐效果，本测试默认使用 Consolas / 等宽字体回退。',
          '若发现左右贴边或被裁切，可适当增大打印样式中的左右内边距(padding)，本工具默认为 2mm。',
        ],
        note:
          '以上内容为测试性填充文本，无实际业务含义，仅用于检验打印机在不同长度下的表现。',
        charCount: '约 420 字',
        lengthLabel: '约 220~260mm',
        foot: '— END OF LONG TEXT TEST —',
      }),
  },
];
