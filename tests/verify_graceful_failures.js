const { spawn, execSync } = require('child_process');
const fs = require('fs');
const assert = require('assert');

async function runTest() {
  console.log('--- Verification Test: Graceful API Error Handling ---');

  // 1. Reset DB state
  console.log('Resetting mock database...');
  execSync('node -e "fetch(\'http://localhost:8080/test/reset\', {method:\'POST\'})"');

  // 2. Configure mock server to inject a 500 error for rooms GET request
  console.log('Injecting 500 error for GET /rest/v1/rooms...');
  execSync('node -e "fetch(\'http://localhost:8080/test/config\', {method:\'POST\', headers:{\'Content-Type\':\'application/json\'}, body:JSON.stringify({errorRoutes:{\'GET:/rest/v1/rooms\':500}})})"');

  // Wait a moment for mock server config to apply
  await new Promise(resolve => setTimeout(resolve, 500));

  // 3. Start Microsoft Edge in headless mode with remote debugging enabled on 9223
  console.log('Starting headless browser with remote debugging on port 9223...');
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const edgeProcess = spawn(edgePath, [
    '--headless',
    '--disable-gpu',
    '--remote-debugging-port=9223',
    'http://localhost:3001'
  ]);

  // Let browser start up
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    // 4. Fetch the target tabs to get the WebSocket debugger URL
    console.log('Fetching tab list from remote debugger...');
    const listRes = await fetch('http://127.0.0.1:9223/json');
    if (!listRes.ok) {
      throw new Error(`Failed to fetch tab list: ${listRes.statusText}`);
    }
    const tabs = await listRes.json();
    console.log(`Found ${tabs.length} targets.`);
    const tab = tabs.find(t => t.url.includes('localhost:3001'));
    if (!tab) {
      throw new Error('Could not find tab for http://localhost:3001');
    }

    const wsDebuggerUrl = tab.webSocketDebuggerUrl;
    console.log(`Connecting to WebSocket debugger: ${wsDebuggerUrl}`);

    // 5. Connect to the browser tab using WebSocket and execute CDP command to get DOM
    const ws = new WebSocket(wsDebuggerUrl);
    
    const domPromise = new Promise((resolve, reject) => {
      ws.onopen = () => {
        // Wait 6 seconds to ensure CORS / fetch failures are fully caught and UI state updates
        console.log('WebSocket connection open. Waiting 6 seconds for page load and API fetch...');
        setTimeout(() => {
          console.log('Evaluating document.documentElement.outerHTML...');
          ws.send(JSON.stringify({
            id: 1,
            method: 'Runtime.evaluate',
            params: {
              expression: 'document.documentElement.outerHTML'
            }
          }));
        }, 6000);
      };

      ws.onmessage = (event) => {
        const response = JSON.parse(event.data);
        if (response.id === 1) {
          if (response.error) {
            reject(new Error(`CDP Evaluation Error: ${JSON.stringify(response.error)}`));
          } else {
            resolve(response.result.result.value);
          }
        }
      };

      ws.onerror = (err) => {
        reject(err);
      };
    });

    const domOutput = await domPromise;
    ws.close();

    fs.writeFileSync('c:\\Users\\Cyborg 15\\Desktop\\dania\\sceas\\tests\\debug_dom.html', domOutput);

    // 6. Assertions on the final HTML output
    console.log('Analyzing rendered DOM...');

    // Check for offline connectivity badge
    const hasOfflineBadge = domOutput.includes('SYSTEM OFFLINE');
    console.log(`- Connectivity badge shows SYSTEM OFFLINE: ${hasOfflineBadge}`);
    assert.ok(hasOfflineBadge, 'Dashboard connectivity badge should display SYSTEM OFFLINE on API error');

    // Check for database connection failed card
    const hasErrorCard = domOutput.includes('Database Connection Failed') || domOutput.includes('Unable to reach the Supabase database');
    console.log(`- Clean error card/banner rendered: ${hasErrorCard}`);
    assert.ok(hasErrorCard, 'Dashboard UI should render a clean error card/banner on API error');

    console.log('Result: PASS - Dashboard handles API errors gracefully!');
  } finally {
    console.log('Cleaning up browser process...');
    edgeProcess.kill();
    
    // Reset mock server DB to normal
    console.log('Restoring mock database...');
    execSync('node -e "fetch(\'http://localhost:8080/test/reset\', {method:\'POST\'})"');
  }
}

runTest().catch(err => {
  console.error('Result: FAIL - Verification failed:', err);
  process.exit(1);
});
