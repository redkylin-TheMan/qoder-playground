// OSS 配置 —— 把这里换成你自己的值，或复制为 oss.config.js 后填写
// 注意：oss.config.js 已加入 .gitignore，不会提交
module.exports = {
  // 地域，例如 'oss-cn-hangzhou'、'oss-cn-shanghai'
  region: "oss-cn-xxxxx",
  // 你的 AccessKey
  accessKeyId: "你的AccessKeyId",
  accessKeySecret: "你的AccessKeySecret",
  // Bucket 名称
  bucket: "你的bucket名称",
  // 可选：如果 endpoint 是自定义/加速域名（如 'https://oss-cn-xxx.aliyuncs.com'）可填写，否则留空
  endpoint: "",
  // 可选：是否走内网（ECS 同 region 上传可设 true，更快更省钱）
  internal: false,
  // 可选：是否使用 https
  secure: true,
};
