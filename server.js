// server.js - Level 7: Industrial Kitchen Terminal & POS Engine
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
    pin: "5678",
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
    pin: "9999",
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

  // 2. API: Get Hub Info
  if (pathname === '/api/hub' && req.method === 'GET') {
    // Strip PIN codes from public consumer API
    const safeHub = JSON.parse(JSON.stringify(hub));
    Object.values(safeHub).forEach(r => { delete r.pin; });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(safeHub));
    return;
  }

  // 3. API: Verify Kitchen PIN
  if (pathname === '/api/kitchen/verify-pin' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      const { restaurantId, pin } = JSON.parse(body);
      const rest = hub[restaurantId];
      if (rest && rest.pin === pin) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Hatalı PIN Kodu!" }));
      }
    });
    return;
  }

  // 4. API: Update Shop Status (OPEN, BUSY, CLOSED)
  if (pathname === '/api/restaurant/status' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      const { restaurantId, status } = JSON.parse(body);
      if (hub[restaurantId]) {
        hub[restaurantId].status = status;
        saveHub(hub);
        broadcast({ event: 'HUB_UPDATE', data: hub });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, hub }));
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

  // 6. API: Daily Stats
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

  // 7. API: Toggle Stock
  if (pathname === '/api/menu/toggle-stock' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; });
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

  // 8. API: Place Order
  if (pathname === '/api/order' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      const order = JSON.parse(body);
      const rest = hub[order.restaurantId];
      
      // Reject if shop is closed
      if (rest && rest.status === 'CLOSED') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Dükkan şu an sipariş alımına kapalıdır!" }));
        return;
      }

      order.id = Math.floor(1000 + Math.random() * 9000);
      order.status = 'BEKLIYOR';
      order.prepTime = null;
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

  // 9. API: Update Status & Prep Time
  if (pathname === '/api/order/status' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      const { orderId, status, prepTime } = JSON.parse(body);
      const target = orders.find(o => o.id === orderId);
      if (target) {
        target.status = status;
        if (prepTime) target.prepTime = prepTime;
        saveOrders(orders);
        broadcast({
          event: 'STATUS_CHANGE',
          data: { id: orderId, status: status, prepTime: target.prepTime, restaurantId: target.restaurantId }
        });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    });
    return;
  }

  // 10. API: Download Z-Report CSV
  if (pathname === '/api/z-report' && req.method === 'GET') {
    const restId = parsedUrl.query.restaurantId;
    const rest = hub[restId];
    const restOrders = orders.filter(o => o.restaurantId === restId);
    
    let csv = `Z-RAPORU (GUNLUK KASA DOKUMU) - ${rest ? rest.name : restId}\n`;
    csv += `Tarih: ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR')}\n\n`;
    csv += `Siparis No;Saat;Musteri / Detay;Teslimat;Odeme;Tutar (TL);Durum\n`;
    
    let total = 0;
    restOrders.forEach(o => {
      const itemsStr = o.items.map(i => `${i.name} (x1)`).join(' + ');
      csv += `#${o.id};${o.time};"${o.customer} - ${itemsStr}";${o.type};${o.payment};${o.total};${o.status}\n`;
      total += (o.total || 0);
    });

    csv += `\nOZET TABLO\n`;
    csv += `Toplam Siparis Adedi;${restOrders.length} Adet\n`;
    csv += `Toplam Kasa Cirosu;${total} TL\n`;
    csv += `Kurtarilan Komisyon (%30);${Math.round(total * 0.30)} TL (Esnafta Kalan)\n`;

    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename=z-raporu-${restId}-${Date.now()}.csv`
    });
    res.end('\uFEFF' + csv); // Include BOM for perfect Excel UTF-8 display
    return;
  }

  // 11. Kitchen Terminal Page
  if (pathname === '/kitchen') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getKitchenHTML());
    return;
  }

  // 12. Student App Page
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
    
    .status-badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; margin-left: 6px; }
    .status-open { background: #dcfce7; color: #15803d; }
    .status-busy { background: #fef3c7; color: #b45309; }
    .status-closed { background: #fee2e2; color: #b91c1c; }
    
    .rest-card { background: white; border-radius: 12px; padding: 1.2rem; margin-bottom: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.06); cursor: pointer; transition: 0.2s; border: 2px solid transparent; }
    .rest-card:hover { border-color: #2563eb; transform: translateY(-2px); }
    .rest-header { display: flex; align-items: center; gap: 12px; }
    .rest-icon { font-size: 2.2rem; background: #f3f4f6; padding: 8px; border-radius: 12px; }
    
    .card { background: white; border-radius: 12px; padding: 1rem; margin-bottom: 0.8rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; }
    .card.out-of-stock { opacity: 0.5; background: #e5e7eb; }
    .price { font-weight: bold; color: #059669; font-size: 1.1rem; margin-top: 4px; }
    button.add { background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; }
    button.add.disabled { background: #9ca3af; cursor: not-allowed; }
    
    .back-btn { background: #374151; color: white; border: none; padding: 8px 14px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-bottom: 1rem; }
    .banner { padding: 10px; border-radius: 8px; font-size: 0.85rem; font-weight: bold; margin-bottom: 1rem; }
    .banner-busy { background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; }
    .banner-closed { background: #fee2e2; color: #991b1b; border: 1px solid #ef4444; }
    
    .cart-bar { position: fixed; bottom: 0; left: 0; right: 0; background: white; padding: 1rem; border-top: 1px solid #e5e7eb; }
    .cart-btn { background: #059669; color: white; width: 100%; max-width: 500px; margin: auto; border: none; padding: 14px; border-radius: 10px; font-size: 1rem; font-weight: bold; cursor: pointer; display: flex; justify-content: space-between; }
    
    #modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); align-items: center; justify-content: center; padding: 1rem; }
    .modal-content { background: white; border-radius: 16px; max-width: 450px; width: 100%; padding: 1.5rem; }
    input, select { width: 100%; padding: 10px; margin: 6px 0 12px; border: 1px solid #d1d5db; border-radius: 8px; }
    .iban-box { background: #fef3c7; border: 1px dashed #d97706; padding: 10px; border-radius: 8px; font-size: 0.85rem; margin-bottom: 12px; }
    
    #tracker { display: none; background: #dbeafe; border-left: 5px solid #2563eb; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }
    .pickup-token { background: #2563eb; color: white; padding: 4px 8px; border-radius: 6px; font-size: 1.1rem; font-weight: bold; }
  </style>
</head>
<body>
  <header>
    <h2>🎓 Kampüs Yemek Masası</h2>
    <p style="font-size:0.85rem; color:#9ca3af; margin-top:4px;"><span class="badge">0% Komisyon</span> Doğrudan Esnaf Portalı</p>
  </header>

  <div class="container">
    <div id="tracker">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h4>📦 Aktif Sipariş: <span class="pickup-token" id="trackOrderId"></span></h4>
        <span id="trackRestName" style="font-size:0.85rem; font-weight:bold; color:#4b5563;"></span>
      </div>
      <p style="margin-top:8px; font-weight:bold; color:#1e40af; font-size:1.05rem;" id="trackStatus">Mutfak Onayı Bekleniyor...</p>
      <p id="trackPrepTime" style="font-size:0.85rem; color:#1e3a8a; margin-top:4px; font-weight:bold;"></p>
    </div>

    <!-- Directory View -->
    <div id="hubDirectoryView">
      <h3 style="margin-bottom: 12px; color: #374151;">Dükkan Seçin:</h3>
      <div id="restaurantsList"></div>
    </div>

    <!-- Menu View -->
    <div id="restaurantMenuView" style="display:none;">
      <button class="back-btn" onclick="showDirectory()">← Tüm Restoranlar</button>
      <div id="selectedRestBanner"></div>
      <div id="selectedRestHeader" style="margin-bottom: 1rem;"></div>
      <div id="menuContainer"></div>
    </div>
  </div>

  <div class="cart-bar" id="cartBar" style="display:none;">
    <button class="cart-btn" id="cartSubmitBtn" onclick="openCheckout()">
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
      <button class="cart-btn" id="modalConfirmBtn" style="background:#2563eb; width:100%;" onclick="submitOrder()">Siparişi Dükkana Gönder</button>
      <button style="width:100%; border:none; background:none; color:#6b7280; margin-top:8px; cursor:pointer;" onclick="closeCheckout()">İptal</button>
    </div>
  </div>

  <script>
    let hubData = {};
    let activeRestaurant = null;
    let cart = [];
    let currentTrackingId = localStorage.getItem('activeOrderId');

    async function init() {
      const res = await fetch('/api/hub');
      hubData = await res.json();
      renderDirectory();
      if (currentTrackingId) {
        document.getElementById('tracker').style.display = 'block';
        document.getElementById('trackOrderId').innerText = '#' + currentTrackingId;
      }
    }
    init();

    function renderDirectory() {
      const list = document.getElementById('restaurantsList');
      list.innerHTML = Object.values(hubData).map(function(r) {
        let statusBadge = '<span class="status-badge status-open">Açık</span>';
        if (r.status === 'BUSY') statusBadge = '<span class="status-badge status-busy">Yoğun (+20dk)</span>';
        if (r.status === 'CLOSED') statusBadge = '<span class="status-badge status-closed">Kapalı</span>';
        
        return '<div class="rest-card" onclick="openRestaurant(\\'' + r.id + '\\')">' +
          '<div class="rest-header">' +
            '<span class="rest-icon">' + r.icon + '</span>' +
            '<div>' +
              '<h3>' + r.name + ' ' + statusBadge + '</h3>' +
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

      // Status Banners
      const banner = document.getElementById('selectedRestBanner');
      if (activeRestaurant.status === 'BUSY') {
        banner.innerHTML = '<div class="banner banner-busy">⚠️ Dükkanda şu an yoğunluk var. Siparişler yaklaşık 20 dakika gecikmeli hazırlanabilir.</div>';
      } else if (activeRestaurant.status === 'CLOSED') {
        banner.innerHTML = '<div class="banner banner-closed">🛑 Dükkan şu anda sipariş alımına kapalıdır. Menüyü inceleyebilirsiniz.</div>';
      } else {
        banner.innerHTML = '';
      }

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
        let btn = '<button class="add" onclick="addToCart(' + item.id + ', \\'' + item.name + '\\', ' + item.price + ')">+ Ekle</button>';
        
        if (!item.inStock) {
          btn = '<button class="add disabled" disabled>Tükendi</button>';
        } else if (activeRestaurant.status === 'CLOSED') {
          btn = '<button class="add disabled" disabled>Kapalı</button>';
        }

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
        renderDirectory();
        if (activeRestaurant) {
          activeRestaurant = hubData[activeRestaurant.id];
          openRestaurant(activeRestaurant.id);
        }
      } else if (payload.event === 'STATUS_CHANGE' && payload.data.id == currentTrackingId) {
        const labels = {
          'BEKLIYOR': '⏳ Mutfak Onayı Bekleniyor...',
          'HAZIRLANIYOR': '🔥 Usta Hazırlıyor...',
          'HAZIR': '✅ SİPARİŞİNİZ HAZIR! Gelip Alabilirsiniz.',
          'TAMAMLANDI': '🎉 Teslim Edildi. Afiyet olsun!'
        };
        document.getElementById('trackStatus').innerText = labels[payload.data.status] || payload.data.status;
        if (payload.data.prepTime) {
          document.getElementById('trackPrepTime').innerText = '⏱️ Tahmini Hazırlanma Süresi: ~' + payload.data.prepTime + ' dk';
        }
        if (payload.data.status === 'TAMAMLANDI') {
          localStorage.removeItem('activeOrderId');
        }
      }
    };

    function addToCart(id, name, price) {
      if (activeRestaurant && activeRestaurant.status === 'CLOSED') return;
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
      if (activeRestaurant.status === 'CLOSED') return alert('Dükkan kapalı!');
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
      if (!note) return alert('Lütfen isim ve teslimat yeri girin!');
      
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
      if (!data.success) return alert(data.message || 'Sipariş iletilemedi!');

      currentTrackingId = data.orderId;
      localStorage.setItem('activeOrderId', data.orderId);
      
      document.getElementById('tracker').style.display = 'block';
      document.getElementById('trackOrderId').innerText = '#' + data.orderId;
      document.getElementById('trackRestName').innerText = activeRestaurant.name;
      document.getElementById('trackStatus').innerText = '⏳ Sipariş dükkana iletildi, usta bekliyor...';
      document.getElementById('trackPrepTime').innerText = '';

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
  <title>Mutfak POS Terminali - Kampüs Masası</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #0b0f19; color: #f3f4f6; padding: 1.2rem; }
    
    /* Top Bar */
    .topbar { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1f2937; padding-bottom: 1rem; flex-wrap: wrap; gap: 10px; }
    select.rest-select { background: #1f2937; color: white; border: 1px solid #374151; padding: 10px 14px; border-radius: 8px; font-size: 1rem; font-weight: bold; }
    .btn-sound { background: #10b981; color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; }
    .btn-report { background: #4f46e5; color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; }
    
    /* Shop Master Status Switcher */
    .master-switch-bar { background: #111827; border: 1px solid #1f2937; padding: 1rem; border-radius: 12px; margin-top: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
    .status-btn-group { display: flex; gap: 8px; }
    .status-opt-btn { padding: 8px 14px; border: 2px solid transparent; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 0.85rem; }
    .opt-open { background: #064e3b; color: #34d399; }
    .opt-open.active { border-color: #34d399; box-shadow: 0 0 10px rgba(52, 211, 153, 0.4); }
    .opt-busy { background: #78350f; color: #fbbf24; }
    .opt-busy.active { border-color: #fbbf24; box-shadow: 0 0 10px rgba(251, 191, 36, 0.4); }
    .opt-closed { background: #7f1d1d; color: #f87171; }
    .opt-closed.active { border-color: #f87171; box-shadow: 0 0 10px rgba(248, 113, 113, 0.4); }
    
    /* Stats */
    .stats-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem; }
    .stat-card { background: #111827; padding: 1.2rem; border-radius: 12px; border-left: 5px solid #3b82f6; }
    .stat-card.revenue { border-left-color: #10b981; }
    .stat-card.saved { border-left-color: #f59e0b; }
    .stat-label { font-size: 0.75rem; color: #9ca3af; font-weight: bold; text-transform: uppercase; }
    .stat-value { font-size: 1.7rem; font-weight: bold; margin-top: 4px; display: block; }
    
    /* Stock Control */
    .stock-bar { background: #111827; padding: 1rem; border-radius: 12px; margin-top: 1rem; }
    .stock-grid { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
    .stock-item { background: #1f2937; padding: 6px 12px; border-radius: 6px; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; }
    .stock-toggle { padding: 4px 8px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.75rem; }
    .in-stock { background: #059669; color: white; }
    .out-stock { background: #dc2626; color: white; }
    
    /* Orders Grid */
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 1rem; margin-top: 1.5rem; }
    .order-card { background: #111827; border: 1px solid #1f2937; border-left: 6px solid #f59e0b; border-radius: 12px; padding: 1.2rem; }
    .order-card.hazirlaniyor { border-left-color: #3b82f6; }
    .order-card.hazir { border-left-color: #10b981; }
    .order-card.tamamlandi { opacity: 0.2; }
    
    .prep-timer-row { display: flex; gap: 4px; margin-top: 8px; }
    .prep-timer-row button { background: #1f2937; color: #93c5fd; border: 1px solid #3b82f6; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; cursor: pointer; }
    .prep-timer-row button:hover { background: #3b82f6; color: white; }
    
    .actions { display: flex; gap: 6px; margin-top: 12px; }
    .actions button { flex: 1; padding: 10px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 0.85rem; }
    .btn-ready { background: #10b981; color: white; }
    .btn-done { background: #374151; color: white; }
    .btn-print { background: #4b5563; color: white; width: 42px; flex: none; font-size: 1.1rem; }

    /* Security PIN Modal */
    #pinModal { position: fixed; inset: 0; background: #0b0f19; display: flex; align-items: center; justify-content: center; z-index: 999; }
    .pin-box { background: #111827; border: 1px solid #1f2937; padding: 2rem; border-radius: 16px; width: 320px; text-align: center; }
    .pin-input { width: 100%; font-size: 2rem; letter-spacing: 12px; text-align: center; padding: 10px; background: #1f2937; border: 1px solid #374151; color: white; border-radius: 8px; margin: 16px 0; }
    .pin-btn { background: #2563eb; color: white; border: none; width: 100%; padding: 12px; font-size: 1rem; font-weight: bold; border-radius: 8px; cursor: pointer; }

    /* Thermal Print Styling */
    @media print {
      body * { visibility: hidden; }
      #printArea, #printArea * { visibility: visible; }
      #printArea { position: absolute; left: 0; top: 0; width: 78mm; font-family: monospace; font-size: 12px; color: black; line-height: 1.4; }
    }
  </style>
</head>
<body>
  <!-- PIN Protection Gate -->
  <div id="pinModal">
    <div class="pin-box">
      <h2>🔒 Mutfak Girişi</h2>
      <p style="color:#9ca3af; font-size:0.85rem; margin-top:6px;">Lütfen 4 haneli PIN kodunu girin:</p>
      <input type="password" maxlength="4" id="pinInput" class="pin-input" placeholder="••••">
      <button class="pin-btn" onclick="submitPin()">Giriş Yap</button>
      <p id="pinError" style="color:#ef4444; font-size:0.85rem; margin-top:8px; display:none;"></p>
    </div>
  </div>

  <div id="mainDashboard" style="display:none;">
    <div class="topbar">
      <div style="display:flex; align-items:center; gap:10px;">
        <h2>🍳 Mutfak POS:</h2>
        <select class="rest-select" id="restaurantSelector" onchange="switchRestaurant(this.value)"></select>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn-sound" id="audioToggle" onclick="initAudio()">🔔 Sesi Aç</button>
        <button class="btn-report" onclick="downloadZReport()">📊 Z-Raporu İndir (.CSV)</button>
      </div>
    </div>

    <!-- Master Shop State Switcher -->
    <div class="master-switch-bar">
      <div>
        <h4>🏪 Dükkan Sipariş Durumu:</h4>
        <small style="color:#9ca3af;">Öğrenci uygulamasındaki sipariş alımını yönetin</small>
      </div>
      <div class="status-btn-group">
        <button class="status-opt-btn opt-open" id="btnStatusOpen" onclick="setShopStatus('OPEN')">🟢 Açık</button>
        <button class="status-opt-btn opt-busy" id="btnStatusBusy" onclick="setShopStatus('BUSY')">🟡 Yoğun (+20dk)</button>
        <button class="status-opt-btn opt-closed" id="btnStatusClosed" onclick="setShopStatus('CLOSED')">🔴 Kapalı</button>
      </div>
    </div>

    <!-- Revenue & Savings Metrics -->
    <div class="stats-bar">
      <div class="stat-card revenue">
        <span class="stat-label">💰 Bugünkü Ciro</span>
        <span class="stat-value" id="statRevenue" style="color:#10b981;">0 ₺</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">📦 Toplam Sipariş</span>
        <span class="stat-value" id="statCount">0 Adet</span>
      </div>
      <div class="stat-card saved">
        <span class="stat-label">🛡️ Kurtarılan Komisyon (%30)</span>
        <span class="stat-value" id="statSaved" style="color:#f59e0b;">+0 ₺</span>
      </div>
    </div>

    <!-- Stock Control -->
    <div class="stock-bar">
      <h4>🍲 Hızlı Menü Stok Kontrolü:</h4>
      <div class="stock-grid" id="stockContainer"></div>
    </div>

    <!-- Active Orders Grid -->
    <div class="grid" id="ordersGrid"></div>
  </div>

  <!-- Hidden 80mm POS Receipt Print Container -->
  <div id="printArea" style="display:none;"></div>

  <script>
    let audioCtx = null;
    let hubData = {};
    let currentRestId = "donerci";
    let authed = false;

    async function initKitchen() {
      const res = await fetch('/api/hub');
      hubData = await res.json();
      
      const sel = document.getElementById('restaurantSelector');
      sel.innerHTML = Object.values(hubData).map(function(r) {
        return '<option value="' + r.id + '">' + r.icon + ' ' + r.name + '</option>';
      }).join('');
    }
    initKitchen();

    async function submitPin() {
      const pin = document.getElementById('pinInput').value;
      const res = await fetch('/api/kitchen/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId: currentRestId, pin: pin })
      });
      const data = await res.json();
      if (data.success) {
        document.getElementById('pinModal').style.display = 'none';
        document.getElementById('mainDashboard').style.display = 'block';
        authed = true;
        loadRestaurantDashboard();
      } else {
        const err = document.getElementById('pinError');
        err.innerText = data.message;
        err.style.display = 'block';
      }
    }

    function switchRestaurant(newId) {
      currentRestId = newId;
      document.getElementById('pinModal').style.display = 'flex';
      document.getElementById('mainDashboard').style.display = 'none';
      document.getElementById('pinInput').value = '';
      document.getElementById('pinError').style.display = 'none';
    }

    async function setShopStatus(status) {
      await fetch('/api/restaurant/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId: currentRestId, status: status })
      });
      updateShopStatusUI(status);
    }

    function updateShopStatusUI(status) {
      document.getElementById('btnStatusOpen').className = 'status-opt-btn opt-open' + (status === 'OPEN' ? ' active' : '');
      document.getElementById('btnStatusBusy').className = 'status-opt-btn opt-busy' + (status === 'BUSY' ? ' active' : '');
      document.getElementById('btnStatusClosed').className = 'status-opt-btn opt-closed' + (status === 'CLOSED' ? ' active' : '');
    }

    async function loadRestaurantDashboard() {
      document.getElementById('ordersGrid').innerHTML = '';
      const rest = hubData[currentRestId];
      if (rest) {
        updateShopStatusUI(rest.status || 'OPEN');
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

    const evtSource = new EventSource('/api/stream');
    evtSource.onmessage = function(event) {
      const msg = JSON.parse(event.data);
      if (msg.event === 'NEW_ORDER') {
        if (msg.data.restaurantId === currentRestId && authed) {
          playChime();
          renderCard(msg.data);
          refreshStats();
        }
      } else if (msg.event === 'STATUS_CHANGE') {
        if (msg.data.restaurantId === currentRestId && authed) {
          updateCardUI(msg.data.id, msg.data.status, msg.data.prepTime);
          refreshStats();
        }
      } else if (msg.event === 'HUB_UPDATE') {
        hubData = msg.data;
        if (authed) loadRestaurantDashboard();
      }
    };

    function renderCard(order) {
      if (document.getElementById('order-' + order.id)) return;
      const card = document.createElement('div');
      card.id = 'order-' + order.id;
      card.className = 'order-card ' + order.status.toLowerCase();
      const itemsList = order.items.map(function(i) { return '<li>' + i.name + ' (' + i.price + ' TL)</li>'; }).join('');
      
      const prepBadge = order.prepTime ? '<span style="color:#60a5fa; font-size:0.8rem; font-weight:bold;">⏱️ ~' + order.prepTime + ' dk</span>' : '';

      card.innerHTML =
        '<div style="display:flex; justify-content:space-between; align-items:center;">' +
          '<h3>#' + order.id + '</h3>' +
          '<div>' + prepBadge + ' <span style="background:#1f2937; padding:2px 6px; border-radius:4px; font-size:0.75rem;">' + order.time + '</span></div>' +
        '</div>' +
        '<p style="margin:8px 0 4px; font-size:1.05rem;"><strong>' + order.customer + '</strong></p>' +
        '<p style="color:#9ca3af; font-size:0.8rem;">' + order.type + ' | ' + order.payment + '</p>' +
        '<ul style="margin:8px 0 8px 18px; font-size:0.95rem;">' + itemsList + '</ul>' +
        '<h2 style="color:#10b981; margin-bottom:8px;">' + order.total + ' ₺</h2>' +
        
        '<div style="margin-top:6px;">' +
          '<small style="color:#9ca3af; font-size:0.75rem;">Hazırlık Süresi Belirle:</small>' +
          '<div class="prep-timer-row">' +
            '<button onclick="setOrderPrep(' + order.id + ', 10)">⚡ 10 dk</button>' +
            '<button onclick="setOrderPrep(' + order.id + ', 20)">🔥 20 dk</button>' +
            '<button onclick="setOrderPrep(' + order.id + ', 35)">⏳ 35 dk</button>' +
          '</div>' +
        '</div>' +

        '<div class="actions">' +
          '<button class="btn-ready" onclick="setStatus(' + order.id + ', \\'HAZIR\\')">✅ Hazır</button>' +
          '<button class="btn-done" onclick="setStatus(' + order.id + ', \\'TAMAMLANDI\\')">📦 Bitti</button>' +
          '<button class="btn-print" onclick="printReceipt(' + order.id + ')" title="Fiş Yazdır">🖨️</button>' +
        '</div>';
      document.getElementById('ordersGrid').prepend(card);
    }

    async function setOrderPrep(orderId, minutes) {
      await fetch('/api/order/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderId, status: 'HAZIRLANIYOR', prepTime: minutes })
      });
    }

    async function setStatus(orderId, status) {
      await fetch('/api/order/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderId, status: status })
      });
    }

    function updateCardUI(id, status, prepTime) {
      const card = document.getElementById('order-' + id);
      if (!card) return;
      card.className = 'order-card ' + status.toLowerCase();
      if (status === 'TAMAMLANDI') setTimeout(function() { card.remove(); }, 1000);
    }

    function printReceipt(orderId) {
      const card = document.getElementById('order-' + orderId);
      if (!card) return;
      const rest = hubData[currentRestId];
      const printArea = document.getElementById('printArea');
      printArea.style.display = 'block';
      printArea.innerHTML =
        '<div style="text-align:center; border-bottom:1px dashed #000; padding-bottom:6px; margin-bottom:6px;">' +
          '<h3>' + rest.name + '</h3>' +
          '<small>KAMPUS MASASI FISI</small><br>' +
          '<small>' + new Date().toLocaleString('tr-TR') + '</small>' +
        '</div>' +
        '<p><strong>SIPARIS #' + orderId + '</strong></p>' +
        card.innerHTML +
        '<div style="text-align:center; border-top:1px dashed #000; margin-top:10px; padding-top:6px;">' +
          '<small>Afiyet Olsun!</small>' +
        '</div>';
      window.print();
      printArea.style.display = 'none';
    }

    function downloadZReport() {
      window.location.href = '/api/z-report?restaurantId=' + currentRestId;
    }
  </script>
</body>
</html>`;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Industrial Kitchen POS Engine live on port ${PORT}!`);
});
