#!/bin/bash
# 검증 실행기 — 서버를 띄우고 tools/verify.js 를 돌린다.
#   ./tools/run-verify.sh 166
cd "$(dirname "$0")/.."
PORT=${VERIFY_PORT:-8137}
# playwright-core 위치 (스크래치패드에 설치돼 있으면 그걸 쓴다)
for c in ./node_modules /tmp/claude-0/*/*/scratchpad/node_modules; do
  [ -d "$c/playwright-core" ] && export NODE_PATH="$c" && break
done
curl -s -o /dev/null "http://127.0.0.1:$PORT/index.html" || {
  echo "서버 기동 중 (포트 $PORT)…"; (python3 tools/serve.py "$PORT" >/dev/null 2>&1 &); sleep 2;
}
exec node tools/verify.js "$@"
