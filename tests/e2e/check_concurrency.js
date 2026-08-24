// check_concurrency.js
const http = require('http');
const assert = require('assert').strict;
const server = require('./mock_server');

function request(port, options, body = null) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'apikey': 'super-secret-supabase-key',
      'authorization': 'Bearer super-secret-supabase-key'
    };

    const headers = {
      'Content-Type': 'application/json',
      ...defaultHeaders,
      ...(options.headers || {})
    };

    const reqOpts = {
      hostname: '127.0.0.1',
      port: port,
      path: options.path,
      method: options.method,
      headers: headers
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
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runConcurrencyCheck() {
  server.listen(0, async () => {
    const port = server.address().port;
    console.log(`Concurrency test server started on port ${port}`);

    try {
      // 1. Reset database
      await request(port, { path: '/test/reset', method: 'POST' });

      // 2. Perform 100 concurrent POSTs to /rest/v1/energy_readings
      console.log('Sending 100 concurrent energy reading POST requests...');
      const energyPromises = [];
      for (let i = 0; i < 100; i++) {
        energyPromises.push(
          request(port, { path: '/rest/v1/energy_readings', method: 'POST' }, {
            room_id: 1,
            voltage: 240.0 + (i % 10),
            current: 0.5,
            power: 120.0,
            energy: 10.0 + i * 0.1
          })
        );
      }
      const energyResults = await Promise.all(energyPromises);
      energyResults.forEach((r, idx) => {
        assert.equal(r.statusCode, 201, `Request ${idx} failed with status ${r.statusCode}: ${JSON.stringify(r.body)}`);
      });

      // 3. Perform 100 concurrent PATCHes to /rest/v1/rooms?id=eq.1 toggling OCCUPIED/VACANT
      console.log('Sending 100 concurrent room status PATCH requests...');
      const statusPromises = [];
      for (let i = 0; i < 100; i++) {
        const status = i % 2 === 0 ? 'OCCUPIED' : 'VACANT';
        statusPromises.push(
          request(port, { path: '/rest/v1/rooms?id=eq.1', method: 'PATCH' }, { status })
        );
      }
      const statusResults = await Promise.all(statusPromises);
      statusResults.forEach((r, idx) => {
        assert.equal(r.statusCode, 200, `PATCH ${idx} failed with status ${r.statusCode}`);
      });

      // 4. Verify DB state consistency
      const stateRes = await request(port, { path: '/test/state', method: 'GET' });
      const readings = stateRes.body.energy_readings;
      console.log(`Verifying database state: energy readings count = ${readings.length}`);
      assert.equal(readings.length, 100, `Expected 100 energy readings, got ${readings.length}`);

      // Verify that all IDs from 1 to 100 are unique and present
      const ids = readings.map(r => r.id).sort((a, b) => a - b);
      for (let i = 1; i <= 100; i++) {
        assert.equal(ids[i - 1], i, `Expected ID ${i} at index ${i - 1}, but got ${ids[i - 1]}`);
      }

      console.log('CONCURRENCY CHECK PASSED: No race conditions or data loss detected.');
      server.close(() => {
        process.exit(0);
      });
    } catch (err) {
      console.error('CONCURRENCY CHECK FAILED:', err);
      server.close(() => {
        process.exit(1);
      });
    }
  });
}

runConcurrencyCheck();
