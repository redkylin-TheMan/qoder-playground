# Oracle Instant Client 安装脚本

Write-Host "开始安装 Oracle Instant Client + SQL*Plus..." -ForegroundColor Green

$installDir = "C:\oracle\instantclient"
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force
    Write-Host "创建安装目录: $installDir" -ForegroundColor Yellow
}

$basicUrl = "https://download.oracle.com/otn_software/nt/instantclient/1921000/instantclient-basic-windows.x64-19.21.0.0.0.zip"
$toolsUrl = "https://download.oracle.com/otn_software/nt/instantclient/1921000/instantclient-sqlplus-windows.x64-19.21.0.0.0.zip"

$basicZip = "$env:TEMP\instantclient-basic.zip"
$toolsZip = "$env:TEMP\instantclient-tools.zip"

Write-Host "正在下载 Basic Package..." -ForegroundColor Cyan
try {
    Invoke-WebRequest -Uri $basicUrl -OutFile $basicZip -UseBasicParsing
    Write-Host "Basic Package 下载完成" -ForegroundColor Green
} catch {
    Write-Host "Basic Package 下载失败: $_" -ForegroundColor Red
    exit 1
}

Write-Host "正在下载 SQL*Plus Package..." -ForegroundColor Cyan
try {
    Invoke-WebRequest -Uri $toolsUrl -OutFile $toolsZip -UseBasicParsing
    Write-Host "SQL*Plus Package 下载完成" -ForegroundColor Green
} catch {
    Write-Host "SQL*Plus Package 下载失败: $_" -ForegroundColor Red
    exit 1
}

Write-Host "正在解压文件..." -ForegroundColor Cyan
try {
    Expand-Archive -Path $basicZip -DestinationPath $env:TEMP -Force
    Write-Host "Basic Package 解压完成" -ForegroundColor Green

    Expand-Archive -Path $toolsZip -DestinationPath $env:TEMP -Force
    Write-Host "Tools Package 解压完成" -ForegroundColor Green

    $tempExtract = "$env:TEMP\instantclient_19_21"
    if (Test-Path $tempExtract) {
        Copy-Item -Path "$tempExtract\*" -Destination $installDir -Recurse -Force
        Write-Host "文件已复制到: $installDir" -ForegroundColor Green
    }
} catch {
    Write-Host "解压失败: $_" -ForegroundColor Red
    exit 1
}

Write-Host "正在配置环境变量..." -ForegroundColor Cyan
try {
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")

    if ($currentPath -notlike "*$installDir*") {
        $newPath = "$currentPath;$installDir"
        [Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
        Write-Host "已添加到系统 PATH: $installDir" -ForegroundColor Green
    } else {
        Write-Host "PATH 中已存在该目录" -ForegroundColor Yellow
    }

    [Environment]::SetEnvironmentVariable("ORACLE_HOME", $installDir, "Machine")
    Write-Host "已设置 ORACLE_HOME: $installDir" -ForegroundColor Green

    [Environment]::SetEnvironmentVariable("TNS_ADMIN", $installDir, "Machine")
    Write-Host "已设置 TNS_ADMIN: $installDir" -ForegroundColor Green

} catch {
    Write-Host "环境变量配置失败: $_" -ForegroundColor Red
    exit 1
}

Write-Host "清理临时文件..." -ForegroundColor Cyan
Remove-Item $basicZip -Force -ErrorAction SilentlyContinue
Remove-Item $toolsZip -Force -ErrorAction SilentlyContinue
Remove-Item "$env:TEMP\instantclient_19_21" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "========================================" -ForegroundColor Green
Write-Host "安装完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "1. 关闭当前终端窗口" -ForegroundColor Yellow
Write-Host "2. 重新打开新的终端窗口" -ForegroundColor Yellow
Write-Host "3. 运行: sqlplus -v" -ForegroundColor Yellow