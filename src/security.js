import path from 'node:path';
import { promises as fs } from 'node:fs';

export function parseRelativePath(input = '.') {
  if (typeof input !== 'string') throw new Error('La ruta relativa debe ser texto.');
  if (input.includes('\0')) throw new Error('La ruta contiene un carácter no permitido.');
  if (path.isAbsolute(input) || path.win32.isAbsolute(input) || /^[a-zA-Z]:/.test(input)) {
    throw new Error('Usa una ruta relativa dentro de la carpeta autorizada, no una ruta absoluta.');
  }

  const segments = input.split(/[\\/]+/).filter(segment => segment !== '' && segment !== '.');
  if (segments.some(segment => segment === '..')) {
    throw new Error('No se permite salir de la carpeta autorizada usando ..');
  }
  if (segments.some(segment => segment.includes(':'))) {
    throw new Error('La ruta contiene un segmento no permitido.');
  }
  return segments;
}

export function isInsideRoot(rootPath, candidatePath) {
  const relative = path.relative(rootPath, candidatePath);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

/**
 * Resolves a relative path under an authorized root without following symlinks.
 * When allowMissingFinal is true, only the final path component may be absent.
 */
export async function resolveInRoot(rootPath, relativePath = '.', { allowMissingFinal = false } = {}) {
  const segments = parseRelativePath(relativePath);
  const canonicalRoot = await fs.realpath(rootPath);
  const rootInfo = await fs.stat(canonicalRoot);
  if (!rootInfo.isDirectory()) throw new Error('La carpeta autorizada ya no está disponible.');

  let current = canonicalRoot;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    let info;
    try {
      info = await fs.lstat(current);
    } catch (error) {
      if (error.code === 'ENOENT' && allowMissingFinal && index === segments.length - 1) {
        const parent = await fs.realpath(path.dirname(current));
        if (!isInsideRoot(canonicalRoot, parent)) throw new Error('La ruta solicitada queda fuera de la carpeta autorizada.');
        return { path: current, exists: false, rootPath: canonicalRoot };
      }
      throw error;
    }

    if (info.isSymbolicLink()) {
      throw new Error('No se permite atravesar enlaces simbólicos dentro de las carpetas autorizadas.');
    }
    if (index < segments.length - 1 && !info.isDirectory()) {
      throw new Error('Un componente de la ruta no es una carpeta.');
    }
  }

  const canonicalTarget = await fs.realpath(current);
  if (!isInsideRoot(canonicalRoot, canonicalTarget)) {
    throw new Error('La ruta solicitada queda fuera de la carpeta autorizada.');
  }
  return { path: canonicalTarget, exists: true, rootPath: canonicalRoot };
}
