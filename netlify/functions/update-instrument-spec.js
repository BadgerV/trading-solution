const {
  json,
  authenticateRequest,
  validateInstrumentSpecPayload,
  sanitizeInstrumentSpec: normalizeInstrumentSpec
} = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    if (!body.id) return json(400, { error: 'Instrument spec id is required' });

    const { supabase } = await authenticateRequest(body, { requireAdmin: true });
    const payload = body.instrument_spec || {};
    const validationError = validateInstrumentSpecPayload(payload);
    if (validationError) return json(400, { error: validationError });
    const spec = normalizeInstrumentSpec(payload);

    const { data, error } = await supabase
      .from('instrument_specs')
      .update({
        label: spec.label,
        symbol_pattern: spec.symbol_pattern,
        match_type: spec.match_type,
        pricing_model: spec.pricing_model,
        contract_size: spec.contract_size,
        priority: spec.priority,
        active: spec.active,
        notes: spec.notes
      })
      .eq('id', body.id)
      .select('*')
      .single();

    if (error) return json(400, { error: error.message });
    return json(200, { ok: true, instrument_spec: normalizeInstrumentSpec(data) });
  } catch (error) {
    return json(error.statusCode || 500, { error: error.message || 'Internal server error' });
  }
};
