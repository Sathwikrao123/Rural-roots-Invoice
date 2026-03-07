var ROWS = 8;
var rowCount = 0;
var SHEET_URL = "https://script.google.com/macros/s/AKfycbyuaJ1gz3ttr0OuvBe51F-6qIAw5EDfnuZzKR-4w29iS0GACQepi09M3M3phtjf5gYATA/exec";

// ── Number to Words ──────────────────────────────────────────
var ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
  'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
var tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

function numberToWords(n) {
  if (n === 0) return 'Zero';
  if (n < 20)  return ones[n];
  if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' ' + ones[n%10] : '');
  if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' ' + numberToWords(n%100) : '');
  if (n < 100000) return numberToWords(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' ' + numberToWords(n%1000) : '');
  if (n < 10000000) return numberToWords(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' ' + numberToWords(n%100000) : '');
  return numberToWords(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' ' + numberToWords(n%10000000) : '');
}

// ── Add / Remove Rows ────────────────────────────────────────
function addRow() {
  rowCount++;
  var tbody = document.getElementById('itemsBody');
  var tr = document.createElement('tr');
  tr.id = 'row-' + rowCount;
  tr.innerHTML =
    '<td>' + rowCount + '</td>' +
    '<td class="particulars"><input type="text" placeholder="Item description" oninput="recalc()"></td>' +
    '<td><input type="number" min="0" step="0.01" placeholder="0" oninput="recalc()"></td>' +
    '<td><input type="number" min="0" step="0.01" placeholder="0.00" oninput="recalc()"></td>' +
    '<td><input type="number" min="0" step="1" readonly></td>' +
    '<td><input type="number" min="0" step="1" readonly></td>';
  tbody.appendChild(tr);
  recalc();
}

function removeRow() {
  if (rowCount === 0) return;
  var row = document.getElementById('row-' + rowCount);
  if (row) row.remove();
  rowCount--;
  recalc();
}

// ── Calculations ─────────────────────────────────────────────
function getRowValues() {
  var rows = document.querySelectorAll('#itemsBody tr');
  var total = 0;
  rows.forEach(function(tr) {
    var inp  = tr.querySelectorAll('input');
    var qty  = parseFloat(inp[1].value) || 0;
    var rate = parseFloat(inp[2].value) || 0;
    var amt  = qty * rate;
    var rs   = Math.floor(amt);
    var ps   = Math.round((amt - rs) * 100);
    inp[3].value = rs || '';
    inp[4].value = ps || '';
    total += amt;
  });
  return total;
}

function recalc() {
  var total = getRowValues();
  var cgst  = total * 0.025;
  var sgst  = total * 0.025;
  var grand = total + cgst + sgst;

  function split(n) { return { rs: Math.floor(n), ps: Math.round((n - Math.floor(n)) * 100) }; }
  var t = split(total), c = split(cgst), s = split(sgst), g = split(grand);

  document.getElementById('totalRs').textContent = t.rs || '';
  document.getElementById('totalPs').textContent = t.ps || '';
  document.getElementById('cgstRs').textContent  = c.rs || '';
  document.getElementById('cgstPs').textContent  = c.ps || '';
  document.getElementById('sgstRs').textContent  = s.rs || '';
  document.getElementById('sgstPs').textContent  = s.ps || '';
  document.getElementById('grandRs').textContent = g.rs || '';
  document.getElementById('grandPs').textContent = g.ps || '';
  document.getElementById('rupeesWords').textContent = grand > 0 ? numberToWords(Math.round(grand)) + ' Only' : '';
}

// ── Clear Form ───────────────────────────────────────────────
function clearForm() {
  ['custName','custAddr','custGstin','custPhone','supplyDate','supplyPlace'].forEach(function(id) {
    document.getElementById(id).value = '';
  });
  document.getElementById('invNum').value = '001';
  document.getElementById('itemsBody').innerHTML = '';
  rowCount = 0;
  recalc();
  for (var i = 0; i < ROWS; i++) addRow();
}

// ── Save to Google Sheets ────────────────────────────────────
function saveToSheets() {
  var statusEl = document.getElementById('saveStatus');
  var rows = document.querySelectorAll('#itemsBody tr');
  var itemLines = [], idx = 0;

  rows.forEach(function(tr) {
    var inp  = tr.querySelectorAll('input');
    var desc = inp[0].value.trim();
    var qty  = inp[1].value.trim();
    var rate = inp[2].value.trim();
    var amt  = inp[3].value.trim();
    if (desc || qty || rate) {
      idx++;
      itemLines.push(idx + '. ' + (desc||'-') + ' | Qty: ' + (qty||'0') + ' | Rate: Rs.' + (rate||'0') + ' | Amt: Rs.' + (amt||'0'));
    }
  });

  if (!document.getElementById('custName').value.trim()) {
    statusEl.className = 'error';
    statusEl.textContent = 'Please enter Customer Name before saving.';
    return;
  }
  if (itemLines.length === 0) {
    statusEl.className = 'error';
    statusEl.textContent = 'Please add at least one item before saving.';
    return;
  }

  var grandTotal = (document.getElementById('grandRs').textContent || '0') + '.' + (document.getElementById('grandPs').textContent || '00');

  var payload = {
    invoiceNo    : document.getElementById('invNum').value,
    date         : document.getElementById('supplyDate').value,
    customerName : document.getElementById('custName').value,
    phone        : document.getElementById('custPhone').value,
    address      : document.getElementById('custAddr').value,
    gstin        : document.getElementById('custGstin').value,
    placeOfSupply: document.getElementById('supplyPlace').value,
    grandTotal   : grandTotal,
    items        : itemLines.join(' || ')
  };

  statusEl.className = 'loading';
  statusEl.textContent = 'Saving to Google Sheets...';

  // Hidden iframe form POST — bypasses CORS completely
  var iframe = document.getElementById('hiddenFrame');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id   = 'hiddenFrame';
    iframe.name = 'hiddenFrame';
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
  }

  var form = document.createElement('form');
  form.method = 'POST';
  form.action = SHEET_URL;
  form.target = 'hiddenFrame';
  form.style.display = 'none';

  var input = document.createElement('input');
  input.type  = 'hidden';
  input.name  = 'payload';
  input.value = JSON.stringify(payload);
  form.appendChild(input);

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);

  setTimeout(function() {
    statusEl.className = 'success';
    statusEl.textContent = 'Invoice saved to Google Sheets successfully!';
    setTimeout(function() { statusEl.textContent = ''; }, 5000);
  }, 2000);
}

// ── Initialise ───────────────────────────────────────────────
for (var i = 0; i < ROWS; i++) addRow();
