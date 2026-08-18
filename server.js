// server.js - Level 6: Multi-Restaurant Hub + Daily Revenue & Commission Defense Tracker
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
    menu: [
      { id: 201, name: "Tavuklu Nohutlu Pilav (1.5 Porsiyon)", price: 110, desc: "Bol didik tavuk ve tereyağlı pilav", inStock: true },
      { id: 202, name: "Ciğerli Nohutlu Pilav", price: 140, desc: "Arnavut ciğeri parçalı", inStock: true },
      { id: 203, name: "Büyük Boy Yayık Ayran", price: 25, desc: "Köpüklü açık ayran", inStock: true }
    ]
  }
};

function loadHub() {
  try {
    if (fs.existsSync(HUB_FILE)) return JSON.parse(fs.readFileSync(HUB_FILE, 'utf8'));
  } catch (err) { console.error('Error reading hub DB:', err); }
  fs.writeFileSync(HUB_FILE, JSON.stringify(DEFAULT_HUB, null, 2), 'utf8');
  return DEFAULT_HUB;
}
function saveHub(data) {
  try { fs.writeFileSync(HUB_FILE, JSON.stringify(data, null, 2), 'utf8'); }
  catch (err) { console.error('Error saving hub DB:', err); }
}

function loadOrders() {
  try {
    if (fs.existsSync(ORDERS_FILE)) return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  } catch (err) { console.error('Error reading orders:', err); }
  return [];
}
function saveOrders(data) {
  try { fs.writeFileSync(ORDERS_FILE, JSON.stringify(data, null, 2), 'utf8'); }
  catch (err) { console.error('Error saving orders:', err); }
}

let hub = loadHub();
let orders = loadOrders();
let clients = [];

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 1. SSE Stream
  if (pathname === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    clients.push(res);
    req.on('close', () => { clients = clients.filter(c => c !== res); });
    return;
  }

  // 2. API: Get Hub Info
  if (pathname === '/api/hub' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(hub));
    return;
  }

  // 3. API: Get Active Orders
  if (pathname === '/api/orders/active' && req.method === 'GET') {
    const restId = parsedUrl.query.restaurantId;
    let active = orders.filter(o => o.status !== 'TAMAMLANDI');
    if (restId) active = active.filter(o => o.restaurantId === restId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(active));
    return;
  }

  // 4. API: Get Daily Revenue Stats for Restaurant
  if (pathname === '/api/stats' && req.method === 'GET') {
    const restId = parsedUrl.query.restaurantId;
    const today = new Date().toLocaleDateString('tr-TR');
    
    // Filter orders for this restaurant placed today (or all current orders)
    const restOrders = orders.filter(o => o.restaurantId === restId);
    const totalRevenue = restOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const orderCount = restOrders.length;
    const commissionSaved = Math.round(totalRevenue * 0.30); // 30% saved from app fees

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ totalRevenue, orderCount, commissionSaved }));
    return;
  }

  // 5. API: Toggle Item Stock
  if (pathname === '/api/menu/toggle-stock' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const { restaurantId, itemId } = JSON.parse(body);
      const rest = hub[restaurantId];
      if (rest) {
        const item = rest.menu.find(i => i.id === itemId);
        if (item) {
          item.inStock = !item.inStock;
          saveHub(hub);
          broadcast({ event: 'HUB_UPDATE', data: hub });
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, hub }));
    });
    return;
  }

  // 6. API: Place Order
  if (pathname === '/api/order' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const order = JSON.parse(body);
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

  // 7. API: Update Status
  if (pathname === '/api/order/status' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const { orderId, status } = JSON.parse(body);
      const target = orders.find(o => o.id === orderId);
      if (target) {
        target.status = status;
        saveOrders(orders);
        broadcast({ event: 'STATUS_CHANGE', data: { id: orderId, status: status, restaurantId: target.restaurantId } });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    });
    return;
  }

  // 8. Kitchen Page
  if (pathname === '/kitchen') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getKitchenHTML());
    return;
  }

  // 9. Student Hub App
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
  <title>Kampüs Yemek Masası</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: sans-serif; }
    body { background: #f3f4f6; color: #1f2937; padding-bottom: 90px; }
    header { background: #111827; color: white; padding: 1.2rem; text-align: center; }
    .badge { background: #10b981; color: white; padding: 4px 8px; border-radius: 99px; font-size: 0.75rem; font-weight: bold; }
    .container { max-width: 500px; margin: auto; padding: 1rem; }
    .rest-card { background: white; border-radius: 12px; padding: 1.2rem; margin-bottom: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.06); cursor: pointer; transition: 0.2s; border: 2px solid transparent; }
    .rest-card:hover { border-color: #2563eb; transform: translateY(-2px); }
    .rest-header { display: flex; align-items: center; gap: 12px; }
    .rest-icon { font-size: 2.2rem; background: #f3f4f6; padding: 8px; border-radius: 12px; }
    .card { background: white; border-radius: 12px; padding: 1rem; margin-bottom: 0.8rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; }
    .card.out-of-stock { opacity: 0.5; background: #e5e7eb; }
    .price { font-weight: bold; color: #059669; font-size: 1.1rem; margin-top: 4px; }
    button.add { background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; }
    button.add.disabled { background: #9ca3af; cursor: not-allowed; }
    .back-btn { background: #374151; color: white; border: none; padding: 8px 14px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-bottom: 1rem; display: inline-flex; align-items: center; gap: 6px; }
    .cart-bar { position: fixed; bottom: 0; left: 0; right: 0; background: white; padding: 1rem; border-top: 1px solid #e5e7eb; }
    .cart-btn { background: #059669; color: white; width: 100%; max-width: 500px; margin: auto; border: none; padding: 14px; border-radius: 10px; font-size: 1rem; font-weight: bold; cursor: pointer; display: flex; justify-content: space-between; }
    #modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); align-items: center; justify-content: center; padding: 1rem; }
    .modal-content { background: white; border-radius: 16px; max-width: 450px; width: 100%; padding: 1.5rem; }
    input, select { width: 100%; padding: 10px; margin: 6px 0 12px; border: 1px solid #d1d5db; border-radius: 8px; }
    .iban-box { background: #fef3c7; border: 1px dashed #d97706; padding: 10px; border-radius: 8px; font-size: 0.85rem; margin-bottom: 12px; }
    #tracker { display: none; background: #dbeafe; border-left: 5px solid #2563eb; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <header>
    <h2>🎓 Kampüs Yemek Masası</h2>
    <p style="font-size:0.85rem; color:#9ca3af; margin-top:4px;"><span class="badge">0% Komisyon</span> Kampüs İçi Doğrudan Sipariş</p>
  </header>

  <div class="container">
    <div id="tracker">
      <h4>📦 Aktif Siparişiniz: <span id="trackOrderId"></span> (<span id="trackRestName"></span>)</h4>
      <p style="margin-top:4px; font-weight:bold; color:#1e40af;" id="trackStatus">Mutfak Onayı Bekleniyor...</p>
    </div>

    <div id="hubDirectoryView">
      <h3 style="margin-bottom: 12px; color: #374151;">Dükkan Seçin:</h3>
      <div id="restaurantsList"></div>
    </div>

    <div id="restaurantMenuView" style="display:none;">
      <button class="back-btn" onclick="showDirectory()">← Tüm Restoranlar</button>
      <div id="selectedRestHeader" style="margin-bottom: 1rem;"></div>
      <div id="menuContainer"></div>
    </div>
  </div>

  <div class="cart-bar" id="cartBar" style="display:none;">
    <button class="cart-btn" onclick="openCheckout()">
      <span id="cartCount">0 Ürün</span>
      <span>Siparişi Tamamla (<span id="cartTotal">0</span> ₺)</span>
    </button>
  </div>

  <div id="modal">
    <div class="modal-content">
      <h3 id="modalRestTitle">Siparişi Onayla</h3>
      <div class="iban-box" id="modalIbanBox"></div>
      <label>İsim / Oda / Tel:</label>
      <input type="text" id="custName" placeholder="Örn: Oğuz - KYK 3. Blok No:402">
      <label>Teslimat Türü:</label>
      <select id="orderType">
        <option value="Gel-Al">Gel-Al (Dükkandan Teslim)</option>
        <option value="Kampüs Kapısı">Kampüs / Yurt Kapısı</option>
      </select>
      <label>Ödeme:</label>
      <select id="paymentType">
        <option value="FAST / Havale">FAST / Havale İle Gönderdim</option>
        <option value="Kapıda Nakit/POS">Teslimde Nakit / Kart</option>
      </select>
      <button class="cart-btn" style="background:#2563eb; width:100%;" onclick="submitOrder()">Siparişi Dükkana Gönder</button>
      <button style="width:100%; border:none; background:none; color:#6b7280; margin-top:8px; cursor:pointer;" onclick="closeCheckout()">İptal</button>
    </div>
  </div>

  <script>
    let hubData = {};
    let activeRestaurant = null;
    let cart = [];
    let currentTrackingId = null;

    async function init() {
      const res = await fetch('/api/hub');
      hubData = await res.json();
      renderDirectory();
    }
    init();

    function renderDirectory() {
      const list = document.getElementById('restaurantsList');
      list.innerHTML = Object.values(hubData).map(function(r) {
        return '<div class="rest-card" onclick="openRestaurant(\\'' + r.id + '\\')">' +
          '<div class="rest-header">' +
            '<span class="rest-icon">' + r.icon + '</span>' +
            '<div>' +
              '<h3>' + r.name + '</h3>' +
              '<p style="color:#6b7280; font-size:0.85rem; margin-top:2px;">' + r.desc + '</p>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    function openRestaurant(id) {
      activeRestaurant = hubData[id];
      document.getElementById('hubDirectoryView').style.display = 'none';
      document.getElementById('restaurantMenuView').style.display = 'block';

      document.getElementById('selectedRestHeader').innerHTML =
        '<div style="display:flex; align-items:center; gap:10px;">' +
          '<span style="font-size:2rem;">' + activeRestaurant.icon + '</span>' +
          '<div><h2>' + activeRestaurant.name + '</h2><p style="color:#6b7280; font-size:0.85rem;">' + activeRestaurant.desc + '</p></div>' +
        '</div>';

      renderMenu();
    }

    function showDirectory() {
      activeRestaurant = null;
      cart = [];
      updateCartUI();
      document.getElementById('hubDirectoryView').style.display = 'block';
      document.getElementById('restaurantMenuView').style.display = 'none';
    }

    function renderMenu() {
      if (!activeRestaurant) return;
      const cont = document.getElementById('menuContainer');
      cont.innerHTML = activeRestaurant.menu.map(function(item) {
        const stockClass = item.inStock ? '' : 'out-of-stock';
        const badge = item.inStock ? '' : '<span style="color:#ef4444; font-size:0.8rem;">(Tükendi)</span>';
        const btn = item.inStock
          ? '<button class="add" onclick="addToCart(' + item.id + ', \\'' + item.name + '\\', ' + item.price + ')">+ Ekle</button>'
          : '<button class="add disabled" disabled>Tükendi</button>';
        return '<div class="card ' + stockClass + '">' +
          '<div><h3>' + item.name + ' ' + badge + '</h3>' +
          '<p style="color:#6b7280; font-size:0.85rem;">' + item.desc + '</p>' +
          '<div class="price">' + item.price + ' ₺</div></div>' +
          btn + '</div>';
      }).join('');
    }

    const stream = new EventSource('/api/stream');
    stream.onmessage = function(e) {
      const payload = JSON.parse(e.data);
      if (payload.event === 'HUB_UPDATE') {
        hubData = payload.data;
        if (activeRestaurant) {
          activeRestaurant = hubData[activeRestaurant.id];
          renderMenu();
        }
      } else if (payload.event === 'STATUS_CHANGE' && payload.data.id === currentTrackingId) {
        const labels = {
          'BEKLIYOR': '⏳ Mutfak Onayı Bekleniyor...',
          'HAZIRLANIYOR': '🔥 Usta Hazırlıyor...',
          'HAZIR': '✅ SİPARİŞİNİZ HAZIR! Gelip Alabilirsiniz.',
          'TAMAMLANDI': '🎉 Teslim Edildi. Afiyet olsun!'
        };
        document.getElementById('trackStatus').innerText = labels[payload.data.status] || payload.data.status;
      }
    };

    function addToCart(id, name, price) {
      cart.push({ id: id, name: name, price: price });
      updateCartUI();
    }
    function updateCartUI() {
      const bar = document.getElementById('cartBar');
      if (cart.length > 0) {
        bar.style.display = 'block';
        document.getElementById('cartCount').innerText = cart.length + ' Ürün';
        document.getElementById('cartTotal').innerText = cart.reduce(function(s, i) { return s + i.price; }, 0);
      } else {
        bar.style.display = 'none';
      }
    }

    function openCheckout() {
      document.getElementById('modalRestTitle').innerText = activeRestaurant.name + ' - Sipariş';
      document.getElementById('modalIbanBox').innerHTML =
        '<strong>Doğrudan FAST / Havale:</strong><br>' +
        '<code>' + activeRestaurant.iban + '</code><br>' +
        '<small>' + activeRestaurant.accountName + '</small>';
      document.getElementById('modal').style.display = 'flex';
    }
    function closeCheckout() { document.getElementById('modal').style.display = 'none'; }

    async function submitOrder() {
      const note = document.getElementById('custName').value;
      if (!note) return alert('Lütfen bilgilerinizi girin!');
      
      const payload = {
        restaurantId: activeRestaurant.id,
        restaurantName: activeRestaurant.name,
        items: cart,
        total: cart.reduce(function(s, i) { return s + i.price; }, 0),
        customer: note,
        type: document.getElementById('orderType').value,
        payment: document.getElementById('paymentType').value
      };

      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      currentTrackingId = data.orderId;
      document.getElementById('tracker').style.display = 'block';
      document.getElementById('trackOrderId').innerText = '#' + data.orderId;
      document.getElementById('trackRestName').innerText = activeRestaurant.name;
      document.getElementById('trackStatus').innerText = '⏳ Sipariş dükkana iletildi, usta bekliyor...';

      cart = [];
      updateCartUI();
      closeCheckout();
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
  <title>Mutfak Portalı - Kampüs Masası</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: sans-serif; }
    body { background: #0f172a; color: white; padding: 1.5rem; }
    .topbar { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #334155; padding-bottom: 1rem; flex-wrap: wrap; gap: 10px; }
    .sound-btn { background: #10b981; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; }
    select.rest-select { background: #1e293b; color: white; border: 1px solid #475569; padding: 8px 12px; border-radius: 8px; font-size: 1rem; }
    
    /* Stats & Revenue Dashboard */
    .stats-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem; }
    .stat-card { background: #1e293b; padding: 1.2rem; border-radius: 10px; border-left: 5px solid #3b82f6; }
    .stat-card.revenue { border-left-color: #10b981; }
    .stat-card.saved { border-left-color: #f59e0b; background: #1e293b; }
    .stat-label { font-size: 0.8rem; color: #94a3b8; font-weight: bold; text-transform: uppercase; }
    .stat-value { font-size: 1.6rem; font-weight: bold; margin-top: 4px; display: block; color: white; }
    
    .stock-bar { background: #1e293b; padding: 1rem; border-radius: 10px; margin-top: 1rem; }
    .stock-grid { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
    .stock-item { background: #334155; padding: 6px 12px; border-radius: 6px; display: flex; align-items: center; gap: 8px; font-size: 0.9rem; }
    .stock-toggle { padding: 4px 8px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.75rem; }
    .in-stock { background: #10b981; color: white; }
    .out-stock { background: #ef4444; color: white; }
    
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem; margin-top: 1.5rem; }
    .order-card { background: #1e293b; border-left: 6px solid #f59e0b; border-radius: 10px; padding: 1.2rem; transition: 0.3s; }
    .order-card.hazirlaniyor { border-left-color: #3b82f6; }
    .order-card.hazir { border-left-color: #10b981; }
    .order-card.tamamlandi { opacity: 0.3; }
    .actions { display: flex; gap: 6px; margin-top: 12px; }
    .actions button { flex: 1; padding: 8px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 0.8rem; }
    .btn-prep { background: #3b82f6; color: white; }
    .btn-ready { background: #10b981; color: white; }
    .btn-done { background: #475569; color: white; }
  </style>
</head>
<body>
  <div class="topbar">
    <div style="display:flex; align-items:center; gap:10px;">
      <h2>🍳 Mutfak & Kasa Paneli:</h2>
      <select class="rest-select" id="restaurantSelector" onchange="switchRestaurant(this.value)"></select>
    </div>
    <button class="sound-btn" id="audioToggle" onclick="initAudio()">🔔 Sesi Aktif Et</button>
  </div>

  <!-- Live Revenue & Anti-Commission Widget -->
  <div class="stats-bar">
    <div class="stat-card revenue">
      <span class="stat-label">💰 Toplam Ciro</span>
      <span class="stat-value" id="statRevenue" style="color:#10b981;">0 ₺</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">📦 Toplam Sipariş</span>
      <span class="stat-value" id="statCount">0 Adet</span>
    </div>
    <div class="stat-card saved">
      <span class="stat-label">🛡️ Kurtarılan Komisyon (~%30)</span>
      <span class="stat-value" id="statSaved" style="color:#f59e0b;">+0 ₺</span>
      <small style="color:#94a3b8; font-size:0.75rem;">Yemeksepeti/Trendyol'a kaptırılmayan para</small>
    </div>
  </div>

  <div class="stock-bar">
    <h4>🍲 Bu Dükkanın Stok Kontrolü:</h4>
    <div class="stock-grid" id="stockContainer"></div>
  </div>

  <div class="grid" id="ordersGrid"></div>

  <script>
    let audioCtx = null;
    let hubData = {};
    let currentRestId = "donerci";

    function initAudio() {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      playChime();
      document.getElementById('audioToggle').innerText = '🔊 Ses Açık';
      document.getElementById('audioToggle').style.background = '#2563eb';
    }

    function playChime() {
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880.00, now + 0.12);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.8);
    }

    async function initKitchen() {
      const res = await fetch('/api/hub');
      hubData = await res.json();
      
      const sel = document.getElementById('restaurantSelector');
      sel.innerHTML = Object.values(hubData).map(function(r) {
        return '<option value="' + r.id + '">' + r.icon + ' ' + r.name + '</option>';
      }).join('');
      
      loadRestaurantDashboard();
    }
    initKitchen();

    function switchRestaurant(newId) {
      currentRestId = newId;
      loadRestaurantDashboard();
    }

    async function loadRestaurantDashboard() {
      document.getElementById('ordersGrid').innerHTML = '';
      
      // 1. Render stock switches
      const rest = hubData[currentRestId];
      if (rest) {
        document.getElementById('stockContainer').innerHTML = rest.menu.map(function(item) {
          const btnClass = item.inStock ? 'in-stock' : 'out-stock';
          const label = item.inStock ? '🟢 Stokta' : '🔴 Tükendi';
          return '<div class="stock-item">' +
            '<span>' + item.name + '</span>' +
            '<button class="stock-toggle ' + btnClass + '" onclick="toggleStock(' + item.id + ')">' + label + '</button>' +
          '</div>';
        }).join('');
      }

      // 2. Fetch stats for this restaurant
      refreshStats();

      // 3. Fetch orders
      const res = await fetch('/api/orders/active?restaurantId=' + currentRestId);
      const activeOrders = await res.json();
      activeOrders.forEach(renderCard);
    }

    async function refreshStats() {
      const resStats = await fetch('/api/stats?restaurantId=' + currentRestId);
      const stats = await resStats.json();
      document.getElementById('statRevenue').innerText = stats.totalRevenue + ' ₺';
      document.getElementById('statCount').innerText = stats.orderCount + ' Adet';
      document.getElementById('statSaved').innerText = '+' + stats.commissionSaved + ' ₺';
    }

    async function toggleStock(itemId) {
      const res = await fetch('/api/menu/toggle-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId: currentRestId, itemId: itemId })
      });
      const data = await res.json();
      hubData = data.hub;
      loadRestaurantDashboard();
    }

    const evtSource = new EventSource('/api/stream');
    evtSource.onmessage = function(event) {
      const msg = JSON.parse(event.data);
      if (msg.event === 'NEW_ORDER') {
        if (msg.data.restaurantId === currentRestId) {
          playChime();
          renderCard(msg.data);
          refreshStats();
        }
      } else if (msg.event === 'STATUS_CHANGE') {
        if (msg.data.restaurantId === currentRestId) {
          updateCardUI(msg.data.id, msg.data.status);
          refreshStats();
        }
      } else if (msg.event === 'HUB_UPDATE') {
        hubData = msg.data;
        loadRestaurantDashboard();
      }
    };

    function renderCard(order) {
      if (document.getElementById('order-' + order.id)) return;
      const card = document.createElement('div');
      card.id = 'order-' + order.id;
      card.className = 'order-card ' + order.status.toLowerCase();
      const itemsList = order.items.map(function(i) { return '<li>' + i.name + ' (' + i.price + ' TL)</li>'; }).join('');
      card.innerHTML =
        '<div style="display:flex; justify-content:space-between;">' +
          '<h3>#' + order.id + '</h3>' +
          '<span style="background:#334155; padding:2px 6px; border-radius:4px; font-size:0.75rem;">' + order.time + '</span>' +
        '</div>' +
        '<p style="margin:6px 0;"><strong>' + order.customer + '</strong></p>' +
        '<p style="color:#94a3b8; font-size:0.85rem;">' + order.type + ' | ' + order.payment + '</p>' +
        '<ul style="margin:8px 0 8px 18px;">' + itemsList + '</ul>' +
        '<h2 style="color:#10b981; margin-bottom:8px;">' + order.total + ' ₺</h2>' +
        '<div class="actions">' +
          '<button class="btn-prep" onclick="setStatus(' + order.id + ', \\'HAZIRLANIYOR\\')">🔥 Hazırla</button>' +
          '<button class="btn-ready" onclick="setStatus(' + order.id + ', \\'HAZIR\\')">✅ Hazır</button>' +
          '<button class="btn-done" onclick="setStatus(' + order.id + ', \\'TAMAMLANDI\\')">📦 Bitti</button>' +
        '</div>';
      document.getElementById('ordersGrid').prepend(card);
    }

    async function setStatus(orderId, status) {
      await fetch('/api/order/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderId, status: status })
      });
    }

    function updateCardUI(id, status) {
      const card = document.getElementById('order-' + id);
      if (!card) return;
      card.className = 'order-card ' + status.toLowerCase();
      if (status === 'TAMAMLANDI') setTimeout(function() { card.remove(); }, 1000);
    }
  </script>
</body>
</html>`;
}

const PORT = process.env.PORT || 3000; server.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Campus Hub v6 (Revenue & Anti-Commission Tracker) is live!');
  console.log('📱 Student Directory: http://localhost:3000');
  console.log('🍳 Kitchen & Kasa:    http://localhost:3000/kitchen');
});
