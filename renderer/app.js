const $ = selector => document.querySelector(selector);
const state = { page: 'overview', roots: [], logs: [], bootstrap: null, tunnel: { status: 'stopped' } };

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function toast(message, kind = '') {
  const item = document.createElement('div');
  item.className = `toast ${kind}`;
  item.textContent = message;
  $('#toast-region').append(item);
  setTimeout(() => item.remove(), 3800);
}
function feedback(selector, message, kind = '') {
  const element = $(selector);
  element.textContent = message;
  element.className = `feedback ${kind}`;
}
function go(page) {
  state.page = page;
  document.querySelectorAll('.page').forEach(el => el.classList.toggle('active', el.id === `page-${page}`));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  const names = { overview:'Resumen', folders:'Carpetas autorizadas', connection:'Conexión ChatGPT', activity:'Actividad' };
  $('#page-heading').textContent = names[page] || 'Resumen';
}
function renderRoots() {
  const roots = state.roots || [];
  $('#nav-root-count').textContent = roots.length;
  $('#stat-roots').textContent = roots.length;
  $('#root-total').textContent = `${roots.length} ${roots.length === 1 ? 'carpeta' : 'carpetas'}`;
  if (!roots.length) {
    $('#roots-list').innerHTML = '<div class="empty-state">No hay carpetas autorizadas todavía. Añade una carpeta para empezar.</div>';
    $('#overview-roots').innerHTML = '<div class="empty-state compact-empty">Todavía no has autorizado carpetas.</div>';
    return;
  }
  $('#roots-list').innerHTML = roots.map(root => `
    <article class="root-card">
      <div class="root-icon">▤</div>
      <div class="root-detail"><strong>${escapeHtml(root.name)}</strong><p title="${escapeHtml(root.path)}">${escapeHtml(root.path)}</p><div class="root-meta">ID: ${escapeHtml(root.id)} · Acceso autorizado</div></div>
      <button class="remove-root" data-remove-root="${escapeHtml(root.id)}" title="Revocar acceso" aria-label="Revocar acceso">×</button>
    </article>`).join('');
  $('#overview-roots').innerHTML = roots.slice(0,3).map(root => `
    <div class="compact-root"><div class="root-icon">▤</div><div><strong>${escapeHtml(root.name)}</strong><small title="${escapeHtml(root.path)}">${escapeHtml(root.path)}</small></div></div>`).join('');
}
function setConnectionState(tunnel) {
  state.tunnel = { ...state.tunnel, ...tunnel };
  const pill = $('#connection-pill');
  const labels = { ready:'Conectado', starting:'Iniciando', stopped:'Desconectado', error:'Error' };
  const desktopConnected = Boolean(state.bootstrap?.chatgptDesktop?.connected);
  const tunnelStatus = state.tunnel.status || 'stopped';
  pill.className = `status-pill ${tunnelStatus === 'stopped' && desktopConnected ? 'desktop' : tunnelStatus}`;
  pill.querySelector('span').textContent = tunnelStatus === 'ready' ? labels.ready :
    tunnelStatus === 'starting' ? labels.starting :
    tunnelStatus === 'error' ? labels.error :
    desktopConnected ? 'ChatGPT configurado' : labels.stopped;
  $('#start-tunnel').disabled = ['starting','ready'].includes(state.tunnel.status);
  $('#stop-tunnel').disabled = !['starting','ready'].includes(state.tunnel.status);
}
function renderChecklist() {
  const boot = state.bootstrap || {};
  const nodeOk = Boolean(boot.node?.available);
  const foldersOk = state.roots.length > 0;
  const desktopOk = Boolean(boot.chatgptDesktop?.connected);
  const credentialsOk = Boolean(boot.tunnel?.credentialsSaved);
  const clientOk = Boolean(boot.tunnel?.clientInstalled);
  const entries = [
    ['check-node', nodeOk, nodeOk ? 'Correcto' : 'Pendiente'],
    ['check-folder', foldersOk, foldersOk ? 'Correcto' : 'Pendiente'],
    ['check-tunnel', desktopOk, desktopOk ? 'ChatGPT listo' : credentialsOk && clientOk ? 'Túnel preparado' : 'Pendiente']
  ];
  for (const [id, done, label] of entries) {
    const element = document.getElementById(id);
    element.classList.toggle('done', done);
    element.querySelector('.check-state').textContent = label;
  }
}
function renderBootstrap(boot) {
  state.bootstrap = boot;
  state.roots = boot.roots || [];
  $('#app-version').textContent = `v${boot.app?.version || '0.2.0'}`;
  $('#last-updated').textContent = `Actualizado ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
  $('#stat-node').textContent = boot.node?.version || 'No detectado';
  $('#stat-node-detail').textContent = boot.node?.message || 'Node.js 22 o superior';
  $('#stat-client').textContent = boot.tunnel?.clientInstalled ? 'Instalado' : 'No instalado';
  $('#stat-client-detail').textContent = boot.tunnel?.clientVersion || 'Cliente oficial de OpenAI';
  $('#client-version').textContent = boot.tunnel?.clientInstalled ? `Versión ${boot.tunnel.clientVersion || 'instalada'} · Verificada` : 'No instalado';
  $('#client-description').textContent = boot.tunnel?.clientInstalled
    ? 'El cliente oficial de OpenAI está instalado en este equipo.'
    : 'LocalBridge puede descargar la versión oficial de OpenAI y verificar su SHA-256 antes de instalarla.';
  $('#tunnel-id').value = boot.tunnel?.tunnelId || '';
  $('#runtime-key').value = '';
  $('#runtime-key').placeholder = boot.tunnel?.credentialsSaved ? 'Clave guardada (escribe otra para reemplazarla)' : 'Introduce tu clave de ejecución';
  $('#clear-credentials').disabled = !boot.tunnel?.credentialsSaved;
  $('#install-client-button').textContent = boot.tunnel?.clientInstalled ? 'Reinstalar / actualizar cliente' : 'Descargar e instalar cliente';
  renderRoots();
  renderChecklist();
  $('#desktop-status').textContent = boot.chatgptDesktop?.connected ? 'Configurado' : 'No configurado';
  $('#desktop-status').classList.toggle('connected', Boolean(boot.chatgptDesktop?.connected));
  $('#desktop-config-path').textContent = boot.chatgptDesktop?.configPath || '~/.codex/config.toml';
  $('#connect-desktop').textContent = boot.chatgptDesktop?.connected ? 'Actualizar conexión' : 'Conectar ChatGPT Desktop';
  $('#disconnect-desktop').disabled = !boot.chatgptDesktop?.connected;
  setConnectionState(boot.tunnel || {status:'stopped'});
  renderLogs(boot.logs || []);
}
function renderLogs(logs = state.logs) {
  state.logs = logs.slice(-250);
  $('#log-count').textContent = `${state.logs.length} eventos`;
  if (!state.logs.length) {
    $('#log-list').innerHTML = '<div class="empty-state">Todavía no hay eventos registrados.</div>';
    return;
  }
  $('#log-list').innerHTML = state.logs.slice().reverse().map(log => `
    <div class="log-entry"><span class="log-time">${escapeHtml(new Date(log.time).toLocaleString())}</span><span class="log-level ${escapeHtml(log.level)}">${escapeHtml(log.level.toUpperCase())}</span><span class="log-message">${escapeHtml(log.message)}</span></div>`).join('');
}
async function refresh() {
  try { renderBootstrap(await window.localBridge.bootstrap()); }
  catch (error) { toast(error.message || 'No se pudo consultar el estado.', 'error'); }
}
document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => go(button.dataset.page)));
document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => go(button.dataset.go)));
$('#refresh-button').addEventListener('click', refresh);
$('#add-root-button').addEventListener('click', async () => {
  try {
    const result = await window.localBridge.addRoot();
    if (result.canceled) return;
    await refresh();
    toast(`Carpeta autorizada: ${result.root.name}`, 'success');
  } catch (error) { toast(error.message || 'No se pudo autorizar la carpeta.', 'error'); }
});
$('#roots-list').addEventListener('click', async event => {
  const button = event.target.closest('[data-remove-root]');
  if (!button) return;
  const root = state.roots.find(item => item.id === button.dataset.removeRoot);
  if (!root) return;
  if (!confirm(`¿Revocar el acceso a "${root.name}"? No se borrarán sus archivos.`)) return;
  try {
    await window.localBridge.removeRoot(root.id);
    await refresh();
    toast('Acceso a la carpeta revocado.', 'success');
  } catch (error) { toast(error.message || 'No se pudo revocar el acceso.', 'error'); }
});
$('#toggle-key').addEventListener('click', () => {
  const input = $('#runtime-key');
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  $('#toggle-key').textContent = showing ? 'Mostrar' : 'Ocultar';
});
$('#connect-desktop').addEventListener('click', async () => {
  const button = $('#connect-desktop');
  button.disabled = true;
  button.textContent = 'Configurando…';
  feedback('#tunnel-feedback', 'Registrando el servidor MCP local en la configuración de ChatGPT Desktop…');
  try {
    const result = await window.localBridge.connectChatGptDesktop();
    feedback('#tunnel-feedback', `LocalBridge quedó registrado. Reinicia ChatGPT Desktop. Configuración: ${result.configPath}`, 'success');
    toast('Conexión local configurada. Reinicia ChatGPT Desktop.', 'success');
    await refresh();
  } catch (error) {
    feedback('#tunnel-feedback', error.message || 'No se pudo configurar ChatGPT Desktop.', 'error');
    toast(error.message || 'No se pudo configurar ChatGPT Desktop.', 'error');
  } finally {
    button.disabled = false;
  }
});
$('#disconnect-desktop').addEventListener('click', async () => {
  if (!confirm('¿Retirar únicamente la entrada de LocalBridge de la configuración de ChatGPT? Las demás entradas se conservarán.')) return;
  try {
    await window.localBridge.disconnectChatGptDesktop();
    feedback('#tunnel-feedback', 'Entrada de LocalBridge retirada. Reinicia ChatGPT Desktop para aplicar el cambio.');
    toast('Servidor LocalBridge desconectado de ChatGPT Desktop.', 'success');
    await refresh();
  } catch (error) {
    feedback('#tunnel-feedback', error.message || 'No se pudo desconectar.', 'error');
  }
});
$('#save-credentials').addEventListener('click', async () => {
  feedback('#credential-feedback', 'Guardando de forma cifrada…');
  try {
    await window.localBridge.saveTunnel({ tunnelId: $('#tunnel-id').value, runtimeApiKey: $('#runtime-key').value });
    $('#runtime-key').value = '';
    feedback('#credential-feedback', 'Credenciales guardadas en el almacén seguro de Windows.', 'success');
    toast('Credenciales guardadas de forma segura.', 'success');
    await refresh();
  } catch (error) { feedback('#credential-feedback', error.message || 'No se pudieron guardar las credenciales.', 'error'); }
});
$('#clear-credentials').addEventListener('click', async () => {
  if (!confirm('¿Borrar el Tunnel ID y la Runtime API Key guardados en este equipo?')) return;
  try {
    await window.localBridge.clearTunnel();
    $('#runtime-key').value = '';
    feedback('#credential-feedback', 'Credenciales eliminadas.', 'success');
    await refresh();
    toast('Credenciales eliminadas.', 'success');
  } catch (error) { feedback('#credential-feedback', error.message, 'error'); }
});
$('#install-client-button').addEventListener('click', async () => {
  const wrap = $('#install-progress-wrap');
  wrap.hidden = false;
  $('#install-client-button').disabled = true;
  $('#install-progress-bar').style.width = '0%';
  $('#install-progress-label').textContent = 'Consultando publicación oficial…';
  try {
    const result = await window.localBridge.installTunnelClient();
    toast(`Cliente oficial ${result.version} instalado.`, 'success');
    await refresh();
  } catch (error) {
    toast(error.message || 'No se pudo instalar el cliente.', 'error');
    $('#install-progress-label').textContent = error.message || 'La instalación falló.';
  } finally {
    $('#install-client-button').disabled = false;
  }
});
$('#start-tunnel').addEventListener('click', async () => {
  feedback('#tunnel-feedback', 'Iniciando conexión con OpenAI…');
  try {
    await window.localBridge.startTunnel();
    feedback('#tunnel-feedback', 'Cliente iniciado. LocalBridge comprobará el estado del túnel.', 'success');
  } catch (error) { feedback('#tunnel-feedback', error.message || 'No se pudo iniciar el túnel.', 'error'); }
});
$('#stop-tunnel').addEventListener('click', async () => {
  try { await window.localBridge.stopTunnel(); feedback('#tunnel-feedback', 'Conexión detenida.'); }
  catch (error) { feedback('#tunnel-feedback', error.message, 'error'); }
});
$('#open-tunnels').addEventListener('click', () => window.localBridge.openExternal('https://platform.openai.com/settings/organization/tunnels'));
$('#clear-visible-logs').addEventListener('click', () => renderLogs([]));
window.localBridge.onTunnelState(setConnectionState);
window.localBridge.onTunnelLog(entry => renderLogs([...state.logs, entry]));
window.localBridge.onInstallProgress(progress => {
  $('#install-progress-wrap').hidden = false;
  $('#install-progress-bar').style.width = `${Math.max(0, Math.min(100, progress.percent || 0))}%`;
  $('#install-progress-label').textContent = progress.message || 'Procesando…';
});
refresh();
