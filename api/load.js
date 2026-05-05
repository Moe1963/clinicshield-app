/**
 * ClinicShield — Load API
 * api/load.js
 *
 * Validates licence key against Upstash KV and returns clinic data.
 * Keys stored as cs:licence:<KEY> (shared PassNexus KV, cs: prefix)
 */

async function kvGet(key) {
  const res = await fetch(
    `${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`,
    { headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` } }
  );
  const json = await res.json();
  return json.result ?? null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { licenceKey } = req.query;
  if (!licenceKey) return res.status(400).json({ error: 'Missing licenceKey' });

  const keyUpper = licenceKey.trim().toUpperCase();

  try {
    // Check licence is valid in KV
    const licenceRaw = await kvGet(`cs:licence:${keyUpper}`);

    if (!licenceRaw) {
      return res.status(401).json({ error: 'Invalid licence key' });
    }

    // Parse licence record
    let licence = null;
    try { licence = JSON.parse(licenceRaw); } catch(e) { licence = null; }

    // Check if revoked
    if (licenceRaw === 'revoked' || licence?.revoked) {
      return res.status(403).json({ error: 'Licence has been revoked' });
    }

    // Check expiry
    if (licence?.expiresAt && new Date(licence.expiresAt) < new Date()) {
      return res.status(403).json({ error: 'Licence has expired' });
    }

    // Load clinic data if it exists
    const clinicDataRaw = await kvGet(`cs:data:${keyUpper}`);
    let data = null;
    if (clinicDataRaw) {
      try { data = JSON.parse(clinicDataRaw); } catch(e) { data = null; }
    }

    // Return licence info + clinic data
    return res.status(200).json({
      ok: true,
      plan: licence?.plan || 'beta',
      maxStaff: licence?.maxStaff || 5,
      expiresAt: licence?.expiresAt || null,
      data: data
    });

  } catch (err) {
    console.error('[ClinicShield Load] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
