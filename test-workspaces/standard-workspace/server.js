/* eslint-env node */

const express = require('express');
const path = require('path');
const app = express();

app.set('port', 4000);

app.use('/', express.static(__dirname + '/static'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname + '/static/index.html'));
});

const server = app.listen(app.get('port'), () => {
    const port = server.address().port;
    console.log(`open http://localhost:${port}`); // eslint-disable-line no-console
});
