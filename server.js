// server.js — Tài Xỉu Auto API (có seed từ phiên 3260850)
const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 3000;
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS) || 30000;
const HISTORY_SIZE = 500;

/* ====== SEED DATA — 2 phiên có sẵn ====== */
const SEED = [
  { session: '3260850', dice: [1, 2, 1] },
  { session: '3260851', dice: [6, 6, 3] },
];

/* ====== STATE ====== */
let sessionCounter = 3260852; // phiên tiếp theo sẽ là 3260852
const sessions = [];

/* ====== CALC ====== */
function computeResult(dice) {
  const sum = dice.reduce((a, b) => a + b, 0);
  const result = sum >= 11 ? 'tài' : 'xỉu';
  const type = sum >= 11 ? 'tai' : 'xiu';
  return { sum, result, type };
}

/* ====== BUILD SEED SESSIONS ====== */
function buildSeed() {
  SEED.forEach((s, i) => {
    const { sum, result, type } = computeResult(s.dice);
    sessions.push({
      session: s.session,
      dice: s.dice,
      sum,
      result,
      type,
      time: new Date(Date.now() - (SEED.length - i) * INTERVAL_MS).toISOString(),
      seeded: true
    });
  });
  console.log('📌 Seed:');
  sessions.forEach(s => console.log(`   #${s.session}: ${s.dice.join('-')} = ${s.sum} → ${s.result.toUpperCase()}`));
}

/* ====== GENERATE NEW SESSION ====== */
function randomDice() {
  return [rand6(), rand6(), rand6()];
}
function rand6() { return Math.ceil(Math.random() * 6); }

function generateSession() {
  const session = String(sessionCounter++);
  const dice = randomDice();
  const { sum, result, type } = computeResult(dice);
  const rec = {
    session,
    dice,
    sum,
    result,
    type,
    time: new Date().toISOString()
  };
  sessions.push(rec);
  if (sessions.length > HISTORY_SIZE) sessions.shift();

  console.log(`[${new Date().toLocaleTimeString('vi-VN')}] Phiên ${session}: ${dice.join('-')} = ${sum} → ${result.toUpperCase()}`);
  return rec;
}

/* ====== PREDICT ====== */
function predict() {
  const w = sessions.slice(-10);
  if (!w.length) return { prediction: 'tài', confidence: 0, based_on: 0 };
  let tai = 0, xiu = 0;
  w.forEach(s => s.type === 'tai' ? tai++ : xiu++);
  const total = tai + xiu;
  let prediction, confidence;
  if (tai > xiu) { prediction = 'xỉu'; confidence = tai / total; }
  else if (xiu > tai) { prediction = 'tài'; confidence = xiu / total; }
  else { prediction = Math.random() > 0.5 ? 'tài' : 'xỉu'; confidence = 0.5; }
  return {
    prediction,
    confidence: Math.round(confidence * 100) / 100,
    based_on: total,
    breakdown: { tai, xiu }
  };
}

/* ====== CORS + JSON ====== */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};
function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...CORS });
  res.end(JSON.stringify(data, null, 2));
}

/* ====== ROUTES ====== */
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const p = parsed.pathname;
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }

  if (p === '/' || p === '/api') {
    return json(res, {
      name: 'Tài Xỉu Auto API',
      status: 'running',
      interval_ms: INTERVAL_MS,
      start_session: 3260850,
      next_session: sessionCounter,
      total_sessions: sessions.length,
      current_session: sessions[sessions.length - 1]?.session,
      endpoints: [
        'GET /api/health',
        'GET /api/current',
        'GET /api/history?limit=50',
        'GET /api/predict',
        'GET /api/config',
        'POST /api/generate'
      ]
    });
  }

  if (p === '/api/health') {
    return json(res, { status: 'ok', time: new Date().toISOString(), uptime: Math.floor(process.uptime()) });
  }

  if (p === '/api/current') {
    const cur = sessions[sessions.length - 1];
    return json(res, cur || { error: 'No session yet' });
  }

  if (p === '/api/history') {
    const limit = Math.min(parseInt(parsed.query.limit) || 50, 500);
    return json(res, {
      current_session: sessions[sessions.length - 1]?.session || '',
      total: sessions.length,
      history: sessions.slice(-limit).reverse()  // mới nhất lên đầu
    });
  }

  if (p === '/api/predict') {
    return json(res, {
      ...predict(),
      current_session: sessions[sessions.length - 1]?.session || '',
      time: new Date().toISOString()
    });
  }

  if (p === '/api/config') {
    const cur = sessions[sessions.length - 1];
    return json(res, {
      game_info: {
        current_session: cur?.session || '',
        last_result: cur || null,
        game_url: 'https://play-sunwin.agency',
        interval_ms: INTERVAL_MS,
        total: sessions.length
      },
      strategy_params: { analysis_window: 10, balance_threshold: 6 },
      system_status: {
        last_prediction: predict().prediction,
        last_updated: cur?.time || ''
      }
    });
  }

  if (p === '/api/generate' && req.method === 'POST') {
    const rec = generateSession();
    return json(res, { success: true, record: rec });
  }

  json(res, { error: 'Not found', path: p }, 404);
});

/* ====== START ====== */
buildSeed();                                // nạp 2 phiên seed
generateSession();                          // sinh phiên 3260852
setInterval(generateSession, INTERVAL_MS);  // tự sinh tiếp

server.listen(PORT, () => {
  console.log(`\n🎲 Tài Xỉu Auto API: http://localhost:${PORT}`);
  console.log(`   Sinh phiên mới mỗi ${INTERVAL_MS / 1000}s`);
  console.log(`   Phiên hiện tại: ${sessions[sessions.length - 1]?.session}`);
  console.log(`   Phiên tiếp theo sẽ là: ${sessionCounter}\n`);
});
