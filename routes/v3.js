// PWA-APP-PEDIDOS
let express = require("express");
let routerV3 = express.Router();

const apiServiceSendCPE = require('../controllers/serviceSendCPE');
const apiConsultaCPE = require('../controllers/apiConsultaValidezSunat');

routerV3.get('/', function (req, res, next) {
	res.json({
		status: "success",
		message: "API V3 CPE",
		data: {
			"version_number": "v1.0.0"
		}
	})
});


// send facturacion cpe
routerV3.get('/cpe/cocinar', apiServiceSendCPE.cocinarEnvioCPE);
routerV3.post('/cpe/cocinar-by-fecha', apiServiceSendCPE.cocinarEnvioByFecha);
routerV3.get('/cpe/cocinar-run-cpe-api-sunat', apiServiceSendCPE.execRunCPEApiSunat);

// routerV3.post('/cpe/cocinar-by-fecha', apiServiceSendCPE.cocinarEnvioByFecha);


// routerV3.get('/cpe/consulta-cpe', apiServiceSendCPE.obtenerToken);
routerV3.get('/cpe/consulta-cpe-2', apiServiceSendCPE.validarComprobanteElectronicos);

module.exports = routerV3;