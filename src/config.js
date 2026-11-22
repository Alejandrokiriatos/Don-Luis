import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';

const CONFIG_VERSION = 1;

export function getConfigDir() {
  if (process.env.LOCALBRIDGE_HOME) return path.resolve(process.env.LOCALBRIDGE_HOME);
  const base = process.env.APPDATA || path.join(os.homedir(), '.config');
  return path.join(base, 'LocalBridge');
}

export function getConfigFile() {
  return path.join(getConfigDir(), 'config.json');
}

export function defaultConfig() {
  return {
    schemaVersion: CONFIG_VERSION,
    roots: [],
    security: { commandExecutionEnabled: false }
  };
}

export async function ensureConfigDir() {
  const dir = getConfigDir();
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  return dir;
}

function validateConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('El archivo de configuración no contiene un objeto válido.');
  }
  if (value.schemaVersion !== CONFIG_VERSION) {
    throw new Error(`Versión de configuración no compatible: ${value.schemaVersion ?? 'desconocida'}.`);
  }
  if (!Array.isArray(value.roots)) {
    throw new Error('La configuración no contiene una lista válida de carpetas autorizadas.');
  }

  const ids = new Set();
  for (const root of value.roots) {
    if (!root || typeof root.id !== 'string' || typeof root.path !== 'string' || typeof root.name !== 'string') {
      throw new Error('Hay una carpeta autorizada con datos incompletos.');
    }
    if (ids.has(root.id)) throw new Error('Hay identificadores de carpetas duplicados.');
    ids.add(root.id);
  }

  if (!value.security || typeof value.security !== 'object') value.security = {};
  value.security.commandExecutionEnabled = value.security.commandExecutionEnabled === true;
  return value;
}

export async function loadConfig() {
  await ensureConfigDir();
  const file = getConfigFile();
  try {
    const raw = await fs.readFile(file, 'utf8');
    return validateConfig(JSON.parse(raw));
  } catch (error) {
    if (error.code === 'ENOENT') {
      const config = defaultConfig();
      await saveConfig(config);
      return config;
    }
    if (error instanceof SyntaxError) {
      throw new Error(`No se pudo interpretar ${file}. No se sobrescribió el archivo para evitar perder tu configuración.`);
    }
    throw error;
  }
}

export async function saveConfig(config) {
  validateConfig(config);
  const dir = await ensureConfigDir();
  const target = path.join(dir, 'config.json');
  const temp = path.join(dir, `config.${crypto.randomUUID()}.tmp`);
  try {
    await fs.writeFile(temp, `${JSON.stringify(config, null, 2)}\n`, {
      encoding: 'utf8', flag: 'wx', mode: 0o600
    });
    await fs.rename(temp, target);
  } catch (error) {
    await fs.rm(temp, { force: true }).catch(() => {});
    throw error;
  }
}

export async function addRoot(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') throw new Error('Indica la ruta de una carpeta.');
  const canonical = await fs.realpath(path.resolve(inputPath));
  const info = await fs.stat(canonical);
  if (!info.isDirectory()) throw new Error('La ruta indicada no es una carpeta.');

  const config = await loadConfig();
  const comparison = process.platform === 'win32' ? canonical.toLowerCase() : canonical;
  const exists = config.roots.some(root => {
    const existing = process.platform === 'win32' ? root.path.toLowerCase() : root.path;
    return existing === comparison;
  });
  if (exists) throw new Error('Esa carpeta ya está autorizada.');

  const entry = {
    id: crypto.randomUUID().slice(0, 8),
    name: path.basename(canonical) || canonical,
    path: canonical,
    addedAt: new Date().toISOString()
  };
  config.roots.push(entry);
  await saveConfig(config);
  return entry;
}

export async function removeRoot(id) {
  const config = await loadConfig();
  const before = config.roots.length;
  config.roots = config.roots.filter(root => root.id !== id);
  if (config.roots.length === before) throw new Error(`No existe una carpeta autorizada con ID ${id}.`);
  await saveConfig(config);
}
