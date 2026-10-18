/* LoopBack v1.1.0 — minimal web UI, native Android alarm bridge */
(() => {
  'use strict';
  const KEY_PRESETS = 'loopback.presets.v1';
  const KEY_HISTORY = 'loopback.history.v1';
  const KEY_WEB_RUNS = 'loopback.webRuns.v1';
  const DEFAULTS = [
    {id:'washer',name:'Washer started',emoji:'🫧',tone:'mint',minutes:50,repeatMinutes:10,message:'The washer finished. Move clothes to the dryer.',nextId:'dryer'},
    {id:'dryer',name:'Dryer started',emoji:'👕',tone:'sky',minutes:60,repeatMinutes:10,message:'The dryer finished. Take the clothes out.',nextId:'putaway'},
    {id:'putaway',name:'Put laundry away',emoji:'🧺',tone:'sand',minutes:15,repeatMinutes:10,message:'Finish putting away the laundry.',nextId:''},
    {id:'dishwasher',name:'Dishwasher running',emoji:'🍽️',tone:'lilac',minutes:120,repeatMinutes:15,message:'The dishwasher cycle should be finished.',nextId:''},
    {id:'break',name:'Taking a break',emoji:'☕',tone:'rose',minutes:15,repeatMinutes:5,message:'Your break is over. Ready to return?',nextId:''},
    {id:'cleaner',name:'Cleaner soaking',emoji:'✨',tone:'mint',minutes:10,repeatMinutes:5,message:'Go back and finish cleaning.',nextId:''}
  ];
  const icons = {
    home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>',
    list:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></svg>',
    settings:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M18.4 5.6l-2.1 2.1m-8.6 8.6-2.1 2.1"/><circle cx="12" cy="12" r="4"/></svg>'
  };
  const app = document.getElementById('app');
  const overlay = document.getElementById('overlay-root');
  const toastBox = document.getElementById('toast');
  let toastTimer;
  const read = (key, fallback) => {try { const val=JSON.parse(localStorage.getItem(key));return val===null?fallback:val; }catch{return fallback;}};
  const save = (key,v) => localStorage.setItem(key,JSON.stringify(v));
  const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const idgen = () => (globalThis.crypto?.randomUUID?.() || 'r-'+Date.now()+'-'+Math.random().toString(36).slice(2));
  const isNative = () => Boolean(window.Capacitor?.isNativePlatform?.() || (window.Capacitor?.getPlatform?.() === 'android'));
  const bridge = () => window.Capacitor?.Plugins?.LoopBackReminders || window.Capacitor?.registerPlugin?.('LoopBackReminders');
  const nativeCall = async (method, data={}) => {const p=bridge();if(!p?.[method])throw new Error('Native reminder service is not installed');return p[method](data);};
  const dateTime = t => new Date(t).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  const fmt = t => new Date(t).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
  const remaining = (due,now) => {let d=Math.ceil(Math.abs(due-now)/1000);const h=Math.floor(d/3600),m=Math.floor(d%3600/60),s=d%60;return (h?h+'h ':'')+(m||h?m+'m ':'')+(!h?s+'s':'');};
  const presetById = id => state.presets.find(x=>x.id===id);
  let state = {
    tab:'home', presets:read(KEY_PRESETS, DEFAULTS), history:read(KEY_HISTORY, []), runs:[],
    permissions:{notifications:false,exact:false}, clock:Date.now(), modal:null, nativeProblem:false
  };
  // Browser preview only. It can alert while the page is open, not when it is killed or suspended.
  const webBackend = {
    async schedule(run){let runs=read(KEY_WEB_RUNS,[]);runs.push(run);save(KEY_WEB_RUNS,runs);},
    async finish(id){save(KEY_WEB_RUNS,read(KEY_WEB_RUNS,[]).filter(x=>x.id!==id));},
    async snooze(id,minutes){let runs=read(KEY_WEB_RUNS,[]);runs=runs.map(x=>x.id===id?{...x,dueAt:Date.now()+minutes*60000,nextAlertAt:Date.now()+minutes*60000}:x);save(KEY_WEB_RUNS,runs);},
    async list(){return read(KEY_WEB_RUNS,[]);},
    async status(){return {notifications:(typeof Notification!=='undefined'&&Notification.permission==='granted'),exact:false};},
    async requestNotificationPermission(){if('Notification' in window)await Notification.requestPermission();return this.status();}
  };
  const api = {
    async schedule(run){return isNative()?nativeCall('schedule',run):webBackend.schedule(run);},
    async finish(id){return isNative()?nativeCall('finish',{id}):webBackend.finish(id);},
    async snooze(id,minutes){return isNative()?nativeCall('snooze',{id,minutes}):webBackend.snooze(id,minutes);},
    async list(){return isNative()?(await nativeCall('list')).runs:webBackend.list();},
    async status(){return isNative()?nativeCall('status'):webBackend.status();},
    async requestNotificationPermission(){return isNative()?nativeCall('requestNotificationPermission'):webBackend.requestNotificationPermission()},
    async openExactAlarmSettings(){return isNative()?nativeCall('openExactAlarmSettings'):undefined;}
  };
  const toast = message => {toastBox.textContent=message;toastBox.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastBox.classList.remove('show'),2800);};
  const persistPresets=()=>save(KEY_PRESETS,state.presets);
  const persistHistory=()=>save(KEY_HISTORY,state.history);
  async function refresh(){
    try{state.runs=await api.list() || [];state.nativeProblem=false;}catch(e){state.nativeProblem=isNative();console.error(e);}
    try{state.permissions=await api.status();}catch(e){console.warn(e);}
    render();
  }
  function header(){return `<header class="app-header"><div><div class="brand">LoopBack<span class="brand-dot">.</span></div><p class="brand-caption">A little less to keep in mind.</p></div><div class="mark" aria-hidden="true">↻</div></header>`;}
  const section = (name,aside='') => `<div class="topline"><h2 class="section-title">${name}</h2><span class="muted">${aside}</span></div>`;
  function banner(){
    if(state.nativeProblem)return `<div class="notice"><span>!</span><div>Native reminder service unavailable. Android alarms are not scheduled. Check installation.<br><button data-tab="settings">Check settings</button></div></div>`;
    if(!isNative())return `<div class="notice"><span>i</span><div>Browser preview only. For reminders that work with the app closed, install the Android version.</div></div>`;
    if(!state.permissions.notifications)return `<div class="notice"><span>!</span><div>Notifications are disabled, so reminders may be silent.<br><button data-action="enable-permissions">Enable notifications</button></div></div>`;
    if(!state.permissions.exact)return `<div class="notice"><span>i</span><div>Android may delay reminders without exact alarm access.<br><button data-action="open-exact">Allow exact alarms</button></div></div>`;
    return '';
  }
  function home(){
    const overdue=state.runs.filter(x=>x.dueAt<=state.clock).length;
    const sorted=[...state.runs].sort((a,b)=>a.dueAt-b.dueAt);
    const status=`<div class="overview" aria-label="Activity overview"><div class="overview-icon ${overdue?'urgent':''}">${overdue?'!':'✓'}</div><div class="overview-copy"><strong>${overdue?`${overdue} ${overdue===1?'reminder needs':'reminders need'} attention`:state.runs.length?`${state.runs.length} ${state.runs.length===1?'activity':'activities'} in progress`:'All clear for now'}</strong><span>${state.runs.length} open loops · ${overdue} need attention</span></div></div>`;
    const openSection=`<section class="section">${section('Open loops',state.runs.length+' active')}${sorted.length?sorted.map(runCard).join(''):`<div class="empty"><span class="empty-icon" aria-hidden="true">✓</span><b>Nothing waiting on you</b><p>Anything you start will stay here until it’s handled.</p></div>`}</section>`;
    const actionsSection=`<section class="section">${section('Quick start','Tap to set a time')}<div class="quick-grid">${state.presets.slice(0,6).map(p=>`<button class="quick-card" data-action="prepare-start" data-id="${escapeHTML(p.id)}"><span class="quick-icon ${escapeHTML(p.tone)}" aria-hidden="true">${escapeHTML(p.emoji)}</span><div><div class="title-line">${escapeHTML(p.name)}</div><div class="quick-desc">${p.minutes} min preset</div></div></button>`).join('')}</div><button class="add-card" data-action="new-preset"><span aria-hidden="true">+</span> New action</button></section>`;
    return `${header()}${banner()}${status}${state.runs.length?openSection+actionsSection:actionsSection+openSection}`;
  }
  function runCard(r){
    const p=presetById(r.presetId);
    const overdue=r.dueAt<=state.clock;
    const duration=Math.max(1,r.dueAt-r.startedAt);
    const progress=overdue?100:Math.max(0,Math.min(100,100-(r.dueAt-state.clock)/duration*100));
    const next=p?.nextId?state.presets.find(x=>x.id===p.nextId):null;
    return `<article class="run-card ${overdue?'overdue':''}"><div class="run-head"><div style="display:flex;gap:11px;align-items:center"><span class="run-icon">${escapeHTML(p?.emoji||'⏱️')}</span><div><div class="run-title">${escapeHTML(r.title)}</div><div class="run-sub">${overdue?'Due '+fmt(r.dueAt):'Reminder at '+fmt(r.dueAt)}</div></div></div><span class="pill ${overdue?'warn':''}">${overdue?'Needs attention':'Running'}</span></div>
      <div class="timer-row"><span class="timer ${overdue?'warn':''}">${remaining(r.dueAt,state.clock)}</span><span class="muted">${overdue?'overdue':'remaining'}</span></div><div class="bar"><span style="width:${progress}%"></span></div>
      <div class="run-actions"><button data-action="snooze" data-id="${escapeHTML(r.id)}">+10 min</button><button data-action="change-time" data-id="${escapeHTML(r.id)}">Adjust</button><button class="primary" data-action="complete" data-id="${escapeHTML(r.id)}">${next?'Next step →':'Handled ✓'}</button></div></article>`;
  }
  function routines(){return `${header()}${section('Your actions',state.presets.length+' saved')}
    <p class="note" style="margin-bottom:17px">Set them up once. Every button opens a quick time confirmation before starting.</p>
    ${state.presets.map(p=>`<div class="list-card"><div class="list-icon">${escapeHTML(p.emoji)}</div><div class="list-main"><b>${escapeHTML(p.name)}</b><span>${p.minutes} min · repeat every ${p.repeatMinutes} min${p.nextId&&presetById(p.nextId)?' · → '+escapeHTML(presetById(p.nextId).name):''}</span></div><button class="icon-btn" aria-label="Edit ${escapeHTML(p.name)}" data-action="edit-preset" data-id="${escapeHTML(p.id)}">✎</button><button class="icon-btn" aria-label="Start ${escapeHTML(p.name)}" data-action="prepare-start" data-id="${escapeHTML(p.id)}">▶</button></div>`).join('')}
    <button class="btn full" style="margin-top:13px" data-action="new-preset">＋ Create an action</button>`;}
  function history(){
    return `${header()}${section('Finished loops',state.history.length+' handled')}${state.history.length?state.history.slice(0,100).map(h=>`<div class="list-card"><div class="list-icon">✓</div><div class="list-main"><b>${escapeHTML(h.title)}</b><span>Handled ${dateTime(h.handledAt)} · started ${dateTime(h.startedAt)}</span></div></div>`).join(''):`<div class="empty" style="margin-top:17px"><span class="empty-icon">↻</span><b>Every closed loop counts</b><p>Completed activities will appear here. No streaks or pressure.</p></div>`}`;
  }
  function settings(){
    const native=isNative();
    return `${header()}${section('Reminder reliability')}<p class="note" style="margin-bottom:17px">LoopBack needs notification access. For closer-to-the-minute delivery, Android also needs exact-alarm access.</p>
      <div class="setting"><div class="setting-line"><b>Phone notifications</b><span class="pill ${state.permissions.notifications?'':'warn'}"><i class="status-dot ${state.permissions.notifications?'good':''}"></i>${state.permissions.notifications?'Enabled':'Not enabled'}</span></div><p>${native?'Notifications can arrive even when LoopBack is closed.':'Browser notifications are only a temporary demonstration and may stop when the page is closed.'}</p><button class="btn secondary full" data-action="enable-permissions">${state.permissions.notifications?'Check notification access':'Enable notifications'}</button></div>
      ${native?`<div class="setting"><div class="setting-line"><b>Exact alarm timing</b><span class="pill ${state.permissions.exact?'':'warn'}">${state.permissions.exact?'Allowed':'Inexact'}</span></div><p>Android 12+ may require the Alarms & reminders special access. Without it, reminders are still scheduled but can arrive late.</p><button class="btn secondary full" data-action="open-exact">Open alarm permission settings</button></div>`:''}
      <div class="setting"><b>Repeat until acknowledged</b><p>When time is up, your phone reminds you again at your action's repeat interval. Swiping away a notification does not complete the activity. Tap Handled in the app when you've actually done it.</p></div>
      <div class="setting"><b>Local and private</b><p>Your actions are stored on this device. No account, ads, tracking, or cloud sync. Uninstalling or clearing app data removes your history and presets.</p></div>
      <div class="setting"><b>Back up your setup</b><p>Export your custom actions and completion history to a JSON file for safekeeping.</p><div class="button-row"><button class="btn secondary" data-action="export-data">Export</button><button class="btn secondary" data-action="import-data">Import</button></div><input type="file" id="import-file" accept="application/json,.json" hidden></div>
      <div class="note center" style="margin-top:24px">LoopBack v1.1.0 · Offline-first · Designed for unfinished things, not perfection.</div>`;
  }
  const tabs=()=>`<nav class="tabs" aria-label="Main navigation">${[['home','Today','home'],['routines','Actions','list'],['history','Handled','clock'],['settings','Settings','settings']].map(([key,label,ico])=>`<button class="tab ${state.tab===key?'active':''}" data-tab="${key}" aria-current="${state.tab===key?'page':'false'}">${icons[ico]}<span>${label}</span></button>`).join('')}</nav>`;
  const render=()=>{state.clock=Date.now();app.innerHTML=`<main class="shell"><div class="content">${({home,routines,history,settings}[state.tab])()}</div>${tabs()}</main>`;};
  function showModal(markup){overlay.innerHTML=`<div class="sheet-back" data-action="outside"><div class="sheet" role="dialog" aria-modal="true" aria-label="Action details"><div class="sheet-handle"></div>${markup}</div></div>`;}
  function closeModal(){state.modal=null;overlay.innerHTML='';}
  function prepareStart(presetId,context={}){
    const p=presetById(presetId);if(!p)return;
    state.modal={type:'start',presetId,minutes:p.minutes,...context};
    renderStart();
  }
  function renderStart(){
    const m=state.modal,p=presetById(m.presetId);if(!p)return;
    showModal(`<p class="eyebrow">Confirm your action</p><h2>${escapeHTML(p.emoji)} ${escapeHTML(p.name)}</h2><p>Is it started? Adjust the time if needed, then LoopBack will take it from here.</p><form id="start-form"><div class="field"><label>Remind me in</label><div class="duration-picker"><button type="button" data-action="duration-minus" aria-label="Subtract 5 minutes">−</button><div class="center"><span class="big">${m.minutes}</span><span class="unit">minutes</span></div><button type="button" data-action="duration-plus" aria-label="Add 5 minutes">＋</button></div></div><div class="field"><label for="start-repeat">Repeat if not handled</label><select id="start-repeat"><option value="5" ${p.repeatMinutes===5?'selected':''}>Every 5 minutes</option><option value="10" ${p.repeatMinutes===10?'selected':''}>Every 10 minutes</option><option value="15" ${p.repeatMinutes===15?'selected':''}>Every 15 minutes</option><option value="30" ${p.repeatMinutes===30?'selected':''}>Every 30 minutes</option><option value="60" ${p.repeatMinutes===60?'selected':''}>Every hour</option></select></div><div class="note">Reminder: ${escapeHTML(p.message)}</div><div class="sheet-actions"><button class="btn ghost" type="button" data-action="close-modal">Cancel</button><button class="btn" type="submit">Start reminder →</button></div></form>`);
  }
  function presetModal(id){
    const p=id?presetById(id):null;
    state.modal={type:'preset',id:id||null};
    const options=state.presets.filter(x=>x.id!==id).map(x=>`<option value="${escapeHTML(x.id)}" ${p?.nextId===x.id?'selected':''}>${escapeHTML(x.name)}</option>`).join('');
    showModal(`<p class="eyebrow">${p?'Edit action':'Create an action'}</p><h2>${p?'Make it yours':'One less thing to remember'}</h2><p>You'll only configure this once. Future starts take two taps.</p><form id="preset-form"><div class="field"><label for="preset-name">Action name</label><input id="preset-name" maxlength="54" required placeholder="e.g. Washer started" value="${escapeHTML(p?.name||'')}"></div><div class="field"><label for="preset-emoji">Choose an icon</label><select id="preset-emoji">${['🫧','👕','🧺','🍽️','☕','✨','🪴','📦','⏱️','🧹','🐶','✉️','🔧','🏠'].map(x=>`<option value="${x}" ${p?.emoji===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label for="preset-minutes">Default duration (minutes)</label><input type="number" id="preset-minutes" min="1" max="10080" required value="${p?.minutes||30}"></div><div class="field"><label for="preset-repeat">Remind again every</label><select id="preset-repeat">${[5,10,15,30,60].map(v=>`<option value="${v}" ${v===(p?.repeatMinutes||10)?'selected':''}>${v} minutes</option>`).join('')}</select></div><div class="field"><label for="preset-message">Notification message</label><input id="preset-message" maxlength="150" required value="${escapeHTML(p?.message||'It is time to come back to this.')}"></div><div class="field"><label for="preset-next">Optional next step</label><select id="preset-next"><option value="">No next step</option>${options}</select><div class="hint">When you mark this handled, you'll be offered the next step to start.</div></div><div class="sheet-actions"><button class="btn ghost" type="button" data-action="close-modal">Cancel</button><button class="btn" type="submit">Save action</button></div>${p?`<button class="btn warn full" style="margin-top:10px" type="button" data-action="delete-preset" data-id="${escapeHTML(p.id)}">Delete action</button>`:''}</form>`);
  }
  function adjustModal(id){const r=state.runs.find(x=>x.id===id);if(!r)return;state.modal={type:'adjust',id};showModal(`<p class="eyebrow">Adjust reminder</p><h2>${escapeHTML(r.title)}</h2><p>Change when this activity should alert you next. The repeat interval stays the same.</p><form id="adjust-form"><div class="field"><label for="adjust-minutes">Remind me in (minutes)</label><input type="number" id="adjust-minutes" min="1" max="10080" value="10" required></div><div class="sheet-actions"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn" type="submit">Update reminder</button></div></form>`);}
  async function started(){
    const m=state.modal,p=presetById(m.presetId);if(!p)return;
    const minutes=Math.max(1,Math.min(10080,Number(m.minutes)||p.minutes));
    const repeatMinutes=Number(document.getElementById('start-repeat').value);
    const start=Date.now();
    const run={id:idgen(),presetId:p.id,chainId:m.chainId||null,stepIndex:m.stepIndex||0,title:p.name,message:p.message,startedAt:start,dueAt:start+minutes*60000,nextAlertAt:start+minutes*60000,repeatMinutes};
    try{await api.schedule(run);closeModal();await refresh();toast(`Started. We'll remind you in ${minutes} min.`);if(isNative()&&!state.permissions.notifications)toast('Enable notifications in Settings to hear your reminder.');}
    catch(e){toast('Could not schedule reminder: '+e.message);}
  }
  async function complete(id){
    const r=state.runs.find(x=>x.id===id);if(!r)return;
    try{
      await api.finish(id);
      state.history.unshift({...r,handledAt:Date.now()});state.history=state.history.slice(0,300);persistHistory();
      const nextId=presetById(r.presetId)?.nextId;
      await refresh();
      if(nextId && presetById(nextId)){prepareStart(nextId,{chainId:r.chainId||r.id,stepIndex:(r.stepIndex||0)+1});toast('Step handled. Start the next one when ready.');}
      else toast('Loop closed. Nicely handled.');
    }catch(e){toast('Could not mark handled: '+e.message);}
  }
  async function snooze(id,minutes){
    try{await api.snooze(id,minutes);await refresh();toast(`Reminder moved to ${minutes} minutes from now.`);}catch(e){toast('Could not snooze: '+e.message);}
  }
  function detectCycle(start,nextId){
    let seen=new Set([start]);let cur=nextId;while(cur){if(seen.has(cur))return true;seen.add(cur);cur=presetById(cur)?.nextId;}return false;
  }
  function savePreset(){
    const oldId=state.modal.id;
    const name=document.getElementById('preset-name').value.trim();
    const minutes=Number(document.getElementById('preset-minutes').value);
    const repeatMinutes=Number(document.getElementById('preset-repeat').value);
    const nextId=document.getElementById('preset-next').value;
    const id=oldId||idgen();
    if(!name||!Number.isInteger(minutes)||minutes<1||minutes>10080){toast('Enter a name and a duration from 1 to 10,080 minutes.');return;}
    if(detectCycle(id,nextId)){toast('That next step would create a loop. Choose a different step.');return;}
    const p={id,name,emoji:document.getElementById('preset-emoji').value,tone:'mint',minutes,repeatMinutes,message:document.getElementById('preset-message').value.trim()||'Come back to this.',nextId};
    if(oldId)state.presets=state.presets.map(x=>x.id===oldId?p:x);else state.presets.push(p);
    persistPresets();closeModal();render();toast('Action saved.');
  }
  async function askPermission(){
    try{state.permissions=await api.requestNotificationPermission();await refresh();toast(state.permissions.notifications?'Notifications enabled.':'Notification permission not granted.');}
    catch(e){toast('Could not open notification permission: '+e.message);}
  }
  async function openExact(){try{await api.openExactAlarmSettings();toast('Return here after checking Alarms & reminders access.');}catch(e){toast(e.message);}}
  function exportData(){
    const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),presets:state.presets,history:state.history},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='loopback-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast('Backup exported.');
  }
  async function importData(file){
    if(!file)return;
    try{
      const json=JSON.parse(await file.text());
      if(json.version!==1||!Array.isArray(json.presets)||!Array.isArray(json.history))throw new Error('Not a LoopBack v1 backup');
      const ids=new Set();const presets=json.presets.map(p=>{
        if(typeof p.id!=='string'||!p.id||ids.has(p.id)||typeof p.name!=='string'||p.name.length>54||typeof p.message!=='string'||!Number.isInteger(p.minutes)||p.minutes<1||p.minutes>10080||![5,10,15,30,60].includes(p.repeatMinutes))throw new Error('Invalid action data');
        ids.add(p.id);return {id:p.id,name:p.name,emoji:String(p.emoji||'⏱️').slice(0,8),tone:'mint',minutes:p.minutes,repeatMinutes:p.repeatMinutes,message:p.message.slice(0,150),nextId:typeof p.nextId==='string'?p.nextId:''};
      });
      presets.forEach(p=>{if(p.nextId&&!ids.has(p.nextId))p.nextId='';});
      if(json.history.length>2000)throw new Error('Backup too large');
      if(!confirm('Replace your current actions and completion history? Active reminders will NOT be removed.'))return;
      state.presets=presets;state.history=json.history.filter(h=>typeof h?.title==='string').slice(0,300);
      persistPresets();persistHistory();render();toast('Backup imported.');
    }catch(e){toast('Import failed: '+e.message);}
  }
  document.addEventListener('click',async e=>{
    const btn=e.target.closest('[data-action],[data-tab]');if(!btn)return;
    const action=btn.dataset.action,id=btn.dataset.id;
    if(btn.dataset.tab){state.tab=btn.dataset.tab;window.scrollTo(0,0);render();return;}
    if(action==='outside'&&e.target===btn){closeModal();return;}
    if(action==='close-modal'){closeModal();return;}
    if(action==='prepare-start'){prepareStart(id);return;}
    if(action==='new-preset'){presetModal(null);return;}
    if(action==='edit-preset'){presetModal(id);return;}
    if(action==='duration-minus'||action==='duration-plus'){
      state.modal.minutes=Math.max(1,Math.min(10080,state.modal.minutes+(action==='duration-plus'?5:-5)));
      const chosen=document.getElementById('start-repeat')?.value;
      renderStart();if(chosen)document.getElementById('start-repeat').value=chosen;return;
    }
    if(action==='complete'){await complete(id);return;}
    if(action==='snooze'){await snooze(id,10);return;}
    if(action==='change-time'){adjustModal(id);return;}
    if(action==='delete-preset'){
      if(state.runs.some(x=>x.presetId===id)){toast('Finish this action’s active reminders before deleting.');return;}
      if(!confirm('Delete this action? Existing completed history will remain.'))return;
      state.presets=state.presets.filter(x=>x.id!==id).map(x=>x.nextId===id?{...x,nextId:''}:x);persistPresets();closeModal();render();toast('Action deleted.');return;
    }
    if(action==='enable-permissions'){await askPermission();return;}
    if(action==='open-exact'){await openExact();return;}
    if(action==='export-data'){exportData();return;}
    if(action==='import-data'){document.getElementById('import-file')?.click();return;}
  });
  document.addEventListener('submit',async e=>{
    if(!['start-form','preset-form','adjust-form'].includes(e.target.id))return;
    e.preventDefault();
    if(e.target.id==='start-form')await started();
    if(e.target.id==='preset-form')savePreset();
    if(e.target.id==='adjust-form'){
      const mins=Number(document.getElementById('adjust-minutes').value);
      if(!Number.isInteger(mins)||mins<1||mins>10080)return toast('Choose 1 to 10,080 minutes.');
      const id=state.modal.id;closeModal();await snooze(id,mins);
    }
  });
  document.addEventListener('change',e=>{if(e.target.id==='import-file')importData(e.target.files?.[0]);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.modal)closeModal();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  window.addEventListener('focus',refresh);
  document.addEventListener('resume',refresh);
  // Preview: limited to a running web page. Android alarms are handled natively by AlarmReceiver.
  async function webTick(){
    if(isNative())return;
    const runs=read(KEY_WEB_RUNS,[]);let changed=false;
    for(const r of runs){
      if(Date.now()>=r.nextAlertAt){
        const overdueDelta=Math.max(0,Date.now()-r.nextAlertAt);
        r.nextAlertAt+=((Math.floor(overdueDelta/(r.repeatMinutes*60000))+1)*r.repeatMinutes*60000);
        changed=true;
        if('Notification' in window&&Notification.permission==='granted'&&!document.hidden){
          try{new Notification('LoopBack · '+r.title,{body:r.message,tag:r.id});}catch{}
        }
        toast('Reminder: '+r.message);
      }
    }
    if(changed){save(KEY_WEB_RUNS,runs);state.runs=runs;render();}
  }
  setInterval(()=>{state.clock=Date.now();if(state.tab==='home')render();webTick();},1000);
  if('serviceWorker' in navigator && !isNative() && location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
  refresh();
})();
