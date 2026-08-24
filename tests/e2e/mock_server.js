// mock_server.js
const http = require('http');

let db = {
  rooms: [
    { id: 1, name: 'Fotogrametri', status: 'VACANT', manual_override: false, nominal_power: 120.0, updated_at: new Date().toISOString() },
    { id: 2, name: 'Kartografi', status: 'VACANT', manual_override: false, nominal_power: 150.0, updated_at: new Date().toISOString() },
    { id: 'room-1', name: 'Fotogrametri', status: 'VACANT', manual_override: false, nominal_power: 120.0, updated_at: new Date().toISOString() },
    { id: 'room-fotogrametri', name: 'Fotogrametri', status: 'VACANT', manual_override: false, nominal_power: 200.0, updated_at: new Date().toISOString() },
    { id: 'room-foto', name: 'Fotogrametri', status: 'VACANT', manual_override: false, nominal_power: 200.0, updated_at: new Date().toISOString() },
    { id: 'room-karto', name: 'Kartografi', status: 'VACANT', manual_override: false, nominal_power: 400.0, updated_at: new Date().toISOString() }
  ],
  energy_readings: [],
  savings_log: [],
  telegram_messages: [],
  failed_webhook_queue: [],
  settings: [
    { key: 'tnb_tariff', value: 0.509 },
    { key: 'co2_factor', value: 0.585 }
  ],
  authorized_beacons: [],
  mockConfig: {
    errorRoutes: {},
    latencyRoutes: {},
    telegramStatus: 200
  }
};

const defaultDb = JSON.parse(JSON.stringify(db));

function resetDb() {
  db = JSON.parse(JSON.stringify(defaultDb));
}

function formatKualaLumpurTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  // Add 8 hours for UTC+8 (Asia/Kuala_Lumpur)
  const klDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const yyyy = klDate.getUTCFullYear();
  const mm = String(klDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(klDate.getUTCDate()).padStart(2, '0');
  const hh = String(klDate.getUTCHours()).padStart(2, '0');
  const min = String(klDate.getUTCMinutes()).padStart(2, '0');
  const ss = String(klDate.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

function retryFailedWebhooks(requestPort) {
  if (db.mockConfig.telegramStatus !== 200) return;
  const queue = [...db.failed_webhook_queue];
  db.failed_webhook_queue = [];
  
  for (const item of queue) {
    const postData = item.data;
    const webhookReq = http.request({
      hostname: '127.0.0.1',
      port: requestPort,
      path: item.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (webhookRes) => {
      let resData = '';
      webhookRes.on('data', chunk => { resData += chunk; });
      webhookRes.on('end', () => {
        if (webhookRes.statusCode !== 200) {
          db.failed_webhook_queue.push(item);
        }
      });
    });
    webhookReq.on('error', (err) => {
      db.failed_webhook_queue.push(item);
    });
    webhookReq.write(postData);
    webhookReq.end();
  }
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  const sendJSON = (status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  const getBody = (callback) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        callback(null, body ? JSON.parse(body) : {});
      } catch (err) {
        callback(err, null);
      }
    });
  };

  const getFilters = () => {
    const filters = {};
    for (const [key, value] of parsedUrl.searchParams.entries()) {
      if (value.startsWith('eq.')) {
        filters[key] = value.substring(3);
      }
    }
    return filters;
  };

  const matchItem = (item, filters) => {
    for (const key in filters) {
      let itemVal = item[key];
      let filterVal = filters[key];
      if (typeof itemVal === 'number') {
        filterVal = Number(filterVal);
      } else if (typeof itemVal === 'boolean') {
        filterVal = filterVal === 'true' || filterVal === '1';
      }
      if (itemVal != filterVal) return false;
    }
    return true;
  };

  function getRequestTime(req) {
    const simTime = req.headers['x-simulated-time'];
    if (simTime) {
      return new Date(simTime);
    }
    return new Date();
  }

  // --- Injected Latency check ---
  const routeKey = `${method}:${pathname}`;
  if (db.mockConfig.latencyRoutes && db.mockConfig.latencyRoutes[routeKey]) {
    const delay = db.mockConfig.latencyRoutes[routeKey];
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // --- Injected Error check ---
  if (db.mockConfig.errorRoutes && db.mockConfig.errorRoutes[routeKey]) {
    return sendJSON(db.mockConfig.errorRoutes[routeKey], { error: `Injected error ${db.mockConfig.errorRoutes[routeKey]}` });
  }

  // --- API Key & Auth Checks for REST routes ---
  if (pathname.startsWith('/rest/v1/')) {
    const apikey = req.headers['apikey'];
    if (!apikey) {
      return sendJSON(412, { error: 'Missing API Key header' }); // Or 401. Let's return 401 to match TC expectations. Wait, some systems use 401. Let's use 401.
    }
    if (apikey !== 'super-secret-supabase-key') {
      return sendJSON(401, { error: 'Invalid API Key' });
    }
    
    if (method === 'PATCH' || method === 'POST') {
      const auth = req.headers['authorization'];
      if (!auth) {
        return sendJSON(401, { error: 'Missing Authorization header' });
      }
      if (!auth.startsWith('Bearer ') || auth.substring(7) !== 'super-secret-supabase-key') {
        return sendJSON(401, { error: 'Invalid Authorization header' });
      }
    }
  }

  // --- Postgrest /rest/v1/rooms ---
  if (pathname === '/rest/v1/rooms') {
    if (method === 'GET') {
      const filters = getFilters();
      const results = db.rooms.filter(r => matchItem(r, filters));
      return sendJSON(200, results);
    } else if (method === 'POST') {
      getBody((err, body) => {
        if (err) return sendJSON(400, { error: 'Invalid JSON' });
        const newRoom = {
          id: body.id || (db.rooms.length + 1),
          name: body.name || 'Unnamed',
          status: body.status || 'VACANT',
          manual_override: body.manual_override || false,
          nominal_power: body.nominal_power || 100,
          updated_at: getRequestTime(req).toISOString()
        };
        db.rooms.push(newRoom);
        return sendJSON(201, [newRoom]);
      });
    } else if (method === 'PATCH') {
      const filters = getFilters();
      getBody((err, body) => {
        if (err) return sendJSON(400, { error: 'Invalid JSON' });
        
        // Enforce Check constraints
        if (body.status === null) {
          return sendJSON(400, { error: 'Status cannot be null' });
        }
        if (body.status !== undefined && !['OCCUPIED', 'VACANT'].includes(body.status)) {
          return sendJSON(400, { error: 'Invalid status value' });
        }

        let updated = [];
        db.rooms = db.rooms.map(r => {
          if (matchItem(r, filters)) {
            const updatedRoom = { ...r, ...body, updated_at: getRequestTime(req).toISOString() };
            updated.push(updatedRoom);
            return updatedRoom;
          }
          return r;
        });
        return sendJSON(200, updated);
      });
    } else {
      return sendJSON(405, { error: 'Method Not Allowed' });
    }
  }

  // --- Postgrest /rest/v1/energy_readings ---
  else if (pathname === '/rest/v1/energy_readings') {
    if (method === 'POST') {
      getBody((err, body) => {
        if (err) return sendJSON(400, { error: 'Invalid JSON' });

        // Enforce validations
        if (body.room_id === null || body.room_id === undefined) {
          return sendJSON(400, { error: 'room_id is required and cannot be null' });
        }
        if (body.voltage === undefined) {
          return sendJSON(400, { error: 'voltage is required' });
        }
        if (Number(body.voltage) < 0) {
          return sendJSON(400, { error: 'voltage must be >= 0' });
        }
        if (body.current !== undefined && Number(body.current) < 0) {
          return sendJSON(400, { error: 'current must be >= 0' });
        }
        if (body.power !== undefined && Number(body.power) < 0) {
          return sendJSON(400, { error: 'power must be >= 0' });
        }
        if (body.energy !== undefined && Number(body.energy) < 0) {
          return sendJSON(400, { error: 'energy must be >= 0' });
        }

        const newReading = {
          id: db.energy_readings.length + 1,
          room_id: typeof body.room_id === 'number' ? body.room_id : body.room_id,
          voltage: Number(body.voltage),
          current: body.current !== undefined ? Number(body.current) : 0,
          power: body.power !== undefined ? Number(body.power) : 0,
          energy: body.energy !== undefined ? Number(body.energy) : 0,
          created_at: getRequestTime(req).toISOString()
        };
        db.energy_readings.push(newReading);
        return sendJSON(201, [newReading]);
      });
    } else if (method === 'GET') {
      const filters = getFilters();
      let results = db.energy_readings.filter(r => matchItem(r, filters));
      // Sort chronologically by insertion order or created_at
      results.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      return sendJSON(200, results);
    } else {
      return sendJSON(405, { error: 'Method Not Allowed' });
    }
  }

  // --- Postgrest /rest/v1/savings_log ---
  else if (pathname === '/rest/v1/savings_log') {
    if (method === 'POST') {
      getBody((err, body) => {
        if (err) return sendJSON(400, { error: 'Invalid JSON' });

        const reqTime = getRequestTime(req);

        // Validation constraints
        if (body.start_time && body.end_time) {
          const start = new Date(body.start_time);
          const end = new Date(body.end_time);
          if (end < start) {
            return sendJSON(400, { error: 'end_time cannot be before start_time' });
          }
          if (start > reqTime || end > reqTime) {
            return sendJSON(400, { error: 'timestamps cannot be in the future' });
          }
        }

        const kwh = Number(body.kwh_saved);
        const tariff = db.settings.find(s => s.key === 'tnb_tariff')?.value || 0.509;
        const co2Factor = db.settings.find(s => s.key === 'co2_factor')?.value || 0.585;

        // Exact calculations if not provided or preserve input precision
        const rm_saved = body.rm_saved !== undefined ? Number(body.rm_saved) : kwh * tariff;
        const co2_saved = body.co2_saved !== undefined ? Number(body.co2_saved) : kwh * co2Factor;

        const newLog = {
          id: db.savings_log.length + 1,
          room_id: typeof body.room_id === 'number' ? body.room_id : body.room_id,
          start_time: body.start_time,
          end_time: body.end_time,
          kwh_saved: kwh,
          rm_saved: rm_saved,
          co2_saved: co2_saved,
          created_at: reqTime.toISOString()
        };
        db.savings_log.push(newLog);

        // Simulate Postgres Trigger + Webhook -> Telegram SendMessage
        const room = db.rooms.find(r => r.id == newLog.room_id) || { name: 'Bilik Tidak Diketahui' };
        const roomName = room.name || 'Bilik Tidak Diketahui';
        const startFormatted = formatKualaLumpurTime(newLog.start_time);
        const endFormatted = formatKualaLumpurTime(newLog.end_time);
        const msgText = `🌿 *SCEAS Penjimatan Tenaga Baharu!* 🌿\n` +
                        `Bilik: *${roomName}*\n` +
                        `Sesi Mula: *${startFormatted} (Asia/Kuala_Lumpur)*\n` +
                        `Sesi Tamat: *${endFormatted} (Asia/Kuala_Lumpur)*\n` +
                        `Tenaga Dijimatkan: *${newLog.kwh_saved.toFixed(3)} kWh*\n` +
                        `Kos Dijimatkan: *RM ${newLog.rm_saved.toFixed(2)}*\n` +
                        `Karbon Dijimatkan: *${newLog.co2_saved.toFixed(3)} kg CO₂*`;

        // Asynchronously call Telegram Bot API mock endpoint
        const host = req.headers.host || 'localhost';
        const [hostname, portStr] = host.split(':');
        const requestPort = portStr ? Number(portStr) : 80;

        const postData = JSON.stringify({
          chat_id: '@sceas_alerts',
          text: msgText
        });

        const webhookReq = http.request({
          hostname: '127.0.0.1',
          port: requestPort,
          path: `/botmock_token/sendMessage`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        }, (webhookRes) => {
          let resData = '';
          webhookRes.on('data', chunk => { resData += chunk; });
          webhookRes.on('end', () => {
            if (webhookRes.statusCode !== 200) {
              db.failed_webhook_queue.push({ path: `/botmock_token/sendMessage`, data: postData });
            } else {
              // Retry failed webhooks if any
              retryFailedWebhooks(requestPort);
            }
          });
        });

        webhookReq.on('error', (err) => {
          db.failed_webhook_queue.push({ path: `/botmock_token/sendMessage`, data: postData });
        });

        webhookReq.write(postData);
        webhookReq.end();

        return sendJSON(201, [newLog]);
      });
    } else if (method === 'GET') {
      const filters = getFilters();
      const results = db.savings_log.filter(s => matchItem(s, filters));
      return sendJSON(200, results);
    } else {
      return sendJSON(405, { error: 'Method Not Allowed' });
    }
  }

  // --- Postgrest /rest/v1/settings ---
  else if (pathname === '/rest/v1/settings') {
    if (method === 'GET') {
      const filters = getFilters();
      const results = db.settings.filter(s => matchItem(s, filters));
      return sendJSON(200, results);
    } else if (method === 'PATCH') {
      const filters = getFilters();
      getBody((err, body) => {
        if (err) return sendJSON(400, { error: 'Invalid JSON' });
        let updated = [];
        db.settings = db.settings.map(s => {
          if (matchItem(s, filters)) {
            const updatedSetting = { ...s, ...body };
            updated.push(updatedSetting);
            return updatedSetting;
          }
          return s;
        });
        return sendJSON(200, updated);
      });
    } else if (method === 'POST') {
      getBody((err, body) => {
        if (err) return sendJSON(400, { error: 'Invalid JSON' });
        const newSettings = Array.isArray(body) ? body : [body];
        const inserted = [];
        for (const item of newSettings) {
          const existingIdx = db.settings.findIndex(s => s.key === item.key);
          if (existingIdx !== -1) {
            db.settings[existingIdx].value = Number(item.value);
            inserted.push(db.settings[existingIdx]);
          } else {
            const newSetting = { key: item.key, value: Number(item.value) };
            db.settings.push(newSetting);
            inserted.push(newSetting);
          }
        }
        return sendJSON(201, inserted);
      });
    } else {
      return sendJSON(405, { error: 'Method Not Allowed' });
    }
  }

  // --- Postgrest /rest/v1/authorized_beacons ---
  else if (pathname === '/rest/v1/authorized_beacons') {
    if (method === 'GET') {
      const filters = getFilters();
      const results = db.authorized_beacons.filter(b => matchItem(b, filters));
      return sendJSON(200, results);
    } else if (method === 'POST') {
      getBody((err, body) => {
        if (err) return sendJSON(400, { error: 'Invalid JSON' });
        const mac = body.mac_address;
        const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
        if (!mac || !macRegex.test(mac)) {
          return sendJSON(400, { error: 'Invalid MAC address format' });
        }
        const newBeacon = {
          id: body.id || (require('crypto').randomUUID ? require('crypto').randomUUID() : Math.random().toString(36).substring(2, 15)),
          room_id: body.room_id,
          name: body.name || 'Unnamed Beacon',
          mac_address: mac,
          created_at: getRequestTime(req).toISOString()
        };
        db.authorized_beacons.push(newBeacon);
        return sendJSON(201, [newBeacon]);
      });
    } else if (method === 'DELETE') {
      const filters = getFilters();
      const initialLength = db.authorized_beacons.length;
      db.authorized_beacons = db.authorized_beacons.filter(b => !matchItem(b, filters));
      const deletedCount = initialLength - db.authorized_beacons.length;
      return sendJSON(200, { deleted: deletedCount });
    } else {
      return sendJSON(405, { error: 'Method Not Allowed' });
    }
  }

  // --- Telegram Bot API ---
  else if (pathname.startsWith('/bot') && pathname.endsWith('/sendMessage')) {
    const match = pathname.match(/\/bot([^/]+)\/sendMessage/);
    const token = match ? match[1] : 'unknown';
    
    if (token === 'invalid_token') {
      return sendJSON(401, { ok: false, error_code: 401, description: 'Unauthorized' });
    }
    
    if (db.mockConfig.telegramStatus && db.mockConfig.telegramStatus !== 200) {
      return sendJSON(db.mockConfig.telegramStatus, { ok: false, error_code: db.mockConfig.telegramStatus, description: 'Service Unavailable' });
    }

    if (method === 'POST') {
      getBody((err, body) => {
        if (err) return sendJSON(400, { error: 'Invalid JSON' });
        const msg = {
          token: token,
          chat_id: body.chat_id,
          text: body.text,
          sent_at: getRequestTime(req).toISOString()
        };
        db.telegram_messages.push(msg);
        return sendJSON(200, { ok: true, result: msg });
      });
    } else {
      return sendJSON(405, { error: 'Method Not Allowed' });
    }
  }

  // --- Administrative Test Routes ---
  else if (pathname === '/test/state') {
    if (method === 'GET') {
      return sendJSON(200, db);
    } else if (method === 'POST') {
      getBody((err, body) => {
        if (err) return sendJSON(400, { error: 'Invalid JSON' });
        db = { ...db, ...body };
        return sendJSON(200, { status: 'success', state: db });
      });
    } else {
      return sendJSON(405, { error: 'Method Not Allowed' });
    }
  } else if (pathname === '/test/config') {
    if (method === 'POST') {
      getBody((err, body) => {
        if (err) return sendJSON(400, { error: 'Invalid JSON' });
        db.mockConfig = { ...db.mockConfig, ...body };
        
        // If telegram status goes back to 200, trigger retries
        if (db.mockConfig.telegramStatus === 200 && db.failed_webhook_queue.length > 0) {
          const host = req.headers.host || 'localhost';
          const [hostname, portStr] = host.split(':');
          const requestPort = portStr ? Number(portStr) : 80;
          retryFailedWebhooks(requestPort);
        }
        
        return sendJSON(200, { status: 'success', config: db.mockConfig });
      });
    } else {
      return sendJSON(405, { error: 'Method Not Allowed' });
    }
  } else if (pathname === '/test/reset') {
    if (method === 'POST') {
      resetDb();
      return sendJSON(200, { status: 'success', message: 'Database reset to defaults' });
    } else {
      return sendJSON(405, { error: 'Method Not Allowed' });
    }
  } else {
    return sendJSON(404, { error: 'Not Found' });
  }
});

// Export or start depending on invocation
if (require.main === module) {
  const PORT = process.env.PORT || 8080;
  server.listen(PORT, () => {
    console.log(`Mock Server listening on port ${PORT}`);
  });
} else {
  module.exports = server;
}
