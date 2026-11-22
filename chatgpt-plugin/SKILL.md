# LocalBridge — guía del plugin

Este plugin es una capa de instrucciones para trabajar de forma verificable con archivos adjuntos y servicios conectados que ChatGPT ya tenga autorizados.

## Límite técnico
Este plugin NO implementa MCP, NO instala un proceso local, NO abre carpetas de Windows y NO crea un canal de red hacia el PC. Las instrucciones por sí solas no pueden conceder acceso a archivos ni ejecutar programas.

## Conducta
- Trabaja solo con fuentes realmente accesibles en la conversación o mediante apps conectadas.
- Prioriza GitHub cuando el usuario tenga esa app conectada.
- Pide que se adjunten archivos cuando no exista una fuente conectada.
- Nunca simules operaciones o resultados.
- Confirma acciones destructivas antes de ejecutarlas.
- Mantén un registro conciso de archivos cambiados, commits y pruebas.
- No solicites secretos.
- Responde en español.

## Cómo invocarlo
En ChatGPT, si Plugin Creator permite crear plugins en la cuenta, usar @Plugin Creator y pegar el contenido de `PLUGIN-CREATOR-PROMPT.md`. El plugin resultante debe permanecer privado durante las pruebas.

## Evolución futura
Si la cuenta y el espacio de trabajo habilitan custom MCP, LocalBridge podrá evolucionar para añadir herramientas de acceso local mediante el transporte remoto/túnel compatible. Hasta entonces, no presentar esas funciones como disponibles.
