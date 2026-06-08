#!/bin/bash
set -euo pipefail

LOG_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/config-change.log"

# stdin から JSON を読む
INPUT=$(cat)

# タイムスタンプ
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# source（どの設定ファイルか）と file_path を抽出
FILE_PATH=$(echo "$INPUT" | jq -r '.file_path // "unknown"')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')

# ログに追記
echo "[$TIMESTAMP] session=$SESSION_ID file_path=$FILE_PATH" >> "$LOG_FILE"

# 変更内容の JSON 全体も残したい場合
echo "$INPUT" | jq '.' >> "$LOG_FILE"
echo "---" >> "$LOG_FILE"

# exit 0 → 変更を許可（ブロックしたければ exit 2）
exit 0