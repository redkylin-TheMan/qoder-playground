@echo off
chcp 65001 >nul
echo ========================================
echo Oracle Instant Client + SQL*Plus 安装工具
echo ========================================
echo.

echo 第一步: 手动下载文件
echo --------------------
echo 请访问以下链接下载所需文件:
echo.
echo 1. Oracle Instant Client 下载页面:
echo    https://www.oracle.com/cn/database/technologies/instant-client/winx64-64-downloads.html
echo.
echo 2. 需要下载两个文件:
echo    - Basic Package (基础包)
echo    - SQL*Plus Package (SQL*Plus包)
echo.
echo 3. 下载后请将两个ZIP文件放到此目录:
echo    %CD%
echo.
echo 暂停...
pause

echo.
echo 第二步: 检查下载文件
echo --------------------
set basic_found=0
set sqlplus_found=0

for %%f in (instantclient-basic*.zip) do (
    echo 找到 Basic Package: %%f
    set basic_found=1
    set "basic_file=%%f"
)

for %%f in (instantclient-sqlplus*.zip) do (
    echo 找到 SQL*Plus Package: %%f
    set sqlplus_found=1
    set "sqlplus_file=%%f"
)

if %basic_found%==0 (
    echo 错误: 未找到 Basic Package 文件!
    echo 请确保下载了 instantclient-basic*.zip 文件
    pause
    exit /b 1
)

if %sqlplus_found%==0 (
    echo 错误: 未找到 SQL*Plus Package 文件!
    echo 请确保下载了 instantclient-sqlplus*.zip 文件
    pause
    exit /b 1
)

echo.
echo 第三步: 创建安装目录
echo --------------------
set "install_dir=C:\oracle\instantclient"
if not exist "%install_dir%" (
    mkdir "%install_dir%"
    echo 创建安装目录: %install_dir%
) else (
    echo 安装目录已存在: %install_dir%
)

echo.
echo 第四步: 解压文件
echo --------------------
echo 正在解压 Basic Package...
powershell -Command "Expand-Archive -Path '%basic_file%' -DestinationPath '%TEMP%' -Force"

echo 正在解压 SQL*Plus Package...
powershell -Command "Expand-Archive -Path '%sqlplus_file%' -DestinationPath '%TEMP%' -Force"

echo.
echo 第五步: 复制文件到安装目录
echo --------------------
for /d %%d in (%TEMP%\instantclient*) do (
    echo 从 %%d 复制文件...
    xcopy "%%d\*" "%install_dir%\" /E /I /Y
)

echo.
echo 第六步: 配置环境变量
echo --------------------
echo 正在添加到系统 PATH...
setx PATH "%PATH%;%install_dir%" /M >nul 2>&1
echo PATH 已更新

echo 正在设置 ORACLE_HOME...
setx ORACLE_HOME "%install_dir%" /M >nul 2>&1
echo ORACLE_HOME 已设置

echo 正在设置 TNS_ADMIN...
setx TNS_ADMIN "%install_dir%" /M >nul 2>&1
echo TNS_ADMIN 已设置

echo.
echo 第七步: 创建配置文件
echo --------------------
set "tns_file=%install_dir%\tnsnames.ora"
echo # TNS 配置文件 > "%tns_file%"
echo # 格式: 别名 = (DESCRIPTION = (ADDRESS = (PROTOCOL = TCP)(HOST = 主机名)(PORT = 端口)) (CONNECT_DATA = (SERVICE_NAME = 服务名))) >> "%tns_file%"
echo. >> "%tns_file%"
echo MYDB = >> "%tns_file%"
echo   (DESCRIPTION = >> "%tns_file%"
echo     (ADDRESS = (PROTOCOL = TCP)(HOST = localhost)(PORT = 1521)) >> "%tns_file%"
echo     (CONNECT_DATA = >> "%tns_file%"
echo       (SERVICE_NAME = ORCL) >> "%tns_file%"
echo     ) >> "%tns_file%"
echo   ) >> "%tns_file%"
echo tnsnames.ora 已创建

echo.
echo 第八步: 清理临时文件
echo --------------------
del "%basic_file%" /Q >nul 2>&1
del "%sqlplus_file%" /Q >nul 2>&1
for /d %%d in (%TEMP%\instantclient*) do (
    rmdir "%%d" /S /Q >nul 2>&1
)
echo 临时文件已清理

echo.
echo ========================================
echo 安装完成!
echo ========================================
echo.
echo 重要提示:
echo 1. 请关闭当前命令行窗口
echo 2. 重新打开新的命令行窗口
echo 3. 运行: sqlplus -v
echo.
echo 使用方法:
echo   sqlplus username/password@host:port/service_name
echo.
echo   例如: sqlplus scott/tiger@192.168.1.100:1521/ORCL
echo.
echo   或使用 TNS 别名:
echo   sqlplus username/password@MYDB
echo.
echo 安装目录: %install_dir%
echo.
pause