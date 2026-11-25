/* ==========================================================
   chockyyy — shared script (product / order / admin)
   Each section runs only if its page's elements exist.
   ========================================================== */

var APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxSJroenenfD9doAuVay-LHoRcapOVGKfpfeo7Ab0cYLqm3UX5wT7D6n6hqzAXEzj2l/exec';

var ORDERS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQMohkrSekq7FC9Khnb-e0aFfKqH3kNuJ5LCaqkT-yia3Ljc_7p-sCIN8Le25PykCe4ZCtr8Bj6SBz-/pub?gid=0&single=true&output=csv';

/* ---------- Filter buttons (product.html) ----------
   "key" is what ?mood=xxx matches. A product matches a filter when the key
   equals its mood (e.g. sweet) OR the flavour word in its name (e.g. classic). */
var FILTERS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'classic', label: 'Classic', mood: 'sweet' },
  { key: 'rich', label: 'Rich', mood: 'confident' }
];

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('product-list')) initProductPage();
  if (document.getElementById('orderForm')) initOrderPage();
  if (document.querySelector('#ordersTable tbody')) initAdminPage();
});

/* ==========================================================
   1) product.html
   ========================================================== */
function initProductPage() {
  var filterBar = document.getElementById('filter-bar');
  var list = document.getElementById('product-list');
  var products = [];
  var activeKey = 'all';

  fetch('products.json')
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      products = data;
      var wanted = (getParam('mood') || 'all').toLowerCase();
      activeKey = resolveFilterKey(wanted);
      renderFilters();
      renderProducts();
    })
    .catch(function (err) {
      console.error(err);
      list.innerHTML = '';
      list.appendChild(el('p', { className: 'muted', text: 'ไม่สามารถโหลดรายการสินค้าได้ กรุณาลองใหม่อีกครั้ง' }));
    });

  // ?mood=classic / rich / sweet / confident -> matching filter button, else "all"
  function resolveFilterKey(value) {
    for (var i = 0; i < FILTERS.length; i++) {
      if (FILTERS[i].key === value || FILTERS[i].mood === value) return FILTERS[i].key;
    }
    return 'all';
  }

  function matches(product, key) {
    if (key === 'all') return true;
    var f = FILTERS.filter(function (x) { return x.key === key; })[0];
    var nameLower = String(product.name).toLowerCase();
    return product.mood === key ||
      (f && f.mood === product.mood) ||
      nameLower.split(/\s+/).indexOf(key) !== -1;
  }

  function renderFilters() {
    if (!filterBar) return;
    filterBar.innerHTML = '';
    filterBar.classList.add('filters');
    FILTERS.forEach(function (f) {
      var btn = el('button', { className: 'chip', text: f.label });
      btn.type = 'button';
      btn.setAttribute('aria-pressed', f.key === activeKey ? 'true' : 'false');
      btn.addEventListener('click', function () {
        activeKey = f.key;
        renderFilters();
        renderProducts();
      });
      filterBar.appendChild(btn);
    });
  }

  function renderProducts() {
    list.innerHTML = '';
    list.classList.add('product-grid');

    var shown = products.filter(function (p) { return matches(p, activeKey); });
    if (!shown.length) {
      list.appendChild(el('p', { className: 'muted', text: 'ยังไม่มีสินค้าในหมวดนี้' }));
      return;
    }

    shown.forEach(function (p) {
      var card = el('article', { className: 'product-card' });
      card.setAttribute('data-mood', p.mood);

      var media = el('div', { className: 'product-card__media' });
      var img = el('img');
      img.src = p.image;
      img.alt = p.name;
      img.loading = 'lazy';
      media.appendChild(img);

      var body = el('div', { className: 'product-card__body' });
      body.appendChild(el('h3', { text: p.name }));

      var meta = el('div', { className: 'product-card__meta' });
      var size = el('span', { className: 'mood-label' });
      size.appendChild(el('span', { className: 'mood-dot' }));
      size.appendChild(document.createTextNode(p.size));
      meta.appendChild(size);
      meta.appendChild(el('span', { className: 'price', text: formatPrice(p.price) + ' บาท' }));
      body.appendChild(meta);

      var orderUrl = 'order.html?item=' + encodeURIComponent(p.name + ' ' + p.size) +
        '&price=' + encodeURIComponent(p.price);
      var buy = el('a', { className: 'btn btn--accent', text: 'สั่งซื้อ' });
      buy.href = orderUrl;
      body.appendChild(buy);

      card.appendChild(media);
      card.appendChild(body);
      list.appendChild(card);
    });
  }
}

/* ==========================================================
   2) order.html
   ========================================================== */
function initOrderPage() {
  var form = document.getElementById('orderForm');

  // Pre-fill from URL parameters (item -> #items, price -> #total)
  var item = getParam('item');
  var price = getParam('price');
  if (item !== null) document.getElementById('items').value = item;
  if (price !== null) document.getElementById('total').value = price;

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var payload = {
      customerName: document.getElementById('customerName').value.trim(),
      contact: document.getElementById('contact').value.trim(),
      items: document.getElementById('items').value.trim(),
      total: document.getElementById('total').value.trim(),
      note: document.getElementById('note').value.trim()
    };

    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    });
  });
}

/* ==========================================================
   3) admin.html
   ========================================================== */
function initAdminPage() {
  var tbody = document.querySelector('#ordersTable tbody');
  setMessageRow('กำลังโหลดข้อมูล...');

  // timestamp param avoids a stale cached copy of the published CSV
  var url = ORDERS_CSV_URL + (ORDERS_CSV_URL.indexOf('?') === -1 ? '?' : '&') + 't=' + Date.now();

  fetch(url)
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(function (text) {
      var rows = parseCSV(text);
      rows.shift(); // header row
      rows = rows.filter(function (r) {
        return r.some(function (cell) { return cell.trim() !== ''; });
      });
      rows.reverse(); // sheet is appended oldest -> newest, so reverse = newest first

      if (!rows.length) {
        setMessageRow('ยังไม่มีรายการสั่งซื้อ');
        return;
      }

      tbody.innerHTML = '';
      rows.forEach(function (r) {
        var tr = document.createElement('tr');
        for (var i = 0; i < 6; i++) {
          var td = document.createElement('td');
          td.textContent = r[i] !== undefined ? r[i] : ''; // textContent: customer input is never run as HTML
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      });
    })
    .catch(function (err) {
      console.error(err);
      setMessageRow('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    });

  function setMessageRow(message) {
    tbody.innerHTML = '';
    var tr = document.createElement('tr');
    var td = document.createElement('td');
    td.colSpan = 6;
    td.textContent = message;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
}

/* Minimal CSV parser: quoted fields, "" escapes, commas and line breaks inside quotes */
function parseCSV(text) {
  var rows = [];
  var row = [];
  var field = '';
  var inQuotes = false;

  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // strip BOM

  for (var i = 0; i < text.length; i++) {
    var ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field !== '' || row.length) { // last line without trailing newline
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/* ---------- Helpers ---------- */
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function formatPrice(n) {
  return Number(n).toLocaleString('th-TH');
}

function el(tag, opts) {
  var node = document.createElement(tag);
  if (opts) {
    if (opts.className) node.className = opts.className;
    if (opts.text !== undefined) node.textContent = opts.text;
  }
  return node;
}
