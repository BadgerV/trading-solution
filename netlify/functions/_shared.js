const { createClient } = require('@supabase/supabase-js');

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  };
}

function validatePassword(password) {
  const actual = process.env.ADMIN_PASSWORD;
  return typeof password === 'string' && actual && password === actual;
}

function getSupabaseAdmin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Server environment is not configured.');
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function normalizeTrade(trade = {}) {
  const normalized = {
    trader: String(trade.trader || '').trim(),
    pair: String(trade.pair || '').trim().toUpperCase(),
    type: String(trade.type || '').trim().toLowerCase(),
    entry_price: Number(trade.entry_price),
    stop_loss: Number(trade.stop_loss),
    take_profit: Number(trade.take_profit),
    exit_price: Number(trade.exit_price),
    profit_loss: Number(trade.profit_loss),
    notes: String(trade.notes || '').trim(),
    trade_date: trade.trade_date
  };

  if (!normalized.profit_loss && normalized.profit_loss !== 0) {
    normalized.profit_loss = normalized.type === 'short'
      ? normalized.entry_price - normalized.exit_price
      : normalized.exit_price - normalized.entry_price;
  }
  return normalized;
}

function validateTrade(trade) {
  const required = ['trader', 'pair', 'type', 'entry_price', 'stop_loss', 'take_profit', 'exit_price', 'trade_date'];
  for (const key of required) {
    if (trade[key] === '' || trade[key] === null || trade[key] === undefined || Number.isNaN(trade[key])) return `${key} is required`;
  }
  if (!['long', 'short'].includes(trade.type)) return 'type must be long or short';
  if (trade.entry_price <= 0 || trade.exit_price <= 0) return 'prices must be positive';
  return null;
}

module.exports = { json, validatePassword, getSupabaseAdmin, normalizeTrade, validateTrade };
