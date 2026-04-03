// Full end-to-end test of the /api/chat/ask endpoint
// You must have a valid JWT token for your user. Get it from browser devtools → Network → any request → Authorization header
const fs = require('fs');

const JWT_TOKEN = process.env.TEST_JWT || 'YOUR_JWT_HERE'; // replace with real token

async function testChat() {
    let log = '';

    try {
        const res = await fetch('http://localhost:5555/api/chat/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${JWT_TOKEN}`,
            },
            body: JSON.stringify({ message: 'What notes do I have saved?' }),
        });

        const json = await res.json();
        log = `Status: ${res.status}\n`;
        log += JSON.stringify(json, null, 2);
    } catch (e) {
        log = 'Error: ' + e.message;
    }

    fs.writeFileSync('test_chat_log.txt', log);
    console.log(log);
}
testChat();
