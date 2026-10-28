require('dotenv').config();

const express = require('express');
const cors = require('cors');

const {
    obtenerConfiguracion
} = require('./config/entorno');
const {
    crearOpcionesCors,
    ocultarDetallesInternos,
    manejarErroresHttp
} = require('./middleware/seguridad');
const {
    registrarAuditoria
} = require('./middleware/auditoria');
const {
    permitirMutaciones,
    permitirRoles,
    requiereAutenticacion
} = require('./middleware/autenticacion');

const pool = require('./config/database');
const inventarioRoutes = require('./routes/inventarioRoutes');
const inventarioFisicoRoutes = require('./routes/inventarioFisicoRoutes');
const colaboradorRoutes = require('./routes/colaboradorRoutes');
const equipoRoutes = require('./routes/equipoRoutes');
const asignacionRoutes = require('./routes/asignacionRoutes');
const movimientoRoutes = require('./routes/movimientoRoutes');
const lineaRoutes = require('./routes/lineaRoutes');
const actaRoutes = require('./routes/actaRoutes');
const operadorRoutes = require('./routes/operadorRoutes');
const gamaRoutes = require('./routes/gamaRoutes');
const contratoRoutes = require('./routes/contratoRoutes');
const planRoutes = require('./routes/planRoutes');
const contratoGamaRoutes = require('./routes/contratoGamaRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const catalogoRoutes = require('./routes/catalogoRoutes');
const authRoutes = require('./routes/authRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const auditoriaRoutes = require('./routes/auditoriaRoutes');
const qrRoutes = require('./routes/qrRoutes');
const { obtenerActivoQR } = require('./controllers/qrController');

const configuracion = obtenerConfiguracion();
const app = express();

const PORT = configuracion.servidor.puerto;


// ===============================
// MIDDLEWARE
// ===============================

app.disable('x-powered-by');

app.use(
    ocultarDetallesInternos(
        configuracion.servidor.esProduccion
    )
);

app.use(
    cors(
        crearOpcionesCors(
            configuracion.servidor.origenesCors
        )
    )
);

app.use(
    express.json({
        limit: configuracion.servidor.limiteJson
    })
);

app.use(registrarAuditoria);


// ===============================
// RUTA PRINCIPAL
// ===============================

app.get('/', (req, res) => {

    res.json({
        mensaje: 'Servidor del sistema de inventario funcionando'
    });

});


// ===============================
// PRUEBA DE CONEXIÓN MYSQL
// ===============================

app.get(
    '/api/prueba-db',
    requiereAutenticacion,
    permitirRoles('ADMINISTRADOR'),
    async (req, res) => {

        try {

            const [resultado] = await pool.query(
                'SELECT 1 AS conexion'
            );

            res.json({
                success: true,
                mensaje: 'Node.js conectado correctamente a MySQL',
                resultado: resultado
            });

        } catch (error) {

            console.error('Error de conexión:', error);

            res.status(500).json({
                success: false,
                mensaje: 'No se pudo conectar a MySQL'
            });

        }

    }
);

const accesoOperativo = permitirMutaciones(
    'ADMINISTRADOR',
    'OPERADOR'
);
const accesoConfiguracion = permitirMutaciones(
    'ADMINISTRADOR'
);

// La consulta de un activo escaneado es pública y de solo lectura.
app.get('/api/qr/activo/:codigo', obtenerActivoQR);

// Login es la única entrada pública de la API, junto con la consulta QR de activos.
app.use('/api/auth', authRoutes);
app.use(
    '/api/usuarios',
    requiereAutenticacion,
    permitirRoles('ADMINISTRADOR'),
    usuarioRoutes
);
app.use(
    '/api/auditoria',
    requiereAutenticacion,
    permitirRoles('ADMINISTRADOR'),
    auditoriaRoutes
);

app.use('/api/inventario', requiereAutenticacion, inventarioRoutes);
app.use(
    '/api/inventario-fisico',
    requiereAutenticacion,
    accesoOperativo,
    inventarioFisicoRoutes
);
app.use(
    '/api/colaboradores',
    requiereAutenticacion,
    accesoOperativo,
    colaboradorRoutes
);
app.use(
    '/api/equipos',
    requiereAutenticacion,
    accesoOperativo,
    equipoRoutes
);
app.use(
    '/api/asignaciones',
    requiereAutenticacion,
    accesoOperativo,
    asignacionRoutes
);
app.use(
    '/api/movimientos',
    requiereAutenticacion,
    accesoOperativo,
    movimientoRoutes
);
app.use(
    '/api/lineas',
    requiereAutenticacion,
    accesoOperativo,
    lineaRoutes
);
app.use(
    '/api/actas',
    requiereAutenticacion,
    accesoOperativo,
    actaRoutes
);
app.use(
    '/api/operadores',
    requiereAutenticacion,
    accesoConfiguracion,
    operadorRoutes
);
app.use(
    '/api/gamas',
    requiereAutenticacion,
    accesoConfiguracion,
    gamaRoutes
);
app.use(
    '/api/contratos',
    requiereAutenticacion,
    accesoConfiguracion,
    contratoRoutes
);
app.use(
    '/api/planes',
    requiereAutenticacion,
    accesoConfiguracion,
    planRoutes
);
app.use(
    '/api/contrato-gamas',
    requiereAutenticacion,
    accesoConfiguracion,
    contratoGamaRoutes
);
app.use('/api/dashboard', requiereAutenticacion, dashboardRoutes);
app.use('/api/qr', requiereAutenticacion, qrRoutes);
app.use('/api/catalogos', requiereAutenticacion, catalogoRoutes);
app.use('/api', requiereAutenticacion, catalogoRoutes);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        mensaje: 'Ruta no encontrada'
    });
});

app.use(manejarErroresHttp);

// ===============================
// INICIAR SERVIDOR
// ===============================

app.listen(PORT, () => {

    console.log('======================================');
    console.log('   SISTEMA DE INVENTARIO');
    console.log('======================================');
    console.log(`Servidor: http://localhost:${PORT}`);

    for (const advertencia of configuracion.advertencias) {
        console.warn(`ADVERTENCIA: ${advertencia}`);
    }

    console.log('======================================');

});
