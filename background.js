const attempts = new Set();
async function updateActionStatus() {
  const settings = await chrome.proxy.settings.get({incognito:false});
  const active = settings.levelOfControl === 'controlled_by_this_extension';
  await Promise.all([
    chrome.action.setBadgeText({text:active ? 'ON' : 'OFF'}),
    chrome.action.setBadgeBackgroundColor({color:active ? '#23855b' : '#5f6b78'}),
    chrome.action.setTitle({title:active ? 'Pasaporte VPN: activa' : 'Pasaporte VPN: desactivada'})
  ]);
}
chrome.proxy.settings.onChange.addListener(() => {
  void updateActionStatus().catch(() => {});
});
void updateActionStatus().catch(() => {});
function recordProxyError(error) {
  return chrome.storage.local.set({lastProxyError:{error,time:Date.now()}});
}
chrome.proxy.onProxyError.addListener(details => {
  void recordProxyError(details.error).catch(() => {});
});
chrome.webRequest.onAuthRequired.addListener((details, callback) => {
  (async () => {
    if (!details.isProxy) return {};
    const settings = await chrome.proxy.settings.get({incognito:false});
    const active = settings.value?.rules?.singleProxy;
    if (settings.levelOfControl !== 'controlled_by_this_extension' ||
        active?.host !== details.challenger.host || active?.port !== details.challenger.port) return {};
    const {proxyCredentials = {}} = await chrome.storage.local.get('proxyCredentials');
    const credentials = proxyCredentials[`${active.host}:${active.port}`];
    if (!credentials) {
      await recordProxyError('MISSING_PROXY_CREDENTIALS');
      return {cancel:true};
    }
    if (attempts.has(details.requestId)) {
      await recordProxyError('PROXY_AUTH_REJECTED');
      return {cancel:true};
    }
    attempts.add(details.requestId);
    return {authCredentials:credentials};
  })().then(callback, () => callback({cancel:true}));
}, {urls:['<all_urls>']}, ['asyncBlocking']);
const clearAttempt = details => attempts.delete(details.requestId);
chrome.webRequest.onCompleted.addListener(clearAttempt, {urls:['<all_urls>']});
chrome.webRequest.onErrorOccurred.addListener(clearAttempt, {urls:['<all_urls>']});
