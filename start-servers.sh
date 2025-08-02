#!/bin/bash

# バックエンドサーバーを起動
echo "Starting backend server on port 8787..."
npx wrangler dev --local --port 8787 &
BACKEND_PID=$!

# 少し待つ
sleep 5

# フロントエンドサーバーを起動
echo "Starting frontend server on port 5173..."
npm run dev &
FRONTEND_PID=$!

echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"

echo "Servers are starting..."
echo "Frontend: http://localhost:5173"
echo "Backend: http://localhost:8787"

# Ctrl+Cで両方のプロセスを停止
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT

# 両方のプロセスが終了するまで待つ
wait