# 精伦 iDR210 浏览器读卡

本目录是一个本机浏览器方案：浏览器页面负责操作界面，`backend/server.py` 负责在 `127.0.0.1` 启动 HTTP 服务，并通过 32 位 Python `ctypes` 调用精伦 `Sdtapi.dll`。

## 快速启动

1. 安装 32 位 Python。
2. 确认 `native/x86` 内存在 `Sdtapi.dll`、`SavePhoto.dll`、`Dewlt.dll`、`routon.ini`。
3. 双击 `start.bat`。
4. 浏览器打开 `http://127.0.0.1:8765`。

当前 SDK DLL 是 x86，不能用 64 位 Python 启动。验证命令：

```powershell
py -0p
py -3.12-32 -c "import struct; print(struct.calcsize('P')*8)"
```

第二条命令应输出 `32`。如果安装的是其他版本，把 `3.12` 换成实际版本。

## 接口

- `GET /api/health`：检查 Python 位数、SDK 文件、DLL 加载状态。
- `GET /api/devices`：查找 USB 读卡器数量。
- `POST /api/device/open`：打开设备，默认端口 `1001`。
- `POST /api/device/close`：关闭设备。
- `POST /api/id-card/read`：读取身份证/外国人永久居留证/港澳台居民居住证。
- `POST /api/nfc/find`：寻 NFC/Type A 卡。
- `POST /api/nfc/sn`：读取卡号。
- `POST /api/nfc/read-block`：读取 M1/UltraLight 区块。
- `POST /api/nfc/write-block`：写入 M1/UltraLight 区块。
- `POST /api/nfc/apdu`：CPU 卡 APDU 透传。

接口统一返回：

```json
{ "ok": true, "data": {} }
```

或：

```json
{ "ok": false, "error": { "code": "ERROR_CODE", "message": "错误说明", "ret": -1 } }
```

## 目录

```text
jinglun/
  backend/
    jinglun_sdk.py
    server.py
  native/x86/
    Sdtapi.dll
    SavePhoto.dll
    Dewlt.dll
    routon.ini
  web/
    index.html
    app.js
    styles.css
  start.bat
  前期准备.md
```

## 注意

- 服务只绑定 `127.0.0.1`，只给本机浏览器使用。
- 身份证数据默认只返回到当前浏览器页面，不写入数据库或长期保存。
- M1 写卡默认禁止写扇区尾块，避免误改密钥和访问控制位。
