// class apiConsulaValidezCpe {

    const fetch = require("node-fetch");
    let config = require('../config');
    

    // constructor () {}    

    const getToken = async (req, res) => {
        const _url = `https://api-seguridad.sunat.gob.pe/v1/clientesextranet/${config.CONSULTA_KEY_PUBLIC}/oauth2/token/`
        var myHeaders = {
            "Content-Type": "application/x-www-form-urlencoded"            
        }
        // myHeaders.append("Cookie", "TS019e7fc2=019edc9eb8c507b1cd6b1995ff5d25fdb9e9c5603a25a4223470019f505e02b60a915a61cde7b5402d632305325b5e1d3e7f5a1f30");

        var urlencoded = new URLSearchParams();
        urlencoded.append("grant_type", "client_credentials");
        urlencoded.append("scope", "https://api.sunat.gob.pe/v1/contribuyente/contribuyentes");
        urlencoded.append("client_id", config.CONSULTA_KEY_PUBLIC);
        urlencoded.append("client_secret", config.CONSULTA_KEY_PRIVATE);

        var requestOptions = {
          method: 'POST',
          headers: myHeaders,
          body: urlencoded,
          redirect: 'follow'
        };

        return fetch(_url, requestOptions)
          .then(response => response.json())
          // .then(result => res.status(200).send(result))
          // .catch(error => res.status(500).send(error));

    }
    module.exports.getToken = getToken;   



    const getConsulta = async(token, payload) => {

        const _url = "https://api.sunat.gob.pe/v1/contribuyente/contribuyentes/20600161050/validarcomprobante"
        var myHeaders = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }

        var raw = JSON.stringify(payload);

        var requestOptions = {
          method: 'POST',
          headers: myHeaders,
          body: raw,
          redirect: 'follow'
        };

        return fetch(_url, requestOptions)
          .then(response => response.json())
          // .then(result => console.log(result))
          // .catch(error => console.log('error', error));
    }
    module.exports.getConsulta = getConsulta;   
