import './styles/main.css';
import './styles/print.css';
import './styles/grain-print.css';
import './styles/grain-preview.css';
import { samples } from './receipts.js';
import { grainSamples } from './grain/grainSamples.js';
import { GRAIN_RENDERERS } from './grain/grainTemplates.js';
import QRCode from 'qrcode';

// =========================================================
// localStorage 键
// =========================================================
const LS_PRINTER = 'm32_printer_name';

// =========================================================
// 状态
// =========================================================
let activeTab = 'general';                 // 'general' | 'grain'
let activeSampleId = samples[0].id;        // 通用小票当前项
let activeGrainId = grainSamples[0].id;    // 粮食小票当前项
let savedPrinter = localStorage.getItem(LS_PRINTER) || '';

// 粮食小票 QR 缓存: { [sampleId]: dataURL }
const grainQrCache = {};

// =========================================================
// 入口
// =========================================================
const app = document.getElementById('app');
render();

// =========================================================
// 渲染整个界面
// =========================================================
function render() {
  app.innerHTML = `
    <header class="app-header">
      <h1>🖨️ m32_print_test</h1>
      <p class="subtitle">58mm 宽 · 长度可变 · 热敏小票打印测试工具</p>
    </header>

    <!-- Tab 切换 -->
    <div class="tabs">
      <button class="tab-btn ${activeTab === 'general' ? 'active' : ''}" data-tab="general">
        🧾 通用小票 (4 张)
      </button>
      <button class="tab-btn ${activeTab === 'grain' ? 'active' : ''}" data-tab="grain">
        🌾 粮食出入库小票 (6 张)
      </button>
    </div>

    <div class="layout">
      <!-- 左侧：设置 + 测试项 -->
      <div>
        <!-- 打印机设置 -->
        <section class="card">
          <h2>打印机设置 <span class="badge">58mm</span></h2>

          <div class="printer-note">
            ⚠️ 浏览器无法直接枚举/指定系统打印机。点击「打印」会唤起
            <b>系统打印对话框</b>，请在其中选择你的 58mm 热敏小票打印机，
            并将纸张设为 <b>58mm 宽 / 长度自动</b>。下方填写的名称仅用于本地记忆。
          </div>

          <div class="field">
            <label for="printer-name">打印机名称（仅本地记录，便于识别）</label>
            <input id="printer-name" type="text"
              placeholder="例如：XP-58 / 芯烨 58mm / EPSON TM-T82"
              value="${escapeAttr(savedPrinter)}" />
            <span class="hint">此名称会保存在浏览器本地，下次打开自动回填。</span>
          </div>

          <button id="save-printer" class="btn btn-primary">💾 保存打印机名称</button>
          <div id="save-status" class="status-bar"></div>
        </section>

        <!-- 测试项列表 (根据 tab 切换) -->
        ${renderTabContent()}
      </div>

      <!-- 右侧：预览 -->
      <div class="preview-wrap">
        ${renderPreview()}
      </div>
    </div>
  `;

  bindEvents();
}

// ---------------------------------------------------------
// Tab 内容 (左侧测试项列表)
// ---------------------------------------------------------
function renderTabContent() {
  if (activeTab === 'grain') {
    return `
      <section class="card">
        <h2>粮食小票测试项 <span class="badge">${grainSamples.length} 张</span></h2>
        <p class="hint" style="margin: -6px 0 12px;">
          字段结构与主项目 (EntryV1.vue / Exit.vue) 1:1 对齐。
          每类小票配「完整」和「缺省」两组数据, 验证排版与容错。
          二维码用 qrcode 库生成真实可扫 dataURL (payload 见每条说明)。
        </p>
        <div class="sample-list">
          ${grainSamples.map(renderSampleItem).join('')}
        </div>
      </section>
    `;
  }
  return `
    <section class="card">
      <h2>测试项 <span class="badge">${samples.length} 张</span></h2>
      <div class="sample-list">
        ${samples.map(renderSampleItem).join('')}
      </div>
    </section>
  `;
}

function renderSampleItem(s) {
  return `
    <div class="sample-item" data-id="${s.id}">
      <div class="info">
        <p class="name">
          ${s.name}
          <span class="tag ${s.tagClass}">${s.tag}</span>
        </p>
        <p class="desc">${s.desc || ''}</p>
      </div>
      <button class="btn use-btn" data-id="${s.id}">预览</button>
      <button class="btn btn-primary print-btn" data-id="${s.id}">打印</button>
    </div>`;
}

// ---------------------------------------------------------
// 右侧预览
// ---------------------------------------------------------
function renderPreview() {
  if (activeTab === 'grain') {
    const active = getActiveGrain();
    return `
      <section class="card">
        <h2>预览 <span class="badge">${active.name}</span></h2>
        <div class="preview-frame">
          <div class="preview-receipt-grain">${renderGrainHtml(active)}</div>
        </div>
        <div style="margin-top:12px; display:flex; gap:8px;">
          <button id="preview-print" class="btn btn-primary btn-block">
            🖨️ 打印当前预览项
          </button>
        </div>
        <p class="hint" style="margin-top:8px;">
          预览按 58mm 比例显示。实际打印效果以系统对话框中的预览为准。<br/>
          QR payload: <code>${escapeHtml(active.qrPayload)}</code>
        </p>
      </section>
    `;
  }
  const active = getActive();
  return `
    <section class="card">
      <h2>预览 <span class="badge">${active.name}</span></h2>
      <div class="preview-frame">
        <div class="preview-receipt">${active.render()}</div>
      </div>
      <div style="margin-top:12px; display:flex; gap:8px;">
        <button id="preview-print" class="btn btn-primary btn-block">
          🖨️ 打印当前预览项
        </button>
      </div>
      <p class="hint" style="margin-top:8px;">
        预览按 57mm 比例显示。实际打印效果以系统对话框中的预览为准。
      </p>
    </section>
  `;
}

// =========================================================
// 事件绑定
// =========================================================
function bindEvents() {
  // Tab 切换
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      render();
    });
  });

  // 预览 / 打印 (通用 + 粮食共用)
  document.querySelectorAll('.use-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (activeTab === 'grain') activeGrainId = btn.dataset.id;
      else activeSampleId = btn.dataset.id;
      render();
    });
  });
  document.querySelectorAll('.print-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (activeTab === 'grain') doGrainPrint(btn.dataset.id);
      else doPrint(btn.dataset.id);
    });
  });

  // 预览面板的打印
  const pp = document.getElementById('preview-print');
  if (pp) {
    pp.addEventListener('click', () => {
      if (activeTab === 'grain') doGrainPrint(activeGrainId);
      else doPrint(activeSampleId);
    });
  }

  // 保存打印机名
  const saveBtn = document.getElementById('save-printer');
  const input = document.getElementById('printer-name');
  const status = document.getElementById('save-status');
  saveBtn.addEventListener('click', () => {
    const val = input.value.trim();
    savedPrinter = val;
    localStorage.setItem(LS_PRINTER, val);
    status.textContent = '✓ 已保存：' + (val || '（空）');
    setTimeout(() => (status.textContent = ''), 3000);
  });
}

// =========================================================
// 通用小票打印流程
//  —— 把样例 HTML 注入 #print-mount（套 .receipt 打印样式），
//     再调用 window.print()，结束后清空。
// =========================================================
function doPrint(sampleId) {
  const sample = samples.find((s) => s.id === sampleId);
  if (!sample) return;

  const mount = document.getElementById('print-mount');
  mount.innerHTML = `<div class="receipt">${sample.render()}</div>`;

  const cleanup = () => {
    mount.innerHTML = '';
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  requestAnimationFrame(() => {
    window.print();
  });
}

// =========================================================
// 粮食小票打印流程
//  —— 1) 用 qrcode 把 payload 生成 dataURL;
//     2) 用对应模板渲染, 套 .grain-receipt 打印样式注入 #print-mount;
//     3) window.print(), 结束后清空。
// =========================================================
async function doGrainPrint(sampleId) {
  const sample = grainSamples.find((s) => s.id === sampleId);
  if (!sample) return;

  // 生成 QR dataURL (与主项目 QRCode.toDataURL 参数一致: width 240, margin 0, level M)
  let qrUrl = '';
  try {
    qrUrl = await QRCode.toDataURL(sample.qrPayload, {
      width: 240,
      margin: 0,
      errorCorrectionLevel: 'M',
    });
    grainQrCache[sampleId] = qrUrl;
  } catch (e) {
    console.warn('[Grain] QR 生成失败:', e);
  }

  const html = renderGrainHtml(sample, qrUrl);
  const mount = document.getElementById('print-mount');
  mount.innerHTML = `<div class="grain-receipt">${html}</div>`;

  const cleanup = () => {
    mount.innerHTML = '';
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  requestAnimationFrame(() => {
    window.print();
  });
}

// 渲染粮食小票 HTML (预览/打印共用)
// qrUrl 优先用传入的, 否则用缓存, 否则空 (显示 QR 占位)
function renderGrainHtml(sample, qrUrl) {
  const renderer = GRAIN_RENDERERS[sample.type];
  const qr = qrUrl || grainQrCache[sample.id] || sample.qrUrl || '';
  return renderer(sample.entry, {
    factoryName: sample.factory,
    displayFull: sample.displayFull,
    displayTime: sample.displayTime,
    displayTruckNo: sample.displayTruckNo,
    qrUrl: qr,
  });
}

// =========================================================
// 工具
// =========================================================
function getActive() {
  return samples.find((s) => s.id === activeSampleId);
}
function getActiveGrain() {
  return grainSamples.find((s) => s.id === activeGrainId);
}
function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
