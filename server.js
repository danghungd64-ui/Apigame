// server.js — Tài Xỉu Auto API
const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 3000;
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS) || 30000; // 30s/phiên
const HISTORY_SIZE = 200;

// Session ID bắt đầu từ timestamp (hoặc ENV)
let sessionCounter = parseInt(process.env.START_SESSION) || Math.floor(Date.now() / 1000);
const sessions = [];

/* ====== RANDOM + CALC ====== */
function randomDice() {
  return [rand6(), rand6(), rand6()];
}
function rand6() { return Math.ceil(Math.random() * 6); }

function computeResult(dice) {
  const sum = dice.reduce((a, b) => a + b, 0);
  const result = sum >= 11 ? 'tài' : 'xỉu';
  const type = sum >= 11 ? 'tai' : 'xiu';
  return { sum, result, type };
}

/* ====== GENERATE 1 PHIÊN ====== */
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

/* ====== PREDICT (đảo cầu đơn giản) ====== */
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
    const limit = Math.min(parseInt(parsed.query.limit) || 50, 200);
    return json(res, {
      current_session: sessions[sessions.length - 1]?.session || '',
      total: sessions.length,
      history: sessions.slice(-limit).reverse()
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
generateSession(); // phiên đầu
setInterval(generateSession, INTERVAL_MS);

server.listen(PORT, () => {
  console.log(`🎲 Tài Xỉu Auto API: http://localhost:${PORT}`);
  console.log(`   Sinh phiên mới mỗi ${INTERVAL_MS / 1000}s`);
  console.log(`   Session bắt đầu: ${sessionCounter - 1}`);
});
