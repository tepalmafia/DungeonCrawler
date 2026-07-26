// 무덤에서 왕좌까지 — Electron 메인 프로세스 (스팀 래퍼)
// 역할: 창 관리(16:9·전체화면), 세이브 파일 IPC, 스팀워크스 연동(있으면)
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const SAVE_PATH = () => path.join(app.getPath('userData'), 'save.json');

// ── 스팀워크스 (optional): 설치돼 있고 스팀에서 실행됐을 때만 활성 ──
let steam = null;
try {
  const sw = require('steamworks.js');
  steam = sw.init(); // steam_appid.txt 또는 스팀 클라이언트 필요
  console.log('[steam] 연결:', steam.localplayer.getName());
} catch (e) {
  console.log('[steam] 미연결 (개발 모드):', e.message);
}

// ── 세이브 파일 IPC — 렌더러의 Store가 localStorage 대신 이 파일을 쓴다 ──
ipcMain.handle('save:load', () => {
  try { return JSON.parse(fs.readFileSync(SAVE_PATH(), 'utf8')); } catch (e) { return {}; }
});
ipcMain.handle('save:store', (_ev, data) => {
  try {
    fs.mkdirSync(path.dirname(SAVE_PATH()), { recursive: true });
    // 원자적 쓰기: 임시 파일 → rename (크래시로 세이브가 깨지지 않게)
    const tmp = SAVE_PATH() + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, SAVE_PATH());
    return true;
  } catch (e) { return false; }
});
ipcMain.handle('steam:achievement', (_ev, id) => {
  if (!steam) return false;
  try { steam.achievement.activate(id); return true; } catch (e) { return false; }
});
ipcMain.handle('win:fullscreen', (ev, on) => {
  const win = BrowserWindow.fromWebContents(ev.sender);
  if (win) win.setFullScreen(!!on);
  return win ? win.isFullScreen() : false;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: '#08080f',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'web', 'index.html'));
  // F11 전체화면 (설정 패널 토글과 동일 경로)
  win.webContents.on('before-input-event', (ev, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      ev.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
