import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { parseRelativePath, resolveInRoot } from '../src/security.js';

test('accepts normal relative paths', () => {
  assert.deepEqual(parseRelativePath('src\\client\\index.js'), ['src', 'client', 'index.js']);
  assert.deepEqual(parseRelativePath('.'), []);
});

test('rejects traversal and absolute paths', () => {
  assert.throws(() => parseRelativePath('../secret.txt'), /No se permite salir/);
  assert.throws(() => parseRelativePath('src/../../secret.txt'), /No se permite salir/);
  assert.throws(() => parseRelativePath('C:\\Windows\\win.ini'), /ruta relativa/);
  assert.throws(() => parseRelativePath('/etc/passwd'), /ruta relativa/);
});

test('resolves a file inside the allowed root', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'localbridge-test-'));
  try {
    await fs.mkdir(path.join(temp, 'project'));
    await fs.writeFile(path.join(temp, 'project', 'readme.txt'), 'hello');
    const result = await resolveInRoot(path.join(temp, 'project'), 'readme.txt');
    assert.equal(result.exists, true);
    assert.equal(await fs.readFile(result.path, 'utf8'), 'hello');
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});

test('allows a missing final component but not missing parents', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'localbridge-test-'));
  try {
    const result = await resolveInRoot(temp, 'new.txt', { allowMissingFinal: true });
    assert.equal(result.exists, false);
    await assert.rejects(resolveInRoot(temp, 'missing/new.txt', { allowMissingFinal: true }));
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});

test('rejects symbolic links', async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'localbridge-test-'));
  try {
    const root = path.join(temp, 'root');
    const outside = path.join(temp, 'outside');
    await fs.mkdir(root);
    await fs.mkdir(outside);
    await fs.writeFile(path.join(outside, 'secret.txt'), 'secret');
    try {
      await fs.symlink(outside, path.join(root, 'linked'), 'dir');
    } catch (error) {
      if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return t.skip('El sistema no permite crear enlaces simbólicos en esta sesión.');
      throw error;
    }
    await assert.rejects(resolveInRoot(root, 'linked/secret.txt'), /enlaces simbólicos/);
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});
