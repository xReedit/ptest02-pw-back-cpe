/**
 * Servicio para manejar reintentos con backoff exponencial
 * Ayuda a manejar errores temporales en peticiones HTTP y consultas a la base de datos
 */

/**
 * Ejecuta una función con reintentos y backoff exponencial
 * @param {Function} fn - Función a ejecutar
 * @param {Object} options - Opciones de configuración
 * @param {Number} options.maxRetries - Número máximo de reintentos (por defecto: 3)
 * @param {Number} options.initialDelay - Retraso inicial en ms (por defecto: 1000)
 * @param {Number} options.maxDelay - Retraso máximo en ms (por defecto: 10000)
 * @param {Function} options.shouldRetry - Función que determina si se debe reintentar (por defecto: siempre)
 * @returns {Promise<*>} - Resultado de la función
 */
const withRetry = async (fn, options = {}) => {
    const maxRetries = options.maxRetries || 3;
    const initialDelay = options.initialDelay || 1000;
    const maxDelay = options.maxDelay || 10000;
    const shouldRetry = options.shouldRetry || (() => true);
    
    let attempt = 0;
    let lastError = null;
    
    while (attempt <= maxRetries) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            attempt++;
            
            // Si hemos alcanzado el número máximo de reintentos o no debemos reintentar, lanzamos el error
            if (attempt > maxRetries || !shouldRetry(error, attempt)) {
                throw error;
            }
            
            // Calcular el tiempo de espera con backoff exponencial y jitter
            const delay = Math.min(
                maxDelay,
                initialDelay * Math.pow(2, attempt - 1) * (0.5 + Math.random() * 0.5)
            );
            
            console.log(`Intento ${attempt}/${maxRetries} fallido. Reintentando en ${Math.round(delay)}ms. Error: ${error.message}`);
            
            // Esperar antes de reintentar
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    // Este código no debería ejecutarse nunca, pero por si acaso
    throw lastError;
};

/**
 * Determina si un error HTTP debe ser reintentado
 * @param {Error} error - Error a evaluar
 * @returns {Boolean} - true si el error debe ser reintentado
 */
const isRetryableHttpError = (error) => {
    // Errores de red o de servidor que pueden ser temporales
    if (!error.response) {
        // Error de red, timeout, etc.
        return true;
    }
    
    // Errores de servidor (5xx)
    if (error.response && error.response.status >= 500 && error.response.status < 600) {
        return true;
    }
    
    // Errores específicos que sabemos que son temporales
    if (error.code === 'ECONNRESET' || 
        error.code === 'ETIMEDOUT' || 
        error.code === 'ECONNABORTED' ||
        error.message.includes('timeout')) {
        return true;
    }
    
    // Otros errores no son reintentables
    return false;
};

/**
 * Determina si un error de base de datos debe ser reintentado
 * @param {Error} error - Error a evaluar
 * @returns {Boolean} - true si el error debe ser reintentado
 */
const isRetryableDbError = (error) => {
    // Errores comunes de conexión a la base de datos que pueden ser temporales
    if (error.name === 'SequelizeConnectionError' || 
        error.name === 'SequelizeConnectionRefusedError' || 
        error.name === 'SequelizeHostNotFoundError' || 
        error.name === 'SequelizeConnectionTimedOutError' ||
        error.name === 'SequelizeTimeoutError') {
        return true;
    }
    
    // Errores de deadlock o bloqueo que pueden resolverse reintentando
    if (error.name === 'SequelizeDeadlockError' || 
        error.message.includes('deadlock') || 
        error.message.includes('lock wait timeout')) {
        return true;
    }
    
    // Errores de timeout
    if (error.message.includes('timeout')) {
        return true;
    }
    
    // Otros errores no son reintentables
    return false;
};

module.exports = {
    withRetry,
    isRetryableHttpError,
    isRetryableDbError
};
