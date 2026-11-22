# LocalBridge

**Conector local de archivos para ChatGPT en Windows**, construido con Node.js y MCP. LocalBridge permite que ChatGPT explore, lea, cree y modifique archivos únicamente dentro de carpetas que el usuario autorice de forma explícita.

> Estado: MVP de escritorio 0.3.0. Incluye servidor MCP, panel gráfico, gestión de carpetas, conexión local directa con ChatGPT Desktop, copias de seguridad y ruta alternativa por Secure MCP Tunnel.

## Qué incluye

- Lista de carpetas autorizadas con identificadores independientes.
- Exploración de directorios con límites de resultados.
- Lectura de archivos de texto UTF-8 de hasta 1 MiB.
- Creación y modificación de archivos de texto.
- Copia de respaldo automática antes de reemplazar un archivo.
- Creación de subcarpetas dentro de una carpeta autorizada.
- Bloqueo de rutas absolutas, traversal (`..`) y enlaces simbólicos.
- Panel de escritorio para Windows con resumen, gestión de carpetas, conexión y registro de actividad.
- Registro de LocalBridge como servidor MCP STDIO local de ChatGPT Desktop.
- Copia de seguridad de `%USERPROFILE%\\.codex\\config.toml` antes de modificarla; solo se administra el bloque propio de LocalBridge.
- Ruta opcional de Secure MCP Tunnel con almacenamiento cifrado de credenciales y descarga del cliente oficial verificada con SHA-256.
- Configuración y credenciales locales; no se guardan en GitHub.
- Ejecución de comandos del usuario desactivada en esta versión.

## Requisitos

- Windows 10/11 de 64 bits.
- Node.js 22 o superior en el PATH de Windows.
- Una versión de ChatGPT Desktop que incluya la sección **Settings → MCP servers** para la conexión local directa.
- Conexión a Internet durante la descarga inicial del cliente oficial del túnel, solo si se usa la ruta opcional de ChatGPT web.

La conexión local directa no necesita Tunnel ID, Runtime API Key, Docker ni abrir puertos. ChatGPT Desktop utiliza la configuración MCP local compartida con el host Codex en `%USERPROFILE%\\.codex\\config.toml`. La disponibilidad de MCP depende de la versión de ChatGPT Desktop y de las políticas de la cuenta.

## Instalación de desarrollo

```powershell
git clone https://github.com/Alejandrokiriatos/Don-Luis.git
cd Don-Luis
npm install
npm run setup
npm start
```

La primera ejecución abre el panel de LocalBridge. Autoriza solo carpetas concretas de tus proyectos. Después pulsa **Conectar ChatGPT Desktop** en la sección Conexión ChatGPT. LocalBridge añadirá una entrada MCP administrada a `%USERPROFILE%\\.codex\\config.toml` y guardará una copia de seguridad del archivo existente.

Después, reinicia ChatGPT Desktop. En la aplicación, comprueba **Settings → MCP servers** y busca `localbridge`. En una conversación, escribe `/mcp` para ver las herramientas del servidor.

La entrada se registra con aprobación `prompt`, de modo que las llamadas a herramientas requieren aprobación. LocalBridge no puede reiniciar ChatGPT por ti.

## Administrar carpetas desde PowerShell

También puedes administrar las carpetas autorizadas con la CLI:

```powershell
node src/cli.js add-root "C:\\Users\\TU_USUARIO\\Documents\\MiProyecto"
node src/cli.js roots
node src/cli.js remove-root ID_DE_LA_CARPETA
```

Revocar una carpeta no borra ninguno de sus archivos.

## Herramientas MCP expuestas

| Herramienta | Función |
|---|---|
| `localbridge_status` | Estado del servidor y cantidad de carpetas autorizadas. |
| `localbridge_list_roots` | Lista las carpetas autorizadas y sus IDs. |
| `localbridge_list_directory` | Explora una carpeta autorizada. |
| `localbridge_read_text_file` | Lee un archivo de texto UTF-8. |
| `localbridge_create_directory` | Crea una carpeta dentro de una raíz autorizada. |
| `localbridge_write_text_file` | Crea o reemplaza un archivo de texto, con respaldo al reemplazar. |

## Ruta opcional: ChatGPT web mediante Secure MCP Tunnel

Si tu cuenta y espacio de trabajo permiten servidores MCP personalizados en ChatGPT web, LocalBridge también incluye una ruta alternativa mediante **Secure MCP Tunnel**. Esta ruta requiere un `tunnel_id`, una Runtime API Key con permisos `Tunnels Read + Use`, y el cliente oficial de OpenAI.

- Guía oficial: <https://developers.openai.com/api/docs/guides/secure-mcp-tunnels>
- Cliente oficial `tunnel-client`: <https://github.com/openai/tunnel-client>
- Panel de túneles: <https://platform.openai.com/settings/organization/tunnels>

LocalBridge descarga el ZIP oficial de Windows y verifica el hash SHA-256 publicado por OpenAI antes de instalarlo. La clave se guarda cifrada con el almacén seguro de Windows y se pasa al proceso mediante una variable de entorno. Nunca debe añadirse a este repositorio.

La conexión por túnel y la conexión local de ChatGPT Desktop son rutas alternativas: para usar ChatGPT Desktop directamente, no necesitas configurar el túnel.

## Seguridad

- No existe acceso general al disco: cada raíz debe añadirse localmente.
- Las rutas que contienen `..`, rutas absolutas y enlaces simbólicos se rechazan.
- No se siguen enlaces simbólicos durante la exploración.
- La escritura está limitada a texto y exige `overwrite=true` para reemplazar archivos existentes.
- Los reemplazos crean una copia de respaldo en `%APPDATA%\\LocalBridge\\backups`.
- La desconexión de ChatGPT retira exclusivamente el bloque marcado de LocalBridge; no borra otras entradas MCP.
- Esta versión no ofrece borrado de archivos ni ejecución de comandos.

Consulta [`docs/SECURITY.md`](docs/SECURITY.md) y [`docs/INSTALL-WINDOWS.md`](docs/INSTALL-WINDOWS.md).

## Desarrollo y pruebas

```powershell
npm run check
npm run build:mcp
npm test
npm run dist:win
```

## Próximos pasos

1. Validar el registro MCP desde una instalación limpia de ChatGPT Desktop en Windows.
2. Entregar el instalador Windows firmado o publicar hashes del instalador.
3. Incorporar una pantalla de permisos por herramienta y auditoría local más detallada.
4. Añadir ejecución de comandos solo con lista permitida, confirmación local y registro de actividad.
