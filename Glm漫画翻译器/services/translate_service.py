"""翻译服务 — 调用 GLM-4-Flash 免费模型"""
from zai import ZhipuAiClient
from config import GLM_API_KEY, TRANSLATE_MODEL

SYSTEM_PROMPT = """你是一个专业的漫画翻译家。你的任务是将漫画中识别出的文字翻译为目标语言。

要求：
1. 保持原文的语气和情感（感叹句保持感叹语气）
2. 漫画对话要口语化、自然
3. 拟声词尽量用目标语言的对应拟声词
4. 如果有多段文字，逐段翻译，每段用【第N段】标记
5. 只输出翻译结果，不要添加任何解释

输出格式：
【第1段】翻译内容
【第2段】翻译内容
..."""


class TranslateService:
    def __init__(self):
        self.client = ZhipuAiClient(api_key=GLM_API_KEY)

    def translate(self, text, source_lang="日语", target_lang="中文"):
        """
        翻译文本

        参数:
            text: 要翻译的文字（多段可用换行分隔）
            source_lang: 源语言名称（如"日语"）
            target_lang: 目标语言名称（如"中文"）

        返回:
            {"success": True/False, "translated_text": "...", "error": "..."}
        """
        if not text or not text.strip():
            return {"success": True, "translated_text": ""}

        try:
            user_prompt = (
                f"请将以下从漫画中识别出的文字"
                f"从{source_lang}翻译为{target_lang}：\n\n{text}"
            )

            response = self.client.chat.completions.create(
                model=TRANSLATE_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,
                max_tokens=2000,
            )

            translated = response.choices[0].message.content

            return {"success": True, "translated_text": translated}

        except Exception as e:
            return {"success": False, "error": str(e)}
