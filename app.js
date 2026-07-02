const $ = (q) => document.querySelector(q);
const STORAGE = 'deerIntel.v1';
const state = JSON.parse(localStorage.getItem(STORAGE) || 'null') || {
  user:null,
  properties:[{id:crypto.randomUUID(),name:'Finley Run',state:'PA',county:'',areaNotes:'Back road access',lat:null,lng:null,boundary:[]},{id:crypto.randomUUID(),name:'Moore Hill',state:'PA',county:'',areaNotes:'Ridge country',lat:null,lng:null,boundary:[]}],
  selected:null,
  pins:[],
  hunts:[{date:'6/21/2026',stand:'West Bench Stand',result:'Saw 3 Does',wind:'NW 12 mph'},{date:'6/19/2026',stand:'Ridge Stand',result:'Saw 1 Buck',wind:'N 8 mph'}],
  activePage:'dashboard', placing:null
};
if(!state.selected) state.selected = state.properties[0].id;
const icons = {camera:'📷',stand:'🪜',buck:'🦌',doe:'🦌',scrape:'🦶',rub:'🪵',veg:'🌿',bed:'🛏️',food:'🌰',water:'💧',route:'🚶',risk:'⚠️'};
const labels = {camera:'Trail Camera',stand:'Treestand',buck:'Buck Sighting',doe:'Doe Sighting',scrape:'Scrape',rub:'Rub',veg:'Vegetation',bed:'Bedding Area',food:'Food Source',water:'Water Source',route:'Access Route',risk:'Wind Risk'};
function save(){localStorage.setItem(STORAGE,JSON.stringify(state));}
function render(){ state.user ? renderApp() : renderLogin(); }
function renderLogin(){
  $('#app').innerHTML = `<div class="login-wrap"><div class="login-card"><div class="logo"><div class="mark">🦌</div><div><div class="brand">DEER INTEL</div><div class="tag">Know the land. Pattern the deer.</div></div></div><h2>Sign in</h2><p class="hint">This starter app requires login before the map, pins, or property data can be used. For now it uses your browser storage; later this becomes Supabase secure login.</p><label>Username<input id="username" value="Ethan1998"></label><label>Password<input id="password" type="password" value="Luna2020"></label><div class="login-actions"><button id="loginBtn">Log In</button><button class="secondary" id="createBtn">Create Account</button></div><p class="hint">Prototype login: Ethan1998 / Luna2020</p></div></div>`;
  $('#loginBtn').onclick = login; $('#createBtn').onclick = login;
}
function login(){ const u=$('#username').value.trim(); const p=$('#password').value; if(!u||!p) return alert('Enter a username and password.'); state.user={username:u}; save(); render(); }
function selectedProperty(){ return state.properties.find(p=>p.id===state.selected); }
function renderApp(){
  const prop=selectedProperty();
  $('#app').innerHTML = `<div class="shell"><aside class="side"><div class="side-top"><div class="logo"><div class="mark">🦌</div><div><div class="brand">DEER INTEL</div><div class="tag">Pattern your deer</div></div></div></div><nav class="nav">${navButton('dashboard','🏠','Dashboard')}${navButton('setup','🧭','Property Setup')}${navButton('map','📍','Map & Pins')}${navButton('cameras','📷','Trail Cameras')}${navButton('stands','🪜','Tree Stands')}${navButton('hunts','📋','Hunt Log')}${navButton('ai','🤖','AI Scout')}${navButton('import','🧭','Spartan Import')}</nav><div class="user-box"><div><b>${state.user.username}</b></div><div class="muted">Starter account</div><button class="secondary" style="width:100%;margin-top:12px" id="logout">Log Out</button></div></aside><main class="main"><div class="topbar"><div><b>My Properties</b> · ${prop.name}</div><div class="pill">☁️ 52°F &nbsp; 🌬️ NW 12 mph</div></div><div class="content" id="mainContent"></div></main><aside class="ai"><div class="ai-head"><h2>🤖 AI Scout <span class="pill">Prototype</span></h2><p class="muted">Ask for stand recommendations using wind, temp, camera activity, and your saved pins.</p></div><div class="ai-body"><button class="secondary prompt" data-q="What stand should I hunt tonight?">What stand should I hunt tonight?</button><button class="secondary prompt" data-q="Show me recent buck activity">Show me recent buck activity</button><div id="aiAnswer">${aiRecommendation()}</div></div><div class="chat"><input id="chatInput" placeholder="Ask AI Scout anything..."><button id="askBtn">➤</button></div></aside></div>`;
  document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>{state.activePage=b.dataset.page; save(); renderApp();});
  $('#logout').onclick=()=>{state.user=null;save();render();};
  document.querySelectorAll('.prompt').forEach(b=>b.onclick=()=>askAI(b.dataset.q));
  $('#askBtn').onclick=()=>askAI($('#chatInput').value);
  renderMain();
}
function navButton(page,ico,text){return `<button data-page="${page}" class="${state.activePage===page?'active':''}">${ico}<span>${text}</span></button>`;}
function renderMain(){ const c=$('#mainContent'); const prop=selectedProperty();
  if(state.activePage==='dashboard') c.innerHTML = `<h1>${prop.name}</h1><p class="muted">${propertySubtitle(prop)}</p><div class="cards">${state.properties.map(p=>`<div class="property-card ${p.id===state.selected?'selected':''}" data-prop="${p.id}"><h3>${p.name}</h3><p class="muted">${propertySubtitle(p)}</p></div>`).join('')}<div class="property-card" id="quickAddProperty"><h3>+ Add Property</h3><p class="muted">Create by GPS, map pin, or notes. No address needed.</p></div></div>${stats()}${miniLists()}`;
  if(state.activePage==='setup') c.innerHTML = propertySetupHtml(prop);
  if(state.activePage==='map') c.innerHTML = `<h1>Map & Pins</h1><p class="muted">Choose a pin type, then click the map to place it. Use GPS in Property Setup to pick the general hunting area first.</p>${mapHtml()}${addPanel()}${pinList()}`;
  if(state.activePage==='cameras') c.innerHTML = `<h1>Trail Cameras</h1>${pinList('camera')}`;
  if(state.activePage==='stands') c.innerHTML = `<h1>Tree Stands</h1>${pinList('stand')}`;
  if(state.activePage==='hunts') c.innerHTML = `<h1>Hunt Log</h1><div class="list">${state.hunts.map(h=>`<div class="row"><div><b>${h.date}</b><br><span class="muted">${h.stand} · ${h.wind}</span></div><b>${h.result}</b></div>`).join('')}</div><button style="margin-top:12px" onclick="alert('Hunt log form coming next')">+ Add Hunt</button>`;
  if(state.activePage==='ai') c.innerHTML = `<h1>AI Scout</h1>${aiRecommendation()}<div class="panel"><h3>What AI Scout will use</h3><p class="muted">Wind, wind speed, temperature, pressure, rut phase, camera activity, hunt history, bedding pins, stand pins, access routes, scrapes, rubs, and vegetation.</p></div>`;
  if(state.activePage==='import') c.innerHTML = `<h1>Spartan Forge Import</h1><div class="panel"><h3>Import Pins</h3><p class="muted">Future feature: upload GPX, KML, or CSV waypoint files and sort them into Deer Intel pin categories.</p><input type="file" accept=".gpx,.kml,.csv"><button style="margin-top:12px">Import File</button></div>`;
  document.querySelectorAll('[data-prop]').forEach(el=>el.onclick=()=>{state.selected=el.dataset.prop;save();renderApp();});
  const addProp=$('#quickAddProperty'); if(addProp) addProp.onclick=()=>{state.activePage='setup'; save(); renderApp();};
  const createProp=$('#createPropertyBtn'); if(createProp) createProp.onclick=createProperty;
  const saveProp=$('#savePropertyBtn'); if(saveProp) saveProp.onclick=savePropertySetup;
  const gpsBtn=$('#gpsBtn'); if(gpsBtn) gpsBtn.onclick=useGpsForProperty;
  const manualBtn=$('#manualCoordBtn'); if(manualBtn) manualBtn.onclick=manualCoordinates;
  const propertyMap=$('#propertyPickerMap'); if(propertyMap) propertyMap.onclick=(e)=>{ const r=propertyMap.getBoundingClientRect(); prop.lat=(40.0 + (0.5-((e.clientY-r.top)/r.height))*0.2).toFixed(6); prop.lng=(-77.5 + (((e.clientX-r.left)/r.width)-0.5)*0.2).toFixed(6); prop.areaNotes = prop.areaNotes || 'Picked from map'; save(); renderApp(); };
  const map=$('#map'); if(map) map.onclick=(e)=>{ if(!state.placing) return; const r=map.getBoundingClientRect(); const name=prompt(`Name this ${labels[state.placing]}:`, labels[state.placing]); if(!name) return; state.pins.push({id:crypto.randomUUID(),propertyId:state.selected,type:state.placing,name,x:((e.clientX-r.left)/r.width)*100,y:((e.clientY-r.top)/r.height)*100,notes:''}); state.placing=null; save(); renderApp(); };
  document.querySelectorAll('[data-pin-type]').forEach(b=>b.onclick=()=>{state.placing=b.dataset.pinType; save(); renderApp();});
}
function propertySubtitle(p){ const bits=[]; if(p.state) bits.push(p.state); if(p.county) bits.push(p.county); if(p.lat&&p.lng) bits.push(`${Number(p.lat).toFixed(4)}, ${Number(p.lng).toFixed(4)}`); if(!bits.length && p.areaNotes) bits.push(p.areaNotes); return bits.join(' · ') || 'GPS/map based hunting area'; }
function propertySetupHtml(prop){ return `<h1>Property Setup</h1><p class="muted">No address required. Pick the area with GPS, coordinates, or by clicking the map.</p><div class="setup-grid"><div class="panel"><h3>Current Property</h3><label>Property Name<input id="propName" value="${prop.name||''}"></label><label>State<input id="propState" value="${prop.state||''}" placeholder="PA"></label><label>County optional<input id="propCounty" value="${prop.county||''}" placeholder="Optional"></label><label>General area / access notes<textarea id="propNotes" rows="4" placeholder="Back road, logging trail, gate, ridge name, etc.">${prop.areaNotes||''}</textarea></label><button id="savePropertyBtn">Save Property</button><hr><h3>Add New Property</h3><input id="newPropertyName" placeholder="New property name"><button class="secondary" id="createPropertyBtn" style="margin-top:10px">+ Create Property</button></div><div class="panel"><h3>GPS-Based Location</h3><p class="muted">Use your phone GPS when the site is hosted online, enter coordinates, or click the picker map below.</p><div class="gps-actions"><button id="gpsBtn">📍 Use My Location</button><button class="secondary" id="manualCoordBtn">⌨️ Enter Coordinates</button></div><div class="coord-box"><b>Saved Area Center</b><br><span class="muted">Lat: ${prop.lat||'not set'}<br>Lng: ${prop.lng||'not set'}</span></div><div class="picker-map" id="propertyPickerMap">${prop.lat&&prop.lng?`<div class="area-dot">📍</div>`:''}<span>Click map to pick general hunting area</span></div><p class="hint">Later this becomes a real satellite/topo map with drawing tools for property boundaries.</p></div></div>`; }
function createProperty(){ const name=$('#newPropertyName').value.trim(); if(!name) return alert('Enter a property name.'); const id=crypto.randomUUID(); state.properties.push({id,name,state:'PA',county:'',areaNotes:'',lat:null,lng:null,boundary:[]}); state.selected=id; state.activePage='setup'; save(); renderApp(); }
function savePropertySetup(){ const p=selectedProperty(); p.name=$('#propName').value.trim()||p.name; p.state=$('#propState').value.trim(); p.county=$('#propCounty').value.trim(); p.areaNotes=$('#propNotes').value.trim(); save(); renderApp(); }
function useGpsForProperty(){ if(!navigator.geolocation) return alert('GPS is not available in this browser.'); navigator.geolocation.getCurrentPosition(pos=>{ const p=selectedProperty(); p.lat=pos.coords.latitude.toFixed(6); p.lng=pos.coords.longitude.toFixed(6); p.areaNotes = p.areaNotes || 'Marked with phone GPS'; save(); renderApp(); }, err=>alert('GPS permission was denied or unavailable. Once hosted online, allow location access to use this feature.')); }
function manualCoordinates(){ const p=selectedProperty(); const lat=prompt('Latitude:', p.lat||''); if(lat===null) return; const lng=prompt('Longitude:', p.lng||''); if(lng===null) return; if(!lat.trim()||!lng.trim()) return alert('Enter both latitude and longitude.'); p.lat=lat.trim(); p.lng=lng.trim(); save(); renderApp(); }
function stats(){ const pins=state.pins.filter(p=>p.propertyId===state.selected); return `<div class="stats"><div class="stat"><b>${pins.filter(p=>p.type==='camera').length}</b><span>Cameras</span></div><div class="stat"><b>${pins.filter(p=>p.type==='stand').length}</b><span>Stands</span></div><div class="stat"><b>${pins.filter(p=>p.type==='scrape').length}</b><span>Scrapes</span></div><div class="stat"><b>${pins.filter(p=>p.type==='bed').length}</b><span>Bedding</span></div><div class="stat"><b>${pins.length}</b><span>Total Pins</span></div></div>`;}
function mapHtml(){ const pins=state.pins.filter(p=>p.propertyId===state.selected); return `<div class="map-wrap" id="map">${pins.map(p=>`<div class="pin" style="left:${p.x}%;top:${p.y}%" title="${p.name}">${icons[p.type]||'📍'}<small>${p.name}</small></div>`).join('')}<div class="map-tools"><button class="secondary">Map</button><button class="secondary">Satellite</button><button class="secondary">Topo</button></div></div>${state.placing?`<p class="hint">Placing: <b>${labels[state.placing]}</b>. Click the map.</p>`:''}`;}
function addPanel(){ return `<div class="add-panel">${Object.keys(labels).map(k=>`<button data-pin-type="${k}" class="${state.placing===k?'':'secondary'}">${icons[k]} ${labels[k]}</button>`).join('')}</div>`; }
function pinList(type){ const pins=state.pins.filter(p=>p.propertyId===state.selected && (!type||p.type===type)); return `<div class="list">${pins.length?pins.map(p=>`<div class="row"><div><b>${icons[p.type]} ${p.name}</b><br><span class="muted">${labels[p.type]} · ${selectedProperty().name}</span></div><button class="danger" onclick="deletePin('${p.id}')">Delete</button></div>`).join(''):'<div class="panel"><p class="muted">No pins yet. Go to Map & Pins and add some.</p></div>'}</div>`;}
window.deletePin=(id)=>{state.pins=state.pins.filter(p=>p.id!==id);save();renderApp();};
function miniLists(){return `<div class="cards"><div class="panel"><h3>Recent Camera Activity</h3><p class="muted">Add camera pins first, then photo logs come next.</p></div><div class="panel"><h3>Recent Hunt Log</h3>${state.hunts.map(h=>`<div class="row"><span>${h.date} · ${h.stand}</span><b>${h.result}</b></div>`).join('')}</div><div class="panel"><h3>AI Recommendation</h3>${aiRecommendation()}</div></div>`;}
function aiRecommendation(){ return `<div class="rec"><span class="score">91%</span><h3>West Bench Stand</h3><p class="muted">Best stand tonight based on NW wind, evening access, recent buck activity, and scent staying away from bedding.</p><ul><li>Wind keeps scent away from bedding</li><li>Good evening access</li><li>Recent buck movement nearby</li><li>Temperature drop helps movement</li></ul></div>`;}
function askAI(q){ if(!q) return; $('#aiAnswer').innerHTML = `<div class="rec"><h3>AI Scout Answer</h3><p><b>Question:</b> ${q}</p><p class="muted">Prototype answer: I would start with West Bench Stand tonight. As we connect real weather, camera logs, and hunt history, this answer will become data-driven.</p></div>`; }

const originalRenderApp = renderApp;
renderLogin = function renderStaticLogin(){
  $('#loginScreen')?.classList.remove('hidden');
  $('#app')?.classList.add('hidden');
};
renderApp = function renderStaticApp(){
  $('#loginScreen')?.classList.add('hidden');
  $('#app')?.classList.remove('hidden');
  originalRenderApp();
};
login = function demoLogin(){
  const username = $('#username')?.value.trim();
  const password = $('#password')?.value;

  if(!username || !password) return alert('Enter a username and password.');
  if(username !== 'Ethan1998' || password !== 'Luna2020') return alert('Use the demo login: Ethan1998 / Luna2020.');

  state.user = { username };
  state.activePage = 'dashboard';
  save();
  render();
};
function logout(){
  state.user = null;
  save();
  render();
}
window.login = login;
window.logout = logout;
render();
