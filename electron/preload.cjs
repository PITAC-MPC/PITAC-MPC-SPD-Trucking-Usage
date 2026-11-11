const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  print: () => ipcRenderer.invoke('sheet:print'),
  savePdf: (suggestedName) => ipcRenderer.invoke('sheet:save-pdf', suggestedName),
})
