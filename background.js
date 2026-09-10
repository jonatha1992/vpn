const attempts = new Set();
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
