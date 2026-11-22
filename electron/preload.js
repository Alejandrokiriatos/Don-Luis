import { contextBridge, ipcRenderer } from 'electron';

const api = {
  bootstrap: () => ipcRenderer.invoke('app:bootstrap'),
  addRoot: () => ipcRenderer.invoke('app:add-root'),
  removeRoot: id => ipcRenderer.invoke('app:remove-root', id),
  saveTunnel: credentials => ipcRenderer.invoke('tunnel:save', credentials),
  clearTunnel: () => ipcRenderer.invoke('tunnel:clear'),
  installTunnelClient: () => ipcRenderer.invoke('tunnel:install-client'),
  startTunnel: () => ipcRenderer.invoke('tunnel:start'),
  stopTunnel: () => ipcRenderer.invoke('tunnel:stop'),
  openExternal: url => ipcRenderer.invoke('app:open-external', url),
  onTunnelState: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('tunnel:state', listener);
    return () => ipcRenderer.removeListener('tunnel:state', listener);
  },
  onTunnelLog: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('tunnel:log', listener);
    return () => ipcRenderer.removeListener('tunnel:log', listener);
  },
  onInstallProgress: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('tunnel:install-progress', listener);
    return () => ipcRenderer.removeListener('tunnel:install-progress', listener);
  }
};

contextBridge.exposeInMainWorld('localBridge', api);
