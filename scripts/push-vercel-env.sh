#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${VERCEL_ENV_FILE:-$REPO_ROOT/.env.local}"
ENVIRONMENTS="${VERCEL_ENVIRONMENTS:-development,preview,production}"
VERCEL_PROJECT="${VERCEL_PROJECT_NAME:-}"  # optional, inferred if omitted

if ! command -v vercel >/dev/null 2>&1; then
  echo "[pulsewave] vercel CLI が見つかりません。'npm install -g vercel' などでインストールしてください。" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[pulsewave] 指定された env ファイルが見つかりません: $ENV_FILE" >&2
  exit 1
fi

IFS=',' read -r -a TARGET_ENVS <<<"$ENVIRONMENTS"
if [[ ${#TARGET_ENVS[@]} -eq 0 ]]; then
  echo "[pulsewave] 反映先の環境が指定されていません" >&2
  exit 1
fi

# 事前に vercel login / vercel link 済みであること
if [[ -n "$VERCEL_PROJECT" ]]; then
  VERCEL_LINK_ARGS=("--project" "$VERCEL_PROJECT")
else
  VERCEL_LINK_ARGS=()
fi

if ! vercel whoami >/dev/null 2>&1; then
  echo "[pulsewave] まず 'vercel login' でサインインしてください。" >&2
  exit 1
fi

vercel link "${VERCEL_LINK_ARGS[@]}" >/dev/null 2>&1 || true

echo "[pulsewave] $ENV_FILE から Vercel 環境変数を同期します..."

while IFS='=' read -r raw_key raw_value; do
  # 空行やコメントをスキップ
  if [[ -z "$raw_key" || "$raw_key" =~ ^\s*# ]]; then
    continue
  fi

  key=$(echo "$raw_key" | xargs)
  value=$(echo "$raw_value" | sed 's/^\s*//; s/\s*$//')

  if [[ -z "$key" || -z "$value" ]]; then
    echo "[pulsewave] 空のキーまたは値をスキップしました: '$raw_key'" >&2
    continue
  fi

  for env in "${TARGET_ENVS[@]}"; do
    echo "  - $key -> $env"
    # 既存の値を上書きするため一旦削除（存在しない場合は無視）
    vercel env rm "$key" "$env" -y >/dev/null 2>&1 || true
    printf '%s' "$value" | vercel env add "$key" "$env" >/dev/null
  done

done < "$ENV_FILE"

echo "[pulsewave] 完了しました。Vercel のダッシュボードで値を確認してください。"
