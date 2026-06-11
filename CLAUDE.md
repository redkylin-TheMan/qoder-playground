# 项目工作区概览

> **⚠️ 重要原则：这是一个"杂货铺"式的工作区，各种项目、测试、工具都会往里塞。子目录之间完全独立，没有关联。**
>
> **处理任务时必须遵守：只查看和处理用户明确指定的目录或文件，绝对不要去翻看用户没有提到的其他子项目。**

## 工作区结构

## 工作区结构

| 子项目 | 技术栈 | 说明 |
|--------|--------|------|
| `beizhongying-fullstack/` | Vue 3 + Vite + Express + MySQL | **杯中影咖啡文化网站** — 全栈项目（毕设），含前后端完整代码 |
| `杯中影网站2333李瑞麟/` | HTML + Bootstrap 5 | 杯中影网站的静态原型版本 |
| `jinglun/` | Python 32-bit + ctypes + HTTP Server | 精伦 iDR210 读卡器浏览器集成服务 |
| `HIKVSION_Test/` | C++/C# SDK + Web SDK | 海康威视摄像头插件开发测试 |
| `pythonTest/` | Python + python-docx | Word 文档转 Markdown 工具（支持 GUI） |
| `qoderUseageTest/` | Node.js + Playwright + ECharts | Qoder 平台用量数据自动采集与可视化 |
| `加压设备测试页面/` | HTML + CSS + JavaScript | 加压设备健康评估与训练交互页面 |
| `对比可视化/` | — | 占位目录，尚未启用 |
| `我的脚本库/` | PowerShell | 开发辅助脚本（端口管理、进程查看等） |
| `ClaudeGLM测试/` | — | Claude GLM 测试相关 |

## 核心项目详情

### beizhongying-fullstack（主要全栈项目）

- **前端**：Vue 3 + Vite + Bootstrap 5.3 + Pinia + Vue Router，位于 `client/`
- **后端**：Node.js + Express + Sequelize ORM，位于 `server/`
- **数据库**：MySQL 8.0，共 6 张表
- **认证**：JWT + bcryptjs
- **默认账号**：admin / admin123456，testuser / test123456
- **主要功能**：用户认证、咖啡信息 CRUD、咖啡论坛（帖子/评论）、点赞系统、内容推荐、管理后台

### jinglun（读卡器集成）

- **运行要求**：必须使用 32 位 Python
- **启动方式**：`start.bat` 或手动运行 `backend/server.py`
- **本地服务**：`http://127.0.0.1:8765`
- **支持卡片类型**：身份证、居住证、港澳台通行证、NFC/IC 卡

## 开发约定

- **语言**：项目文档和注释以中文为主
- **编码**：UTF-8
- **包管理**：Node.js 项目使用 npm（`package-lock.json` 为锁文件）
- **Python 环境**：pythonTest 使用 `.venv` 虚拟环境
- **日志**：日志文件 `.log` 已被 `.gitignore` 忽略
- **Git 忽略**：`node_modules/`、`*.log` 已配置忽略

## 常用命令

```bash
# beizhongying-fullstack
cd beizhongying-fullstack
npm install                        # 安装依赖（需分别在 client/ 和 server/ 执行）
cd server && npm run dev           # 启动后端服务
cd client && npm run dev           # 启动前端开发服务器

# qoderUseageTest
cd qoderUseageTest
npm install
npm run fetch:data                 # 自动采集用量数据

# pythonTest
cd pythonTest
python doc_to_md.py <input> <output>   # 命令行转 Markdown
python doc_to_md_ui.py                  # 启动 GUI 界面
```

## 工作区根目录文件

- `安徽事业部权限列表.json`、`江西事业部权限列表.json`、`权限列表.json` — 各事业部的系统权限配置
- `日志文件.log`、`错误信息.log` — 运行日志（已被 git 忽略）

## 注意事项

- `jinglun/` 项目需要 32 位 Python 环境，64 位无法加载 SDK DLL
- `HIKVSION_Test/` 包含海康威视厂商 SDK，注意许可证合规
- `beizhongying-fullstack/` 需要本地 MySQL 8.0 服务运行
- `pythonTest/` 的 `.doc` 格式转换依赖 LibreOffice 或 MS Word COM 接口
