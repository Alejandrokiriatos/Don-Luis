import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } from 'electron';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadConfig, addRoot, removeRoot } from '../src/config.js';
import { connectChatGptDesktop, disconnectChatGptDesktop, getChatGptConfigPath, isChatGptDesktopConnected } from './chatgpt-config.js';

const execFileAsync = promisify(execFile);
const APP_ID = 'com.localbridge.chatgpt';
const MAX_LOG_LINES = 250;
let mainWindow;
let tunnelProcess;
let tunnelLogs = [];
let tunnelState = { status: 'stopped', message: 'El túnel todavía no está iniciado.' };

function emit(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function setTunnelState(status, message) {
  tunnelState = { status, message, updatedAt: new Date().toISOString() };
  emit('tunnel:state', tunnelState);
}

function addLog(message, level = 'info') {
  const safe = String(message).replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[clave oculta]').slice(0, 2000);
  const entry = { time: new Date().toISOString(), level, message: safe };
  tunnelLogs.push(entry);
  if (tunnelLogs.length > MAX_LOG_LINES) tunnelLogs = tunnelLogs.slice(-MAX_LOG_LINES);
  emit('tunnel:log', entry);
}

function userDataPath(...parts) {
  return path.join(app.getPath('userData'), ...parts);
}

function getMcpBundlePath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'mcp-server.js');
  }
  return path.join(app.getAppPath(), 'dist', 'mcp-server.js');
}

function secretsPath() {
  return userDataPath('secrets.dat');
}

async function readSecrets() {
  try {
    const encrypted = await fs.readFile(secretsPath());
    if (!safeStorage.isEncryptionAvailable()) throw new Error('El cifrado seguro de Windows no está disponible.');
    const decoded = safeStorage.decryptString(encrypted);
    return JSON.parse(decoded);
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function writeSecrets(value) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Windows no habilitó el almacenamiento cifrado. No se guardó la clave.');
  }
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  const temp = userDataPath(`secrets.${crypto.randomUUID()}.tmp`);
  const bytes = safeStorage.encryptString(JSON.stringify(value));
  try {
    await fs.writeFile(temp, bytes, { flag: 'wx', mode: 0o600 });
    await fs.rename(temp, secretsPath());
  } catch (error) {
    await fs.rm(temp, { force: true }).catch(() => {});
    throw error;
  }
}

async function getInstallInfo() {
  try {
    return JSON.parse(await fs.readFile(userDataPath('install-info.json'), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function saveInstallInfo(info) {
  const temp = userDataPath(`install-info.${crypto.randomUUID()}.tmp`);
  try {
    await fs.writeFile(temp, JSON.stringify(info, null, 2), { flag: 'wx', mode: 0o600 });
    await fs.rename(temp, userDataPath('install-info.json'));
  } catch (error) {
    await fs.rm(temp, { force: true }).catch(() => {});
    throw error;
  }
}

async function checkNode() {
  try {
    const { stdout } = await execFileAsync('node', ['--version'], { windowsHide: true, timeout: 8000 });
    const version = stdout.trim();
    const major = Number(version.replace(/^v/, '').split('.')[0]);
    return { available: major >= 22, version, message: major >= 22 ? 'Node.js compatible.' : 'Se necesita Node.js 22 o superior.' };
  } catch {
    return { available: false, version: null, message: 'No se encontró Node.js en PATH. Instala Node.js 22 o superior.' };
  }
}

async function getBootstrap() {
  const config = await loadConfig();
  const secrets = await readSecrets();
  const installInfo = await getInstallInfo();
  const node = await checkNode();
  const desktopConnected = await isChatGptDesktopConnected();
  const configuredClient = installInfo.tunnelClientPath;
  const installed = Boolean(configuredClient && await fs.access(configuredClient).then(() => true).catch(() => false));
  return {
    app: { name: 'LocalBridge', version: app.getVersion(), platform: process.platform, arch: process.arch },
    roots: config.roots.map(({ id, name, path: rootPath, addedAt }) => ({ id, name, path: rootPath, addedAt })),
    chatgptDesktop: { connected: desktopConnected, configPath: getChatGptConfigPath() },
    node,
    tunnel: {
      ...tunnelState,
      clientInstalled: installed,
      clientVersion: installInfo.tunnelClientVersion ?? null,
      tunnelId: secrets.tunnelId ?? '',
      credentialsSaved: Boolean(secrets.tunnelId && secrets.runtimeApiKey),
      keyMasked: Boolean(secrets.runtimeApiKey)
    },
    logs: tunnelLogs
  };
}

function quoteCommandArg(value) {
  // tunnel-client parses the stdio command using a shell-like tokenizer.
  // Forward slashes avoid Windows backslash escape ambiguity.
  const normalized = value.replaceAll('\\', '/');
  return `"${normalized.replaceAll('"', '\\"')}"`;
}

function powershellLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'LocalBridge-Desktop' } });
  if (!response.ok) throw new Error(`Descarga no disponible (${response.status}).`);
  return response.text();
}

async function downloadVerifiedTunnelClient(onProgress) {
  if (process.platform !== 'win32') throw new Error('El instalador automático está preparado para Windows.');
  const arch = process.arch === 'arm64' ? 'arm64' : process.arch === 'x64' ? 'amd64' : null;
  if (!arch) throw new Error(`Arquitectura Windows no compatible: ${process.arch}.`);

  const releaseResponse = await fetch('https://api.github.com/repos/openai/tunnel-client/releases/latest', {
    headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'LocalBridge-Desktop' }
  });
  if (!releaseResponse.ok) throw new Error(`No se pudo consultar la versión oficial de tunnel-client (${releaseResponse.status}).`);
  const release = await releaseResponse.json();
  const assetName = `tunnel-client-${release.tag_name}-windows-${arch}.zip`;
  const asset = release.assets?.find(item => item.name === assetName);
  const sums = release.assets?.find(item => item.name === 'SHA256SUMS.txt');
  if (!asset || !sums) throw new Error('La publicación oficial no contiene el ZIP esperado y su archivo de hashes.');

  const sumsText = await fetchText(sums.browser_download_url);
  const checksumLine = sumsText.split(/\r?\n/).find(line => line.trim().endsWith(assetName));
  const expectedHash = checksumLine?.trim().split(/\s+/)[0]?.toLowerCase();
  if (!expectedHash || !/^[a-f0-9]{64}$/.test(expectedHash)) {
    throw new Error('No se pudo validar el SHA-256 publicado para tunnel-client.');
  }

  onProgress({ stage: 'download', percent: 0, message: `Descargando tunnel-client ${release.tag_name} desde OpenAI…` });
  const archiveResponse = await fetch(asset.browser_download_url, { headers: { 'User-Agent': 'LocalBridge-Desktop' } });
  if (!archiveResponse.ok) throw new Error(`Falló la descarga del cliente oficial (${archiveResponse.status}).`);
  const bytes = Buffer.from(await archiveResponse.arrayBuffer());
  if (bytes.length > 50 * 1024 * 1024) throw new Error('El archivo descargado supera el tamaño máximo permitido.');
  const actualHash = crypto.createHash('sha256').update(bytes).digest('hex');
  if (actualHash !== expectedHash) throw new Error('La verificación SHA-256 falló. El archivo descargado no se instalará.');
  onProgress({ stage: 'verify', percent: 85, message: 'Firma de integridad SHA-256 comprobada.' });

  const binDir = userDataPath('bin');
  const tempDir = userDataPath(`download-${crypto.randomUUID()}`);
  const zipPath = path.join(tempDir, assetName);
  const extractDir = path.join(tempDir, 'extracted');
  await fs.mkdir(extractDir, { recursive: true });
  await fs.writeFile(zipPath, bytes, { flag: 'wx', mode: 0o600 });
  try {
    const command = `$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath ${powershellLiteral(zipPath)} -DestinationPath ${powershellLiteral(extractDir)} -Force`;
    await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
      windowsHide: true, timeout: 120000, maxBuffer: 2 * 1024 * 1024
    });
    async function findExe(folder) {
      const entries = await fs.readdir(folder, { withFileTypes: true });
      for (const entry of entries) {
        const candidate = path.join(folder, entry.name);
        if (entry.isFile() && entry.name.toLowerCase() === 'tunnel-client.exe') return candidate;
        if (entry.isDirectory()) {
          const found = await findExe(candidate);
          if (found) return found;
        }
      }
      return null;
    }
    const extractedExe = await findExe(extractDir);
    if (!extractedExe) throw new Error('El ZIP oficial no contiene tunnel-client.exe.');
    await fs.mkdir(binDir, { recursive: true });
    const finalPath = path.join(binDir, 'tunnel-client.exe');
    await fs.copyFile(extractedExe, finalPath);
    await saveInstallInfo({ tunnelClientPath: finalPath, tunnelClientVersion: release.tag_name, installedAt: new Date().toISOString() });
    onProgress({ stage: 'complete', percent: 100, message: `tunnel-client ${release.tag_name} instalado y verificado.` });
    return { path: finalPath, version: release.tag_name };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function startTunnel() {
  if (process.platform !== 'win32') throw new Error('La conexión automática está preparada para Windows.');
  if (tunnelProcess && !tunnelProcess.killed) return { started: true, status: tunnelState.status };
  const secrets = await readSecrets();
  if (!secrets.tunnelId || !secrets.runtimeApiKey) throw new Error('Primero guarda el Tunnel ID y la Runtime API Key.');
  const installInfo = await getInstallInfo();
  const executable = installInfo.tunnelClientPath;
  if (!executable || !(await fs.access(executable).then(() => true).catch(() => false))) {
    throw new Error('Primero instala el cliente oficial de OpenAI.');
  }
  const node = await checkNode();
  if (!node.available) throw new Error(node.message);
  const mcpBundle = getMcpBundlePath();
  if (!(await fs.access(mcpBundle).then(() => true).catch(() => false))) {
    throw new Error('No se encontró el paquete MCP. Cierra la aplicación e instala la compilación completa.');
  }

  const command = `node ${quoteCommandArg(mcpBundle)}`;
  const healthFile = userDataPath('tunnel-health-url.txt');
  await fs.rm(healthFile, { force: true }).catch(() => {});
  const args = [
    'run',
    `--control-plane.tunnel-id=${secrets.tunnelId}`,
    '--control-plane.api-key=env:LOCALBRIDGE_TUNNEL_RUNTIME_KEY',
    '--mcp.command', command,
    '--health.listen-addr=127.0.0.1:0',
    `--health.url-file=${healthFile}`,
    '--log.level=info',
    '--log.format=struct-text'
  ];
  tunnelLogs = [];
  setTunnelState('starting', 'Iniciando el cliente oficial de OpenAI…');
  addLog('Preparando conexión cifrada de salida para ChatGPT.');
  tunnelProcess = spawn(executable, args, {
    cwd: app.getPath('userData'),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, LOCALBRIDGE_TUNNEL_RUNTIME_KEY: secrets.runtimeApiKey }
  });

  const child = tunnelProcess;
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => chunk.split(/\r?\n/).filter(Boolean).forEach(line => addLog(line)));
  child.stderr.on('data', chunk => chunk.split(/\r?\n/).filter(Boolean).forEach(line => addLog(line, 'warn')));
  child.once('error', error => {
    addLog(`No se pudo iniciar tunnel-client: ${error.message}`, 'error');
    setTunnelState('error', 'No se pudo iniciar el cliente del túnel.');
    tunnelProcess = null;
  });
  child.once('exit', (code, signal) => {
    addLog(`tunnel-client terminó (código ${code ?? 'desconocido'}, señal ${signal ?? 'ninguna'}).`, code === 0 ? 'info' : 'error');
    tunnelProcess = null;
    setTunnelState('stopped', 'El cliente del túnel está detenido.');
  });

  setTimeout(async () => {
    if (tunnelProcess !== child || child.exitCode !== null) return;
    try {
      const healthUrl = (await fs.readFile(healthFile, 'utf8')).trim();
      if (healthUrl) {
        const ready = await fetch(new URL('/readyz', healthUrl), { signal: AbortSignal.timeout(3000) });
        if (ready.ok) setTunnelState('ready', 'Cliente iniciado y listo; ChatGPT puede consultar el túnel si el conector está configurado.');
        else setTunnelState('starting', 'Cliente iniciado; esperando a que el túnel esté listo.');
      } else {
        setTunnelState('starting', 'Cliente iniciado; esperando el estado de salud del túnel.');
      }
    } catch {
      if (tunnelProcess === child) setTunnelState('starting', 'Cliente iniciado; esperando el estado de salud del túnel.');
    }
  }, 3500);

  return { started: true };
}

async function stopTunnel() {
  if (tunnelProcess && !tunnelProcess.killed) {
    tunnelProcess.kill();
    tunnelProcess = null;
  }
  setTunnelState('stopped', 'El túnel se detuvo desde LocalBridge.');
  addLog('Conexión detenida por el usuario.');
  return { stopped: true };
}

function registerIpc() {
  ipcMain.handle('app:bootstrap', getBootstrap);
  ipcMain.handle('app:add-root', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Selecciona una carpeta para autorizar',
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const root = await addRoot(result.filePaths[0]);
    return { canceled: false, root: { id: root.id, name: root.name, path: root.path } };
  });
  ipcMain.handle('app:remove-root', async (_event, id) => {
    if (typeof id !== 'string' || !/^[a-f0-9-]{6,40}$/i.test(id)) throw new Error('Identificador de carpeta inválido.');
    await removeRoot(id);
    return { removed: true };
  });
  ipcMain.handle('chatgpt:connect-desktop', async () => {
    const node = await checkNode();
    if (!node.available) throw new Error(node.message);
    const bundlePath = getMcpBundlePath();
    const cwd = path.dirname(path.dirname(bundlePath));
    const result = await connectChatGptDesktop({ bundlePath, cwd });
    addLog('Servidor MCP LocalBridge añadido a la configuración local de ChatGPT Desktop.');
    return result;
  });
  ipcMain.handle('chatgpt:disconnect-desktop', async () => {
    const result = await disconnectChatGptDesktop();
    addLog('Se retiró la entrada administrada de LocalBridge de ChatGPT Desktop.');
    return result;
  });
  ipcMain.handle('tunnel:save', async (_event, input) => {
    const tunnelId = String(input?.tunnelId ?? '').trim();
    const runtimeApiKey = String(input?.runtimeApiKey ?? '').trim();
    if (!/^[A-Za-z0-9_-]{12,180}$/.test(tunnelId)) throw new Error('El Tunnel ID no tiene un formato válido.');
    if (runtimeApiKey.length < 20 || runtimeApiKey.length > 500 || /\s/.test(runtimeApiKey)) {
      throw new Error('La Runtime API Key no parece válida.');
    }
    await writeSecrets({ tunnelId, runtimeApiKey });
    addLog('Credenciales de túnel guardadas cifradas mediante el almacenamiento seguro del sistema.');
    return { saved: true };
  });
  ipcMain.handle('tunnel:clear', async () => {
    await stopTunnel();
    await fs.rm(secretsPath(), { force: true });
    return { cleared: true };
  });
  ipcMain.handle('tunnel:install-client', async () => downloadVerifiedTunnelClient(progress => emit('tunnel:install-progress', progress)));
  ipcMain.handle('tunnel:start', startTunnel);
  ipcMain.handle('tunnel:stop', stopTunnel);
  ipcMain.handle('app:open-external', async (_event, url) => {
    if (url !== 'https://platform.openai.com/settings/organization/tunnels' &&
        url !== 'https://developers.openai.com/api/docs/guides/secure-mcp-tunnels') {
      throw new Error('Enlace externo no permitido.');
    }
    await shell.openExternal(url);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1160,
    height: 780,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#f4f5f7',
    title: 'LocalBridge',
    show: false,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'electron', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.loadFile(path.join(app.getAppPath(), 'renderer', 'index.html'));
}

app.setAppUserModelId(APP_ID);
app.whenReady().then(() => {
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  if (tunnelProcess && !tunnelProcess.killed) tunnelProcess.kill();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
