/**
 * Servicio centralizado para manejar peticiones HTTP con Axios
 * Incluye manejo de timeout, reintentos con backoff exponencial y manejo de errores
 */

const axios = require('axios');
const { withRetry, isRetryableHttpError } = require('./retry.service');

/**
 * Función centralizada para manejar todas las peticiones HTTP con axios
 * @param {string} url - URL del endpoint
 * @param {string} method - Método HTTP (GET, POST, PUT, DELETE, etc)
 * @param {object} headers - Cabeceras de la petición
 * @param {object|string} body - Cuerpo de la petición
 * @param {number} timeout - Tiempo máximo de espera en milisegundos (default: 15000)
 * @returns {Promise<object>} - Respuesta de la petición
 */
async function fetchAxios(url, method, headers, body, timeout = 15000) {
    // Configuración de reintentos
    const retryOptions = {
        maxRetries: 2,           // Máximo 2 reintentos
        initialDelay: 1000,      // Espera inicial de 1 segundo
        maxDelay: 10000,         // Máximo 5 segundos de espera
        shouldRetry: isRetryableHttpError // Función que determina si se debe reintentar
    };

    // Usar withRetry para manejar reintentos con backoff exponencial
    return await withRetry(async () => {
        try {
            // Cancelar la petición si excede el timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
            }, timeout);

            const config = {
                method: method,
                url: url,
                headers: headers,
                timeout: timeout,
                signal: controller.signal,
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                // Evitar que axios espere indefinidamente
                timeoutErrorMessage: `La petición a ${url} excedió el tiempo de espera (${timeout}ms)`,
                // Evitar reintentos automáticos de axios que puedan bloquear conexiones
                retry: 0,
                retryDelay: 0
            };
            
            // Si hay body, lo procesamos según su tipo
            if (body) {
                if (method.toUpperCase() === 'GET') {
                    config.params = body;
                } else {
                    // Si es string, asumimos que ya está formateado (XML o JSON string)
                    if (typeof body === 'string') {
                        // Verificamos si parece JSON
                        if (body.trim().startsWith('{') || body.trim().startsWith('[')) {
                            try {
                                // Intentamos parsearlo como JSON
                                const jsonData = JSON.parse(body);
                                config.data = jsonData;
                                // Aseguramos que el header Content-Type sea application/json
                                config.headers = { ...config.headers, 'Content-Type': 'application/json' };
                            } catch (e) {
                                // Si falla el parse, lo enviamos como string
                                config.data = body;
                            }
                        } else {
                            // Si no parece JSON, lo enviamos como está (probablemente XML)
                            config.data = body;
                        }
                    } else {
                        // Si es un objeto, lo enviamos como JSON
                        config.data = body;
                        // Aseguramos que el header Content-Type sea application/json
                        config.headers = { ...config.headers, 'Content-Type': 'application/json' };
                    }
                }
            }
            
            console.log(`Enviando petición a ${url} con método ${method}`);
            const startTime = Date.now();
            const response = await axios(config);
            const endTime = Date.now();
            console.log(`Petición a ${url} completada en ${endTime - startTime}ms`);
            
            // Limpiar el timeout ya que la petición se completó
            clearTimeout(timeoutId);
            
            return response.data;
        } catch (error) {
            console.error(`Error en fetchAxios (${url}):`, error.message);
            
            // Manejo específico de errores
            if (error.code === 'ECONNABORTED' || error.name === 'AbortError') {
                console.error(`La petición a ${url} excedió el tiempo de espera (${timeout}ms)`);
                const timeoutError = new Error(`Tiempo de espera excedido (${timeout}ms)`);
                timeoutError.code = 'TIMEOUT';
                throw timeoutError; // Lanzamos el error para que withRetry pueda manejarlo
            } else if (error.response) {
                // Error de respuesta del servidor (4xx, 5xx)
                console.error(`Error de servidor: ${error.response.status} - ${error.response.statusText}`);
                throw error; // Lanzamos el error para que withRetry pueda manejarlo
            } else if (error.request) {
                // No se recibió respuesta
                console.error('No se recibió respuesta del servidor');
                const noResponseError = new Error('No se recibió respuesta del servidor');
                noResponseError.code = 'NO_RESPONSE';
                throw noResponseError; // Lanzamos el error para que withRetry pueda manejarlo
            } else {
                // Error en la configuración de la petición
                throw error; // Lanzamos el error para que withRetry pueda manejarlo
            }
        }
    }, retryOptions).catch(error => {
        // Si después de todos los reintentos sigue fallando, devolvemos un objeto de error
        return { 
            success: false, 
            message: error.message || 'Error en la petición después de reintentos', 
            error: error.response ? error.response.data : error.message,
            code: error.code || 'REQUEST_ERROR'
        };
    });
}

module.exports = {
    fetchAxios
};
