import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const handlers={};
const storage=new Map();
const nodes={app:{innerHTML:''},'overlay-root':{innerHTML:''},toast:{textContent:'',classList:{add(){},remove(){}}}};
const fakeDoc={
  getElementById(id){if(nodes[id])return nodes[id]; return {value:{'start-repeat':'10','preset-name':'Water plants','preset-emoji':'🪴','preset-minutes':'20','preset-repeat':'5','preset-message':'Water the plants','preset-next':'','adjust-minutes':'12'}[id]||''};},
  addEventListener(name,cb){handlers[name]=cb},
  createElement(){return {click(){},remove(){}}},body:{appendChild(){}}
};
const localStorage={getItem(k){return storage.get(k)||null},setItem(k,v){storage.set(k,v)}};
const context={console,document:fakeDoc,localStorage,window:{scrollTo(){},addEventListener(){}},navigator:{},Date,Math,JSON,Number,Boolean,String,Array,Set,URL,Blob,Promise,crypto:{randomUUID:()=>String(Math.random())},setInterval(){},setTimeout:()=>1,clearTimeout(){}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('../www/app.js',import.meta.url),'utf8'),context);
await new Promise(r=>setTimeout(r,10));
const click=async (action,id)=>{
  const node={dataset:{action,id},closest(){return this}};
  await handlers.click({target:node});
  await new Promise(r=>setTimeout(r,2));
};
const submit=async formid=>{
  await handlers.submit({target:{id:formid},preventDefault(){}});
  await new Promise(r=>setTimeout(r,2));
};
assert.match(nodes.app.innerHTML,/Washer started/);
assert.match(nodes.app.innerHTML,/Browser preview/);
await click('prepare-start','washer');
assert.match(nodes['overlay-root'].innerHTML,/Confirm your action/);
await click('duration-minus');
assert.match(nodes['overlay-root'].innerHTML,/>45</);
await submit('start-form');
assert.match(nodes.app.innerHTML,/open loops/);
assert.equal(JSON.parse(storage.get('loopback.webRuns.v1')).length,1);
const id=JSON.parse(storage.get('loopback.webRuns.v1'))[0].id;
await click('complete',id);
assert.equal(JSON.parse(storage.get('loopback.webRuns.v1')).length,0);
assert.match(nodes['overlay-root'].innerHTML,/Dryer started/);
assert.equal(JSON.parse(storage.get('loopback.history.v1')).length,1);
await click('close-modal');
await click('new-preset');
await submit('preset-form');
assert.equal(JSON.parse(storage.get('loopback.presets.v1')).length,7);
console.log('PASS: home UI, browser warning, confirm/adjust timer, create run, handle run, chain prompt, history, create custom preset.');
