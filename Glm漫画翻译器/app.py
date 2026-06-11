"""GLM 漫画翻译器 — Flask 主应用"""
import os
import datetime

from flask import Flask, render_template, request, jsonify
from config import (
    HOST, PORT, MAX_FILE_SIZE, ALLOWED_EXTENSIONS,
    SUPPORTED_LANGUAGES, TARGET_LANGUAGES,
)
from services.ocr_service import OCRService
from services.translate_service import TranslateService

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 64 * 1024 * 1024  # 64MB，支持多张批量上传

ocr_service = OCRService()
translate_service = TranslateService()


def allowed_file(filename):
    """检查文件扩展名是否合法"""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# ========== 页面路由 ==========

@app.route("/")
def index():
    return render_template("index.html")


# ========== API 路由 ==========

@app.route("/api/languages", methods=["GET"])
def get_languages():
    """获取支持的语言列表"""
    return jsonify({
        "source_languages": SUPPORTED_LANGUAGES,
        "target_languages": TARGET_LANGUAGES,
    })


@app.route("/api/translate", methods=["POST"])
def translate_image():
    """
    主接口：接收图片 → OCR → 翻译 → 返回结果

    表单参数:
        image: 图片文件
        source_lang: 源语言代码 (ja/ko/en/zh/auto)
        target_lang: 目标语言代码 (zh/en/ja/ko/...)
    """
    # 1. 校验文件
    if "image" not in request.files:
        return jsonify({"success": False, "error": "请上传图片文件"}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"success": False, "error": "未选择文件"}), 400
    if not allowed_file(file.filename):
        return jsonify({"success": False, "error": "不支持的文件格式，请上传 PNG/JPG/JPEG/BMP"}), 400

    # 2. 获取语言参数
    source_lang_code = request.form.get("source_lang", "auto")
    target_lang_code = request.form.get("target_lang", "zh")

    source_lang_name = SUPPORTED_LANGUAGES.get(source_lang_code, {}).get("label", "自动检测")
    ocr_lang_code = SUPPORTED_LANGUAGES.get(source_lang_code, {}).get("ocr_code", "AUTO")
    target_lang_name = TARGET_LANGUAGES.get(target_lang_code, "中文")

    # 3. OCR 识别
    ocr_result = ocr_service.recognize(
        file_stream=file,
        language_type=ocr_lang_code,
        with_probability=True,
    )

    if not ocr_result["success"]:
        return jsonify({"success": False, "error": f"OCR 识别失败: {ocr_result['error']}"}), 500

    segments = ocr_result["segments"]
    if not segments:
        return jsonify({"success": False, "error": "未识别到文字，请确认图片中包含文字"}), 200

    # 4. 拼接原文
    ocr_raw_text = "\n".join([s["text"] for s in segments])

    # 5. 翻译
    translate_result = translate_service.translate(
        text=ocr_raw_text,
        source_lang=source_lang_name,
        target_lang=target_lang_name,
    )

    if not translate_result["success"]:
        return jsonify({"success": False, "error": f"翻译失败: {translate_result['error']}"}), 500

    # 6. 返回结果
    return jsonify({
        "success": True,
        "data": {
            "ocr_segments": segments,
            "ocr_raw_text": ocr_raw_text,
            "translated_text": translate_result["translated_text"],
            "source_lang": source_lang_name,
            "target_lang": target_lang_name,
        },
    })


@app.route("/api/save", methods=["POST"])
def save_result():
    """
    保存翻译结果到本地文件

    JSON 参数:
        filename: 文件名（不含扩展名）
        ocr_raw_text: OCR 原文
        translated_text: 翻译文本
        source_lang: 源语言
        target_lang: 目标语言
        segments: OCR 分段数据（含坐标）
    """
    data = request.json

    # 确保输出目录存在
    output_dir = os.path.join(os.path.dirname(__file__), "outputs")
    os.makedirs(output_dir, exist_ok=True)

    # 生成文件名
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    base_name = data.get("filename", "translation")
    safe_name = "".join(c for c in base_name if c.isalnum() or c in ("_", "-", ".")).strip()
    if not safe_name:
        safe_name = "translation"
    filename = f"{safe_name}_{timestamp}.txt"
    filepath = os.path.join(output_dir, filename)

    # 写入内容
    content_parts = [
        "=== 漫画翻译结果 ===",
        f"时间: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"源语言: {data.get('source_lang', '未知')}",
        f"目标语言: {data.get('target_lang', '未知')}",
        "",
        "=== 原文 ===",
        data.get("ocr_raw_text", ""),
        "",
        "=== 译文 ===",
        data.get("translated_text", ""),
        "",
        "=== 分段对照（含坐标） ===",
    ]

    for i, seg in enumerate(data.get("segments", []), 1):
        loc = seg.get("location", {})
        content_parts.append(
            f"【第{i}段】\n"
            f"  位置: left={loc.get('left', '?')}, top={loc.get('top', '?')}, "
            f"width={loc.get('width', '?')}, height={loc.get('height', '?')}\n"
            f"  原文: {seg.get('text', '')}"
        )

    content = "\n".join(content_parts)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

    return jsonify({"success": True, "filepath": filepath, "filename": filename})


@app.route("/api/batch-translate", methods=["POST"])
def batch_translate():
    """
    批量翻译：接收多张图片 → 逐张 OCR + 翻译 → 返回所有结果

    表单参数:
        images: 多个图片文件
        source_lang: 源语言代码
        target_lang: 目标语言代码
    """
    files = request.files.getlist("images")
    if not files or all(f.filename == "" for f in files):
        return jsonify({"success": False, "error": "请上传至少一张图片"}), 400

    source_lang_code = request.form.get("source_lang", "auto")
    target_lang_code = request.form.get("target_lang", "zh")

    source_lang_name = SUPPORTED_LANGUAGES.get(source_lang_code, {}).get("label", "自动检测")
    ocr_lang_code = SUPPORTED_LANGUAGES.get(source_lang_code, {}).get("ocr_code", "AUTO")
    target_lang_name = TARGET_LANGUAGES.get(target_lang_code, "中文")

    results = []
    for i, file in enumerate(files):
        if file.filename == "" or not allowed_file(file.filename):
            results.append({
                "filename": file.filename or f"file_{i}",
                "success": False,
                "error": "文件格式不支持",
            })
            continue

        # OCR
        ocr_result = ocr_service.recognize(
            file_stream=file,
            language_type=ocr_lang_code,
            with_probability=True,
        )
        if not ocr_result["success"]:
            results.append({
                "filename": file.filename,
                "success": False,
                "error": f"OCR 失败: {ocr_result['error']}",
            })
            continue

        segments = ocr_result["segments"]
        ocr_raw_text = "\n".join([s["text"] for s in segments])

        # 翻译
        translate_result = translate_service.translate(
            text=ocr_raw_text,
            source_lang=source_lang_name,
            target_lang=target_lang_name,
        )
        if not translate_result["success"]:
            results.append({
                "filename": file.filename,
                "success": False,
                "error": f"翻译失败: {translate_result['error']}",
            })
            continue

        results.append({
            "filename": file.filename,
            "success": True,
            "data": {
                "ocr_segments": segments,
                "ocr_raw_text": ocr_raw_text,
                "translated_text": translate_result["translated_text"],
                "source_lang": source_lang_name,
                "target_lang": target_lang_name,
            },
        })

    return jsonify({"success": True, "results": results})


@app.route("/api/folder-translate", methods=["POST"])
def folder_translate():
    """
    文件夹批量翻译：提供文件夹路径 → 自动扫描图片 → 翻译 → 输出到 translated 子目录

    JSON 参数:
        folder_path: 文件夹绝对路径
        source_lang: 源语言代码
        target_lang: 目标语言代码
    """
    data = request.json
    folder_path = data.get("folder_path", "").strip()

    if not folder_path or not os.path.isdir(folder_path):
        return jsonify({"success": False, "error": f"文件夹路径无效: {folder_path}"}), 400

    source_lang_code = data.get("source_lang", "auto")
    target_lang_code = data.get("target_lang", "zh")

    source_lang_name = SUPPORTED_LANGUAGES.get(source_lang_code, {}).get("label", "自动检测")
    ocr_lang_code = SUPPORTED_LANGUAGES.get(source_lang_code, {}).get("ocr_code", "AUTO")
    target_lang_name = TARGET_LANGUAGES.get(target_lang_code, "中文")

    # 扫描文件夹中的图片
    image_files = []
    for fname in sorted(os.listdir(folder_path)):
        ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else ""
        if ext in ALLOWED_EXTENSIONS:
            image_files.append(os.path.join(folder_path, fname))

    if not image_files:
        return jsonify({"success": False, "error": f"文件夹中未找到图片文件: {folder_path}"}), 200

    # 创建 translated 子目录
    output_dir = os.path.join(folder_path, "translated")
    os.makedirs(output_dir, exist_ok=True)

    results = []
    for img_path in image_files:
        fname = os.path.basename(img_path)
        base_name = fname.rsplit(".", 1)[0]

        with open(img_path, "rb") as f:
            file_bytes = f.read()

        # 用 bytes 包装成带 filename 的对象给 OCR
        import io

        class NamedBytesIO(io.BytesIO):
            def __init__(self, data, name):
                super().__init__(data)
                self.filename = name

        file_obj = NamedBytesIO(file_bytes, fname)

        # OCR
        ocr_result = ocr_service.recognize(
            file_stream=file_obj,
            language_type=ocr_lang_code,
            with_probability=True,
        )

        if not ocr_result["success"]:
            results.append({"filename": fname, "success": False, "error": f"OCR 失败: {ocr_result['error']}"})
            continue

        segments = ocr_result["segments"]
        ocr_raw_text = "\n".join([s["text"] for s in segments])

        # 翻译
        translate_result = translate_service.translate(
            text=ocr_raw_text,
            source_lang=source_lang_name,
            target_lang=target_lang_name,
        )

        if not translate_result["success"]:
            results.append({"filename": fname, "success": False, "error": f"翻译失败: {translate_result['error']}"})
            continue

        # 写入 translated 子目录
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        out_filename = f"{base_name}_{timestamp}.txt"
        out_path = os.path.join(output_dir, out_filename)

        content_parts = [
            "=== 漫画翻译结果 ===",
            f"源文件: {fname}",
            f"时间: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"源语言: {source_lang_name} -> 目标语言: {target_lang_name}",
            "",
            "=== 原文 ===",
            ocr_raw_text,
            "",
            "=== 译文 ===",
            translate_result["translated_text"],
            "",
            "=== 分段对照(含坐标) ===",
        ]
        for idx, seg in enumerate(segments, 1):
            loc = seg.get("location", {})
            content_parts.append(
                f"【第{idx}段】 位置: L={loc.get('left', '?')} T={loc.get('top', '?')} "
                f"W={loc.get('width', '?')} H={loc.get('height', '?')} | {seg.get('text', '')}"
            )

        with open(out_path, "w", encoding="utf-8") as f:
            f.write("\n".join(content_parts))

        results.append({
            "filename": fname,
            "success": True,
            "output": out_path,
            "ocr_raw_text": ocr_raw_text,
            "translated_text": translate_result["translated_text"],
        })

    success_count = sum(1 for r in results if r["success"])
    return jsonify({
        "success": True,
        "total": len(results),
        "success_count": success_count,
        "output_dir": output_dir,
        "results": results,
    })


# ========== 启动 ==========

if __name__ == "__main__":
    import sys
    import io
    # Windows 控制台兼容 UTF-8 输出
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

    print("GLM 漫画翻译器启动中...")
    print(f"访问地址: http://{HOST}:{PORT}")
    app.run(host=HOST, port=PORT, debug=True)
