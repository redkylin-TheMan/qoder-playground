import './styles/main.css';
import './styles/print.css';
import { samples } from './receipts.js';

// =========================================================
// localStorage 键
// =========================================================
const LS_PRINTER = 'm32_printer_name';

// =========================================================
// 状态
// =========================================================
let activeSampleId = samples[0].id;
let savedPrinter = localStorage.getItem(LS_PRINTER) || '';

// =========================================================
// 入口
// =========================================================
const app = document.getElementById('app');
render();

// =========================================================
// 渲染整个界面
// =========================================================
function render() {
  const active = getActive();

  app.innerHTML = `
    <header class="app-header">
      <h1>🖨️ m32_print_test</h1>
      <p class="subtitle">57mm 宽 · 长度可变 · 热敏小票打印测试工具</p>
    </header>

    <div class="layout">
      <!-- 左侧：设置 + 测试项 -->
      <div>
        <!-- 打印机设置 -->
        <section class="card">
          <h2>打印机设置 <span class="badge">57mm</span></h2>

          <div class="printer-note">
            ⚠️ 浏览器无法直接枚举/指定系统打印机。点击「打印」会唤起
            <b>系统打印对话框</b>，请在其中选择你的 57mm 热敏小票打印机，
            并将纸张设为 <b>57mm 宽 / 长度自动</b>。下方填写的名称仅用于本地记忆。
          </div>

          <div class="field">
            <label for="printer-name">打印机名称（仅本地记录，便于识别）</label>
            <input id="printer-name" type="text"
              placeholder="例如：XP-58 / 芯烨 57mm / EPSON TM-T82"
              value="${escapeAttr(savedPrinter)}" />
            <span class="hint">此名称会保存在浏览器本地，下次打开自动回填。</span>
          </div>

          <button id="save-printer" class="btn btn-primary">💾 保存打印机名称</button>
          <div id="save-status" class="status-bar"></div>
        </section>

        <!-- 测试项列表 -->
        <section class="card">
          <h2>测试项 <span class="badge">${samples.length} 张</span></h2>
          <div class="sample-list">
            ${samples
              .map(
                (s) => `
              <div class="sample-item" data-id="${s.id}">
                <div class="info">
                  <p class="name">
                    ${s.name}
                    <span class="tag ${s.tagClass}">${s.tag}</span>
                  </p>
                  <p class="desc">${s.desc}</p>
                </div>
                <button class="btn use-btn" data-id="${s.id}">预览</button>
                <button class="btn btn-primary print-btn" data-id="${s.id}">打印</button>
              </div>`
              )
              .join('')}
          </div>
        </section>
      </div>

      <!-- 右侧：预览 -->
      <div class="preview-wrap">
        <section class="card">
          <h2>预览 <span class="badge">${active.name}</span></h2>
          <div class="preview-frame">
            ${
              active
                ? `<div class="preview-receipt">${active.render()}</div>`
                : `<div class="preview-empty">请在左侧选择一个测试项查看预览</div>`
            }
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
      </div>
    </div>
  `;

  bindEvents();
}

// =========================================================
// 事件绑定
// =========================================================
function bindEvents() {
  // 预览某项
  document.querySelectorAll('.use-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeSampleId = btn.dataset.id;
      // 只刷新右侧预览卡片即可，但为简单起见整体重渲
      render();
    });
  });

  // 列表里的打印
  document.querySelectorAll('.print-btn').forEach((btn) => {
    btn.addEventListener('click', () => doPrint(btn.dataset.id));
  });

  // 预览面板的打印
  const pp = document.getElementById('preview-print');
  if (pp) pp.addEventListener('click', () => doPrint(activeSampleId));

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
// 打印流程
//  —— 把样例 HTML 注入 #print-mount（套 .receipt 打印样式），
//     再调用 window.print()，结束后清空。
// =========================================================
function doPrint(sampleId) {
  const sample = samples.find((s) => s.id === sampleId);
  if (!sample) return;

  const mount = document.getElementById('print-mount');
  // 套 .receipt 类触发 print.css 中的 57mm 样式
  mount.innerHTML = `<div class="receipt">${sample.render()}</div>`;

  // 打印结束后清理挂载点
  const cleanup = () => {
    mount.innerHTML = '';
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  // 留一帧让 DOM 更新生效
  requestAnimationFrame(() => {
    window.print();
  });
}

// =========================================================
// 工具
// =========================================================
function getActive() {
  return samples.find((s) => s.id === activeSampleId);
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
