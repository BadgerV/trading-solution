const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const DEFAULT_INSTRUMENT_SPECS = [
  { label: 'Gold', symbol_pattern: 'XAU', match_type: 'prefix', pricing_model: 'contract', contract_size: 100, priority: 10, active: true, notes: 'Gold CFDs' },
  { label: 'Silver', symbol_pattern: 'XAG', match_type: 'prefix', pricing_model: 'contract', contract_size: 5000, priority: 11, active: true, notes: 'Silver CFDs' },
  { label: 'Platinum/Palladium', symbol_pattern: 'XPT', match_type: 'prefix', pricing_model: 'contract', contract_size: 100, priority: 12, active: true, notes: 'Precious metals' },
  { label: 'Oil', symbol_pattern: 'USOIL', match_type: 'exact', pricing_model: 'contract', contract_size: 100, priority: 20, active: true, notes: 'US Oil CFD' },
  { label: 'Brent', symbol_pattern: 'UKOIL', match_type: 'exact', pricing_model: 'contract', contract_size: 100, priority: 21, active: true, notes: 'Brent Oil CFD' },
  { label: 'Natural Gas', symbol_pattern: 'NGAS', match_type: 'prefix', pricing_model: 'contract', contract_size: 10000, priority: 22, active: true, notes: 'Natural gas CFD' }
];

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  };
}

function validateAdminPassword(password) {
  const actual = process.env.ADMIN_PASSWORD;
  return typeof password === 'string' && actual && password === actual;
}

function getSupabaseAdmin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Server environment is not configured.');
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
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

function getDefaultInstrumentSpecs() {
  return DEFAULT_INSTRUMENT_SPECS.map((spec) => ({ ...spec, is_default: true }));
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

function resolveTradeSpec(symbol = '', instrumentSpecs = []) {
  const activeSpecs = [...(instrumentSpecs || []), ...getDefaultInstrumentSpecs()]
    .filter((spec) => spec && spec.active !== false && Number(spec.contract_size) > 0)
    .sort((a, b) => Number(a.priority ?? 1000) - Number(b.priority ?? 1000));

  const matchingSpec = activeSpecs.find((spec) => matchInstrumentSpec(symbol, spec));
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

function calculateTradePL(trade = {}, instrumentSpecs = []) {
  const spec = resolveTradeSpec(trade.pair, instrumentSpecs);
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

function normalizeTrade(trade = {}, instrumentSpecs = []) {
  const normalized = {
    trader_id: trade.trader_id || null,
    trader: String(trade.trader || '').trim(),
    pair: String(trade.pair || '').trim().toUpperCase(),
    type: normalizeTradeType(trade.type),
    lot_size: Number(trade.lot_size),
    entry_price: Number(trade.entry_price),
    stop_loss: Number(trade.stop_loss),
    take_profit: Number(trade.take_profit),
    exit_price: Number(trade.exit_price),
    profit_loss: Number(trade.profit_loss),
    notes: String(trade.notes || '').trim(),
    trade_date: trade.trade_date
  };

  if (!normalized.profit_loss && normalized.profit_loss !== 0) {
    normalized.profit_loss = calculateTradePL(normalized, instrumentSpecs);
  }
  return normalized;
}

function validateTrade(trade) {
  const required = ['trader', 'pair', 'type', 'lot_size', 'entry_price', 'stop_loss', 'take_profit', 'exit_price', 'trade_date'];
  for (const key of required) {
    if (trade[key] === '' || trade[key] === null || trade[key] === undefined || Number.isNaN(trade[key])) return `${key} is required`;
  }
  if (!['buy', 'sell'].includes(normalizeTradeType(trade.type))) return 'type must be buy or sell';
  if (trade.lot_size <= 0) return 'lot_size must be greater than zero';
  if (trade.entry_price <= 0 || trade.exit_price <= 0) return 'prices must be positive';
  return null;
}

function sanitizeInstrumentSpec(spec) {
  if (!spec) return null;
  return {
    id: spec.id,
    label: String(spec.label || '').trim(),
    symbol_pattern: String(spec.symbol_pattern || '').trim(),
    match_type: normalizeMatchType(spec.match_type),
    pricing_model: normalizePricingModel(spec.pricing_model),
    contract_size: Number(spec.contract_size),
    priority: Number(spec.priority ?? 100),
    active: spec.active !== false,
    notes: String(spec.notes || '').trim(),
    created_at: spec.created_at,
    updated_at: spec.updated_at
  };
}

function validateInstrumentSpecPayload(payload = {}) {
  const label = String(payload.label || '').trim();
  const symbolPattern = String(payload.symbol_pattern || '').trim();
  const contractSize = Number(payload.contract_size);
  const priority = Number(payload.priority ?? 100);
  if (!label) return 'label is required';
  if (!symbolPattern) return 'symbol_pattern is required';
  if (!Number.isFinite(contractSize) || contractSize <= 0) return 'contract_size must be greater than zero';
  if (!Number.isFinite(priority)) return 'priority must be a number';
  if (normalizeMatchType(payload.match_type) === 'regex') {
    try {
      new RegExp(symbolPattern, 'i');
    } catch (error) {
      return 'symbol_pattern must be a valid regex';
    }
  }
  return null;
}

async function listInstrumentSpecs(supabase, { includeInactive = true } = {}) {
  let query = supabase
    .from('instrument_specs')
    .select('*')
    .order('priority', { ascending: true })
    .order('label', { ascending: true });
  if (!includeInactive) query = query.eq('active', true);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(sanitizeInstrumentSpec);
}

function normalizeUsername(username = '') {
  return String(username).trim().toLowerCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { passwordHash, passwordSalt: salt };
}

function verifyPassword(password, salt, hash) {
  const candidate = crypto.scryptSync(password, salt, 64);
  const actual = Buffer.from(hash, 'hex');
  if (candidate.length !== actual.length) return false;
  return crypto.timingSafeEqual(candidate, actual);
}

function sanitizeTrader(trader) {
  if (!trader) return null;
  return {
    id: trader.id,
    username: trader.username,
    display_name: trader.display_name,
    role: trader.role,
    active: trader.active,
    must_change_password: trader.must_change_password,
    last_login_at: trader.last_login_at,
    created_at: trader.created_at,
    updated_at: trader.updated_at
  };
}

async function findTraderByUsername(supabase, username) {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;
  const { data, error } = await supabase
    .from('traders')
    .select('*')
    .eq('username', normalized)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function authenticateRequest(body, options = {}) {
  const supabase = getSupabaseAdmin();

  if (validateAdminPassword(body.password)) {
    return {
      supabase,
      auth: {
        type: 'admin',
        role: 'admin',
        source: 'master-password',
        display_name: 'Admin'
      }
    };
  }

  const authBody = body.auth || {};
  const username = normalizeUsername(authBody.username);
  const password = String(authBody.password || '');
  const mode = authBody.mode || 'trader';

  if (mode === 'admin' && !username && validateAdminPassword(password)) {
    return {
      supabase,
      auth: {
        type: 'admin',
        role: 'admin',
        source: 'master-password',
        display_name: 'Admin'
      }
    };
  }

  if (!username || !password) {
    throw Object.assign(new Error('Authentication is required'), { statusCode: 401 });
  }

  const trader = await findTraderByUsername(supabase, username);
  if (!trader || !verifyPassword(password, trader.password_salt, trader.password_hash)) {
    throw Object.assign(new Error('Invalid username or password'), { statusCode: 401 });
  }
  if (!trader.active) {
    throw Object.assign(new Error('This account is inactive'), { statusCode: 403 });
  }
  if (mode === 'admin' && trader.role !== 'admin') {
    throw Object.assign(new Error('Admin access is required'), { statusCode: 403 });
  }
  if (options.requireAdmin && trader.role !== 'admin') {
    throw Object.assign(new Error('Admin access is required'), { statusCode: 403 });
  }
  if (options.requirePasswordChangeCompleted && trader.must_change_password) {
    throw Object.assign(new Error('Password change is required before continuing'), { statusCode: 403 });
  }

  return {
    supabase,
    auth: {
      type: 'trader',
      trader_id: trader.id,
      username: trader.username,
      display_name: trader.display_name,
      role: trader.role,
      must_change_password: trader.must_change_password
    }
  };
}

function validateTraderPayload(payload = {}, { requirePassword = true } = {}) {
  const username = normalizeUsername(payload.username);
  const displayName = String(payload.display_name || '').trim();
  const role = payload.role === 'admin' ? 'admin' : 'trader';
  const password = String(payload.password || '');

  if (!username) return 'username is required';
  if (!displayName) return 'display_name is required';
  if (requirePassword && password.length < 6) return 'temporary password must be at least 6 characters';

  return null;
}

module.exports = {
  json,
  validateAdminPassword,
  getSupabaseAdmin,
  getDefaultInstrumentSpecs,
  resolveTradeSpec,
  calculateTradePL,
  normalizeTradeType,
  normalizeTrade,
  validateTrade,
  sanitizeInstrumentSpec,
  validateInstrumentSpecPayload,
  listInstrumentSpecs,
  normalizeUsername,
  hashPassword,
  verifyPassword,
  sanitizeTrader,
  findTraderByUsername,
  authenticateRequest,
  validateTraderPayload
};
