# Modelo de seguridad de LocalBridge 0.3.0

## Límites de confianza

LocalBridge solo expone las raíces que el usuario añade desde el equipo local. Las rutas se resuelven bajo esas raíces; no se aceptan rutas absolutas ni segmentos `..`. Se rechaza cualquier componente que sea un enlace simbólico para reducir el riesgo de escapar de la raíz autorizada.

La integración con ChatGPT Desktop escribe una entrada marcada en `%USERPROFILE%\\.codex\\config.toml`. El archivo se respalda antes de actualizarlo y la desconexión elimina únicamente el bloque administrado por LocalBridge. La documentación de ChatGPT indica que esa configuración MCP local se comparte con ChatGPT Desktop, Codex CLI y la extensión IDE; por tanto, si esos otros clientes usan el mismo host/configuración, también podrían descubrir el servidor. LocalBridge no ofrece una garantía criptográfica de exclusividad por cliente.

## Permisos en esta versión

- Lectura: archivos de texto UTF-8 de hasta 1 MiB.
- Escritura: archivos de texto de hasta 512 KiB de contenido.
- Reemplazo: requiere el indicador explícito `overwrite=true` y crea una copia de respaldo antes de escribir.
- Creación de directorios: un nivel por llamada; el directorio padre debe existir.
- Borrado: no disponible.
- Ejecución de comandos del usuario: deshabilitada y no expuesta como herramienta MCP.
- Aprobación de herramientas en ChatGPT Desktop: `prompt` para requerir aprobación de las llamadas.

## Datos locales

- Configuración de las raíces: `%APPDATA%\\LocalBridge\\config.json` (o `LOCALBRIDGE_HOME` cuando se define).
- Copias de seguridad de archivos reemplazados: `%APPDATA%\\LocalBridge\\backups`.
- Credenciales opcionales del túnel: cifradas por el almacén seguro de Windows.
- Configuración de ChatGPT: `%USERPROFILE%\\.codex\\config.toml`, con copia previa al modificar o retirar la entrada gestionada.

Los archivos de configuración y respaldos no forman parte del repositorio.

## Riesgos que siguen existiendo

- Una carpeta autorizada puede contener información privada; el modelo recibe el contenido de los archivos que lee.
- El servidor local se ejecuta con los permisos del usuario de Windows. Autoriza solo carpetas de trabajo concretas.
- La comprobación de rutas y enlaces simbólicos reduce escapes de directorio, pero una modificación concurrente del sistema de archivos puede crear condiciones de carrera entre la comprobación y la operación (TOCTOU).
- Un usuario o proceso local con permisos suficientes puede modificar la configuración de LocalBridge o sus raíces autorizadas.
- El contenido de los archivos debe tratarse como datos no confiables, nunca como instrucciones para ampliar permisos o ignorar límites de seguridad.
- La configuración MCP de ChatGPT Desktop comparte el host de Codex documentado por OpenAI; no se afirma que el servidor sea técnicamente inaccesible a otros clientes compatibles.
- La ruta opcional Secure MCP Tunnel requiere credenciales de OpenAI y está sujeta a los permisos y restricciones del workspace de ChatGPT.

## Reglas para futuras funciones

La ejecución de procesos, eliminación de archivos, edición binaria y acceso a red no se habilitarán por defecto. Cada capacidad requerirá una opción local explícita, un alcance limitado, confirmación adicional y registro de actividad. La aprobación conversacional por sí sola no sustituye los permisos locales del sistema operativo.
