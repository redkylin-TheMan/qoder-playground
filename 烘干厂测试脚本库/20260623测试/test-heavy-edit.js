/**
 * 造一张"被反复修改"的粮食出库单, 用来压测变动历史面板的渲染.
 *
 * 策略: 新建一张单, 然后连续做 N 次修改 (净重/单价来回改 + 状态变化),
 * 让 change-log 积累大量记录, 每条记录含多个字段变更.
 *
 * 用法: node test-heavy-edit.js
 */
const http = require('http')
const F = '2062754110754656256'
const CUST = 'L_2067093406344736770'
const CUST_S = 'LOCAL'
const GRAIN_A = '0301010024'       // 竹两优
const GRAIN_B = '0301010025'       // 深香优 (用来测改品种, 同价同类)
const GRAIN_NM_A = '竹两优雪峰丝苗'
const GRAIN_NM_B = '深香优6615-散装'
const WH = '2062934879754043393'
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

async function main() {
  const tk = tok('keeper')
  if (!tk) { log('请先 node test-client.js login'); return }

  log('╔══════ 造一张被反复修改的出库单 ══════╗')

  // 1. 建单: 净重 100, 单价 40, 应收 4000
  const created = R(await req('POST', '/hl-drying/drying/grain-outbound/submit-once', {
    token: tk, body: {
      factoryId: F, customerId: CUST, customerSource: CUST_S, customerName: '李老板', customerPhone: '',
      grainCode: GRAIN_A, grainName: GRAIN_NM_A, wareareaId: WH, wareareaName: '粮食1号仓',
      unitPrice: 40, grossWeight: 4100, tareWeight: 4000,
    }
  }))
  const billId = created.id
  const billNo = created.exitNo
  log('① 建单 no=' + billNo + ' id=' + billId + ' (净重100/单价40/应收4000)')

  // 2. 连续 15 次修改: 净重在 80~120 之间来回跳, 单价在 38~45 之间跳
  const edits = [
    { field: 'netWeight', val: '80' },
    { field: 'netWeight', val: '110' },
    { field: 'unitPrice', val: '45' },
    { field: 'netWeight', val: '90' },
    { field: 'unitPrice', val: '38' },
    { field: 'netWeight', val: '120' },
    { field: 'unitPrice', val: '42' },
    { field: 'netWeight', val: '85' },
    { field: 'unitPrice', val: '50' },
    { field: 'netWeight', val: '100' },
    { field: 'unitPrice', val: '44' },
    { field: 'netWeight', val: '75' },
    { field: 'unitPrice', val: '48' },
    { field: 'netWeight', val: '95' },
    { field: 'unitPrice', val: '41' },
  ]
  for (let i = 0; i < edits.length; i++) {
    const e = edits[i]
    const res = await req('POST', '/hl-drying/drying/bill-edit/edit-field', {
      token: tk, body: { billType: 'grain_out', billId, fieldName: e.field, newValue: e.val, reason: '压测修改第' + (i + 1) + '次' + e.field }
    })
    const ok = res.ok
    log('  修改 ' + (i + 1) + '/' + edits.length + ': ' + e.field + '=' + e.val + (ok ? ' ✅' : ' ❌ ' + (res.data && res.data.message)))
    await sleep(300)   // 稍微间隔, 保证时间戳有序
  }

  await sleep(1000)

  // 3. 查 change-log 看积累了多少条
  const cl = R(await req('GET', '/hl-drying/drying/change-log/list', { token: tk, qs: { factoryId: F, bizNo: billNo, pageNo: 1, pageSize: 100 } })) || {}
  const list = cl.records || []
  log('\n② 这张单共积累 ' + (cl.total || list.length) + ' 条 change-log 记录')
  // 统计每条含几个字段
  let maxFields = 0
  list.forEach(x => {
    try {
      const d = JSON.parse(x.changeDetail || '{}')
      const n = Object.keys(d).length
      if (n > maxFields) maxFields = n
    } catch (e) {}
  })
  log('   单条记录最多含 ' + maxFields + ' 个字段变更 (改净重会连带改应收, 所以最多 2 个)')
  log('   最近 3 条:')
  list.slice(0, 3).forEach(x => log('    ', x.opTime, x.opType, x.changedFields, (x.changeDetail || '').slice(0, 60)))

  log('\n════════════════════════════════════════')
  log('★ 去浏览器看这张单的变动历史:')
  log('  路由: http://localhost:3100/#/exit')
  log('  单号: ' + billNo + ' (id: ' + billId + ')')
  log('  操作: 列表找这个单号 → 点「详情」→ 点【变动历史】')
  log('  预期: 右侧出现 ' + (cl.total || list.length) + ' 条记录, 可上下滚动')
  log('════════════════════════════════════════')
}
main().catch(e => { console.error('ERR', e); process.exit(1) })
