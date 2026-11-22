# Modelo de seguridad de LocalBridge 0.1.0

## Límites de confianza

LocalBridge solo expone las raíces que el usuario añade desde el equipo local. Las rutas se resuelven bajo esas raíces; no se aceptan rutas absolutas ni segmentos `..`. Se rechaza cualquier componente que sea un enlace simbólico para evitar escapar de la raíz autorizada.

## Permisos en esta versión

- Lectura: archivos de texto UTF-8 de hasta 1 MiB.
- Escritura: archivos de texto de hasta 512 KiB de contenido.
- Reemplazo: requiere el indicador explícito `overwrite=true` y crea una copia de respaldo antes de escribir.
- Creación de directorios: un nivel por llamada; el directorio padre debe existir.
- Borrado: no disponible.
- Ejecución de comandos: deshabilitada y no expuesta como herramienta MCP.

## Datos locales

La configuración se guarda en `%APPDATA%\\LocalBridge\\config.json` (o en `LOCALBRIDGE_HOME` cuando se define). Las copias de respaldo se guardan en `%APPDATA%\\LocalBridge\\backups`. Este directorio no forma parte del repositorio.

## Riesgos que siguen existiendo

- Una carpeta autorizada puede contener información privada; el modelo recibe el contenido de los archivos que lee.
- Un usuario o proceso local con permisos suficientes puede modificar la configuración de LocalBridge.
- Esta versión no intenta neutralizar instrucciones maliciosas almacenadas dentro de archivos. ChatGPT debe tratar el contenido de los archivos como datos no confiables, no como instrucciones para ampliar permisos.
- Las credenciales del túnel son responsabilidad del cliente oficial de OpenAI y no deben añadirse al proyecto.

## Reglas para futuras funciones

La ejecución de procesos, eliminación de archivos, edición binaria y acceso a red no se habilitarán por defecto. Cada capacidad requerirá una opción local explícita, un alcance limitado y registro de actividad. La aprobación conversacional por sí sola no sustituye los permisos locales del sistema operativo.
