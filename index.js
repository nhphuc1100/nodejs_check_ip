const express = require('express')
var requestIp = require('request-ip');
const app = express()
const port = 3000

app.get('/check-ip', (req, res) => {
    var ip_info = requestIp.getClientIp(req);
    res.json({ message: 'Lấy IP thành công', ip: ip_info});
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})