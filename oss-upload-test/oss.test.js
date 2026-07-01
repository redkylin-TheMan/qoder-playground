const OSS = require("ali-oss");
const fs = require("fs");
const path = require("path");

// 读取配置：优先用同目录下的 oss.config.js
let cfg;
try {
  cfg = require("./oss.config.js");
} catch (e) {
  throw new Error(
    "未找到 oss.config.js。请复制 oss.config.example.js 为 oss.config.js 并填写你的 OSS 配置。",
  );
}

const client = new OSS({
  region: cfg.region,
  accessKeyId: cfg.accessKeyId,
  accessKeySecret: cfg.accessKeySecret,
  bucket: cfg.bucket,
  endpoint: cfg.endpoint || undefined,
  internal: cfg.internal || false,
  secure: cfg.secure !== false, // 默认 true
});

// 固定路径：跑完不删除，方便你直接在浏览器打开验证
// 你的 bucket 是 lyzltest，最终可访问地址会类似：
//   https://lyzltest.oss-cn-beijing.aliyuncs.com/__oss_test__/jest-image.png
const TEST_KEY = "__oss_test__/jest-image.png";

// 取要上传的图片：
//   1) 优先用本地 ./sample.png（推荐，你自己放一张图进来，看得最直观）
//   2) 没放图就用内置的 1x1 红色 PNG 兜底（浏览器里是个小点，但能验证链路通）
function loadImageBuffer() {
  const local = path.join(__dirname, "sample.png");
  if (fs.existsSync(local)) {
    console.log("使用本地图片: sample.png");
    return fs.readFileSync(local);
  }
  console.log(
    "未找到 sample.png，使用内置 1x1 测试图（建议放一张本地图看得更清楚）",
  );
  // 1x1 红色 PNG
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
    "base64",
  );
}

// ⚠️ 注意：这里故意【没有】afterAll 删除。
//    上一版测试通过却访问 404，就是因为 afterAll 把文件删了。
//    想清理的话，跑完手动执行: node cleanup.js

describe("阿里云 OSS 图片上传测试（保留文件，便于浏览器验证）", () => {
  test("配置项齐全", () => {
    expect(cfg.region).toBeTruthy();
    expect(cfg.accessKeyId).toBeTruthy();
    expect(cfg.accessKeySecret).toBeTruthy();
    expect(cfg.bucket).toBeTruthy();
  });

  test("上传图片 (put, Content-Type=image/png)", async () => {
    const buf = loadImageBuffer();
    const result = await client.put(TEST_KEY, buf, {
      mime: "image/png",
      headers: { "Content-Type": "image/png" },
    });
    expect(result.res.status).toBe(200);
    expect(result.name).toBe(TEST_KEY);
    console.log("\n✅ 上传成功，浏览器直接访问下面这个 URL 即可看到图片:");
    console.log("   " + result.url + "\n");
  });

  test("下载回来内容一致 (get)", async () => {
    const uploaded = loadImageBuffer();
    const result = await client.get(TEST_KEY);
    expect(result.res.status).toBe(200);
    // 把下载回来的图片写到本地，你可以打开 downloaded.png 对比
    fs.writeFileSync(path.join(__dirname, "downloaded.png"), result.content);
    expect(result.content.equals(uploaded)).toBe(true);
    console.log("✅ 下载内容与上传一致，已存为 downloaded.png");
  });
});
