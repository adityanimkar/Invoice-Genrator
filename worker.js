export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API proxy for GSTIN lookup to bypass browser CORS
    if (url.pathname.startsWith('/api/lookup-gstin')) {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-api-key'
          }
        });
      }

      const gstin = url.searchParams.get('gstin');
      const apiKey = request.headers.get('x-api-key') || url.searchParams.get('apiKey') || 'gak_1c0be2e85f904483aa171f0bde46a225';

      if (!gstin) {
        return new Response(JSON.stringify({ error: 'GSTIN parameter is required' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      try {
        const cleanGstin = gstin.trim().toUpperCase();
        let apiUrl = `https://www.gstinapi.in/v1/gstin/${encodeURIComponent(cleanGstin)}`;
        let headers = {
          'x-api-key': apiKey,
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        };

        if (!apiKey.startsWith('gak_')) {
          apiUrl = `https://sheet.gstincheck.co.in/check/${encodeURIComponent(apiKey)}/${encodeURIComponent(cleanGstin)}`;
          headers = { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' };
        }

        const apiRes = await fetch(apiUrl, { headers });
        const data = await apiRes.json();

        return new Response(JSON.stringify(data), {
          status: apiRes.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache, no-store'
          }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
