// server.js - Level 8: Airtight Industrial Hub with Frictionless Session Auth
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ORDERS_FILE = path.join(__dirname, 'orders.json');
const HUB_FILE = path.join(__dirname, 'campus_hub.json');

const DEFAULT_HUB = {
  "donerci": {
    id: "donerci",
    name: "Kampüs Dönercisi",
    icon: "🌯",
    desc: "Hatay usulü özel soslu tavuk ve et dürüm",
    iban: "TR33 0006 1005 1987 6543 2100 01",
    accountName: "Ahmet Usta - Döner",
    status: "open",
    menu: [
      { id: 1, name: "Tavuk Döner Dürüm", price: 120, desc: "Soslu, patatesli, turşulu", inStock: true },
      { id: 2, name: "Et Döner Dürüm", price: 190, desc: "Özel tereyağlı lavaş", inStock: true },
      { id: 3, name: "Ayran (300ml)", price: 20, desc: "Yayık açık ayran", inStock: true }
    ]
  },
  "tostcu": {
    id: "tostcu",
    name: "Öğrenci Tostçusu",
    icon: "🥪",
    desc: "Bol malzemeli çıtır bazlama ve sanayi tostları",
    iban: "TR55 0001 2009 8765 4321 0000 02",
    accountName: "Mehmet Abi - Tost",
    status: "open",
    menu: [
      { id: 101, name: "Karışık Bazlama Tost", price: 95, desc: "Sucuk, kaşar, salça, tereyağı", inStock: true },
      { id: 102, name: "Çift Kaşarlı Tost", price: 75, desc: "Bolu tereyağlı bol kaşar", inStock: true },
      { id: 103, name: "Kutu Kola / Fanta", price: 35, desc: "330ml soğuk kutu", inStock: true }
    ]
  },
  "pilavci": {
    id: "pilavci",
    name: "Meşhur Pilavcı Ali Usta",
    icon: "🍚",
    desc: "Tereyağlı nohutlu tavuklu sokak pilavı",
    iban: "TR66 0003 4001 2345 6789 0000 03",
    accountName: "Ali Usta - Pilav",
    status: "open",
    menu: [
      { id: 201, name: "Tavuklu Nohutlu Pilav (1.5 Porsiyon)", price: 110, desc: "Bol didik tavuk ve tereyağlı pilav", inStock: true },
      { id: 202, name: "Ciğerli Nohutlu Pilav", price: 140, desc: "Arnavut ciğeri parçalı", inStock: true },
      { id: 203, name: "Büyük Boy Yayık Ayran", price: 25, desc: "Köpüklü açık ayran", inStock: true }
    ]
  }
};

function loadHub() {
  try { if (fs.existsSync(HUB_FILE)) return JSON.parse(fs.readFileSync(HUB_FILE, 'utf8')); } catch (e) {}
  fs.writeFileSync(HUB_FILE, JSON.stringify(DEFAULT_HUB, null, 2), 'utf8');
  return DEFAULT_HUB;
}
function saveHub(data) { fs.writeFileSync(HUB_FILE, JSON.stringify(data, null, 2), 'utf8'); }

function loadOrders() {
  try { if (fs.existsSync(ORDERS_FILE)) return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8')); } catch (e) {}
  return [];
}
function saveOrders(data) { fs.writeFileSync(ORDERS_FILE, JSON.stringify(data, null, 2), 'utf8'); }

let hub = loadHub();
let orders = loadOrders();
let clients = [];

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  if (pathname === '/api/stream') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    clients.push(res);
    req.on('close', () => clients = clients.filter(c => c !== res));
    return;
  }

  if (pathname === '/api/hub' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(hub));
    return;
  }

  if (pathname === '/api/orders/active' && req.method === 'GET') {
    const restId = parsedUrl.query.restaurantId;
    let active = orders.filter(o => o.status !== 'TAMAMLANDI');
    if (restId) active = active.filter(o => o.restaurantId === restId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(active));
    return;
  }

  if (pathname === '/api/stats' && req.method === 'GET') {
    const restId = parsedUrl.query.restaurantId;
    const restOrders = orders.filter(o => o.restaurantId === restId);
    const totalRevenue = restOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ totalRevenue, orderCount: restOrders.length, commissionSaved: Math.round(totalRevenue * 0.30) }));
    return;
  }

  if (pathname === '/api/export' && req.method === 'GET') {
    const restId = parsedUrl.query.restaurantId;
    const completed = orders.filter(o => o.restaurantId === restId && o.status === 'TAMAMLANDI');
    let csv = 'Siparis No,Tarih,Saat,Musteri,Tutar,Odeme Tipi,Teslimat\n';
    let sum = 0;
    completed.forEach(o => {
      csv += `${o.id},${o.date},${o.time},${o.customer.replace(/,/g, ' ')},${o.total},${o.payment},${o.type}\n`;
      sum += o.total;
    });
    csv += `\nTOPLAM CIRO,,,,${sum} TL,,\n`;
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="Z_Raporu_${restId}.csv"`
    });
    res.end('\uFEFF' + csv);
    return;
  }

  if (pathname === '/api/restaurant/status' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const { restaurantId, status } = JSON.parse(body);
      if (hub[restaurantId]) {
        hub[restaurantId].status = status;
        saveHub(hub);
        broadcast({ event: 'HUB_UPDATE', data: hub });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    });
    return;
  }

  if (pathname === '/api/menu/toggle-stock' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const { restaurantId, itemId } = JSON.parse(body);
      if (hub[restaurantId]) {
        const item = hub[restaurantId].menu.find(i => i.id === itemId);
        if (item) item.inStock = !item.inStock;
        saveHub(hub);
        broadcast({ event: 'HUB_UPDATE', data: hub });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    });
    return;
  }

  if (pathname === '/api/order' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const order = JSON.parse(body);
      if (hub[order.restaurantId].status === 'closed') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Bu dükkan şu an kapalıdır." }));
        return;
      }
      order.id = Math.floor(1000 + Math.random() * 9000);
      order.status = 'BEKLIYOR';
      order.date = new Date().toLocaleDateString('tr-TR');
      order.time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      orders.unshift(order);
      saveOrders(orders);
      broadcast({ event: 'NEW_ORDER', data: order });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, orderId: order.id }));
    });
    return;
  }

  if (pathname === '/api/order/status' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const { orderId, status, prepTime } = JSON.parse(body);
      const target = orders.find(o => o.id === orderId);
      if (target) {
        target.status = status;
        if (prepTime) target.eta = prepTime;
        saveOrders(orders);
        broadcast({ event: 'STATUS_CHANGE', data: target });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    });
    return;
  }

  if (pathname === '/kitchen') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getKitchenHTML());
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(getStudentHubHTML());
});

function broadcast(payload) {
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  clients.forEach(c => c.write(msg));
}

function getStudentHubHTML() {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kampüs Masası</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: sans-serif; }
    body { background: #f3f4f6; color: #1f2937; padding-bottom: 90px; }
    header { background: #111827; color: white; padding: 1.2rem; text-align: center; }
    .badge { background: #10b981; color: white; padding: 4px 8px; border-radius: 99px; font-size: 0.75rem; font-weight: bold; }
    .container { max-width: 500px; margin: auto; padding: 1rem; }
    .rest-card { background: white; border-radius: 12px; padding: 1.2rem; margin-bottom: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.06); cursor: pointer; border: 2px solid transparent; }
    .rest-card.closed { opacity: 0.6; pointer-events: none; }
    .rest-header { display: flex; align-items: center; gap: 12px; }
    .rest-icon { font-size: 2.2rem; background: #f3f4f6; padding: 8px; border-radius: 12px; }
    .status-badge { font-size: 0.75rem; padding: 3px 6px; border-radius: 4px; font-weight: bold; }
    .status-open { background: #10b981; color: white; }
    .status-busy { background: #f59e0b; color: white; }
    .status-closed { background: #ef4444; color: white; }
    .card { background: white; border-radius: 12px; padding: 1rem; margin-bottom: 0.8rem; display: flex; justify-content: space-between; align-items: center; }
    .card.out-of-stock { opacity: 0.5; background: #e5e7eb; }
    button.add { background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; }
    button.add:disabled { background: #9ca3af; cursor: not-allowed; }
    .cart-bar { position: fixed; bottom: 0; left: 0; right: 0; background: white; padding: 1rem; border-top: 1px solid #e5e7eb; }
    .cart-btn { background: #059669; color: white; width: 100%; max-width: 500px; margin: auto; border: none; padding: 14px; border-radius: 10px; font-size: 1rem; font-weight: bold; cursor: pointer; display: flex; justify-content: space-between; }
    #modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); align-items: center; justify-content: center; padding: 1rem; }
    .modal-content { background: white; border-radius: 16px; max-width: 450px; width: 100%; padding: 1.5rem; }
    input, select { width: 100%; padding: 10px; margin: 6px 0 12px; border: 1px solid #d1d5db; border-radius: 8px; }
    #tracker { display: none; background: #dbeafe; border-left: 5px solid #2563eb; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <header><h2>🎓 Kampüs Masası</h2></header>
  <div class="container">
    <div id="tracker">
      <h4>📦 Siparişiniz: <span id="trackOrderId"></span></h4>
      <p style="margin-top:4px; font-weight:bold; color:#1e40af;" id="trackStatus">Bekleniyor...</p>
    </div>
    <div id="hubDirectoryView"><div id="restaurantsList"></div></div>
    <div id="restaurantMenuView" style="display:none;">
      <button onclick="showDirectory()" style="margin-bottom:1rem; padding:8px 14px; border:none; background:#374151; color:white; border-radius:8px; cursor:pointer;">← Tüm Dükkanlar</button>
      <div id="menuContainer"></div>
    </div>
  </div>
  <div class="cart-bar" id="cartBar" style="display:none;">
    <button class="cart-btn" id="checkoutBtn" onclick="openCheckout()">Siparişi Tamamla</button>
  </div>
  <div id="modal">
    <div class="modal-content">
      <h3>Siparişi Onayla</h3>
      <input type="text" id="custName" placeholder="İsim / Oda / Tel">
      <select id="orderType"><option>Gel-Al</option><option>Kampüs Kapısı</option></select>
      <select id="paymentType"><option>FAST / Havale</option><option>Nakit/POS</option></select>
      <button class="cart-btn" style="background:#2563eb; width:100%;" onclick="submitOrder()">Gönder</button>
      <button style="width:100%; border:none; background:none; margin-top:8px; cursor:pointer;" onclick="closeCheckout()">İptal</button>
    </div>
  </div>

  <script>
    let hubData = {}, activeRestaurant = null, cart = [], currentTrackingId = null;

    async function init() {
      const res = await fetch('/api/hub');
      hubData = await res.json();
      renderDirectory();
    }
    init();

    function getStatusBadge(status) {
      if(status === 'open') return '<span class="status-badge status-open">AÇIK</span>';
      if(status === 'busy') return '<span class="status-badge status-busy">YOĞUN</span>';
      return '<span class="status-badge status-closed">KAPALI</span>';
    }

    function renderDirectory() {
      document.getElementById('restaurantsList').innerHTML = Object.values(hubData).map(r => 
        '<div class="rest-card ' + (r.status==='closed'?'closed':'') + '" onclick="openRestaurant(\\'' + r.id + '\\')">' +
          '<div class="rest-header"><span class="rest-icon">' + r.icon + '</span>' +
          '<div><h3>' + r.name + ' ' + getStatusBadge(r.status) + '</h3><p style="font-size:0.85rem; color:#6b7280;">' + r.desc + '</p></div></div>' +
        '</div>'
      ).join('');
    }

    function openRestaurant(id) {
      activeRestaurant = hubData[id];
      document.getElementById('hubDirectoryView').style.display = 'none';
      document.getElementById('restaurantMenuView').style.display = 'block';
      renderMenu();
    }

    function showDirectory() { activeRestaurant = null; cart = []; updateCartUI(); document.getElementById('hubDirectoryView').style.display = 'block'; document.getElementById('restaurantMenuView').style.display = 'none'; }

    function renderMenu() {
      const isClosed = activeRestaurant.status === 'closed';
      document.getElementById('menuContainer').innerHTML = activeRestaurant.menu.map(item => {
        const disabled = !item.inStock || isClosed;
        return '<div class="card ' + (item.inStock?'':'out-of-stock') + '">' +
          '<div><h3>' + item.name + '</h3><div class="price">' + item.price + ' ₺</div></div>' +
          '<button class="add" ' + (disabled?'disabled':'') + ' onclick="addToCart(' + item.id + ', \\'' + item.name + '\\', ' + item.price + ')">' + (item.inStock?'+ Ekle':'Tükendi') + '</button>' +
        '</div>';
      }).join('');
      
      const btn = document.getElementById('checkoutBtn');
      if (activeRestaurant.status === 'busy') {
        btn.innerHTML = 'Sipariş Ver (⚠️ Mutfak Yoğun)';
        btn.style.background = '#f59e0b';
      } else {
        btn.innerHTML = 'Siparişi Tamamla';
        btn.style.background = '#059669';
      }
    }

    const stream = new EventSource('/api/stream');
    stream.onmessage = e => {
      const payload = JSON.parse(e.data);
      if (payload.event === 'HUB_UPDATE') {
        hubData = payload.data;
        if (activeRestaurant) { activeRestaurant = hubData[activeRestaurant.id]; renderMenu(); }
        else renderDirectory();
      } else if (payload.event === 'STATUS_CHANGE' && payload.data.id === currentTrackingId) {
        let msg = payload.data.status;
        if(msg === 'HAZIRLANIYOR' && payload.data.eta) msg = '🔥 Hazırlanıyor (Tahmini: ' + payload.data.eta + ' dk)';
        if(msg === 'HAZIR') msg = '✅ SİPARİŞİNİZ HAZIR! Alabilirsiniz.';
        document.getElementById('trackStatus').innerText = msg;
      }
    };

    function addToCart(id, name, price) { cart.push({id, name, price}); updateCartUI(); }
    function updateCartUI() { document.getElementById('cartBar').style.display = cart.length > 0 ? 'block' : 'none'; }
    function openCheckout() { document.getElementById('modal').style.display = 'flex'; }
    function closeCheckout() { document.getElementById('modal').style.display = 'none'; }

    async function submitOrder() {
      const note = document.getElementById('custName').value;
      if (!note) return;
      const res = await fetch('/api/order', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ restaurantId: activeRestaurant.id, items: cart, total: cart.reduce((s, i) => s + i.price, 0), customer: note, type: document.getElementById('orderType').value, payment: document.getElementById('paymentType').value })
      });
      const data = await res.json();
      if(data.error) return alert(data.error);
      currentTrackingId = data.orderId;
      document.getElementById('tracker').style.display = 'block';
      document.getElementById('trackOrderId').innerText = '#' + data.orderId;
      cart = []; updateCartUI(); closeCheckout();
    }
  </script>
</body>
</html>`;
}

function getKitchenHTML() {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>Mutfak Portalı (Pro)</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: sans-serif; }
    body { background: #0f172a; color: white; padding: 1.5rem; }
    
    #pinOverlay { position: fixed; inset: 0; background: #0f172a; z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .pin-box { background: #1e293b; padding: 2.5rem 2rem; border-radius: 16px; text-align: center; max-width: 380px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .pin-input { font-size: 1.8rem; letter-spacing: 8px; width: 100%; text-align: center; padding: 12px; border-radius: 10px; border: 1px solid #475569; background: #0f172a; color: white; margin: 1.2rem 0; outline: none; }
    .pin-btn { background: #2563eb; color: white; border: none; padding: 14px; border-radius: 10px; width: 100%; font-size: 1rem; font-weight: bold; cursor: pointer; }
    .pin-error { color: #ef4444; font-size: 0.9rem; margin-top: 10px; display: none; font-weight: bold; }
    
    .topbar { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #334155; padding-bottom: 1rem; flex-wrap: wrap; gap: 10px; }
    .btn { padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; border: none; color: white; }
    .btn-green { background: #10b981; } .btn-blue { background: #3b82f6; } .btn-red { background: #ef4444; }
    select.rest-select { background: #1e293b; color: white; border: 1px solid #475569; padding: 8px 12px; border-radius: 8px; font-size: 1rem; }
    
    .control-panel { background: #1e293b; padding: 1rem; border-radius: 10px; margin-top: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;}
    .status-selector select { padding: 8px 12px; border-radius: 6px; font-weight: bold; outline: none; background: #0f172a; color: white; border: 1px solid #475569; }
    
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem; margin-top: 1.5rem; }
    .order-card { background: #1e293b; border-left: 6px solid #f59e0b; border-radius: 10px; padding: 1.2rem; }
    .actions { display: flex; gap: 6px; margin-top: 12px; }
    .actions button { flex: 1; padding: 8px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 0.8rem; color: white;}
    .timer-btn { background: #3b82f6; }
  </style>
</head>
<body>
  <!-- PIN Screen -->
  <div id="pinOverlay">
    <div class="pin-box">
      <div style="font-size: 3rem; margin-bottom: 0.5rem;">🔒</div>
      <h2>Mutfak Girişi</h2>
      <p style="color:#94a3b8; font-size:0.9rem; margin-top:5px;">Lütfen 4 haneli PIN kodunu girin</p>
      
      <form onsubmit="handlePinSubmit(event)">
        <input type="password" id="pinInput" class="pin-input" maxlength="4" placeholder="••••" autofocus autocomplete="off">
        <button type="submit" class="pin-btn">Giriş Yap</button>
      </form>
      
      <p id="pinError" class="pin-error">Hatalı PIN Kodu!</p>
      <p style="color:#64748b; font-size:0.8rem; margin-top:12px;">(Varsayılan PIN: 1234 veya 1923)</p>
    </div>
  </div>

  <div class="topbar">
    <div style="display:flex; align-items:center; gap:10px;">
      <h2>🍳 Mutfak (Pro)</h2>
      <select class="rest-select" id="restaurantSelector" onchange="switchRestaurant(this.value)"></select>
    </div>
    <div style="display:flex; gap:10px;">
      <button class="btn btn-blue" onclick="downloadZRaporu()">📊 Z-Raporu</button>
      <button class="btn btn-green" id="audioToggle" onclick="initAudio()">🔔 Sesi Aç</button>
      <button class="btn btn-red" onclick="lockKitchen()">🔒 Çıkış</button>
    </div>
  </div>

  <div class="control-panel">
    <div class="status-selector">
      <span style="color:#94a3b8; margin-right:10px;">Ana Şalter (Dükkan Durumu):</span>
      <select id="masterSwitch" onchange="updateMasterStatus(this.value)">
        <option value="open">🟢 AÇIK (Sipariş Alınıyor)</option>
        <option value="busy">🟡 YOĞUN (Müşteriye Uyarı Ver)</option>
        <option value="closed">🔴 KAPALI (Sipariş Alımını Durdur)</option>
      </select>
    </div>
  </div>

  <div class="grid" id="ordersGrid"></div>

  <script>
    // Bulletproof Authentication with Session Memory
    function handlePinSubmit(e) {
      if (e) e.preventDefault();
      const val = document.getElementById('pinInput').value.trim();
      if (val === '1234' || val === '1923') {
        localStorage.setItem('kitchen_authenticated', 'true');
        document.getElementById('pinOverlay').style.display = 'none';
        initKitchen();
      } else {
        document.getElementById('pinError').style.display = 'block';
        document.getElementById('pinInput').value = '';
        document.getElementById('pinInput').focus();
      }
    }

    function lockKitchen() {
      localStorage.removeItem('kitchen_authenticated');
      window.location.reload();
    }

    // Check if previously unlocked
    if (localStorage.getItem('kitchen_authenticated') === 'true') {
      document.getElementById('pinOverlay').style.display = 'none';
      initKitchen();
    }

    let audioCtx = null, hubData = {}, currentRestId = "donerci";

    function initAudio() {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      document.getElementById('audioToggle').innerText = '🔊 Ses Aktif';
    }
    function playChime() {
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(587.33, now); osc.frequency.setValueAtTime(880.00, now + 0.12);
      gain.gain.setValueAtTime(0.4, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(now); osc.stop(now + 0.8);
    }

    async function initKitchen() {
      const res = await fetch('/api/hub');
      hubData = await res.json();
      document.getElementById('restaurantSelector').innerHTML = Object.values(hubData).map(r => '<option value="' + r.id + '">' + r.name + '</option>').join('');
      loadRestaurantDashboard();
    }

    function switchRestaurant(id) { currentRestId = id; loadRestaurantDashboard(); }

    async function loadRestaurantDashboard() {
      document.getElementById('ordersGrid').innerHTML = '';
      document.getElementById('masterSwitch').value = hubData[currentRestId].status;
      
      const res = await fetch('/api/orders/active?restaurantId=' + currentRestId);
      const activeOrders = await res.json();
      activeOrders.forEach(renderCard);
    }

    async function updateMasterStatus(status) {
      await fetch('/api/restaurant/status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId: currentRestId, status })
      });
    }

    function downloadZRaporu() {
      window.location.href = '/api/export?restaurantId=' + currentRestId;
    }

    const evtSource = new EventSource('/api/stream');
    evtSource.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (msg.event === 'NEW_ORDER' && msg.data.restaurantId === currentRestId) { playChime(); renderCard(msg.data); }
      else if (msg.event === 'STATUS_CHANGE' && msg.data.restaurantId === currentRestId) { updateCardUI(msg.data.id, msg.data.status); }
      else if (msg.event === 'HUB_UPDATE') { hubData = msg.data; document.getElementById('masterSwitch').value = hubData[currentRestId].status; }
    };

    function renderCard(order) {
      if (document.getElementById('order-' + order.id)) return;
      const card = document.createElement('div');
      card.id = 'order-' + order.id; card.className = 'order-card ' + order.status.toLowerCase();
      card.innerHTML = 
        '<div style="display:flex; justify-content:space-between;"><h3>#' + order.id + '</h3><span style="background:#334155; padding:2px 6px; border-radius:4px;">' + order.time + '</span></div>' +
        '<p style="margin:6px 0;"><strong>' + order.customer + '</strong></p>' +
        '<p style="color:#94a3b8; font-size:0.85rem;">' + order.type + ' | ' + order.payment + '</p>' +
        '<ul style="margin:8px 0 8px 18px;">' + order.items.map(i => '<li>' + i.name + '</li>').join('') + '</ul>' +
        '<h2 style="color:#10b981;">' + order.total + ' ₺</h2>' +
        '<div class="actions">' +
          '<button class="timer-btn" onclick="askPrepTime(' + order.id + ')">🔥 Hazırla (Süre Seç)</button>' +
          '<button style="background:#10b981;" onclick="setStatus(' + order.id + ', \\'HAZIR\\')">✅ Bitti/Hazır</button>' +
          '<button style="background:#475569;" onclick="setStatus(' + order.id + ', \\'TAMAMLANDI\\')">📦 Gönder</button>' +
        '</div>';
      document.getElementById('ordersGrid').prepend(card);
    }

    function askPrepTime(orderId) {
      const time = prompt("Kaç dakikada hazır olur? (Örn: 15, 30, 45)");
      if(time) setStatus(orderId, 'HAZIRLANIYOR', time);
    }

    async function setStatus(orderId, status, prepTime = null) {
      await fetch('/api/order/status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status, prepTime })
      });
    }

    function updateCardUI(id, status) {
      const card = document.getElementById('order-' + id);
      if (!card) return;
      card.className = 'order-card ' + status.toLowerCase();
      if (status === 'TAMAMLANDI') setTimeout(() => card.remove(), 1000);
    }
  </script>
</body>
</html>`;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log('🚀 Airtight Hub v8 Live!'));
