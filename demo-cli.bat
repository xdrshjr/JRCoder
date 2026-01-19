@echo off
REM OpenJRAgent CLI 功能演示脚本 (Windows)

echo ==================================
echo OpenJRAgent CLI 功能演示
echo ==================================
echo.

REM 1. 显示版本
echo 1. 显示版本信息
node dist/cli/index.js --version
echo.

REM 2. 显示帮助
echo 2. 显示帮助信息
node dist/cli/index.js --help
echo.

REM 3. 显示配置
echo 3. 显示当前配置
node dist/cli/index.js config:show
echo.

REM 4. 导出配置
echo 4. 导出配置到控制台
node dist/cli/index.js config:export
echo.

REM 5. 列出会话
echo 5. 列出所有会话
node dist/cli/index.js sessions
echo.

REM 6. 显示run命令帮助
echo 6. 显示run命令详细帮助
node dist/cli/index.js run --help
echo.

echo ==================================
echo 演示完成！
echo ==================================
echo.
echo 提示: 要运行Agent，请使用:
echo   node dist/cli/index.js run "你的任务描述"
echo.
echo 更多信息请查看: docs/CLI-USAGE.md
