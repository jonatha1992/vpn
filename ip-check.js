async function queryPublicIp(signal) {
  const response = await fetch(`https://api.ipify.org?format=json&t=${Date.now()}`, {
    cache:'no-store', credentials:'include', signal
  });
  if (!response.ok) throw new Error('El servicio de IP no respondió correctamente.');
  const {ip} = await response.json();
  if (typeof ip !== 'string' || !/^(\d{1,3}\.){3}\d{1,3}$/.test(ip) || ip.split('.').some(part => Number(part) > 255)) {
    throw new Error('El servicio devolvió una IP inválida.');
  }
  return ip;
}
