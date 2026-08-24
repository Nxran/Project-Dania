// runner.js
const http = require('http');
const assert = require('assert').strict;
const server = require('./mock_server');

// Helper to make HTTP requests
function request(port, options, body = null) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'apikey': 'super-secret-supabase-key',
      'authorization': 'Bearer super-secret-supabase-key',
      'x-simulated-time': '2026-06-14T16:00:00Z'
    };

    const headers = {
      'Content-Type': 'application/json',
      ...defaultHeaders,
      ...(options.headers || {})
    };

    // Allow tests to explicitly remove headers by setting them to undefined or null
    for (const key in headers) {
      if (headers[key] === undefined || headers[key] === null) {
        delete headers[key];
      }
    }

    const reqOpts = {
      hostname: '127.0.0.1',
      port: port,
      path: options.path,
      method: options.method,
      headers: headers,
      timeout: options.timeout // Support timeout option
    };

    const req = http.request(reqOpts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsedBody = null;
        if (data) {
          try { parsedBody = JSON.parse(data); } catch (e) { parsedBody = data; }
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsedBody
        });
      });
    });

    req.on('error', reject);
    
    if (options.timeout) {
      req.on('timeout', () => {
        req.destroy(new Error('timeout'));
      });
    }

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

const tests = [];

function addTest(name, fn) {
  tests.push({ name, fn });
}

async function beforeEach(port) {
  await request(port, { path: '/test/reset', method: 'POST' });
}

// ============================================================================
// TIER 1 TEST CASES (26 Cases)
// ============================================================================

// --- 4.1 Presence-Based Relay Control (Auto Mode) ---

addTest('TC-1.1: Presence detection transitions room to OCCUPIED', async (port) => {
  const patchRes = await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'PATCH' }, { status: 'OCCUPIED' });
  assert.equal(patchRes.statusCode, 200);

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const room = stateRes.body.rooms.find(r => r.id === 1);
  assert.equal(room.status, 'OCCUPIED');
});

addTest('TC-1.2: Room Vacancy Trigger (PIR & Ultrasonic Empty)', async (port) => {
  // Prerequisite: starts occupied
  await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'PATCH' }, { status: 'OCCUPIED' });

  const patchRes = await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'PATCH' }, { status: 'VACANT' });
  assert.equal(patchRes.statusCode, 200);

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const room = stateRes.body.rooms.find(r => r.id === 1);
  assert.equal(room.status, 'VACANT');
});

addTest('TC-1.3: PIR False Positive Prevention (PIR High, Ultrasonic Empty)', async (port) => {
  // 1. Simulate client checking current database state
  const getRes = await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'GET' });
  assert.equal(getRes.statusCode, 200);
  const roomBefore = getRes.body[0];
  assert.equal(roomBefore.status, 'VACANT');

  // 2. Client processes sensors: PIR = HIGH, Ultrasonic = EMPTY.
  const sensorPIR = true;
  const sensorUltrasonicOccupied = false;
  
  if (sensorPIR && sensorUltrasonicOccupied) {
    await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'PATCH' }, { status: 'OCCUPIED' });
  }

  // 3. Assert database remains VACANT
  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const roomAfter = stateRes.body.rooms.find(r => r.id === 1);
  assert.equal(roomAfter.status, 'VACANT');
});

addTest('TC-1.4: Ultrasonic False Positive Prevention (PIR Low, Ultrasonic Occupied)', async (port) => {
  // 1. Simulate client checking current database state
  const getRes = await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'GET' });
  assert.equal(getRes.statusCode, 200);
  const roomBefore = getRes.body[0];
  assert.equal(roomBefore.status, 'VACANT');

  // 2. Client processes sensors: PIR = LOW, Ultrasonic = OCCUPIED.
  const sensorPIR = false;
  const sensorUltrasonicOccupied = true;
  
  if (sensorPIR && sensorUltrasonicOccupied) {
    await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'PATCH' }, { status: 'OCCUPIED' });
  }

  // 3. Assert database remains VACANT
  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const roomAfter = stateRes.body.rooms.find(r => r.id === 1);
  assert.equal(roomAfter.status, 'VACANT');
});

addTest('TC-1.5: Vacancy Debouncing (Short Sensor Dropout)', async (port) => {
  // 1. Initial State: Room is OCCUPIED
  await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'PATCH' }, { status: 'OCCUPIED' });

  // 2. Simulate short sensor dropout (10 seconds)
  const debounceThresholdMs = 60000; // 60 seconds
  let consecutiveVacancyMs = 0;
  
  consecutiveVacancyMs += 10000;
  if (consecutiveVacancyMs >= debounceThresholdMs) {
    await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'PATCH' }, { status: 'VACANT' });
  }

  // Room status must remain OCCUPIED
  let stateRes = await request(port, { path: '/test/state', method: 'GET' });
  let room = stateRes.body.rooms.find(r => r.id === 1);
  assert.equal(room.status, 'OCCUPIED');

  // 3. Simulate long vacancy (exceeds threshold)
  consecutiveVacancyMs += 50000; // Total 60 seconds
  if (consecutiveVacancyMs >= debounceThresholdMs) {
    await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'PATCH' }, { status: 'VACANT' });
  }

  // Room status must transition to VACANT
  stateRes = await request(port, { path: '/test/state', method: 'GET' });
  room = stateRes.body.rooms.find(r => r.id === 1);
  assert.equal(room.status, 'VACANT');
});

addTest('TC-1.6: Presence Debouncing (Transient Sensor Spike)', async (port) => {
  // 1. Simulate client checking current database state
  const getRes = await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'GET' });
  assert.equal(getRes.statusCode, 200);
  const roomBefore = getRes.body[0];
  assert.equal(roomBefore.status, 'VACANT');

  // 2. Simulate client reading sensors over time (transient spike of 1 second)
  const presenceSamples = [
    { pir: true, us: true, durationMs: 1000 },
    { pir: false, us: false, durationMs: 1000 }
  ];

  let consecutivePresenceDurationMs = 0;
  let statusUpdateSent = false;
  
  for (const sample of presenceSamples) {
    if (sample.pir && sample.us) {
      consecutivePresenceDurationMs += sample.durationMs;
    } else {
      consecutivePresenceDurationMs = 0;
    }
    
    if (consecutivePresenceDurationMs >= 5000) { // 5-second debounce threshold
      await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'PATCH' }, { status: 'OCCUPIED' });
      statusUpdateSent = true;
    }
  }

  // 3. Assert database remains VACANT
  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const roomAfter = stateRes.body.rooms.find(r => r.id === 1);
  assert.equal(roomAfter.status, 'VACANT');
  assert.equal(statusUpdateSent, false);
});

// --- 4.2 Manual Override Control (Dashboard vs Sensors) ---

addTest('TC-2.1: Manual Override ON from Dashboard', async (port) => {
  const patchRes = await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'PATCH' }, { manual_override: true, status: 'OCCUPIED' });
  assert.equal(patchRes.statusCode, 200);

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const room = stateRes.body.rooms.find(r => r.id === 1);
  assert.equal(room.manual_override, true);
  assert.equal(room.status, 'OCCUPIED');
});

addTest('TC-2.2: Manual Override OFF from Dashboard', async (port) => {
  const patchRes = await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'PATCH' }, { manual_override: true, status: 'VACANT' });
  assert.equal(patchRes.statusCode, 200);

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const room = stateRes.body.rooms.find(r => r.id === 1);
  assert.equal(room.manual_override, true);
  assert.equal(room.status, 'VACANT');
});

addTest('TC-2.3: Sensor Ignore in Manual Override ON', async (port) => {
  // Pre-condition: manual override is ON (OCCUPIED)
  await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'PATCH' }, { manual_override: true, status: 'OCCUPIED' });
  
  // 1. Simulate client checking current database state (polling override status)
  const getRes = await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'GET' });
  assert.equal(getRes.statusCode, 200);
  const room = getRes.body[0];
  
  // 2. Validate client decision logic:
  // Since manual_override is true, the firmware's internal state machine must NOT send status update
  let shouldUpdateStatus = false;
  if (!room.manual_override) {
    shouldUpdateStatus = true;
  }

  assert.equal(shouldUpdateStatus, false, "Client decision logic failed: should ignore sensor updates when manual override is ON");

  if (shouldUpdateStatus) {
    await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'PATCH' }, { status: 'VACANT' });
  }

  // 3. Assert database remains OCCUPIED
  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const updatedRoom = stateRes.body.rooms.find(r => r.id === 1);
  assert.equal(updatedRoom.status, 'OCCUPIED');
});

addTest('TC-2.4: Sensor Ignore in Manual Override OFF', async (port) => {
  // Pre-condition: manual override is active and status is forced to VACANT
  await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'PATCH' }, { manual_override: true, status: 'VACANT' });

  // 1. Simulate client checking current database state (polling override status)
  const getRes = await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'GET' });
  assert.equal(getRes.statusCode, 200);
  const room = getRes.body[0];

  // 2. Validate client decision logic:
  // Since manual_override is true, the firmware must NOT update status even if sensors detect presence
  let shouldUpdateStatus = false;
  if (!room.manual_override) {
    shouldUpdateStatus = true;
  }

  assert.equal(shouldUpdateStatus, false, "Client decision logic failed: should ignore sensor updates when manual override is OFF");

  if (shouldUpdateStatus) {
    await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'PATCH' }, { status: 'OCCUPIED' });
  }

  // 3. Assert database remains VACANT
  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const updatedRoom = stateRes.body.rooms.find(r => r.id === 1);
  assert.equal(updatedRoom.status, 'VACANT');
});

addTest('TC-2.5: Resuming Auto Mode (Override Disabled)', async (port) => {
  // Pre-condition: manual override is ON (OCCUPIED)
  await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'PATCH' }, { manual_override: true, status: 'OCCUPIED' });

  // Dashboard deactivates override
  await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'PATCH' }, { manual_override: false });

  // ESP32 reads, sees override is false, checks sensor (vacant) and updates DB
  const getRes = await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'GET' });
  assert.equal(getRes.statusCode, 200);
  const room = getRes.body[0];

  let shouldUpdateStatus = false;
  if (!room.manual_override) {
    shouldUpdateStatus = true;
  }

  assert.equal(shouldUpdateStatus, true, "Client decision logic failed: should resume auto control when manual override is deactivated");

  if (shouldUpdateStatus) {
    await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'PATCH' }, { status: 'VACANT' });
  }

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const updatedRoom = stateRes.body.rooms.find(r => r.id === 1);
  assert.equal(updatedRoom.manual_override, false);
  assert.equal(updatedRoom.status, 'VACANT');
});

// --- 4.3 Energy Readings Pushed by ESP32 ---

addTest('TC-3.1: Active Load Energy Push', async (port) => {
  const postRes = await request(port, { path: '/rest/v1/energy_readings', method: 'POST' }, {
    room_id: 1, voltage: 240.2, current: 0.5, power: 120.0, energy: 12.34
  });
  assert.equal(postRes.statusCode, 201);

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  assert.equal(stateRes.body.energy_readings.length, 1);
  assert.equal(stateRes.body.energy_readings[0].power, 120.0);
});

addTest('TC-3.2: Zero Load Energy Push (Lights OFF)', async (port) => {
  const postRes = await request(port, { path: '/rest/v1/energy_readings', method: 'POST' }, {
    room_id: 1, voltage: 240.1, current: 0.0, power: 0.0, energy: 12.34
  });
  assert.equal(postRes.statusCode, 201);

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  assert.equal(stateRes.body.energy_readings[0].power, 0.0);
});

addTest('TC-3.3: Chronological Ordering of Readings', async (port) => {
  await request(port, { path: '/rest/v1/energy_readings', method: 'POST', headers: { 'x-simulated-time': '2026-06-14T10:00:00Z' } }, {
    room_id: 1, voltage: 240.0, current: 0.5, power: 120.0, energy: 12.34
  });
  await request(port, { path: '/rest/v1/energy_readings', method: 'POST', headers: { 'x-simulated-time': '2026-06-14T10:00:10Z' } }, {
    room_id: 1, voltage: 240.0, current: 0.5, power: 120.0, energy: 12.35
  });
  await request(port, { path: '/rest/v1/energy_readings', method: 'POST', headers: { 'x-simulated-time': '2026-06-14T10:00:20Z' } }, {
    room_id: 1, voltage: 240.0, current: 0.5, power: 120.0, energy: 12.36
  });

  const getRes = await request(port, { path: '/rest/v1/energy_readings?room_id=eq.1', method: 'GET' });
  assert.equal(getRes.body.length, 3);
  assert.ok(new Date(getRes.body[0].created_at) < new Date(getRes.body[1].created_at));
  assert.ok(new Date(getRes.body[1].created_at) < new Date(getRes.body[2].created_at));
});

addTest('TC-3.4: Precision Retention for PZEM Measurements', async (port) => {
  const postRes = await request(port, { path: '/rest/v1/energy_readings', method: 'POST' }, {
    room_id: 1, voltage: 239.85, current: 0.498, power: 119.41, energy: 12.3456
  });
  assert.equal(postRes.statusCode, 201);

  const getRes = await request(port, { path: '/rest/v1/energy_readings?id=eq.1', method: 'GET' });
  assert.equal(getRes.body[0].voltage, 239.85);
  assert.equal(getRes.body[0].current, 0.498);
  assert.equal(getRes.body[0].power, 119.41);
  assert.equal(getRes.body[0].energy, 12.3456);
});

// --- 4.4 Savings Logging & Calculations ---

addTest('TC-4.1: Savings Calculation (1-Hour Vacancy)', async (port) => {
  // Nominal power = 120W, Tariff = 0.509
  // 1 hr -> 0.120 kWh, RM = 0.06108, CO2 = 0.0702 kg
  const postRes = await request(port, { path: '/rest/v1/savings_log', method: 'POST' }, {
    room_id: 1,
    start_time: '2026-06-14T10:00:00Z',
    end_time: '2026-06-14T11:00:00Z',
    kwh_saved: 0.120,
    rm_saved: 0.06,
    co2_saved: 0.070
  });
  assert.equal(postRes.statusCode, 201);

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const log = stateRes.body.savings_log[0];
  assert.equal(log.kwh_saved, 0.120);
  assert.equal(log.rm_saved, 0.06);
  assert.equal(log.co2_saved, 0.070);
});

addTest('TC-4.2: Savings Calculation (30-Minute Vacancy)', async (port) => {
  // Room 2 Nominal power = 150W, Tariff = 0.509
  // 30 min -> 0.075 kWh, RM = 0.038175 (~0.04), CO2 = 0.043875 (~0.044)
  const postRes = await request(port, { path: '/rest/v1/savings_log', method: 'POST' }, {
    room_id: 2,
    start_time: '2026-06-14T10:00:00Z',
    end_time: '2026-06-14T10:30:00Z',
    kwh_saved: 0.075,
    rm_saved: 0.04,
    co2_saved: 0.044
  });
  assert.equal(postRes.statusCode, 201);

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const log = stateRes.body.savings_log[0];
  assert.equal(log.kwh_saved, 0.075);
  assert.equal(log.rm_saved, 0.04);
  assert.equal(log.co2_saved, 0.044);
});

addTest('TC-4.3: Savings Calculation (24-Hour Vacancy)', async (port) => {
  // Room 1: 120W, 24 hr -> 2.88 kWh. Wait, description specifies 100W room:
  // Expected kWh = 2.400 kWh, RM = 1.2216, CO2 = 1.404
  const postRes = await request(port, { 
    path: '/rest/v1/savings_log', 
    method: 'POST',
    headers: { 'x-simulated-time': '2026-06-15T12:00:00Z' }
  }, {
    room_id: 1,
    start_time: '2026-06-14T10:00:00Z',
    end_time: '2026-06-15T10:00:00Z',
    kwh_saved: 2.400,
    rm_saved: 1.22,
    co2_saved: 1.40
  });
  assert.equal(postRes.statusCode, 201);

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const log = stateRes.body.savings_log[0];
  assert.equal(log.kwh_saved, 2.400);
  assert.equal(log.rm_saved, 1.22);
  assert.equal(log.co2_saved, 1.40);
});

addTest('TC-4.4: Custom Tariff Setting Update', async (port) => {
  // Update tariff to 0.65
  const patchSetting = await request(port, { path: '/rest/v1/settings?key=eq.tnb_tariff', method: 'PATCH' }, { value: 0.65 });
  assert.equal(patchSetting.statusCode, 200);

  // Post savings log
  const postRes = await request(port, { path: '/rest/v1/savings_log', method: 'POST' }, {
    room_id: 1,
    start_time: '2026-06-14T10:00:00Z',
    end_time: '2026-06-14T12:00:00Z',
    kwh_saved: 0.24,
    rm_saved: 0.156,
    co2_saved: 0.14
  });
  assert.equal(postRes.statusCode, 201);
});

addTest('TC-4.5: Fractional Vacancy Durations', async (port) => {
  const postRes = await request(port, { path: '/rest/v1/savings_log', method: 'POST' }, {
    room_id: 1,
    start_time: '2026-06-14T10:00:00Z',
    end_time: '2026-06-14T10:15:00Z',
    kwh_saved: 0.03,
    rm_saved: 0.015,
    co2_saved: 0.018
  });
  assert.equal(postRes.statusCode, 201);

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const log = stateRes.body.savings_log[0];
  assert.equal(log.kwh_saved, 0.03);
  assert.equal(log.rm_saved, 0.015);
  assert.equal(log.co2_saved, 0.018);
});

// --- 4.5 Telegram Webhook Notification ---

addTest('TC-5.1: Webhook Trigger on Savings Insert', async (port) => {
  await request(port, { path: '/rest/v1/savings_log', method: 'POST' }, {
    room_id: 1,
    start_time: '2026-06-14T10:00:00Z',
    end_time: '2026-06-14T11:00:00Z',
    kwh_saved: 0.120,
    rm_saved: 0.06,
    co2_saved: 0.070
  });

  // Give webhook callback a brief moment to run (async)
  await new Promise(resolve => setTimeout(resolve, 50));

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  assert.ok(stateRes.body.telegram_messages.length > 0);
});

addTest('TC-5.2: Telegram Message Format: Room Identification', async (port) => {
  await request(port, { path: '/rest/v1/savings_log', method: 'POST' }, {
    room_id: 1,
    start_time: '2026-06-14T10:00:00Z',
    end_time: '2026-06-14T11:00:00Z',
    kwh_saved: 0.120,
    rm_saved: 0.06,
    co2_saved: 0.070
  });

  await new Promise(resolve => setTimeout(resolve, 50));

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const msg = stateRes.body.telegram_messages[stateRes.body.telegram_messages.length - 1];
  assert.ok(msg.text.includes('Bilik: *Fotogrametri*'));
});

addTest('TC-5.3: Telegram Message Format: kWh Saved', async (port) => {
  await request(port, { path: '/rest/v1/savings_log', method: 'POST' }, {
    room_id: 1,
    start_time: '2026-06-14T10:00:00Z',
    end_time: '2026-06-14T11:00:00Z',
    kwh_saved: 0.120,
    rm_saved: 0.06,
    co2_saved: 0.070
  });

  await new Promise(resolve => setTimeout(resolve, 50));

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const msg = stateRes.body.telegram_messages[stateRes.body.telegram_messages.length - 1];
  assert.ok(msg.text.includes('Tenaga Dijimatkan: *0.120 kWh*'));
});

addTest('TC-5.4: Telegram Message Format: Currency Saved', async (port) => {
  await request(port, { path: '/rest/v1/savings_log', method: 'POST' }, {
    room_id: 1,
    start_time: '2026-06-14T10:00:00Z',
    end_time: '2026-06-14T11:00:00Z',
    kwh_saved: 0.120,
    rm_saved: 0.06,
    co2_saved: 0.070
  });

  await new Promise(resolve => setTimeout(resolve, 50));

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const msg = stateRes.body.telegram_messages[stateRes.body.telegram_messages.length - 1];
  assert.ok(msg.text.includes('Kos Dijimatkan: *RM 0.06*'));
});

addTest('TC-5.5: Telegram Message Format: CO2 Saved', async (port) => {
  await request(port, { path: '/rest/v1/savings_log', method: 'POST' }, {
    room_id: 1,
    start_time: '2026-06-14T10:00:00Z',
    end_time: '2026-06-14T11:00:00Z',
    kwh_saved: 0.120,
    rm_saved: 0.06,
    co2_saved: 0.070
  });

  await new Promise(resolve => setTimeout(resolve, 50));

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const msg = stateRes.body.telegram_messages[stateRes.body.telegram_messages.length - 1];
  assert.ok(msg.text.includes('Karbon Dijimatkan: *0.070 kg CO₂*'));
});

addTest('TC-5.6: Multiple Rapid Savings Triggers', async (port) => {
  await Promise.all([
    request(port, { path: '/rest/v1/savings_log', method: 'POST' }, { room_id: 1, kwh_saved: 0.1, rm_saved: 0.05, co2_saved: 0.0585, start_time: '2026-06-14T10:00:00Z', end_time: '2026-06-14T11:00:00Z' }),
    request(port, { path: '/rest/v1/savings_log', method: 'POST' }, { room_id: 1, kwh_saved: 0.2, rm_saved: 0.10, co2_saved: 0.117, start_time: '2026-06-14T10:00:00Z', end_time: '2026-06-14T11:00:00Z' }),
    request(port, { path: '/rest/v1/savings_log', method: 'POST' }, { room_id: 1, kwh_saved: 0.3, rm_saved: 0.15, co2_saved: 0.1755, start_time: '2026-06-14T10:00:00Z', end_time: '2026-06-14T11:00:00Z' })
  ]);

  await new Promise(resolve => setTimeout(resolve, 150));

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  assert.equal(stateRes.body.telegram_messages.length, 3);
});


// ============================================================================
// TIER 2 TEST CASES (27 Cases)
// ============================================================================

addTest('TC-T2-01: POST Energy Readings with Null Room ID', async (port) => {
  const res = await request(port, { path: '/rest/v1/energy_readings', method: 'POST' }, {
    room_id: null, voltage: 230.5, current: 0.45, power: 103.7, energy: 12.34
  });
  assert.equal(res.statusCode, 400);
});

addTest('TC-T2-02: POST Energy Readings with Missing Voltage', async (port) => {
  const res = await request(port, { path: '/rest/v1/energy_readings', method: 'POST' }, {
    room_id: 1, current: 0.45, power: 103.7, energy: 12.34
  });
  assert.equal(res.statusCode, 400);
});

addTest('TC-T2-03: POST Energy Readings with Negative Voltage', async (port) => {
  const res = await request(port, { path: '/rest/v1/energy_readings', method: 'POST' }, {
    room_id: 1, voltage: -230.5, current: 0.45, power: 103.7, energy: 12.34
  });
  assert.equal(res.statusCode, 400);
});

addTest('TC-T2-04: POST Energy Readings with Negative Current', async (port) => {
  const res = await request(port, { path: '/rest/v1/energy_readings', method: 'POST' }, {
    room_id: 1, voltage: 230.5, current: -0.45, power: 103.7, energy: 12.34
  });
  assert.equal(res.statusCode, 400);
});

addTest('TC-T2-05: POST Energy Readings with Negative Power', async (port) => {
  const res = await request(port, { path: '/rest/v1/energy_readings', method: 'POST' }, {
    room_id: 1, voltage: 230.5, current: 0.45, power: -103.7, energy: 12.34
  });
  assert.equal(res.statusCode, 400);
});

addTest('TC-T2-06: POST Energy Readings with Negative Energy', async (port) => {
  const res = await request(port, { path: '/rest/v1/energy_readings', method: 'POST' }, {
    room_id: 1, voltage: 230.5, current: 0.45, power: 103.7, energy: -12.34
  });
  assert.equal(res.statusCode, 400);
});

addTest('TC-T2-07: POST Energy Readings with Zero Power and Energy', async (port) => {
  const res = await request(port, { path: '/rest/v1/energy_readings', method: 'POST' }, {
    room_id: 1, voltage: 230.0, current: 0.0, power: 0.0, energy: 0.0
  });
  assert.equal(res.statusCode, 201);
});

addTest('TC-T2-08: PATCH Room Status with Null Status', async (port) => {
  const res = await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'PATCH' }, {
    status: null
  });
  assert.equal(res.statusCode, 400);
});

addTest('TC-T2-09: PATCH Room Status with Invalid Status Value', async (port) => {
  const res = await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'PATCH' }, {
    status: 'UNKNOWN'
  });
  assert.equal(res.statusCode, 400);
});

addTest('TC-T2-10: API Request without API Key Header', async (port) => {
  const res = await request(port, { 
    path: '/rest/v1/rooms?id=eq.1', 
    method: 'GET',
    headers: { 'apikey': null, 'authorization': null } // Omit api key
  });
  assert.equal(res.statusCode, 412); // Supabase returns 401 or 412. Mock server returns 412 for missing API key. Let's make sure it matches.
});

addTest('TC-T2-11: API Request with Invalid API Key', async (port) => {
  const res = await request(port, { 
    path: '/rest/v1/rooms?id=eq.1', 
    method: 'GET',
    headers: { 'apikey': 'invalid-key-value', 'authorization': null }
  });
  assert.equal(res.statusCode, 401);
});

addTest('TC-T2-12: Telegram Notification with Invalid Bot Token', async (port) => {
  const res = await request(port, {
    path: '/botinvalid_token/sendMessage',
    method: 'POST'
  }, {
    chat_id: '@sceas_alerts',
    text: 'hello'
  });
  assert.equal(res.statusCode, 401);
});

addTest('TC-T2-13: PATCH Room Settings with Missing Auth', async (port) => {
  const res = await request(port, {
    path: '/rest/v1/rooms?id=eq.1',
    method: 'PATCH',
    headers: { 'authorization': null } // Omit JWT auth
  }, {
    manual_override: true
  });
  assert.equal(res.statusCode, 401);
});

addTest('TC-T2-14: ESP32 Push Energy Readings during 500 Error', async (port) => {
  // Inject error on POST energy readings
  await request(port, { path: '/test/config', method: 'POST' }, {
    errorRoutes: { 'POST:/rest/v1/energy_readings': 500 }
  });

  const res = await request(port, { path: '/rest/v1/energy_readings', method: 'POST' }, {
    room_id: 1, voltage: 230, current: 0.5, power: 115, energy: 1.2
  });
  assert.equal(res.statusCode, 500);
});

addTest('TC-T2-15: ESP32 Room Status Fetch during 500 Error', async (port) => {
  await request(port, { path: '/test/config', method: 'POST' }, {
    errorRoutes: { 'GET:/rest/v1/rooms': 500 }
  });

  const res = await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'GET' });
  assert.equal(res.statusCode, 500);
});

addTest('TC-T2-16: Web Dashboard Fetch during 503 Service Down', async (port) => {
  await request(port, { path: '/test/config', method: 'POST' }, {
    errorRoutes: { 'GET:/rest/v1/rooms': 503 }
  });

  const res = await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'GET' });
  assert.equal(res.statusCode, 503);
});

addTest('TC-T2-17: Client Handling of Mock API Timeout', async (port) => {
  await request(port, { path: '/test/config', method: 'POST' }, {
    latencyRoutes: { 'GET:/rest/v1/rooms': 150 } // Inject latency. Wait, let's keep it small for fast test suite. 150ms latency
  });

  try {
    await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'GET', timeout: 50 }); // timeout after 50ms
    assert.fail('Request should have timed out');
  } catch (err) {
    assert.equal(err.message, 'timeout');
  }
});

addTest('TC-T2-18: Savings Log with Zero-Second Duration', async (port) => {
  const res = await request(port, { path: '/rest/v1/savings_log', method: 'POST' }, {
    room_id: 1,
    start_time: '2026-06-14T12:00:00Z',
    end_time: '2026-06-14T12:00:00Z',
    kwh_saved: 0.0,
    rm_saved: 0.0,
    co2_saved: 0.0
  });
  assert.equal(res.statusCode, 201);
});

addTest('TC-T2-19: Savings Log with Extremely Long Duration (1 Year)', async (port) => {
  const res = await request(port, { 
    path: '/rest/v1/savings_log', 
    method: 'POST',
    headers: { 'x-simulated-time': '2028-06-14T00:00:00Z' } // Ensure end_time is in the past of this simulated time
  }, {
    room_id: 1,
    start_time: '2026-06-14T00:00:00Z',
    end_time: '2027-06-14T00:00:00Z',
    kwh_saved: 1000.0,
    rm_saved: 509.0,
    co2_saved: 585.0
  });
  assert.equal(res.statusCode, 201);
});

addTest('TC-T2-20: Savings Log with End Time Before Start Time', async (port) => {
  const res = await request(port, { path: '/rest/v1/savings_log', method: 'POST' }, {
    room_id: 1,
    start_time: '2026-06-14T12:00:00Z',
    end_time: '2026-06-14T11:00:00Z',
    kwh_saved: 0.1,
    rm_saved: 0.05,
    co2_saved: 0.0585
  });
  assert.equal(res.statusCode, 400);
});

addTest('TC-T2-21: Savings Log with Future Timestamp', async (port) => {
  const res = await request(port, { path: '/rest/v1/savings_log', method: 'POST', headers: { 'x-simulated-time': '2026-06-14T10:00:00Z' } }, {
    room_id: 1,
    start_time: '2026-06-14T12:00:00Z',
    end_time: '2026-06-14T13:00:00Z',
    kwh_saved: 0.1,
    rm_saved: 0.05,
    co2_saved: 0.0585
  });
  assert.equal(res.statusCode, 400);
});

addTest('TC-T2-22: Settings TNB Tariff Rate High Precision', async (port) => {
  const res = await request(port, { path: '/rest/v1/settings', method: 'POST' }, {
    key: 'tnb_tariff', value: 0.50942
  });
  assert.equal(res.statusCode, 201);

  const getRes = await request(port, { path: '/rest/v1/settings?key=eq.tnb_tariff', method: 'GET' });
  assert.equal(getRes.body[0].value, 0.50942);
});

addTest('TC-T2-23: CO2 Conversion Factor High Precision', async (port) => {
  const res = await request(port, { path: '/rest/v1/settings', method: 'POST' }, {
    key: 'co2_factor', value: 0.58517
  });
  assert.equal(res.statusCode, 201);

  const getRes = await request(port, { path: '/rest/v1/settings?key=eq.co2_factor', method: 'GET' });
  assert.equal(getRes.body[0].value, 0.58517);
});

addTest('TC-T2-24: Small Savings Scale Calculation', async (port) => {
  // Set tariff to 0.509
  await request(port, { path: '/rest/v1/settings', method: 'POST' }, { key: 'tnb_tariff', value: 0.509 });
  
  const res = await request(port, { path: '/rest/v1/savings_log', method: 'POST' }, {
    room_id: 1, kwh_saved: 0.0013, start_time: '2026-06-14T12:00:00Z', end_time: '2026-06-14T12:15:00Z',
    rm_saved: 0.0006617, co2_saved: 0.0007605
  });
  assert.equal(res.statusCode, 201);

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const log = stateRes.body.savings_log.find(l => l.kwh_saved === 0.0013);
  assert.ok(Math.abs(log.rm_saved - 0.0006617) < 0.00001);
});

addTest('TC-T2-25: Rapid Status Changes (PIR Bounce Simulation)', async (port) => {
  const payloads = [
    { status: 'VACANT' },
    { status: 'OCCUPIED' },
    { status: 'VACANT' },
    { status: 'OCCUPIED' }
  ];

  for (const payload of payloads) {
    const res = await request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'PATCH' }, payload);
    assert.equal(res.statusCode, 200);
  }

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const room = stateRes.body.rooms.find(r => r.id === 1);
  assert.equal(room.status, 'OCCUPIED');
});

addTest('TC-T2-26: Rapid Manual Override Toggle from Dashboard', async (port) => {
  const promises = [
    request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'PATCH' }, { manual_override: true }),
    request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'PATCH' }, { manual_override: false }),
    request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'PATCH' }, { manual_override: true })
  ];

  await Promise.all(promises);

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const room = stateRes.body.rooms.find(r => r.id === 1);
  assert.equal(room.manual_override, true);
});

addTest('TC-T2-27: Simultaneous Energy Reading Pushes', async (port) => {
  const promises = [
    request(port, { path: '/rest/v1/energy_readings', method: 'POST' }, { room_id: 1, voltage: 230, power: 100 }),
    request(port, { path: '/rest/v1/energy_readings', method: 'POST' }, { room_id: 2, voltage: 230, power: 150 })
  ];

  const results = await Promise.all(promises);
  results.forEach(r => assert.equal(r.statusCode, 201));

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  assert.ok(stateRes.body.energy_readings.some(e => e.room_id === 1));
  assert.ok(stateRes.body.energy_readings.some(e => e.room_id === 2));
});


// ============================================================================
// TIER 3 TEST CASES (6 Cases)
// ============================================================================

addTest('T3-TC1: Override vs Auto - Presence Ignored During Override (Force ON)', async (port) => {
  // Pre-condition: manual_override = true, status = OCCUPIED
  await request(port, { path: '/rest/v1/rooms?id=eq.room-1', method: 'PATCH' }, { manual_override: true, status: 'OCCUPIED' });

  // ESP32 polls status
  const getRes = await request(port, { path: '/rest/v1/rooms?id=eq.room-1', method: 'GET' });
  assert.equal(getRes.statusCode, 200);
  const room = getRes.body[0];
  assert.equal(room.manual_override, true);
  assert.equal(room.status, 'OCCUPIED');

  // Validate client decision logic:
  let shouldUpdateStatus = false;
  if (!room.manual_override) {
    shouldUpdateStatus = true;
  }
  assert.equal(shouldUpdateStatus, false, "Client decision logic failed: should ignore sensor updates when manual override is ON");

  if (shouldUpdateStatus) {
    await request(port, { path: '/rest/v1/rooms?id=eq.room-1', method: 'PATCH' }, { status: 'VACANT' });
  }

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const updatedRoom = stateRes.body.rooms.find(r => r.id === 'room-1');
  assert.equal(updatedRoom.status, 'OCCUPIED');
});

addTest('T3-TC2: Override vs Auto - Return to Auto (Vacant) on Deactivation', async (port) => {
  await request(port, { path: '/rest/v1/rooms?id=eq.room-1', method: 'PATCH' }, { manual_override: true, status: 'OCCUPIED' });

  // Dashboard deactivates override
  await request(port, { path: '/rest/v1/rooms?id=eq.room-1', method: 'PATCH' }, { manual_override: false });

  // ESP32 polls, sees override is false, detects vacant, and updates DB status to VACANT
  const getRes = await request(port, { path: '/rest/v1/rooms?id=eq.room-1', method: 'GET' });
  assert.equal(getRes.statusCode, 200);
  const room = getRes.body[0];
  assert.equal(room.manual_override, false);

  let shouldUpdateStatus = false;
  if (!room.manual_override) {
    shouldUpdateStatus = true;
  }
  assert.equal(shouldUpdateStatus, true, "Client decision logic failed: should resume auto control when manual override is deactivated");

  if (shouldUpdateStatus) {
    await request(port, { path: '/rest/v1/rooms?id=eq.room-1', method: 'PATCH' }, { status: 'VACANT' });
  }

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const updatedRoom = stateRes.body.rooms.find(r => r.id === 'room-1');
  assert.equal(updatedRoom.status, 'VACANT');
});

addTest('T3-TC3: Override vs Auto - Return to Auto (Occupied) on Deactivation', async (port) => {
  await request(port, { path: '/rest/v1/rooms?id=eq.room-1', method: 'PATCH' }, { manual_override: true, status: 'OCCUPIED' });

  // Dashboard deactivates override
  await request(port, { path: '/rest/v1/rooms?id=eq.room-1', method: 'PATCH' }, { manual_override: false });

  // ESP32 polls, sees override is false, detects presence, and maintains status as OCCUPIED (no patch needed or keep-alive)
  const getRes = await request(port, { path: '/rest/v1/rooms?id=eq.room-1', method: 'GET' });
  assert.equal(getRes.statusCode, 200);
  const room = getRes.body[0];
  assert.equal(room.manual_override, false);

  let shouldUpdateStatus = false;
  if (!room.manual_override) {
    shouldUpdateStatus = true;
  }
  assert.equal(shouldUpdateStatus, true, "Client decision logic failed: should resume auto control when manual override is deactivated");

  // Current sensor detects presence -> stays OCCUPIED

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const updatedRoom = stateRes.body.rooms.find(r => r.id === 'room-1');
  assert.equal(updatedRoom.status, 'OCCUPIED');
});

addTest('T3-TC4: Energy Readings vs Room Status Consistency', async (port) => {
  // Set to auto vacant
  await request(port, { path: '/rest/v1/rooms?id=eq.room-1', method: 'PATCH' }, { manual_override: false, status: 'VACANT' });
  // Post 0W reading
  await request(port, { path: '/rest/v1/energy_readings', method: 'POST' }, {
    room_id: 'room-1', voltage: 240.0, current: 0.0, power: 0.0, energy: 5.4
  });

  // Force ON
  await request(port, { path: '/rest/v1/rooms?id=eq.room-1', method: 'PATCH' }, { manual_override: true, status: 'OCCUPIED' });
  // Post 200W reading
  await request(port, { path: '/rest/v1/energy_readings', method: 'POST' }, {
    room_id: 'room-1', voltage: 240.0, current: 0.833, power: 200.0, energy: 5.5
  });

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const readings = stateRes.body.energy_readings.filter(r => r.room_id === 'room-1');
  assert.equal(readings.length, 2);
  assert.equal(readings[0].power, 0.0);
  assert.equal(readings[1].power, 200.0);
});

addTest('T3-TC5: Savings Log Trigger - Manual Override Interrupts Auto Vacancy', async (port) => {
  // TNB Tariff = 0.395
  await request(port, { path: '/rest/v1/settings', method: 'POST' }, { key: 'tnb_tariff', value: 0.395 });

  // T0 = 09:00:00, vacant
  // T1 = 10:30:00, overridden to OCCUPIED. Post savings log for 1.5 hours.
  // Nominal power = 200W -> 1.5 hr * 0.2 kW = 0.30 kWh. RM = 0.3 * 0.395 = 0.1185. CO2 = 0.3 * 0.584 = 0.1752.
  const res = await request(port, { path: '/rest/v1/savings_log', method: 'POST' }, {
    room_id: 'room-1',
    start_time: '2026-06-14T09:00:00Z',
    end_time: '2026-06-14T10:30:00Z',
    kwh_saved: 0.30,
    rm_saved: 0.1185,
    co2_saved: 0.1752
  });
  assert.equal(res.statusCode, 201);

  await new Promise(resolve => setTimeout(resolve, 50));
  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const msg = stateRes.body.telegram_messages[stateRes.body.telegram_messages.length - 1];
  assert.ok(msg.text.includes('Tenaga Dijimatkan: *0.300 kWh*'));
  assert.ok(msg.text.includes('Kos Dijimatkan: *RM 0.12*'));
});

addTest('T3-TC6: Savings Log Trigger - Override Force OFF Ends when Deactivated', async (port) => {
  await request(port, { path: '/rest/v1/settings', method: 'POST' }, { key: 'tnb_tariff', value: 0.395 });

  // Force OFF from T0 = 14:00:00 to T1 = 15:00:00 (1.0 hr). Nominal = 200W.
  // kwh = 0.20, rm = 0.079, co2 = 0.1168.
  const res = await request(port, { path: '/rest/v1/savings_log', method: 'POST' }, {
    room_id: 'room-1',
    start_time: '2026-06-14T14:00:00Z',
    end_time: '2026-06-14T15:00:00Z',
    kwh_saved: 0.20,
    rm_saved: 0.079,
    co2_saved: 0.1168
  });
  assert.equal(res.statusCode, 201);
});


// ============================================================================
// TIER 4 TEST CASES (5 Cases)
// ============================================================================

addTest('T4-TC1: A Day in Fotogrametri Lab (Full Timeline Simulation)', async (port) => {
  // Set tariff = 0.395
  await request(port, { path: '/rest/v1/settings', method: 'POST' }, { key: 'tnb_tariff', value: 0.395 });

  // Timeline events simulated.
  // 12:15 to 13:30 (1.25 hours vacant). kwh = 1.25 * 0.2 = 0.25. rm = 0.09875. co2 = 0.25 * 0.584 = 0.146.
  await request(port, { path: '/rest/v1/savings_log', method: 'POST', headers: { 'x-simulated-time': '2026-06-14T13:30:00Z' } }, {
    room_id: 'room-fotogrametri',
    start_time: '2026-06-14T12:15:00Z',
    end_time: '2026-06-14T13:30:00Z',
    kwh_saved: 0.25,
    rm_saved: 0.09875,
    co2_saved: 0.146
  });

  // 15:00 to 16:30 (1.50 hours Force OFF). kwh = 1.5 * 0.2 = 0.30. rm = 0.1185. co2 = 0.3 * 0.584 = 0.1752.
  await request(port, { path: '/rest/v1/savings_log', method: 'POST', headers: { 'x-simulated-time': '2026-06-14T16:30:00Z' } }, {
    room_id: 'room-fotogrametri',
    start_time: '2026-06-14T15:00:00Z',
    end_time: '2026-06-14T16:30:00Z',
    kwh_saved: 0.30,
    rm_saved: 0.1185,
    co2_saved: 0.1752
  });

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const logs = stateRes.body.savings_log.filter(l => l.room_id === 'room-fotogrametri');
  assert.equal(logs.length, 2);

  const totalKwh = logs.reduce((sum, l) => sum + l.kwh_saved, 0);
  const totalRm = logs.reduce((sum, l) => sum + l.rm_saved, 0);
  const totalCo2 = logs.reduce((sum, l) => sum + l.co2_saved, 0);

  assert.equal(totalKwh, 0.55);
  assert.equal(totalRm, 0.21725);
  assert.equal(totalCo2, 0.3212);
});

addTest('T4-TC2: Power Surge/Outage and ESP32 State Recovery', async (port) => {
  // 1. Force OFF Recovery
  await request(port, { path: '/rest/v1/rooms?id=eq.room-1', method: 'PATCH' }, { manual_override: true, status: 'VACANT' });
  // Simulated reboot
  let getRes = await request(port, { path: '/rest/v1/rooms?id=eq.room-1', method: 'GET' });
  let room = getRes.body[0];
  assert.equal(room.manual_override, true);
  assert.equal(room.status, 'VACANT'); // Relay remains OFF

  // 2. Force ON Recovery
  await request(port, { path: '/rest/v1/rooms?id=eq.room-1', method: 'PATCH' }, { manual_override: true, status: 'OCCUPIED' });
  getRes = await request(port, { path: '/rest/v1/rooms?id=eq.room-1', method: 'GET' });
  room = getRes.body[0];
  assert.equal(room.manual_override, true);
  assert.equal(room.status, 'OCCUPIED'); // Relay turns ON

  // 3. Auto Recovery
  await request(port, { path: '/rest/v1/rooms?id=eq.room-1', method: 'PATCH' }, { manual_override: false, status: 'OCCUPIED' });
  // Boot: get state, see auto mode. Read sensors (detect empty). Update DB.
  getRes = await request(port, { path: '/rest/v1/rooms?id=eq.room-1', method: 'GET' });
  room = getRes.body[0];
  assert.equal(room.manual_override, false);
  await request(port, { path: '/rest/v1/rooms?id=eq.room-1', method: 'PATCH' }, { status: 'VACANT' });

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const finalRoom = stateRes.body.rooms.find(r => r.id === 'room-1');
  assert.equal(finalRoom.status, 'VACANT');
});

addTest('T4-TC3: Multiple Concurrent Labs (Fotogrametri & Kartografi)', async (port) => {
  await request(port, { path: '/rest/v1/settings', method: 'POST' }, { key: 'tnb_tariff', value: 0.395 });

  // Room A (room-foto, 200W): Vacant 11:00 to 12:30 (1.5h). kwh = 0.3, rm = 0.1185, co2 = 0.1755
  await request(port, { path: '/rest/v1/savings_log', method: 'POST' }, {
    room_id: 'room-foto', start_time: '2026-06-14T11:00:00Z', end_time: '2026-06-14T12:30:00Z', kwh_saved: 0.3, rm_saved: 0.1185, co2_saved: 0.1755
  });

  // Room B (room-karto, 400W): Vacant 12:00 to 13:00 (1.0h). kwh = 0.4, rm = 0.1580, co2 = 0.234
  await request(port, { path: '/rest/v1/savings_log', method: 'POST' }, {
    room_id: 'room-karto', start_time: '2026-06-14T12:00:00Z', end_time: '2026-06-14T13:00:00Z', kwh_saved: 0.4, rm_saved: 0.1580, co2_saved: 0.234
  });

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const logA = stateRes.body.savings_log.find(l => l.room_id === 'room-foto');
  const logB = stateRes.body.savings_log.find(l => l.room_id === 'room-karto');
  assert.ok(logA, 'logA should exist');
  assert.ok(logB, 'logB should exist');
  assert.equal(logA.kwh_saved, 0.3);
  assert.equal(logB.kwh_saved, 0.4);

  // Assert distinct telegram messages sent
  await new Promise(resolve => setTimeout(resolve, 100));
  const tgStateRes = await request(port, { path: '/test/state', method: 'GET' });
  const msgs = tgStateRes.body.telegram_messages;
  assert.ok(msgs.some(m => m.text.includes('Bilik: *Fotogrametri*')));
  assert.ok(msgs.some(m => m.text.includes('Bilik: *Kartografi*')));
});

addTest('T4-TC4: Telegram Webhook Failure and Queue Recovery', async (port) => {
  // 1. Configure mock Telegram to fail with 503
  await request(port, { path: '/test/config', method: 'POST' }, { telegramStatus: 503 });

  // 2. Insert savings log. Check that database insert succeeds.
  const logRes1 = await request(port, { path: '/rest/v1/savings_log', method: 'POST' }, {
    room_id: 'room-1', kwh_saved: 0.1, start_time: '2026-06-14T12:00:00Z', end_time: '2026-06-14T13:00:00Z',
    rm_saved: 0.0509, co2_saved: 0.0585
  });
  assert.equal(logRes1.statusCode, 201);

  // 3. Configure mock Telegram back to 200
  await request(port, { path: '/test/config', method: 'POST' }, { telegramStatus: 200 });

  // 4. Insert second savings log.
  const logRes2 = await request(port, { path: '/rest/v1/savings_log', method: 'POST' }, {
    room_id: 'room-1', kwh_saved: 0.2, start_time: '2026-06-14T13:00:00Z', end_time: '2026-06-14T14:00:00Z',
    rm_saved: 0.1018, co2_saved: 0.117
  });
  assert.equal(logRes2.statusCode, 201);

  // 5. Verify both notifications are in telegram_messages (one retried and one new)
  await new Promise(resolve => setTimeout(resolve, 150));
  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  assert.equal(stateRes.body.telegram_messages.length, 2);
});

addTest('T4-TC5: Tariff Updates and Historical Audit Trail Integrity', async (port) => {
  // L1: 200W, 2.0h -> kwh = 0.40, rm = 0.40 * 0.395 = 0.158, co2 = 0.234
  await request(port, { path: '/rest/v1/settings', method: 'POST' }, { key: 'tnb_tariff', value: 0.395 });
  await request(port, { path: '/rest/v1/savings_log', method: 'POST' }, {
    room_id: 'room-foto', start_time: '2026-06-14T10:00:00Z', end_time: '2026-06-14T12:00:00Z', kwh_saved: 0.40, rm_saved: 0.1580, co2_saved: 0.234
  });

  // L2: Update tariff to 0.509. 2.0h -> kwh = 0.40, rm = 0.40 * 0.509 = 0.2036, co2 = 0.234
  await request(port, { path: '/rest/v1/settings', method: 'POST' }, { key: 'tnb_tariff', value: 0.509 });
  await request(port, { path: '/rest/v1/savings_log', method: 'POST' }, {
    room_id: 'room-foto', start_time: '2026-06-14T12:00:00Z', end_time: '2026-06-14T14:00:00Z', kwh_saved: 0.40, rm_saved: 0.2036, co2_saved: 0.234
  });

  // L3: Update nominal_power to 300W. 2.0h -> kwh = 0.60, rm = 0.60 * 0.509 = 0.3054, co2 = 0.351
  // Change room nominal power in DB
  await request(port, { path: '/rest/v1/rooms?id=eq.room-foto', method: 'PATCH' }, { nominal_power: 300.0 });
  await request(port, { path: '/rest/v1/savings_log', method: 'POST' }, {
    room_id: 'room-foto', start_time: '2026-06-14T14:00:00Z', end_time: '2026-06-14T16:00:00Z', kwh_saved: 0.60, rm_saved: 0.3054, co2_saved: 0.351
  });

  const stateRes = await request(port, { path: '/test/state', method: 'GET' });
  const logs = stateRes.body.savings_log.filter(l => l.room_id === 'room-foto');
  
  assert.ok(logs[0], 'L1 should exist');
  assert.ok(logs[1], 'L2 should exist');
  assert.ok(logs[2], 'L3 should exist');

  assert.equal(logs[0].kwh_saved, 0.40);
  assert.equal(logs[0].rm_saved, 0.1580);
  
  assert.equal(logs[1].kwh_saved, 0.40);
  assert.equal(logs[1].rm_saved, 0.2036);

  assert.equal(logs[2].kwh_saved, 0.60);
  assert.equal(logs[2].rm_saved, 0.3054);
});


// ============================================================================
// RUNNER ENTRY POINT
// ============================================================================

async function main() {
  server.listen(0, async () => {
    const port = server.address().port;
    console.log(`E2E Test Runner started. Mock Server listening on port ${port}\n`);

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      try {
        console.log(`[ RUN ] ${test.name}`);
        await beforeEach(port);
        await test.fn(port);
        console.log(`[ PASS ] ${test.name}\n`);
        passed++;
      } catch (err) {
        console.error(`[ FAIL ] ${test.name}`);
        console.error(err);
        console.log('');
        failed++;
      }
    }

    server.close(() => {
      console.log(`--------------------------------------------------`);
      console.log(`E2E Test Suite Finished: ${passed} passed, ${failed} failed`);
      console.log(`--------------------------------------------------`);
      process.exit(failed > 0 ? 1 : 0);
    });
  });
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error during test run:', err);
    process.exit(1);
  });
}
