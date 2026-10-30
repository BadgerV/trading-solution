const { createClient } = supabase;

const SESSION_KEY = 'dashboard_auth_session';
const config = window.APP_CONFIG;
const supabaseClient = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
const DEFAULT_INSTRUMENT_SPECS = [
  { id: 'default-xau', label: 'Gold', symbol_pattern: 'XAU', match_type: 'prefix', pricing_model: 'contract', contract_size: 100, priority: 10, active: true, notes: 'Gold CFDs', is_default: true },
  { id: 'default-xag', label: 'Silver', symbol_pattern: 'XAG', match_type: 'prefix', pricing_model: 'contract', contract_size: 5000, priority: 11, active: true, notes: 'Silver CFDs', is_default: true },
  { id: 'default-xpt', label: 'Platinum/Palladium', symbol_pattern: 'XPT', match_type: 'prefix', pricing_model: 'contract', contract_size: 100, priority: 12, active: true, notes: 'Precious metals', is_default: true },
  { id: 'default-usoil', label: 'US Oil', symbol_pattern: 'USOIL', match_type: 'exact', pricing_model: 'contract', contract_size: 100, priority: 20, active: true, notes: 'US Oil CFD', is_default: true },
  { id: 'default-ukoil', label: 'Brent Oil', symbol_pattern: 'UKOIL', match_type: 'exact', pricing_model: 'contract', contract_size: 100, priority: 21, active: true, notes: 'Brent Oil CFD', is_default: true },
  { id: 'default-ngas', label: 'Natural Gas', symbol_pattern: 'NGAS', match_type: 'prefix', pricing_model: 'contract', contract_size: 10000, priority: 22, active: true, notes: 'Natural gas CFD', is_default: true }
];

const state = {
  allTrades: [],
  filteredTrades: [],
  traders: [],
  instrumentSpecs: [],
  auth: null,
  editId: null,
  authMode: 'trader',
  pendingAuthResolver: null,
  pendingAuthRejecter: null,
  forceAuthRole: null
};

const el = {
  connectionStatus: document.getElementById('connectionStatus'),
  sessionStatus: document.getElementById('sessionStatus'),
  loginBtn: document.getElementById('loginBtn'),
  profileMenu: document.getElementById('profileMenu'),
  profileName: document.getElementById('profileName'),
  profileRole: document.getElementById('profileRole'),
  changePasswordBtn: document.getElementById('changePasswordBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  analyticsTrader: document.getElementById('analyticsTrader'),
  historyPreset: document.getElementById('historyPreset'),
  viewLabel: document.getElementById('viewLabel'),
  leaderboard: document.getElementById('leaderboard'),
  chartHint: document.getElementById('chartHint'),
  equityChart: document.getElementById('equityChart'),
  statTotalTrades: document.getElementById('statTotalTrades'),
  statCombinedPL: document.getElementById('statCombinedPL'),
  statBestTrader: document.getElementById('statBestTrader'),
  statActiveTraders: document.getElementById('statActiveTraders'),
  manageTradersSection: document.getElementById('manageTradersSection'),
  manageInstrumentsSection: document.getElementById('manageInstrumentsSection'),
  traderAdminForm: document.getElementById('traderAdminForm'),
  manageTraderId: document.getElementById('manageTraderId'),
  manageUsername: document.getElementById('manageUsername'),
  manageDisplayName: document.getElementById('manageDisplayName'),
  manageRole: document.getElementById('manageRole'),
  manageActive: document.getElementById('manageActive'),
  manageTempPassword: document.getElementById('manageTempPassword'),
  manageSaveBtn: document.getElementById('manageSaveBtn'),
  manageCancelBtn: document.getElementById('manageCancelBtn'),
  traderAdminTableBody: document.getElementById('traderAdminTableBody'),
  instrumentSpecForm: document.getElementById('instrumentSpecForm'),
  instrumentSpecId: document.getElementById('instrumentSpecId'),
  instrumentLabel: document.getElementById('instrumentLabel'),
  instrumentSymbolPattern: document.getElementById('instrumentSymbolPattern'),
  instrumentMatchType: document.getElementById('instrumentMatchType'),
  instrumentPricingModel: document.getElementById('instrumentPricingModel'),
  instrumentContractSize: document.getElementById('instrumentContractSize'),
  instrumentPriority: document.getElementById('instrumentPriority'),
  instrumentActive: document.getElementById('instrumentActive'),
  instrumentNotes: document.getElementById('instrumentNotes'),
  instrumentSaveBtn: document.getElementById('instrumentSaveBtn'),
  instrumentCancelBtn: document.getElementById('instrumentCancelBtn'),
  instrumentSpecTableBody: document.getElementById('instrumentSpecTableBody'),
  tradeForm: document.getElementById('tradeForm'),
  tradeId: document.getElementById('tradeId'),
  trader: document.getElementById('trader'),
  pair: document.getElementById('pair'),
  type: document.getElementById('type'),
  lotSize: document.getElementById('lotSize'),
  entryPrice: document.getElementById('entryPrice'),
  stopLoss: document.getElementById('stopLoss'),
  takeProfit: document.getElementById('takeProfit'),
  exitPrice: document.getElementById('exitPrice'),
  tradeDate: document.getElementById('tradeDate'),
  setTradeNowBtn: document.getElementById('setTradeNowBtn'),
  setTradeHourAgoBtn: document.getElementById('setTradeHourAgoBtn'),
  notes: document.getElementById('notes'),
  calculatedPL: document.getElementById('calculatedPL'),
  cancelEditBtn: document.getElementById('cancelEditBtn'),
  saveBtn: document.getElementById('saveBtn'),
  resetDataBtn: document.getElementById('resetDataBtn'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),
  importCsvInput: document.getElementById('importCsvInput'),
  filterTrader: document.getElementById('filterTrader'),
  filterPair: document.getElementById('filterPair'),
  filterType: document.getElementById('filterType'),
  sortBy: document.getElementById('sortBy'),
  searchInput: document.getElementById('searchInput'),
  tradeTableBody: document.getElementById('tradeTableBody'),
  tableEmpty: document.getElementById('tableEmpty'),
  toast: document.getElementById('toast'),
  authModal: document.getElementById('authModal'),
  authModeTraderBtn: document.getElementById('authModeTraderBtn'),
  authModeAdminBtn: document.getElementById('authModeAdminBtn'),
  authModeHint: document.getElementById('authModeHint'),
  authForm: document.getElementById('authForm'),
  authUsername: document.getElementById('authUsername'),
  authPassword: document.getElementById('authPassword'),
  authCancelBtn: document.getElementById('authCancelBtn'),
  authError: document.getElementById('authError'),
  changePasswordModal: document.getElementById('changePasswordModal'),
  changePasswordForm: document.getElementById('changePasswordForm'),
  changePasswordCurrent: document.getElementById('changePasswordCurrent'),
  changePasswordNew: document.getElementById('changePasswordNew'),
  changePasswordConfirm: document.getElementById('changePasswordConfirm'),
  changePasswordCancelBtn: document.getElementById('changePasswordCancelBtn'),
  changePasswordError: document.getElementById('changePasswordError')
};

function showToast(message, type = 'success') {
  el.toast.textContent = message;
  el.toast.className = `toast ${type}`;
  setTimeout(() => el.toast.classList.add('hidden'), 2800);
}

function currency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
}

function normalizeTradeType(type = '') {
  const normalized = String(type || '').trim().toLowerCase();
  if (normalized === 'long') return 'buy';
  if (normalized === 'short') return 'sell';
  return normalized;
}

function parsePair(pair = '') {
  const normalized = String(pair || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
  if (normalized.length < 6) return null;
  return {
    base: normalized.slice(0, 3),
    quote: normalized.slice(3, 6)
  };
}

function normalizeSymbol(symbol = '') {
  return String(symbol || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeMatchType(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return ['exact', 'prefix', 'regex'].includes(normalized) ? normalized : 'exact';
}

function normalizePricingModel(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return ['forex', 'contract'].includes(normalized) ? normalized : 'contract';
}

function matchInstrumentSpec(symbol = '', spec = {}) {
  const normalizedSymbol = normalizeSymbol(symbol);
  const pattern = normalizeSymbol(spec.symbol_pattern || '');
  if (!normalizedSymbol || !pattern) return false;

  switch (normalizeMatchType(spec.match_type)) {
    case 'prefix':
      return normalizedSymbol.startsWith(pattern);
    case 'regex':
      try {
        return new RegExp(spec.symbol_pattern, 'i').test(symbol);
      } catch (error) {
        return false;
      }
    default:
      return normalizedSymbol === pattern;
  }
}

function getEffectiveInstrumentSpecs() {
  return [...state.instrumentSpecs, ...DEFAULT_INSTRUMENT_SPECS]
    .filter((spec) => spec && spec.active !== false && Number(spec.contract_size) > 0)
    .sort((a, b) => Number(a.priority ?? 1000) - Number(b.priority ?? 1000));
}

function resolveTradeSpec(symbol = '') {
  const matchingSpec = getEffectiveInstrumentSpecs().find((spec) => matchInstrumentSpec(symbol, spec));
  if (matchingSpec) {
    return {
      pricingModel: normalizePricingModel(matchingSpec.pricing_model),
      contractSize: Number(matchingSpec.contract_size),
      spec: matchingSpec
    };
  }

  if (parsePair(symbol)) {
    return {
      pricingModel: 'forex',
      contractSize: 100000,
      spec: null
    };
  }

  return {
    pricingModel: 'contract',
    contractSize: 1,
    spec: null
  };
}

function formatTradeSide(type = '') {
  const normalized = normalizeTradeType(type);
  if (normalized === 'buy') return 'Buy';
  if (normalized === 'sell') return 'Sell';
  return type || '—';
}

function calculatePL(trade) {
  const spec = resolveTradeSpec(trade.pair);
  const type = normalizeTradeType(trade.type);
  const entry = Number(trade.entry_price);
  const exit = Number(trade.exit_price);
  const lotSize = Number(trade.lot_size);
  if (Number.isNaN(entry) || Number.isNaN(exit) || Number.isNaN(lotSize) || lotSize <= 0) return 0;

  if (spec.pricingModel === 'forex') {
    const pair = parsePair(trade.pair);
    if (!pair) return 0;

    const pipMultiplier = pair.quote === 'JPY' ? 0.01 : 0.0001;
    const units = lotSize * spec.contractSize;
    const direction = type === 'sell' ? -1 : 1;
    const pipMove = (exit - entry) / pipMultiplier;
    const pipValueInQuote = units * pipMultiplier;
    const grossPL = pipMove * pipValueInQuote * direction;

    if (pair.quote === 'USD') return grossPL;
    if (pair.base === 'USD') return grossPL / exit;
    return grossPL;
  }

  const direction = type === 'sell' ? -1 : 1;
  return (exit - entry) * spec.contractSize * lotSize * direction;
}

function calculateRiskRewardRatio(trade) {
  const type = normalizeTradeType(trade.type);
  const entry = Number(trade.entry_price);
  const stop = Number(trade.stop_loss);
  const takeProfit = Number(trade.take_profit);
  if (Number.isNaN(entry) || Number.isNaN(stop) || Number.isNaN(takeProfit)) return null;

  const riskDistance = type === 'sell' ? stop - entry : entry - stop;
  const rewardDistance = type === 'sell' ? entry - takeProfit : takeProfit - entry;
  if (riskDistance <= 0 || rewardDistance <= 0) return null;
  return rewardDistance / riskDistance;
}

function formatRiskRewardRatio(value) {
  if (!Number.isFinite(value) || value <= 0) return '—';
  return `1:${value.toFixed(2)}`;
}

function formatLocalDateTime(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function setTradeDateValue(date = new Date()) {
  el.tradeDate.value = formatLocalDateTime(date);
}

function normalizeUsername(value = '') {
  return String(value).trim().toLowerCase();
}

function normalizeSession(session) {
  if (!session) return null;
  if (!session.expiresAt || Date.now() >= Number(session.expiresAt)) return null;
  return session;
}

function saveSession(session) {
  state.auth = session;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  state.auth = null;
  sessionStorage.removeItem(SESSION_KEY);
}

function loadSession() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    const valid = normalizeSession(parsed);
    if (!valid) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return valid;
  } catch (error) {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function isAdmin() {
  return state.auth?.role === 'admin';
}

function isTrader() {
  return state.auth?.role === 'trader';
}

function canWrite() {
  return !!state.auth && !state.auth.must_change_password;
}

function getAuthPayload() {
  if (!state.auth) return null;
  if (state.auth.source === 'master-password') {
    return { mode: 'admin', username: '', password: state.auth.password };
  }
  return {
    mode: state.auth.auth_mode || (state.auth.role === 'admin' ? 'admin' : 'trader'),
    username: state.auth.username,
    password: state.auth.password
  };
}

function getSelectableTraders() {
  const fromTrades = state.allTrades.map((trade) => ({
    id: trade.trader_id || `legacy:${trade.trader}`,
    display_name: trade.trader,
    username: normalizeUsername(trade.trader),
    active: true,
    role: 'trader'
  }));
  const map = new Map();
  [...state.traders, ...fromTrades].forEach((trader) => {
    if (!trader?.display_name) return;
    const key = trader.id || trader.username || trader.display_name;
    if (!map.has(key)) map.set(key, trader);
  });
  return Array.from(map.values())
    .filter((trader) => trader.active !== false)
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
}

function seedAuthenticatedTraderContext(session = state.auth) {
  if (!session || session.role !== 'trader' || !session.trader_id) return;
  const ownTrader = {
    id: session.trader_id,
    username: session.username,
    display_name: session.display_name,
    active: true,
    role: 'trader'
  };
  const others = state.traders.filter((trader) => trader.id !== ownTrader.id);
  state.traders = [...others, ownTrader];
}

function updateSessionUI() {
  if (!state.auth) {
    el.sessionStatus.textContent = 'Public view';
    el.sessionStatus.classList.add('badge-muted');
    el.loginBtn.classList.remove('hidden');
    el.profileMenu.classList.add('hidden');
    el.manageTradersSection.classList.add('hidden');
    el.manageInstrumentsSection.classList.add('hidden');
    el.resetDataBtn.classList.add('hidden');
    el.changePasswordBtn.classList.add('hidden');
    renderInstrumentSpecTable();
    return;
  }

  el.loginBtn.classList.add('hidden');
  el.profileMenu.classList.remove('hidden');
  el.profileName.textContent = state.auth.display_name || state.auth.username || 'Authenticated';
  el.profileRole.textContent = `${state.auth.role}${state.auth.must_change_password ? ' · password update required' : ''}`;
  el.sessionStatus.textContent = state.auth.must_change_password
    ? `${state.auth.role} · change password required`
    : `${state.auth.role} logged in`;
  el.sessionStatus.classList.remove('badge-muted');
  el.manageTradersSection.classList.toggle('hidden', !isAdmin());
  el.manageInstrumentsSection.classList.toggle('hidden', !isAdmin());
  el.resetDataBtn.classList.toggle('hidden', !isAdmin());
  el.changePasswordBtn.classList.toggle('hidden', state.auth.source === 'master-password');
  renderInstrumentSpecTable();
}

function updateTradeFormPermissions() {
  const traders = getSelectableTraders();
  el.trader.innerHTML = '<option value="">Select trader</option>' + traders.map((trader) => `<option value="${trader.id}">${trader.display_name}</option>`).join('');

  if (isTrader()) {
    const ownTrader = state.traders.find((trader) => trader.id === state.auth.trader_id)
      || traders.find((trader) => trader.display_name === state.auth.display_name);
    if (ownTrader) el.trader.value = ownTrader.id;
    el.trader.disabled = true;
  } else {
    el.trader.disabled = false;
  }

  if (!state.editId && !isTrader()) {
    el.trader.value = '';
  }
}

function updateAnalyticsPermissions() {
  const options = ['<option value="all">All traders</option>']
    .concat(getSelectableTraders().map((trader) => `<option value="${trader.display_name}">${trader.display_name}</option>`));
  el.analyticsTrader.innerHTML = options.join('');
  if (isTrader()) {
    el.analyticsTrader.value = state.auth.display_name;
    el.analyticsTrader.disabled = true;
  } else {
    if (!Array.from(el.analyticsTrader.options).some((option) => option.value === el.analyticsTrader.value)) {
      el.analyticsTrader.value = 'all';
    }
    el.analyticsTrader.disabled = false;
  }
}

function updateFilterOptions(trades) {
  const traders = Array.from(new Set(trades.map((t) => t.trader))).sort();
  const pairs = Array.from(new Set(trades.map((t) => t.pair))).sort();
  const currentFilterTrader = el.filterTrader.value || 'all';
  const currentPair = el.filterPair.value || 'all';

  el.filterTrader.innerHTML = '<option value="all">All</option>' + traders.map((trader) => `<option value="${trader}">${trader}</option>`).join('');
  el.filterPair.innerHTML = '<option value="all">All</option>' + pairs.map((pair) => `<option value="${pair}">${pair}</option>`).join('');
  el.filterTrader.value = traders.includes(currentFilterTrader) ? currentFilterTrader : 'all';
  el.filterPair.value = pairs.includes(currentPair) ? currentPair : 'all';
}

function buildTraderMetrics(trades) {
  const starting = Number(config.DEFAULT_STARTING_BALANCE || 100);
  const map = new Map();
  [...trades].sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date)).forEach((trade) => {
    if (!map.has(trade.trader)) {
      map.set(trade.trader, {
        trader: trade.trader,
        totalTrades: 0,
        wins: 0,
        losses: 0,
        grossWin: 0,
        grossLoss: 0,
        totalPL: 0
      });
    }
    const item = map.get(trade.trader);
    item.totalTrades += 1;
    item.totalPL += trade.profit_loss;
    if (trade.profit_loss >= 0) {
      item.wins += 1;
      item.grossWin += trade.profit_loss;
    } else {
      item.losses += 1;
      item.grossLoss += Math.abs(trade.profit_loss);
    }
  });

  return Array.from(map.values()).map((metric) => {
    const winRate = metric.totalTrades ? (metric.wins / metric.totalTrades) * 100 : 0;
    const profitFactor = metric.grossLoss === 0 ? metric.grossWin : metric.grossWin / metric.grossLoss;
    return {
      ...metric,
      balance: starting + metric.totalPL,
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
  el.leaderboard.innerHTML = metrics.map((metric, index) => `
    <div class="rank-row">
      <div class="rank-num">${index + 1}</div>
      <div>
        <strong>${metric.trader}</strong>
        <div class="subtle">Win rate ${metric.winRate.toFixed(1)}% · PF ${metric.profitFactor.toFixed(2)} · Balance ${currency(metric.balance)}</div>
      </div>
      <div class="${metric.totalPL >= 0 ? 'pl-pos' : 'pl-neg'}">${currency(metric.totalPL)}</div>
    </div>
  `).join('');
}

function renderSummary(metrics, trades) {
  const totalPL = trades.reduce((sum, trade) => sum + trade.profit_loss, 0);
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

  const startingBalance = Number(config.DEFAULT_STARTING_BALANCE || 100);
  const sorted = [...trades].sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date));
  const series = [startingBalance];
  let running = startingBalance;
  for (const trade of sorted) {
    running += trade.profit_loss;
    series.push(running);
  }

  const min = Math.min(...series);
  const max = Math.max(...series);
  const pad = 24;
  const width = canvas.width - pad * 2;
  const height = canvas.height - pad * 2;
  const x = (index) => pad + (index / Math.max(series.length - 1, 1)) * width;
  const y = (value) => pad + (1 - (value - min) / Math.max(max - min, 1)) * height;

  ctx.strokeStyle = '#344253';
  ctx.beginPath();
  ctx.moveTo(pad, y(startingBalance));
  ctx.lineTo(canvas.width - pad, y(startingBalance));
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.strokeStyle = '#2f81f7';
  ctx.beginPath();
  series.forEach((value, index) => {
    if (index === 0) ctx.moveTo(x(index), y(value));
    else ctx.lineTo(x(index), y(value));
  });
  ctx.stroke();
}

function getHistoryWindowStart() {
  const now = new Date();
  switch (el.historyPreset.value) {
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

function updateViewLabel() {
  const traderLabel = el.analyticsTrader.value === 'all' ? 'All traders' : el.analyticsTrader.value;
  const historyLabel = el.historyPreset.selectedOptions[0]?.textContent || 'All trades';
  el.viewLabel.textContent = `${traderLabel} · ${historyLabel}`;
  el.chartHint.textContent = `Showing ${historyLabel.toLowerCase()} for ${traderLabel.toLowerCase()}.`;
}

function canModifyTrade(trade) {
  if (!state.auth || state.auth.must_change_password) return false;
  if (state.auth.role === 'admin') return true;
  return trade.trader_id && trade.trader_id === state.auth.trader_id;
}

function renderTradeTable(trades) {
  if (!trades.length) {
    el.tradeTableBody.innerHTML = '';
    el.tableEmpty.classList.remove('hidden');
    return;
  }
  el.tableEmpty.classList.add('hidden');
  el.tradeTableBody.innerHTML = trades.map((trade) => {
    const canModify = canModifyTrade(trade);
    const actionCell = canModify
      ? `<button class="btn btn-secondary" data-action="edit" data-id="${trade.id}">Edit</button> <button class="btn btn-danger" data-action="delete" data-id="${trade.id}">Delete</button>`
      : !state.auth
        ? `<button class="btn btn-secondary" data-action="edit" data-id="${trade.id}">Edit</button> <button class="btn btn-secondary" data-action="delete" data-id="${trade.id}">Delete</button>`
        : '<span class="subtle">Read-only</span>';
    return `
      <tr>
        <td>${new Date(trade.trade_date).toLocaleString()}</td>
        <td>${trade.trader}</td>
        <td>${trade.pair}</td>
        <td>${formatTradeSide(trade.type)}</td>
        <td>${Number(trade.lot_size || 0).toFixed(2)}</td>
        <td>${trade.entry_price}</td>
        <td>${trade.exit_price}</td>
        <td class="${trade.profit_loss >= 0 ? 'pl-pos' : 'pl-neg'}">${currency(trade.profit_loss)}</td>
        <td>${formatRiskRewardRatio(calculateRiskRewardRatio(trade))}</td>
        <td>${(trade.notes || '').replace(/</g, '&lt;')}</td>
        <td>${actionCell}</td>
      </tr>
    `;
  }).join('');
}

function applyFiltersAndRender() {
  const analyticsTrader = el.analyticsTrader.value;
  const historyStart = getHistoryWindowStart();
  const filterTrader = el.filterTrader.value;
  const filterPair = el.filterPair.value;
  const filterType = el.filterType.value;
  const query = el.searchInput.value.trim().toLowerCase();

  let trades = [...state.allTrades];
  if (analyticsTrader !== 'all') trades = trades.filter((trade) => trade.trader === analyticsTrader);
  if (historyStart) trades = trades.filter((trade) => new Date(trade.trade_date) >= historyStart);
  if (filterTrader !== 'all') trades = trades.filter((trade) => trade.trader === filterTrader);
  if (filterPair !== 'all') trades = trades.filter((trade) => trade.pair === filterPair);
  if (filterType !== 'all') trades = trades.filter((trade) => trade.type === filterType);
  if (query) trades = trades.filter((trade) => trade.trader.toLowerCase().includes(query) || trade.pair.toLowerCase().includes(query));

  switch (el.sortBy.value) {
    case 'date_asc':
      trades.sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date));
      break;
    case 'pl_desc':
      trades.sort((a, b) => b.profit_loss - a.profit_loss);
      break;
    case 'pl_asc':
      trades.sort((a, b) => a.profit_loss - b.profit_loss);
      break;
    default:
      trades.sort((a, b) => new Date(b.trade_date) - new Date(a.trade_date));
  }

  state.filteredTrades = trades;
  const metrics = buildTraderMetrics(trades);
  renderSummary(metrics, trades);
  renderLeaderboard(metrics);
  drawEquityCurve(trades);
  renderTradeTable(trades);
  updateViewLabel();
}

function getSelectedTraderMeta() {
  const selectedId = el.trader.value;
  return getSelectableTraders().find((trader) => trader.id === selectedId) || null;
}

function validateTradePayload(payload) {
  const required = ['trader', 'pair', 'type', 'lot_size', 'entry_price', 'stop_loss', 'take_profit', 'exit_price', 'trade_date'];
  for (const key of required) {
    if (payload[key] === '' || payload[key] === null || payload[key] === undefined || Number.isNaN(payload[key])) return `${key} is required`;
  }
  if (!['buy', 'sell'].includes(normalizeTradeType(payload.type))) return 'Trade type must be buy or sell';
  if (Number(payload.lot_size) <= 0) return 'Lot size must be greater than zero';
  if (Number(payload.entry_price) <= 0 || Number(payload.exit_price) <= 0) return 'Prices must be positive';
  return null;
}

function getFormPayload() {
  const traderMeta = getSelectedTraderMeta();
  const payload = {
    trader_id: traderMeta?.id?.startsWith('legacy:') ? null : traderMeta?.id || null,
    trader: traderMeta?.display_name || '',
    pair: el.pair.value.trim().toUpperCase(),
    type: normalizeTradeType(el.type.value),
    lot_size: Number(el.lotSize.value),
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

function updateLivePL() {
  const payload = getFormPayload();
  if (!Number.isFinite(payload.entry_price) || !Number.isFinite(payload.exit_price)) return;
  const pl = calculatePL(payload);
  el.calculatedPL.textContent = currency(pl);
  el.calculatedPL.className = pl >= 0 ? 'pl-pos' : 'pl-neg';
}

function fillForm(trade) {
  el.tradeId.value = trade.id;
  const matching = getSelectableTraders().find((trader) => trader.display_name === trade.trader || trader.id === trade.trader_id);
  if (matching) el.trader.value = matching.id;
  el.pair.value = trade.pair;
  el.type.value = normalizeTradeType(trade.type);
  el.lotSize.value = trade.lot_size;
  el.entryPrice.value = trade.entry_price;
  el.stopLoss.value = trade.stop_loss;
  el.takeProfit.value = trade.take_profit;
  el.exitPrice.value = trade.exit_price;
  el.notes.value = trade.notes || '';
  el.tradeDate.value = formatLocalDateTime(new Date(trade.trade_date));
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
  el.calculatedPL.className = '';
  setTradeDateValue(new Date());
  updateTradeFormPermissions();
}

async function api(functionName, payload = {}) {
  const res = await fetch(`/.netlify/functions/${functionName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function openAuthModal(role = 'trader') {
  state.authMode = role;
  el.authModal.classList.remove('hidden');
  el.authModal.setAttribute('aria-hidden', 'false');
  el.authError.textContent = '';
  el.authUsername.value = role === 'admin' && state.auth?.source === 'master-password' ? '' : (state.auth?.username || '');
  el.authPassword.value = '';
  el.authModeHint.textContent = role === 'admin'
    ? 'Use an admin username and password, or leave username empty and enter the master admin password.'
    : 'Use your username and password.';
  el.authUsername.focus();
}

function closeAuthModal() {
  el.authModal.classList.add('hidden');
  el.authModal.setAttribute('aria-hidden', 'true');
}

function openChangePasswordModal(force = false) {
  el.changePasswordModal.classList.remove('hidden');
  el.changePasswordModal.setAttribute('aria-hidden', 'false');
  el.changePasswordError.textContent = '';
  el.changePasswordCurrent.value = '';
  el.changePasswordNew.value = '';
  el.changePasswordConfirm.value = '';
  el.changePasswordCancelBtn.classList.toggle('hidden', force);
  el.changePasswordCurrent.focus();
}

function closeChangePasswordModal() {
  el.changePasswordModal.classList.add('hidden');
  el.changePasswordModal.setAttribute('aria-hidden', 'true');
}

async function ensureAuthenticated(targetRole = null) {
  if (state.auth && !state.auth.must_change_password && (!targetRole || state.auth.role === targetRole || state.auth.role === 'admin')) {
    return state.auth;
  }
  if (state.auth?.must_change_password) {
    openChangePasswordModal(true);
    throw new Error('Password change is required before continuing');
  }
  openAuthModal(targetRole || 'trader');
  state.forceAuthRole = targetRole;
  return new Promise((resolve, reject) => {
    state.pendingAuthResolver = resolve;
    state.pendingAuthRejecter = reject;
  });
}

async function loadTrades() {
  el.connectionStatus.textContent = 'Loading data...';
  const { data, error } = await supabaseClient.from('trades').select('*').order('trade_date', { ascending: false });
  if (error) {
    el.connectionStatus.textContent = 'Load failed';
    showToast(error.message, 'error');
    return;
  }
  state.allTrades = (data || []).map((trade) => {
    const normalized = {
      ...trade,
      type: normalizeTradeType(trade.type),
      lot_size: Number(trade.lot_size ?? 0),
      entry_price: Number(trade.entry_price ?? 0),
      stop_loss: Number(trade.stop_loss ?? 0),
      take_profit: Number(trade.take_profit ?? 0),
      exit_price: Number(trade.exit_price ?? 0),
      profit_loss: Number(trade.profit_loss ?? 0)
    };
    normalized.profit_loss = calculatePL(normalized);
    return normalized;
  });
  updateFilterOptions(state.allTrades);
  updateTradeFormPermissions();
  updateAnalyticsPermissions();
  applyFiltersAndRender();
  el.connectionStatus.textContent = 'Connected';
}

async function loadInstrumentSpecs() {
  try {
    const data = await api('list-instrument-specs');
    state.instrumentSpecs = data.instrument_specs || [];
    renderInstrumentSpecTable();
    updateLivePL();
  } catch (error) {
    state.instrumentSpecs = [];
    renderInstrumentSpecTable();
    showToast(error.message, 'error');
  }
}

async function loadTraderDirectory() {
  if (!state.auth) {
    state.traders = [];
    updateTradeFormPermissions();
    updateAnalyticsPermissions();
    updateSessionUI();
    return;
  }
  try {
    const data = await api('list-traders', { auth: getAuthPayload() });
    state.traders = data.traders || [];
    renderTraderAdminTable();
    updateTradeFormPermissions();
    updateAnalyticsPermissions();
    applyFiltersAndRender();
    updateSessionUI();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderTraderAdminTable() {
  if (!isAdmin()) {
    el.traderAdminTableBody.innerHTML = '';
    return;
  }
  el.traderAdminTableBody.innerHTML = state.traders.map((trader) => `
    <tr>
      <td>${trader.display_name}</td>
      <td>${trader.username}</td>
      <td>${trader.role}</td>
      <td>${trader.active ? 'Active' : 'Inactive'}</td>
      <td>${trader.last_login_at ? new Date(trader.last_login_at).toLocaleString() : 'Never'}</td>
      <td>
        <button class="btn btn-secondary" data-admin-action="edit-trader" data-id="${trader.id}">Edit</button>
        <button class="btn btn-secondary" data-admin-action="reset-password" data-id="${trader.id}">Reset Password</button>
      </td>
    </tr>
  `).join('');
}

function renderInstrumentSpecTable() {
  if (!isAdmin()) {
    el.instrumentSpecTableBody.innerHTML = '';
    return;
  }
  const rows = [...state.instrumentSpecs, ...DEFAULT_INSTRUMENT_SPECS]
    .sort((a, b) => Number(a.priority ?? 1000) - Number(b.priority ?? 1000));
  el.instrumentSpecTableBody.innerHTML = rows.map((spec) => `
    <tr>
      <td>${spec.label}</td>
      <td>${spec.symbol_pattern}</td>
      <td>${normalizeMatchType(spec.match_type)}</td>
      <td>${normalizePricingModel(spec.pricing_model)}</td>
      <td>${Number(spec.contract_size).toFixed(2)}</td>
      <td>${Number(spec.priority ?? 100)}</td>
      <td>${spec.active !== false ? 'Active' : 'Inactive'}</td>
      <td>${(spec.notes || '').replace(/</g, '&lt;') || '—'}</td>
      <td>${spec.is_default ? '<span class="subtle">Default</span>' : `<button class="btn btn-secondary" data-instrument-action="edit" data-id="${spec.id}">Edit</button> <button class="btn btn-danger" data-instrument-action="delete" data-id="${spec.id}">Delete</button>`}</td>
    </tr>
  `).join('');
}

function fillTraderAdminForm(trader) {
  el.manageTraderId.value = trader.id;
  el.manageUsername.value = trader.username;
  el.manageDisplayName.value = trader.display_name;
  el.manageRole.value = trader.role;
  el.manageActive.value = String(trader.active);
  el.manageTempPassword.value = '';
  el.manageSaveBtn.textContent = 'Update Trader';
  el.manageCancelBtn.classList.remove('hidden');
}

function clearTraderAdminForm() {
  el.traderAdminForm.reset();
  el.manageTraderId.value = '';
  el.manageRole.value = 'trader';
  el.manageActive.value = 'true';
  el.manageSaveBtn.textContent = 'Create Trader';
  el.manageCancelBtn.classList.add('hidden');
}

function fillInstrumentSpecForm(spec) {
  el.instrumentSpecId.value = spec.id;
  el.instrumentLabel.value = spec.label;
  el.instrumentSymbolPattern.value = spec.symbol_pattern;
  el.instrumentMatchType.value = normalizeMatchType(spec.match_type);
  el.instrumentPricingModel.value = normalizePricingModel(spec.pricing_model);
  el.instrumentContractSize.value = spec.contract_size;
  el.instrumentPriority.value = Number(spec.priority ?? 100);
  el.instrumentActive.value = String(spec.active !== false);
  el.instrumentNotes.value = spec.notes || '';
  el.instrumentSaveBtn.textContent = 'Update Rule';
  el.instrumentCancelBtn.classList.remove('hidden');
}

function clearInstrumentSpecForm() {
  el.instrumentSpecForm.reset();
  el.instrumentSpecId.value = '';
  el.instrumentMatchType.value = 'exact';
  el.instrumentPricingModel.value = 'contract';
  el.instrumentPriority.value = '100';
  el.instrumentActive.value = 'true';
  el.instrumentSaveBtn.textContent = 'Create Rule';
  el.instrumentCancelBtn.classList.add('hidden');
}

async function saveTrade(event) {
  event.preventDefault();
  try {
    await ensureAuthenticated();
  } catch (error) {
    showToast(error.message, 'error');
    return;
  }

  const payload = getFormPayload();
  const validationError = validateTradePayload(payload);
  if (validationError) {
    showToast(validationError, 'error');
    return;
  }

  try {
    const functionName = state.editId ? 'update-trade' : 'create-trade';
    const body = state.editId
      ? { id: state.editId, trade: payload, auth: getAuthPayload() }
      : { trade: payload, auth: getAuthPayload() };
    await api(functionName, body);
    showToast(state.editId ? 'Trade updated successfully.' : 'Trade created successfully.');
    clearForm();
    await loadTrades();
  } catch (error) {
    if (/Authentication is required|Invalid username|Password change is required/.test(error.message)) {
      clearSession();
      updateSessionUI();
    }
    showToast(error.message, 'error');
  }
}

async function deleteTrade(id) {
  if (!confirm('Delete this trade permanently?')) return;
  try {
    await ensureAuthenticated();
    await api('delete-trade', { id, auth: getAuthPayload() });
    showToast('Trade deleted.');
    await loadTrades();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function resetAllData() {
  if (!isAdmin()) {
    showToast('Only admin can reset all trades.', 'error');
    return;
  }
  if (!confirm('This will delete ALL trades. Continue?')) return;
  try {
    await ensureAuthenticated('admin');
    for (const trade of state.allTrades) {
      await api('delete-trade', { id: trade.id, auth: getAuthPayload() });
    }
    showToast('All trade data has been reset.');
    await loadTrades();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function exportCsv() {
  const rows = ['id,trader,pair,type,lot_size,entry_price,stop_loss,take_profit,exit_price,profit_loss,risk_reward_ratio,notes,trade_date,created_at'];
  state.filteredTrades.forEach((trade) => {
    const values = [
      trade.id,
      trade.trader,
      trade.pair,
      normalizeTradeType(trade.type),
      trade.lot_size,
      trade.entry_price,
      trade.stop_loss,
      trade.take_profit,
      trade.exit_price,
      trade.profit_loss,
      calculateRiskRewardRatio(trade)?.toFixed(2) || '',
      (trade.notes || '').replaceAll(',', ';'),
      trade.trade_date,
      trade.created_at
    ];
    rows.push(values.join(','));
  });
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `trades-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importCsv(file) {
  if (!file) return;
  try {
    await ensureAuthenticated();
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) throw new Error('CSV has no data rows.');
    const headers = lines[0].split(',').map((header) => header.trim());
    for (const line of lines.slice(1)) {
      const cells = line.split(',');
      const row = {};
      headers.forEach((header, index) => { row[header] = (cells[index] || '').trim(); });
      const traderMeta = isAdmin()
        ? getSelectableTraders().find((trader) => trader.display_name === row.trader)
        : state.traders.find((trader) => trader.id === state.auth.trader_id);
      const trade = {
        trader_id: traderMeta?.id?.startsWith('legacy:') ? null : traderMeta?.id || null,
        trader: isAdmin() ? (traderMeta?.display_name || row.trader) : state.auth.display_name,
        pair: row.pair,
        type: normalizeTradeType(row.type),
        lot_size: Number(row.lot_size),
        entry_price: Number(row.entry_price),
        stop_loss: Number(row.stop_loss),
        take_profit: Number(row.take_profit),
        exit_price: Number(row.exit_price),
        notes: row.notes || '',
        trade_date: new Date(row.trade_date).toISOString(),
        profit_loss: Number(row.profit_loss) || calculatePL({
          ...row,
          type: normalizeTradeType(row.type),
          lot_size: Number(row.lot_size)
        })
      };
      const validationError = validateTradePayload(trade);
      if (validationError) throw new Error(`Invalid row for ${trade.trader || 'unknown'}: ${validationError}`);
      await api('create-trade', { trade, auth: getAuthPayload() });
    }
    showToast(`Imported ${lines.length - 1} trades.`);
    await loadTrades();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    el.importCsvInput.value = '';
  }
}

async function submitAuth(event) {
  event.preventDefault();
  const mode = state.authMode;
  const username = el.authUsername.value.trim();
  const password = el.authPassword.value;
  try {
    const data = await api('auth-login', { mode, username, password });
    const session = {
      ...data.session,
      auth_mode: mode,
      username: data.session.username,
      display_name: data.session.display_name,
      password,
      expiresAt: Date.now() + (config.ADMIN_SESSION_MINUTES || 15) * 60 * 1000
    };
    saveSession(session);
    seedAuthenticatedTraderContext(session);
    closeAuthModal();
    updateSessionUI();
    updateTradeFormPermissions();
    updateAnalyticsPermissions();
    applyFiltersAndRender();
    await loadTraderDirectory();
    if (session.must_change_password) openChangePasswordModal(true);
    if (state.pendingAuthResolver) {
      state.pendingAuthResolver(session);
      state.pendingAuthResolver = null;
      state.pendingAuthRejecter = null;
    }
    showToast(`${session.role} login successful.`);
  } catch (error) {
    el.authError.textContent = error.message;
  }
}

function cancelAuth() {
  closeAuthModal();
  if (state.pendingAuthRejecter) state.pendingAuthRejecter(new Error('cancelled'));
  state.pendingAuthResolver = null;
  state.pendingAuthRejecter = null;
}

async function submitChangePassword(event) {
  event.preventDefault();
  try {
    const currentPassword = el.changePasswordCurrent.value;
    const newPassword = el.changePasswordNew.value;
    const confirmPassword = el.changePasswordConfirm.value;
    await api('change-password', {
      auth: { ...getAuthPayload(), password: currentPassword },
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword
    });
    saveSession({ ...state.auth, password: newPassword, must_change_password: false, expiresAt: Date.now() + (config.ADMIN_SESSION_MINUTES || 15) * 60 * 1000 });
    closeChangePasswordModal();
    updateSessionUI();
    showToast('Password updated successfully.');
  } catch (error) {
    el.changePasswordError.textContent = error.message;
  }
}

async function saveTraderAdmin(event) {
  event.preventDefault();
  try {
    await ensureAuthenticated('admin');
    const trader = {
      username: el.manageUsername.value,
      display_name: el.manageDisplayName.value,
      role: el.manageRole.value,
      active: el.manageActive.value === 'true',
      password: el.manageTempPassword.value
    };
    if (el.manageTraderId.value) {
      await api('update-trader', { id: el.manageTraderId.value, trader, auth: getAuthPayload() });
      if (trader.password) {
        await api('reset-trader-password', { id: el.manageTraderId.value, password: trader.password, auth: getAuthPayload() });
      }
      showToast('Trader updated successfully.');
    } else {
      await api('create-trader', { trader, auth: getAuthPayload() });
      showToast('Trader created successfully.');
    }
    clearTraderAdminForm();
    await loadTraderDirectory();
    await loadTrades();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function saveInstrumentSpec(event) {
  event.preventDefault();
  try {
    await ensureAuthenticated('admin');
    const instrumentSpec = {
      label: el.instrumentLabel.value.trim(),
      symbol_pattern: el.instrumentSymbolPattern.value.trim(),
      match_type: el.instrumentMatchType.value,
      pricing_model: el.instrumentPricingModel.value,
      contract_size: Number(el.instrumentContractSize.value),
      priority: Number(el.instrumentPriority.value),
      active: el.instrumentActive.value === 'true',
      notes: el.instrumentNotes.value.trim()
    };
    if (el.instrumentSpecId.value) {
      await api('update-instrument-spec', { id: el.instrumentSpecId.value, instrument_spec: instrumentSpec, auth: getAuthPayload() });
      showToast('Instrument rule updated.');
    } else {
      await api('create-instrument-spec', { instrument_spec: instrumentSpec, auth: getAuthPayload() });
      showToast('Instrument rule created.');
    }
    clearInstrumentSpecForm();
    await loadInstrumentSpecs();
    await loadTrades();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleTraderAdminTableClick(event) {
  const button = event.target.closest('button[data-admin-action]');
  if (!button) return;
  const trader = state.traders.find((item) => item.id === button.dataset.id);
  if (!trader) return;

  if (button.dataset.adminAction === 'edit-trader') {
    fillTraderAdminForm(trader);
    return;
  }

  if (button.dataset.adminAction === 'reset-password') {
    const password = prompt(`Enter a temporary password for ${trader.display_name}`);
    if (!password) return;
    try {
      await api('reset-trader-password', { id: trader.id, password, auth: getAuthPayload() });
      showToast(`Temporary password reset for ${trader.display_name}.`);
    } catch (error) {
      showToast(error.message, 'error');
    }
  }
}

async function handleInstrumentSpecTableClick(event) {
  const button = event.target.closest('button[data-instrument-action]');
  if (!button) return;
  const spec = state.instrumentSpecs.find((item) => item.id === button.dataset.id);
  if (!spec) return;

  if (button.dataset.instrumentAction === 'edit') {
    fillInstrumentSpecForm(spec);
    return;
  }

  if (button.dataset.instrumentAction === 'delete') {
    if (!confirm(`Delete instrument rule "${spec.label}"?`)) return;
    try {
      await ensureAuthenticated('admin');
      await api('delete-instrument-spec', { id: spec.id, auth: getAuthPayload() });
      showToast('Instrument rule deleted.');
      clearInstrumentSpecForm();
      await loadInstrumentSpecs();
      await loadTrades();
    } catch (error) {
      showToast(error.message, 'error');
    }
  }
}

function bindEvents() {
  [el.entryPrice, el.exitPrice, el.type, el.lotSize, el.pair].forEach((input) => input.addEventListener('input', updateLivePL));
  [el.analyticsTrader, el.historyPreset, el.filterTrader, el.filterPair, el.filterType, el.sortBy, el.searchInput].forEach((input) => input.addEventListener('input', applyFiltersAndRender));
  el.tradeForm.addEventListener('submit', saveTrade);
  el.cancelEditBtn.addEventListener('click', clearForm);
  el.resetDataBtn.addEventListener('click', resetAllData);
  el.exportCsvBtn.addEventListener('click', exportCsv);
  el.importCsvInput.addEventListener('change', (event) => importCsv(event.target.files[0]));
  el.setTradeNowBtn.addEventListener('click', () => setTradeDateValue(new Date()));
  el.setTradeHourAgoBtn.addEventListener('click', () => setTradeDateValue(new Date(Date.now() - 60 * 60 * 1000)));
  el.loginBtn.addEventListener('click', () => openAuthModal('trader'));
  el.logoutBtn.addEventListener('click', async () => {
    clearSession();
    state.traders = [];
    updateSessionUI();
    updateTradeFormPermissions();
    updateAnalyticsPermissions();
    applyFiltersAndRender();
    showToast('Logged out.');
  });
  el.changePasswordBtn.addEventListener('click', () => openChangePasswordModal(false));
  el.authModeTraderBtn.addEventListener('click', () => openAuthModal('trader'));
  el.authModeAdminBtn.addEventListener('click', () => openAuthModal('admin'));
  el.authForm.addEventListener('submit', submitAuth);
  el.authCancelBtn.addEventListener('click', cancelAuth);
  el.changePasswordForm.addEventListener('submit', submitChangePassword);
  el.changePasswordCancelBtn.addEventListener('click', closeChangePasswordModal);
  el.traderAdminForm.addEventListener('submit', saveTraderAdmin);
  el.manageCancelBtn.addEventListener('click', clearTraderAdminForm);
  el.traderAdminTableBody.addEventListener('click', handleTraderAdminTableClick);
  el.instrumentSpecForm.addEventListener('submit', saveInstrumentSpec);
  el.instrumentCancelBtn.addEventListener('click', clearInstrumentSpecForm);
  el.instrumentSpecTableBody.addEventListener('click', handleInstrumentSpecTableClick);

  document.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const trade = state.allTrades.find((item) => String(item.id) === String(button.dataset.id));
    if (!trade) return;
    if (button.dataset.action === 'edit') {
      if (!canModifyTrade(trade)) {
        ensureAuthenticated().catch(() => {});
        return;
      }
      fillForm(trade);
    }
    if (button.dataset.action === 'delete') {
      if (!canModifyTrade(trade)) {
        ensureAuthenticated().catch(() => {});
        return;
      }
      deleteTrade(trade.id);
    }
  });
}

async function init() {
  if (!config?.SUPABASE_URL || !config?.SUPABASE_ANON_KEY) {
    showToast('Missing config.js values.', 'error');
    el.connectionStatus.textContent = 'Configuration error';
    return;
  }
  state.auth = loadSession();
  updateSessionUI();
  bindEvents();
  setTradeDateValue(new Date());
  clearInstrumentSpecForm();
  await loadInstrumentSpecs();
  await loadTrades();
  await loadTraderDirectory();
  setInterval(() => {
    const valid = loadSession();
    if (!valid && state.auth) {
      clearSession();
      updateSessionUI();
      applyFiltersAndRender();
      showToast('Session expired.', 'error');
    }
    state.auth = valid;
  }, 30000);
}

init();
