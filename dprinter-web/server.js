'use strict';
/*
 * server.js — 得力 DB-618KII 针式打印机网页测试平台 · 本地 HTTP 服务
 * ---------------------------------------------------------------------------
 * 路由:
 *   GET  /                  首页（public/index.html）
 *   GET  /api/defaults      返回各单据的默认字段（供前端预填表单）
 *   GET  /api/printers      列出系统打印机 + 默认打印机
 *   POST /api/preview       body: { type, fields } -> 返回预览模型 + 脚本 hex
 *   POST /api/print         body: { type, fields, printerName, copies, dryRun }
 *
 * 仅监听 127.0.0.1，本机访问。
 */

var http = require('http');
var fs = require('fs');
var path = require('path');
var url = require('url');

var docs = require('./lib/documents');
var printer = require('./lib/printer');
var models = require('./lib/models');

var HOST = '127.0.0.1';
var PORT = 9100;
var PUBLIC_DIR = path.join(__dirname, 'public');

var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon'
};

// ---------- 单据构造分发 ----------
function buildDoc(type, fields, font, model) {
  switch (type) {
    case 'grainIn': return docs.grainIn(fields, font, model);
    case 'grainOut': return docs.grainOut(fields, font, model);
    case 'invoice': return docs.invoice(fields, font, model);
    case 'receipt': return docs.receipt(fields, font, model);
    case 'triplicate': return docs.triplicate(fields, font, model);
    default: return null;
  }
}

// ---------- HTTP 工具 ----------
function readBody(req, cb) {
  var chunks = [];
  req.on('data', function (c) { chunks.push(c); });
  req.on('end', function () {
    var raw = Buffer.concat(chunks).toString('utf8');
    try { cb(null, raw ? JSON.parse(raw) : {}); }
    catch (e) { cb(e); }
  });
}
function sendJson(res, code, obj) {
  var body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}
function serveStatic(req, res, pathname) {
  var rel = pathname === '/' ? '/index.html' : pathname;
  // 防目录穿越
  rel = rel.replace(/\.\./g, '').replace(/\\/g, '/');
  var file = path.join(PUBLIC_DIR, rel);
  if (file.indexOf(PUBLIC_DIR) !== 0) return sendJson(res, 403, { error: 'forbidden' });
  fs.readFile(file, function (err, data) {
    if (err) return sendJson(res, 404, { error: 'not found: ' + pathname });
    var ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// ---------- 路由 ----------
var server = http.createServer(function (req, res) {
  var parsed = url.parse(req.url, true);
  var p = parsed.pathname;

  if (req.method === 'GET' && p === '/api/defaults') {
    return sendJson(res, 200, { ok: true, defaults: docs.defaults });
  }

  if (req.method === 'GET' && p === '/api/printers') {
    return printer.listPrinters(function (err, info) {
      sendJson(res, 200, { ok: true, info: info });
    });
  }

  // 返回得力全系型号清单（含 driverUrl）
  if (req.method === 'GET' && p === '/api/models') {
    return sendJson(res, 200, {
      ok: true,
      models: models.listModels(),
      driverIndexPages: models.DRIVER_INDEX_PAGES,
      universalDrivers: models.UNIVERSAL_DRIVERS
    });
  }

  // 自动探测当前连接的得力打印机型号
  if (req.method === 'GET' && p === '/api/detect') {
    return printer.listPrinters(function (err, info) {
      sendJson(res, 200, {
        ok: true,
        detectedModel: info.detectedModel,
        detectedInfo: info.detectedModel ? models.getModel(info.detectedModel) : null,
        usbIds: info.usbIds,
        printers: info.printers,
        defaultPrinter: info.defaultPrinter
      });
    });
  }

  if (req.method === 'POST' && p === '/api/preview') {
    return readBody(req, function (e, body) {
      if (e) return sendJson(res, 400, { ok: false, error: 'JSON 解析失败: ' + e.message });
      var b = buildDoc(body.type, body.fields, body.font, body.model);
      if (!b) return sendJson(res, 400, { ok: false, error: '未知单据类型: ' + body.type });
      var script = b.toScript();
      var hex = Buffer.from(script, 'latin1').toString('hex');
      sendJson(res, 200, {
        ok: true,
        preview: b.getPreview(),
        script: script,
        hex: hex,
        bytes: hex.length / 2
      });
    });
  }

  if (req.method === 'POST' && p === '/api/print') {
    return readBody(req, function (e, body) {
      if (e) return sendJson(res, 400, { ok: false, error: 'JSON 解析失败: ' + e.message });
      var b = buildDoc(body.type, body.fields, body.font, body.model);
      if (!b) return sendJson(res, 400, { ok: false, error: '未知单据类型: ' + body.type });
      var script = b.toScript();

      if (!body.printerName && !body.dryRun) {
        return sendJson(res, 400, { ok: false, error: '未指定打印机且非 dryRun 模式' });
      }

      printer.send(script, {
        printerName: body.printerName || '(unknown)',
        copies: body.copies || 1,
        dryRun: !!body.dryRun
      }, function (err, result) {
        if (err) return sendJson(res, 500, { ok: false, error: err.error || err.message });
        sendJson(res, 200, {
          ok: !!result.ok,
          dryRun: !!body.dryRun,
          copies: body.copies || 1,
          bytes: Buffer.from(script, 'latin1').length,
          steps: result.steps,
          error: result.ok ? null : result.error
        });
      });
    });
  }

  // 其余按静态文件处理
  if (req.method === 'GET') return serveStatic(req, res, p);

  sendJson(res, 404, { error: 'not found: ' + p });
});

server.listen(PORT, HOST, function () {
  console.log('========================================================');
  console.log(' 得力 DB-618KII 针式打印机测试平台已启动');
  console.log('--------------------------------------------------------');
  console.log(' 浏览器打开:  http://' + HOST + ':' + PORT);
  console.log(' 关闭服务:    Ctrl + C');
  console.log('========================================================');
  console.log('');
});

server.on('error', function (e) {
  if (e.code === 'EADDRINUSE') {
    console.error('[错误] 端口 ' + PORT + ' 已被占用。请关闭占用程序，或修改 server.js 里的 PORT。');
  } else {
    console.error('[错误]', e.message);
  }
  process.exit(1);
});
