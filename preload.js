const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

  onFileSaved: (callback) => {
        ipcRenderer.on('file-saved', callback);
    },
    
  saveFile: (path, content) => ipcRenderer.invoke('save-file', { path, content }),
  saveFileAs: (content) => ipcRenderer.invoke('save-file-as', content),
  readDirectory: (path) => ipcRenderer.invoke('read-directory', path),
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  renameFile: (oldPath, newName) => ipcRenderer.invoke('rename-file', { oldPath, newName }),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
  exportToBrowser: (htmlContent, filePath) => ipcRenderer.invoke('export-to-browser', { htmlContent, filePath }),
  
  runCode: (code, path) => ipcRenderer.invoke('run-code', { code, path }),
  lintPython: (code, path) => ipcRenderer.invoke('lint-python', { code, path }),
  
  spawnTerminal: (options) => ipcRenderer.invoke('spawn-terminal', options),
  terminalInput: (data) => ipcRenderer.invoke('terminal-input', data),
  killTerminal: (terminalId) => ipcRenderer.invoke('kill-terminal', terminalId),
  onTerminalOutput: (callback) => ipcRenderer.on('terminal-output', callback),
  onTerminalError: (callback) => ipcRenderer.on('terminal-error', callback),
  onTerminalClosed: (callback) => ipcRenderer.on('terminal-closed', callback),
  getHomeDir: () => ipcRenderer.invoke('getHomeDir'),

  onNewFile: (callback) => ipcRenderer.on('menu-new-file', callback),
  onSaveFile: (callback) => ipcRenderer.on('menu-save-file', callback),
  onSaveAs: (callback) => ipcRenderer.on('menu-save-as', callback),
  onRunCode: (callback) => ipcRenderer.on('menu-run-code', callback),
  onLintCode: (callback) => ipcRenderer.on('menu-lint-code', callback),
  onFileOpened: (callback) => ipcRenderer.on('file-opened', callback),
  
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});