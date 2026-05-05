/**
 * ClinicShield — Save API
 * api/save.js
 *
 * Saves clinic dashboard data to Upstash KV.
 * Validates licence key before saving.
 * Data stored as cs:data:<KEY>
 */

async function kvGet(key) {
  const res = await fetch(
    `${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`,
    { headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` } }
  );
  const json = await res.json();
  return json.result ?? null;
}

async function kvSet(key, value) {
  const encoded = typeof value === 'string'
    ? encodeURIComponent(value)
    : encodeURIComponent(JSON.stringify(value));
  await fetch(`${process.env.KV_REST_API_URL}/set/${encodeURIComponent(key)}/${encoded}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { licenceKey, data } = req.body || {};
  if (!licenceKey) return res.status(400).json({ error: 'Missing licenceKey' });
  if (!data) return res.status(400).json({ error: 'Missing data' });

  const keyUpper = licenceKey.trim().toUpperCase();

  try {
    // Validate licence exists and is not revoked
    const licenceRaw = await kvGet(`cs:licence:${keyUpper}`);
    if (!licenceRaw || licenceRaw === 'revoked') {
      return res.status(401).json({ error: 'Invalid or revoked licence key' });
    }

    // Save clinic data
    await kvSet(`cs:data:${keyUpper}`, data);

    console.log(`[ClinicShield Save] ✅ Data saved for key: ${keyUpper}`);
    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('[ClinicShield Save] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
