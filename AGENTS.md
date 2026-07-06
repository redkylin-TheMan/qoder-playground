# AGENTS.md

> **本工作区是"杂货铺"式 playground，子目录之间完全独立、互不关联。**
> 详细目录清单见根目录 `CLAUDE.md`。

## 最高优先级原则 ⚠️

**只查看和处理用户明确指定的目录或文件。绝对不要翻看、修改、重构用户没有提到的其他子项目。**

- 即便任务看起来"顺手"能优化别的子目录，也不要做。
- 全局搜索 / `grep -r` 跨整个工作区会污染上下文，应限定在用户指定的子目录内。
- 跨子项目共享的依赖、配置、风格并不存在——每个子目录都是独立项目，有自己的 `package.json` / `requirements.txt` / 技术栈。

## 主要子项目速查

| 子目录 | 技术栈 | 关键点 |
|--------|--------|--------|
| `beizhongying-fullstack/` | Vue3+Vite / Node+Express+Sequelize / MySQL8 | 全栈毕设；前端在 `client/`，后端在 `server/`，**需本地 MySQL 8** |
| `jinglun/` | Python 32-bit + ctypes + HTTP Server | 读卡器集成；**必须用 32 位 Python**，64 位无法加载 SDK DLL；`start.bat` 启动，`http://127.0.0.1:8765` |
| `pythonTest/` | Python + python-docx | Word→Markdown；用 `.venv`；`.doc` 需 LibreOffice/Word COM |
| `qoderUseageTest/` | Node + Playwright + ECharts | `npm run fetch:data` 采集用量数据 |
| `dprinter-web/` | Node（无前端框架） | 得力针打网页测试台；`npm start` 起 `server.js`，发 ESC/P-K 原始指令 |
| `m32_print_test/` `58mmPrintTest/` | Vite + 原生 JS | 58mm 热敏小票打印测试 |
| `农资出库单表格/` | Vue3 + Ant Design Vue + TDesign | Vite；`npm run dev` |
| `农资出库单表格-vue2/` | **Vue2** + ant-design-vue@1.7.8 | vue-cli（**不是 Vite**）；`npm run serve --port 3120` |
| `tdesign单元测试/` | Vue3 + TDesign | Vite |
| `oss-upload-test/` | Node + ali-oss + Jest | `npm test`；需自建 `oss.config.js`（模板见 `oss.config.example.js`） |
| `Glm漫画翻译器/` | Flask + zai-sdk | `start.bat` 或 `python app.py` |
| `地磅(1)/` | Java + Web-Serial + 预编译 exe | 串口地磅数据采集 |

## 通用约定

- **语言**：文档与注释以**中文**为主，回复用户也用中文。
- **编码**：UTF-8（Windows 下编辑注意保留 BOM 仅当原文件已有）。
- **Node 项目**：用 **npm**（`农资出库单表格`、`oss-upload-test` 等以 `package-lock.json` 为准）；`oss-upload-test` 用了 pnpm-lock，但脚本仍走 npm。
- **Python 项目**：`pythonTest` 用 `.venv`；`jinglun` 必须 **32 位**解释器。
- **Vue 版本敏感**：先看清是 Vue 2（`农资出库单表格-vue2`，vue-cli + Options API + `serve` 脚本）还是 Vue 3（其余，Vite + Composition/`<script setup>`），不要混用 API 与构建工具。

## Git / .gitignore 要点

- 已忽略：`*.log`、`**/node_modules`、`**/dist`、`jinglun/backend/__pycache__/`、烘干厂发布包 zip 与 `backend.zip`。
- `日志文件.log`、`错误信息.log` 等运行日志不要提交。
- 提交信息以中文为主（见 git log）。

## 常用命令（按子项目执行）

```bash
# beizhongying-fullstack（client/ 和 server/ 分别 install）
cd beizhongying-fullstack/client && npm install && npm run dev
cd beizhongying-fullstack/server && npm install && npm run dev

# qoderUseageTest
npm run fetch:data      # 采集；npm run dev 看可视化

# pythonTest
python doc_to_md.py <in> <out>     # CLI
python doc_to_md_ui.py             # GUI

# dprinter-web
npm start              # node server.js
npm run check          # 打印指令 demo
```

## 易踩坑

- **跨子项目统一 lint/格式化配置不存在**——别在工作区根目录加 ESLint/Prettier 配置，会误伤其他子项目。
- `jinglun/` 的 64 位环境会静默加载 DLL 失败，报错位置远离根因。
- `beizhongying-fullstack` 改动前确认 MySQL 已起；默认账号 `admin/admin123456`。
- `烘干厂测试脚本库/`、`allToMarkdown/`、`script/`、`对比可视化/` 多为一次性脚本/占位目录，改动前先问用户。
