const { port, sms_server_url } = require('./assets/config.json')
const express = require('express');
const helmet = require("helmet");
const cors = require('cors');
const compression = require('compression');
const app = express();
const axios = require('axios').default;
const rateLimit = require("express-rate-limit");
const limiter = rateLimit({
    windowMs: 1000, //1 sec
    max: 10 // limit each IP to 100 requests per windowMs
});


app.use(express.json());
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(limiter);

app.post('/send/sms', async (req, res) => {
    try {
        const { recipient, message, sender } = req.body;

        if (!recipient || !message || !sender) {
            const error = `required params for sms send missing 
            recipient: ${recipient}, sender: ${sender} message: ${message}`;
            console.error(error)
            throw new Error(error);
        }

        return res.status(200).send( 'message sent' )
    } catch (e) {
        console.error(`mock 3d party an while trying to send sms to sms server ${JSON.stringify(e)}`)
        return res.status(400).json({ error: 'mock 3d party an while trying to send sms to sms server' })
    }


})






app.listen(port, function () {
    console.log(`mock 3d party server running  on port ${port}`)
})



