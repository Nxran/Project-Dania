const { spawn, execSync } = require('child_process');
const assert = require('assert');

async function runTest() {
  console.log('--- Verification Test: Settings Configurations & Spinners ---');

  // 1. Reset DB state
  console.log('Resetting mock database...');
  execSync('node -e "fetch(\'http://localhost:8080/test/reset\', {method:\'POST\'})"');

  // 2. Start Microsoft Edge in headless mode with remote debugging enabled on 9223
  console.log('Starting headless browser on port 9223...');
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const edgeProcess = spawn(edgePath, [
    '--headless',
    '--disable-gpu',
    '--disable-web-security',
    '--user-data-dir=c:\\Users\\Cyborg 15\\Desktop\\dania\\.agents\\challenger_m1_2_1\\chrome_profile_settings',
    '--remote-debugging-port=9223',
    'http://localhost:3001/settings'
  ]);

  // Let browser start up and load settings page
  await new Promise(resolve => setTimeout(resolve, 3000));

  try {
    // 3. Fetch tab list from remote debugger
    const listRes = await fetch('http://127.0.0.1:9223/json');
    if (!listRes.ok) throw new Error(`Failed to fetch tab list: ${listRes.statusText}`);
    const tabs = await listRes.json();
    const tab = tabs.find(t => t.url.includes('localhost:3001/settings'));
    if (!tab) throw new Error('Could not find settings tab');

    const ws = new WebSocket(tab.webSocketDebuggerUrl);

    // Helper to evaluate JS in page context
    const evaluate = (expression) => {
      return new Promise((resolve, reject) => {
        ws.send(JSON.stringify({
          id: Math.floor(Math.random() * 100000),
          method: 'Runtime.evaluate',
          params: { expression, returnByValue: true }
        }));
        const onMsg = (event) => {
          const res = JSON.parse(event.data);
          if (res.result && res.result.result) {
            ws.removeEventListener('message', onMsg);
            if (res.result.exceptionDetails) {
              reject(new Error(`Eval error: ${JSON.stringify(res.result.exceptionDetails)}`));
            } else {
              resolve(res.result.result.value);
            }
          }
        };
        ws.addEventListener('message', onMsg);
      });
    };

    // Open connection
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });
    console.log('Connected to debugger. Starting checks...');

    // Wait a brief moment to make sure components are initialized and data is loaded
    await new Promise(resolve => setTimeout(resolve, 2000));

    // --- CASE 2.1: Tariff input validation (exceeds RM 5.00/kWh) ---
    console.log('Testing tariff validation (> RM 5.00)...');
    await evaluate(`
      (() => {
        const input = document.querySelector('input[placeholder="0.509"]');
        if (!input) return 'INPUT_NOT_FOUND';
        
        // Use native value setter for React compatibility
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(input, "5.01");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Update') || b.textContent.includes('Saving'));
        if (!btn) return 'BUTTON_NOT_FOUND';
        btn.click();
        return 'CLICKED';
      })()
    `);
    
    // Wait for state update
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check error banner text
    const tariffError = await evaluate(`
      (() => {
        const bodyText = document.body.innerText;
        return bodyText.includes('TNB tariff rate cannot exceed RM 5.00/kWh') ? 'PASS' : 'FAIL: ' + bodyText;
      })()
    `);
    console.log(`- Tariff error result: ${tariffError}`);
    assert.equal(tariffError, 'PASS', 'Tariff > 5.00 should be rejected and show validation error message');

    // --- CASE 2.2: Room nominal power validation (exceeds 10,000 W) ---
    console.log('Testing nominal power validation (> 10,000 W)...');
    await evaluate(`
      (() => {
        const inputs = Array.from(document.querySelectorAll('input')).filter(input => input.placeholder !== "0.509");
        if (inputs.length === 0) return 'INPUTS_NOT_FOUND';
        const input = inputs[0];
        
        // Use native value setter for React compatibility
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(input, "10001");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        
        const form = input.closest('form');
        const btn = form.querySelector('button[type="submit"]');
        if (!btn) return 'BUTTON_NOT_FOUND';
        btn.click();
        return 'CLICKED';
      })()
    `);

    // Wait for state update
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check error banner text
    const powerError = await evaluate(`
      (() => {
        const bodyText = document.body.innerText;
        return bodyText.includes('Nominal power limit cannot exceed 10,000 W') ? 'PASS' : 'FAIL: ' + bodyText;
      })()
    `);
    console.log(`- Power error result: ${powerError}`);
    assert.equal(powerError, 'PASS', 'Nominal power > 10,000 W should be rejected and show validation error message');

    // --- CASE 2.3: Offline Update behavior (avoid infinite spinners) ---
    console.log('Testing update under database failure (checking for infinite spinners)...');
    
    // Configure mock server to return 500 on settings PATCH and rooms PATCH
    execSync('node -e "fetch(\'http://localhost:8080/test/config\', {method:\'POST\', headers:{\'Content-Type\':\'application/json\'}, body:JSON.stringify({errorRoutes:{\'PATCH:/rest/v1/settings\':500, \'PATCH:/rest/v1/rooms\':500}})})"');
    
    await new Promise(resolve => setTimeout(resolve, 200));

    // Try submitting valid tariff (e.g. 1.25) under DB offline
    console.log('Submitting valid tariff update when DB is offline...');
    await evaluate(`
      (() => {
        const input = document.querySelector('input[placeholder="0.509"]');
        
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(input, "1.25");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Update') || b.textContent.includes('Saving'));
        btn.click();
      })()
    `);

    // Wait 1.5 seconds (gives the request plenty of time to fail and update component state)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Verify button is not stuck in loading state
    const tariffButtonState = await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Update') || b.textContent.includes('Saving') || b.textContent.includes('Saving...'));
        if (!btn) return 'NOT_FOUND';
        return {
          text: btn.textContent,
          disabled: btn.disabled
        };
      })()
    `);
    console.log(`- Tariff button after offline attempt: text="${tariffButtonState.text}", disabled=${tariffButtonState.disabled}`);
    assert.equal(tariffButtonState.text, 'Update', 'Tariff button text should revert to "Update" after error');
    assert.equal(tariffButtonState.disabled, false, 'Tariff button should not be disabled after error');

    // Try submitting valid room power (e.g. 250W) under DB offline
    console.log('Submitting valid room power update when DB is offline...');
    await evaluate(`
      (() => {
        const inputs = Array.from(document.querySelectorAll('input')).filter(input => input.placeholder !== "0.509");
        const input = inputs[0];
        
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(input, "250");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        
        const form = input.closest('form');
        const btn = form.querySelector('button[type="submit"]');
        btn.click();
      })()
    `);

    // Wait 1.5 seconds
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Verify room power button is not stuck in loading state
    const powerButtonState = await evaluate(`
      (() => {
        const inputs = Array.from(document.querySelectorAll('input')).filter(input => input.placeholder !== "0.509");
        const form = inputs[0].closest('form');
        const btn = form.querySelector('button[type="submit"]');
        return {
          text: btn.textContent,
          disabled: btn.disabled
        };
      })()
    `);
    console.log(`- Power button after offline attempt: text="${powerButtonState.text}", disabled=${powerButtonState.disabled}`);
    assert.equal(powerButtonState.text, 'Save', 'Power button text should revert to "Save" after error');
    assert.equal(powerButtonState.disabled, false, 'Power button should not be disabled after error');

    console.log('Result: PASS - Input validations and error state recovery (spinners cleared) verified!');
    ws.close();
  } finally {
    edgeProcess.kill();
    // Restore DB state
    execSync('node -e "fetch(\'http://localhost:8080/test/reset\', {method:\'POST\'})"');
  }
}

runTest().catch(err => {
  console.error('Result: FAIL - Verification failed:', err);
  process.exit(1);
});
