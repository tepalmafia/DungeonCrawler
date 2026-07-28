# 로컬 검증용 정적 서버 — tools/verify.js 가 이걸 붙잡고 돈다.
#   python3 tools/serve.py &   (기본 127.0.0.1:8137, web/ 를 루트로)
import http.server, socketserver, os, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web')
os.chdir(ROOT)
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class S(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8137
S(('127.0.0.1', port), H).serve_forever()
