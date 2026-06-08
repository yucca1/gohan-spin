#!/bin/bash
set -euo pipefail

# ---------------------------------------------------------------------------
# 設定: ブラックリストコマンド (パターン)
# ---------------------------------------------------------------------------
BLACKLIST_PATTERNS=(
  'rm -rf /'
  'rm -rf ~'
  'rm -rf \.'
  'rm -rf \*'
  'rm -fr'
  'mkfs\.'
  'dd if='
  ':(){:|:&};:'           # fork bomb
  'chmod -R 777 /'
  'chown -R .* /'
  'git push.*--force'
  'git reset --hard'
  'git clean -fdx'
  '> /dev/sda'
  'shutdown'
  'reboot'
  'init 0'
  'init 6'
)

# ---------------------------------------------------------------------------
# stdin から JSON を読み取り、Bash コマンドを抽出
# ---------------------------------------------------------------------------
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [[ -z "$COMMAND" ]]; then
  exit 0
fi

# ---------------------------------------------------------------------------
# ブラックリストチェック
# ---------------------------------------------------------------------------
for pattern in "${BLACKLIST_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qiE "$pattern"; then
    jq -n \
      --arg reason "ブロック: 危険なコマンドパターン '$pattern' が検出されました。コマンド: $COMMAND" \
      '{
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: $reason
        }
      }'
    exit 0
  fi
done

# ---------------------------------------------------------------------------
# すべてのチェックをパス → 通常の権限フローへ
# ---------------------------------------------------------------------------
exit 0