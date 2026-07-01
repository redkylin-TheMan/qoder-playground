SET DEFINE OFF
SET linesize 220
SET pagesize 200
SET trimspool ON
WHENEVER SQLERROR CONTINUE

PROMPT ============================================================
PROMPT Database Verification Report
PROMPT ============================================================
PROMPT

PROMPT [1] Basic Connection Info:
PROMPT ----------------------------------------
SELECT TO_CHAR(SYSDATE, 'YYYY-MM-DD HH24:MI:SS') AS check_time,
       USER AS current_user,
       SYS_CONTEXT('USERENV', 'INSTANCE_NAME') AS instance_name,
       SYS_CONTEXT('USERENV', 'SERVICE_NAME') AS service_name
FROM dual;
PROMPT

PROMPT [2] Database Version:
PROMPT ----------------------------------------
SELECT * FROM v$version WHERE rownum = 1;
PROMPT

PROMPT [3] User Tables Count:
PROMPT ----------------------------------------
SELECT COUNT(*) AS total_tables FROM user_tables;
PROMPT

PROMPT [4] User Tables (First 20):
PROMPT ----------------------------------------
SELECT table_name, num_rows, last_analyzed
FROM user_tables
ORDER BY table_name
FETCH FIRST 20 ROWS ONLY;
PROMPT

PROMPT [5] Constraints Summary:
PROMPT ----------------------------------------
SELECT constraint_type,
       COUNT(*) AS count,
       CASE constraint_type
           WHEN 'C' THEN 'CHECK'
           WHEN 'P' THEN 'PRIMARY KEY'
           WHEN 'U' THEN 'UNIQUE'
           WHEN 'R' THEN 'FOREIGN KEY'
           ELSE 'OTHER'
       END AS type_desc
FROM user_constraints
GROUP BY constraint_type
ORDER BY constraint_type;
PROMPT

PROMPT [6] CHECK Constraints (First 10):
PROMPT ----------------------------------------
SELECT table_name,
       constraint_name,
       search_condition,
       status
FROM user_constraints
WHERE constraint_type = 'C'
ORDER BY table_name, constraint_name
FETCH FIRST 10 ROWS ONLY;
PROMPT

PROMPT [7] Current User Sessions:
PROMPT ----------------------------------------
SELECT sid,
       serial#,
       status,
       logon_time,
       module,
       action
FROM v$session
WHERE username = USER
ORDER BY logon_time DESC;
PROMPT

PROMPT [8] Database Status:
PROMPT ----------------------------------------
SELECT d.database_name,
       d.status,
       d.log_mode,
       i.status,
       i.startup_time
FROM v$database d
CROSS JOIN v$instance i;
PROMPT

PROMPT ============================================================
PROMPT Verification Complete
PROMPT ============================================================

EXIT;