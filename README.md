# LocalBridge

**Conector local de archivos para ChatGPT en Windows**, construido con Node.js y MCP. LocalBridge permite que ChatGPT explore, lea, cree y modifique archivos únicamente dentro de carpetas que el usuario autorice de forma explícita.

> Estado: MVP de escritorio 0.2.0. Incluye servidor MCP, panel gráfico, gestión de carpetas, almacenamiento cifrado de credenciales y descarga verificada del cliente oficial de túnel. La primera compilación instalable está en validación automatizada.

## Qué incluye esta primera versión

- Lista de carpetas autorizadas con identificadores independientes.
- Exploración de directorios con límites de resultados.
- Lectura de archivos de texto UTF-8 de hasta 1 MiB.
- Creación y modificación de archivos de texto.
- Copia de respaldo automática antes de reemplazar un archivo.
- Creación de subcarpetas dentro de una carpeta autorizada.
- Bloqueo de rutas absolutas, traversal (`..`) y enlaces simbólicos.
- Panel de escritorio para Windows con resumen, gestión de carpetas, conexión y registro de actividad.\n- Almacenamiento de Tunnel ID y Runtime API Key cifrado con el almacén seguro de Windows.\n- Descarga del cliente oficial de OpenAI con comprobación SHA-256 antes de instalar.\n- Configuración local en el perfil de Windows; las rutas autorizadas no se guardan en GitHub.
- Ejecución de comandos desactivada en esta versión.

## Requisitos

- Windows 10/11 de 64 bits.
- Node.js 22 o superior.
- Git.
- Para conectar el servidor local con ChatGPT: acceso a **Secure MCP Tunnel** de OpenAI, un `tunnel_id`, una clave de ejecución con permisos `Tunnels Read + Use` y una cuenta/workspace de ChatGPT que permita añadir servidores MCP personalizados.

LocalBridge no implementa ni suplanta el servicio de túnel de OpenAI. Utiliza el `tunnel-client` oficial de OpenAI como transporte seguro y aporta el servidor MCP local que controla los archivos.

## Instalar desde el repositorio

```powershell
git clone https://github.com/Alejandrokiriatos/Don-Luis.git
cd Don-Luis
npm install
npm run setup
```

Autoriza solamente las carpetas de proyectos con las que quieras trabajar:

```powershell
node src/cli.js add-root "C:\\Users\\TU_USUARIO\\Documents\\MiProyecto"
node src/cli.js roots
```

Para probar el servidor MCP localmente:

```powershell
npm run mcp
```

El servidor espera solicitudes MCP por `stdin/stdout`. Los mensajes de diagnóstico se escriben en `stderr`; `stdout` queda reservado para el protocolo.

## Herramientas MCP expuestas

| Herramienta | Función |
|---|---|
| `localbridge_status` | Estado del servidor y cantidad de carpetas autorizadas. |
| `localbridge_list_roots` | Lista las carpetas autorizadas y sus IDs. |
| `localbridge_list_directory` | Explora una carpeta autorizada. |
| `localbridge_read_text_file` | Lee un archivo de texto UTF-8. |
| `localbridge_create_directory` | Crea una carpeta dentro de una raíz autorizada. |
| `localbridge_write_text_file` | Crea o reemplaza un archivo de texto, con respaldo al reemplazar. |

## Conexión con ChatGPT

OpenAI documenta **Secure MCP Tunnel** para conectar un servidor MCP local sin publicar el servidor en Internet. El cliente oficial se ejecuta en el mismo equipo y reenvía las solicitudes mediante una conexión saliente HTTPS.

- Guía oficial: <https://developers.openai.com/api/docs/guides/secure-mcp-tunnels>
- Cliente oficial `tunnel-client`: <https://github.com/openai/tunnel-client>
- Panel de túneles de OpenAI: <https://platform.openai.com/settings/organization/tunnels>

Una vez creado el túnel y obtenidas las credenciales localmente, el comando MCP que debe ejecutar `tunnel-client` es:

```powershell
node C:\\RUTA\\A\\Don-Luis\\src\\index.js
```

No publiques ni envíes por chat claves de OpenAI, tokens, archivos `.env` ni credenciales. La clave de ejecución debe quedar en la configuración local de `tunnel-client`, nunca dentro de este repositorio.

## Disponibilidad de ChatGPT: limitación importante

La disponibilidad de servidores MCP personalizados depende del plan y de los controles de la cuenta/workspace. La documentación vigente de OpenAI indica que las conexiones MCP personalizadas con soporte completo están disponibles en ChatGPT Business y Enterprise/Edu; otras modalidades pueden tener límites o no ofrecer esta opción. El programa no puede saltarse esas restricciones. Antes de preparar el instalador final, hay que comprobar que la cuenta concreta permite añadir un MCP personalizado y usar Secure MCP Tunnel.

## Seguridad

- No existe acceso general al disco: cada raíz debe añadirse localmente.
- Las rutas que contienen `..`, rutas absolutas y enlaces simbólicos se rechazan.
- No se siguen enlaces simbólicos durante la exploración.
- La escritura está limitada a texto y exige `overwrite=true` para reemplazar archivos existentes.
- Los reemplazos crean una copia de respaldo en `%APPDATA%\\LocalBridge\\backups`.
- Esta versión no ofrece borrado de archivos ni ejecución de comandos.

Consulta [`docs/SECURITY.md`](docs/SECURITY.md) y [`docs/INSTALL-WINDOWS.md`](docs/INSTALL-WINDOWS.md).

## Desarrollo y pruebas

```powershell
npm run check
npm test
```

## Hoja de ruta

1. **MVP MCP local:** servidor, autorización de carpetas, lectura/escritura y pruebas.
2. **Integración Secure MCP Tunnel:** asistente de configuración local, validación del túnel y conexión con ChatGPT.
3. **Aplicación Windows:** interfaz para seleccionar carpetas, ver conexión y administrar permisos.
4. **Herramientas de desarrollo:** ejecución de comandos con lista permitida, confirmación local y registro de actividad.
5. **Instalador y actualizaciones:** instalador `.exe`, inicio automático opcional y actualizaciones verificadas.
