// мост между программой и оболочкой: версия оболочки, обновление в один клик и его прогресс
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('SIGNAL_DESKTOP', {
  shell: require('./package.json').version,
  platform: process.platform,
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  update: () => ipcRenderer.invoke('update'),
  onProgress: cb => ipcRenderer.on('upd-progress', (e, p) => cb(p)),
});
