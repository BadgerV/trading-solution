const {
  json,
  authenticateRequest,
  normalizeTrade,
  validateTrade,
  findTraderByUsername,
  listInstrumentSpecs
} = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    if (!body.id) return json(400, { error: 'Trade id is required' });

    const { supabase, auth } = await authenticateRequest(body, { requirePasswordChangeCompleted: true });

    const { data: existing, error: existingError } = await supabase
      .from('trades')
      .select('*')
      .eq('id', body.id)
      .single();
    if (existingError || !existing) return json(404, { error: 'Trade not found' });
    if (auth.role !== 'admin' && existing.trader_id !== auth.trader_id) {
      return json(403, { error: 'You can only edit your own trades' });
    }

    const instrumentSpecs = await listInstrumentSpecs(supabase, { includeInactive: false });
    const trade = normalizeTrade(body.trade, instrumentSpecs);
    const validationError = validateTrade(trade);
    if (validationError) return json(400, { error: validationError });

    if (auth.role === 'admin') {
      if (!trade.trader && body.trade?.username) {
        const trader = await findTraderByUsername(supabase, body.trade.username);
        if (trader) {
          trade.trader_id = trader.id;
          trade.trader = trader.display_name;
        }
      }
    } else {
      trade.trader_id = auth.trader_id;
      trade.trader = auth.display_name;
    }

    const { data, error } = await supabase
      .from('trades')
      .update(trade)
      .eq('id', body.id)
      .select('*')
      .single();
    if (error) return json(400, { error: error.message });

    return json(200, { ok: true, trade: data });
  } catch (error) {
    return json(error.statusCode || 500, { error: error.message || 'Internal server error' });
  }
};
