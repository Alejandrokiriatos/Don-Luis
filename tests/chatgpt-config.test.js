import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import {
  buildManagedConfigBlock,
  mergeManagedConfig,
  removeManagedConfig,
  connectChatGptDesktop,
  disconnectChatGptDesktop,
  isChatGptDesktopConnected
} from '../electron/chatgpt-config.js';

test('builds a valid LocalBridge MCP entry for ChatGPT desktop', () => {
  const block = buildManagedConfigBlock({
    bundlePath: path.join(os.tmpdir(), 'LocalBridge', 'mcp-server.js'),
    cwd: path.join(os.tmpdir(), 'LocalBridge')
  });
  assert.match(block, /^\[mcp_servers\.localbridge\]$/m);
  assert.match(block, /default_tools_approval_mode = "prompt"/);
  assert.match(block, /args = \[/);
});

test('merges the managed block without overwriting other MCP entries', () => {
  const original = '[mcp_servers.existing]\ncommand = "other"\n';
  const block = buildManagedConfigBlock({
    bundlePath: path.join(os.tmpdir(), 'mcp.js'),
    cwd: os.tmpdir()
  });
  const merged = mergeManagedConfig(original, block);
  assert.match(merged, /mcp_servers\.existing/);
  assert.match(merged, /mcp_servers\.localbridge/);
  assert.equal(mergeManagedConfig(merged, block).match(/BEGIN LOCALBRIDGE MANAGED BLOCK/g).length, 1);
});

test('refuses to overwrite an unmanaged LocalBridge table or malformed markers', () => {
  const block = buildManagedConfigBlock({ bundlePath: path.join(os.tmpdir(), 'mcp.js'), cwd: os.tmpdir() });
  assert.throws(() => mergeManagedConfig('[mcp_servers.localbridge]\ncommand = "custom"\n', block), /Ya existe/);
  assert.throws(() => mergeManagedConfig('# BEGIN LOCALBRIDGE MANAGED BLOCK\n', block), /incompleta/);
});

test('removes only the LocalBridge-managed section', () => {
  const block = buildManagedConfigBlock({ bundlePath: path.join(os.tmpdir(), 'mcp.js'), cwd: os.tmpdir() });
  const original = '[mcp_servers.keep]\ncommand = "keep"\n\n' + block + '\n';
  const updated = removeManagedConfig(original);
  assert.match(updated, /mcp_servers\.keep/);
  assert.doesNotMatch(updated, /mcp_servers\.localbridge/);
});

test('installs and removes a desktop config entry with backups', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'localbridge-config-'));
  const configPath = path.join(temp, '.codex', 'config.toml');
  const bundlePath = path.join(temp, 'mcp-server.js');
  try {
    await fs.writeFile(bundlePath, 'console.log("ready")');
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, '[mcp_servers.other]\ncommand = "other"\n');
    await connectChatGptDesktop({ bundlePath, cwd: temp, configPath });
    assert.equal(await isChatGptDesktopConnected(configPath), true);
    await disconnectChatGptDesktop({ configPath });
    assert.equal(await isChatGptDesktopConnected(configPath), false);
    const backupFiles = (await fs.readdir(path.dirname(configPath))).filter(name => name.includes('backup'));
    assert.ok(backupFiles.length >= 2);
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});
