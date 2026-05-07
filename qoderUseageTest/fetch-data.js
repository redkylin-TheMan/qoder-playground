const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

// 配置文件
const CONFIG = {
  // Qoder 使用情况页面
  usageUrl: "https://qoder.com/account/usage",
  // API 接口地址模板
  apiUrlTemplate:
    "https://qoder.com/api/v1/me/usages/big_model_credits/histories?page={page}&page_size=100&start_time={start_time}&end_time={end_time}&order_by=begin_at&order=-1",
  // 数据文件路径
  dataFilePath: path.join(__dirname, "public", "data.json"),
  // 每次请求的页面大小
  pageSize: 100,
  // 请求延迟（毫秒），避免请求过快
  requestDelay: 1000,
};

/**
 * 延迟函数
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 读取现有的数据文件
 */
function readExistingData() {
  try {
    if (fs.existsSync(CONFIG.dataFilePath)) {
      const content = fs.readFileSync(CONFIG.dataFilePath, "utf-8");
      return JSON.parse(content);
    }
  } catch (error) {
    console.error("读取现有数据文件失败:", error.message);
  }
  return [];
}

/**
 * 保存数据到文件
 */
function saveDataToFile(data) {
  try {
    const dir = path.dirname(CONFIG.dataFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      CONFIG.dataFilePath,
      JSON.stringify(data, null, 2),
      "utf-8",
    );
    console.log(`✓ 数据已保存到 ${CONFIG.dataFilePath}`);
    console.log(`  共保存 ${data.length} 条记录`);
  } catch (error) {
    console.error("保存数据文件失败:", error.message);
    throw error;
  }
}

/**
 * 根据时间戳去重和合并数据
 */
function mergeData(existingData, newData) {
  // 使用 Map 以 time 为键进行去重
  const dataMap = new Map();

  // 先添加现有数据
  existingData.forEach((item) => {
    dataMap.set(item.time, item);
  });

  // 再添加新数据（新数据会覆盖相同 time 的旧数据）
  newData.forEach((item) => {
    dataMap.set(item.time, item);
  });

  // 转换为数组并按时间倒序排序
  return Array.from(dataMap.values()).sort((a, b) => b.time - a.time);
}

/**
 * 计算时间范围（默认获取近30天的数据）
 */
function calculateTimeRange() {
  const endTime = Date.now();
  const startTime = endTime - 30 * 24 * 60 * 60 * 1000; // 30天前
  return { startTime, endTime };
}

/**
 * 从 API 获取所有页面的数据
 */
async function fetchAllData(page) {
  const { startTime, endTime } = calculateTimeRange();
  let allData = [];
  let currentPage = 1;
  let hasMore = true;

  console.log("\n开始获取数据...");
  console.log(
    `时间范围: ${new Date(startTime).toLocaleString()} - ${new Date(endTime).toLocaleString()}`,
  );

  while (hasMore) {
    const apiUrl = CONFIG.apiUrlTemplate
      .replace("{page}", currentPage)
      .replace("{start_time}", startTime)
      .replace("{end_time}", endTime);

    console.log(`\n正在获取第 ${currentPage} 页数据...`);
    console.log(`URL: ${apiUrl}`);

    try {
      // 拦截 API 请求
      const responseData = await page.evaluate(async (url) => {
        const response = await fetch(url, {
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
      }, apiUrl);

      if (responseData && responseData.data) {
        const pageData = responseData.data;
        allData = allData.concat(pageData);
        console.log(
          `✓ 第 ${currentPage} 页获取成功，共 ${pageData.length} 条记录`,
        );

        // 检查是否还有更多数据
        if (responseData.page_result) {
          const { current_page, last_page } = responseData.page_result;
          console.log(`  进度: 第 ${current_page} 页 / 共 ${last_page} 页`);

          if (current_page >= last_page) {
            hasMore = false;
          } else {
            currentPage++;
          }
        } else {
          hasMore = false;
        }
      } else {
        console.log("✗ 未获取到有效数据");
        hasMore = false;
      }
    } catch (error) {
      console.error(`✗ 获取第 ${currentPage} 页数据失败:`, error.message);
      hasMore = false;
    }

    // 请求延迟
    if (hasMore) {
      await delay(CONFIG.requestDelay);
    }
  }

  return allData;
}

/**
 * 主函数
 */
async function main() {
  console.log("========================================");
  console.log("Qoder Credits 数据自动获取脚本");
  console.log("========================================");

  let browser;

  try {
    // 启动浏览器（使用系统安装的 Edge/Chrome）
    console.log("\n正在启动浏览器...");
    browser = await chromium.launch({
      headless: false, // 显示浏览器窗口，方便登录
      channel: "msedge", // 使用 Edge 浏览器
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    // 导航到使用情况页面
    console.log(`正在打开 ${CONFIG.usageUrl}...`);
    await page.goto(CONFIG.usageUrl, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    console.log("\n⚠️  请在浏览器中确保已登录并等待页面加载完成...");
    console.log("   加载完成后，按回车键继续...");

    // 等待用户确认
    await new Promise((resolve) => {
      process.stdin.once("data", () => {
        resolve();
      });
    });

    // 获取数据
    const newData = await fetchAllData(page);

    if (newData.length === 0) {
      console.log("\n✗ 未获取到新数据，脚本退出");
      return;
    }

    console.log(`\n✓ 成功获取 ${newData.length} 条新数据`);

    // 读取现有数据
    console.log("\n正在读取现有数据...");
    const existingData = readExistingData();
    console.log(`现有数据: ${existingData.length} 条记录`);

    // 合并数据（去重）
    console.log("\n正在合并和去重数据...");
    const mergedData = mergeData(existingData, newData);
    const addedCount = mergedData.length - existingData.length;
    console.log(`合并后数据: ${mergedData.length} 条记录`);
    console.log(`新增数据: ${addedCount} 条记录`);

    // 保存数据
    console.log("\n正在保存数据...");
    saveDataToFile(mergedData);

    console.log("\n========================================");
    console.log("✓ 数据获取和更新完成！");
    console.log("========================================");
  } catch (error) {
    console.error("\n✗ 脚本执行失败:", error.message);
    console.error(error.stack);
  } finally {
    if (browser) {
      await browser.close();
      console.log("\n浏览器已关闭");
    }
  }
}

// 运行脚本
main().catch(console.error);
