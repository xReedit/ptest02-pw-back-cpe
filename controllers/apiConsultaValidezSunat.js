// class apiConsulaValidezCpe {

    const { fetchAxios } = require('../service/axios.service');
    let config = require('../config');
    

    // constructor () {}    

    const getToken = async (req, res) => {
        const _url = `https://api-seguridad.sunat.gob.pe/v1/clientesextranet/${config.CONSULTA_KEY_PUBLIC}/oauth2/token/`
        const myHeaders = {
            "Content-Type": "application/x-www-form-urlencoded"            
        };

        const urlencoded = new URLSearchParams();
        urlencoded.append("grant_type", "client_credentials");
        urlencoded.append("scope", "https://api.sunat.gob.pe/v1/contribuyente/contribuyentes");
        urlencoded.append("client_id", config.CONSULTA_KEY_PUBLIC);
        urlencoded.append("client_secret", config.CONSULTA_KEY_PRIVATE);

        // Usar fetchAxios con timeout de 20 segundos
        const response = await fetchAxios(
            _url, 
            'POST', 
            myHeaders, 
            urlencoded.toString(),
            20000 // 20 segundos de timeout
        );
        
        return response;
    }
    module.exports.getToken = getToken;   



    const getConsulta = async(token, payload) => {
        const _url = "https://api.sunat.gob.pe/v1/contribuyente/contribuyentes/20600161050/validarcomprobante";
        const myHeaders = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        };

        // Usar fetchAxios con timeout de 20 segundos
        return await fetchAxios(
            _url, 
            'POST', 
            myHeaders, 
            JSON.stringify(payload),
            20000 // 20 segundos de timeout
        );
    }
    module.exports.getConsulta = getConsulta;   


