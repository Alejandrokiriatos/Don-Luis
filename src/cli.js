#!/usr/bin/env node
import { addRoot, loadConfig, removeRoot, getConfigDir } from './config.js';

const [command = 'help', ...args] = process.argv.slice(2);

function printHelp() {
  console.log(`LocalBridge 0.1.0

Comandos:
  node src/cli.js setup
      Crea la configuración local.

  node src/cli.js add-root "C:\\ruta\\a\\proyecto"
      Autoriza una carpeta para que ChatGPT pueda acceder a ella.

  node src/cli.js roots
      Muestra las carpetas autorizadas y sus ID.

  node src/cli.js remove-root <ID>
      Revoca el acceso a una carpeta. No borra sus archivos.

  npm run mcp
      Inicia el servidor MCP por stdio (lo ejecuta tunnel-client).
`);
}

try {
  if (command === 'setup') {
    const config = await loadConfig();
    console.log(`Configuración lista: ${getConfigDir()}`);
    console.log(`Carpetas autorizadas: ${config.roots.length}`);
    console.log('Añade una carpeta con: node src/cli.js add-root "C:\\ruta\\a\\proyecto"');
  } else if (command === 'add-root') {
    if (!args[0]) throw new Error('Falta la ruta de la carpeta.');
    const root = await addRoot(args.join(' '));
    console.log(`Carpeta autorizada: ${root.name}`);
    console.log(`ID: ${root.id}`);
    console.log(`Ruta: ${root.path}`);
  } else if (command === 'roots') {
    const config = await loadConfig();
    if (!config.roots.length) {
      console.log('Todavía no hay carpetas autorizadas. Usa: node src/cli.js add-root "C:\\ruta\\a\\proyecto"');
    } else {
      for (const root of config.roots) console.log(`${root.id}\t${root.name}\t${root.path}`);
    }
  } else if (command === 'remove-root') {
    if (!args[0]) throw new Error('Indica el ID de la carpeta que quieres revocar.');
    await removeRoot(args[0]);
    console.log(`Se revocó el acceso a la carpeta ${args[0]}. Sus archivos no fueron borrados.`);
  } else {
    printHelp();
    if (command !== 'help') process.exitCode = 1;
  }
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
