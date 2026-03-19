import http from 'http';

const HUB_PORT = 5000;
const HUB_HOST = '127.0.0.1';

const PROJECT_CONFIG = {
  projectName: "Command",
  serverPort: 3004,
  clientPort: 5176,
  status: "active",
  capabilities: ["management", "hub"]
};

let heartbeatInterval: NodeJS.Timeout | null = null;

function sendRegistration() {
  const payload = JSON.stringify(PROJECT_CONFIG);

  const options = {
    hostname: HUB_HOST,
    port: HUB_PORT,
    path: '/api/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': payload.length
    }
  };

  const req = http.request(options, (res) => {
    if (res.statusCode === 200) {
      console.log(`[LAN Hub] Successfully registered Command App`);
    } else {
      console.warn(`[LAN Hub] Registration failed with status: ${res.statusCode}`);
    }
  });

  req.on('error', (e) => {
    console.error(`[LAN Hub] Could not connect to hub: ${e.message}`);
  });

  req.write(payload);
  req.end();
}

function sendDeregistration() {
  const payload = JSON.stringify({ projectName: PROJECT_CONFIG.projectName });

  const options = {
    hostname: HUB_HOST,
    port: HUB_PORT,
    path: '/api/deregister',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': payload.length
    }
  };

  const req = http.request(options, (res) => {
    console.log(`[LAN Hub] Deregistered Command App`);
  });

  req.on('error', (e) => {
    // Ignore error on deregister
  });

  req.write(payload);
  req.end();
}

export function initLanHub() {
  console.log('[LAN Hub] Initializing Command App integration...');
  
  // Register on startup
  sendRegistration();

  // Heartbeat every 30 seconds
  heartbeatInterval = setInterval(() => {
    sendRegistration();
  }, 30000);
}

export function stopLanHub() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  sendDeregistration();
}
