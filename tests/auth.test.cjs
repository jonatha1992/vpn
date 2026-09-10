const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function setup() {
  const listeners = {};
  const state = {levelOfControl:'controlled_by_this_extension',value:{rules:{singleProxy:{host:'proxy.example',port:8080}}}};
  const chrome = {
    proxy:{settings:{get:async()=>state},onProxyError:{addListener:fn=>{listeners.onProxyError=fn;}}},
    storage:{local:{set:async()=>{},get:async()=>({proxyCredentials:{'proxy.example:8080':{username:'test',password:'dummy'}}})}},
    webRequest:Object.fromEntries(['onAuthRequired','onCompleted','onErrorOccurred'].map(name=>[name,{addListener:fn=>{listeners[name]=fn;}}]))
  };
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../background.js'),'utf8'),{chrome,Set});
  const invoke = (overrides={}) => new Promise(resolve=>listeners.onAuthRequired({isProxy:true,requestId:'1',challenger:{host:'proxy.example',port:8080},...overrides},value=>resolve(JSON.parse(JSON.stringify(value)))));
  return {invoke,state,listeners};
}
test('authenticates controlled proxy and limits retries',async()=>{
  const {invoke,listeners}=setup();
  assert.deepEqual(await invoke(),{authCredentials:{username:'test',password:'dummy'}});
  assert.deepEqual(await invoke(),{cancel:true});
  listeners.onCompleted({requestId:'1'});
  assert.ok((await invoke()).authCredentials);
});
test('does not disclose credentials to sites or other proxies',async()=>{
  const {invoke,state}=setup();
  assert.deepEqual(await invoke({isProxy:false}),{});
  assert.deepEqual(await invoke({challenger:{host:'other.example',port:8080}}),{});
  assert.deepEqual(await invoke({challenger:{host:'proxy.example',port:80}}),{});
  state.levelOfControl='controlled_by_other_extensions';
  assert.deepEqual(await invoke(),{});
});
