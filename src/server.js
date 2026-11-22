import path from 'node:path';
import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { loadConfig, getConfigDir } from './config.js';
import { resolveInRoot } from './security.js';

const MAX_READ_BYTES = 1024 * 1024;
const MAX_WRITE_CHARS = 512 * 1024;
const MAX_DIRECTORY_ITEMS = 500;

function success(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

function failure(error) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: 'text', text: `LocalBridge: ${message}` }], isError: true };
}

async function getRoot(rootId) {
  const config = await loadConfig();
  const root = config.roots.find(item => item.id === rootId);
  if (!root) throw new Error(`La carpeta con ID ${rootId} no está autorizada. Ejecuta "npm run roots" para ver las carpetas disponibles.`);
  return root;
}

async function makeBackup(root, relativePath, sourcePath) {
  const backupBase = path.join(getConfigDir(), 'backups', root.id);
  const safeRelative = relativePath.split(/[\\/]+/).filter(part => part && part !== '.' && part !== '..');
  const folder = path.join(backupBase, ...safeRelative.slice(0, -1));
  await fs.mkdir(folder, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replaceAll(':', '-');
  const originalName = safeRelative.at(-1) || 'file.txt';
  const backupName = `${stamp}-${crypto.randomUUID().slice(0, 8)}-${originalName}`;
  const backupPath = path.join(folder, backupName);
  await fs.copyFile(sourcePath, backupPath);
  await fs.chmod(backupPath, 0o600).catch(() => {});
  return backupPath;
}

async function atomicWrite(targetPath, content) {
  const tempPath = path.join(path.dirname(targetPath), `.localbridge-${crypto.randomUUID()}.tmp`);
  try {
    await fs.writeFile(tempPath, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    try {
      await fs.rename(tempPath, targetPath);
    } catch (error) {
      // Windows may refuse replacing an existing file via rename. The old copy
      // has already been backed up by the caller before this fallback runs.
      if (!['EEXIST', 'EPERM', 'EACCES'].includes(error.code)) throw error;
      await fs.rm(targetPath, { force: true });
      await fs.rename(tempPath, targetPath);
    }
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
}

export function createServer() {
  const server = new McpServer({ name: 'localbridge-chatgpt', version: '0.1.0' });

  server.registerTool(
    'localbridge_status',
    {
      title: 'Estado de LocalBridge',
      description: 'Muestra el estado del conector local y cuántas carpetas han sido autorizadas.',
      inputSchema: z.object({})
    },
    async () => {
      try {
        const config = await loadConfig();
        return success({
          application: 'LocalBridge',
          version: '0.1.0',
          status: 'ready',
          authorizedFolders: config.roots.length,
          commandExecution: 'disabled',
          note: 'La ejecución de comandos está deshabilitada en esta versión inicial.'
        });
      } catch (error) { return failure(error); }
    }
  );

  server.registerTool(
    'localbridge_list_roots',
    {
      title: 'Ver carpetas autorizadas',
      description: 'Lista las carpetas que el usuario autorizó explícitamente para que ChatGPT pueda leerlas o modificarlas.',
      inputSchema: z.object({})
    },
    async () => {
      try {
        const config = await loadConfig();
        return success(config.roots.map(({ id, name, path: folderPath }) => ({ id, name, path: folderPath })));
      } catch (error) { return failure(error); }
    }
  );

  server.registerTool(
    'localbridge_list_directory',
    {
      title: 'Explorar carpeta',
      description: 'Muestra el contenido de una carpeta autorizada. Usa localbridge_list_roots para obtener el root_id. No sigue enlaces simbólicos.',
      inputSchema: z.object({
        root_id: z.string().min(1),
        relative_path: z.string().default('.')
      })
    },
    async ({ root_id, relative_path }) => {
      try {
        const root = await getRoot(root_id);
        const resolved = await resolveInRoot(root.path, relative_path);
        const info = await fs.stat(resolved.path);
        if (!info.isDirectory()) throw new Error('La ruta solicitada no es una carpeta.');
        const dirents = await fs.readdir(resolved.path, { withFileTypes: true });
        const visible = dirents.slice(0, MAX_DIRECTORY_ITEMS);
        const items = await Promise.all(visible.map(async entry => {
          const fullPath = path.join(resolved.path, entry.name);
          const details = await fs.lstat(fullPath);
          return {
            name: entry.name,
            type: details.isSymbolicLink() ? 'symbolic_link' : details.isDirectory() ? 'directory' : details.isFile() ? 'file' : 'other',
            sizeBytes: details.isFile() ? details.size : undefined,
            modifiedAt: details.mtime.toISOString(),
            hidden: entry.name.startsWith('.')
          };
        }));
        return success({ root: root.name, relativePath: relative_path, count: items.length, truncated: dirents.length > MAX_DIRECTORY_ITEMS, items });
      } catch (error) { return failure(error); }
    }
  );

  server.registerTool(
    'localbridge_read_text_file',
    {
      title: 'Leer archivo de texto',
      description: 'Lee un archivo de texto UTF-8 de una carpeta autorizada. No admite archivos binarios ni archivos mayores de 1 MiB.',
      inputSchema: z.object({
        root_id: z.string().min(1),
        relative_path: z.string().min(1),
        max_bytes: z.number().int().min(1).max(MAX_READ_BYTES).default(262144)
      })
    },
    async ({ root_id, relative_path, max_bytes }) => {
      try {
        const root = await getRoot(root_id);
        const resolved = await resolveInRoot(root.path, relative_path);
        const info = await fs.stat(resolved.path);
        if (!info.isFile()) throw new Error('La ruta solicitada no es un archivo normal.');
        if (info.size > max_bytes) throw new Error(`El archivo ocupa ${info.size} bytes y supera el límite solicitado de ${max_bytes} bytes.`);
        const data = await fs.readFile(resolved.path);
        if (data.includes(0)) throw new Error('El archivo parece binario. Solo se permite leer archivos de texto.');
        const text = data.toString('utf8');
        if (!Buffer.from(text, 'utf8').equals(data)) throw new Error('El archivo no parece estar codificado en UTF-8.');
        return success({ root: root.name, relativePath: relative_path, sizeBytes: info.size, content: text });
      } catch (error) { return failure(error); }
    }
  );

  server.registerTool(
    'localbridge_create_directory',
    {
      title: 'Crear carpeta',
      description: 'Crea una carpeta nueva dentro de una carpeta autorizada. La carpeta padre debe existir.',
      inputSchema: z.object({
        root_id: z.string().min(1),
        relative_path: z.string().min(1)
      })
    },
    async ({ root_id, relative_path }) => {
      try {
        const root = await getRoot(root_id);
        const resolved = await resolveInRoot(root.path, relative_path, { allowMissingFinal: true });
        if (resolved.exists) throw new Error('Ya existe un elemento con esa ruta.');
        await fs.mkdir(resolved.path, { mode: 0o700 });
        return success({ created: true, root: root.name, relativePath: relative_path });
      } catch (error) { return failure(error); }
    }
  );

  server.registerTool(
    'localbridge_write_text_file',
    {
      title: 'Crear o modificar archivo de texto',
      description: 'Escribe texto UTF-8 dentro de una carpeta autorizada. No reemplaza un archivo existente salvo que overwrite=true. Antes de reemplazarlo crea una copia de respaldo local.',
      inputSchema: z.object({
        root_id: z.string().min(1),
        relative_path: z.string().min(1),
        content: z.string().max(MAX_WRITE_CHARS),
        overwrite: z.boolean().default(false)
      })
    },
    async ({ root_id, relative_path, content, overwrite }) => {
      try {
        const root = await getRoot(root_id);
        const resolved = await resolveInRoot(root.path, relative_path, { allowMissingFinal: true });
        let backupPath;
        if (resolved.exists) {
          const info = await fs.stat(resolved.path);
          if (!info.isFile()) throw new Error('Solo se pueden reemplazar archivos normales.');
          if (!overwrite) throw new Error('El archivo ya existe. Repite la operación con overwrite=true para autorizar su reemplazo.');
          if (info.size > MAX_READ_BYTES * 4) throw new Error('El archivo existente supera 4 MiB; no se reemplazará desde esta versión.');
          backupPath = await makeBackup(root, relative_path, resolved.path);
        }
        await atomicWrite(resolved.path, content);
        return success({
          written: true,
          created: !resolved.exists,
          root: root.name,
          relativePath: relative_path,
          bytesWritten: Buffer.byteLength(content, 'utf8'),
          backupPath: backupPath ?? null
        });
      } catch (error) { return failure(error); }
    }
  );

  return server;
}
