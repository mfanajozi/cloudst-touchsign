const base = process.env.NEON_AUTH_BASE_URL || process.env.NEON_AUTH_URL;
const jwks = process.env.NEON_AUTH_JWKS_URL || process.env.NEON_JWKS_URL;
if (!base || !jwks) {
 console.error('Auth checks blocked: supply NEON_AUTH_BASE_URL and NEON_AUTH_JWKS_URL.');
 process.exit(1);
}
for (const [name, address, validate] of [
 ['Auth session endpoint', base.replace(/\/$/, '') + '/get-session', () => true],
 ['JWKS endpoint', jwks, data => Array.isArray(data.keys) && data.keys.length > 0 && data.keys.every(key => key.kty && key.kid)],
]) {
 try {
  if (new URL(address).protocol !== 'https:') throw new Error('HTTPS required');
  const response = await fetch(address, {signal: AbortSignal.timeout(15000), redirect: 'error'});
  if (!response.ok) { console.error(`FAIL ${name}: HTTP ${response.status}`); process.exitCode = 1; continue; }
  const data = await response.json();
  if (!validate(data)) throw new Error('Unexpected endpoint response');
  console.log(`PASS ${name}`);
 } catch(error) {
  console.error(`FAIL ${name}: ${error.cause?.code || error.code || error.name}`);
  process.exitCode = 1;
 }
}
