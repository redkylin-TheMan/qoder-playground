/**
 * V2.2 单据纠错 · 自动化测试脚本
 * 直接调后端 API (经前端 dev server 3100 代理), 按 08_测试与验收手册 逐条验.
 *
 * 用法: node test-v22.js <case>
 *   case = baseline | void-r3 | void-r2 | edit | confirm-refund
 */
const http = require('http')

const BASE_HOST = 'localhost'
const BASE_PORT = 3100
const FACTORY_ID = '2062754110754656256'
const CUSTOMER_ID = 'L_2067093406344736770'  // 李老板 LOCAL
const CUSTOMER_SOURCE = 'LOCAL'
const GRAIN_CODE = '0301010024'              // 竹两优 (库存最多)
const GRAIN_NAME = '竹两优雪峰丝苗'
const WAREAREA_ID = '2062934879754043393'    // 粮食1号仓

const tokens = require('./test-tokens.json')
const tok = (acct) => tokens[acct] && tokens[acct].token

function req(method, urlPath, { token, body, qs } = {}) {
  return new Promise((resolve, reject) => {
    let p = '/api' + urlPath
    if (qs && Object.keys(qs).length) {
      p += '?' + Object.entries(qs).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
    }
    const headers = {}
    if (token) headers['X-Access-Token'] = token
    let payload = ''
    if (body !== undefined && body !== null) {
      payload = JSON.stringify(body)
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = Buffer.byteLength(payload)
    }
    const r = http.request({ hostname: BASE_HOST, port: BASE_PORT, path: p, method, headers }, res => {
      let d = ''; res.on('data', c => (d += c)); res.on('end', () => {
        let j; try { j = JSON.parse(d) } catch (e) { j = { _raw: d } }
        resolve({ status: res.statusCode, data: j, ok: j && j.success === true })
      })
    })
    r.on('error', reject); r.setTimeout(60000, () => r.destroy(new Error('timeout')))
    if (payload) r.write(payload); r.end()
  })
}

// 取 result (前端拦截器同款行为)
const R = (resp) => (resp.data && resp.data.result !== undefined ? resp.data.result : resp.data)

// ---------- 业务调用 ----------
const api = {
  grainStock: (tk) => req('GET', '/hl-drying/drying/grain-stock/list', { token: tk, qs: { factoryId: FACTORY_ID } }),
  stockLogs: (tk, stockId) => req('GET', '/hl-drying/drying/stock-log/list-by-stock', { token: tk, qs: { factoryId: FACTORY_ID, stockId } }),
  accountList: (tk) => req('GET', '/hl-drying/drying/finance/account/list', { token: tk, qs: { factoryId: FACTORY_ID } }),
  settlement: (tk, customerId, customerSource) => req('GET', '/hl-drying/drying/finance/account/settlement', { token: tk, qs: { factoryId: FACTORY_ID, customerId, customerSource } }),
  outbounds: (tk) => req('GET', '/hl-drying/drying/grain-outbound/list', { token: tk, qs: { factoryId: FACTORY_ID } }),
  submitOnce: (tk, body) => req('POST', '/hl-drying/drying/grain-outbound/submit-once', { token: tk, body }),
  voidOutbound: (tk, id, reason) => req('POST', '/hl-drying/drying/grain-outbound/void', { token: tk, qs: { factoryId: FACTORY_ID, id, reason } }),
  collect: (tk, body) => req('POST', '/hl-drying/drying/grain-outbound/collect', { token: tk, body }),
  editField: (tk, body) => req('POST', '/hl-drying/drying/bill-edit/edit-field', { token: tk, body }),
  todoList: (tk) => req('GET', '/hl-drying/drying/finance/todo/list', { token: tk, qs: { factoryId: FACTORY_ID, pageNo: 1, pageSize: 50 } }),
  todoStat: (tk) => req('GET', '/hl-drying/drying/finance/todo/stat', { token: tk, qs: { factoryId: FACTORY_ID } }),
  noticeList: (tk) => req('GET', '/hl-drying/drying/notice/list', { token: tk, qs: { factoryId: FACTORY_ID, pageNo: 1, pageSize: 20 } }),
  confirmRefund: (tk, body) => req('POST', '/hl-drying/drying/finance/confirm/refund', { token: tk, body }),
  outboundByNo: (tk, billNo) => req('GET', '/hl-drying/drying/grain-outbound/by-no', { token: tk, qs: { factoryId: FACTORY_ID, outboundNo: billNo } }),
}

const log = (...a) => console.log(...a)
const line = () => console.log('─'.repeat(70))

// 找李老板的台账行
async function findAccount(tk) {
  const list = R(await api.accountList(tk)) || []
  return list.find(a => String(a.customerId) === CUSTOMER_ID) || null
}
// 找竹两优 stockId
async function findStock(tk) {
  const list = R(await api.grainStock(tk)) || []
  return list.find(s => s.grainCode === GRAIN_CODE) || null
}

async function snap(tk, label) {
  line()
  log(`【快照】${label}`)
  const acc = await findAccount(tk)
  const stk = await findStock(tk)
  log('  台账(李老板):', acc ? `应收累计=${acc.totalSalesAmount} 已收=${acc.totalCollected} 当前应收=${acc.currentReceivable}` : '无台账行')
  log('  库存(竹两优):', stk ? `stockId=${stk.id} 干粮库存=${stk.stockDry}` : '无库存行')
  return { acc, stk }
}

async function main() {
  const kTok = tok('keeper')
  const fTok = tok('finance')
  const [, , cmd] = process.argv

  if (cmd === 'baseline') {
    await snap(kTok, '基线 (开始测试前)')
    const stk = await findStock(kTok)
    if (stk) {
      const logs = R(await api.stockLogs(kTok, stk.id)) || []
      log(`  竹两优流水: 共 ${logs.length} 条, 最近3条:`)
      logs.slice(0, 3).forEach(l => log('   ', l.opTime && String(l.opTime).slice(5, 16), l.bizType, 'Δ' + l.qtyChange, '后' + l.qtyAfter, '|', (l.remark || '').slice(0, 30)))
    }
    return
  }

  if (cmd === 'void-existing') {
    // 作废一张已存在的出库单 (id 从命令行传), 用于复测修复后的脏单
    const billId = process.argv[3]
    const reason = process.argv[4] || '复测作废'
    log('╔══════ 作废已存在出库单 ' + billId + ' ══════╗')
    const before = await snap(kTok, '① 作废前')
    const voided = await api.voidOutbound(kTok, billId, reason)
    log('  作废返回 success=', voided.data.success, '| message=', voided.data.message)
    const after = await snap(kTok, '② 作废后')
    const a0 = before.acc || {}, a1 = after.acc || {}
    const s0 = Number((before.stk || {}).stockDry), s1 = Number((after.stk || {}).stockDry)
    log('  应收: %s → %s (R3 应减回)', a0.totalSalesAmount, a1.totalSalesAmount)
    log('  库存: %s → %s (R1 应+100 回填)', s0, s1)
    // 流水
    const stk2 = await findStock(kTok)
    const logs = R(await api.stockLogs(kTok, stk2.id)) || []
    const vl = logs.filter(l => /void/.test(l.bizType || ''))
    log('  void 流水', vl.length, '条:')
    vl.slice(0, 3).forEach(l => log('   ', String(l.opTime).slice(5, 16), l.bizType, 'Δ' + l.qtyChange, '前' + l.qtyBefore + '→后' + l.qtyAfter, '|', (l.remark || '').slice(0, 30)))
    const r3ok = voided.ok && (Number(a1.totalSalesAmount) === 0) && (s1 - s0 === 100)
    log('  ▶ R3 断言:', r3ok ? '✅ 通过' : '❌ 未通过')
    return
  }

  if (cmd === 'void-r3') {
    log('╔══════ TC-VOID-01 粮食出库·未收款作废 (R3 场景③) ══════╗')
    const before = await snap(kTok, '① 改前')
    // 建单: 皮重4000 + 毛重4100 => 净重100, 单价40 => 应收4000, collected=0
    const body = {
      factoryId: FACTORY_ID, customerId: CUSTOMER_ID, customerSource: CUSTOMER_SOURCE,
      customerName: '李老板', customerPhone: '',
      grainCode: GRAIN_CODE, grainName: GRAIN_NAME,
      wareareaId: WAREAREA_ID, wareareaName: '粮食1号仓',
      unitPrice: 40, grossWeight: 4100, tareWeight: 4000,
    }
    line(); log('② 单次过磅建出库单 (净重100 / 单价40 / 应收4000 / 未收款)')
    const created = R(await api.submitOnce(kTok, body))
    log('  建单返回:', JSON.stringify(created))
    const billNo = created && (created.outboundNo || created.billNo || created.entryNo)
    const billId = created && (created.id || created.outboundId)
    log('  => 单号:', billNo, '| id:', billId)

    const afterCreate = await snap(kTok, '③ 建单后 (应收应+4000, 库存应-100)')

    // 作废
    line(); log('④ 作废 (reason=客户取消)')
    const voided = await api.voidOutbound(kTok, billId, '客户取消-测试R3')
    log('  作废返回 success=', voided.data.success, '| message=', voided.data.message)

    const afterVoid = await snap(kTok, '⑤ 作废后 (R3: 应收应回到改前, 库存应回填+100)')

    // 流水验证
    line(); log('⑥ 验库存流水 (应见 outbound_void 行, Δ=+100)')
    const stk2 = await findStock(kTok)
    const logs = R(await api.stockLogs(kTok, stk2.id)) || []
    const voidLogs = logs.filter(l => /void/.test(l.bizType || ''))
    voidLogs.slice(0, 3).forEach(l => log('   ', String(l.opTime).slice(5, 16), l.bizType, 'Δ' + l.qtyChange, '前' + l.qtyBefore + '→后' + l.qtyAfter, '|', (l.remark || '').slice(0, 40)))

    // 断言
    line(); log('⑦ 断言 (R3 立即冲账)')
    const a0 = before.acc || {}, a1 = afterCreate.acc || {}, a2 = afterVoid.acc || {}
    const s0 = Number((before.stk || {}).stockDry), s2 = Number((afterVoid.stk || {}).stockDry)
    log('  应收: 改前=%s → 建单后=%s → 作废后=%s', a0.totalSalesAmount, a1.totalSalesAmount, a2.totalSalesAmount)
    log('  库存: 改前=%s → 作废后=%s  (应相等=回填)', s0, s2)
    log('  ▶ R3 断言:', (Number(a2.totalSalesAmount) === Number(a0.totalSalesAmount)) && (s2 === s0) ? '✅ 通过 (台账立即冲减+库存立即回填)' : '❌ 未通过')
    return
  }

  if (cmd === 'void-r2') {
    log('╔══════ TC-VOID-02 粮食出库·已收款作废 (R2 场景④) ══════╗')
    const before = await snap(kTok, '① 改前')
    const body = {
      factoryId: FACTORY_ID, customerId: CUSTOMER_ID, customerSource: CUSTOMER_SOURCE,
      customerName: '李老板', customerPhone: '',
      grainCode: GRAIN_CODE, grainName: GRAIN_NAME,
      wareareaId: WAREAREA_ID, wareareaName: '粮食1号仓',
      unitPrice: 40, grossWeight: 4100, tareWeight: 4000,
    }
    line(); log('② 建出库单 (净重100/应收4000/未收款)')
    const created = R(await api.submitOnce(kTok, body))
    const billId = created && created.id
    const billNo = created && (created.outboundNo || created.billNo)
    log('  => 单号:', billNo, '| id:', billId)

    line(); log('③ 收款 1500 (collected=1500)')
    const collectBody = {
      factoryId: FACTORY_ID, customerId: CUSTOMER_ID, customerSource: CUSTOMER_SOURCE,
      customerName: '李老板', amount: 1500, payMethod: 'cash', outboundIds: [billId], remark: 'R2测试收款1500',
    }
    const collected = await api.collect(kTok, collectBody)
    log('  收款返回 success=', collected.data.success, '| message=', collected.data.message)
    if (!collected.ok) { log('  ⚠ 收款失败, 中止'); return }

    const afterCollect = await snap(kTok, '④ 收款后 (已收应=1500)')

    // 作废
    line(); log('⑤ 作废 (reason=数量录错)')
    const voided = await api.voidOutbound(kTok, billId, '数量录错-测试R2')
    log('  作废返回 success=', voided.data.success, '| message=', voided.data.message)

    const afterVoid = await snap(kTok, '⑥ 作废后 (R2: 台账应不动! 已收仍=1500)')

    // 财务待办 + 通知
    line(); log('⑦ 验财务待办 (财务账号)')
    const stat = R(await api.todoStat(fTok))
    log('  待办统计:', JSON.stringify(stat))
    const todo = R(await api.todoList(fTok)) || []
    const myTodo = todo.records ? todo.records : todo
    log('  待办条数:', Array.isArray(myTodo) ? myTodo.length : (todo.total || '?'))
    const recent = Array.isArray(myTodo) ? myTodo : (todo.records || [])
    recent.slice(0, 3).forEach(t => log('   ', t.billType || t.itemType, t.billNo, t.action, t.amount, '|', (t.reason || '').slice(0, 30)))

    // 断言
    line(); log('⑧ 断言 (R2 台账不动)')
    const a3 = afterCollect.acc || {}, a4 = afterVoid.acc || {}
    const s0 = Number((before.stk || {}).stockDry), s4 = Number((afterVoid.stk || {}).stockDry)
    log('  已收: 收款后=%s → 作废后=%s (R2应不变)', a3.totalCollected, a4.totalCollected)
    log('  应收累计: 收款后=%s → 作废后=%s (R2应不变)', a3.totalSalesAmount, a4.totalSalesAmount)
    log('  库存: 改前=%s → 作废后=%s (R1应立即回填, 差-100)', s0, s4)
    const r2ok = (Number(a4.totalCollected) === Number(a3.totalCollected)) && (Number(a4.totalSalesAmount) === Number(a3.totalSalesAmount))
    // R1: 作废后库存应 == 改前基线 s0 (R2 库存也立即回填, 不等财务)
    const r1ok = s4 === s0
    log('  ▶ R2 断言(台账不动):', r2ok ? '✅ 通过' : '❌ 未通过')
    log('  ▶ R1 断言(库存立即回填到基线):', r1ok ? '✅ 通过' : '❌ 未通过')
    return
  }

  if (cmd === 'edit') {
    log('╔══════ TC-EDIT 就地修改·改净重 (R3) ══════╗')
    const before = await snap(kTok, '① 改前')
    const body = {
      factoryId: FACTORY_ID, customerId: CUSTOMER_ID, customerSource: CUSTOMER_SOURCE,
      customerName: '李老板', customerPhone: '',
      grainCode: GRAIN_CODE, grainName: GRAIN_NAME,
      wareareaId: WAREAREA_ID, wareareaName: '粮食1号仓',
      unitPrice: 40, grossWeight: 4100, tareWeight: 4000,   // 净重100
    }
    line(); log('② 建出库单 (净重100/应收4000/未收款)')
    const created = R(await api.submitOnce(kTok, body))
    const billId = created && created.id
    log('  => id:', billId)

    line(); log('③ 就地修改: netWeight 100→80')
    const edited = await api.editField(kTok, {
      billType: 'grain_out', billId, fieldName: 'netWeight', newValue: 80, reason: '测试改净重',
    })
    log('  修改返回:', JSON.stringify(edited.data))
    const editRes = R(edited)
    if (editRes) log('  → needFinanceReview=%s deltaAmount=%s oldValue=%s newValue=%s', editRes.needFinanceReview, editRes.deltaAmount, editRes.oldValue, editRes.newValue)

    const afterEdit = await snap(kTok, '④ 改后 (库存应回填差额20, 应收应-800=3200)')
    const a0 = before.acc || {}, a1 = afterEdit.acc || {}
    const s0 = Number((before.stk || {}).stockDry), s1 = Number((afterEdit.stk || {}).stockDry)
    log('  库存: 改前=%s → 改后=%s (应+20 回填)', s0, s1)
    log('  应收累计: 改前=%s → 改后=%s (应+3200, 即原+4000改后净效果+3200)', a0.totalSalesAmount, a1.totalSalesAmount)
    log('  ▶ 修改库存差额断言:', (s1 - s0) === 20 ? '✅ 通过' : '❌ 未通过')
    return
  }

  if (cmd === 'confirm-refund') {
    log('╔══════ TC-CONFIRM 财务核查退款 ══════╗')
    const stat = R(await api.todoStat(fTok))
    log('待办统计:', JSON.stringify(stat))
    const todoResp = await api.todoList(fTok)
    const todo = R(todoResp)
    const list = Array.isArray(todo) ? todo : (todo && (todo.records || [])) || []
    log('待办条数:', list.length)
    list.slice(0, 5).forEach((t, i) => log(`  [${i}]`, t.itemType || t.billType, t.itemId || t.billId, t.billNo, 'amt=' + t.amount, 'action=' + t.action))
    if (!list.length) { log('  无待办, 跳过(先跑 void-r2 产生待办)'); return }
    const item = list[0]
    line(); log(`② 对第1条退款: itemId=${item.itemId || item.billId} type=${item.itemType || item.billType}`)
    const refundBody = { itemId: item.itemId || item.billId, itemType: item.itemType || item.billType, action: 'refund', amount: item.amount || item.collected || 1500, reason: '测试退款' }
    const res = await api.confirmRefund(fTok, refundBody)
    log('  退款返回:', JSON.stringify(res.data))
    return
  }

  if (cmd === 'confirm-idempotent') {
    // 端到端: 建R2单 → 退款(成功) → 再退款(应幂等拦截). 全程 node 发 UTF-8, 规避 curl 中文编码问题.
    log('╔══════ TC-CONFIRM-02 幂等拦截 (端到端 UTF-8) ══════╗')
    const body = {
      factoryId: FACTORY_ID, customerId: CUSTOMER_ID, customerSource: CUSTOMER_SOURCE,
      customerName: '李老板', customerPhone: '',
      grainCode: GRAIN_CODE, grainName: GRAIN_NAME,
      wareareaId: WAREAREA_ID, wareareaName: '粮食1号仓',
      unitPrice: 40, grossWeight: 4100, tareWeight: 4000,
    }
    log('① 建出库单 + 收款1500 + 作废(产生 pending_review 待办)')
    const created = R(await api.submitOnce(kTok, body))
    const billId = created && created.id
    const collectBody = { factoryId: FACTORY_ID, customerId: CUSTOMER_ID, customerSource: CUSTOMER_SOURCE, customerName: '李老板', amount: 1500, payMethod: 'cash', outboundIds: [billId], remark: '幂等测试收款' }
    await api.collect(kTok, collectBody)
    await api.voidOutbound(kTok, billId, '幂等测试作废')

    // 等财务待办出现
    const todoResp = await api.todoList(fTok)
    const todo = R(todoResp)
    const list = Array.isArray(todo) ? todo : (todo && (todo.records || [])) || []
    const item = list.find(t => (t.itemId || t.billId) === billId) || list[0]
    const itemId = item.itemId || item.billId || billId
    const itemType = item.itemType || item.billType || 'bill'
    line(); log(`② 第1次退款 (应成功): itemId=${itemId}`)
    const r1 = await api.confirmRefund(fTok, { itemId, itemType, action: 'refund', amount: 1500, reason: '第一次退款正常' })
    log('  结果: success=' + r1.data.success + ' | message=' + r1.data.message)

    line(); log(`③ 第2次退款 (应被幂等拦截, 返回"已核查,不能重复操作")`)
    const r2 = await api.confirmRefund(fTok, { itemId, itemType, action: 'refund', amount: 1500, reason: '第二次重复退款' })
    log('  结果: success=' + r2.data.success + ' | message=' + r2.data.message)
    const ok = r2.data.success === false && /已核查|不能重复|重复操作/.test(r2.data.message || '')
    log('  ▶ 幂等拦截断言:', ok ? '✅ 通过' : '❌ 未通过')
    return
  }

  log('用法: node test-v22.js <baseline|void-r3|void-r2|edit|confirm-refund|confirm-idempotent>')
}

main().catch(e => { console.error('ERR', e); process.exit(1) })
