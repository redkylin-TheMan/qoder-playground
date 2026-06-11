"""配置管理 — 从 .env 读取 API Key 等配置"""
import os
from dotenv import load_dotenv

load_dotenv()

# API 配置
GLM_API_KEY = os.getenv("GLM_API_KEY")
GLM_BASE_URL = "https://open.bigmodel.cn/api/paas/v4"

# 模型配置
OCR_TOOL_TYPE = "hand_write"
TRANSLATE_MODEL = "glm-4-flash"

# 文件限制
MAX_FILE_SIZE = 8 * 1024 * 1024  # 8MB（OCR API 限制）
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "bmp"}

# 服务器配置
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", 5000))

# 支持的源语言（用于 OCR 识别）
SUPPORTED_LANGUAGES = {
    "auto": {"label": "自动检测", "ocr_code": "AUTO"},
    "ja": {"label": "日语", "ocr_code": "JAP"},
    "ko": {"label": "韩语", "ocr_code": "KOR"},
    "en": {"label": "英语", "ocr_code": "ENG"},
    "zh": {"label": "中文", "ocr_code": "CHN_ENG"},
    "fr": {"label": "法语", "ocr_code": "FRE"},
    "es": {"label": "西班牙语", "ocr_code": "SPA"},
    "de": {"label": "德语", "ocr_code": "GER"},
    "ru": {"label": "俄语", "ocr_code": "RUS"},
}

# 目标翻译语言
TARGET_LANGUAGES = {
    "zh": "中文",
    "en": "英语",
    "ja": "日语",
    "ko": "韩语",
    "fr": "法语",
    "es": "西班牙语",
    "de": "德语",
    "ru": "俄语",
}
