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
    status: "OPEN",
    desc: "Hatay usulü özel soslu tavuk ve et dürüm",
    iban: "TR330006100519876543210001",
    accountName: "Ahmet Usta - Döner",
    menu: [
      {
        id: 1,
        name: "Tavuk Döner Dürüm",
        price: 120,
        desc: "Soslu, patatesli, turşulu",
        inStock: true,
        options: [
          {
            name: "Porsiyon Seçimi",
            type: "radio",
            required: true,
            choices: [
              { name: "Standart Dürüm", price: 0 },
              { name: "1.5 Porsiyon (+50g Tavuk)", price: 35 }
            ]
          },
          {
            name: "Malzeme & Sos Tercihi",
            type: "checkbox",
            choices: [
              { name: "Soğansız", price: 0 },
              { name: "Bol Soslu", price: 0 },
              { name: "Turşusuz", price: 0 },
              { name: "Ekstra Kaşar", price: 25 },
              { name: "Ekstra Patates", price: 15 }
            ]
          }
        ]
      },
      {
        id: 2,
        name: "Et Döner Dürüm",
        price: 190,
        desc: "Özel tereyağlı lavaş",
        inStock: true,
        options: [
          {
            name: "Porsiyon Seçimi",
            type: "radio",
            required: true,
            choices: [
              { name: "Standart Dürüm", price: 0 },
              { name: "1.5 Porsiyon (+50g Et)", price: 60 }
            ]
          },
          {
            name: "Malzeme Tercihi",
            type: "checkbox",
            choices: [
              { name: "Soğansız", price: 0 },
              { name: "Ekstra Tereyağlı Lavaş", price: 20 },
              { name: "Ekstra Kaşar", price: 25 }
            ]
          }
        ]
      },
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
    iban: "TR550001200987654321000002",
    accountName: "Mehmet Abi - Tost",
    menu: [
      {
        id: 101,
        name: "Karışık Bazlama Tost",
        price: 95,
        desc: "Sucuk, kaşar, salça, tereyağı",
        inStock: true,
        options: [
          {
            name: "Sos & Malzeme",
            type: "checkbox",
            choices: [
              { name: "Salçasız", price: 0 },
              { name: "Acı Soslu", price: 0 },
              { name: "Ekstra Kaşar", price: 20 },
              { name: "Ekstra Sucuk", price: 25 }
            ]
          }
        ]
      },
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
    iban: "TR660003400123456789000003",
    accountName: "Ali Usta - Pilav",
    menu: [
      {
        id: 201,
        name: "Tavuklu Nohutlu Pilav (1.5 Porsiyon)",
        price: 110,
        desc: "Bol didik tavuk ve tereyağlı pilav",
        inStock: true,
        options: [
          {
            name: "Porsiyon Seçimi",
            type: "radio",
            required: true,
            choices: [
              { name: "Standart Porsiyon", price: 0 },
              { name: "Duble Tavuk (+50g)", price: 35 }
            ]
          },
          {
            name: "Tercihler",
            type: "checkbox",
            choices: [
              { name: "Karabibersiz", price: 0 },
              { name: "Ekstra Nohut", price: 10 },
              { name: "Ketçap & Mayonez İstiyorum", price: 0 }
            ]
          }
        ]
      },
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

function parseJsonBody(req, res, callback) {
  let body = '';
  const MAX_SIZE = 1024 * 1024;
  req.on('data', chunk => {
    body += chunk;
    if (body.length > MAX_SIZE) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Payload too large' }));
      req.destroy();
    }
  });
  req.on('end', () => {
    try {
      const data = body ? JSON.parse(body) : {};
      callback(data);
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Geçersiz JSON verisi!' }));
    }
  });
}

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
    parseJsonBody(req, res, (data) => {
      const restaurantId = data.restaurantId || 'donerci';
      const pin = String(data.pin || '').trim();
      const rest = hub[restaurantId];

      if (rest && String(rest.pin).trim() === pin) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Hatalı PIN Kodu!' }));
      }
    });
    return;
  }

  // 4. API: Change Restaurant Operating Status
  if (pathname === '/api/kitchen/store-status' && req.method === 'POST') {
    parseJsonBody(req, res, ({ restaurantId, status }) => {
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

  // 7. API: Download Z-Raporu (.CSV)
  if (pathname === '/api/kitchen/z-raporu' && req.method === 'GET') {
    const restId = parsedUrl.query.restaurantId;
    const rest = hub[restId] || { name: "Restoran" };
    const restOrders = orders.filter(o => o.restaurantId === restId);

    let csv = '\uFEFF';
    csv += 'Sipariş No;Tarih;Saat;Müşteri;Teslimat;Ödeme;Ürünler;Tutar (TL)\n';
    
    restOrders.forEach(o => {
      const safeCustomer = String(o.customer || '').replace(/^([=+\-@\t\r])/, "'$1").replace(/"/g, '""');
      const itemsSummary = o.items.map(i => `${i.name} (${i.price} TL)`).join(', ').replace(/"/g, '""');
      csv += `"${o.id}";"${o.date}";"${o.time}";"${safeCustomer}";"${o.type}";"${o.payment}";"${itemsSummary}";"${o.total}"\n`;
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
    parseJsonBody(req, res, ({ restaurantId, itemId }) => {
      const rest = hub[restaurantId];
      if (rest) {
        const item = rest.menu.find(i => String(i.id) === String(itemId));
        if (item) {
          item.inStock = item.inStock === false ? true : false;
          saveHub(hub);
          broadcast({ event: 'HUB_UPDATE', data: hub });
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, hub }));
    });
    return;
  }

  // 9. API: Place Order (With Robust Stock & ID Fallback)
  if (pathname === '/api/order' && req.method === 'POST') {
    parseJsonBody(req, res, (order) => {
      const rest = hub[order.restaurantId];
      if (!rest || rest.status === 'CLOSED') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Dükkan şu anda kapalıdır.' }));
      }

      const verifiedItems = [];
      let calculatedTotal = 0;

      for (const clientItem of (order.items || [])) {
        // Robust ID lookup (matches both number and string IDs) & inStock !== false
        const menuItem = rest.menu.find(m => String(m.id) === String(clientItem.id) && m.inStock !== false);
        if (!menuItem) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Stokta bulunmayan veya geçersiz ürün tespit edildi.' }));
        }

        let itemPrice = menuItem.price;
        const verifiedOptions = [];

        if (menuItem.options && Array.isArray(menuItem.options)) {
          const clientSelected = clientItem.selectedOptions || [];
          for (const group of menuItem.options) {
            for (const choice of group.choices) {
              const isSelected = clientSelected.some(cs => cs.name === choice.name);
              if (isSelected) {
                itemPrice += (choice.price || 0);
                verifiedOptions.push({
                  group: group.name,
                  name: choice.name,
                  price: choice.price || 0
                });
              }
            }
          }
        }

        calculatedTotal += itemPrice;
        verifiedItems.push({
          id: menuItem.id,
          name: menuItem.name,
          basePrice: menuItem.price,
          price: itemPrice,
          selectedOptions: verifiedOptions,
          itemNote: typeof clientItem.itemNote === 'string' ? clientItem.itemNote.slice(0, 150) : ''
        });
      }

      if (verifiedItems.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Sepetiniz boş!' }));
      }

      order.id = Math.floor(1000 + Math.random() * 9000);
      order.items = verifiedItems;
      order.total = calculatedTotal;
      order.status = 'BEKLIYOR';
      order.prepMinutes = 15;
      order.readyAt = null;
      order.date = new Date().toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
      order.time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });

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
    parseJsonBody(req, res, ({ orderId, status, prepMinutes }) => {
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

  // 11. API: Save / Update Menu Item
  if (pathname === '/api/kitchen/menu/item' && req.method === 'POST') {
    parseJsonBody(req, res, ({ restaurantId, item }) => {
      const rest = hub[restaurantId];
      if (!rest) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Dükkan bulunamadı' }));
      }

      if (!item.name || isNaN(item.price)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Ürün adı ve fiyatı zorunludur' }));
      }

      item.price = parseFloat(item.price);
      item.inStock = true; // Always ensure inStock is true when saved/created

      if (!item.id) {
        item.id = Date.now();
        rest.menu.push(item);
      } else {
        const idx = rest.menu.findIndex(m => String(m.id) === String(item.id));
        if (idx !== -1) {
          rest.menu[idx] = { ...rest.menu[idx], ...item, inStock: true };
        } else {
          rest.menu.push(item);
        }
      }

      saveHub(hub);
      broadcast({ event: 'HUB_UPDATE', data: hub });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, hub }));
    });
    return;
  }

  // 12. API: Delete Menu Item
  if (pathname === '/api/kitchen/menu/item/delete' && req.method === 'POST') {
    parseJsonBody(req, res, ({ restaurantId, itemId }) => {
      const rest = hub[restaurantId];
      if (rest) {
        rest.menu = rest.menu.filter(m => String(m.id) !== String(itemId));
        saveHub(hub);
        broadcast({ event: 'HUB_UPDATE', data: hub });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, hub }));
    });
    return;
  }

  // 13. API: Update Restaurant Settings
  if (pathname === '/api/kitchen/settings' && req.method === 'POST') {
    parseJsonBody(req, res, ({ restaurantId, desc, iban, accountName }) => {
      const rest = hub[restaurantId];
      if (rest) {
        if (desc !== undefined) rest.desc = desc;
        if (iban !== undefined) rest.iban = iban.replace(/\s+/g, '').toUpperCase();
        if (accountName !== undefined) rest.accountName = accountName;
        saveHub(hub);
        broadcast({ event: 'HUB_UPDATE', data: hub });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, hub }));
    });
    return;
  }

  // 14. Kitchen POS Screen
  if (pathname === '/kitchen') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getKitchenHTML());
    return;
  }

  // 15. Student App (Default Route)
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(getStudentHubHTML());
});

function broadcast(payload) {
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  clients = clients.filter(c => {
    try {
      if (c.writable) {
        c.write(msg);
        return true;
      }
    } catch (err) {}
    return false;
  });
}

function getStudentHubHTML() {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kampüs Masası</title>
  <!-- Pure JS QR Code Generator -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #f1f5f9; color: #0f172a; padding-bottom: 110px; }
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

    .cart-bar { position: fixed; bottom: 0; left: 0; right: 0; background: white; padding: 1rem; border-top: 1px solid #e2e8f0; z-index: 30; }
    .cart-btn { background: #059669; color: white; width: 100%; max-width: 500px; margin: auto; border: none; padding: 14px; border-radius: 10px; font-size: 1rem; font-weight: bold; cursor: pointer; display: flex; justify-content: space-between; }
    
    /* Modals */
    .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); align-items: center; justify-content: center; padding: 1rem; z-index: 50; }
    .modal-content { background: white; border-radius: 16px; max-width: 450px; width: 100%; padding: 1.5rem; max-height: 90vh; overflow-y: auto; }
    input, select, textarea { width: 100%; padding: 10px; margin: 6px 0 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem; }

    /* TR-Karekod Box */
    .qr-container { background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; padding: 14px; text-align: center; margin-bottom: 12px; }
    .qr-header { display: flex; align-items: center; justify-content: center; gap: 8px; color: #0284c7; font-weight: bold; font-size: 0.9rem; margin-bottom: 8px; }
    #qrCodeBox { display: flex; justify-content: center; margin: 10px auto; background: white; padding: 10px; border-radius: 10px; border: 1px solid #cbd5e1; width: 180px; height: 180px; }
    .copy-btn { background: #f1f5f9; border: 1px solid #cbd5e1; color: #334155; padding: 6px 12px; border-radius: 6px; font-size: 0.8rem; font-weight: bold; cursor: pointer; margin-top: 6px; }

    /* Customizer Option Groups */
    .opt-group { margin-bottom: 14px; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; }
    .opt-title { font-size: 0.9rem; font-weight: bold; color: #334155; margin-bottom: 6px; }
    .opt-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 0.9rem; cursor: pointer; }
    .opt-row input { width: auto; margin: 0 8px 0 0; cursor: pointer; }
    
    /* Cart Breakdown List */
    .cart-item-row { border-bottom: 1px solid #f1f5f9; padding: 8px 0; font-size: 0.9rem; }
    .cart-item-mods { font-size: 0.78rem; color: #64748b; margin-top: 2px; }
    
    /* Tracker */
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

  <!-- Cart Bottom Bar -->
  <div class="cart-bar" id="cartBar" style="display:none;">
    <button class="cart-btn" id="checkoutBtn" onclick="openCheckout()">
      <span id="cartCount">0 Ürün</span>
      <span>Siparişi Onayla (<span id="cartTotal">0</span> ₺)</span>
    </button>
  </div>

  <!-- Modal 1: Item Customizer (Modifiers) -->
  <div class="modal-overlay" id="customizerModal">
    <div class="modal-content">
      <h3 id="customizerTitle" style="color:#0f172a;">Ürünü Özelleştir</h3>
      <p id="customizerDesc" style="color:#64748b; font-size:0.85rem; margin-bottom:12px;"></p>
      <div id="customizerOptions"></div>
      
      <label style="font-size:0.85rem; font-weight:bold; color:#334155;">Ürün Notu (İsteğe Bağlı):</label>
      <input type="text" id="customizerItemNote" placeholder="Örn: Acı sosu fazla olsun...">

      <button class="cart-btn" style="background:#2563eb; width:100%; justify-content:center;" onclick="confirmAddToCart()">
        <span id="customizerAddBtnText">Sepete Ekle</span>
      </button>
      <button style="width:100%; border:none; background:none; color:#64748b; margin-top:10px; cursor:pointer;" onclick="closeCustomizer()">Kapat</button>
    </div>
  </div>

  <!-- Modal 2: Final Checkout & TR-Karekod -->
  <div class="modal-overlay" id="checkoutModal">
    <div class="modal-content">
      <h3 id="modalRestTitle" style="color:#0f172a; margin-bottom:10px;">Siparişi Onayla</h3>
      
      <div style="margin-bottom:12px; max-height:110px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px; padding:8px;" id="checkoutSummaryList"></div>

      <label style="font-size:0.85rem; font-weight:bold;">Ödeme Şekli:</label>
      <select id="paymentType" onchange="togglePaymentUI()">
        <option value="FAST / Havale">⚡ FAST / TR-Karekod İle Öde</option>
        <option value="Kapıda Nakit/POS">💵 Teslimde Nakit / Kart</option>
      </select>

      <!-- Dynamic TR-Karekod Container -->
      <div class="qr-container" id="qrContainer">
        <div class="qr-header">
          <span>⚡ TR-Karekod (FAST Otomatik Ödeme)</span>
        </div>
        <p style="font-size:0.75rem; color:#64748b;">Banka uygulamanızdan <strong>"Karekod ile Öde"</strong> seçip okutun:</p>
        
        <div id="qrCodeBox"></div>
        
        <div style="display:flex; justify-content:center; gap:8px; flex-wrap:wrap;">
          <button class="copy-btn" id="btnCopyIban" onclick="copyIban()">📋 IBAN'ı Kopyala</button>
          <button class="copy-btn" id="btnCopyAmount" onclick="copyAmount()">💰 Tutarı Kopyala</button>
        </div>
        <p style="font-size:0.72rem; color:#94a3b8; margin-top:6px;">Alıcı: <span id="qrAccountName" style="font-weight:bold; color:#334155;"></span></p>
      </div>

      <label style="font-size:0.85rem; font-weight:bold;">İsim / Oda / Tel:</label>
      <input type="text" id="custName" placeholder="Örn: Ali - KYK 3. Blok No:402">
      
      <label style="font-size:0.85rem; font-weight:bold;">Teslimat Türü:</label>
      <select id="orderType">
        <option value="Gel-Al">Gel-Al (Dükkandan Teslim)</option>
        <option value="Kampüs Kapısı">Kampüs / Yurt Kapısı</option>
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
    let pendingItem = null;

    function esc(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Convert Turkish characters to ASCII so bank QR parsers don't fail byte-length checks
    function toAscii(str) {
      if (!str) return 'ISYERI';
      return str
        .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
        .replace(/ü/g, 'u').replace(/Ü/g, 'U')
        .replace(/ş/g, 's').replace(/Ş/g, 'S')
        .replace(/ı/g, 'i').replace(/İ/g, 'I')
        .replace(/ö/g, 'o').replace(/Ö/g, 'O')
        .replace(/ç/g, 'c').replace(/Ç/g, 'C')
        .toUpperCase();
    }

    function formatTLV(tag, val) {
      const len = String(val.length).padStart(2, '0');
      return tag + len + val;
    }

    function calculateCRC16(str) {
      let crc = 0xFFFF;
      for (let c = 0; c < str.length; c++) {
        crc ^= str.charCodeAt(c) << 8;
        for (let i = 0; i < 8; i++) {
          if ((crc & 0x8000) !== 0) {
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
          } else {
            crc = (crc << 1) & 0xFFFF;
          }
        }
      }
      return crc.toString(16).toUpperCase().padStart(4, '0');
    }

    function generateTRKarekodPayload(iban, merchantName, amount, orderRef) {
      const cleanIban = String(iban || '').replace(/\\s+/g, '').toUpperCase();
      const cleanName = toAscii(merchantName).slice(0, 25);
      const amountStr = Number(amount).toFixed(2);
      const ref = String(orderRef || 'KAMPUS').slice(0, 20);

      // Tag 30: FAST Account Info (TCMB / BKM Standard)
      const sub30_00 = formatTLV("00", "TR.BKM.FAST");
      const sub30_01 = formatTLV("01", cleanIban);
      const tag30 = formatTLV("30", sub30_00 + sub30_01);

      // Tag 62: Additional Data (Order Reference)
      const sub62_05 = formatTLV("05", ref);
      const tag62 = formatTLV("62", sub62_05);

      let payload = "";
      payload += formatTLV("00", "01");              // Payload Format
      payload += formatTLV("01", "12");              // Dynamic QR
      payload += tag30;                              // FAST Info
      payload += formatTLV("52", "5812");            // Food/Restaurant Category
      payload += formatTLV("53", "949");             // TRY
      payload += formatTLV("54", amountStr);         // Amount
      payload += formatTLV("58", "TR");              // Country
      payload += formatTLV("59", cleanName);         // ASCII Name
      payload += formatTLV("60", "KAMPUS");          // City
      payload += tag62;                              // Reference Info

      payload += "6304";
      const crc = calculateCRC16(payload);
      return payload + crc;
    }

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
              '<h3>' + esc(r.name) + '</h3>' +
              '<p style="color:#64748b; font-size:0.85rem; margin-top:2px;">' + esc(r.desc) + '</p>' +
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
          '<div><h2>' + esc(activeRestaurant.name) + '</h2><p style="color:#64748b; font-size:0.85rem;">' + esc(activeRestaurant.desc) + '</p></div>' +
        '</div>';

      const banner = document.getElementById('storeAlertBanner');
      banner.innerHTML = '';
      if (activeRestaurant.status === 'BUSY') {
        banner.innerHTML = '<div class="banner-warning">⚠️ Dükkan şu an çok yoğun. Hazırlık süresi uzayabilir.</div>';
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
        // Item is available if inStock is not explicitly false
        const canAdd = (item.inStock !== false) && !isClosed;
        const stockClass = canAdd ? '' : 'out-of-stock';
        let btn = '<button class="add" onclick="handleItemClick(\\'' + item.id + '\\')">+ Ekle</button>';
        
        if (item.inStock === false) btn = '<button class="add disabled" disabled>Tükendi</button>';
        if (isClosed) btn = '<button class="add disabled" disabled>Kapalı</button>';

        return '<div class="card ' + stockClass + '">' +
          '<div><h3>' + esc(item.name) + (item.inStock === false ? ' <span style="color:#ef4444; font-size:0.8rem;">(Tükendi)</span>' : '') + '</h3>' +
          '<p style="color:#64748b; font-size:0.85rem;">' + esc(item.desc) + '</p>' +
          '<div class="price">' + item.price + ' ₺</div></div>' +
          btn + '</div>';
      }).join('');
    }

    function handleItemClick(itemId) {
      const item = activeRestaurant.menu.find(i => String(i.id) === String(itemId));
      if (!item) return;

      if (item.options && item.options.length > 0) {
        pendingItem = item;
        document.getElementById('customizerTitle').innerText = item.name;
        document.getElementById('customizerDesc').innerText = item.desc;
        document.getElementById('customizerItemNote').value = '';
        
        let optHtml = '';
        item.options.forEach((group, gIdx) => {
          optHtml += '<div class="opt-group"><div class="opt-title">' + esc(group.name) + '</div>';
          group.choices.forEach((choice, cIdx) => {
            const inputType = group.type === 'radio' ? 'radio' : 'checkbox';
            const inputName = 'opt_group_' + gIdx;
            const isChecked = (group.type === 'radio' && cIdx === 0) ? 'checked' : '';
            const priceTag = choice.price > 0 ? '(+' + choice.price + ' ₺)' : '';
            
            optHtml += '<label class="opt-row">' +
              '<span><input type="' + inputType + '" name="' + inputName + '" value="' + cIdx + '" data-group="' + esc(group.name) + '" data-name="' + esc(choice.name) + '" data-price="' + choice.price + '" ' + isChecked + ' onchange="updateCustomizerPrice()"> ' + esc(choice.name) + '</span>' +
              '<span style="color:#059669; font-weight:bold;">' + priceTag + '</span>' +
            '</label>';
          });
          optHtml += '</div>';
        });

        document.getElementById('customizerOptions').innerHTML = optHtml;
        updateCustomizerPrice();
        document.getElementById('customizerModal').style.display = 'flex';
      } else {
        cart.push({
          id: item.id,
          name: item.name,
          basePrice: item.price,
          price: item.price,
          selectedOptions: [],
          itemNote: ''
        });
        updateCartUI();
      }
    }

    function updateCustomizerPrice() {
      if (!pendingItem) return;
      let total = pendingItem.price;
      const inputs = document.querySelectorAll('#customizerOptions input:checked');
      inputs.forEach(inp => {
        total += parseFloat(inp.getAttribute('data-price') || 0);
      });
      document.getElementById('customizerAddBtnText').innerText = 'Sepete Ekle • ' + total + ' ₺';
    }

    function confirmAddToCart() {
      if (!pendingItem) return;
      const selectedOptions = [];
      let finalPrice = pendingItem.price;
      
      const checkedInputs = document.querySelectorAll('#customizerOptions input:checked');
      checkedInputs.forEach(inp => {
        const p = parseFloat(inp.getAttribute('data-price') || 0);
        finalPrice += p;
        selectedOptions.push({
          group: inp.getAttribute('data-group'),
          name: inp.getAttribute('data-name'),
          price: p
        });
      });

      cart.push({
        id: pendingItem.id,
        name: pendingItem.name,
        basePrice: pendingItem.price,
        price: finalPrice,
        selectedOptions: selectedOptions,
        itemNote: document.getElementById('customizerItemNote').value.trim()
      });

      closeCustomizer();
      updateCartUI();
    }

    function closeCustomizer() {
      pendingItem = null;
      document.getElementById('customizerModal').style.display = 'none';
    }

    function updateCartUI() {
      const bar = document.getElementById('cartBar');
      if (cart.length > 0 && activeRestaurant && activeRestaurant.status !== 'CLOSED') {
        bar.style.display = 'block';
        document.getElementById('cartCount').innerText = cart.length + ' Ürün';
        const sum = cart.reduce((s, i) => s + i.price, 0);
        document.getElementById('cartTotal').innerText = sum;
      } else {
        bar.style.display = 'none';
      }
    }

    function openCheckout() {
      document.getElementById('modalRestTitle').innerText = activeRestaurant.name;
      document.getElementById('qrAccountName').innerText = activeRestaurant.accountName || activeRestaurant.name;

      const totalAmount = cart.reduce((s, i) => s + i.price, 0);

      document.getElementById('checkoutSummaryList').innerHTML = cart.map(i => {
        const modText = i.selectedOptions.map(o => o.name + (o.price > 0 ? ' (+' + o.price + '₺)' : '')).join(', ');
        const noteText = i.itemNote ? ' | Not: ' + esc(i.itemNote) : '';
        return '<div class="cart-item-row">' +
          '<div style="display:flex; justify-content:space-between;"><strong>' + esc(i.name) + '</strong><span>' + i.price + ' ₺</span></div>' +
          '<div class="cart-item-mods">' + (modText || 'Standart') + noteText + '</div>' +
        '</div>';
      }).join('');

      renderTRKarekod(totalAmount);
      togglePaymentUI();
      document.getElementById('checkoutModal').style.display = 'flex';
    }

    function renderTRKarekod(amount) {
      const payload = generateTRKarekodPayload(
        activeRestaurant.iban,
        activeRestaurant.accountName || activeRestaurant.name,
        amount,
        'SIP-' + Math.floor(1000 + Math.random() * 9000)
      );

      const qrBox = document.getElementById('qrCodeBox');
      qrBox.innerHTML = '';
      new QRCode(qrBox, {
        text: payload,
        width: 160,
        height: 160,
        colorDark: "#0f172a",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    }

    function togglePaymentUI() {
      const payType = document.getElementById('paymentType').value;
      document.getElementById('qrContainer').style.display = payType.includes('FAST') ? 'block' : 'none';
    }

    function copyIban() {
      if (!activeRestaurant) return;
      navigator.clipboard.writeText(activeRestaurant.iban.replace(/\\s+/g, ''));
      const btn = document.getElementById('btnCopyIban');
      btn.innerText = 'Kopyalandı! ✅';
      setTimeout(() => btn.innerText = '📋 IBAN\\'ı Kopyala', 2000);
    }

    function copyAmount() {
      const total = cart.reduce((s, i) => s + i.price, 0);
      navigator.clipboard.writeText(total);
      const btn = document.getElementById('btnCopyAmount');
      btn.innerText = total + ' ₺ Kopyalandı! ✅';
      setTimeout(() => btn.innerText = '💰 Tutarı Kopyala', 2000);
    }

    function closeCheckout() { document.getElementById('checkoutModal').style.display = 'none'; }

    async function submitOrder() {
      const note = document.getElementById('custName').value.trim();
      if (!note) return alert('Lütfen isim ve oda/telefon bilgilerinizi girin!');
      
      const payload = {
        restaurantId: activeRestaurant.id,
        restaurantName: activeRestaurant.name,
        items: cart,
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
  <title>Mutfak POS & Menü Yönetimi</title>
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

    .menu-btn { background: #8b5cf6; color: white; border: none; padding: 10px 14px; border-radius: 8px; font-weight: bold; cursor: pointer; }
    .sound-btn { background: #2563eb; color: white; border: none; padding: 10px 14px; border-radius: 8px; font-weight: bold; cursor: pointer; }
    .z-btn { background: #059669; color: white; border: none; padding: 10px 14px; border-radius: 8px; font-weight: bold; cursor: pointer; }
    
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

    /* Modals */
    .modal-backdrop { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); align-items: center; justify-content: center; z-index: 100; padding: 1rem; }
    .modal-box { background: #1e293b; border-radius: 14px; max-width: 580px; width: 100%; padding: 1.5rem; max-height: 90vh; overflow-y: auto; border: 1px solid #334155; }
    
    /* Menu Item Rows */
    .menu-mgmt-row { background: #0f172a; border: 1px solid #334155; padding: 12px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
    .btn-edit { background: #3b82f6; color: white; padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: bold; margin-right: 6px; }
    .btn-del { background: #ef4444; color: white; padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: bold; }
    
    input[type="text"], input[type="number"], textarea { width: 100%; padding: 10px; margin: 6px 0 12px; background: #0f172a; border: 1px solid #475569; color: white; border-radius: 8px; font-size: 0.95rem; }
    .btn-action { background: #10b981; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; width: 100%; }

    /* Auth PIN Modal */
    #authModal { position: fixed; inset: 0; background: #090d16; display: flex; align-items: center; justify-content: center; z-index: 200; }
    .auth-box { background: #1e293b; padding: 2rem; border-radius: 14px; text-align: center; max-width: 320px; width: 100%; border: 1px solid #334155; }
    .pin-input { font-size: 2rem; letter-spacing: 12px; text-align: center; width: 160px; padding: 8px; margin: 16px auto; background: #0f172a; border: 1px solid #475569; color: white; border-radius: 8px; display: block; }
    
    @media print {
      body * { visibility: hidden; }
      .print-area, .print-area * { visibility: visible; }
      .print-area { position: absolute; left: 0; top: 0; width: 80mm; font-family: monospace; color: black !important; padding: 10px; }
    }
  </style>
</head>
<body>
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
      
      <div class="status-group">
        <button class="status-btn" id="btnOpen" onclick="setStoreStatus('OPEN')">🟢 Açık</button>
        <button class="status-btn" id="btnBusy" onclick="setStoreStatus('BUSY')">🟡 Yoğun</button>
        <button class="status-btn" id="btnClosed" onclick="setStoreStatus('CLOSED')">🔴 Kapalı</button>
      </div>
    </div>

    <div style="display:flex; gap:8px; flex-wrap:wrap;">
      <button class="menu-btn" onclick="openMenuModal()">📋 Menüyü & IBAN Düzenle</button>
      <button class="z-btn" onclick="downloadZReport()">📊 Z-Raporu (.CSV)</button>
      <button class="sound-btn" id="audioToggle" onclick="initAudio()">🔔 Sesi Aç</button>
    </div>
  </div>

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
    <h4>🍲 Hızlı Stok Durumu (Tıklayıp Değiştirin):</h4>
    <div class="stock-grid" id="stockContainer"></div>
  </div>

  <div class="grid" id="ordersGrid"></div>

  <div id="printContainer" class="print-area" style="display:none;"></div>

  <!-- Modal 1: Menu & Store Management -->
  <div class="modal-backdrop" id="menuModal">
    <div class="modal-box">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
        <h3 id="menuModalHeader">📋 Menü Yönetimi</h3>
        <button onclick="closeModal('menuModal')" style="background:none; border:none; color:#94a3b8; font-size:1.5rem; cursor:pointer;">&times;</button>
      </div>

      <div style="background:#0f172a; padding:12px; border-radius:8px; margin-bottom:1rem; border:1px solid #334155;">
        <h4 style="color:#f59e0b; margin-bottom:6px;">🏦 Dükkan & FAST/IBAN Bilgisi</h4>
        <label style="font-size:0.8rem; color:#94a3b8;">Hesap Sahibi:</label>
        <input type="text" id="storeAccountName" placeholder="Örn: Ahmet Usta - Döner">
        <label style="font-size:0.8rem; color:#94a3b8;">IBAN (26 Haneli Gerçek TR IBAN):</label>
        <input type="text" id="storeIban" placeholder="TR00 0000...">
        <label style="font-size:0.8rem; color:#94a3b8;">Dükkan Açıklaması:</label>
        <input type="text" id="storeDesc" placeholder="Örn: Hatay usulü lavaş...">
        <button class="btn-action" style="background:#2563eb; padding:8px;" onclick="saveStoreSettings()">Kaydet (Dükkan Bilgileri)</button>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <h4>🍲 Menüdeki Ürünler:</h4>
        <button class="btn-action" style="width:auto; padding:6px 12px; font-size:0.85rem;" onclick="openItemEditor(null)">➕ Yeni Ürün Ekle</button>
      </div>
      <div id="menuItemsList" style="margin-top:8px;"></div>
    </div>
  </div>

  <!-- Modal 2: Add/Edit Item Form -->
  <div class="modal-backdrop" id="itemFormModal">
    <div class="modal-box">
      <h3 id="itemFormTitle" style="margin-bottom:1rem;">Ürünü Düzenle</h3>
      <input type="hidden" id="editItemId">
      
      <label style="font-size:0.85rem; color:#94a3b8;">Ürün Adı:</label>
      <input type="text" id="editItemName" placeholder="Örn: Tavuk Döner Dürüm">

      <label style="font-size:0.85rem; color:#94a3b8;">Fiyat (₺):</label>
      <input type="number" id="editItemPrice" placeholder="Örn: 120">

      <label style="font-size:0.85rem; color:#94a3b8;">Açıklama:</label>
      <input type="text" id="editItemDesc" placeholder="Örn: Soslu, patatesli, turşulu">

      <div style="background:#0f172a; padding:10px; border-radius:8px; margin-bottom:12px; border:1px solid #334155;">
        <label style="font-size:0.85rem; color:#93c5fd; font-weight:bold;">Porsiyon / Boyut Seçenekleri (Virgülle ayırın):</label>
        <p style="font-size:0.75rem; color:#64748b; margin-bottom:4px;">Format: İsim:Fiyat (Örn: Standart Dürüm:0, 1.5 Porsiyon:35)</p>
        <input type="text" id="editItemPortions" placeholder="Standart Dürüm:0, 1.5 Porsiyon:35">

        <label style="font-size:0.85rem; color:#93c5fd; font-weight:bold; margin-top:8px; display:block;">Ekstra Malzeme / Tercihler (Virgülle ayırın):</label>
        <p style="font-size:0.75rem; color:#64748b; margin-bottom:4px;">Format: İsim:Fiyat (Örn: Soğansız:0, Bol Soslu:0, Ekstra Kaşar:25)</p>
        <input type="text" id="editItemExtras" placeholder="Soğansız:0, Bol Soslu:0, Ekstra Kaşar:25">
      </div>

      <button class="btn-action" onclick="saveItemForm()">💾 Ürünü Kaydet</button>
      <button style="width:100%; border:none; background:none; color:#94a3b8; margin-top:10px; cursor:pointer;" onclick="closeModal('itemFormModal')">İptal</button>
    </div>
  </div>

  <script>
    let audioCtx = null;
    let hubData = {};
    let currentRestId = "donerci";

    function esc(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    if (localStorage.getItem('kitchenAuth') === 'true') {
      document.getElementById('authModal').style.display = 'none';
    }

    async function verifyPin() {
      const pin = document.getElementById('pinCode').value.trim();
      const targetRest = currentRestId || "donerci";
      
      const res = await fetch('/api/kitchen/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId: targetRest, pin: pin })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('kitchenAuth', 'true');
        document.getElementById('authModal').style.display = 'none';
      } else {
        alert(data.message || 'Hatalı PIN Kodu!');
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
        return '<option value="' + r.id + '">' + r.icon + ' ' + esc(r.name) + '</option>';
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
          const isItemInStock = item.inStock !== false;
          const btnClass = isItemInStock ? 'in-stock' : 'out-stock';
          const label = isItemInStock ? '🟢 Stokta' : '🔴 Tükendi';
          return '<div class="stock-item">' +
            '<span>' + esc(item.name) + '</span>' +
            '<button class="stock-toggle ' + btnClass + '" onclick="toggleStock(\\'' + item.id + '\\')">' + label + '</button>' +
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

    /* --- MENU & PRICE EDITOR --- */
    function openMenuModal() {
      const rest = hubData[currentRestId];
      if (!rest) return;
      document.getElementById('menuModalHeader').innerText = '📋 ' + rest.name + ' - Menü Düzenleme';
      document.getElementById('storeAccountName').value = rest.accountName || '';
      document.getElementById('storeIban').value = rest.iban || '';
      document.getElementById('storeDesc').value = rest.desc || '';
      renderMenuManagementList();
      document.getElementById('menuModal').style.display = 'flex';
    }

    function renderMenuManagementList() {
      const rest = hubData[currentRestId];
      const list = document.getElementById('menuItemsList');
      if (!rest.menu || rest.menu.length === 0) {
        list.innerHTML = '<p style="color:#94a3b8; font-size:0.85rem;">Menüde henüz ürün yok.</p>';
        return;
      }
      list.innerHTML = rest.menu.map(item => {
        return '<div class="menu-mgmt-row">' +
          '<div>' +
            '<strong>' + esc(item.name) + '</strong> &bull; <span style="color:#10b981; font-weight:bold;">' + item.price + ' ₺</span>' +
            '<p style="font-size:0.75rem; color:#94a3b8; margin-top:2px;">' + esc(item.desc || '') + '</p>' +
          '</div>' +
          '<div>' +
            '<button class="btn-edit" onclick="openItemEditor(\\'' + item.id + '\\')">✏️ Düzenle</button>' +
            '<button class="btn-del" onclick="deleteMenuItem(\\'' + item.id + '\\')">🗑️ Sil</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    function openItemEditor(itemId) {
      const rest = hubData[currentRestId];
      if (itemId) {
        const item = rest.menu.find(m => String(m.id) === String(itemId));
        document.getElementById('itemFormTitle').innerText = 'Ürünü Düzenle: ' + item.name;
        document.getElementById('editItemId').value = item.id;
        document.getElementById('editItemName').value = item.name;
        document.getElementById('editItemPrice').value = item.price;
        document.getElementById('editItemDesc').value = item.desc || '';
        
        let portionsStr = '';
        let extrasStr = '';
        if (item.options) {
          const radioGroup = item.options.find(o => o.type === 'radio');
          if (radioGroup) portionsStr = radioGroup.choices.map(c => c.name + ':' + c.price).join(', ');
          const checkGroup = item.options.find(o => o.type === 'checkbox');
          if (checkGroup) extrasStr = checkGroup.choices.map(c => c.name + ':' + c.price).join(', ');
        }
        document.getElementById('editItemPortions').value = portionsStr;
        document.getElementById('editItemExtras').value = extrasStr;
      } else {
        document.getElementById('itemFormTitle').innerText = '➕ Yeni Ürün Ekle';
        document.getElementById('editItemId').value = '';
        document.getElementById('editItemName').value = '';
        document.getElementById('editItemPrice').value = '';
        document.getElementById('editItemDesc').value = '';
        document.getElementById('editItemPortions').value = '';
        document.getElementById('editItemExtras').value = '';
      }
      document.getElementById('itemFormModal').style.display = 'flex';
    }

    async function saveItemForm() {
      const id = document.getElementById('editItemId').value;
      const name = document.getElementById('editItemName').value.trim();
      const price = parseFloat(document.getElementById('editItemPrice').value);
      const desc = document.getElementById('editItemDesc').value.trim();
      const portionsRaw = document.getElementById('editItemPortions').value.trim();
      const extrasRaw = document.getElementById('editItemExtras').value.trim();

      if (!name || isNaN(price)) return alert('Lütfen ürün adı ve geçerli bir fiyat girin!');

      const options = [];
      if (portionsRaw) {
        const choices = portionsRaw.split(',').map(s => {
          const parts = s.split(':');
          return { name: parts[0].trim(), price: parseFloat(parts[1]) || 0 };
        }).filter(c => c.name);
        if (choices.length > 0) {
          options.push({ name: "Porsiyon Seçimi", type: "radio", required: true, choices: choices });
        }
      }
      if (extrasRaw) {
        const choices = extrasRaw.split(',').map(s => {
          const parts = s.split(':');
          return { name: parts[0].trim(), price: parseFloat(parts[1]) || 0 };
        }).filter(c => c.name);
        if (choices.length > 0) {
          options.push({ name: "Malzeme & Tercihler", type: "checkbox", choices: choices });
        }
      }

      const itemPayload = {
        id: id ? id : undefined,
        name: name,
        price: price,
        desc: desc,
        inStock: true,
        options: options
      };

      const res = await fetch('/api/kitchen/menu/item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId: currentRestId, item: itemPayload })
      });
      const data = await res.json();
      if (data.success) {
        hubData = data.hub;
        closeModal('itemFormModal');
        renderMenuManagementList();
        loadRestaurantDashboard();
      } else {
        alert(data.error || 'Hata oluştu!');
      }
    }

    async function deleteMenuItem(itemId) {
      if (!confirm('Bu ürünü silmek istediğinize emin misiniz?')) return;
      const res = await fetch('/api/kitchen/menu/item/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId: currentRestId, itemId: itemId })
      });
      const data = await res.json();
      if (data.success) {
        hubData = data.hub;
        renderMenuManagementList();
        loadRestaurantDashboard();
      }
    }

    async function saveStoreSettings() {
      const desc = document.getElementById('storeDesc').value.trim();
      const iban = document.getElementById('storeIban').value.trim();
      const accountName = document.getElementById('storeAccountName').value.trim();

      const res = await fetch('/api/kitchen/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId: currentRestId, desc, iban, accountName })
      });
      const data = await res.json();
      if (data.success) {
        hubData = data.hub;
        alert('Dükkan bilgileri ve IBAN başarıyla güncellendi!');
      }
    }

    function closeModal(id) {
      document.getElementById(id).style.display = 'none';
    }

    /* --- ORDERS & SSE --- */
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
      
      const itemsList = order.items.map(function(i) {
        let optHtml = '';
        if (i.selectedOptions && i.selectedOptions.length > 0) {
          optHtml = '<div style="font-size:0.8rem; color:#93c5fd; margin: 3px 0 3px 10px; line-height: 1.4;">' +
            i.selectedOptions.map(o => '• <b>' + esc(o.name) + '</b>' + (o.price > 0 ? ' <span style="color:#6ee7b7;">(+' + o.price + ' TL)</span>' : '')).join('<br>') +
          '</div>';
        }
        let noteHtml = i.itemNote ? '<div style="font-size:0.75rem; color:#fde047; margin: 3px 0 3px 10px; font-style:italic;">📝 ' + esc(i.itemNote) + '</div>' : '';
        
        return '<li style="margin-bottom:8px;">' +
          '<strong>' + esc(i.name) + '</strong> <span style="color:#94a3b8;">(' + i.price + ' TL)</span>' +
          optHtml + 
          noteHtml + 
        '</li>';
      }).join('');
      
      card.innerHTML =
        '<div style="display:flex; justify-content:space-between;">' +
          '<h3>#' + order.id + '</h3>' +
          '<span style="background:#334155; padding:2px 6px; border-radius:4px; font-size:0.75rem;">' + esc(order.time) + '</span>' +
        '</div>' +
        '<p style="margin:6px 0;"><strong>' + esc(order.customer) + '</strong></p>' +
        '<p style="color:#94a3b8; font-size:0.85rem;">' + esc(order.type) + ' | ' + esc(order.payment) + '</p>' +
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
      
      const itemsFormatted = order.items.map(function(i) {
        let text = '<b>' + esc(i.name) + '</b> - ' + i.price + ' TL<br>';
        if (i.selectedOptions && i.selectedOptions.length > 0) {
          text += '&nbsp;&nbsp;[+] ' + i.selectedOptions.map(o => esc(o.name)).join(', ') + '<br>';
        }
        if (i.itemNote) {
          text += '&nbsp;&nbsp;[NOT: ' + esc(i.itemNote) + ']<br>';
        }
        return text;
      }).join('');

      p.innerHTML = 
        '================================<br>' +
        '       KAMPÜS MASASI FİŞİ       <br>' +
        '================================<br>' +
        'Sipariş No: #' + order.id + '<br>' +
        'Tarih: ' + esc(order.date) + ' ' + esc(order.time) + '<br>' +
        'Müşteri: ' + esc(order.customer) + '<br>' +
        'Teslimat: ' + esc(order.type) + '<br>' +
        'Ödeme: ' + esc(order.payment) + '<br>' +
        '--------------------------------<br>' +
        itemsFormatted +
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
