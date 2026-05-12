function runCustomProgressBar() {
  const totalWidth = 30; // 进度条的字符长度
  let currentPercent = 0;

  // 进度条容器
  const bar = document.createElement("div");
  bar.style.fontFamily = "monospace";
  bar.style.whiteSpace = "pre";
  bar.style.padding = "10px";
  bar.style.border = "1px solid #ccc";
  bar.style.borderRadius = "5px";
  bar.style.backgroundColor = "#f0f0f0";
  document.body.appendChild(bar);

  // 绘制进度条的辅助函数
  const draw = (percent) => {
    const filledLength = Math.floor((percent / 100) * totalWidth);
    const emptyLength = totalWidth - filledLength;
    const barStr = `[${"█".repeat(filledLength)}${"░".repeat(emptyLength)}] ${percent}%`;
    bar.innerText = barStr;
    console.log(barStr); // 同时在控制台输出
  };

  // 动画核心逻辑
  const animate = (targetPercent, durationMs, callback) => {
    const startTime = performance.now();

    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / durationMs, 1); // 0 到 1 的进度

      // 计算当前的百分比
      const startPercent = currentPercent;
      const diff = targetPercent - startPercent;
      currentPercent = Math.floor(startPercent + diff * progress);

      // 确保不会超过目标值
      if (currentPercent > targetPercent) currentPercent = targetPercent;

      draw(currentPercent);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        if (callback) callback();
      }
    }
    requestAnimationFrame(step);
  };

  // --- 流程控制 ---

  // 1. 第一阶段：0% -> 30% (3秒)
  animate(30, 3000, () => {
    // 2. 第二阶段：30% -> 50% (6秒)
    animate(50, 6000, () => {
      // 3. 第三阶段：50% -> 99% (2秒)
      animate(99, 2000, () => {
        // 4. 第四阶段：等待回车
        bar.innerText += "\n\n👉 按下 [回车键] 完成加载...";
        console.log("👉 等待回车...");

        const keyHandler = (e) => {
          if (e.key === "Enter") {
            currentPercent = 100;
            draw(100);
            bar.innerText += "\n✅ 完成！";
            document.removeEventListener("keydown", keyHandler);
          }
        };
        document.addEventListener("keydown", keyHandler);
      });
    });
  });
}

// 运行函数
runCustomProgressBar();
