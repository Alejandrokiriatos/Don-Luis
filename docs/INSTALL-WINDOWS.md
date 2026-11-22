# Instalación y conexión de LocalBridge en Windows

## Requisitos

- Windows 10/11 x64.
- Node.js 22 o superior.
- ChatGPT Desktop con la sección **Settings → MCP servers** habilitada para tu cuenta.

## Instalar desde el código fuente

```powershell
git clone https://github.com/Alejandrokiriatos/Don-Luis.git
cd Don-Luis
npm install
npm run setup
npm start
```

## 1. Autorizar carpetas

En el panel **Carpetas autorizadas**, pulsa **Añadir carpeta** y selecciona solo una carpeta de proyecto. No autorices todo el disco ni tu perfil completo.

También puedes usar PowerShell:

```powershell
node src/cli.js add-root "C:\\Users\\TU_USUARIO\\Documents\\MiProyecto"
node src/cli.js roots
```

## 2. Conectar ChatGPT Desktop directamente

1. En LocalBridge, abre **Conexión ChatGPT**.
2. En el bloque **ChatGPT Desktop**, pulsa **Conectar ChatGPT Desktop**.
3. LocalBridge comprobará Node.js y que exista el paquete MCP compilado.
4. Se añadirá una entrada administrada a `%USERPROFILE%\\.codex\\config.toml`.
5. Si ya existía el archivo, LocalBridge creará una copia de seguridad antes de cambiarlo.
6. Reinicia ChatGPT Desktop.
7. Abre **Settings → MCP servers** y comprueba que aparece `localbridge`.
8. En una conversación, escribe `/mcp` para comprobar las herramientas disponibles.

La configuración se comparte con el host Codex que usa ChatGPT Desktop. La conexión directa local no necesita Tunnel ID, Runtime API Key, Secure MCP Tunnel, Docker ni exponer puertos.

Para quitar solo nuestra entrada, pulsa **Desconectar** en LocalBridge. Las demás entradas MCP del archivo se conservan y también se crea una copia de seguridad.

## 3. Ruta opcional para ChatGPT web

Si tu cuenta y workspace permiten agregar servidores MCP personalizados en ChatGPT web, puedes usar la sección opcional **Secure MCP Tunnel**.

Necesitarás:
- Un Tunnel ID creado en OpenAI Platform.
- Una Runtime API Key con los permisos Tunnels Read + Use.
- Que tu workspace permita usar servidores MCP personalizados.

La aplicación descarga el cliente oficial de OpenAI, verifica el SHA-256 publicado y guarda las credenciales cifradas con el almacenamiento seguro de Windows. Para más información, consulta la [guía oficial de Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels).

## 4. Probar el servidor MCP

```powershell
npm run check
npm run build:mcp
npm test
```

La conexión se considera completada solo cuando ChatGPT Desktop muestra `localbridge` en MCP servers y puede llamar con éxito a `localbridge_status`.

## Notas

- Node.js debe permanecer instalado, ya que ChatGPT Desktop ejecuta el servidor MCP mediante STDIO.
- No compartas Runtime API Keys ni archivos de credenciales.
- El texto de los archivos que ChatGPT lea se enviará al modelo para poder procesarlo.
- La ejecución de comandos del usuario y el borrado de archivos no están habilitados en esta versión.
