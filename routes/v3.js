// PWA-APP-PEDIDOS
let express = require("express");
let routerV3 = express.Router();

const apiServiceSendCPE = require('../controllers/serviceSendCPE');

routerV3.get('/', function (req, res, next) {
	res.json({
		status: "success",
		message: "API V3",
		data: {
			"version_number": "v1.0.0"
		}
	})
});


// send facturacion cpe
routerV3.get('/cpe/cocinar', apiServiceSendCPE.cocinarEnvioCPE);
routerV3.post('/cpe/cocinar-by-fecha', apiServiceSendCPE.cocinarEnvioByFecha);

module.exports = routerV3;