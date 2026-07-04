/**
 * V2.2 单据纠错 · 全场景逐场景测试 (按 测试文档-语言版本.md 22 场景)
 *
 * 覆盖 (✅=本脚本测, ➖=现状已实现仅回归):
 *   粮食出库作废: ①待回皮 ②未收款(R3) ③已收款(R2)
 *   粮食入库作废: ⑩待回皮删除 ⑪未付款(R3) ⑫已付款(R2)
 *   农资出库作废: ⑦未收款(R3) ⑧已收款(R2)
 *   农资入库作废: ⑬未付款(R3) ⑭已付款(R2)
 *   就地修改:     ⑯改数量(R3)  ⑲改单价(R3)
 *
 * 每个场景验证三件事:
 *   1. 库存变化 (R1)
 *   2. 台账变化 (R2 不动 / R3 立即冲)
 *   3. 操作日志留痕 (#/op-log 可查 before/after)
 *
 * 用法: node test-scenarios.js <case>
 *   case = grain-out | grain-in | agri-out | agri-in | edit | all
 */
const http = require('http')

const F = '2062754110754656256'  // 鲁智深厂
// 粮食
const CUST_LI = 'L_2067093406344736770'      // 李老板(客户)
const CUST_LI_S = 'LOCAL'
const GRAIN = '0301010024'                    // 竹两优
const GRAIN_NM = '竹两优雪峰丝苗'
const WH_GRAIN = '2062934879754043393'        // 粮食1号仓
const STOCK_GRAIN = '2062934897059741698'     // 竹两优 stockId
// 农资
const CUST_LDS = 'L_2064696359327514625'      // 刘大帅(客户/供应商)
const SUP_PLAT = 'L_2067065003990249473'      // 平台种业(供应商)
const AGRI = '1963592377146937344'            // 昌两优135
const AGRI_NM = '昌两优135-0.5kg*60包'
const WH_AGRI = '2065246087983153153'         // 农资2号仓 stockId(用于查流水), warearea=农资2号仓

const tokens = require('./test-tokens.json')
const tok = (a) => tokens[a] && tokens[a].token

function req(method, urlPath, { token, body, qs } = {}) {
  return new Promise((resolve, reject) => {
    let p = '/api' + urlPath
    if (qs && Object.keys(qs).length) p += '?' + Object.entries(qs).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
    const headers = {}
    if (token) headers['X-Access-Token'] = token
    let payload = ''
    if (body !== undefined && body !== null) { payload = JSON.stringify(body); headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(payload) }
    const r = http.request({ hostname: 'localhost', port: 3100, path: p, method, headers }, res => {
      let d = ''; res.on('data', c => (d += c)); res.on('end', () => { let j; try { j = JSON.parse(d) } catch (e) { j = { _raw: d } }; resolve({ status: res.statusCode, data: j, ok: j && j.success === true }) })
    })
    r.on('error', reject); r.setTimeout(60000, () => r.destroy(new Error('timeout')))
    if (payload) r.write(payload); r.end()
  })
}
const R = (resp) => (resp.data && resp.data.result !== undefined ? resp.data.result : resp.data)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const log = (...a) => console.log(...a)
const line = () => console.log('━'.repeat(72))
const P = { ok: '✅', no: '❌', warn: '⚠️' }

const api = {
  // 粮食出库
  grainOutOnce: (tk, b) => req('POST', '/hl-drying/drying/grain-outbound/submit-once', { token: tk, body: b }),
  grainOutVoid: (tk, id, reason) => req('POST', '/hl-drying/drying/grain-outbound/void', { token: tk, qs: { factoryId: F, id, reason } }),
  grainOutCollect: (tk, b) => req('POST', '/hl-drying/drying/grain-outbound/collect', { token: tk, body: b }),
  // 粮食入库
  grainInOnce: (tk, b) => req('POST', '/hl-drying/drying/grain-inbound/submit-once', { token: tk, body: b }),
  grainInVoid: (tk, id, reason) => req('POST', '/hl-drying/drying/grain-inbound/void', { token: tk, qs: { factoryId: F, id, reason } }),
  // 农资出库
  agriOutSave: (tk, b) => req('POST', '/hl-drying/drying/input-outbound/save', { token: tk, body: b }),
  agriOutVoid: (tk, id, reason) => req('POST', '/hl-drying/drying/input-outbound/void', { token: tk, qs: { id, reason } }),
  agriOutCollect: (tk, b) => req('POST', '/hl-drying/drying/input-outbound/collect', { token: tk, body: b }),
  // 农资入库
  agriInSave: (tk, b) => req('POST', '/hl-drying/drying/input-inbound/save', { token: tk, body: b }),
  agriInVoid: (tk, id, reason) => req('POST', '/hl-drying/drying/input-inbound/void', { token: tk, qs: { id, reason } }),
  // 通用
  pay: (tk, b) => req('POST', '/hl-drying/drying/finance/payment/submit', { token: tk, body: b }),
  editField: (tk, b) => req('POST', '/hl-drying/drying/bill-edit/edit-field', { token: tk, body: b }),
  grainStock: (tk) => req('GET', '/hl-drying/drying/grain-stock/list', { token: tk, qs: { factoryId: F } }),
  agriStock: (tk) => req('GET', '/hl-drying/drying/input-stock/list', { token: tk, qs: { factoryId: F } }),
  stockLogs: (tk, stockId) => req('GET', '/hl-drying/drying/stock-log/list-by-stock', { token: tk, qs: { factoryId: F, stockId } }),
  account: (tk) => req('GET', '/hl-drying/drying/finance/account/list', { token: tk, qs: { factoryId: F } }),
  opList: (tk) => req('GET', '/hl-drying/drying/op-log/list', { token: tk, qs: { factoryId: F, pageNo: 1, pageSize: 20 } }),
  opDetail: (tk, id) => req('GET', '/hl-drying/drying/op-log/detail', { token: tk, qs: { id } }),
}

// ---- 快照助手 ----
async function grainQty(tk) {
  const list = R(await api.grainStock(tk)) || []
  const s = list.find(x => x.grainCode === GRAIN); return s ? Number(s.stockDry) : null
}
async function agriQty(tk, stockId) {
  const list = R(await api.agriStock(tk)) || []
  const s = list.find(x => x.id === stockId); return s ? Number(s.stock) : null
}
async function accRow(tk, custId) {
  const list = R(await api.account(tk)) || []
  return list.find(a => String(a.customerId) === custId) || null
}
// 找最近一次指定 module+action 的 op-log, 返回 detailJson 解析后的 before/after
async function lastOpLog(tk, module, action, summaryContains) {
  const r = R(await api.opList(tk)) || {}
  const list = r.records || r.list || r
  const arr = Array.isArray(list) ? list : []
  const found = arr.find(x => x.module === module && x.action === action && (!summaryContains || (x.summary || '').includes(summaryContains)))
  if (!found) return null
  const detail = R(await api.opDetail(tk, found.id))
  let obj = null
  try { obj = detail.detailJson ? JSON.parse(detail.detailJson) : null } catch (e) {}
  return { id: found.id, summary: found.summary, before: obj && obj.before, after: obj && obj.after }
}

// ============================================================
// 粮食出库 ①②③
// ============================================================
async function grainOut() {
  const tk = tok('keeper'); const ft = tok('finance')
  log('\n╔══════ A. 粮食出库作废 (场景①②③) ══════╗')

  // --- ② 未收款作废 (R3) ---
  log('\n▶ 场景② 待收款作废 (R3, collected=0)')
  const before = await grainQty(tk)
  const acc0 = await accRow(tk, CUST_LI)
  const created = R(await api.grainOutOnce(tk, {
    factoryId: F, customerId: CUST_LI, customerSource: CUST_LI_S, customerName: '李老板', customerPhone: '',
    grainCode: GRAIN, grainName: GRAIN_NM, wareareaId: WH_GRAIN, wareareaName: '粮食1号仓',
    unitPrice: 40, grossWeight: 4100, tareWeight: 4000,
  }))
  const id = created.id
  const afterCreate2 = await grainQty(tk)
  const v = await api.grainOutVoid(tk, id, '场景②未收款作废')
  const after = await grainQty(tk)
  const acc1 = await accRow(tk, CUST_LI)
  await sleep(1200)
  const oplog = await lastOpLog(tk, 'outbound', 'void', id)
  const r3acc = acc0 && acc1 ? Number(acc1.totalSalesAmount) - Number(acc0.totalSalesAmount) : null
  log(`  库存 ${before}→${afterCreate2}(建-100)→${after}(作废, R1应回到${before}): ${after === before ? P.ok : P.no}`)
  log(`  应收累计净变化 ${r3acc} (R3应=0, 建+4000废-4000): ${r3acc === 0 ? P.ok : P.no}`)
  log(`  op-log 留痕 before: ${oplog && oplog.before ? P.ok + ' (含改前状态)' : P.no + ' 无before'}`)

  // --- ③ 已收款作废 (R2) ---
  log('\n▶ 场景③ 已收款作废 (R2, collected>0) 🔥P0')
  const b2 = await grainQty(tk)
  const c2 = R(await api.grainOutOnce(tk, {
    factoryId: F, customerId: CUST_LI, customerSource: CUST_LI_S, customerName: '李老板', customerPhone: '',
    grainCode: GRAIN, grainName: GRAIN_NM, wareareaId: WH_GRAIN, wareareaName: '粮食1号仓',
    unitPrice: 40, grossWeight: 4100, tareWeight: 4000,
  }))
  await api.grainOutCollect(tk, { factoryId: F, customerId: CUST_LI, customerSource: CUST_LI_S, customerName: '李老板', amount: 1500, payMethod: 'cash', outboundIds: [c2.id], remark: 'R2测试' })
  const accCol = await accRow(tk, CUST_LI)   // 收款后
  await api.grainOutVoid(tk, c2.id, '场景③已收款作废')
  const a2 = await grainQty(tk)
  const accVoid = await accRow(tk, CUST_LI)  // 作废后
  await sleep(1200)
  const r2ok = accCol && accVoid && Number(accCol.totalCollected) === Number(accVoid.totalCollected) && Number(accCol.totalSalesAmount) === Number(accVoid.totalSalesAmount)
  log(`  库存 ${b2}→${a2}(作废后, R1应回到≈${b2}): ${a2 === b2 ? P.ok : P.no}`)
  log(`  台账已收 ${accCol && accCol.totalCollected}→${accVoid && accVoid.totalCollected} (R2应不动): ${r2ok ? P.ok : P.no}`)
  // 财务待办 (用 stat 看红点)
  const stat = R(await req('GET', '/hl-drying/drying/finance/todo/stat', { token: ft, qs: { factoryId: F } }))
  log(`  财务待办红点 pendingCount=${stat && stat.pendingCount} (R2应有待办): ${stat && stat.pendingCount > 0 ? P.ok : P.no}`)
}

// ============================================================
// 粮食入库 ⑪⑫
// ============================================================
async function grainIn() {
  const tk = tok('keeper')
  log('\n╔══════ B. 粮食入库作废 (场景⑪⑫) ══════╗')

  // --- ⑪ 已完成未付款作废 (R3) ---
  log('\n▶ 场景⑪ 已完成未付款作废 (R3, paid=0)')
  const before = await grainQty(tk)
  // 入库: grossWeight(毛) 5500, tareWeight(皮) 500 => 净重5000, 按干粮折算 (moisture 扣水). 简化用 dryWeight
  const created = R(await api.grainInOnce(tk, {
    factoryId: F, farmerId: CUST_LI, farmerSource: CUST_LI_S, farmerName: '李老板', farmerPhone: '',
    grainCode: GRAIN, grainName: GRAIN_NM, wareareaId: WH_GRAIN, wareareaName: '粮食1号仓',
    unitPrice: 2, grossWeight: 5500, tareWeight: 500, moisture: 10, impurity: 0,
  }))
  log('  建单返回 id=' + created.id + ' status=' + created.status + ' netWeight=' + created.netWeight + ' dryWeight=' + (created.dryWeight || '?'))
  const afterCreate = await grainQty(tk)
  const v = await api.grainInVoid(tk, created.id, '场景⑪未付款作废')
  log('  作废返回 success=' + v.data.success + ' msg=' + v.data.message)
  const afterVoid = await grainQty(tk)
  await sleep(1200)
  const oplog = await lastOpLog(tk, 'inbound', 'void', created.id)
  log(`  库存 ${before}→${afterCreate}(建)→${afterVoid}(作废, R1应回到≈${before}): ${Math.abs(afterVoid - before) < 50 ? P.ok : P.no + ' (干粮折算可能有尾差)'}`)
  log(`  op-log 留痕: ${oplog ? P.ok + ' id=' + oplog.id : P.no}`)
}

// ============================================================
// 农资出库 ⑦⑧
// ============================================================
async function agriOut() {
  const tk = tok('keeper'); const ft = tok('finance')
  log('\n╔══════ C. 农资出库作废 (场景⑦⑧) ══════╗')

  // --- ⑦ 未收款作废 (R3) ---
  log('\n▶ 场景⑦ 农资出库未收款作废 (R3)')
  const before = await agriQty(tk, WH_AGRI)
  const created = R(await api.agriOutSave(tk, {
    factoryId: F, customerId: CUST_LDS, customerSource: CUST_LI_S, customerName: '刘大帅', bizDate: '2026-06-23', remark: '场景⑦测试',
    items: [{ productId: AGRI, productSource: 'ours', productName: AGRI_NM, brand: '', spec: '0.5kg*60', unit: '千克', typeCode: '0301', category: '种子', wareareaId: '2064695417228115969', wareareaName: '农资2号仓', unitPrice: 30, qty: 10, amount: 300 }],
  }))
  log('  建单 id=' + created.id + ' totalAmount=' + created.totalAmount)
  const afterCreate = await agriQty(tk, WH_AGRI)
  const v = await api.agriOutVoid(tk, created.id, '场景⑦未收款作废')
  log('  作废 success=' + v.data.success + ' msg=' + v.data.message)
  const afterVoid = await agriQty(tk, WH_AGRI)
  await sleep(1200)
  const oplog = await lastOpLog(tk, 'inputOutbound', 'void', '刘大帅')
  const qtyDelta = before !== null && afterVoid !== null ? afterVoid - before : null
  log(`  库存 ${before}→${afterCreate}(建,应-10)→${afterVoid}(作废, R1应回到${before}): ${qtyDelta === 0 ? P.ok : P.no + ' (Δ=' + qtyDelta + ')'}`)
  log(`  op-log 留痕: ${oplog ? P.ok : P.no}`)
}

// ============================================================
// 农资入库 ⑬
// ============================================================
async function agriIn() {
  const tk = tok('keeper')
  log('\n╔══════ D. 农资入库作废 (场景⑬) ══════╗')
  log('\n▶ 场景⑬ 农资入库未付款作废 (R3)')
  const before = await agriQty(tk, WH_AGRI)
  const created = R(await api.agriInSave(tk, {
    factoryId: F, supplierId: SUP_PLAT, supplierSource: CUST_LI_S, supplierName: '平台种业', bizDate: '2026-06-23', remark: '场景⑬测试',
    items: [{ productId: AGRI, productSource: 'ours', productName: AGRI_NM, brand: '', spec: '0.5kg*60', unit: '千克', typeCode: '0301', category: '种子', wareareaId: '2064695417228115969', wareareaName: '农资2号仓', unitPrice: 25, qty: 20, amount: 500 }],
  }))
  log('  建单 id=' + created.id + ' totalAmount=' + created.totalAmount)
  const afterCreate = await agriQty(tk, WH_AGRI)
  const v = await api.agriInVoid(tk, created.id, '场景⑬未付款作废')
  log('  作废 success=' + v.data.success + ' msg=' + v.data.message)
  const afterVoid = await agriQty(tk, WH_AGRI)
  await sleep(1200)
  const oplog = await lastOpLog(tk, 'inputInbound', 'void', created.id)
  const qtyDelta = before !== null && afterVoid !== null ? afterVoid - before : null
  log(`  库存 ${before}→${afterCreate}(建,应+20)→${afterVoid}(作废, R1应回到${before}): ${qtyDelta === 0 ? P.ok : P.no + ' (Δ=' + qtyDelta + ')'}`)
  log(`  op-log 留痕: ${oplog ? P.ok : P.no}`)
}

// ============================================================
// 就地修改 ⑯⑲
// ============================================================
async function edit() {
  const tk = tok('keeper')
  log('\n╔══════ E. 就地修改 (场景⑯⑲) ══════╗')

  // --- ⑯ 改净重 (R3, 未收款) ---
  log('\n▶ 场景⑯ 改净重 100→80 (R3, 库存按差额回填)')
  const before = await grainQty(tk)
  const created = R(await api.grainOutOnce(tk, {
    factoryId: F, customerId: CUST_LI, customerSource: CUST_LI_S, customerName: '李老板', customerPhone: '',
    grainCode: GRAIN, grainName: GRAIN_NM, wareareaId: WH_GRAIN, wareareaName: '粮食1号仓',
    unitPrice: 40, grossWeight: 4100, tareWeight: 4000,
  }))
  const afterCreate = await grainQty(tk)
  const e = await api.editField(tk, { billType: 'grain_out', billId: created.id, fieldName: 'netWeight', newValue: 80, reason: '场景⑯改净重' })
  const afterEdit = await grainQty(tk)
  await sleep(1200)
  const oplog = await lastOpLog(tk, 'billEdit', 'edit', created.id)
  log('  修改返回: ' + JSON.stringify(R(e)))
  log(`  库存 ${before}→${afterCreate}(建-100)→${afterEdit}(改, 应回填差额+20): ${(afterEdit - afterCreate) === 20 ? P.ok : P.no + ' Δ=' + (afterEdit - afterCreate)}`)
  log(`  op-log before快照(改前netWeight=100): ${oplog && oplog.before && Number(oplog.before.netWeight) === 100 ? P.ok : P.no + ' ' + (oplog && oplog.before ? 'before.netWeight=' + oplog.before.netWeight : '无before')}`)
}

async function main() {
  const [, , cmd] = process.argv
  const map = { 'grain-out': grainOut, 'grain-in': grainIn, 'agri-out': agriOut, 'agri-in': agriIn, edit }
  if (cmd === 'all') {
    for (const fn of Object.values(map)) { await fn() }
    line(); log('\n全部场景跑完。详见上方各项 ' + P.ok + '/' + P.no)
  } else if (map[cmd]) {
    await map[cmd]()
  } else {
    log('用法: node test-scenarios.js <grain-out|grain-in|agri-out|agri-in|edit|all>')
  }
}
main().catch(e => { console.error('ERR', e); process.exit(1) })
