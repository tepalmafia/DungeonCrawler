# 로컬 검증용 정적 서버 — tools/verify.js 가 이걸 붙잡고 돈다.
#   python3 tools/serve.py &   (기본 127.0.0.1:8137, web/ 를 루트로)
#
# ★ /3d/assets/index.json 만 특별 취급한다
#   브라우저는 폴더를 못 훑는다. 그래서 게임은 「어떤 그림이 들어와 있나」를
#   목록 파일 하나로 읽는다 (web/3d/js/core/assets.js).
#   로컬에서는 그 목록을 **요청받을 때마다 폴더를 훑어** 만들어 준다 —
#   그래야 그림을 넣고 새로고침하면 바로 나온다. 목록을 손으로 고치게 하면
#   「넣었는데 안 나온다」가 반드시 생긴다.
#   배포용(GitHub Pages)은 `node tools/assets.js --write` 가 만들어 커밋한다.
import http.server, socketserver, os, sys, json

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web')
os.chdir(ROOT)
ASSETS = os.path.join(os.getcwd(), '3d', 'assets')


def scan():
    out = []
    for sub in ('fx', 'tiles', 'icons'):
        d = os.path.join(ASSETS, sub)
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            if f.lower().endswith('.png'):
                out.append(f'{sub}/{f}')
    return out


class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

    def do_GET(self):
        if self.path.split('?')[0] == '/3d/assets/index.json':
            body = json.dumps(scan()).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


class S(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8137
S(('127.0.0.1', port), H).serve_forever()
