# GLM 漫画翻译器

本地漫画翻译服务：上传漫画图片 → OCR 识别文字（含坐标） → GLM 翻译 → 保存为文本文件。

## 功能

- **单张翻译**：拖拽/点击上传一张图片，OCR + 翻译
- **批量上传**：多选多张图片，逐张 OCR + 翻译，结果列表展示
- **文件夹翻译**：输入本地文件夹路径，自动扫描图片，结果输出到 `translated/` 子目录
- 支持中日韩英法德俄等 20+ 种语言
- 保留每段文字在图片中的坐标位置（为后续"擦除+填充"功能预留）

## 技术栈

| 组件 | 技术 |
|------|------|
| 后端 | Python 3.8+ / Flask |
| 前端 | HTML + Bootstrap 5 + Vanilla JS |
| OCR | 智谱 GLM OCR 工具接口 (`/v4/files/ocr`) |
| 翻译 | 智谱 GLM-4-Flash 免费模型 (`glm-4-flash`) |
| SDK | `zai-sdk` (智谱官方 Python SDK) |

## 前期准备

### 1. Python 环境

本项目使用 **Python 3.8 及以上版本**，不需要 Node.js。

检查是否已安装 Python：

```bash
python --version
# 需要 Python 3.8+，例如输出：Python 3.12.0
```

如果没有安装 Python：
- 下载地址：https://www.python.org/downloads/
- Windows 安装时**务必勾选 "Add Python to PATH"**

### 2. 智谱 API Key

1. 注册智谱开放平台账号：https://open.bigmodel.cn/
2. 进入控制台 → API Keys 页面 → 创建 API Key
3. 复制 Key（格式类似 `xxxxxxxxxxxx.xxxxxxxxxxxx`）

### 3. 不需要安装 Node.js

本项目是纯 Python + HTML/JS 项目，**不需要 Node.js**。前端使用 CDN 加载 Bootstrap，无需 npm 构建。

## 安装与启动

### 方式一：一键启动（Windows）

1. 克隆项目并进入目录：

```bash
git clone <仓库地址>
cd Glm漫画翻译器
```

2. 编辑 `.env` 文件，填入你的 API Key：

```
GLM_API_KEY=你的API_Key
HOST=127.0.0.1
PORT=5000
```

3. 首次运行需要安装依赖：

```bash
pip install -r requirements.txt
```

4. 双击 `start.bat` 启动服务

5. 浏览器打开 http://127.0.0.1:5000

### 方式二：手动启动（所有平台）

```bash
# 1. 进入项目目录
cd Glm漫画翻译器

# 2. （可选）创建虚拟环境
python -m venv venv

# Windows 激活虚拟环境：
venv\Scripts\activate

# Linux/Mac 激活虚拟环境：
# source venv/bin/activate

# 3. 安装依赖
pip install -r requirements.txt

# 4. 配置 API Key（如果 .env 不存在）
# 创建 .env 文件，内容如下：
# GLM_API_KEY=你的API_Key
# HOST=127.0.0.1
# PORT=5000

# 5. 启动服务
python app.py

# 6. 浏览器访问
# http://127.0.0.1:5000
```

## 依赖说明

`requirements.txt` 包含以下依赖：

| 包名 | 用途 |
|------|------|
| `flask` | Web 服务器框架 |
| `zai-sdk` | 智谱官方 Python SDK（调用 OCR + 翻译 API） |
| `python-dotenv` | 从 .env 文件读取配置 |

## 项目结构

```
Glm漫画翻译器/
├── .env                         # API Key 配置（不提交 Git）
├── .gitignore                   # Git 忽略规则
├── requirements.txt             # Python 依赖
├── start.bat                    # Windows 一键启动脚本
├── config.py                    # 配置管理
├── app.py                       # Flask 主应用
├── services/
│   ├── __init__.py
│   ├── ocr_service.py           # OCR 识别服务
│   └── translate_service.py     # 翻译服务
├── templates/
│   └── index.html               # 前端页面
├── static/
│   ├── css/style.css            # 样式
│   └── js/app.js                # 前端逻辑
├── uploads/                     # 上传临时目录
└── outputs/                     # 翻译结果输出目录
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/translate` | 单张图片翻译（multipart: image + source_lang + target_lang） |
| `POST` | `/api/batch-translate` | 批量图片翻译（multipart: images[] + source_lang + target_lang） |
| `POST` | `/api/folder-translate` | 文件夹翻译（JSON: folder_path + source_lang + target_lang） |
| `POST` | `/api/save` | 保存翻译结果到本地文件 |
| `GET` | `/api/languages` | 获取支持的语言列表 |

## 费用

| 功能 | 模型/API | 价格 |
|------|----------|------|
| OCR 识别 | `/v4/files/ocr` | 0.01 元/次 |
| 文本翻译 | `glm-4-flash` | **免费** |
| **合计** | — | **约 1 分钱/张** |

## 常见问题

### Q: 启动报错 `ModuleNotFoundError: No module named 'flask'`

依赖未安装，执行：
```bash
pip install -r requirements.txt
```

### Q: 启动报错 `UnicodeEncodeError: 'gbk' codec can't encode`

Windows 控制台编码问题，使用 `start.bat` 启动，或手动执行：
```bash
chcp 65001
python app.py
```

### Q: 翻译返回 "OCR 识别失败"

1. 检查 `.env` 中的 `GLM_API_KEY` 是否正确
2. 检查网络是否能访问 `open.bigmodel.cn`
3. 确认 API Key 余额是否充足（OCR 0.01元/次）

### Q: 图片上传后没反应

`Ctrl+F5` 强制刷新页面清除缓存后重试。

## 参考链接

- [智谱 AI 开放文档](https://docs.bigmodel.cn/cn/api/introduction)
- [OCR 工具服务文档](https://docs.bigmodel.cn/cn/guide/tools/zhipu-ocr)
- [GLM-4-Flash 免费模型](https://docs.bigmodel.cn/cn/guide/models/free/glm-4-flash-250414)
- [官方 Python SDK](https://docs.bigmodel.cn/cn/guide/develop/python/introduction)
