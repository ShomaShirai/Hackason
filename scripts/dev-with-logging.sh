#!/bin/bash

# ログディレクトリを作成
mkdir -p logs

# タイムスタンプを生成
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="logs/wrangler-${TIMESTAMP}.log"

echo "Starting development server with logging..."
echo "Log file: ${LOG_FILE}"
echo "Press Ctrl+C to stop the server"
echo "---"

# Wranglerを実行し、標準出力とエラー出力の両方をファイルに記録しつつ、画面にも表示
WRANGLER_LOG=debug npx wrangler dev 2>&1 | tee "${LOG_FILE}"