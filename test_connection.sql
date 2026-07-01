-- 简单的数据库连接测试脚本
-- 用于验证 SQL*Plus 连接性和基本功能

SET DEFINE OFF
SET linesize 120
SET pagesize 100
SET trimspool ON

-- 显示当前时间
SELECT TO_CHAR(SYSDATE, 'YYYY-MM-DD HH24:MI:SS') AS current_time FROM dual;

-- 显示当前用户
SELECT USER AS current_user FROM dual;

-- 显示数据库版本
SELECT * FROM v$version WHERE rownum = 1;

-- 显示数据库实例名称
SELECT instance_name AS database_instance FROM v$instance;

-- 显示数据库状态
SELECT database_name, status, log_mode FROM v$database;

EXIT;