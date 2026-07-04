/**
 * 单据变更痕迹验证脚本
 * 验证 #/op-log 的"字段对比"(before/after) 是否能完整记录单据被改的过程.
 *
 * 用法:
 *   node test-oplog.js login                    登录(复用 test-tokens.json)
 *   node test-oplog.js edit-trace               建单→改净重→查 op-log detail 验证 before/after
 *   node test-oplog.js void-trace               建单→作废→查 op-log detail
 *   node test-oplog.js list-trace               查最近的 op-log(看模块分布)
 *   node test-oplog.js detail <opLogId>         查指定 op-log 的 detailJson
 *   node test-oplog.js change-log <bizNo>       查触发器写的字段变更溯源
 */
const http = require('http')
const FACTORY_ID = '2062754110754656256'
const CUSTOMER_ID = 'L_2067093406344736770'
const CUSTOMER_SOURCE = 'LOCAL'
const GRAIN_CODE = '0301010024'
const GRAIN_NAME = '竹两优雪峰丝苗'
const WAREAREA_ID = '2062934879754043393'
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
const log = (...a) => console.log(...a)
const line = () => console.log('─'.repeat(72))

const api = {
  submitOnce: (tk, body) => req('POST', '/hl-drying/drying/grain-outbound/submit-once', { token: tk, body }),
  editField: (tk, body) => req('POST', '/hl-drying/drying/bill-edit/edit-field', { token: tk, body }),
  voidOutbound: (tk, id, reason) => req('POST', '/hl-drying/drying/grain-outbound/void', { token: tk, qs: { factoryId: FACTORY_ID, id, reason } }),
  opList: (tk, qs) => req('GET', '/hl-drying/drying/op-log/list', { token: tk, qs }),
  opDetail: (tk, id) => req('GET', '/hl-drying/drying/op-log/detail', { token: tk, qs: { id } }),
  changeLog: (tk, qs) => req('GET', '/hl-drying/drying/change-log/list', { token: tk, qs }),
}

// 打印 before/after 字段对比 (模拟 #/op-log 字段对比 tab)
function printDiff(detailObj) {
  if (!detailObj) { log('  (无 detailJson)'); return false }
  const before = detailObj.before || null
  const after = detailObj.after || null
  if (!before && !after) {
    log('  detailJson 有内容, 但无 before/after 结构:')
    log('   ', JSON.stringify(detailObj).slice(0, 200))
    return false
  }
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})])
  log('  ┌─────────────────┬──────────────────┬──────────────────┐')
  log('  │ 字段            │ 改前             │ 改后             │')
  log('  ├─────────────────┼──────────────────┼──────────────────┤')
  ;[...keys].forEach(k => {
    const b = before ? before[k] : '—'
    const a = after ? after[k] : '—'
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      log('  │', String(k).padEnd(15), '│', String(b).padEnd(16), '│', String(a).padEnd(16), '│  ◀ 变更')
    }
  })
  log('  └─────────────────┴──────────────────┴──────────────────┘')
  return true
}

async function findLatestOpLog(tk, module, action, summaryContains) {
  const r = R(await api.opList(tk, { factoryId: FACTORY_ID, pageNo: 1, pageSize: 30 })) || {}
  const list = r.records || r.list || r
  return (Array.isArray(list) ? list : []).find(x =>
    (!module || x.module === module) &&
    (!action || x.action === action) &&
    (!summaryContains || (x.summary || '').includes(summaryContains))
  )
}

async function main() {
  const kTok = tok('keeper')
  const [, , cmd, ...rest] = process.argv

  if (cmd === 'list-trace') {
    log('=== 最近 20 条操作日志 (看模块分布) ===')
    const r = R(await api.opList(kTok, { factoryId: FACTORY_ID, pageNo: 1, pageSize: 20 })) || {}
    const list = r.records || r.list || r
    ;(Array.isArray(list) ? list : []).forEach(x => log(' ', String(x.opTime).slice(5,19), '|', (x.module||'').padEnd(14), '|', (x.action||'').padEnd(14), '|', (x.summary||'').slice(0,36), '|', x.result))
    // 模块去重统计
    const mods = {}
    ;(Array.isArray(list) ? list : []).forEach(x => { mods[x.module] = (mods[x.module]||0)+1 })
    log('\n模块分布:', JSON.stringify(mods))
    log('\n⚠ 前端 MODULE_OPTIONS 字典是否含这些模块? billEdit/financeConfirm 不在则页面上显示英文 code')
    return
  }

  if (cmd === 'detail') {
    const id = rest[0]
    log('=== OpLog detail: ' + id + ' ===')
    const r = R(await api.opDetail(kTok, id))
    log('  module=' + r.module, 'action=' + r.action, 'summary=' + r.summary)
    const obj = r.detailJson ? JSON.parse(r.detailJson) : null
    printDiff(obj)
    return
  }

  if (cmd === 'change-log') {
    const bizNo = rest[0]
    log('=== 字段变更溯源 (触发器): bizNo=' + bizNo + ' ===')
    const r = R(await api.changeLog(kTok, { factoryId: FACTORY_ID, bizNo, pageNo: 1, pageSize: 50 })) || {}
    const list = r.records || r.list || r
    log('共', (Array.isArray(list)?list.length:(r.total||0)), '条')
    ;(Array.isArray(list) ? list : []).forEach(x => log('  ', String(x.changeTime||x.opTime).slice(5,19), '|', (x.changedField||x.fieldName), '|', JSON.stringify(x.oldValue)+'→'+JSON.stringify(x.newValue), '|', (x.clientInfo||'').slice(0,30)))
    return
  }

  if (cmd === 'edit-trace') {
    log('╔══════ 验证: 就地修改的 before/after 留痕 ══════╗')
    // 建单
    const created = R(await api.submitOnce(kTok, {
      factoryId: FACTORY_ID, customerId: CUSTOMER_ID, customerSource: CUSTOMER_SOURCE, customerName: '李老板', customerPhone: '',
      grainCode: GRAIN_CODE, grainName: GRAIN_NAME, wareareaId: WAREAREA_ID, wareareaName: '粮食1号仓',
      unitPrice: 40, grossWeight: 4100, tareWeight: 4000,
    }))
    const billId = created.id
    const billNo = created.exitNo
    line(); log('① 建单 id=' + billId + ' no=' + billNo + ' (净重100/应收4000)')
    // 改净重
    await new Promise(r => setTimeout(r, 800))
    const edited = await api.editField(kTok, { billType: 'grain_out', billId, fieldName: 'netWeight', newValue: 80, reason: '痕迹测试改净重' })
    line(); log('② 就地修改 netWeight 100→80')
    log('  返回:', JSON.stringify(R(edited)))
    // 等 op-log 异步写入
    await new Promise(r => setTimeout(r, 1500))
    // 查 op-log
    line(); log('③ 查 op-log (module=billEdit action=edit)')
    const r = R(await api.opList(kTok, { factoryId: FACTORY_ID, pageNo: 1, pageSize: 10 })) || {}
    const list = r.records || r.list || r
    const editLog = (Array.isArray(list) ? list : []).find(x => x.module === 'billEdit' && x.action === 'edit')
    if (!editLog) { log('  ❌ 没找到 billEdit 的 op-log! 列表里模块:', [...new Set((Array.isArray(list)?list:[]).map(x=>x.module))].join(',')); return }
    log('  找到 op-log: id=' + editLog.id, 'summary=' + editLog.summary)
    const detail = R(await api.opDetail(kTok, editLog.id))
    const obj = detail.detailJson ? JSON.parse(detail.detailJson) : null
    log('  detailJson keys:', obj ? Object.keys(obj).join(',') : '(空)')
    const hasBA = obj && (obj.before || obj.after)
    line(); log('④ 字段对比 (这就是 #/op-log 详情抽屉「字段对比」tab 显示的内容):')
    const ok = printDiff(obj)
    log('\n  ▶ before/after 留痕:', hasBA ? '✅ 有 (前端 #/op-log 可看改前改后)' : '❌ 无 (detailJson 里没 before/after, 只记了请求 DTO)')
    return
  }

  if (cmd === 'void-trace') {
    log('╔══════ 验证: 作废的 before/after 留痕 ══════╗')
    const created = R(await api.submitOnce(kTok, {
      factoryId: FACTORY_ID, customerId: CUSTOMER_ID, customerSource: CUSTOMER_SOURCE, customerName: '李老板', customerPhone: '',
      grainCode: GRAIN_CODE, grainName: GRAIN_NAME, wareareaId: WAREAREA_ID, wareareaName: '粮食1号仓',
      unitPrice: 40, grossWeight: 4100, tareWeight: 4000,
    }))
    const billId = created.id; const billNo = created.exitNo
    line(); log('① 建单 no=' + billNo)
    await new Promise(r => setTimeout(r, 800))
    await api.voidOutbound(kTok, billId, '痕迹测试作废')
    line(); log('② 作废')
    await new Promise(r => setTimeout(r, 1500))
    line(); log('③ 查 op-log (module=outbound action=void, summary 含 ' + billId + ')')
    const r = R(await api.opList(kTok, { factoryId: FACTORY_ID, pageNo: 1, pageSize: 10 })) || {}
    const list = r.records || r.list || r
    const vlog = (Array.isArray(list) ? list : []).find(x => x.module === 'outbound' && x.action === 'void' && (x.summary||'').includes(billId))
    if (!vlog) { log('  ❌ 没找到作废 op-log'); return }
    log('  找到 op-log: id=' + vlog.id)
    const detail = R(await api.opDetail(kTok, vlog.id))
    const obj = detail.detailJson ? JSON.parse(detail.detailJson) : null
    line(); log('④ 字段对比:')
    printDiff(obj)
    const hasBA = obj && (obj.before || obj.after)
    log('\n  ▶ before/after 留痕:', hasBA ? '✅ 有' : '❌ 无')
    // 同时查触发器 change-log
    line(); log('⑤ 触发器字段变更溯源 (change-log, bizNo=' + billNo + '):')
    const cl = R(await api.changeLog(kTok, { factoryId: FACTORY_ID, bizNo })) || {}
    const clList = cl.records || cl.list || cl
    log('  共', (Array.isArray(clList)?clList.length:(cl.total||0)), '条')
    ;(Array.isArray(clList) ? clList : []).slice(0, 5).forEach(x => log('   ', (x.changedField||x.fieldName), JSON.stringify(x.oldValue)+'→'+JSON.stringify(x.newValue), '|', (x.clientInfo||'').slice(0,40)))
    return
  }

  log('用法: node test-oplog.js <list-trace|edit-trace|void-trace|detail <id>|change-log <bizNo>>')
}
main().catch(e => { console.error('ERR', e); process.exit(1) })
