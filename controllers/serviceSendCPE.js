// servicio de envio de comprobantes electronicos
// 01:00 horas envia comprobantes dia anterior
// 03:00 actualiza estado de los comprobantes si el resumen fue aceptado

const { to, ReE, ReS }  = require('../service/uitl.service');
let Sequelize = require('sequelize');
let config = require('../config');
const apiConsultaSunatCPE = require('../controllers/apiConsultaValidezSunat');
// let managerFilter = require('../utilitarios/filters');

const fetch = require("node-fetch");
const cron = require('node-cron');

// var FormData = require('form-data');
let url_restobar = config.URL_RESTOBAR;
let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);
let token_sunat = ''
let token_sunat_exp = 0
		

let mysql_clean = function (string) {
        return sequelize.getQueryInterface().escape(string);
};

const URL_COMPROBANTE = 'https://apifac.papaya.com.pe/api';
var HEADERS_COMPROBANTE = { 'Content-Type': 'application/json', 'Authorization': ''}
var cocinandoEnvioCPE = false;
var cocinandoValidezApiSunat = false;
var runCountPedidos = false;
var searchCpeByDate = null;

const cocinarEnvioByFecha = async function (req, res) {
	console.log(req.body)
	searchCpeByDate = req.body.fecha;
	idsede = req.body.idsede || null;
	console.log('cocinar de fecha', searchCpeByDate);	
	cocinarEnvioCPE(false, idsede);
}
module.exports.cocinarEnvioByFecha = cocinarEnvioByFecha;

const cocinarEnvioByMes = async function (req, res) {
	console.log('ingreso cocinarEnvioByMes')	
	console.log(req.body)
	searchCpeByMes = req.body.mes;
	idsede = req.body.idsede || null;
	console.log('cocinar mes ', searchCpeByMes);	
	runCpeMonthSede(searchCpeByMes, idsede);
}
module.exports.cocinarEnvioByMes = cocinarEnvioByMes;	


const activarEnvioCpe = async function () {	
	console.log('ingreso cocinar cpe')	
	// const minInterval = 120000; // cada 2min
	// const _timerLoop = setInterval(timerProcess, minInterval);
	loop_process_validacion();
}
module.exports.activarEnvioCpe = activarEnvioCpe;

const execRunCPEApiSunat = async function () {	
	console.log('ingreso cocinar runCPEApiSunat')	
	// const minInterval = 120000; // cada 2min
	// const _timerLoop = setInterval(timerProcess, minInterval);
	runCPEApiSunat()
}
module.exports.execRunCPEApiSunat = execRunCPEApiSunat;


const emitirRespuesta = async (xquery) => {
    console.log(xquery);
    try {
         return await sequelize.query(xquery, { type: sequelize.QueryTypes.SELECT });

    } catch (err) {
        console.error(err);
        return false;
    }
};

const emitirRespuestaSP = async (xquery) => {
    console.log(xquery);
    try {
        const rows = await sequelize.query(xquery, { type: sequelize.QueryTypes.SELECT });
        const arr = Object.values(rows[0]);
        return arr;
    } catch (err) {
        console.error(err);
        return false;
    }
};



const ejecutarQuery = async (query) => {
    const resultado = await emitirRespuesta(query);
    return resultado || [];
};


const runValidarComprobantesElectronicos = async(listaComprobantes, token_api = null) => {

        console.log('listaComprobantes.length ', listaComprobantes.length)
        if ( listaComprobantes.length === 0 ) { cocinandoEnvioCPE = false; return }

        let listCpeUpdateRegisterApifac = []
        let listCpeUpdateRegisterSunat = [] 
        let listFechaResumen = []
        
        let registrosPorLote = 50;

        // 1 todos los que no se registraron en el apifact        
        const listNoRegisterApiFact = listaComprobantes.filter(c => c.estado_api.toString() === '1')
        if ( listNoRegisterApiFact.length > 0 ) {
            console.log('listNoRegisterApiFact.length ', listNoRegisterApiFact.length)

            // Iterar sobre el array en lotes de 50 registros
            for (let i = 0; i < listNoRegisterApiFact.length; i += registrosPorLote) {
            // for (const cpe of listNoRegisterApiFact) {

            	const lote = listNoRegisterApiFact.slice(i, i + registrosPorLote);            	

            	listCpeUpdateRegisterApifac = [];
            	for (const cpe of lote) {
	                // console.log(cpe)

	                // const _json_xml = cpe.json_xml;
	                // const _token = token_api ? token_api : cpe.token_api;
	                cpe.token_api = token_api ? token_api : cpe.token_api;
	                const rpt_c = await sendOneCpe(cpe.json_xml, cpe.token_api)
	                // const rpt_c = await registerCpeApiFact(cpe)	                
	                if ( rpt_c.success ) { listCpeUpdateRegisterApifac.push(cpe.idce) }
	                console.log('rpt_c ', rpt_c)
				}

				// 1.1 update a todos los comprobantes que se registraron en apifact
				console.log('updateStatusAllCpeRegisterApiFact === ');

	        	await updateStatusAllCpeRegisterApiFact(listCpeUpdateRegisterApifac)
        	}
            
        }



        


        // 2 todos los que no se registraron en la sunat
        registrosPorLote = 50;
        const listNoRegisterSunat = listaComprobantes.filter(c => c.estado_sunat.toString() === '1')
        if ( listNoRegisterSunat.length > 0 ) {
            console.log('listNoRegisterSunat.length ', listNoRegisterSunat.length)
            
            // Iterar sobre el array en lotes de 50 registros
            for (let i = 0; i < listNoRegisterSunat.length; i += registrosPorLote) {
            	    
            	    const loteCPE = listNoRegisterSunat.slice(i, i + registrosPorLote);

            	    listCpeUpdateRegisterSunat = [];
	            for (const cpe of loteCPE) {	                
	                cpe.token_api = token_api ? token_api : cpe.token_api;
	                const rpt_c = await sendCpeSunat(cpe)           
	                const isSuccessResponse = rpt_c.response ? rpt_c.response.success : false;
	                const isSuccess = rpt_c.success;
	                // const isSuccesMaster = rpt_c.success || rpt_c.response;

	                if ( isSuccessResponse === true || isSuccess === true ) { 
	                    listCpeUpdateRegisterSunat.push(cpe.idce)
	                } 

	                if ( isSuccessResponse == false ) {
	                    // evaluea el error
	                	try {
	                	    const codError = rpt_c.response.code;
		                    // "El comprobante fue registrado previamente con otros datos"
		                    if ( codError == '1033') {
		                        listCpeUpdateRegisterSunat.push(cpe.idce);
		                    }
	                	} catch(e) {
	                		console.error('No existe rpt_c.response.code');
	                	}
	                    
	                }
	                console.log('rpt_c ', rpt_c)
	            }

	        // 2.1 update a todos los comprobantes que se registraron en sunat
	        await updateStatusAllCpeRegisterSunat(listCpeUpdateRegisterSunat);
	        cocinandoEnvioCPE = false;
	      }
        }
        // // 2.1 update a todos los comprobantes que se registraron en sunat
        // await updateStatusAllCpeRegisterSunat(listCpeUpdateRegisterSunat);
        // cocinandoEnvioCPE = false;

        console.log('=== termino ===')
        return true;

}



// 171122 procesos repetitivos
function loop_process_validacion() {
	const date_now = new Date();

	console.log('ingresa a loops')
	// todos los dias en el minuto 1 pasada las 1,3,5hrs corre proceso validacion api sunat
	cron.schedule('1 1,3,5 * * *', () => {		
		console.log('Cocinando validacion en api sunat ', date_now.toLocaleString());			
		runCPEApiSunat()	  	
	}, null, true, 'America/Lima');;

	// 10,16,18,1,4hrs corre reenvio de comprobantes
	cron.schedule('20 2,4,9,16 * * *', () => {		
		console.log('Cocinando envio cpe ', date_now.toLocaleString());		
		validarComprobanteElectronicos()	  	
		// cocinarEnvioCPE(false);
	}, null, true, 'America/Lima');;

	// 10,16,18,1,4hrs corre reenvio de comprobantes y resumenes
	cron.schedule('55 2,4,9,16 * * *', () => {		
		console.log('Cocinando envio cpe ', date_now.toLocaleString());		
		// validarComprobanteElectronicos()	  	
		cocinarEnvioCPE();
	}, null, true, 'America/Lima');;

	// los bad request pasar nuevamente
	cron.schedule('0 2 * * *', () => {
		xCleanBadRequest();
	}, null, true, 'America/Lima');


	// todos los diuas a l as 4:30 am
	cron.schedule('30 4 * * *', () => {		
		console.log('Borra todo los print detalle y cuadres anteriores', date_now.toLocaleString());		
		xLimpiarPrintDetalle();
	}, null, true, 'America/Lima');;

	// a las 4:35am de los lunes ordena comercios con mas pedidos --app delivery
	cron.schedule('45 4 * * 1', () => {		
		// comercios con mas pedidos app delivery
		const _sqlCountPedidos = 'call procedure_count_pedidos_delivery_sede()';
		emitirRespuesta(_sqlCountPedidos);
	}, null, true, 'America/Lima');;	
}


//161123
// function que envia comprobantes reenvia comprobantes de un determinado mes y sede
const runCpeMonthSede = async(num_mes = null, idsede_definida = null) => {	
	num_mes = num_mes ? num_mes : getNumMesActual();
	console.log('runCpeMonthSede idsede_definida = ', idsede_definida);	
	// obtener sedes con facturacion	
	const lista_sedes = await getSedesCPE(idsede_definida);
	console.log('lista_sedes', lista_sedes);

	const countList = lista_sedes.length;	
	for (var i = countList - 1; i >= 0; i--) {
		const sede = lista_sedes[i];
		const idsede = sede.idsede;
		const idorg = sede.idorg;
		
		// credenciales
		const cpe_token = sede.authorization_api_comprobante;
		const cpe_userid = sede.id_api_comprobante;

		var sqlCpe = `select * from ce WHERE idsede=${idsede} and MONTH(STR_TO_DATE(fecha, '%d/%m/%Y')) = ${num_mes} and (estado=0 and anulado=0) order by idce desc`;
		var listCpe = await emitirRespuesta(sqlCpe);
		var numRowsCpe = listCpe.length;
		console.log('sqlCpe', sqlCpe);

		await runValidarComprobantesElectronicos(listCpe, cpe_token);

	}

	return true;

}


// 171122
// nuevo verificacion de comprobantes
const validarComprobanteElectronicos = async(req, res) => {
	// traer todas las boletas de hace 6 dias
	cocinandoEnvioCPE = true;
	const sqlCpe = `call procedure_get_comprobantes_validez()`;
	const listaComprobantes = await emitirRespuesta_RES(sqlCpe);

	

	await runValidarComprobantesElectronicos(listaComprobantes);



	// console.log('listaComprobantes.length ', listaComprobantes.length)

	// let listCpeUpdateRegisterApifac = []
	// let listCpeUpdateRegisterSunat = []	
	

	// // 1 todos los que no se registraron en el apifact
	// const listNoRegisterApiFact = listaComprobantes.filter(c => c.estado_api.toString() === '1')
	// if ( listNoRegisterApiFact.length > 0 ) {
	// 	console.log('listNoRegisterApiFact.length ', listNoRegisterApiFact.length)
	// 	for (const cpe of listNoRegisterApiFact) {
	// 		console.log(cpe)

	// 		const _json_xml = cpe.json_xml;
	// 		const _token = cpe.token_api;
	// 		const rpt_c ? await sendOneCpe(cpe.json_xml, cpe.token_api)
	// 		// const rpt_c = await registerCpeApiFact(cpe)
	// 		sendOneCpe
	// 		if ( rpt_c.success ) { listCpeUpdateRegisterApifac.push(cpe.idce) }
	// 		console.log('rpt_c ', rpt_c)
	// 	}
	// }
	// // 1.1 update a todos los comprobantes que se registraron en apifact
	// await updateStatusAllCpeRegisterApiFact(listCpeUpdateRegisterApifac)


	// // 2 todos los que no se registraron en la sunat
	// const listNoRegisterSunat = listaComprobantes.filter(c => c.estado_sunat.toString() === '1')
	// if ( listNoRegisterSunat.length > 0 ) {
	// 	console.log('listNoRegisterSunat.length ', listNoRegisterSunat.length)
	// 	for (const cpe of listNoRegisterSunat) {
	// 		console.log(cpe)
	// 		const rpt_c = await sendCpeSunat(cpe)			
	// 		const isSuccessResponse = rpt_c.response ? rpt_c.response.success : false;
	// 		const isSuccess = rpt_c.success;
	// 		// const isSuccesMaster = rpt_c.success || rpt_c.response;

	// 		if ( isSuccessResponse === true || isSuccess === true ) { 
	// 			listCpeUpdateRegisterSunat.push(cpe.idce)
	// 		} 

	// 		if ( isSuccessResponse == false ) {
	// 			// evaluea el error
	// 			const codError = rpt_c.response.code

	// 			// "El comprobante fue registrado previamente con otros datos"
	// 			if ( codError == '1033') {
	// 				listCpeUpdateRegisterSunat.push(cpe.idce)
	// 			}
	// 		}
	// 		console.log('rpt_c ', rpt_c)
	// 	}
	// }
	// // 2.1 update a todos los comprobantes que se registraron en sunat
	// await updateStatusAllCpeRegisterSunat(listCpeUpdateRegisterSunat)

	// cocinandoEnvioCPE = false;
	
	
}
module.exports.validarComprobanteElectronicos = validarComprobanteElectronicos;


// validamos utilizando el api sunat y se guarda 1 = paso en rpt_sunat apifactura
// este proceso lo hacemos 3 veces durante la noche
async function runCPEApiSunat() {

	cocinandoValidezApiSunat = true;
	const sqlCpe = `call procedure_get_comprobantes_validez()`;
	const listaComprobantes = await emitirRespuesta_RES(sqlCpe);

	if ( listaComprobantes.length === 0 ) { cocinandoValidezApiSunat = false; return }

	let listCpeUpdateRegisterSunat = []
	let listCpeOkRegisterApifac = []
	let countList = 0
	let countIndex = 0
	let lengthList = listaComprobantes.length
	let countUpdateTocken = 0	

	for (const cpe of listaComprobantes) {
		token_sunat = await verificarTokenApiSunat()
		const arr_numero = cpe.numero.split('-')
		const serie = arr_numero[0];
		const numero = parseInt(arr_numero[1]);
		let rpt_c;
		const _payload = {
			"numRuc": cpe.ruc,
			"codComp": cpe.codsunat,
			"numeroSerie": serie,
			"numero": numero,
			"fechaEmision": cpe.fecha,
			"monto": cpe.total
		}

		console.log('_payload', _payload)

		try {
		    rpt_c = await apiConsultaSunatCPE.getConsulta(token_sunat, _payload)
		} catch (err) {
		   continue;
		}		


		const _estadoCP = rpt_c.data?.estadoCp || 0;
		console.log('procesados' + countIndex + ' de ' + lengthList, ' estado ' + _estadoCP)
		if ( rpt_c?.success === true ) { 			

			// solo si tiene respuesta guarda
			if (rpt_c.data?.estadoCp) {
				const _rowItem = {
					idce: cpe.idce,
					external_id: cpe.external_id,
					user_id: cpe.id_api_comprobante,
					data: rpt_c.data,
					estado: rpt_c.data.estadoCp
				}

				listCpeUpdateRegisterSunat.push(_rowItem)				

				// si fue aceptado lo guarda en apifact				
				if (rpt_c.data.estadoCp === '1') {
					// update apifact					
					listCpeOkRegisterApifac.push({
							"user_id": parseInt(_rowItem.user_id),
							"external_id": _rowItem.external_id
						})
					// const rptRes = await registerStatusRptSunatApiFact(_rowItem)
					// console.log('rptRes', rptRes)
				}
			}			
		}	

		countList++;	
		countUpdateTocken++;
		countIndex++;

		// actualiza cada 100
		if ( countList > 50 ) {
			console.log('enviado 50')
			updateListRptSunat(listCpeOkRegisterApifac, listCpeUpdateRegisterSunat)
			listCpeOkRegisterApifac = []
			listCpeUpdateRegisterSunat = []
			countList = 0			
		}

		// cada 500 consultas actualiza token
		if ( countUpdateTocken > 500 ) {			
			token_sunat = ''
			token_sunat = await verificarTokenApiSunat(true)
			countUpdateTocken=0
			console.log('ratificar token')
		}

	}

	console.log('enviado en ', countList)
	await updateListRptSunat(listCpeOkRegisterApifac, listCpeUpdateRegisterSunat)

	// // update apifact
	// registerStatusRptSunatApiFact(listCpeOkRegisterApifac)
	// // update en bd-restobar
	// updateStatusCpeValidacion(listCpeUpdateRegisterSunat)

	cocinandoValidezApiSunat = false;

}

async function updateListRptSunat(listCpeOkRegisterApifac, listCpeUpdateRegisterSunat) {
	// update apifact		
	const rptRes = await registerStatusRptSunatApiFact(listCpeOkRegisterApifac)
	console.log('res update apifact', rptRes)

	// update en bd-restobar
	const rptResResto = await updateStatusCpeValidacion(listCpeUpdateRegisterSunat)
	console.log('res update restobar', rptResResto)
}

// el token viene incluido
// registra el cpe en el apifact
async function registerCpeApiFact(cpe) {	
	const _json_xml = cpe.json_xml;
	const _token = cpe.token_api;

	return await sendOneCpe(_json_xml, _token)

	// const _urlEnvioCPE = URL_COMPROBANTE+ '/documents';	
	// var _headers = HEADERS_COMPROBANTE;	
	// _headers.Authorization = 'Bearer ' + cpe.token_api;
	// const _json_xml = cpe.json_xml;
	// const _token = cpe.token_api;

	// return await fetch(_urlEnvioCPE, {
	// 		method: 'POST',
	// 		headers: _headers,
	// 		body:cpe.json_xml
	// 	}).then(res => res.json());
}

// envia el cpe a la sunat
async function sendCpeSunat(cpe) {	
	const _urlEnvioRetryCPE = URL_COMPROBANTE+ '/send';	
	var _headers = HEADERS_COMPROBANTE;	
	_headers.Authorization = 'Bearer ' + cpe.token_api;

	const _json = {
        "external_id": cpe.external_id
    }

	return await fetch(_urlEnvioRetryCPE, {
			method: 'POST',
			headers: _headers,
			body: JSON.stringify(_json)
		}).then(res => res.json());
}


async function updateStatusAllCpeRegisterApiFact(listRegister) {
	if ( listRegister.length === 0 ) return false;

	sql_update = `update ce 
                set estado_api=0, msj='Registrado', 
                pdf=1,xml=1,cdr=0 where idce in (${listRegister.join(',')})`;
        await emitirRespuesta_RES(sql_update);
}

async function updateStatusAllCpeRegisterSunat(listRegister) {
	if ( listRegister.length === 0 ) return false;
	
	sql_update = `update ce 
                set estado_sunat=0, msj='Aceptado', 
                cdr=1 where idce in (${listRegister.join(',')})`;
        await emitirRespuesta_RES(sql_update);
}

const verificarTokenApiSunat = async (update = false) => {
	// si actualiza no mas
	if ( update )  {
		return await obtenerTokenApiSunat()
	}

	if ( token_sunat === '' ) {
		return await obtenerTokenApiSunat()
	} else {
		// verifica si expiro
		if ( token_sunat_exp <	new Date().getTime() ) {
			return await obtenerTokenApiSunat()
		} else {
			return token_sunat
		}
	}	
}

const obtenerTokenApiSunat = async () => {
	const token_api_sunat = await apiConsultaSunatCPE.getToken()
	token_sunat_exp = token_api_sunat.exp * 1000
	return token_api_sunat.access_token
}


async function updateStatusCpeValidacion(list) {	
	if ( list.length === 0 ) return false;

	const _dateRegister = new Date().toLocaleDateString();
	const _listAceptado = list.filter(x => x.estado == '1').map(x => x.idce)	
	let rptConsult;

	console.log('_dateRegister == ', _dateRegister);

	if ( _listAceptado.length > 0) {
		sql_update = `update ce 
	                set estado_sunat = 0, msj='Aceptado.' status_sunat = 1, status_sunat_date = '${_dateRegister}' 
	                where idce in (${_listAceptado.join(',')})`;

	        console.log('sql_update _listAceptado', sql_update)
	        rptConsult = await emitirRespuesta_RES(sql_update);
	        // console.log('rptConsult', rptConsult)
	}
	


        // no creo que entre aca 
        // estado no existe en sunat
        // vuelve a colocar estado_sunat = 1 y msj=Registrado // para que vuelva intertar enviarlo

	// const _listNoExiste = list.filter(x => x.estado == '0').map(x => x.idce)
	// if ( _listNoExiste.length > 0 ) {
	// 	sql_update = `update ce 
	//                 set estado_sunat = 1, msj='Registrado', status_sunat_date = '${_dateRegister}' 
	//                 where idce in (${_listNoExiste.join(',')})`;
	//         console.log('sql_update listNoExiste', sql_update)
	//         rptConsult = await emitirRespuesta_RES(sql_update);
	//         // console.log('rptConsult', rptConsult)
	// }

	return rptConsult;
	
}

async function registerStatusRptSunatApiFact(_list) {	
	if ( _list.length === 0 ) return;

	const _urlCPEStatusSunat = URL_COMPROBANTE+ '/documents/setRptSunat';	
	var _headers = HEADERS_COMPROBANTE;	

	const _playload = {
		list: JSON.stringify(_list)
	}

	console.log('_playload apifact ', _playload)

	try {
		return await fetch(_urlCPEStatusSunat, {
			method: 'POST',
			headers: _headers,
			body:JSON.stringify(_playload)
		}).then(res => res.json());
	} catch (err) {
		console.log('error de json en llamada ', err)
		return err
	}
}


///////////////////////////////////////////////////////
///////////////////////////////////////////////////////


function timerProcess() {
		const date_now = new Date();
		const hoursNow = date_now.getHours();
		const dayWeek = date_now.getDay();
		console.log('hora',hoursNow)

		if ( hoursNow === 10 || hoursNow === 16 && !cocinandoEnvioCPE ) {// 10:00 am o a las 4pm  o 2am
			cocinandoEnvioCPE = true;
			console.log('cocinando envio cpe', date_now.toLocaleDateString());
			cocinarEnvioCPE(true); // oara que no reste fecha
			// validarComprobanteElectronicos()
		}

		// validez cpe
		// if ( hoursNow === 1 && !cocinandoValidezApiSunat ) {// 01:00
		// 	cocinandoValidezApiSunat = true;
		// 	console.log('cocinando validez api sunat', date_now.toLocaleDateString());
		// 	runCPEApiSunat()
		// }

		// if ( hoursNow === 3 && !cocinandoValidezApiSunat ) {// 03:00
		// 	cocinandoValidezApiSunat = true;
		// 	console.log('cocinando validez api sunat', date_now.toLocaleDateString());
		// 	runCPEApiSunat()
		// }

		// if ( hoursNow === 5 && !cocinandoValidezApiSunat ) {// 05:00
		// 	cocinandoValidezApiSunat = true;
		// 	console.log('cocinando validez api sunat', date_now.toLocaleDateString());
		// 	runCPEApiSunat()
		// }

		///////////////////



		if ( hoursNow === 2 && !cocinandoEnvioCPE ) {// 02:00
			cocinandoEnvioCPE = true;
			console.log('cocinando envio cpe', date_now.toLocaleDateString());
			cocinarEnvioCPE(false);
			// validarComprobanteElectronicos()
		}



		if ( hoursNow === 11 || hoursNow === 18 || hoursNow === 4 && cocinandoEnvioCPE ) {// 03:00
			console.log('cambia condicion', date_now.toLocaleDateString());			
			cocinandoEnvioCPE = false;
		}

		if ( hoursNow === 4  ) {// 04:00 am borra todo los print detalle y cuadres anteriores
			xLimpiarPrintDetalle();
		}

		if ( dayWeek === 1 && hoursNow === 4 && !runCountPedidos ) { // lunes 04:00
			runCountPedidos = true;
			const _sqlCountPedidos = 'call procedure_count_pedidos_delivery_sede()';
			emitirRespuesta(_sqlCountPedidos);			
		}

		if ( dayWeek != 2) {
			runCountPedidos = false;
		}
}





// se ejecuta a las 02:00 horas
// solo una fecha envia resumenes de  boletas
const cocinarEnvioCPE = async function (isDayHoy = false, idsede_definida = null) {
	console.log('cocinarEnvioCPE idsede_definida = ', idsede_definida);	
	// obtener sedes con facturacion	
	const lista_sedes = await getSedesCPE(idsede_definida);
	console.log('lista_sedes', lista_sedes);

	// fecha resumen	
	const fecha_resumen = getFechaDiaAnterior(isDayHoy);
	const fecha_resumen_ce = fecha_resumen.split('-').reverse().join('/')
	console.log('fecha_resumen ', fecha_resumen)
	console.log('fecha_resumen_ce', fecha_resumen_ce)

	const countList = lista_sedes.length;
	for (var i = countList - 1; i >= 0; i--) {
		const sede = lista_sedes[i];
		const idsede = sede.idsede;
		const idorg = sede.idorg;
		
		// credenciales
		const cpe_token = sede.authorization_api_comprobante;
		const cpe_userid = sede.id_api_comprobante;

		// 1) verificamos si hay comprobantes emitidos en la fecha resumen
		var sqlCpe = `select * from ce where idsede = ${idsede} and fecha = '${fecha_resumen_ce}' and (estado=0 and anulado=0);`;
		var listCpe = await emitirRespuesta(sqlCpe);		
		var numRowsCpe = listCpe.length;
		console.log('sqlCpe', sqlCpe);
		// console.log('listCpe', listCpe);



		if ( numRowsCpe > 0 ) { // si hay comprobantes

			// 2) buscar comprobantes no registrados en api		
			let list_cpe_nr = listCpe.filter(c => c.estado_api === 1);
			let numRowListNR = list_cpe_nr.length;
			if ( numRowListNR > 0 ) {
				// enviamos al api
				for (var i = numRowListNR - 1; i >= 0; i--) {
					const el_cpe = list_cpe_nr[i];		
					const rpt_cpe = await sendOneCpe(el_cpe.json_xml, cpe_token);
					await updateStatusCpe(el_cpe, rpt_cpe);					
				}				
			}


			// 3) creamos el resumen de boletas			
		    let rpt_resumen = await sendResumen(fecha_resumen, cpe_token);		
		    console.log('rpt_resumen', rpt_resumen)    
		    if (rpt_resumen.success) {
		    	if ( rpt_resumen.tiket === null ) {// si es null intenta nuevamente
		    		rpt_resumen = await sendResumen(fecha_resumen, cpe_token);		    

		    		if ( rpt_resumen.tiket !== null ) {
		    			await saveResumen(idorg, idsede, fecha_resumen, rpt_resumen.data.external_id, rpt_resumen.data.ticket);
		    		}
		    	}		    	
		    }


		    // 4) enviamos (se envian uno por uno) solo facturas - los que fueron registrados pero no enviados a la sunat x problemas de conexion con el servicio. o offline
			// list_cpe_nr = listCpe.filter(c => c.estado_sunat === 1 && c.numero.indexOf('F') > -1 );
			// 140722 uno x uno todo aca van los comprobantes que no fueron aceptados en resumen

			// sqlCpe = `select * from ce where idsede = ${idsede} and fecha = '${fecha_resumen}' and (estado=0 and anulado=0);`;
			// listCpe = await emitirRespuesta(sqlCpe);		
			numRowsCpe = listCpe.length;
			list_cpe_nr = listCpe.filter(c => c.estado_sunat == 1);
			console.log('falta registra en sunat estado_sunat 1 ===', list_cpe_nr.map(x => x.numero).join(','))
			numRowListNR = list_cpe_nr.length;
			if ( numRowListNR > 0 ) {
				// enviamos al api
				for (var i = numRowListNR - 1; i >= 0; i--) {
					const el_cpe = list_cpe_nr[i];		
					const rpt_cpe = await sendRetryOneCpe(el_cpe.external_id, cpe_token);
					await updateStatusCpe(el_cpe, rpt_cpe, false);					
				}				
			}

		    
		}


	}	


	// revisa los resumens
	cocinarRespuestaResumenCPE(isDayHoy, idsede_definida);

}
module.exports.cocinarEnvioCPE = cocinarEnvioCPE;	

// se ejecuta a las 03:00 horas
const cocinarRespuestaResumenCPE = async function (isDayHoy = false, idsede_definida = null) {
	// obtener sedes con facturacion
	console.log('cocinarRespuestaResumenCPE');
	const lista_sedes = await getSedesCPE(idsede_definida);

	// fecha resumen	
	const fecha_resumen = getFechaDiaAnterior(isDayHoy);
	const fecha_resumen_yymmdd = fecha_resumen.split('/').reverse().join('-');

	
	const countList = lista_sedes.length;
	for (var i = countList - 1; i >= 0; i--) {
		const sede = lista_sedes[i];
		const idsede = sede.idsede;
		const idorg = sede.idorg;
		
		// credenciales
		const cpe_token = sede.authorization_api_comprobante;
		const cpe_userid = sede.id_api_comprobante;

		// 1) verificar el resumen si es aceptado
		const sqlResumenCpe = `SELECT * from ce_resumen where fecha_resumen = '${fecha_resumen_yymmdd}' and idsede = ${idsede} and estado_sunat = 0 order by idce_resumen desc limit 1;`;		
		const resumenEvaluarCpe = await emitirRespuesta(sqlResumenCpe);
		console.log('sqlResumenCpe', sqlResumenCpe)
		console.log('resumenEvaluarCpe', resumenEvaluarCpe)
		if (resumenEvaluarCpe.length > 0) {
			// consultamos ticket}
			const elResumen = resumenEvaluarCpe[0];			
			const rptConsultaResumen = await consultaTicketResumen(elResumen, cpe_token);
			console.log('rptConsultaResumen', rptConsultaResumen);

			if (rptConsultaResumen.success) {
				// marca aceptado a todas las boletas
				await marcarBoletasAceptas(idsede, fecha_resumen, elResumen.idce_resumen);
			} else {
				// si es rechazado envia uno por uno
				const listCpe = await listBoletasResumen(idsede, fecha_resumen);
				const numRowsCpe = listCpe.length;
				if ( numRowsCpe > 0 ) { // si hay comprobantes
					for (var i = numRowsCpe - 1; i >= 0; i--) {
						const el_cpe = listCpe[i];		
						const rpt_cpe = await sendRetryOneCpe(el_cpe.external_id, cpe_token);
						console.log('rpt_cpe', rpt_cpe)
						await updateStatusCpe(el_cpe, rpt_cpe, false);					
					}				
				}
			}

		}
		
	}

	console.log('finalizando cocina cpe');
}
module.exports.cocinarRespuestaResumenCPE = cocinarRespuestaResumenCPE;	




async function getSedesCPE(idsede_definida = null) {
	const _idsede = idsede_definida ? ` and idsede=${idsede_definida} ` : '';

	// pruebas solo san carlos y papaya express
	const sql_sedes = `select idorg,idsede,nombre,ciudad, authorization_api_comprobante, id_api_comprobante from sede where facturacion_e_activo = 1 and estado=0 ${_idsede} order by idsede asc`;
	return await emitirRespuesta(sql_sedes);
}

function getFechaDiaAnterior(isDayHoy = false) {
	// console.log(searchCpeByDate)
	let fechasearchCpeByDate;
	if ( searchCpeByDate ) {
		const [dia, mes, anio] = searchCpeByDate.split('/');
		fechasearchCpeByDate = new Date(`${anio}-${mes}-${dia}`);
		// console.log(fechasearchCpeByDate)
	}

	let  fechaDefault = searchCpeByDate;		
	const fechaNow = fechaDefault ? fechasearchCpeByDate : new Date();
	// console.log('fechaNow', fechaNow)
	var fecha_resumen = fechaDefault ? fechaNow : new Date(fechaNow.setDate(fechaNow.getDate() - 1)); // produccion
	if ( isDayHoy == true ) {
		fecha_resumen = new Date();
	}
	// const fecha_resumen = new Date(fechaNow.setDate(fechaNow.getDate())); // desarrollo
	// console.log(fecha_resumen);
	const anio = fecha_resumen.getFullYear();
	const mes = (fecha_resumen.getMonth() + 1).toString().padStart(2, '0');
	const dia = (fecha_resumen.getDate() + 1).toString().padStart(2, '0');

	// console.log(`${anio}-${mes}-${dia}`)

	// return fecha_resumen.toJSON().slice(0, 10).split('-').reverse().join('/');
	return `${anio}-${mes}-${dia}`;
}

async function getBoletasResumenError(fecha_resumen) {

}




///
async function sendOneCpe(json_xml, token) {	
	const _urlEnvioCPE = URL_COMPROBANTE+ '/documents';	
	var _headers = HEADERS_COMPROBANTE;	
	_headers.Authorization = 'Bearer ' + token;

	return await fetch(_urlEnvioCPE, {
			method: 'POST',
			headers: _headers,
			body:json_xml
		}).then(res => res.json());
}

async function sendRetryOneCpe(_external_id, token) {	
	const _urlEnvioRetryCPE = URL_COMPROBANTE+ '/send';	
	var _headers = HEADERS_COMPROBANTE;	
	_headers.Authorization = 'Bearer ' + token;

	const _json = {
        "external_id": _external_id
    }

	return await fetch(_urlEnvioRetryCPE, {
			method: 'POST',
			headers: _headers,
			body: JSON.stringify(_json)
		}).then(res => res.json());
}

// isNoRegistrado no registrado en api, si es false entonces son boletas de resumen que no pasaron
async function updateStatusCpe(el_cpe, rpt_cpe, isNoRegistrado = true) {
	console.log('rpt_cpe', rpt_cpe)
	const isSuccessResponse = rpt_cpe.response ? rpt_cpe.response.success : false;
	const isSuccess = rpt_cpe.success;

	// const isSuccess = rpt_cpe.success;
	const isBoleta = el_cpe.numero.indexOf('B') > -1 ? true : false;
	const _estadoSunat = isNoRegistrado ? isBoleta ? 1 : 0 : 0; // si es boleta aun no esta registrado lo mandaremos en resumen	 // si es envio de boletas del resumen si es correcto debe ir 0
	const _mensaje = isSuccess ? isNoRegistrado ? isBoleta ? 'Registrado' : 'Aceptado' : 'Aceptado' : rpt_cpe.message;
	const _cdr = isBoleta ? 0 : 1;
	const _descripcionResponse = isSuccess ? rpt_cpe.response.description : rpt_cpe.message;
	const codeResponse = rpt_cpe.response ? rpt_cpe.response.code : '';
	const isRegistroPrevio = codeResponse == '1033' ?  true : false;
	let sql_update = '';

	if ( isSuccessResponse === true || isSuccess === true ) { 
		
		sql_update = `update ce 
		    		set estado_api=0, estado_sunat=${_estadoSunat}, msj='${_mensaje}', 
		            external_id='${rpt_cpe.data.external_id}',
		            pdf=1,xml=1,cdr=${_cdr}
		        where idce=${el_cpe.idce}`;		
	} else {

		if ( isRegistroPrevio ) {
			sql_update = `update ce 
	                set estado_api=0, estado_sunat=${_estadoSunat}, msj='Aceptado', 
	                pdf=1,xml=1,cdr=${_cdr}
	            where idce=${el_cpe.idce}`;
	    	}

	}

	 // else {

    //    	if ( isSuccess) {
// 			sql_update = `update ce 
// 		    		set estado_api=0, estado_sunat=${_estadoSunat}, msj='${_mensaje}', 
// 		            external_id='${rpt_cpe.data.external_id}',
// 		            pdf=1,xml=1,cdr=${_cdr}
// 		        where idce=${el_cpe.idce}`;
// 		} 

// 		// else {
// 		// 	sql_update = `update ce set msj='${_mensaje}' where idce=${el_cpe.idce};`;
// 		// }

    // }	

    await emitirRespuesta_RES(sql_update);
}


async function sendResumen(fecha_resumen, token) {
	const _urlResumenCPE = URL_COMPROBANTE + '/summaries';
	var _headers = HEADERS_COMPROBANTE;	
	_headers.Authorization = "Bearer " + token;

	const jsonResumen = {
        "fecha_de_emision_de_documentos": fecha_resumen.split('/').reverse().join('-'),
        "codigo_tipo_proceso": '1'
    };

	return await fetch(_urlResumenCPE, {
		method: 'POST',
		headers: _headers,
		body: JSON.stringify(jsonResumen)
		}).then(res => res.json());
}

async function saveResumen(idorg, idsede, fecha_resumen, external_id, tiket ) {
	const sql_resumen =`call procedure_register_resumen_cpe(${idorg}, ${idsede}, '${fecha_resumen.split('/').reverse().join('-')}', '${external_id}', '${tiket}');`
	console.log('saveResumen', sql_resumen)
	await emitirRespuesta_RES(sql_resumen);
}



async function consultaTicketResumen(resumen, token) {
	const _urlConsultaResumenCPE = URL_COMPROBANTE + '/summaries/status';
	var _headers = HEADERS_COMPROBANTE;	
	_headers.Authorization = "Bearer " + token;

	const jsonTicket = {
        "external_id": resumen.external_id,
        "ticket": resumen.ticket
    }

    return await fetch(_urlConsultaResumenCPE, {
		method: 'POST',
		headers: _headers,
		body: JSON.stringify(jsonTicket)
		}).then(res => res.json());
}


async function marcarBoletasAceptas(idsede, fecha_resumen, idce_resumen) {
	const sql = `call procedure_register_resumen_cpe_ok(${idsede},'${fecha_resumen}',${idce_resumen})`;
	console.log('sql_marcarBoletasAceptas', sql)
	await emitirRespuesta(sql);
}

// para pasar uno a uno
async function listBoletasResumen(idsede, fecha_resumen) {
	const sql = `select * from ce where idsede = ${idsede} and fecha = '${fecha_resumen}' and estado_sunat = 1 and POSITION('B' in numero) > 0;`;	
	return await emitirRespuesta(sql);	
}



// 04:00 limpia la tabla para mantenerla ligera
function xLimpiarPrintDetalle () {
	const sql = `call procedure_remove_print_detalle()`;	
	emitirRespuesta(sql);	
}

function xCleanBadRequest() {
	const sql = `UPDATE ce set estado_sunat=1 where estado=0 and anulado=0 and msj = 'Bad Gateway'`;
	emitirRespuesta_RES(sql);
}


function getNumMesActual() {
	const fechaActual = new Date();
	return fechaActual.getMonth() + 1;
}

// function emitirRespuesta(xquery) {
// 	return sequelize.query(xquery, {type: sequelize.QueryTypes.SELECT})
// 	.then(function (rows) {
		
// 		// return ReS(res, {
// 		// 	data: rows
// 		// });
// 		return rows;
// 	})
// 	.catch((err) => {
// 		return false;
// 	});
// }





function emitirRespuesta_RES(xquery, res) {
	return sequelize.query(xquery, {type: sequelize.QueryTypes.SELECT})
	.then(function (rows) {
		
		return ReS(res, {
			data: rows
		});
		// return rows;
	})
	.catch((err) => {
		return false;
	});
}

function emitirRespuesta_RES(xquery) {
	return sequelize.query(xquery)
	.then(function (rows) {
		return rows;
	})
	.catch((err) => {
		return false;
	});
}

