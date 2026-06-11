"""OCR 识别服务 — 调用智谱 OCR 工具接口"""
from zai import ZhipuAiClient
from config import GLM_API_KEY, OCR_TOOL_TYPE


class OCRService:
    def __init__(self):
        self.client = ZhipuAiClient(api_key=GLM_API_KEY)

    def recognize(self, file_stream, language_type="AUTO", with_probability=True):
        """
        识别图片中的文字

        参数:
            file_stream: Flask FileStorage 对象或文件对象
            language_type: OCR 语言类型代码（JAP/KOR/ENG/AUTO 等）
            with_probability: 是否返回置信度

        返回:
            {"success": True/False, "segments": [...], "error": "..."}
        """
        try:
            # 读取文件内容
            raw_bytes = file_stream.read()
            filename = getattr(file_stream, "filename", "image.png") or "image.png"

            # SDK 要求带文件名的 tuple: (filename, bytes)
            response = self.client.ocr.handwriting_ocr(
                file=(filename, raw_bytes),
                tool_type=OCR_TOOL_TYPE,
                language_type=language_type,
                probability=with_probability,
            )

            # SDK 返回 HandwritingOCRResp 对象
            # 属性: task_id, message, status, words_result_num, words_result
            # words_result 是 WordsResult 列表
            #   每个元素: location(left,top,width,height), words, probability
            segments = []
            words_result = getattr(response, "words_result", []) or []

            for item in words_result:
                loc = getattr(item, "location", None)
                segment = {
                    "text": getattr(item, "words", ""),
                    "location": {
                        "left": getattr(loc, "left", 0) if loc else 0,
                        "top": getattr(loc, "top", 0) if loc else 0,
                        "width": getattr(loc, "width", 0) if loc else 0,
                        "height": getattr(loc, "height", 0) if loc else 0,
                    } if loc else {},
                }
                prob = getattr(item, "probability", None)
                if prob:
                    segment["confidence"] = getattr(prob, "average", 0)

                segments.append(segment)

            return {"success": True, "segments": segments}

        except Exception as e:
            return {"success": False, "error": str(e)}
