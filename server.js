// server.js - Level 7: Industrial Kitchen POS & Anti-Monopoly Campus Hub
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
    pin: "1234",
    status: "OPEN", // OPEN, BUSY, CLOSED
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
    pin: "1234",
    status: "OPEN",
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
    pin: "1234",
    status: "OPEN",
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

  // 2. API: Public Hub Info
  if (pathname === '/api/hub' && req.method === 'GET') {
    // Strip PINs from public payload
    const publicHub = {};
    for (let key in hub) {
      const { pin, ...safeData } = hub[key];
      publicHub[key] = safeData;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(publicHub));
    return;
  }

  // 3. API: Kitchen Auth / Verify PIN
  if (pathname === '/api/kitchen/auth' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const { restaurantId, pin } = JSON.parse(body);
      const rest = hub[restaurantId];
      if (rest && rest.pin === pin) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Hatalı PIN Kodu!' }));
      }
    });
    return;
  }

  // 4. API: Change Restaurant Operating Status (Open/Busy/Closed)
  if (pathname === '/api/kitchen/store-status' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const { restaurantId, status } = JSON.parse(body);
      if (hub[restaurantId]) {
        hub[restaurantId].status = status;
        saveHub(hub);
        broadcast({ event: 'HUB_UPDATE', data: hub });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, status }));
    });
    return;
  }

  // 5. API: Active Orders
  if (pathname === '/api/orders/active' && req.method === 'GET') {
    const restId = parsedUrl.query.restaurantId;
    let active = orders.filter(o => o.status !== 'TAMAMLANDI');
    if (restId) active = active.filter(o => o.restaurantId === restId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(active));
    return;
  }

  // 6. API: Daily Revenue & Metrics
  if (pathname === '/api/stats' && req.method === 'GET') {
    const restId = parsedUrl.query.restaurantId;
    const restOrders = orders.filter(o => o.restaurantId === restId);
    const totalRevenue = restOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const orderCount = restOrders.length;
    const commissionSaved = Math.round(totalRevenue * 0.30);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ totalRevenue, orderCount, commissionSaved }));
    return;
  }

  // 7. API: Download End-of-Day Z-Raporu (.CSV)
  if (pathname === '/api/kitchen/z-raporu' && req.method === 'GET') {
    const restId = parsedUrl.query.restaurantId;
    const rest = hub[restId] || { name: "Restoran" };
    const restOrders = orders.filter(o => o.restaurantId === restId);

    let csv = '\uFEFF'; // UTF-8 BOM for Excel Turkish character compatibility
    csv += 'Sipariş No;Tarih;Saat;Müşteri;Teslimat;Ödeme;Ürünler;Tutar (TL)\n';
    
    restOrders.forEach(o => {
      const itemsSummary = o.items.map(i => `${i.name} (${i.price} TL)`).join(', ');
      csv += `"${o.id}";"${o.date}";"${o.time}";"${o.customer}";"${o.type}";"${o.payment}";"${itemsSummary}";"${o.total}"\n`;
    });

    const totalRev = restOrders.reduce((s, o) => s + (o.total || 0), 0);
    csv += `\n;;;;;;TOPLAM CIRO;${totalRev} TL\n`;
    csv += `;;;;;;TASARRUF EDILEN KOMISYON (%30);${Math.round(totalRev * 0.30)} TL\n`;

    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename=Z-Raporu-${restId}-${new Date().toISOString().split('T')[0]}.csv`
    });
    res.end(csv);
    return;
  }

  // 8. API: Toggle Item Stock
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

  // 9. API: Place Order
  if (pathname === '/api/order' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const order = JSON.parse(body);
      const rest = hub[order.restaurantId];
      if (rest && rest.status === 'CLOSED') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Dükkan şu anda kapalıdır.' }));
      }

      order.id = Math.floor(1000 + Math.random() * 9000);
      order.status = 'BEKLIYOR';
      order.prepMinutes = 15;
      order.readyAt = null;
      order.date = new Date().toLocaleDateString('tr-TR');
      order.time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      
      orders.unshift(order);
      saveOrders(orders);

      broadcast({ event: 'NEW_ORDER', data: order });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, orderId: order.id, order }));
    });
    return;
  }

  // 10. API: Update Status & Preparation Timer
  if (pathname === '/api/order/status' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const { orderId, status, prepMinutes } = JSON.parse(body);
      const target = orders.find(o => o.id === orderId);
      if (target) {
        target.status = status;
        if (status === 'HAZIRLANIYOR' && prepMinutes) {
          target.prepMinutes = prepMinutes;
          target.readyAt = Date.now() + prepMinutes * 60000;
        }
        if (status === 'HAZIR' || status === 'TAMAMLANDI') {
          target.readyAt = null;
        }
        saveOrders(orders);
        broadcast({ 
          event: 'STATUS_CHANGE', 
          data: { 
            id: orderId, 
            status: status, 
            restaurantId: target.restaurantId,
            readyAt: target.readyAt,
            prepMinutes: target.prepMinutes 
          } 
        });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    });
    return;
  }

  // 11. Kitchen POS Screen
  if (pathname === '/kitchen') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getKitchenHTML());
    return;
  }

  // 12. Student App
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
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #f1f5f9; color: #0f172a; padding-bottom: 100px; }
    header { background: #0f172a; color: white; padding: 1.2rem; text-align: center; }
    .badge { background: #10b981; color: white; padding: 4px 8px; border-radius: 99px; font-size: 0.75rem; font-weight: bold; }
    .container { max-width: 500px; margin: auto; padding: 1rem; }
    
    .rest-card { background: white; border-radius: 14px; padding: 1.2rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); cursor: pointer; transition: 0.2s; border: 1px solid #e2e8f0; }
    .rest-card:hover { border-color: #2563eb; transform: translateY(-2px); }
    .rest-header { display: flex; align-items: center; gap: 12px; }
    .rest-icon { font-size: 2.2rem; background: #f8fafc; padding: 8px; border-radius: 12px; border: 1px solid #e2e8f0; }
    
    .status-pill { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 0.75rem; font-weight: bold; margin-top: 4px; }
    .status-open { background: #dcfce7; color: #15803d; }
    .status-busy { background: #fef3c7; color: #b45309; }
    .status-closed { background: #fee2e2; color: #b91c1c; }

    .card { background: white; border-radius: 12px; padding: 1rem; margin-bottom: 0.8rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center; border: 1px solid #e2e8f0; }
    .card.out-of-stock { opacity: 0.4; background: #f1f5f9; }
    .price { font-weight: bold; color: #059669; font-size: 1.1rem; margin-top: 4px; }
    button.add { background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; }
    button.add.disabled { background: #94a3b8; cursor: not-allowed; }
    
    .back-btn { background: #334155; color: white; border: none; padding: 8px 14px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-bottom: 1rem; }
    
    .banner-warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 10px; border-radius: 8px; margin-bottom: 12px; font-size: 0.85rem; color: #92400e; font-weight: 500; }
    .banner-closed { background: #fee2e2; border-left: 4px solid #ef4444; padding: 10px; border-radius: 8px; margin-bottom: 12px; font-size: 0.85rem; color: #991b1b; font-weight: bold; }

    .cart-bar { position: fixed; bottom: 0; left: 0; right: 0; background: white; padding: 1rem; border-top: 1px solid #e2e8f0; }
    .cart-btn { background: #059669; color: white; width: 100%; max-width: 500px; margin: auto; border: none; padding: 14px; border-radius: 10px; font-size: 1rem; font-weight: bold; cursor: pointer; display: flex; justify-content: space-between; }
    
    #modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); align-items: center; justify-content: center; padding: 1rem; z-index: 50; }
    .modal-content { background: white; border-radius: 16px; max-width: 450px; width: 100%; padding: 1.5rem; }
    input, select { width: 100%; padding: 10px; margin: 6px 0 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem; }
    .iban-box { background: #fef3c7; border: 1px dashed #d97706; padding: 10px; border-radius: 8px; font-size: 0.85rem; margin-bottom: 12px; }
    
    /* Ticket Card */
    #tracker { display: none; background: white; border-radius: 14px; padding: 1.2rem; border-left: 6px solid #2563eb; margin-bottom: 1.2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.06); }
    .countdown-box { background: #eff6ff; color: #1d4ed8; padding: 8px 12px; border-radius: 8px; font-weight: bold; font-size: 1.1rem; margin-top: 8px; display: inline-block; }
  </style>
</head>
<body>
  <header>
    <h2>🎓 Kampüs Masası</h2>
    <p style="font-size:0.85rem; color:#94a3b8; margin-top:4px;"><span class="badge">Doğrudan Sipariş</span> 0% Komisyon - Esnaftan Sofraya</p>
  </header>

  <div class="container">
    <!-- Active Ticket Tracker -->
    <div id="tracker">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h4>📦 Aktif Fiş: <span id="trackOrderId" style="color:#2563eb;"></span></h4>
        <small id="trackRestName" style="font-weight:bold; color:#475569;"></small>
      </div>
      <p style="margin-top:6px; font-weight:bold;" id="trackStatus">⏳ Mutfak Onayı Bekleniyor...</p>
      <div id="timerContainer" style="display:none;">
        <span class="countdown-box" id="countdownDisplay">⏱️ 15:00</span>
      </div>
    </div>

    <!-- View 1: Restaurant Directory -->
    <div id="hubDirectoryView">
      <h3 style="margin-bottom: 12px; color: #334155;">Dükkan Seçin:</h3>
      <div id="restaurantsList"></div>
    </div>

    <!-- View 2: Restaurant Menu -->
    <div id="restaurantMenuView" style="display:none;">
      <button class="back-btn" onclick="showDirectory()">← Tüm Dükkanlar</button>
      <div id="selectedRestHeader" style="margin-bottom: 1rem;"></div>
      <div id="storeAlertBanner"></div>
      <div id="menuContainer"></div>
    </div>
  </div>

  <div class="cart-bar" id="cartBar" style="display:none;">
    <button class="cart-btn" id="checkoutBtn" onclick="openCheckout()">
      <span id="cartCount">0 Ürün</span>
      <span>Siparişi Tamamla (<span id="cartTotal">0</span> ₺)</span>
    </button>
  </div>

  <div id="modal">
    <div class="modal-content">
      <h3 id="modalRestTitle">Siparişi Onayla</h3>
      <div class="iban-box" id="modalIbanBox"></div>
      <label>İsim / Oda / Tel:</label>
      <input type="text" id="custName" placeholder="Örn: Ali - KYK 3. Blok No:402">
      <label>Teslimat Türü:</label>
      <select id="orderType">
        <option value="Gel-Al">Gel-Al (Dükkandan Teslim)</option>
        <option value="Kampüs Kapısı">Kampüs / Yurt Kapısı</option>
      </select>
      <label>Ödeme Şekli:</label>
      <select id="paymentType">
        <option value="FAST / Havale">FAST / Havale İle Gönderdim</option>
        <option value="Kapıda Nakit/POS">Teslimde Nakit / Kart</option>
      </select>
      <button class="cart-btn" style="background:#2563eb; width:100%; justify-content:center;" onclick="submitOrder()">Siparişi Dükkana Gönder</button>
      <button style="width:100%; border:none; background:none; color:#64748b; margin-top:10px; cursor:pointer;" onclick="closeCheckout()">İptal</button>
    </div>
  </div>

  <script>
    let hubData = {};
    let activeRestaurant = null;
    let cart = [];
    let activeTicket = JSON.parse(localStorage.getItem('activeTicket') || 'null');
    let timerInterval = null;

    async function init() {
      const res = await fetch('/api/hub');
      hubData = await res.json();
      renderDirectory();
      if (activeTicket) renderActiveTicketUI();
    }
    init();

    function renderDirectory() {
      const list = document.getElementById('restaurantsList');
      list.innerHTML = Object.values(hubData).map(function(r) {
        let statusBadge = '<span class="status-pill status-open">🟢 Açık</span>';
        if (r.status === 'BUSY') statusBadge = '<span class="status-pill status-busy">🟡 Yoğun (+20 Dk)</span>';
        if (r.status === 'CLOSED') statusBadge = '<span class="status-pill status-closed">🔴 Kapalı</span>';

        return '<div class="rest-card" onclick="openRestaurant(\\'' + r.id + '\\')">' +
          '<div class="rest-header">' +
            '<span class="rest-icon">' + r.icon + '</span>' +
            '<div>' +
              '<h3>' + r.name + '</h3>' +
              '<p style="color:#64748b; font-size:0.85rem; margin-top:2px;">' + r.desc + '</p>' +
              statusBadge +
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
          '<div><h2>' + activeRestaurant.name + '</h2><p style="color:#64748b; font-size:0.85rem;">' + activeRestaurant.desc + '</p></div>' +
        '</div>';

      const banner = document.getElementById('storeAlertBanner');
      banner.innerHTML = '';
      if (activeRestaurant.status === 'BUSY') {
        banner.innerHTML = '<div class="banner-warning">⚠️ Dükkan şu an çok yoğun. Siparişlerin hazırlanması 15-20 dk uzayabilir.</div>';
      } else if (activeRestaurant.status === 'CLOSED') {
        banner.innerHTML = '<div class="banner-closed">🔴 DÜKKAN ŞU AN KAPALIDIR. Yeni sipariş alınmamaktadır.</div>';
      }

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
      const isClosed = activeRestaurant.status === 'CLOSED';
      const cont = document.getElementById('menuContainer');
      
      cont.innerHTML = activeRestaurant.menu.map(function(item) {
        const canAdd = item.inStock && !isClosed;
        const stockClass = canAdd ? '' : 'out-of-stock';
        let btn = '<button class="add" onclick="addToCart(' + item.id + ', \\'' + item.name + '\\', ' + item.price + ')">+ Ekle</button>';
        
        if (!item.inStock) btn = '<button class="add disabled" disabled>Tükendi</button>';
        if (isClosed) btn = '<button class="add disabled" disabled>Kapalı</button>';

        return '<div class="card ' + stockClass + '">' +
          '<div><h3>' + item.name + (!item.inStock ? ' <span style="color:#ef4444; font-size:0.8rem;">(Tükendi)</span>' : '') + '</h3>' +
          '<p style="color:#64748b; font-size:0.85rem;">' + item.desc + '</p>' +
          '<div class="price">' + item.price + ' ₺</div></div>' +
          btn + '</div>';
      }).join('');
    }

    const stream = new EventSource('/api/stream');
    stream.onmessage = function(e) {
      const payload = JSON.parse(e.data);
      if (payload.event === 'HUB_UPDATE') {
        hubData = payload.data;
        renderDirectory();
        if (activeRestaurant) {
          activeRestaurant = hubData[activeRestaurant.id];
          openRestaurant(activeRestaurant.id);
        }
      } else if (payload.event === 'STATUS_CHANGE') {
        if (activeTicket && payload.data.id === activeTicket.id) {
          activeTicket.status = payload.data.status;
          activeTicket.readyAt = payload.data.readyAt;
          localStorage.setItem('activeTicket', JSON.stringify(activeTicket));
          renderActiveTicketUI();
        }
      }
    };

    function addToCart(id, name, price) {
      cart.push({ id: id, name: name, price: price });
      updateCartUI();
    }
    function updateCartUI() {
      const bar = document.getElementById('cartBar');
      if (cart.length > 0 && activeRestaurant && activeRestaurant.status !== 'CLOSED') {
        bar.style.display = 'block';
        document.getElementById('cartCount').innerText = cart.length + ' Ürün';
        document.getElementById('cartTotal').innerText = cart.reduce(function(s, i) { return s + i.price; }, 0);
      } else {
        bar.style.display = 'none';
      }
    }

    function openCheckout() {
      document.getElementById('modalRestTitle').innerText = activeRestaurant.name;
      document.getElementById('modalIbanBox').innerHTML =
        '<strong>Doğrudan FAST / Havale IBAN:</strong><br>' +
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

      if (data.error) return alert(data.error);

      activeTicket = {
        id: data.orderId,
        restaurantName: activeRestaurant.name,
        status: 'BEKLIYOR',
        readyAt: null
      };
      localStorage.setItem('activeTicket', JSON.stringify(activeTicket));
      
      cart = [];
      updateCartUI();
      closeCheckout();
      renderActiveTicketUI();
    }

    function renderActiveTicketUI() {
      if (!activeTicket) return;
      document.getElementById('tracker').style.display = 'block';
      document.getElementById('trackOrderId').innerText = '#' + activeTicket.id;
      document.getElementById('trackRestName').innerText = activeTicket.restaurantName;
      
      const timerCont = document.getElementById('timerContainer');
      clearInterval(timerInterval);

      if (activeTicket.status === 'BEKLIYOR') {
        document.getElementById('trackStatus').innerHTML = '<span style="color:#d97706;">⏳ Mutfak Onayı Bekleniyor...</span>';
        timerCont.style.display = 'none';
      } else if (activeTicket.status === 'HAZIRLANIYOR') {
        document.getElementById('trackStatus').innerHTML = '<span style="color:#2563eb;">🔥 Usta Hazırlıyor...</span>';
        if (activeTicket.readyAt) {
          timerCont.style.display = 'block';
          startCountdown(activeTicket.readyAt);
        }
      } else if (activeTicket.status === 'HAZIR') {
        document.getElementById('trackStatus').innerHTML = '<span style="color:#16a34a;">✅ SİPARİŞİNİZ HAZIR! Gelip Alabilirsiniz.</span>';
        timerCont.style.display = 'none';
      } else if (activeTicket.status === 'TAMAMLANDI') {
        document.getElementById('trackStatus').innerHTML = '<span style="color:#475569;">🎉 Teslim Edildi. Afiyet olsun!</span>';
        timerCont.style.display = 'none';
        setTimeout(function() {
          localStorage.removeItem('activeTicket');
          document.getElementById('tracker').style.display = 'none';
        }, 4000);
      }
    }

    function startCountdown(targetTime) {
      function tick() {
        const remaining = Math.max(0, Math.floor((targetTime - Date.now()) / 1000));
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        document.getElementById('countdownDisplay').innerText = '⏱️ Tahmini Kalan: ' + mins + ':' + (secs < 10 ? '0' : '') + secs;
        if (remaining <= 0) clearInterval(timerInterval);
      }
      tick();
      timerInterval = setInterval(tick, 1000);
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
  <title>Mutfak POS Paneli</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #0f172a; color: #f8fafc; padding: 1.5rem; }
    
    /* Top Bar & Controls */
    .topbar { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #334155; padding-bottom: 1rem; flex-wrap: wrap; gap: 12px; }
    select.rest-select { background: #1e293b; color: white; border: 1px solid #475569; padding: 10px 14px; border-radius: 8px; font-size: 1rem; font-weight: bold; }
    
    .status-group { display: flex; gap: 6px; background: #1e293b; padding: 4px; border-radius: 8px; border: 1px solid #334155; }
    .status-btn { padding: 8px 14px; border: none; border-radius: 6px; font-size: 0.85rem; font-weight: bold; cursor: pointer; color: #94a3b8; background: transparent; }
    .status-btn.active-open { background: #16a34a; color: white; }
    .status-btn.active-busy { background: #d97706; color: white; }
    .status-btn.active-closed { background: #dc2626; color: white; }

    .sound-btn { background: #2563eb; color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; }
    .z-btn { background: #059669; color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; }
    
    /* Stats Widget */
    .stats-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem; }
    .stat-card { background: #1e293b; padding: 1.2rem; border-radius: 10px; border-left: 5px solid #3b82f6; }
    .stat-card.revenue { border-left-color: #10b981; }
    .stat-card.saved { border-left-color: #f59e0b; }
    .stat-label { font-size: 0.75rem; color: #94a3b8; font-weight: bold; text-transform: uppercase; }
    .stat-value { font-size: 1.6rem; font-weight: bold; margin-top: 4px; display: block; color: white; }

    .stock-bar { background: #1e293b; padding: 1rem; border-radius: 10px; margin-top: 1rem; }
    .stock-grid { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
    .stock-item { background: #334155; padding: 6px 12px; border-radius: 6px; display: flex; align-items: center; gap: 8px; font-size: 0.9rem; }
    .stock-toggle { padding: 4px 8px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.75rem; }
    .in-stock { background: #10b981; color: white; }
    .out-stock { background: #ef4444; color: white; }

    /* Orders Grid */
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 1rem; margin-top: 1.5rem; }
    .order-card { background: #1e293b; border-left: 6px solid #f59e0b; border-radius: 10px; padding: 1.2rem; }
    .order-card.hazirlaniyor { border-left-color: #3b82f6; }
    .order-card.hazir { border-left-color: #10b981; }
    .order-card.tamamlandi { opacity: 0.2; }
    
    .actions { display: flex; gap: 6px; margin-top: 12px; }
    .actions button { flex: 1; padding: 10px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 0.85rem; }
    .btn-prep { background: #3b82f6; color: white; }
    .btn-ready { background: #10b981; color: white; }
    .btn-done { background: #475569; color: white; }
    .btn-print { background: #64748b; color: white; flex: 0.5 !important; }

    /* Auth PIN Modal */
    #authModal { position: fixed; inset: 0; background: #090d16; display: flex; align-items: center; justify-content: center; z-index: 100; }
    .auth-box { background: #1e293b; padding: 2rem; border-radius: 14px; text-align: center; max-width: 320px; width: 100%; border: 1px solid #334155; }
    .pin-input { font-size: 2rem; letter-spacing: 12px; text-align: center; width: 160px; padding: 8px; margin: 16px auto; background: #0f172a; border: 1px solid #475569; color: white; border-radius: 8px; display: block; }
    
    /* 80mm Receipt Print Styling */
    @media print {
      body * { visibility: hidden; }
      .print-area, .print-area * { visibility: visible; }
      .print-area { position: absolute; left: 0; top: 0; width: 80mm; font-family: monospace; color: black !important; padding: 10px; }
    }
  </style>
</head>
<body>
  <!-- PIN Code Security Gate -->
  <div id="authModal">
    <div class="auth-box">
      <h2>🔒 Mutfak Girişi</h2>
      <p style="color:#94a3b8; font-size:0.85rem; margin-top:6px;">Lütfen 4 haneli şifrenizi girin:</p>
      <input type="password" maxlength="4" id="pinCode" class="pin-input" placeholder="••••" autofocus>
      <button class="sound-btn" style="width:100%;" onclick="verifyPin()">Panele Giriş Yap</button>
      <p style="color:#64748b; font-size:0.75rem; margin-top:10px;">Varsayılan demo PIN: <strong>1234</strong></p>
    </div>
  </div>

  <div class="topbar">
    <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
      <h2>🍳 Mutfak & Kasa:</h2>
      <select class="rest-select" id="restaurantSelector" onchange="switchRestaurant(this.value)"></select>
      
      <!-- Store Status Toggle -->
      <div class="status-group">
        <button class="status-btn" id="btnOpen" onclick="setStoreStatus('OPEN')">🟢 Açık</button>
        <button class="status-btn" id="btnBusy" onclick="setStoreStatus('BUSY')">🟡 Yoğun</button>
        <button class="status-btn" id="btnClosed" onclick="setStoreStatus('CLOSED')">🔴 Kapalı</button>
      </div>
    </div>

    <div style="display:flex; gap:8px;">
      <button class="z-btn" onclick="downloadZReport()">📊 Z-Raporu (.CSV)</button>
      <button class="sound-btn" id="audioToggle" onclick="initAudio()">🔔 Sesi Aç</button>
    </div>
  </div>

  <!-- Live Stats -->
  <div class="stats-bar">
    <div class="stat-card revenue">
      <span class="stat-label">💰 Toplam Ciro</span>
      <span class="stat-value" id="statRevenue" style="color:#10b981;">0 ₺</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">📦 Sipariş Adedi</span>
      <span class="stat-value" id="statCount">0 Adet</span>
    </div>
    <div class="stat-card saved">
      <span class="stat-label">🛡️ Kurtarılan Komisyon (%30)</span>
      <span class="stat-value" id="statSaved" style="color:#f59e0b;">+0 ₺</span>
      <small style="color:#94a3b8; font-size:0.75rem;">Yemeksepeti/Trendyol'a verilmeyen para</small>
    </div>
  </div>

  <div class="stock-bar">
    <h4>🍲 Bu Dükkanın Hızlı Stok Kontrolü:</h4>
    <div class="stock-grid" id="stockContainer"></div>
  </div>

  <div class="grid" id="ordersGrid"></div>

  <!-- Hidden Print Container -->
  <div id="printContainer" class="print-area" style="display:none;"></div>

  <script>
    let audioCtx = null;
    let hubData = {};
    let currentRestId = "donerci";

    // Check saved PIN session
    if (localStorage.getItem('kitchenAuth') === 'true') {
      document.getElementById('authModal').style.display = 'none';
    }

    async function verifyPin() {
      const pin = document.getElementById('pinCode').value;
      const res = await fetch('/api/kitchen/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId: currentRestId, pin: pin })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('kitchenAuth', 'true');
        document.getElementById('authModal').style.display = 'none';
      } else {
        alert(data.message);
      }
    }

    function initAudio() {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      playChime();
      document.getElementById('audioToggle').innerText = '🔊 Ses Aktif';
      document.getElementById('audioToggle').style.background = '#10b981';
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

    async function setStoreStatus(status) {
      await fetch('/api/kitchen/store-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId: currentRestId, status: status })
      });
      updateStoreStatusUI(status);
    }

    function updateStoreStatusUI(status) {
      document.getElementById('btnOpen').className = 'status-btn ' + (status === 'OPEN' ? 'active-open' : '');
      document.getElementById('btnBusy').className = 'status-btn ' + (status === 'BUSY' ? 'active-busy' : '');
      document.getElementById('btnClosed').className = 'status-btn ' + (status === 'CLOSED' ? 'active-closed' : '');
    }

    async function loadRestaurantDashboard() {
      document.getElementById('ordersGrid').innerHTML = '';
      
      const rest = hubData[currentRestId];
      if (rest) {
        updateStoreStatusUI(rest.status || 'OPEN');
        document.getElementById('stockContainer').innerHTML = rest.menu.map(function(item) {
          const btnClass = item.inStock ? 'in-stock' : 'out-stock';
          const label = item.inStock ? '🟢 Stokta' : '🔴 Tükendi';
          return '<div class="stock-item">' +
            '<span>' + item.name + '</span>' +
            '<button class="stock-toggle ' + btnClass + '" onclick="toggleStock(' + item.id + ')">' + label + '</button>' +
          '</div>';
        }).join('');
      }

      refreshStats();

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

    function downloadZReport() {
      window.location.href = '/api/kitchen/z-raporu?restaurantId=' + currentRestId;
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
          '<button class="btn-prep" onclick="promptPrepTime(' + order.id + ')">🔥 Hazırla</button>' +
          '<button class="btn-ready" onclick="setStatus(' + order.id + ', \\'HAZIR\\')">✅ Hazır</button>' +
          '<button class="btn-done" onclick="setStatus(' + order.id + ', \\'TAMAMLANDI\\')">📦 Bitti</button>' +
          '<button class="btn-print" onclick="printReceipt(' + JSON.stringify(order).replace(/"/g, '&quot;') + ')">🖨️</button>' +
        '</div>';
      document.getElementById('ordersGrid').prepend(card);
    }

    async function promptPrepTime(orderId) {
      const minutes = prompt("Kaç dakikaya hazır olur? (Örn: 15)", "15");
      if (!minutes) return;
      await fetch('/api/order/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderId, status: 'HAZIRLANIYOR', prepMinutes: parseInt(minutes) || 15 })
      });
    }

    async function setStatus(orderId, status) {
      await fetch('/api/order/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderId, status: status })
      });
    }

    function printReceipt(order) {
      const p = document.getElementById('printContainer');
      p.style.display = 'block';
      p.innerHTML = 
        '================================<br>' +
        '       KAMPÜS MASASI FİŞİ       <br>' +
        '================================<br>' +
        'Sipariş No: #' + order.id + '<br>' +
        'Tarih: ' + order.date + ' ' + order.time + '<br>' +
        'Müşteri: ' + order.customer + '<br>' +
        'Teslimat: ' + order.type + '<br>' +
        'Ödeme: ' + order.payment + '<br>' +
        '--------------------------------<br>' +
        order.items.map(function(i) { return i.name + ' - ' + i.price + ' TL<br>'; }).join('') +
        '--------------------------------<br>' +
        'TOPLAM TUTAR: ' + order.total + ' TL<br>' +
        '================================<br>' +
        '  Afiyet Olsun! (0% Komisyon)   <br>';
      window.print();
      p.style.display = 'none';
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Industrial Campus POS Engine v7 is running on port ${PORT}!`);
  console.log(`📱 Student Directory: http://localhost:${PORT}`);
  console.log(`🍳 Kitchen POS:       http://localhost:${PORT}/kitchen`);
});
