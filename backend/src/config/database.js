const mysql = require('mysql2/promise');
const {
    obtenerConfiguracion
} = require('./entorno');

const { baseDatos } = obtenerConfiguracion();

const pool = mysql.createPool({
    host: baseDatos.host,
    port: baseDatos.puerto,
    user: baseDatos.usuario,
    password: baseDatos.clave,
    database: baseDatos.nombre,
    waitForConnections: true,
    connectionLimit: baseDatos.limiteConexiones,
    queueLimit: 0,
    enableKeepAlive: true
});

module.exports = pool;
