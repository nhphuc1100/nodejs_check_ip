const express = require('express')
const ip = require('ip')
const app = express()
const port = 3000

app.get('/', (req, res) => {
    res.json({ message: 'Lấy IP thành công', ip: ip.address() })
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})