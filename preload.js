const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  toggle: () => ipcRenderer.invoke('toggle'),
  moveWindow: (x, y, finished = false) =>
    ipcRenderer.send(finished ? 'move-window-end' : 'move-window', { x, y }),
  search: (q) => ipcRenderer.invoke('search', q),
  download: (p) => ipcRenderer.invoke('download', p),
  quit: () => ipcRenderer.invoke('quit')
});
