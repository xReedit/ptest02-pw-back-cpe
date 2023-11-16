const http = require('http');
const express = require("express"); 

var app = express();
var bodyParser = require('body-parser');
var cors=require('cors');

var config = require('./config');
const apiServiceSendCPE = require('./controllers/serviceSendCPE');

let router = express.Router();

app.use(cors());

// app.use(bodyParser.json({ limit: '50mb' })); // soporte para bodies codificados en jsonsupport
// app.use(bodyParser.urlencoded({ extended: true, limit: '50mb', extended: true, parameterLimit: 50000 })); // soporte para bodies codificados




// para pwa-app-pedidos
var appV3 = require('./routes/v3');
app.use('/v3',appV3);

app.get('/', function (req, res, next) {
    res.json({
        status: "success",
        message: "API V3 CPE",
        data: {
            "version_number": "v1.0.0"
        }
    })
});

// app.use(function(req, res, next) {
//     var err = new Error('Not Found');
//     err.status = 404;
//     next(err);
// });


// error handler
app.use(function(err, req, res, next) {
    // render the error page
    console.log(err);
    res.status(err.status || 500);
    res.json({
        status: 0,
        data: err.message
    });
    // res.render('error');
});


// sockets

var server = http.createServer(app);

server.listen(config.port, function () {
    console.log('Server CPE is running.. port '+ config.port); 
});


// ejecutar servicio de envio de comprobantes electronicos
apiServiceSendCPE.activarEnvioCpe();

module.exports = app;