const { spawn } = require('child_process');

async function runDebug() {
  console.log('Starting Edge for network debugging...');
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const edgeProcess = spawn(edgePath, [
    '--headless',
    '--disable-gpu',
    '--remote-debugging-port=9223',
    'http://localhost:3001'
  ]);

  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    const listRes = await fetch('http://127.0.0.1:9223/json');
    const tabs = await listRes.json();
    const tab = tabs.find(t => t.url.includes('localhost:3001'));
    if (!tab) throw new Error('Tab not found');

    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    ws.onopen = () => {
      console.log('CDP connected, enabling network and console tracking...');
      ws.send(JSON.stringify({ id: 1, method: 'Network.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Console.enable' }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      
      if (msg.method === 'Network.requestWillBeSent') {
        console.log(`[REQ] ${msg.params.request.method} ${msg.params.request.url}`);
      }
      if (msg.method === 'Network.responseReceived') {
        console.log(`[RES] ${msg.params.response.status} ${msg.params.response.url}`);
      }
      if (msg.method === 'Console.messageAdded') {
        console.log(`[CONSOLE] ${msg.params.message.level}: ${msg.params.message.text}`);
      }
    };

    // Keep open for 6 seconds to observe requests
    await new Promise(resolve => setTimeout(resolve, 6000));
    ws.close();
  } finally {
    edgeProcess.kill();
  }
}

runDebug().catch(console.error);
