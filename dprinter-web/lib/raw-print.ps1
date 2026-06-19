# lib/raw-print.ps1 — 通过 Windows RawPrinterHelper 发送原始字节到打印机
# 由 lib/printer.js (Node) 调用。
# ---------------------------------------------------------------------------
# 调用方式（由 Node 拼装）:
#   powershell -ExecutionPolicy Bypass -File raw-print.ps1 -PrinterName "Deli DB-618KII" -ScriptFile "C:\...\tmp.txt"
#
# 脚本文件格式（UTF-8, 无 BOM）:
#   每行一个元素。以 "@@RAW@@" 开头的行，其后跟的字符是 latin1 控制码字节；
#   其余行是 UTF-8 文本（中文），将统一做 GB18030 编码后发送。
#
# 设计要点：
#   - 中文 GB18030 编码在 PS 侧用 .NET [Text.Encoding]::GetEncoding("GB18030")
#     完成，覆盖全字符集，不依赖 Node 任何原生模块。
#   - 控制码必须按「字节」原样发送（不能被 GB18030 转换），所以分两类处理。

param(
    [Parameter(Mandatory=$true)][string]$PrinterName,
    [Parameter(Mandatory=$true)][string]$ScriptFile,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# ---------- RawPrinterHelper: 通过 winspool 发送 RAW 字节流 ----------
# 经典 P/Invoke 方案（Microsoft 文档示例），定义 RawPrinter 类。
$src = @"
using System;
using System.Runtime.InteropServices;
public class RawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
    [DllImport("winspool.drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
    [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static bool SendBytesToPrinter(string szPrinterName, byte[] bytes) {
        IntPtr hPrinter;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "ESC-P Document";
        di.pDataType = "RAW";
        bool bSuccess = false;
        if (OpenPrinter(szPrinterName.Normalize(), out hPrinter, IntPtr.Zero)) {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
                    try {
                        Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
                        int dwWritten;
                        bSuccess = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);
                    } finally {
                        Marshal.FreeCoTaskMem(pUnmanagedBytes);
                    }
                    EndPagePrinter(hPrinter);
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }
        return bSuccess;
    }
}
"@
Add-Type -Language CSharp -TypeDefinition $src -ErrorAction SilentlyContinue

# ---------- 读取脚本文件并组装字节流 ----------
function Build-Bytes([string]$file) {
    $gb = [System.Text.Encoding]::GetEncoding("GB18030")
    $ms = New-Object System.IO.MemoryStream
    $lines = Get-Content -LiteralPath $file -Encoding UTF8
    foreach ($line in $lines) {
        if ($line.StartsWith("@@RAW@@")) {
            # 控制码：其后的字符串是 latin1 字节，按原字节写入
            $rest = $line.Substring(7)
            $rawBytes = [System.Text.Encoding]::GetEncoding("ISO-8859-1").GetBytes($rest)
            $ms.Write($rawBytes, 0, $rawBytes.Length)
        } else {
            # 文本：UTF-8 解码成字符，再 GB18030 编码成字节
            # 注意：Get-Content 已按 UTF8 解码成字符串，这里直接 GB18030 编码
            $txtBytes = $gb.GetBytes($line)
            $ms.Write($txtBytes, 0, $txtBytes.Length)
            # 文本行末补一个换行 LF（针打走纸一行）
            $lf = $gb.GetBytes("`n")
            $ms.Write($lf, 0, $lf.Length)
        }
    }
    return $ms.ToArray()
}

# ---------- 执行 ----------
try {
    $bytes = Build-Bytes -file $ScriptFile
    Write-Host ("BYTES=" + $bytes.Length)

    if ($DryRun) {
        # 仅打印 hex 摘要，不真正发送
        $hex = [BitConverter]::ToString($bytes[0..([Math]::Min(63, $bytes.Length-1))]) -replace '-', ' '
        Write-Host ("HEX64=" + $hex)
        Write-Host "DRYRUN=1"
        exit 0
    }

    $ok = [RawPrinter]::SendBytesToPrinter($PrinterName, $bytes)
    if ($ok) {
        Write-Host "OK=1"
        exit 0
    } else {
        Write-Host "OK=0"
        Write-Host ("ERRCODE=" + [System.Runtime.InteropServices.Marshal]::GetLastWin32Error())
        exit 2
    }
} catch {
    Write-Host ("EXCEPTION=" + $_.Exception.Message)
    exit 3
}

# 独立测试入口：Send-RawTest 给打印机发一行测试文本
function Send-RawTest {
    $name = (Get-CimInstance -ClassName Win32_Printer | Where-Object { $_.Default -eq $true } | Select-Object -First 1).Name
    if (-not $name) { Write-Host "NO_DEFAULT_PRINTER"; return }
    Write-Host ("PRINTER=" + $name)
    $gb = [System.Text.Encoding]::GetEncoding("GB18030")
    $bytes = $gb.GetBytes("得力DB-618KII 针打测试 1234567890`n`n`n")
    $ok = [RawPrinter]::SendBytesToPrinter($name, $bytes)
    Write-Host ("SEND_OK=" + $ok)
}
