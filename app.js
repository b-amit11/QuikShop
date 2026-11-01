const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
const DEFAULT_NAME = "Quik Shop";
const DEFAULT_ADDR = "21265 Great Mills Rd, Lexington Park, MD 20653";
const CATS = ["Fuel","Drinks","Snacks","Hot food","Essentials","Auto"];
const SAMPLE_ITEMS = [
  ["Regular 87","Fuel",3.29],["Plus 89","Fuel",3.59],["Premium 93","Fuel",3.89],["Diesel","Fuel",3.79],
  ["Fresh brewed coffee","Hot food",1.99],["Roller grill hot dog","Hot food",2.49],["Pizza slice","Hot food",3.29],
  ["Bottled water 1L","Drinks",1.79],["Energy drink 16oz","Drinks",3.49],["Soda 20oz","Drinks",2.29],["Bag of ice","Drinks",2.99],
  ["Potato chips","Snacks",2.19],["Beef jerky","Snacks",6.99],["Chocolate bar","Snacks",1.59],
  ["Phone charger (USB-C)","Essentials",12.99],["Pain reliever 24ct","Essentials",5.49],
  ["Motor oil 5W-30 (1qt)","Auto",8.99],["Windshield washer fluid","Auto",4.49],["Car wash token","Auto",9.00]
];

const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const money = n => (typeof n === "number" && isFinite(n)) ? "$" + n.toFixed(2) : "";
const STATUS_LABEL = { in: "In stock", low: "Low", out: "Out" };
const timeStr = t => { if (!t) return ""; const d = new Date(t); const now = new Date();
  const same = d.toDateString() === now.toDateString();
  return (same ? "" : d.toLocaleDateString([], {month:"short",day:"numeric"}) + " ") + d.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"}); };
function toast(msg){ const t=$("toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove("show"),2800); }
function notice(msg){ $("globalNotice").textContent = msg || ""; }
const store = {
  get(k){ try { return localStorage.getItem(k); } catch(e) { return null; } },
  set(k,v){ try { localStorage.setItem(k, v); } catch(e) {} }
};

const state = { items: [], station: null, cat: "All", q: "", custMsgs: [], threads: [], selThread: null, deskMsgs: [], view: "stock" };
let F = null, db = null, auth = null, me = null, isCashier = false, connected = false, failed = false;
let userUnsubs = [];

/* ---------- Routing ---------- */
function route(){
  let v = (location.hash || "#stock").slice(1);
  if (!["stock","chat","desk"].includes(v)) v = "stock";
  document.querySelectorAll(".view").forEach(s => s.classList.toggle("active", s.id === "view-" + v));
  document.querySelectorAll("nav a").forEach(a => a.classList.toggle("active", a.dataset.view === v));
  state.view = v;
  if (v === "chat") { markCustSeen(); scrollBottom($("custMsgs")); }
}
window.addEventListener("hashchange", route);

/* ---------- Station ---------- */
function renderStation(){
  const s = state.station || {};
  const name = s.name || DEFAULT_NAME;
  $("stationName").textContent = name;
  document.title = name + " — Fuel Prices, Stock & Chat";
  $("stationHours").textContent = s.hours || "Gas & convenience store";
  const addr = s.address || DEFAULT_ADDR;
  $("stationAddr").textContent = addr;
  $("footAddr").textContent = addr;
  $("stationAddr").href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(addr);
  const b = $("openBadge"); const open = s.open !== false;
  b.className = "open-badge " + (open ? "open" : "closed");
  b.querySelector("span").textContent = open ? "Open now" : "Closed";
  if (isCashier) {
    if (document.activeElement !== $("setName")) $("setName").value = s.name || DEFAULT_NAME;
    if (document.activeElement !== $("setHours")) $("setHours").value = s.hours || "";
    if (document.activeElement !== $("setAddr")) $("setAddr").value = s.address || DEFAULT_ADDR;
    $("setOpen").checked = open;
  }
}

/* ---------- Stock ---------- */
function renderChips(){
  const c = $("chips"); c.textContent = "";
  ["All", ...CATS.filter(x => x !== "Fuel")].forEach(name => {
    const b = el("button", "chip" + (state.cat === name ? " on" : ""), name);
    b.type = "button"; b.onclick = () => { state.cat = name; renderChips(); renderStore(); };
    c.appendChild(b);
  });
}
function renderFuel(){
  const f = $("fuelBoard"); f.textContent = "";
  const order = ["Regular","Plus","Premium","Diesel"];
  const rank = n => { const i = order.findIndex(o => (n||"").startsWith(o)); return i < 0 ? 99 : i; };
  const fuels = state.items.filter(i => i.category === "Fuel").sort((a,b) => rank(a.name) - rank(b.name) || (a.name||"").localeCompare(b.name||""));
  if (!fuels.length) { f.appendChild(el("div","empty", failed ? "Fuel prices are unavailable right now." : connected ? "No fuel grades listed yet." : "Loading fuel prices…")); return; }
  fuels.forEach(i => {
    const p = el("div", "pump" + (i.status === "out" ? " out" : ""));
    p.appendChild(el("div","grade", i.name));
    const pr = el("div","price", money(i.price) || "—"); pr.appendChild(el("small",null,"/gal")); p.appendChild(pr);
    p.appendChild(el("span","pill " + (i.status||"in"), STATUS_LABEL[i.status] || "In stock"));
    f.appendChild(p);
  });
}
function renderStore(){
  const g = $("storeGrid"); g.textContent = "";
  const q = state.q.trim().toLowerCase();
  const list = state.items.filter(i => i.category !== "Fuel")
    .filter(i => state.cat === "All" || i.category === state.cat)
    .filter(i => !q || (i.name||"").toLowerCase().includes(q) || (i.category||"").toLowerCase().includes(q))
    .sort((a,b) => (a.status === "out") - (b.status === "out") || (a.name||"").localeCompare(b.name||""));
  if (!list.length) g.appendChild(el("div","empty",
    failed ? "Store stock is unavailable right now." :
    !connected ? "Loading the store shelves…" :
    (q || state.cat !== "All") ? "Nothing matches that. Try asking the cashier!" : "No items listed yet."));
  list.forEach(i => {
    const c = el("div", "card" + (i.status === "out" ? " out" : ""));
    const r1 = el("div","row"); r1.appendChild(el("div","name", i.name)); r1.appendChild(el("div","p", money(i.price)));
    const r2 = el("div","row"); r2.appendChild(el("div","cat", i.category)); r2.appendChild(el("span","pill " + (i.status||"in"), STATUS_LABEL[i.status] || "In stock"));
    c.append(r1, r2); g.appendChild(c);
  });
  const latest = Math.max(0, ...state.items.map(i => i.updatedAt || 0));
  $("updatedAt").textContent = latest ? "Stock last updated " + timeStr(latest) : "";
}
$("search").addEventListener("input", e => { state.q = e.target.value; renderStore(); });

/* ---------- Messages ---------- */
function scrollBottom(box){ requestAnimationFrame(() => box.scrollTop = box.scrollHeight); }
function renderMsgs(box, msgs, mineSide, emptyText){
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
  box.textContent = "";
  if (!msgs.length) { box.appendChild(el("div","empty", emptyText)); return; }
  msgs.forEach(m => {
    const b = el("div", "msg " + (m.from === mineSide ? "mine" : "theirs"), m.text);
    b.appendChild(el("span","meta", (m.from === "cashier" ? "Cashier" : "Customer") + " · " + timeStr(m.at)));
    box.appendChild(b);
  });
  if (atBottom || msgs[msgs.length-1]?.by === me) scrollBottom(box);
}
let custSeen = +store.get("qs_seen") || 0;
function markCustSeen(){
  const last = state.custMsgs[state.custMsgs.length-1];
  if (last) { custSeen = last.at; store.set("qs_seen", String(custSeen)); }
  $("chatDot").classList.remove("on");
}
function renderCustChat(){
  renderMsgs($("custMsgs"), state.custMsgs, "customer", "No messages yet. Say hi — the cashier will reply here.");
  const lastCashier = [...state.custMsgs].reverse().find(m => m.from === "cashier");
  if (state.view === "chat") markCustSeen();
  else $("chatDot").classList.toggle("on", !!lastCashier && lastCashier.at > custSeen);
}
$("custName").value = store.get("qs_name") || "";
$("custName").addEventListener("change", () => store.set("qs_name", $("custName").value.trim()));

/* ---------- Writes (one at a time per document) ---------- */
const queues = {};
function ref(path){ return F.doc(db, ...path.split("/")); }
function write(path, op, data){
  if (!db) return Promise.resolve();
  const run = async () => {
    try {
      const r = ref(path);
      if (op === "delete") await F.deleteDoc(r);
      else if (op === "update") await F.updateDoc(r, data);
      else await F.setDoc(r, data, { merge: op === "merge" });
    } catch (err) { handleWriteError(err); throw err; }
  };
  queues[path] = (queues[path] || Promise.resolve()).catch(() => {}).then(run);
  return queues[path];
}
function handleWriteError(err){
  console.warn(err);
  const code = err && err.code;
  if (code === "permission-denied") toast("You don't have permission to do that.");
  else if (code === "unavailable") toast("You're offline — it'll save when you reconnect.");
  else toast("Couldn't save — please try again.");
}

/* ---------- Desk: inventory ---------- */
function renderInventory(){
  const box = $("invList"); box.textContent = "";
  $("seedBtn").hidden = state.items.length > 0;
  if (!state.items.length) box.appendChild(el("div","empty","No items yet. Add them below, or load a starter list."));
  const sorted = [...state.items].sort((a,b) => CATS.indexOf(a.category) - CATS.indexOf(b.category) || (a.name||"").localeCompare(b.name||""));
  sorted.forEach(i => {
    const row = el("div","invrow");
    const info = el("div"); info.appendChild(el("div","n", i.name)); info.appendChild(el("div","c", i.category)); row.appendChild(info);
    const seg = el("div","seg");
    ["in","low","out"].forEach(s => {
      const b = el("button", s + (i.status === s ? " on" : ""), STATUS_LABEL[s]); b.type = "button";
      b.onclick = () => { if (i.status !== s) write(`items/${i.id}`, "update", { status: s, updatedAt: Date.now() }); };
      seg.appendChild(b);
    });
    row.appendChild(seg);
    const pi = el("input","priceinput"); pi.type = "number"; pi.step = "0.01"; pi.min = "0";
    pi.value = typeof i.price === "number" ? i.price.toFixed(2) : "";
    pi.setAttribute("aria-label","Price of " + i.name);
    pi.addEventListener("change", () => { const v = parseFloat(pi.value); if (isFinite(v) && v !== i.price) write(`items/${i.id}`, "update", { price: Math.round(v*100)/100, updatedAt: Date.now() }); });
    row.appendChild(pi);
    const del = el("button","btn danger","Remove"); del.type = "button";
    del.onclick = () => {
      if (!del.classList.contains("confirm")) { del.classList.add("confirm"); del.textContent = "Sure?"; setTimeout(() => { del.classList.remove("confirm"); del.textContent = "Remove"; }, 3000); return; }
      write(`items/${i.id}`, "delete");
    };
    row.appendChild(del);
    box.appendChild(row);
  });
}
CATS.forEach(c => { const o = el("option", null, c); o.value = c; $("addCat").appendChild(o); });
$("addCat").value = "Snacks";
$("addForm").addEventListener("submit", async e => {
  e.preventDefault();
  const name = $("addName").value.trim(); if (!name || !db) return;
  const price = parseFloat($("addPrice").value);
  try {
    await F.addDoc(F.collection(db, "items"), { name, category: $("addCat").value, price: isFinite(price) ? Math.round(price*100)/100 : null, status: "in", updatedAt: Date.now() });
    $("addName").value = ""; $("addPrice").value = ""; toast("Added " + name);
  } catch (err) { handleWriteError(err); }
});
$("seedBtn").addEventListener("click", async () => {
  $("seedBtn").disabled = true;
  try {
    const batch = F.writeBatch(db); const now = Date.now();
    SAMPLE_ITEMS.forEach(([name, category, price]) => batch.set(F.doc(F.collection(db, "items")), { name, category, price, status: "in", updatedAt: now }));
    if (!state.station) batch.set(ref("station/info"), { name: DEFAULT_NAME, address: DEFAULT_ADDR, hours: "", open: true });
    await batch.commit(); toast("Starter items loaded — edit prices to match the store.");
  } catch (err) { handleWriteError(err); }
  $("seedBtn").disabled = false;
});

/* ---------- Desk: station settings ---------- */
function saveStation(){
  if (!db) return;
  const s = { name: $("setName").value.trim() || DEFAULT_NAME, hours: $("setHours").value.trim(), address: $("setAddr").value.trim() || DEFAULT_ADDR, open: $("setOpen").checked };
  const cur = state.station || {};
  if (s.name === cur.name && s.hours === (cur.hours||"") && s.address === cur.address && s.open === (cur.open !== false)) return;
  write("station/info", "set", s);
}
["setName","setHours","setAddr","setOpen"].forEach(id => $(id).addEventListener("change", saveStation));

/* ---------- Desk: conversations ---------- */
const nameOf = t => (t && t.name) || "Customer " + String(t ? t.id : "").slice(-4).toUpperCase();
function renderThreads(){
  const box = $("threadList"); box.textContent = "";
  if (!state.threads.length) box.appendChild(el("div","empty","No customer messages yet."));
  state.threads.forEach(t => {
    const b = el("button","thread" + (state.selThread === t.id ? " sel" : "")); b.type = "button";
    const l = el("div"); l.style.minWidth = "0";
    l.appendChild(el("div","who", nameOf(t)));
    l.appendChild(el("div","last", (t.lastFrom === "cashier" ? "You: " : "") + (t.lastText || "")));
    b.appendChild(l);
    const r = el("div","tmeta");
    r.appendChild(el("span", null, timeStr(t.lastAt)));
    if (t.unread) r.appendChild(el("span","u"));
    b.appendChild(r);
    b.onclick = () => openThread(t.id);
    box.appendChild(b);
  });
  $("deskDot").classList.toggle("on", state.threads.some(t => t.unread));
  if (state.selThread) $("deskWho").textContent = nameOf(state.threads.find(t => t.id === state.selThread) || { id: state.selThread });
}
let deskUnsub = null;
function closeThread(){
  if (deskUnsub) { deskUnsub(); deskUnsub = null; }
  state.selThread = null; state.deskMsgs = [];
  $("deskWho").textContent = "Pick a conversation"; $("deskSub").textContent = "";
  $("deskInput").disabled = true; $("deskSend").disabled = true;
  $("deskMsgs").textContent = "";
}
function openThread(id){
  if (state.selThread === id) return;
  closeThread();
  state.selThread = id;
  $("deskSub").textContent = "Replies go straight to this customer";
  $("deskInput").disabled = false; $("deskSend").disabled = false;
  renderMsgs($("deskMsgs"), [], "cashier", "Loading…");
  const q = F.query(F.collection(db, "chats", id, "msgs"), F.orderBy("at"), F.limitToLast(300));
  deskUnsub = F.onSnapshot(q, snap => {
    state.deskMsgs = snap.docs.map(d => d.data());
    renderMsgs($("deskMsgs"), state.deskMsgs, "cashier", "No messages in this conversation.");
    scrollBottom($("deskMsgs"));
  }, err => console.warn(err));
  const t = state.threads.find(x => x.id === id);
  if (t && t.unread) write(`chats/${id}`, "update", { unread: false }).catch(() => {});
  renderThreads();
}

/* ---------- Sending ---------- */
async function sendMsg(threadId, from, text){
  const at = Date.now();
  await F.addDoc(F.collection(db, "chats", threadId, "msgs"), { from, text, at, by: me });
  const meta = { lastAt: at, lastText: text.slice(0, 120), lastFrom: from, unread: from === "customer" };
  if (from === "customer") {
    const name = $("custName").value.trim().slice(0, 40);
    await write(`chats/${threadId}`, "merge", { ...meta, name });
  } else {
    await write(`chats/${threadId}`, "update", meta);
  }
}
$("custForm").addEventListener("submit", async e => {
  e.preventDefault();
  const text = $("custInput").value.trim(); if (!text || !db || !me) return;
  $("custInput").value = ""; $("custSend").disabled = true;
  try { await sendMsg(me, "customer", text); } catch (err) { $("custInput").value = text; handleWriteError(err); }
  $("custSend").disabled = false; $("custInput").focus();
});
$("quick").addEventListener("click", e => { if (e.target.tagName === "BUTTON") { $("custInput").value = e.target.textContent + " "; $("custInput").focus(); } });
$("deskForm").addEventListener("submit", async e => {
  e.preventDefault();
  const text = $("deskInput").value.trim(); if (!text || !db || !state.selThread) return;
  $("deskInput").value = "";
  try { await sendMsg(state.selThread, "cashier", text); } catch (err) { $("deskInput").value = text; }
  $("deskInput").focus();
});
function setChatEnabled(on, msg){
  $("custInput").disabled = !on; $("custSend").disabled = !on;
  $("custInput").placeholder = on ? "Type a message…" : msg;
  $("quick").style.display = on ? "" : "none";
}

/* ---------- Staff sign-in ---------- */
function renderDesk(){
  $("deskLogin").hidden = isCashier;
  $("deskMain").hidden = !isCashier;
  $("deskTab").hidden = !isCashier;
  $("staffLink").hidden = isCashier;
  if (isCashier) $("staffWho").textContent = "Signed in as " + (auth.currentUser.email || "staff");
}
$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!auth) return;
  $("loginErr").textContent = ""; $("loginBtn").disabled = true;
  try {
    await F.signInWithEmailAndPassword(auth, $("loginEmail").value.trim(), $("loginPass").value);
    $("loginPass").value = "";
  } catch (err) {
    const c = err && err.code || "";
    $("loginErr").textContent = /invalid-credential|wrong-password|user-not-found|invalid-email/.test(c) ? "Wrong email or password." :
      c.includes("too-many-requests") ? "Too many tries — wait a minute and try again." : "Couldn't sign in. Check your connection and try again.";
  }
  $("loginBtn").disabled = false;
});
$("signOutBtn").addEventListener("click", () => auth && F.signOut(auth));

/* ---------- Per-user subscriptions ---------- */
function startUser(u){
  userUnsubs.forEach(f => f()); userUnsubs = [];
  closeThread(); state.custMsgs = []; state.threads = [];
  me = u.uid;
  setChatEnabled(true);
  const cq = F.query(F.collection(db, "chats", me, "msgs"), F.orderBy("at"), F.limitToLast(300));
  userUnsubs.push(F.onSnapshot(cq, snap => { state.custMsgs = snap.docs.map(d => d.data()); renderCustChat(); },
    err => { console.warn(err); setChatEnabled(false, "Chat is unavailable right now"); }));
  if (isCashier) {
    renderInventory();
    const tq = F.query(F.collection(db, "chats"), F.orderBy("lastAt","desc"), F.limit(100));
    userUnsubs.push(F.onSnapshot(tq, snap => { state.threads = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderThreads(); }, err => console.warn(err)));
  }
  renderDesk(); renderStation(); renderCustChat();
}

/* ---------- Boot ---------- */
renderChips(); renderFuel(); renderStore(); renderStation(); route(); renderDesk();
setChatEnabled(false, "Connecting…");
renderMsgs($("custMsgs"), [], "customer", "Connecting…");

(async () => {
  let config;
  try {
    ({ firebaseConfig: config } = await import("./firebase-config.js"));
    if (!config || !config.apiKey || String(config.apiKey).startsWith("YOUR_")) throw new Error("not configured");
  } catch (e) {
    failed = true;
    notice("This site isn't connected to its database yet. Add your Firebase settings to firebase-config.js (see README).");
    renderFuel(); renderStore(); setChatEnabled(false, "Chat is unavailable right now");
    renderMsgs($("custMsgs"), [], "customer", "Chat isn't available yet.");
    return;
  }
  try {
    const [app, a, fs] = await Promise.all([import(SDK + "firebase-app.js"), import(SDK + "firebase-auth.js"), import(SDK + "firebase-firestore.js")]);
    F = { ...a, ...fs };
    const fbApp = app.initializeApp(config);
    auth = a.getAuth(fbApp); db = fs.getFirestore(fbApp);
  } catch (e) {
    console.warn(e); failed = true;
    notice("Couldn't connect to the store right now. Check your connection and refresh.");
    renderFuel(); renderStore(); setChatEnabled(false, "Chat is unavailable right now");
    return;
  }

  const timer = setTimeout(() => { if (!connected) notice("Can't reach the store right now — prices may be out of date."); }, 10000);
  F.onSnapshot(ref("station/info"), s => { state.station = s.exists() ? s.data() : null; renderStation(); }, e => console.warn(e));
  F.onSnapshot(F.query(F.collection(db, "items"), F.orderBy("name"), F.limit(1000)), snap => {
    state.items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!snap.metadata.fromCache) { connected = true; clearTimeout(timer); notice(""); }
    renderFuel(); renderStore(); if (isCashier) renderInventory();
  }, err => { clearTimeout(timer); failed = true; notice("Couldn't load stock right now."); renderFuel(); renderStore(); console.warn(err); });

  let currentUid = null;
  F.onAuthStateChanged(auth, async u => {
    if (!u) {
      currentUid = null; isCashier = false; renderDesk();
      try { await F.signInAnonymously(auth); }
      catch (e) { console.warn(e); setChatEnabled(false, "Chat is unavailable right now"); }
      return;
    }
    if (u.uid === currentUid) return;
    currentUid = u.uid;
    isCashier = false;
    if (!u.isAnonymous) {
      try { isCashier = (await F.getDoc(ref("staff/" + u.uid))).exists(); } catch (e) { console.warn(e); }
      if (!isCashier) { $("loginErr").textContent = "This account isn't set up as staff yet."; F.signOut(auth); return; }
    }
    startUser(u);
    route();
  });
})();
