/**
 * V2.2 单据纠错测试客户端 (node 零依赖)
 *
 * 用法: node test-client.js <cmd> [args...]
 *   login <u> <p>                    登录, 存 token 到 test-tokens.json
 *   get  <account> <path> [qsJson]   GET  (account=keeper|finance)
 *   post <account> <path> [bodyJson] [qsJson]
 *   both <account> <path>            打印结果
 *
 * baseURL: http://localhost:3100/api (前端 dev server 代理)
 * token header: X-Access-Token
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const TOKEN_FILE = path.join(__dirname, 'test-tokens.json')
const BASE = 'http://localhost:3100'

function req(method, urlPath, { headers = {}, qs } = {}) {
  return new Promise((resolve, reject) => {
    let p = '/api' + urlPath
    if (qs && Object.keys(qs).length) {
      p += '?' + Object.entries(qs).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
    }
    const opts = { hostname: 'localhost', port: 3100, path: p, method, headers: { ...headers } }
    const r = http.request(opts, res => {
      let d = ''
      res.on('data', c => (d += c))
      res.on('end', () => {
        let j
        try { j = JSON.parse(d) } catch (e) { j = { _raw: d } }
        resolve({ status: res.statusCode, data: j })
      })
    })
    r.on('error', reject)
    r.setTimeout(60000, () => { r.destroy(new Error('timeout')) })
    r.end()
  })
}

function loadTokens() {
  try { return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')) } catch (e) { return {} }
}
function saveTokens(t) { fs.writeFileSync(TOKEN_FILE, JSON.stringify(t, null, 2)) }

async function login(u, p) {
  const r = await req('POST', '/jeecg-system/sys/login', {
    headers: { 'Content-Type': 'application/json' },
    // POST body 不走 qs, 这里特殊处理: 直接走原生
  })
  return r
}

// 带 body 的 POST
function postBody(urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body == null ? '' : JSON.stringify(body)
    const h = { ...headers }
    if (body != null) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(payload) }
    const r = http.request({ hostname: 'localhost', port: 3100, path: '/api' + urlPath, method: 'POST', headers: h }, res => {
      let d = ''; res.on('data', c => (d += c)); res.on('end', () => { let j; try { j = JSON.parse(d) } catch (e) { j = { _raw: d } }; resolve({ status: res.statusCode, data: j }) })
    })
    r.on('error', reject); r.setTimeout(60000, () => r.destroy(new Error('timeout')))
    if (payload) r.write(payload); r.end()
  })
}

async function loginAccount(u, p) {
  const r = await postBody('/jeecg-system/sys/login', { username: u, password: p })
  if (r.data && r.data.success && r.data.result && r.data.result.token) {
    return r.data.result
  }
  throw new Error('login failed: ' + JSON.stringify(r.data))
}

function authHeaders(account) {
  const t = loadTokens()
  const tok = t[account]
  if (!tok) throw new Error(`no token for account "${account}", run login first`)
  return { 'X-Access-Token': tok.token }
}

async function main() {
  const [, , cmd, ...rest] = process.argv
  if (cmd === 'login') {
    // node test-client.js login
    const accounts = {
      keeper: ['13272408549', '123456789'],
      finance: ['13272408548', '123456789'],
    }
    const out = {}
    for (const [name, [u, p]] of Object.entries(accounts)) {
      try {
        const info = await loginAccount(u, p)
        out[name] = info
        console.log(`[${name}] 登录成功 userName=${info.userInfo && info.userInfo.userName} roleCodes=${info.userInfo && info.userInfo.roleCodes && info.userInfo.roleCodes.join(',')} token=${info.token.slice(0, 24)}...`)
      } catch (e) {
        console.log(`[${name}] 登录失败: ${e.message}`)
      }
    }
    saveTokens(out)
    console.log('tokens saved to', TOKEN_FILE)
    return
  }

  // 其余命令: get/post/both
  const [account, urlPath, bodyOrQs, qsJson] = rest
  const H = authHeaders(account)
  let res
  if (cmd === 'get' || cmd === 'both') {
    let qs
    try { qs = bodyOrQs ? JSON.parse(bodyOrQs) : undefined } catch (e) { qs = undefined }
    res = await req('GET', urlPath, { headers: H, qs })
  } else if (cmd === 'post') {
    let body = null
    try { body = bodyOrQs ? JSON.parse(bodyOrQs) : null } catch (e) { body = bodyOrQs ? JSON.parse(bodyOrQs) : null }
    let qs
    try { qs = qsJson ? JSON.parse(qsJson) : undefined } catch (e) { qs = undefined }
    // params via qs, body via json
    if (qs) {
      // 加 query string
      const qsStr = '?' + Object.entries(qs).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
      res = await postBody(urlPath + qsStr, body, H)
    } else {
      res = await postBody(urlPath, body, H)
    }
  } else {
    console.log('unknown cmd:', cmd)
    return
  }
  console.log(`[${account}] ${cmd.toUpperCase()} ${urlPath} -> status=${res.status}`)
  console.log(JSON.stringify(res.data, null, 2))
}

main().catch(e => { console.error('ERR', e); process.exit(1) })
