import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';

export function getChatGptConfigPath(homeDir = os.homedir()) {
  return path.join(homeDir, '.codex', 'config.toml');
}

function tomlString(value) {
  return JSON.stringify(String(value).replaceAll('\\', '/'));
}

export function buildManagedConfigBlock({ command = 'node', bundlePath, cwd }) {
  if (!bundlePath || !path.isAbsolute(bundlePath)) throw new Error('La ruta del servidor MCP debe ser absoluta.');
  if (!cwd || !path.isAbsolute(cwd)) throw new Error('La carpeta de trabajo debe ser absoluta.');

  return [
    '# BEGIN LOCALBRIDGE MANAGED BLOCK',
    '[mcp_servers.localbridge]',
    'enabled = true',
    `command = ${tomlString(command)}`,
    `args = [${tomlString(bundlePath)}]`,
    `cwd = ${tomlString(cwd)}`,
    'startup_timeout_sec = 20',
    'tool_timeout_sec = 120',
    'default_tools_approval_mode = "prompt"',
    '# END LOCALBRIDGE MANAGED BLOCK'
  ].join('\n');
}

export function mergeManagedConfig(original, block) {
  const start = '# BEGIN LOCALBRIDGE MANAGED BLOCK';
  const end = '# END LOCALBRIDGE MANAGED BLOCK';
  const startIndex = original.indexOf(start);
  const endIndex = original.indexOf(end);

  if ((startIndex >= 0) !== (endIndex >= 0) || (startIndex >= 0 && endIndex < startIndex)) {
    throw new Error('La sección administrada de LocalBridge en config.toml está incompleta. Se conservó el archivo sin cambios.');
  }

  if (startIndex >= 0) {
    const endAfter = endIndex + end.length;
    return `${original.slice(0, startIndex).replace(/\s*$/, '')}\n\n${block}\n${original.slice(endAfter).replace(/^\s*/, '')}`;
  }

  if (/^\s*\[mcp_servers\.localbridge\]\s*$/m.test(original)) {
    throw new Error('Ya existe una entrada mcp_servers.localbridge que LocalBridge no administra. Se conservó config.toml sin cambios.');
  }

  const prefix = original.trimEnd();
  return prefix ? `${prefix}\n\n${block}\n` : `${block}\n`;
}

export function removeManagedConfig(original) {
  const start = '# BEGIN LOCALBRIDGE MANAGED BLOCK';
  const end = '# END LOCALBRIDGE MANAGED BLOCK';
  const startIndex = original.indexOf(start);
  const endIndex = original.indexOf(end);

  if (startIndex < 0 && endIndex < 0) return original;
  if (startIndex < 0 || endIndex < startIndex) {
    throw new Error('La sección administrada de LocalBridge está incompleta. No se modificó config.toml.');
  }

  const endAfter = endIndex + end.length;
  return `${original.slice(0, startIndex).replace(/\s*$/, '')}\n${original.slice(endAfter).replace(/^\s*/, '')}`.trimStart();
}

export async function connectChatGptDesktop({ bundlePath, cwd, configPath = getChatGptConfigPath() }) {
  await fs.access(bundlePath);
  const block = buildManagedConfigBlock({ bundlePath, cwd });
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  let original = '';
  try {
    original = await fs.readFile(configPath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const merged = mergeManagedConfig(original, block);
  const temp = `${configPath}.${crypto.randomUUID()}.tmp`;
  if (original) {
    const stamp = new Date().toISOString().replaceAll(':', '-');
    await fs.copyFile(configPath, `${configPath}.localbridge-backup-${stamp}`);
  }
  try {
    await fs.writeFile(temp, merged, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    await fs.rename(temp, configPath);
  } catch (error) {
    await fs.rm(temp, { force: true }).catch(() => {});
    throw error;
  }
  return { configPath, backedUp: Boolean(original) };
}

export async function disconnectChatGptDesktop({ configPath = getChatGptConfigPath() } = {}) {
  let original;
  try {
    original = await fs.readFile(configPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return { removed: false, configPath };
    throw error;
  }

  const updated = removeManagedConfig(original);
  if (updated === original) return { removed: false, configPath };
  const stamp = new Date().toISOString().replaceAll(':', '-');
  await fs.copyFile(configPath, `${configPath}.localbridge-backup-${stamp}`);
  const temp = `${configPath}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temp, updated, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    await fs.rename(temp, configPath);
  } catch (error) {
    await fs.rm(temp, { force: true }).catch(() => {});
    throw error;
  }
  return { removed: true, configPath };
}

export async function isChatGptDesktopConnected(configPath = getChatGptConfigPath()) {
  try {
    const contents = await fs.readFile(configPath, 'utf8');
    return contents.includes('# BEGIN LOCALBRIDGE MANAGED BLOCK') &&
      contents.includes('# END LOCALBRIDGE MANAGED BLOCK') &&
      /^\[mcp_servers\.localbridge\]$/m.test(contents);
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}
