from __future__ import annotations

import ctypes
import os
import re
import struct
import sys
import threading
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


ROOT_DIR = Path(__file__).resolve().parents[1]
DLL_DIR = ROOT_DIR / "native" / "x86"
SDTAPI_DLL = DLL_DIR / "Sdtapi.dll"
REQUIRED_DLLS = ("Sdtapi.dll", "SavePhoto.dll", "Dewlt.dll", "routon.ini")

ID_CARD_TYPES = {
    100: "中国居民身份证",
    101: "外国人永久居留证",
    102: "港澳台居民居住证",
}

NFC_CARD_TYPES = {
    0: "未找到卡",
    1: "M1-S50",
    2: "CPU卡",
    3: "M1-S70",
    4: "Mifare UltraLight",
}

ID_FIELD_DEFS = [
    ("cardType", "证件类型"),
    ("name", "中文姓名"),
    ("englishName", "英文姓名"),
    ("gender", "性别"),
    ("genderCode", "性别代码"),
    ("nation", "民族/国籍"),
    ("nationCode", "民族/国籍代码"),
    ("birthDate", "出生日期"),
    ("address", "住址"),
    ("idNumber", "证件号码"),
    ("agency", "签发机关"),
    ("validFrom", "有效期起始日期"),
    ("validTo", "有效期截止日期"),
    ("versionOrIssueCount", "版本号/签发次数"),
]


class JinglunError(Exception):
    def __init__(self, code: str, message: str, ret: Optional[int] = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.ret = ret

    def to_dict(self) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"code": self.code, "message": self.message}
        if self.ret is not None:
            payload["ret"] = self.ret
        return payload


def python_bits() -> int:
    return struct.calcsize("P") * 8


def environment_health() -> Dict[str, Any]:
    dlls = {
        name: {
            "exists": (DLL_DIR / name).exists(),
            "path": str(DLL_DIR / name),
            "size": (DLL_DIR / name).stat().st_size if (DLL_DIR / name).exists() else None,
        }
        for name in REQUIRED_DLLS
    }
    missing = [name for name, item in dlls.items() if not item["exists"]]
    return {
        "python": sys.version,
        "pythonExecutable": sys.executable,
        "pythonBits": python_bits(),
        "isWindows": os.name == "nt",
        "dllDirectory": str(DLL_DIR),
        "dllDirectoryExists": DLL_DIR.exists(),
        "dlls": dlls,
        "missingFiles": missing,
        "canLoadSdk": os.name == "nt" and python_bits() == 32 and not missing,
    }


def assert_runtime_ready() -> None:
    health = environment_health()
    if not health["isWindows"]:
        raise JinglunError("UNSUPPORTED_OS", "精伦 DLL 只支持 Windows 本机运行。")
    if health["pythonBits"] != 32:
        raise JinglunError(
            "WRONG_PYTHON_ARCH",
            f"当前 Python 是 {health['pythonBits']} 位，精伦 SDK DLL 是 32 位，请使用 32 位 Python 启动。",
        )
    if health["missingFiles"]:
        raise JinglunError(
            "MISSING_SDK_FILE",
            "缺少 SDK 文件：" + ", ".join(health["missingFiles"]),
        )


def _decode_bytes(data: bytes) -> str:
    data = data.split(b"\x00", 1)[0].strip()
    if not data:
        return ""
    for encoding in ("gbk", "mbcs", "utf-8"):
        try:
            return data.decode(encoding).strip()
        except (LookupError, UnicodeDecodeError):
            continue
    return data.decode("latin1", errors="replace").strip()


def _buffer_text(buffer: ctypes.Array) -> str:
    return _decode_bytes(bytes(buffer))


def _normalize_hex(value: str, *, expected_bytes: Optional[int] = None, field: str = "hex") -> bytes:
    cleaned = re.sub(r"[\s:-]", "", value or "")
    if not cleaned:
        raise JinglunError("INVALID_HEX", f"{field} 不能为空。")
    if len(cleaned) % 2:
        raise JinglunError("INVALID_HEX", f"{field} 必须是偶数位十六进制字符串。")
    if not re.fullmatch(r"[0-9a-fA-F]+", cleaned):
        raise JinglunError("INVALID_HEX", f"{field} 只能包含十六进制字符。")
    raw = bytes.fromhex(cleaned)
    if expected_bytes is not None and len(raw) != expected_bytes:
        raise JinglunError("INVALID_HEX_LENGTH", f"{field} 必须是 {expected_bytes} 字节。")
    return raw


def _byte_array(raw: bytes) -> Any:
    return (ctypes.c_ubyte * len(raw))(*raw)


def _clean_base64(value: str) -> str:
    return "".join(value.split())


def parse_id_text(text: str) -> Dict[str, Any]:
    if not text:
        return {"rawText": "", "fields": [], "parsed": {}}

    if "：" in text:
        parts = text.split("：")
    elif ":" in text:
        parts = text.split(":")
    elif "|" in text:
        parts = text.split("|")
    else:
        parts = [text]

    parts = [part.strip() for part in parts]
    fields: List[Dict[str, Any]] = []
    parsed: Dict[str, str] = {}

    for index, value in enumerate(parts):
        if index < len(ID_FIELD_DEFS):
            key, label = ID_FIELD_DEFS[index]
        else:
            key, label = f"extra{index}", f"扩展字段{index}"
        parsed[key] = value
        fields.append({"index": index, "key": key, "label": label, "value": value})

    parsed["cardTypeName"] = {
        "A": "中国居民身份证",
        "I": "外国人永久居留证",
        "J": "港澳台居民居住证",
    }.get(parsed.get("cardType", ""), parsed.get("cardType", ""))

    return {"rawText": text, "fields": fields, "parsed": parsed}


class JinglunSDK:
    def __init__(self) -> None:
        assert_runtime_ready()
        self._lock = threading.RLock()
        self.current_port: Optional[int] = None
        self.opened = False

        if hasattr(os, "add_dll_directory"):
            os.add_dll_directory(str(DLL_DIR))
        os.environ["PATH"] = str(DLL_DIR) + os.pathsep + os.environ.get("PATH", "")

        try:
            self.dll = ctypes.WinDLL(str(SDTAPI_DLL))
        except OSError as exc:
            raise JinglunError("DLL_LOAD_FAILED", f"加载 Sdtapi.dll 失败：{exc}") from exc

        self._bind_functions()

    def _bind_functions(self) -> None:
        c_int_p = ctypes.POINTER(ctypes.c_int)
        c_uint_p = ctypes.POINTER(ctypes.c_uint)
        c_ubyte_p = ctypes.POINTER(ctypes.c_ubyte)

        self.dll.InitComm.argtypes = [ctypes.c_int]
        self.dll.InitComm.restype = ctypes.c_int

        self.dll.CloseComm.argtypes = []
        self.dll.CloseComm.restype = ctypes.c_int

        self.dll.FindAllUSB.argtypes = [c_int_p, c_int_p]
        self.dll.FindAllUSB.restype = ctypes.c_int

        self.dll.HIDSelect.argtypes = [ctypes.c_int]
        self.dll.HIDSelect.restype = ctypes.c_int

        self.dll.SDTSelect.argtypes = [ctypes.c_int]
        self.dll.SDTSelect.restype = ctypes.c_int

        self.dll.Authenticate.argtypes = []
        self.dll.Authenticate.restype = ctypes.c_int

        self.dll.Routon_DecideIDCardType.argtypes = []
        self.dll.Routon_DecideIDCardType.restype = ctypes.c_int

        self.dll.Routon_ReadAllBaseInfos.argtypes = [
            ctypes.c_char_p,
            ctypes.c_char_p,
            ctypes.c_char_p,
            ctypes.c_char_p,
            ctypes.c_char_p,
        ]
        self.dll.Routon_ReadAllBaseInfos.restype = ctypes.c_int

        self.dll.Routon_IC_FindCard.argtypes = []
        self.dll.Routon_IC_FindCard.restype = ctypes.c_int

        self.dll.Routon_IC_HL_ReadCardSN.argtypes = [ctypes.c_char_p]
        self.dll.Routon_IC_HL_ReadCardSN.restype = ctypes.c_int

        self.dll.Routon_IC_HL_ReadCard.argtypes = [
            ctypes.c_int,
            ctypes.c_int,
            ctypes.c_int,
            c_ubyte_p,
            c_ubyte_p,
        ]
        self.dll.Routon_IC_HL_ReadCard.restype = ctypes.c_int

        self.dll.Routon_IC_HL_WriteCard.argtypes = [
            ctypes.c_int,
            ctypes.c_int,
            ctypes.c_int,
            c_ubyte_p,
            c_ubyte_p,
        ]
        self.dll.Routon_IC_HL_WriteCard.restype = ctypes.c_int

        self.dll.Routon_APDU.argtypes = [
            ctypes.c_char_p,
            c_ubyte_p,
            ctypes.POINTER(ctypes.c_int),
        ]
        self.dll.Routon_APDU.restype = ctypes.c_int

        if hasattr(self.dll, "Routon_RepeatRead"):
            self.dll.Routon_RepeatRead.argtypes = [ctypes.c_bool]
            self.dll.Routon_RepeatRead.restype = ctypes.c_int

        if hasattr(self.dll, "Routon_ShutDownAntenna"):
            self.dll.Routon_ShutDownAntenna.argtypes = []
            self.dll.Routon_ShutDownAntenna.restype = ctypes.c_int

        self.enable_repeat_read(True)

    def enable_repeat_read(self, enabled: bool) -> Dict[str, Any]:
        if not hasattr(self.dll, "Routon_RepeatRead"):
            return {"supported": False, "enabled": False}
        ret = self.dll.Routon_RepeatRead(bool(enabled))
        if ret != 1:
            raise JinglunError("REPEAT_READ_FAILED", "设置连续读身份证失败。", ret)
        return {"supported": True, "enabled": bool(enabled)}

    def health(self) -> Dict[str, Any]:
        data = environment_health()
        data.update({"sdkLoaded": True, "opened": self.opened, "currentPort": self.current_port})
        return data

    def devices(self) -> Dict[str, Any]:
        with self._lock:
            s_count = ctypes.c_int(0)
            h_count = ctypes.c_int(0)
            ret = self.dll.FindAllUSB(ctypes.byref(s_count), ctypes.byref(h_count))
            if ret != 1:
                raise JinglunError("FIND_USB_FAILED", "查找 USB 读卡器失败。", ret)
            return {"standardCount": s_count.value, "hidCount": h_count.value}

    def open_device(self, port: int = 1001, device_type: str = "auto", index: Optional[int] = None) -> Dict[str, Any]:
        with self._lock:
            if device_type in ("hid", "standard"):
                if index is None or index < 1:
                    raise JinglunError("INVALID_DEVICE_INDEX", "设备索引必须从 1 开始。")
                counts = self.devices()
                if device_type == "hid":
                    if index > counts["hidCount"]:
                        raise JinglunError("DEVICE_INDEX_OUT_OF_RANGE", "HID 设备索引超出范围。")
                    selected = self.dll.HIDSelect(index)
                    if not selected:
                        raise JinglunError("HID_SELECT_FAILED", "选择 HID 读卡器失败。", selected)
                else:
                    if index > counts["standardCount"]:
                        raise JinglunError("DEVICE_INDEX_OUT_OF_RANGE", "部标设备索引超出范围。")
                    selected = self.dll.SDTSelect(index)
                    if not selected:
                        raise JinglunError("SDT_SELECT_FAILED", "选择部标读卡器失败。", selected)

            ret = self.dll.InitComm(int(port))
            if ret != 1:
                self.opened = False
                self.current_port = None
                raise JinglunError("OPEN_DEVICE_FAILED", f"打开读卡器端口 {port} 失败。", ret)

            self.enable_repeat_read(True)
            self.opened = True
            self.current_port = int(port)
            return {"opened": True, "port": self.current_port, "deviceType": device_type, "index": index}

    def close_device(self) -> Dict[str, Any]:
        with self._lock:
            ret = self.dll.CloseComm()
            self.opened = False
            self.current_port = None
            if ret != 1:
                raise JinglunError("CLOSE_DEVICE_FAILED", "关闭读卡器端口失败。", ret)
            return {"opened": False}

    def _require_opened(self) -> None:
        if not self.opened:
            raise JinglunError("DEVICE_NOT_OPEN", "读卡器未打开，请先打开设备。")

    def read_id_card(self) -> Dict[str, Any]:
        with self._lock:
            self._require_opened()
            auth_ret = self.dll.Authenticate()
            if auth_ret != 1:
                raise JinglunError("ID_AUTH_FAILED", "未发现身份证或身份证认证失败。", auth_ret)

            type_ret = self.dll.Routon_DecideIDCardType()
            card_type_name = ID_CARD_TYPES.get(type_ret, "未知证件类型")

            msg = ctypes.create_string_buffer(4096)
            head_photo = ctypes.create_string_buffer(512 * 1024)
            front_copy = ctypes.create_string_buffer(1024 * 1024)
            back_copy = ctypes.create_string_buffer(1024 * 1024)
            fingerprint = ctypes.create_string_buffer(4096)

            read_ret = self.dll.Routon_ReadAllBaseInfos(
                msg,
                head_photo,
                front_copy,
                back_copy,
                fingerprint,
            )
            if read_ret != 1:
                raise JinglunError("ID_READ_FAILED", "读取证件信息失败。", read_ret)

            parsed_text = parse_id_text(_buffer_text(msg))
            fp_raw = bytes(fingerprint).rstrip(b"\x00")

            return {
                "cardTypeCode": type_ret,
                "cardTypeName": card_type_name,
                "text": parsed_text,
                "photos": {
                    "headPhoto": {
                        "mime": "image/bmp",
                        "base64": _clean_base64(_buffer_text(head_photo)),
                    },
                    "frontCopy": {
                        "mime": "image/jpeg",
                        "base64": _clean_base64(_buffer_text(front_copy)),
                    },
                    "backCopy": {
                        "mime": "image/jpeg",
                        "base64": _clean_base64(_buffer_text(back_copy)),
                    },
                },
                "fingerprint": {
                    "length": len(fp_raw),
                    "hex": fp_raw.hex().upper(),
                },
            }

    def nfc_find(self) -> Dict[str, Any]:
        with self._lock:
            self._require_opened()
            ret = self.dll.Routon_IC_FindCard()
            return {"type": ret, "typeName": NFC_CARD_TYPES.get(ret, f"未知卡类型({ret})")}

    def nfc_sn(self) -> Dict[str, Any]:
        with self._lock:
            self._require_opened()
            sn = ctypes.create_string_buffer(64)
            ret = self.dll.Routon_IC_HL_ReadCardSN(sn)
            if ret != 1:
                raise JinglunError("NFC_SN_FAILED", "读取 NFC 卡号失败。", ret)
            return {"sn": _buffer_text(sn)}

    def nfc_read_block(self, sid: int, bid: int, key_type: int, key_hex: str) -> Dict[str, Any]:
        with self._lock:
            self._require_opened()
            key = _byte_array(_normalize_hex(key_hex, expected_bytes=6, field="密钥"))
            data = (ctypes.c_ubyte * 16)()
            ret = self.dll.Routon_IC_HL_ReadCard(int(sid), int(bid), int(key_type), key, data)
            if ret != 1:
                raise JinglunError("NFC_READ_BLOCK_FAILED", "读取 NFC 区块失败。", ret)
            raw = bytes(data)
            return {
                "sid": int(sid),
                "bid": int(bid),
                "keyType": int(key_type),
                "hex": raw.hex().upper(),
                "ascii": "".join(chr(b) if 32 <= b <= 126 else "." for b in raw),
            }

    def nfc_write_block(
        self,
        sid: int,
        bid: int,
        key_type: int,
        key_hex: str,
        data_hex: str,
        allow_trailer_write: bool = False,
    ) -> Dict[str, Any]:
        with self._lock:
            self._require_opened()
            if int(bid) == 3 and not allow_trailer_write:
                raise JinglunError(
                    "TRAILER_WRITE_BLOCKED",
                    "默认禁止写入 M1 扇区尾块。确认需要修改密钥/控制位时传 allowTrailerWrite=true。",
                )
            key = _byte_array(_normalize_hex(key_hex, expected_bytes=6, field="密钥"))
            data = _byte_array(_normalize_hex(data_hex, expected_bytes=16, field="写入数据"))
            ret = self.dll.Routon_IC_HL_WriteCard(int(sid), int(bid), int(key_type), key, data)
            if ret != 1:
                raise JinglunError("NFC_WRITE_BLOCK_FAILED", "写入 NFC 区块失败。", ret)
            return {"written": True, "sid": int(sid), "bid": int(bid)}

    def nfc_apdu(self, apdu_hex: str) -> Dict[str, Any]:
        with self._lock:
            self._require_opened()
            apdu = re.sub(r"[\s:-]", "", apdu_hex or "")
            _normalize_hex(apdu, field="APDU")
            out = (ctypes.c_ubyte * 2048)()
            out_len = ctypes.c_int(0)
            ret = self.dll.Routon_APDU(apdu.encode("ascii"), out, ctypes.byref(out_len))
            if ret != 1:
                raise JinglunError("NFC_APDU_FAILED", "发送 APDU 失败。", ret)
            length = max(0, min(out_len.value, len(out)))
            raw = bytes(out[:length])
            return {"length": length, "hex": raw.hex().upper()}


_sdk_instance: Optional[JinglunSDK] = None
_sdk_lock = threading.Lock()


def get_sdk() -> JinglunSDK:
    global _sdk_instance
    with _sdk_lock:
        if _sdk_instance is None:
            _sdk_instance = JinglunSDK()
        return _sdk_instance
