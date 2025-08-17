/**
 * Servicio para manejar operaciones de base de datos de manera segura
 * Proporciona funciones para ejecutar consultas con manejo de transacciones y reintentos
 */

const { withRetry, isRetryableDbError } = require('./retry.service');
const Sequelize = require('sequelize');
let config = require('../config');

/**
 * Ejecuta una función dentro de una transacción con reintentos
 * @param {Function} fn - Función a ejecutar que recibe la transacción como parámetro
 * @param {Object} sequelize - Instancia de Sequelize
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<*>} - Resultado de la función
 */
const withTransaction = async (fn, sequelize, options = {}) => {
    const retryOptions = {
        maxRetries: options.maxRetries || 2,
        initialDelay: options.initialDelay || 500,
        maxDelay: options.maxDelay || 3000,
        shouldRetry: isRetryableDbError
    };

    return await withRetry(async () => {
        // Crear transacción con nivel de aislamiento menos restrictivo para evitar bloqueos
        const transaction = await sequelize.transaction({
            isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED
        });

        try {
            const startTime = Date.now();
            const result = await fn(transaction);
            const endTime = Date.now();
            
            console.log(`Operación de base de datos completada en ${endTime - startTime}ms`);
            
            await transaction.commit();
            return result;
        } catch (error) {
            // Asegurar que la transacción se revierte en caso de error
            await transaction.rollback();
            throw error;
        }
    }, retryOptions);
};

/**
 * Ejecuta una consulta SQL con manejo de transacciones y reintentos
 * @param {String} query - Consulta SQL a ejecutar
 * @param {Object} sequelize - Instancia de Sequelize
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<Array>} - Resultado de la consulta
 */
const executeQuery = async (query, sequelize, options = {}) => {
    const queryOptions = {
        type: options.type || sequelize.QueryTypes.SELECT,
        timeout: options.timeout || 15000
    };

    try {
        return await withTransaction(async (transaction) => {
            queryOptions.transaction = transaction;
            return await sequelize.query(query, queryOptions);
        }, sequelize, options);
    } catch (error) {
        console.error('Error al ejecutar consulta SQL:', error.message);
        if (error.message.includes('timeout')) {
            console.error('La consulta excedió el tiempo límite (timeout)');
        }
        return false;
    }
};

/**
 * Ejecuta un stored procedure con manejo de transacciones y reintentos
 * @param {String} query - Consulta SQL del stored procedure
 * @param {Object} sequelize - Instancia de Sequelize
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<Array>} - Resultado del stored procedure
 */
const executeStoredProcedure = async (query, sequelize, options = {}) => {
    try {
        return await withTransaction(async (transaction) => {
            const queryOptions = {
                type: sequelize.QueryTypes.SELECT,
                timeout: options.timeout || 15000,
                transaction
            };
            
            const rows = await sequelize.query(query, queryOptions);
            
            // Procesar el resultado solo si hay datos
            if (rows && rows.length > 0 && rows[0]) {
                return Object.values(rows[0]);
            }
            return [];
        }, sequelize, options);
    } catch (error) {
        console.error('Error al ejecutar stored procedure:', error.message);
        if (error.message.includes('timeout')) {
            console.error('El stored procedure excedió el tiempo límite (timeout)');
        }
        return false;
    }
};

module.exports = {
    withTransaction,
    executeQuery,
    executeStoredProcedure
};
