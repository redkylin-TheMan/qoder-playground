param(
  [Parameter(Mandatory = $false)]
  [string]$Port
)

# 检查是否传入了端口号
if (-not $Port) {
  Write-Host "用法: .\killport.ps1 <端口号>"
  Write-Host "示例: .\killport.ps1 8080"
  exit 1
}

# 验证端口号是否为数字且在合法范围内
if ($Port -notmatch '^\d+$') {
  Write-Host "[错误] 端口号必须是数字: $Port" -ForegroundColor Red
  exit 1
}

$portNum = [int]$Port
if ($portNum -lt 1 -or $portNum -gt 65535) {
  Write-Host "[错误] 端口号必须在 1-65535 之间" -ForegroundColor Red
  exit 1
}

# 根据 exe 路径推断程序语言/类型
function Get-ProcessType {
  param([string]$ExePath)

  if (-not $ExePath) { return "未知" }

  $lower = $ExePath.ToLower()

  # Java
  if ($lower -match '\\java\.exe$|\\javaw\.exe$|\\jre\\|\\jdk\\') {
    # 尝试通过命令行参数找 jar 或 class
    return "Java"
  }

  # Python
  if ($lower -match '\\python\.exe$|\\python3\.exe$|\\pythonw\.exe$|\\py\.exe$') {
    return "Python"
  }

  # Node.js / 前端
  if ($lower -match '\\node\.exe$') { return "Node.js / 前端" }
  if ($lower -match '\\npm\.cmd$|\\npx\.cmd$|\\yarn\.cmd$|\\pnpm\.cmd$') { return "Node.js / 前端" }

  # Go
  if ($lower -match '\\go\.exe$') { return "Go" }

  # .NET / C#
  if ($lower -match '\\dotnet\.exe$') { return ".NET / C#" }
  if ($lower -match '\\.*\.dll$') { return ".NET" }

  # Rust
  if ($lower -match '\\cargo\.exe$|\\rustc\.exe$') { return "Rust" }

  # Ruby
  if ($lower -match '\\ruby\.exe$') { return "Ruby" }

  # PHP
  if ($lower -match '\\php\.exe$|\\php-cgi\.exe$') { return "PHP" }

  # Nginx
  if ($lower -match '\\nginx\.exe$') { return "Nginx" }

  # Apache
  if ($lower -match '\\httpd\.exe$') { return "Apache" }

  # MySQL / PostgreSQL / Redis
  if ($lower -match '\\mysqld\.exe$') { return "MySQL" }
  if ($lower -match '\\postgres\.exe$') { return "PostgreSQL" }
  if ($lower -match '\\redis-server\.exe$') { return "Redis" }

  # Docker
  if ($lower -match '\\docker\.exe$|\\com\.docker\.cl') { return "Docker" }

  return "未知"
}

Write-Host "[信息] 正在查找占用端口 $Port 的进程..." -ForegroundColor Cyan

# 查找占用该端口的连接
$connections = netstat -ano | Select-String ":$Port\s" | Select-String "LISTENING|ESTABLISHED|TIME_WAIT|CLOSE_WAIT"

if (-not $connections) {
  $connections = netstat -ano | Select-String ":$Port\s"
}

if (-not $connections) {
  Write-Host "[信息] 端口 $Port 没有被任何进程占用" -ForegroundColor Yellow
  exit 0
}

# 提取所有唯一的 PID
$pids = @()
foreach ($conn in $connections) {
  $parts = $conn.ToString().Trim() -split '\s+'
  $procId = $parts[-1]
  if ($procId -match '^\d+$' -and $procId -ne '0' -and $pids -notcontains $procId) {
    $pids += $procId
  }
}

if ($pids.Count -eq 0) {
  Write-Host "[信息] 端口 $Port 没有被任何进程占用" -ForegroundColor Yellow
  exit 0
}

# 收集每个进程的详细信息
$processInfos = @()

foreach ($procId in $pids) {
  $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
  if (-not $proc) { continue }

  # 获取可执行文件路径
  $exePath = ""
  try {
    $exePath = $proc.Path
  }
  catch {}

  # 获取命令行参数（通过 WMI）
  $cmdLine = ""
  try {
    $wmiProc = Get-CimInstance Win32_Process -Filter "ProcessId = $procId" -ErrorAction Stop
    $cmdLine = $wmiProc.CommandLine
  }
  catch {}

  # 推断程序语言/类型
  $langType = Get-ProcessType -ExePath $exePath

  # Java 特殊处理：从命令行参数中提取主类或 jar 名
  if ($langType -eq "Java" -and $cmdLine) {
    if ($cmdLine -match '-jar\s+"?([^"\s]+)"?') {
      $langType = "Java ($($Matches[1]))"
    }
    elseif ($cmdLine -match '(\S+)\s*$') {
      $langType = "Java (主类: $($Matches[1]))"
    }
  }

  # Node.js 特殊处理：从命令行提取运行的脚本
  if ($langType -eq "Node.js / 前端" -and $cmdLine) {
    if ($cmdLine -match 'node\.exe"\s+"?([^"\s]+\.js)"?') {
      $langType = "Node.js / 前端 ($($Matches[1]))"
    }
    elseif ($cmdLine -match '(webpack|vite|next|nuxt|react|vue|angular)') {
      $langType = "Node.js / 前端 ($($Matches[1]))"
    }
  }

  # 获取工作目录
  $workDir = ""
  try {
    $workDir = $proc.StartInfo.WorkingDirectory
    if (-not $workDir) {
      # 通过 WMI 获取
      $wmiProc2 = Get-CimInstance Win32_Process -Filter "ProcessId = $procId" -ErrorAction Stop
      $workDir = $wmiProc2.ExecutablePath | Split-Path -Parent
    }
  }
  catch {}

  # 获取启动时间
  $startTime = ""
  try {
    $startTime = $proc.StartTime.ToString("yyyy-MM-dd HH:mm:ss")
  }
  catch {
    $startTime = "无法获取"
  }

  # 内存占用
  $memMB = [math]::Round($proc.WorkingSet64 / 1MB, 2)

  $processInfos += [PSCustomObject]@{
    ProcId   = $procId
    Name     = $proc.ProcessName
    ExePath  = if ($exePath) { $exePath } else { "无法获取" }
    CmdLine  = if ($cmdLine) { $cmdLine } else { "无法获取" }
    LangType = $langType
    WorkDir  = if ($workDir) { $workDir } else { "无法获取" }
    StartAt  = $startTime
    MemMB    = $memMB
  }
}

if ($processInfos.Count -eq 0) {
  Write-Host "[信息] 无法获取任何进程信息" -ForegroundColor Yellow
  exit 0
}

# 显示详细信息
Write-Host ""
Write-Host "============================================" -ForegroundColor White
Write-Host "  端口 $Port 占用进程详情" -ForegroundColor White
Write-Host "============================================" -ForegroundColor White
Write-Host ""

foreach ($info in $processInfos) {
  Write-Host "  进程名称:   " -NoNewline; Write-Host $info.Name -ForegroundColor Green
  Write-Host "  PID:        " -NoNewline; Write-Host $info.ProcId -ForegroundColor Green
  Write-Host "  程序类型:   " -NoNewline; Write-Host $info.LangType -ForegroundColor Cyan
  Write-Host "  可执行路径: " -NoNewline; Write-Host $info.ExePath -ForegroundColor Yellow
  Write-Host "  工作目录:   " -NoNewline; Write-Host $info.WorkDir -ForegroundColor Yellow
  Write-Host "  启动时间:   " -NoNewline; Write-Host $info.StartAt -ForegroundColor Gray
  Write-Host "  内存占用:   " -NoNewline; Write-Host "$($info.MemMB) MB" -ForegroundColor Gray
  Write-Host "  命令行:     " -NoNewline; Write-Host $info.CmdLine -ForegroundColor DarkGray
  Write-Host ""
  Write-Host "  ------------------------------------------" -ForegroundColor DarkGray
  Write-Host ""
}

# 确认是否杀死
Write-Host "============================================" -ForegroundColor Red
Write-Host -NoNewline "  是否杀死以上所有进程？(y/n): " -ForegroundColor Red
$confirm = Read-Host

if ($confirm -ne 'y' -and $confirm -ne 'Y') {
  Write-Host "[取消] 操作已取消" -ForegroundColor Yellow
  exit 0
}

# 杀死每个进程
foreach ($info in $processInfos) {
  $procId = $info.ProcId
  $procName = $info.Name

  Write-Host "[杀死] PID: $procId  进程: $procName" -ForegroundColor Yellow

  try {
    Stop-Process -Id $procId -Force -ErrorAction Stop
    Write-Host "[成功] 进程 $procId ($procName) 已被终止" -ForegroundColor Green
  }
  catch {
    Write-Host "[失败] 无法终止进程 $procId ($procName)，可能需要管理员权限" -ForegroundColor Red
  }
}

Write-Host "[完成]" -ForegroundColor Cyan
