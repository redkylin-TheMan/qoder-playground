// 手动清理测试上传的文件
// 用法: node cleanup.js
const OSS = require("ali-oss");
let cfg;
try {
  cfg = require("./oss.config.js");
} catch (e) {
  throw new Error("未找到 oss.config.js，无法清理。");
}
const client = new OSS({
  region: cfg.region,
  accessKeyId: cfg.accessKeyId,
  accessKeySecret: cfg.accessKeySecret,
  bucket: cfg.bucket,
  endpoint: cfg.endpoint || undefined,
  internal: cfg.internal || false,
  secure: cfg.secure !== false,
});

(async () => {
  const key = "__oss_test__/jest-image.png";
  try {
    const r = await client.delete(key);
    console.log("已删除:", key, "status:", r.res.status);
  } catch (e) {
    console.error("删除失败:", e.message);
  }
})();
