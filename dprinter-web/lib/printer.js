'use strict';
/*
 * lib/printer.js — 打印通道：调用 PowerShell 把 ESC/P 脚本发往打印机（RAW 模式）
 * ---------------------------------------------------------------------------
 * 工作流：
 *   1) 接收 escp.js 产出的 toScript() 字符串（或直接字符串）
 *   2) 写入临时 UTF-8 文件
 *   3) 用 child_process 调起 raw-print.ps1
 *   4) PS 侧读取文件 → 控制码按字节、文本按 GB18030 编码 → SendBytesToPrinter(打印机名, RAW)
 *   5) 回传 {ok, stdout, stderr, bytes}
 *
 * 零原生依赖：只用 child_process、fs、os、path。
 */

var fs = require('fs');
var os = require('os');
var path = require('path');
var cp = require('child_process');
var models = require('./models');

var PS1 = path.join(__dirname, 'raw-print.ps1');
var PS_EXE = process.env.SystemRoot
  ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  : 'powershell.exe';

// 列出系统打印机 + 默认打印机 + USB打印机硬件ID（用于型号自动探测）
function listPrinters(callback) {
  var ps = [
    '$ErrorActionPreference="SilentlyContinue";',
    '$all=Get-CimInstance -ClassName Win32_Printer | Select-Object Name,Default;',
    '$d=($all | Where-Object {$_.Default -eq $true} | Select-Object -First 1).Name;',
    // 注意：不能再用 `n 连接再 Write-Output，那会把多台打印机拆成多行，
    // 而后端按行读取后 NAMES= 这一行只剩第一个名字，其余被丢弃。
    // 改用竖线 | 分隔，保证所有打印机名挤在同一行输出。
    '$names=($all | ForEach-Object {$_.Name}) -join "|";',
    // 查 USB 打印机的硬件ID（USBPRINT\... 格式），用于型号探测
    '$usb=Get-CimInstance -ClassName Win32_PnPEntity | Where-Object {$_.PNPDeviceID -like "USBPRINT\*"} | ForEach-Object {$_.PNPDeviceID};',
    '$usbIds=($usb -join "|");',
    'Write-Output ("DEFAULT="+$d);',
    'Write-Output ("NAMES="+$names);',
    'Write-Output ("USBIDS_START");',
    'Write-Output $usbIds;',
    'Write-Output ("USBIDS_END");'
  ].join(' ');
  cp.execFile(PS_EXE, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
    { maxBuffer: 4 * 1024 * 1024 }, function (err, stdout, stderr) {
      if (err) {
        return callback(null, { defaultPrinter: '', printers: [], usbIds: [], error: err.message, stderr: stderr });
      }
      var defaultPrinter = '';
      var printers = [];
      var usbIds = [];
      var lines = String(stdout).split(/\r?\n/);
      var inUsb = false;
      lines.forEach(function (ln) {
        if (ln.indexOf('DEFAULT=') === 0) {
          defaultPrinter = ln.slice(8).trim();
        } else if (ln.indexOf('NAMES=') === 0) {
          // PS 侧用 | 连接所有名字（见上），这里按 | 拆分；
          // 兼容历史输出里可能残留的换行/分号。
          var rest = ln.slice(6);
          rest.split(/[|\n\r;]/).forEach(function (n) { if (n.trim()) printers.push(n.trim()); });
        } else if (ln.indexOf('USBIDS_START') === 0) {
          inUsb = true;
        } else if (ln.indexOf('USBIDS_END') === 0) {
          inUsb = false;
        } else if (inUsb && ln.trim()) {
          // USBIDS 段也改成单行 | 分隔，但仍兼容老的逐行输出
          ln.split(/[|\n\r]/).forEach(function (u) { if (u.trim()) usbIds.push(u.trim()); });
        }
      });

      // 自动探测型号：用硬件ID匹配 models 表
      var detectedModel = models.detectModel(usbIds);

      callback(null, {
        defaultPrinter: defaultPrinter,
        printers: printers,
        usbIds: usbIds,
        detectedModel: detectedModel
      });
    });
}

// 同步版本（用于简单场景）
function listPrintersSync() {
  // 通过 execSync 包一层；仅在非热路径使用
  var out = cp.execSync(
    '"' + PS_EXE + '" -NoProfile -ExecutionPolicy Bypass -Command "' +
    'Get-CimInstance -ClassName Win32_Printer | ForEach-Object { $_.Name }"',
    { encoding: 'utf8' }
  );
  return out.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
}

// 把 escp 脚本写到临时文件，返回文件路径
function writeScriptFile(script) {
  var dir = os.tmpdir();
  var file = path.join(dir, 'dprinter-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.txt');
  // 写入 UTF-8 with BOM，确保含中文的行被任何读取方正确识别
  var BOM = '\uFEFF';
  fs.writeFileSync(file, BOM + script, 'utf8');
  return file;
}

// 主入口：发送脚本到打印机
// opts: { printerName, dryRun, copies }
// script: 字符串（来自 EscpBuilder.toScript()）
function send(script, opts, callback) {
  opts = opts || {};
  var printerName = opts.printerName;
  var copies = Math.max(1, parseInt(opts.copies, 10) || 1);
  var dryRun = !!opts.dryRun;

  var steps = [];
  var scriptFile;
  try {
    scriptFile = writeScriptFile(script);
    steps.push('written temp script: ' + scriptFile);
  } catch (e) {
    return callback({ ok: false, error: '写入临时脚本失败: ' + e.message, steps: steps });
  }

  // 多份：在 PS 侧循环 copies 次发送
  var results = [];
  var sent = 0;

  function sendOne() {
    if (sent >= copies) {
      // 清理临时文件
      try { fs.unlinkSync(scriptFile); } catch (e) {}
      return callback(null, {
        ok: true,
        copies: copies,
        dryRun: dryRun,
        steps: steps.concat(results)
      });
    }
    sent++;
    var args = [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', PS1,
      '-PrinterName', printerName,
      '-ScriptFile', scriptFile
    ];
    if (dryRun) args.push('-DryRun');

    cp.execFile(PS_EXE, args, { maxBuffer: 4 * 1024 * 1024, windowsHide: true },
      function (err, stdout, stderr) {
        var so = String(stdout || '').trim();
        var se = String(stderr || '').trim();
        var entry = '[copy ' + sent + '] stdout: ' + so + (se ? ' | stderr: ' + se : '');
        results.push(entry);

        // 解析 PS 输出
        if (err) {
          try { fs.unlinkSync(scriptFile); } catch (e) {}
          return callback(null, {
            ok: false,
            error: 'PowerShell 执行失败(code ' + err.code + '): ' + se + ' | ' + so,
            steps: steps.concat(results)
          });
        }
        // 检查 OK=
        if (!dryRun && so.indexOf('OK=1') < 0 && so.indexOf('OK=0') >= 0) {
          try { fs.unlinkSync(scriptFile); } catch (e) {}
          return callback(null, {
            ok: false,
            error: '打印机拒绝任务(Win32错误码见日志)。' + so,
            steps: steps.concat(results)
          });
        }
        sendOne();
      });
  }
  sendOne();
}

// Promise 包装
function sendAsync(script, opts) {
  return new Promise(function (resolve, reject) {
    send(script, opts, function (err, res) {
      if (err) return reject(err);
      resolve(res);
    });
  });
}

module.exports = {
  send: send,
  sendAsync: sendAsync,
  listPrinters: listPrinters,
  listPrintersSync: listPrintersSync,
  writeScriptFile: writeScriptFile
};
