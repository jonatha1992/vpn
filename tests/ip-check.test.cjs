const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname,'../ip-check.js'),'utf8');
function query(fetch) {
  const context = vm.createContext({fetch,Date});
  vm.runInContext(source,context);
  return context.queryPublicIp;
}
test('returns observed IP and bypasses cache',async()=>{
  const check = query(async(url,options)=>{
    assert.ok(url.startsWith('https://api.ipify.org?format=json&t='));
    assert.equal(options.cache,'no-store');
    assert.equal(options.credentials,'include');
    return {ok:true,json:async()=>({ip:'203.0.113.7'})};
  });
  assert.equal(await check(),'203.0.113.7');
});
test('rejects service failures and malformed addresses',async()=>{
  await assert.rejects(query(async()=>({ok:false}))());
  for (const ip of ['999.0.0.1','not an ip',null]) {
    await assert.rejects(query(async()=>({ok:true,json:async()=>({ip})}))());
  }
});
