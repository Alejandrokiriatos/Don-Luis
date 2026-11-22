# Instalación de desarrollo en Windows

Esta guía corresponde al MVP 0.1.0. La instalación gráfica se incorporará más adelante.

## 1. Preparar el proyecto

Abre PowerShell:

```powershell
git clone https://github.com/Alejandrokiriatos/Don-Luis.git
cd Don-Luis
npm install
npm run setup
```

## 2. Autorizar una carpeta

Añade una carpeta concreta del proyecto. Evita autorizar todo `C:\\` o tu perfil completo de Windows.

```powershell
node src/cli.js add-root "C:\\Users\\TU_USUARIO\\Documents\\MiProyecto"
node src/cli.js roots
```

Cada carpeta tendrá un ID. ChatGPT verá únicamente las raíces listadas aquí.

Para revocar acceso:

```powershell
node src/cli.js remove-root ID_DE_LA_CARPETA
```

Revocar una raíz no borra ni modifica los archivos de esa carpeta.

## 3. Comprobar el servidor local

```powershell
npm run check
npm test
npm run mcp
```

`npm run mcp` se queda esperando una conexión MCP por entrada/salida estándar. Cierra con `Ctrl+C` cuando lo hayas ejecutado manualmente.

## 4. Conectarlo con ChatGPT

La integración requiere Secure MCP Tunnel de OpenAI. Sigue la guía oficial actual para crear el túnel, generar una clave de ejecución y asociar el túnel con el workspace de ChatGPT correcto:

<https://developers.openai.com/api/docs/guides/secure-mcp-tunnels>

El comando MCP que debe ejecutar el cliente del túnel es:

```powershell
node "C:\\RUTA\\A\\Don-Luis\\src\\index.js"
```

No inventes ni compartas el `tunnel_id` o la clave de ejecución en este repositorio. La configuración y los secretos deben permanecer en el equipo local.

**No des por conectada la integración hasta que ChatGPT descubra las herramientas y una llamada segura a `localbridge_status` responda correctamente.**
