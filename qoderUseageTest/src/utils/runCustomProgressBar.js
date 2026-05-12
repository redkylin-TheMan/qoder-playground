/**
 * 自定义进度条模拟器
 * 在指定容器中创建一个模拟加载进度条，分阶段执行动画，
 * 最终等待用户按回车键完成。
 *
 * @param {HTMLElement} container - 进度条要挂载到的 DOM 容器元素
 * @returns {{ start: Function, destroy: Function }}
 *   - start(): 开始运行动画
 *   - destroy(): 清理 DOM 和事件监听
 */
export function createProgressBar(container) {
  if (!container || !(container instanceof HTMLElement)) {
    console.error("createProgressBar: 需要传入有效的 DOM 容器元素");
    return { start: () => {}, destroy: () => {} };
  }

  const totalWidth = 30;
  let currentPercent = 0;
  let animationId = null;
  let keyHandler = null;
  let bar = null;
  let destroyed = false;

  // 创建进度条 DOM
  bar = document.createElement("div");
  bar.style.fontFamily = "monospace";
  bar.style.whiteSpace = "pre";
  bar.style.padding = "10px";
  bar.style.border = "1px solid #ccc";
  bar.style.borderRadius = "5px";
  bar.style.backgroundColor = "#f0f0f0";
  bar.style.marginTop = "12px";
  container.appendChild(bar);

  // 绘制进度条
  const draw = (percent) => {
    if (destroyed || !bar) return;
    const filledLength = Math.floor((percent / 100) * totalWidth);
    const emptyLength = totalWidth - filledLength;
    const barStr = `[${"█".repeat(filledLength)}${"░".repeat(emptyLength)}] ${percent}%`;
    bar.innerText = barStr;
  };

  // 动画核心：从 currentPercent 到 targetPercent，在 durationMs 内完成
  const animate = (targetPercent, durationMs, callback) => {
    if (destroyed) return;
    const startTime = performance.now();
    const startPercent = currentPercent;

    function step(currentTime) {
      if (destroyed) return;

      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const diff = targetPercent - startPercent;
      currentPercent = Math.floor(startPercent + diff * progress);

      if (currentPercent > targetPercent) {
        currentPercent = targetPercent;
      }

      draw(currentPercent);

      if (progress < 1) {
        animationId = requestAnimationFrame(step);
      } else {
        if (callback && !destroyed) callback();
      }
    }

    animationId = requestAnimationFrame(step);
  };

  // 开始动画
  const start = () => {
    if (destroyed || !bar) return;
    currentPercent = 0;
    draw(0);

    // 阶段1: 0% -> 30% (3秒)
    animate(30, 3000, () => {
      // 阶段2: 30% -> 50% (6秒)
      animate(50, 6000, () => {
        // 阶段3: 50% -> 99% (2秒)
        animate(99, 2000, () => {
          if (destroyed || !bar) return;
          // 阶段4: 等待回车
          bar.innerText += "\n\n按下 [回车键] 完成加载...";

          keyHandler = (e) => {
            if (e.key === "Enter") {
              currentPercent = 100;
              draw(100);
              bar.innerText += "\n完成!";
              document.removeEventListener("keydown", keyHandler);
              keyHandler = null;
            }
          };
          document.addEventListener("keydown", keyHandler);
        });
      });
    });
  };

  // 销毁：清理动画、事件和 DOM
  const destroy = () => {
    destroyed = true;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    if (keyHandler) {
      document.removeEventListener("keydown", keyHandler);
      keyHandler = null;
    }
    if (bar && bar.parentNode) {
      bar.parentNode.removeChild(bar);
      bar = null;
    }
  };

  return { start, destroy };
}
