const express = require('express')
var requestIp = require('request-ip');
const bodyParser = require('body-parser');
const sharp = require('sharp');
const axios = require("axios");
const WebSocket = require("ws");

const app = express()
const port = 3000

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/check-ip', (req, res) => {
    var ip_info = requestIp.getClientIp(req);
    res.json({ message: 'Lấy IP thành công', ip: ip_info });
})

app.post('/convert', async (req, res) => {
    try {
        const { type, text } = req.body;

        if (type !== 'svg-to-png' || !text) {
            return res.status(400).json({ error: 'Invalid payload' });
        }

        const buffer = await sharp(Buffer.from(text))
            .png()
            .toBuffer();
        const base64 = buffer.toString('base64');
        res.json({
            type: 'image/png',
            base64: base64
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error converting SVG to PNG' });
    }
});


/* 

   ###### SOCKET CHECK SERI ####
*/
const URL = "wss://socialmedia-chat.vnptmedia.vn/socket.io/?EIO=4&transport=websocket";
const SITE = 2;
var chatSessionIds = [];
var authorIds = [];
var MESSAGES = [];
var WEBSOCKETS = [];
function connect(UUID, seri, token) {
    WEBSOCKETS[UUID] = new WebSocket(URL);
    WEBSOCKETS[UUID].on("open", () => {
        WEBSOCKETS[UUID].send(`40{"token":"Bearer ${token}","data":{"site":${SITE}}}`);
    });

    WEBSOCKETS[UUID].on("message", async (msg) => {
        let result = parseSocketIOMessage(msg);
        if (result.eventName === "customer_receive_message") {
            if (result?.data?.chatSessionId) {
                chatSessionIds[UUID] = result.data.chatSessionId;
            }
            if (result?.data?.authorId) {
                authorIds[UUID] = result.data.authorId;
            }
            let message = result?.data?.message || "Không có nội dung";

            if (message.includes("số N-seri")) {
                await lifeCycleCheckSeri(UUID, seri, 1);
            } else if (message.includes("Đúng mã")) {
                await lifeCycleCheckSeri(UUID, seri, 2);
            } else if (message.includes("trigger_captcha")) {
                await lifeCycleCheckSeri(UUID, seri, 3);
            } else if (message.includes("đã nạp thành công")) {
                MESSAGES[UUID] = { 'full_message': message, 'status_code': 'Used', 'json': JSON.parse(message) };
                WEBSOCKETS[UUID].close();
            } else if (message.includes("vẫn chưa được nạp")) {
                MESSAGES[UUID] = { 'full_message': message, 'status_code': 'Active', 'json': JSON.parse(message) };
                WEBSOCKETS[UUID].close();
            } else if (message.includes("chưa được kích hoạt")) {
                MESSAGES[UUID] = { 'full_message': message, 'status_code': 'NotActive', 'json': JSON.parse(message) };
                WEBSOCKETS[UUID].close();
            } else if (message.includes("không tìm thấy trong hệ thống")) {
                MESSAGES[UUID] = { 'full_message': message, 'status_code': 'NotFound', 'json': JSON.parse(message) };
                WEBSOCKETS[UUID].close();
            }
        }
    });

    WEBSOCKETS[UUID].on("error", (err) => {
        console.error("❌ Error:", err.message);
    });

    WEBSOCKETS[UUID].on("close", () => {
        console.log("❌ Disconnected");
        if (MESSAGES[UUID]) {
            delete WEBSOCKETS[UUID];
            delete chatSessionIds[UUID];
            delete authorIds[UUID];
        }
    });

    WEBSOCKETS[UUID].emitEvent = (eventName, data) => {
        if (WEBSOCKETS[UUID].readyState === WebSocket.OPEN) {
            WEBSOCKETS[UUID].send(`42["${eventName}",${JSON.stringify(data)}]`);
        } else {
            console.log("⚠️ Cannot emit, WS not open");
        }
    };

    
}

function parseSocketIOMessage(raw) {
    raw = raw.toString();
    const packetType = raw.match(/^\d+/)?.[0];
    const payload = raw.slice(packetType.length);

    let data;
    try {
        data = JSON.parse(payload);
        if (Array.isArray(data) && data.length > 1) {
            [eventName, data] = data;
        } else {
            eventName = "message"; // fallback if no event name found
        }
    } catch (err) {
        data = payload; // nếu không parse được, giữ raw string
    }
    return {
        eventName,
        data
    };
}

async function emitEvent(UUID, eventName, data, number = 42) {
    if (WEBSOCKETS[UUID] && WEBSOCKETS[UUID].readyState === WebSocket.OPEN) {
        WEBSOCKETS[UUID].send(`${number}["${eventName}",${JSON.stringify(data)}]`);
        return true;
    } else {
        console.log("⚠️ WS not connected");
        return false;
    }
}

async function lifeCycleCheckSeri(UUID, seri, step = 0) {
    let timestamp = Date.now();
    // 10 chữ số timestamp
    let shortTimestamp = Math.floor(timestamp / 1000);
    switch (step) {
        case 0:
            await emitEvent(UUID, "customer_send_message_with_new_chat_session", {
                configChannelId: 1,
                siteId: 2,
                chatSessionId: 0,
                type: 0,
                message: "tra seri thẻ cào " + seri,
                parent: 0,
                timestamp: shortTimestamp,
                isButton: 0
            }, 420);
            break;
        case 1:
            await emitEvent(UUID, "customer_send_message_with_current_chat_session", {
                configChannelId: 1,
                siteId: 2,
                chatSessionId: chatSessionIds[UUID],
                type: 0,
                message: seri,
                authorId: authorIds[UUID],
                timestamp: shortTimestamp,
                isButton: 0
            });
            break;
        case 2:
            /* 
                429["customer_send_message_with_current_chat_session",{"configChannelId":1,"siteId":2,"chatSessionId":26291,"type":0,"message":"Đúng mã","authorId":20788,"timestamp":1755618179,"isButton":1,"payloadButton":"{\"title\": \"Đúng mã\", \"payload_id\": \"?ic_bot_button_407707\", \"button_variables\": []}","isHidden":false}]
            */
            await emitEvent(UUID, "customer_send_message_with_current_chat_session", {
                configChannelId: 1,
                siteId: 2,
                chatSessionId: chatSessionIds[UUID],
                type: 0,
                message: "Đúng mã",
                authorId: authorIds[UUID],
                timestamp: shortTimestamp,
                isButton: 1,
                payloadButton: JSON.stringify({
                    title: "Đúng mã",
                    payload_id: "?ic_bot_button_407707",
                    button_variables: []
                }),
                isHidden: false
            });
            break;
        case 3:
            await emitEvent(UUID, "customer_send_message_with_current_chat_session", {
                configChannelId: 1,
                siteId: 2,
                chatSessionId: chatSessionIds[UUID],
                type: 0,
                message: "/submit_captcha",
                authorId: authorIds[UUID],
                timestamp: shortTimestamp,
                isButton: 1,
                payloadButton: "?ic_bot_button_431071",
                isHidden: true
            });
            break;
        default:
            // Handle unknown steps
            break;
    }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function guests(token) {
    const URL = "https://socialmedia-web.vnptmedia.vn/api/v1/guests";
    const randomIP = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    const response = await axios.post(URL, {
        configId: 1,
        ip: randomIP
    }, {
        headers: {
            authorization: token
        }
    });
    const guestToken = response.data.data.token;
    return guestToken;
}

async function join() {
    try {
        const URL = "https://socialmedia-web.vnptmedia.vn/api/v1/guests/join";
        const response = await axios.post(URL, {
            cName: "vinaphone"
        });
        const token = response.data.data;
        return await guests(token);
    } catch (error) {
        console.error("Error fetching guests:", error);
    }
    return false;
}

app.post("/check-seri", async (req, res) => {
    const { seri } = req.body;

    if (!seri) {
        return res.status(400).json({ error: "Missing seri" });
    }
    const UUID = crypto.randomUUID();
    const TOKEN = await join();
    connect(UUID, seri, TOKEN);
    await sleep(300); // đợi kết nối WS
    await lifeCycleCheckSeri(UUID, seri, 0);
    let count = 0;
    do {
        await sleep(300);
        count++;
    } while (!MESSAGES[UUID] && count < 15);

    let lastMessage = MESSAGES[UUID] || "Chưa có phản hồi từ server";
    delete MESSAGES[UUID];
    res.json({ status: "ok", data: lastMessage });
});


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})