import http from 'http';

// Helper function to make local HTTP POST requests easily
function makePostRequest(urlPath, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: urlPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

async function runTestPipeline() {
  try {
    console.log("⏳ 1. Creating an Audit Session in your Supabase DB...");
    const sessionResponse = await makePostRequest('/api/sessions', {
      sessionName: "Wahdat Warehouse Stock",
      targetLocation: "Lahore Site"
    });
    
    const sessionId = sessionResponse.id;
    console.log(`✅ Session Created Successfully! ID: ${sessionId}`);
    console.log("--------------------------------------------------");

    console.log("⏳ 2. Sending raw Urdu input to Gemini 1.5 Flash Extractions...");
    const aiResponse = await makePostRequest('/api/inventory/extract', {
      sessionId: sessionId,
      rawText: "Gandum ki 150 bori"
    });

    console.log("🎉 SUCCESS! AI Extracted & Saved directly to Supabase:");
    console.log(JSON.stringify(aiResponse, null, 2));

  } catch (error) {
    console.error("❌ Test Script failed:", error.message);
  }
}

runTestPipeline();