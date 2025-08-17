const http = require('http');
const express = require("express"); 

var app = express();
var bodyParser = require('body-parser');
var cors=require('cors');

var config = require('./config');
const apiServiceSendCPE = require('./controllers/serviceSendCPE');

// Configurar Sequelize con mejores prácticas para evitar bloqueos
const Sequelize = require('sequelize');
const sequelize = new Sequelize(config.db_name, config.db_user, config.db_password, {
    host: config.db_host,
    dialect: 'mysql',
    logging: false,
    // Configuración del pool de conexiones
    pool: {
        max: 10,           // Máximo 10 conexiones en el pool
        min: 0,            // Mínimo 0 conexiones en el pool
        idle: 10000,       // 10 segundos antes de liberar conexiones inactivas
        acquire: 30000,    // 30 segundos antes de lanzar error si no se puede obtener una conexión
        evict: 10000       // Ejecutar cada 10 segundos para comprobar conexiones inactivas
    },
    // Reintentar conexión hasta 3 veces
    retry: {
        max: 3,
        match: [/Deadlock/i, /SequelizeConnectionError/]
    },
    // Timeout para consultas y conexiones
    dialectOptions: {
        connectTimeout: 15000, // 15 segundos
        options: {
            requestTimeout: 15000 // 15 segundos
        }
    }
});

// Verificar conexión a la base de datos
sequelize.authenticate()
    .then(() => {
        console.log('Conexión a la base de datos establecida correctamente.');
    })
    .catch(err => {
        console.error('Error al conectar a la base de datos:', err);
    });

let router = express.Router();

app.use(cors());

app.use(bodyParser.json({ limit: '50mb' })); // soporte para bodies codificados en jsonsupport
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb', extended: true, parameterLimit: 50000 })); // soporte para bodies codificados




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

app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});


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