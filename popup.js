const countries = [['AR','Argentina'],['DE','Alemania'],['AU','Australia'],['BR','Brasil'],['CA','Canadá'],['CL','Chile'],['CO','Colombia'],['ES','España'],['US','Estados Unidos'],['FR','Francia'],['IT','Italia'],['JP','Japón'],['MX','México'],['NL','Países Bajos'],['PE','Perú'],['PL','Polonia'],['PT','Portugal'],['GB','Reino Unido'],['UY','Uruguay']];
const $ = id => document.getElementById(id);
let servers = {};
let busy = false;
let current;
let ipController;
let connectionKey;
const settingsKey = settings => JSON.stringify([settings?.levelOfControl, settings?.value]);
async function verifyIp() {
  ipController?.abort();
  const controller = new AbortController();
  ipController = controller;
  const key = settingsKey(current);
  const proxy = current?.value?.rules?.singleProxy;
  const activeServer = Object.values(servers).find(server => server.host === proxy?.host && server.port === proxy?.port);
  const expectedIp = activeServer?.expectedIp || proxy?.host;
  const isOwned = owned();
  const started = Date.now();
  $('public-ip').textContent = 'Comprobando…';
  $('ip-result').textContent = 'Consultando ipify desde esta conexión.';
  $('verify').disabled = true;
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const ip = await queryPublicIp(controller.signal);
    const latest = await chrome.proxy.settings.get({incognito:false});
    if (ipController !== controller || settingsKey(latest) !== key) return;
    $('public-ip').textContent = ip;
    $('ip-result').textContent = isOwned
      ? (ip === expectedIp ? 'Conexión verificada: coincide con la IP de salida asignada.' : 'IP de salida recibida. No coincide con la IP esperada para este país.')
      : 'IP pública actual con Pasaporte desactivado.';
    $('ip-result').textContent += ' País no verificado.';
  } catch (error) {
    if (ipController !== controller) return;
    const {lastProxyError} = await chrome.storage.local.get('lastProxyError');
    if (ipController !== controller) return;
    $('public-ip').textContent = 'No verificada';
    const code = lastProxyError?.time >= started ? lastProxyError.error : '';
    const explanations = {
      PROXY_AUTH_REJECTED:'El servidor rechazó el usuario o la contraseña del proxy.',
      MISSING_PROXY_CREDENTIALS:'Faltan credenciales para este servidor.',
      'net::ERR_PROXY_CONNECTION_FAILED':'Chrome no pudo conectarse al servidor proxy.',
      'net::ERR_TUNNEL_CONNECTION_FAILED':'El proxy no pudo abrir la conexión HTTPS.',
      'net::ERR_PROXY_AUTH_REQUESTED':'El proxy está solicitando autenticación.',
      'net::ERR_TIMED_OUT':'El servidor agotó el tiempo de respuesta.'
    };
    $('ip-result').textContent = (explanations[code] || (controller.signal.aborted ? 'La consulta agotó los 12 segundos de espera.' : 'No se pudo completar la consulta de IP.')) + (isOwned ? ' Probá otro país o pulsá Desactivar para recuperar tu conexión.' : 'Revisá tu conexión y volvé a verificar.') + (code ? ` Código: ${code}` : '');
  } finally {
    clearTimeout(timeout);
    if (ipController === controller) $('verify').disabled = false;
  }
}
const owned = () => current?.levelOfControl === 'controlled_by_this_extension';
const controllable = () => ['controllable_by_this_extension','controlled_by_this_extension'].includes(current?.levelOfControl);
function render() {
  const server = servers[$('country').value];
  $('host').value = server?.host || '';
  $('port').value = server?.port || '';
  $('scheme').value = server?.scheme || 'https';
  $('availability').textContent = server ? 'Servidor guardado para este destino.' : 'Este país todavía no tiene un servidor configurado.';
  const proxy = current?.value?.rules?.singleProxy;
  const match = countries.find(([code]) => servers[code]?.host === proxy?.host && servers[code]?.port === proxy?.port && servers[code]?.scheme === proxy?.scheme);
  $('status').textContent = owned() ? `Proxy configurado${match ? ' · ' + match[1] : ''}` : 'Proxy de Pasaporte desactivado';
  $('detail').textContent = owned() ? 'Configuración aplicada. La conexión y el país no están verificados.' : controllable() ? 'Elegí un destino para comenzar.' : 'Chrome u otra extensión controla el proxy.';
  $('indicator').classList.toggle('active', owned());
  $('connect').disabled = busy || !server || !controllable();
  $('disconnect').disabled = busy || !owned();
}
async function refresh() {
  current = await chrome.proxy.settings.get({incognito:false});
  render();
  const key = settingsKey(current);
  if (connectionKey !== key) {
    connectionKey = key;
    void verifyIp();
  }
}
async function run(action) {
  if (busy) return;
  busy = true;
  $('message').textContent = '';
  $('country').disabled = true;
  for (const el of $('server-form').elements) el.disabled = true;
  $('connect').disabled = $('disconnect').disabled = true;
  try { await action(); } catch (error) { $('message').textContent = error.message || String(error); }
  finally {
    busy = false;
    $('country').disabled = false;
    for (const el of $('server-form').elements) el.disabled = false;
    try { await refresh(); } catch (error) { $('message').textContent = error.message; }
  }
}
$('country').addEventListener('change', () => run(async () => {
  await chrome.storage.local.set({selectedCountry:$('country').value});
}));
$('server-form').addEventListener('submit', event => {
  event.preventDefault();
  const host = $('host').value.trim();
  const port = Number($('port').value);
  const scheme = $('scheme').value;
  run(async () => {
    if (!/^(?=.{1,253}$)[a-z0-9]+(?:[a-z0-9.-]*[a-z0-9])?$/i.test(host) || host.includes('..')) throw new Error('Ingresá solo un dominio o IPv4, sin https://, rutas ni credenciales.');
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('El puerto debe estar entre 1 y 65535.');
    const updated = {...servers, [$('country').value]:{host,port,scheme}};
    await chrome.storage.local.set({servers:updated});
    servers = updated;
    $('message').textContent = 'Servidor guardado. Pulsá Activar proxy para aplicarlo.';
  });
});
$('connect').addEventListener('click', () => run(async () => {
  await refresh();
  if (!controllable()) throw new Error('Otra extensión o una política de Chrome controla el proxy.');
  const server = servers[$('country').value];
  if (!server) throw new Error('Configurá un servidor para este país.');
  ipController?.abort();
  ipController = null;
  $('public-ip').textContent = 'Comprobando…';
  connectionKey = undefined;
  const {host,port,scheme} = server;
  await chrome.proxy.settings.set({value:{mode:'fixed_servers',rules:{singleProxy:{host,port,scheme}}},scope:'regular'});
}));
$('disconnect').addEventListener('click', () => run(async () => {
  ipController?.abort();
  ipController = null;
  $('public-ip').textContent = 'Comprobando…';
  connectionKey = undefined;
  await chrome.proxy.settings.clear({scope:'regular'});
}));
$('verify').addEventListener('click', () => { if (!busy) void verifyIp(); });
$('auth-form').addEventListener('submit', event => {
  event.preventDefault();
  const username = $('proxy-user').value.trim();
  const password = $('proxy-password').value;
  run(async () => {
    if (!username || !password) throw new Error('Completá el usuario y la contraseña del proxy.');
    const response = await fetch(chrome.runtime.getURL('private-config.json'));
    if (!response.ok) throw new Error('No se pudo leer la lista de servidores Webshare.');
    const preset = await response.json();
    const {proxyCredentials = {}} = await chrome.storage.local.get('proxyCredentials');
    for (const server of Object.values(preset.servers)) {
      const endpoint = `${server.host}:${server.port}`;
      const presetUser = preset.proxyCredentials?.[endpoint]?.username || preset.credentials.username;
      const suffix = presetUser.startsWith(preset.credentials.username) ? presetUser.slice(preset.credentials.username.length) : '';
      proxyCredentials[endpoint] = {username:username+suffix,password};
    }
    await chrome.storage.local.set({proxyCredentials});
    await chrome.storage.local.remove('lastProxyError');
    $('proxy-password').value = '';
    $('message').textContent = 'Acceso actualizado. Desactivá y volvé a activar el país para reintentar.';
  });
});
chrome.proxy.settings.onChange.addListener(() => { if (!busy) refresh().catch(error => { $('message').textContent = error.message; }); });
async function init() {
  let saved = await chrome.storage.local.get(['servers','selectedCountry','presetImported','presetRevision','proxyCredentials']);
  {
    const response = await fetch(chrome.runtime.getURL('private-config.json'));
    if (!response.ok) throw new Error('No se pudo cargar private-config.json. Instalá nuevamente el paquete personal completo.');
    if (response.ok) {
      const preset = await response.json();
      if (!saved.presetImported || (saved.presetRevision || 0) < (preset.revision || 1)) {
        const proxyCredentials = {...saved.proxyCredentials};
        for (const server of Object.values(preset.servers)) proxyCredentials[`${server.host}:${server.port}`] = preset.credentials;
        Object.assign(proxyCredentials,preset.proxyCredentials || {});
        await chrome.storage.local.set({servers:{...saved.servers,...preset.servers},proxyCredentials,presetImported:true,presetRevision:preset.revision || 1});
        await chrome.storage.local.remove('lastProxyError');
        saved = await chrome.storage.local.get(['servers','selectedCountry']);
      }
    }
  }
  servers = saved.servers || {};
  const available = countries.filter(([code]) => servers[code]?.host && servers[code]?.port);
  for (const [code,name] of available) $('country').add(new Option(name,code));
  $('country').value = available.some(([code]) => code === saved.selectedCountry) ? saved.selectedCountry : (available[0]?.[0] || '');
  await refresh();
}
init().catch(error => { $('status').textContent = 'No se pudo leer la configuración'; $('message').textContent = error.message; });
