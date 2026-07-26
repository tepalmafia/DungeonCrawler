// 렌더러에 노출되는 데스크톱 브리지 — Store/도전과제/전체화면이 이걸 감지해 갈아탄다
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  loadSave: () => ipcRenderer.invoke('save:load'),
  storeSave: (data) => ipcRenderer.invoke('save:store', data),
  unlockAchievement: (id) => ipcRenderer.invoke('steam:achievement', id),
  setFullscreen: (on) => ipcRenderer.invoke('win:fullscreen', on),
});
