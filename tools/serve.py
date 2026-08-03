# 로컬 검증용 정적 서버 — web/ 을 루트로 띄운다.
#   python3 tools/serve.py 8137
#     던전       http://127.0.0.1:8137/3d/
#     스페이스워  http://127.0.0.1:8137/space/
#
# ★ <게임>/assets/index.json 만 특별 취급한다
#   브라우저는 폴더를 못 훑는다. 그래서 게임은 「어떤 그림이 들어와 있나」를
#   목록 파일 하나로 읽는다 (js/core/assets.js).
#   로컬에서는 그 목록을 **요청받을 때마다 폴더를 훑어** 만들어 준다 —
#   그래야 그림을 넣고 새로고침하면 바로 나온다. 목록을 손으로 고치게 하면
#   「넣었는데 안 나온다」가 반드시 생긴다.
#   배포용(GitHub Pages)은 `node tools/assets.js --write` 가 만들어 커밋한다.
#
# ★ 게임 이름을 하드코딩하지 않는다
#   원래는 '/3d/assets/index.json' 하나만 봤다. 게임이 둘이 되면서 스페이스워
#   쪽은 조용히 404 가 났을 것이다 — 그림을 넣어도 아무 일이 안 일어나고
#   오류도 안 나는, 제일 나쁜 종류다 (docs/POSTMORTEM.md §1-⑤).
#   그래서 경로 모양으로 받는다. 게임이 늘어도 여기는 안 고친다.
import http.server, socketserver, os, sys, json, re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web')
os.chdir(ROOT)

# /<게임>/assets/index.json — 게임 이름은 뭐든 받는다
INDEX_RE = re.compile(r'^/([\w-]+)/assets/index\.json$')


def scan(game):
    """web/<게임>/assets/ 아래 그림 목록. 하위 폴더 이름은 안 가린다 —
    게임마다 분류가 다르고, 여기서 정해 두면 새 분류가 조용히 빠진다."""
    base = os.path.join(os.getcwd(), game, 'assets')
    out = []
    if not os.path.isdir(base):
        return out
    for sub in sorted(os.listdir(base)):
        d = os.path.join(base, sub)
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                out.append(f'{sub}/{f}')
    return out


class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

    def do_GET(self):
        m = INDEX_RE.match(self.path.split('?')[0])
        if m:
            body = json.dumps(scan(m.group(1))).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def end_headers(self):
        # 로컬에서는 캐시를 아예 안 쓴다. ?v= 를 깜빡해도 새로고침이 먹게 —
        # 「고쳤는데 화면이 그대로다」의 절반은 여기서 났다.
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


class S(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8137
print(f'  던전       http://127.0.0.1:{port}/3d/')
print(f'  스페이스워  http://127.0.0.1:{port}/space/')
S(('127.0.0.1', port), H).serve_forever()
