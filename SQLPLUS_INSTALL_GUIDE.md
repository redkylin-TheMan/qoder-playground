# Oracle SQL*Plus 安装指南

## 系统环境
- 操作系统: Windows 10 企业版 LTSC (64位)
- 安装目标: 命令行版本的 SQL*Plus

## 安装步骤

### 方案一: 自动安装（推荐）

1. **下载 Oracle Instant Client**
   - 访问官方下载页面: https://www.oracle.com/cn/database/technologies/instant-client/winx64-64-downloads.html
   - 需要 Oracle 账户（免费注册）
   - 下载以下两个文件:
     - `instantclient-basic-windows.x64-19.21.0.0.0.zip` (基础包)
     - `instantclient-sqlplus-windows.x64-19.21.0.0.0.zip` (SQL*Plus包)

2. **运行安装脚本**
   - 将下载的两个ZIP文件放到 `E:\work\test\` 目录
   - 双击运行 `install_oracle.bat`
   - 脚本会自动完成解压、安装和环境配置

3. **验证安装**
   - 关闭当前命令行窗口
   - 重新打开新的命令行窗口
   - 运行: `sqlplus -v`

### 方案二: 手动安装

如果自动脚本遇到问题，可以手动安装:

1. **创建安装目录**
   ```cmd
   mkdir C:\oracle\instantclient
   ```

2. **解压文件**
   - 将 `instantclient-basic-windows.x64-19.21.0.0.0.zip` 解压到 `C:\oracle\instantclient`
   - 将 `instantclient-sqlplus-windows.x64-19.21.0.0.0.zip` 解压到同一目录，覆盖文件

3. **配置环境变量**
   - 右键"此电脑" -> 属性 -> 高级系统设置 -> 环境变量
   - 在"系统变量"中添加:
     - `Path`: 添加 `C:\oracle\instantclient`
     - `ORACLE_HOME`: `C:\oracle\instantclient`
     - `TNS_ADMIN`: `C:\oracle\instantclient`

4. **创建配置文件**
   - 在 `C:\oracle\instantclient\` 目录创建 `tnsnames.ora` 文件:
     ```plaintext
     MYDB =
       (DESCRIPTION =
         (ADDRESS = (PROTOCOL = TCP)(HOST = localhost)(PORT = 1521))
         (CONNECT_DATA =
           (SERVICE_NAME = ORCL)
         )
       )
     ```

## 使用方法

### 基本连接方式
```cmd
# 直接连接
sqlplus username/password@host:port/service_name

# 示例
sqlplus scott/tiger@192.168.1.100:1521/ORCL
```

### 使用 TNS 别名连接
```cmd
# 先在 tnsnames.ora 中配置别名
sqlplus username/password@alias

# 示例
sqlplus scott/tiger@MYDB
```

### SQL*Plus 常用命令
```sql
-- 显示表结构
DESC table_name;

-- 执行SQL文件
@filename.sql;

-- 退出
EXIT;

-- 清屏
CLEAR SCREEN;
```

## 故障排除

### 问题1: 找不到 sqlplus 命令
- 解决: 确认环境变量 PATH 配置正确，重启命令行窗口

### 问题2: 连接数据库失败
- 检查网络连接
- 确认数据库服务正在运行
- 验证连接参数（主机名、端口、服务名）

### 问题3: 字符集问题
- 设置环境变量: `set NLS_LANG=AMERICAN_AMERICA.ZHS16GBK`

## 相关资源

- [Oracle Instant Client 官方文档](https://www.oracle.com/cn/database/technologies/instant-client/downloads.html)
- [SQL*Plus 用户指南](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqpug/)

## 注意事项

1. Oracle Instant Client 是免费软件，但需要接受 Oracle 许可协议
2. 19c 版本是长期支持版本，推荐使用
3. 安装完成后需要重启命令行窗口才能生效
4. 首次连接可能需要配置防火墙规则

---
*安装完成后如遇到问题，请检查环境变量配置和文件权限。*