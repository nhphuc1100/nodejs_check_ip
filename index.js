const express = require('express')
var requestIp = require('request-ip');
const bodyParser = require('body-parser');
const sharp = require('sharp');

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

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})