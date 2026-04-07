const { createClient } = supabase;

const state = {
  allTrades: [],
  filteredTrades: [],
  editId: null,
  pendingPasswordResolver: null
};

const el = {
  connectionStatus: document.getElementById('connectionStatus'),
  adminStatus: document.getElementById('adminStatus'),
  tradeForm: document.getElementById('tradeForm'),
  tradeId: document.getElementById('tradeId'),
  trader: document.getElementById('trader'),
  pair: document.getElementById('pair'),
  type: document.getElementById('type'),
  entryPrice: document.getElementById('entryPrice'),
  stopLoss: document.getElementById('stopLoss'),
  takeProfit: document.getElementById('takeProfit'),
  exitPrice: document.getElementById('exitPrice'),
  notes: document.getElementById('notes'),
  tradeDate: document.getElementById('tradeDate'),
  calculatedPL: document.getElementById('calculatedPL'),
  cancelEditBtn: document.getElementById('cancelEditBtn'),
  saveBtn: document.getElementById('saveBtn'),
  tradeTableBody: document.getElementById('tradeTableBody'),
  tableEmpty: document.getElementById('tableEmpty'),
  filterTrader: document.getElementById('filterTrader'),
  filterPair: document.getElementById('filterPair'),
  filterType: document.getElementById('filterType'),
  sortBy: document.getElementById('sortBy'),
  searchInput: document.getElementById('searchInput'),
  leaderboard: document.getElementById('leaderboard'),
  equityChart: document.getElementById('equityChart'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),
  importCsvInput: document.getElementById('importCsvInput'),
  unlockBtn: document.getElementById('unlockBtn'),
  resetDataBtn: document.getElementById('resetDataBtn'),
  toast: document.getElementById('toast'),
  statTotalTrades: document.getElementById('statTotalTrades'),
  statCombinedPL: document.getElementById('statCombinedPL'),
  statBestTrader: document.getElementById('statBestTrader'),
  statActiveTraders: document.getElementById('statActiveTraders'),
  passwordModal: document.getElementById('passwordModal'),
  adminPasswordInput: document.getElementById('adminPasswordInput'),
  modalCancelBtn: document.getElementById('modalCancelBtn'),
  modalConfirmBtn: document.getElementById('modalConfirmBtn'),
  modalError: document.getElementById('modalError')
};

const ADMIN_UNLOCK_KEY = 'admin_unlock_until';
const config = window.APP_CONFIG;
const supabaseClient = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

function getIsAdminUnlocked() {
  const ts = Number(localStorage.getItem(ADMIN_UNLOCK_KEY) || 0);
  return Date.now() < ts;
}

function setAdminUnlock() {
  const mins = config.ADMIN_SESSION_MINUTES || 15;
  const expires = Date.now() + mins * 60 * 1000;
  localStorage.setItem(ADMIN_UNLOCK_KEY, String(expires));
  refreshAdminStatus();
}

function clearAdminUnlock() {
  localStorage.removeItem(ADMIN_UNLOCK_KEY);
  refreshAdminStatus();
}

function refreshAdminStatus() {
  if (getIsAdminUnlocked()) {
    el.adminStatus.textContent = 'Admin unlocked';
    el.adminStatus.classList.remove('badge-muted');
  } else {
    el.adminStatus.textContent = 'Read-only mode';
    el.adminStatus.classList.add('badge-muted');
  }
}

function showToast(message, type = 'success') {
  el.toast.textContent = message;
  el.toast.className = `toast ${type}`;
  setTimeout(() => el.toast.classList.add('hidden'), 2800);
}

function currency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
}

function calculatePL(trade) {
  const entry = Number(trade.entry_price);
  const exit = Number(trade.exit_price);
  if (Number.isNaN(entry) || Number.isNaN(exit)) return 0;
  return trade.type === 'short' ? entry - exit : exit - entry;
}

function validateTradePayload(payload) {
  const required = ['trader', 'pair', 'type', 'entry_price', 'stop_loss', 'take_profit', 'exit_price', 'trade_date'];
  for (const key of required) {
    if (payload[key] === '' || payload[key] === null || payload[key] === undefined) return `${key} is required`;
  }
  if (!['long', 'short'].includes(payload.type)) return 'Trade type must be long or short';
  if (Number(payload.entry_price) <= 0 || Number(payload.exit_price) <= 0) return 'Prices must be positive';
  return null;
}

function getFormPayload() {
  const payload = {
    trader: el.trader.value.trim(),
    pair: el.pair.value.trim().toUpperCase(),
    type: el.type.value,
    entry_price: Number(el.entryPrice.value),
    stop_loss: Number(el.stopLoss.value),
    take_profit: Number(el.takeProfit.value),
    exit_price: Number(el.exitPrice.value),
    notes: el.notes.value.trim(),
    trade_date: new Date(el.tradeDate.value).toISOString()
  };
  payload.profit_loss = calculatePL(payload);
  return payload;
}

function fillForm(trade) {
  el.tradeId.value = trade.id;
  el.trader.value = trade.trader;
  el.pair.value = trade.pair;
  el.type.value = trade.type;
  el.entryPrice.value = trade.entry_price;
  el.stopLoss.value = trade.stop_loss;
  el.takeProfit.value = trade.take_profit;
  el.exitPrice.value = trade.exit_price;
  el.notes.value = trade.notes || '';
  el.tradeDate.value = new Date(trade.trade_date).toISOString().slice(0, 16);
  state.editId = trade.id;
  el.cancelEditBtn.classList.remove('hidden');
  el.saveBtn.textContent = 'Update Trade';
  updateLivePL();
}

function clearForm() {
  el.tradeForm.reset();
  el.tradeId.value = '';
  state.editId = null;
  el.cancelEditBtn.classList.add('hidden');
  el.saveBtn.textContent = 'Save Trade';
  el.calculatedPL.textContent = currency(0);
}

function updateLivePL() {
  const payload = getFormPayload();
  if (!Number.isFinite(payload.entry_price) || !Number.isFinite(payload.exit_price)) return;
  const pl = calculatePL(payload);
  el.calculatedPL.textContent = currency(pl);
  el.calculatedPL.className = pl >= 0 ? 'pl-pos' : 'pl-neg';
}

async function requestAdminPassword(reason = 'verify') {
  if (getIsAdminUnlocked()) return '';
  el.passwordModal.classList.remove('hidden');
  el.passwordModal.setAttribute('aria-hidden', 'false');
  el.modalError.textContent = '';
  el.adminPasswordInput.value = '';
  el.adminPasswordInput.focus();

  return new Promise((resolve, reject) => {
    state.pendingPasswordResolver = { resolve, reject, reason };
  });
}

function closePasswordModal() {
  el.passwordModal.classList.add('hidden');
  el.passwordModal.setAttribute('aria-hidden', 'true');
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    headers.forEach((h, i) => (row[h] = (cells[i] || '').trim()));
    return {
      trader: row.trader,
      pair: row.pair,
      type: row.type,
      entry_price: Number(row.entry_price),
      stop_loss: Number(row.stop_loss),
      take_profit: Number(row.take_profit),
      exit_price: Number(row.exit_price),
      notes: row.notes || '',
      trade_date: new Date(row.trade_date).toISOString(),
      profit_loss: Number(row.profit_loss) || calculatePL(row)
    };
  });
}

function buildTraderMetrics(trades) {
  const starting = Number(config.DEFAULT_STARTING_BALANCE || 10000);
  const map = new Map();

  [...trades].sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date)).forEach((t) => {
    if (!map.has(t.trader)) {
      map.set(t.trader, {
        trader: t.trader,
        totalTrades: 0,
        wins: 0,
        losses: 0,
        grossWin: 0,
        grossLoss: 0,
        totalPL: 0,
        bestTrade: -Infinity,
        worstTrade: Infinity,
        winStreak: 0,
        lossStreak: 0,
        currentWin: 0,
        currentLoss: 0
      });
    }
    const m = map.get(t.trader);
    m.totalTrades += 1;
    m.totalPL += t.profit_loss;
    m.bestTrade = Math.max(m.bestTrade, t.profit_loss);
    m.worstTrade = Math.min(m.worstTrade, t.profit_loss);
    if (t.profit_loss >= 0) {
      m.wins += 1;
      m.grossWin += t.profit_loss;
      m.currentWin += 1;
      m.currentLoss = 0;
      m.winStreak = Math.max(m.winStreak, m.currentWin);
    } else {
      m.losses += 1;
      m.grossLoss += Math.abs(t.profit_loss);
      m.currentLoss += 1;
      m.currentWin = 0;
      m.lossStreak = Math.max(m.lossStreak, m.currentLoss);
    }
  });

  return Array.from(map.values()).map((m) => {
    const winRate = m.totalTrades ? (m.wins / m.totalTrades) * 100 : 0;
    const profitFactor = m.grossLoss === 0 ? m.grossWin : m.grossWin / m.grossLoss;
    return {
      ...m,
      balance: starting + m.totalPL,
      winRate,
      profitFactor: Number.isFinite(profitFactor) ? profitFactor : 0
    };
  }).sort((a, b) => b.totalPL - a.totalPL);
}

function renderLeaderboard(metrics) {
  if (!metrics.length) {
    el.leaderboard.innerHTML = '<div class="empty-state">No trader metrics yet.</div>';
    return;
  }
  el.leaderboard.innerHTML = metrics.map((m, i) => `
    <div class="rank-row">
      <div class="rank-num">${i + 1}</div>
      <div>
        <strong>${m.trader}</strong>
        <div class="subtle">Win rate ${m.winRate.toFixed(1)}% · PF ${m.profitFactor.toFixed(2)} · Balance ${currency(m.balance)}</div>
      </div>
      <div class="${m.totalPL >= 0 ? 'pl-pos' : 'pl-neg'}">${currency(m.totalPL)}</div>
    </div>
  `).join('');
}

function renderSummary(metrics, trades) {
  const totalPL = trades.reduce((sum, t) => sum + t.profit_loss, 0);
  el.statTotalTrades.textContent = String(trades.length);
  el.statCombinedPL.textContent = currency(totalPL);
  el.statCombinedPL.className = totalPL >= 0 ? 'pl-pos' : 'pl-neg';
  el.statBestTrader.textContent = metrics[0]?.trader || '—';
  el.statActiveTraders.textContent = String(metrics.length);
}

function drawEquityCurve(trades) {
  const canvas = el.equityChart;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!trades.length) return;

  const sorted = [...trades].sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date));
  const series = [];
  let running = 0;
  for (const t of sorted) {
    running += t.profit_loss;
    series.push(running);
  }

  const min = Math.min(...series, 0);
  const max = Math.max(...series, 0);
  const pad = 24;
  const width = canvas.width - pad * 2;
  const height = canvas.height - pad * 2;

  const x = (i) => pad + (i / Math.max(series.length - 1, 1)) * width;
  const y = (v) => pad + (1 - (v - min) / Math.max(max - min, 1)) * height;

  ctx.strokeStyle = '#344253';
  ctx.beginPath();
  ctx.moveTo(pad, y(0));
  ctx.lineTo(canvas.width - pad, y(0));
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.strokeStyle = '#2f81f7';
  ctx.beginPath();
  series.forEach((v, i) => {
    if (i === 0) ctx.moveTo(x(i), y(v));
    else ctx.lineTo(x(i), y(v));
  });
  ctx.stroke();
}

function populateFilterOptions(trades) {
  const traders = Array.from(new Set(trades.map((t) => t.trader))).sort();
  const pairs = Array.from(new Set(trades.map((t) => t.pair))).sort();

  el.filterTrader.innerHTML = '<option value="all">All</option>' + traders.map((t) => `<option value="${t}">${t}</option>`).join('');
  el.filterPair.innerHTML = '<option value="all">All</option>' + pairs.map((p) => `<option value="${p}">${p}</option>`).join('');
}

function applyFiltersAndRenderTable() {
  const fTrader = el.filterTrader.value;
  const fPair = el.filterPair.value;
  const fType = el.filterType.value;
  const q = el.searchInput.value.trim().toLowerCase();

  let trades = [...state.allTrades];
  if (fTrader !== 'all') trades = trades.filter((t) => t.trader === fTrader);
  if (fPair !== 'all') trades = trades.filter((t) => t.pair === fPair);
  if (fType !== 'all') trades = trades.filter((t) => t.type === fType);
  if (q) trades = trades.filter((t) => t.trader.toLowerCase().includes(q) || t.pair.toLowerCase().includes(q));

  switch (el.sortBy.value) {
    case 'date_asc': trades.sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date)); break;
    case 'pl_desc': trades.sort((a, b) => b.profit_loss - a.profit_loss); break;
    case 'pl_asc': trades.sort((a, b) => a.profit_loss - b.profit_loss); break;
    default: trades.sort((a, b) => new Date(b.trade_date) - new Date(a.trade_date));
  }

  state.filteredTrades = trades;
  renderTradeTable(trades);
}

function renderTradeTable(trades) {
  if (!trades.length) {
    el.tradeTableBody.innerHTML = '';
    el.tableEmpty.classList.remove('hidden');
    return;
  }
  el.tableEmpty.classList.add('hidden');
  el.tradeTableBody.innerHTML = trades.map((t) => `
    <tr>
      <td>${new Date(t.trade_date).toLocaleString()}</td>
      <td>${t.trader}</td>
      <td>${t.pair}</td>
      <td>${t.type}</td>
      <td>${t.entry_price}</td>
      <td>${t.exit_price}</td>
      <td class="${t.profit_loss >= 0 ? 'pl-pos' : 'pl-neg'}">${currency(t.profit_loss)}</td>
      <td>${(t.notes || '').replace(/</g, '&lt;')}</td>
      <td>
        <button class="btn btn-secondary" data-action="edit" data-id="${t.id}">Edit</button>
        <button class="btn btn-danger" data-action="delete" data-id="${t.id}">Delete</button>
      </td>
    </tr>
  `).join('');
}

async function callWriteFunction(functionName, body) {
  const res = await fetch(`/.netlify/functions/${functionName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function saveTrade(event) {
  event.preventDefault();
  const payload = getFormPayload();
  const validationError = validateTradePayload(payload);
  if (validationError) {
    showToast(validationError, 'error');
    return;
  }

  try {
    const password = await requestAdminPassword('save');
    const fn = state.editId ? 'update-trade' : 'create-trade';
    const body = state.editId ? { id: state.editId, trade: payload, password } : { trade: payload, password };
    await callWriteFunction(fn, body);
    if (password) setAdminUnlock();
    showToast(state.editId ? 'Trade updated successfully.' : 'Trade created successfully.');
    clearForm();
    await loadTrades();
  } catch (error) {
    if (error.message !== 'cancelled') showToast(error.message, 'error');
  }
}

async function deleteTrade(id) {
  if (!confirm('Delete this trade permanently?')) return;
  try {
    const password = await requestAdminPassword('delete');
    await callWriteFunction('delete-trade', { id, password });
    if (password) setAdminUnlock();
    showToast('Trade deleted.');
    await loadTrades();
  } catch (error) {
    if (error.message !== 'cancelled') showToast(error.message, 'error');
  }
}

async function resetAllData() {
  if (!confirm('This will delete ALL trades. Continue?')) return;
  try {
    const password = await requestAdminPassword('reset');
    for (const trade of state.allTrades) {
      await callWriteFunction('delete-trade', { id: trade.id, password });
    }
    if (password) setAdminUnlock();
    showToast('All trade data has been reset.');
    await loadTrades();
  } catch (error) {
    if (error.message !== 'cancelled') showToast(error.message, 'error');
  }
}

function exportCsv() {
  const rows = ['id,trader,pair,type,entry_price,stop_loss,take_profit,exit_price,profit_loss,notes,trade_date,created_at'];
  state.filteredTrades.forEach((t) => {
    const vals = [t.id, t.trader, t.pair, t.type, t.entry_price, t.stop_loss, t.take_profit, t.exit_price, t.profit_loss, (t.notes || '').replaceAll(',', ';'), t.trade_date, t.created_at];
    rows.push(vals.join(','));
  });
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `trades-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importCsv(file) {
  if (!file) return;
  try {
    const password = await requestAdminPassword('import');
    const text = await file.text();
    const trades = parseCsv(text);
    if (!trades.length) throw new Error('CSV has no data rows.');
    for (const trade of trades) {
      const err = validateTradePayload(trade);
      if (err) throw new Error(`Invalid row for ${trade.trader || 'unknown'}: ${err}`);
      await callWriteFunction('create-trade', { trade, password });
    }
    if (password) setAdminUnlock();
    showToast(`Imported ${trades.length} trades.`);
    await loadTrades();
  } catch (error) {
    if (error.message !== 'cancelled') showToast(error.message, 'error');
  } finally {
    el.importCsvInput.value = '';
  }
}

async function loadTrades() {
  el.connectionStatus.textContent = 'Loading data...';
  const { data, error } = await supabaseClient
    .from('trades')
    .select('*')
    .order('trade_date', { ascending: false });

  if (error) {
    el.connectionStatus.textContent = 'Load failed';
    showToast(error.message, 'error');
    return;
  }

  state.allTrades = (data || []).map((t) => ({ ...t, profit_loss: Number(t.profit_loss) }));
  populateFilterOptions(state.allTrades);
  applyFiltersAndRenderTable();
  const metrics = buildTraderMetrics(state.allTrades);
  renderSummary(metrics, state.allTrades);
  renderLeaderboard(metrics);
  drawEquityCurve(state.allTrades);
  el.connectionStatus.textContent = 'Connected';
}

function bindEvents() {
  [el.entryPrice, el.exitPrice, el.type].forEach((i) => i.addEventListener('input', updateLivePL));
  el.tradeForm.addEventListener('submit', saveTrade);
  el.cancelEditBtn.addEventListener('click', clearForm);
  [el.filterTrader, el.filterPair, el.filterType, el.sortBy, el.searchInput].forEach((i) => i.addEventListener('input', applyFiltersAndRenderTable));
  el.exportCsvBtn.addEventListener('click', exportCsv);
  el.importCsvInput.addEventListener('change', (e) => importCsv(e.target.files[0]));
  el.resetDataBtn.addEventListener('click', resetAllData);

  el.unlockBtn.addEventListener('click', async () => {
    try {
      const password = await requestAdminPassword('unlock');
      await callWriteFunction('create-trade', {
        password,
        trade: {
          trader: '__ping__', pair: 'PING', type: 'long', entry_price: 1, stop_loss: 1, take_profit: 1, exit_price: 1, notes: 'auth check', trade_date: new Date().toISOString(), profit_loss: 0
        },
        dryRun: true
      });
      setAdminUnlock();
      showToast('Admin unlocked for this browser session.');
    } catch (error) {
      if (error.message !== 'cancelled') showToast(error.message, 'error');
    }
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const trade = state.allTrades.find((t) => String(t.id) === String(id));
    if (!trade) return;
    if (btn.dataset.action === 'edit') fillForm(trade);
    if (btn.dataset.action === 'delete') deleteTrade(id);
  });

  el.modalCancelBtn.addEventListener('click', () => {
    closePasswordModal();
    state.pendingPasswordResolver?.reject(new Error('cancelled'));
    state.pendingPasswordResolver = null;
  });

  el.modalConfirmBtn.addEventListener('click', () => {
    const password = el.adminPasswordInput.value;
    if (!password) {
      el.modalError.textContent = 'Password is required.';
      return;
    }
    closePasswordModal();
    state.pendingPasswordResolver?.resolve(password);
    state.pendingPasswordResolver = null;
  });
}

function init() {
  if (!config?.SUPABASE_URL || !config?.SUPABASE_ANON_KEY) {
    showToast('Missing config.js values.', 'error');
    el.connectionStatus.textContent = 'Configuration error';
    return;
  }
  refreshAdminStatus();
  bindEvents();
  loadTrades();
  setInterval(refreshAdminStatus, 30000);
}

init();
