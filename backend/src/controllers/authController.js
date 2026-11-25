const pool = require('../config/database');
const { obtenerConfiguracion } = require('../config/entorno');
const {
    crearTokenSesion,
    hashearToken
} = require('../utils/criptografia');
const { extraerToken } = require('../middleware/autenticacion');
const {
    validarCuentaDirectorioActivo
} = require('../services/directorioActivoService');

const normalizarUsuario = (valor) =>
    typeof valor === 'string' ? valor.trim().toLowerCase() : '';

const crearControladorAutenticacion = ({
    baseDatos = pool,
    configuracion = obtenerConfiguracion().autenticacion,
    configuracionAD = obtenerConfiguracion().directorioActivo,
    validarCredencialesAD = validarCuentaDirectorioActivo,
    criptografia = {
        crearTokenSesion,
        hashearToken
    }
} = {}) => {
    const iniciarSesion = async (req, res) => {
        const usuarioIngresado = normalizarUsuario(req.body?.usuario);
        const clave = req.body?.clave;

        if (
            !/^[a-z0-9._-]{3,60}$/.test(usuarioIngresado) ||
            typeof clave !== 'string' ||
            clave.length < 1 ||
            clave.length > 128
        ) {
            return res.status(400).json({
                success: false,
                mensaje: 'Ingresa un usuario y una contraseña válidos'
            });
        }

        try {
            const [usuariosExistentes] = await baseDatos.query(
                `
                SELECT
                    id,
                    nombre,
                    usuario,
                    rol,
                    estado,
                    intentos_fallidos,
                    bloqueado_hasta
                FROM usuario
                WHERE usuario = ?
                LIMIT 1
                `,
                [usuarioIngresado]
            );

            const usuarioExistente = usuariosExistentes[0] || null;

            if (usuarioExistente?.estado === 'INACTIVO') {
                return res.status(403).json({
                    success: false,
                    mensaje: 'Tu acceso al sistema está deshabilitado. Contacta al administrador'
                });
            }

            const bloqueadoHasta = usuarioExistente?.bloqueado_hasta
                ? new Date(usuarioExistente.bloqueado_hasta)
                : null;

            if (
                bloqueadoHasta &&
                !Number.isNaN(bloqueadoHasta.getTime()) &&
                bloqueadoHasta > new Date()
            ) {
                return res.status(429).json({
                    success: false,
                    mensaje: 'Acceso temporalmente bloqueado. Intenta nuevamente más tarde'
                });
            }

            let cuentaAD;
            try {
                cuentaAD = await validarCredencialesAD(
                    usuarioIngresado,
                    clave,
                    configuracionAD
                );
            } catch (errorAD) {
                console.error(
                    'No se pudo consultar Active Directory:',
                    errorAD?.message || 'Error desconocido'
                );

                return res.status(errorAD?.estadoHttp || 502).json({
                    success: false,
                    mensaje: errorAD?.estadoHttp === 503
                        ? 'La autenticación corporativa no está configurada. Contacta al administrador'
                        : 'No se pudo validar la cuenta corporativa. Intenta nuevamente más tarde'
                });
            }

            if (!cuentaAD) {
                if (usuarioExistente) {
                    const intentos = Number(usuarioExistente.intentos_fallidos || 0) + 1;

                    await baseDatos.query(
                        `
                        UPDATE usuario
                        SET
                            intentos_fallidos = ?,
                            bloqueado_hasta = CASE
                                WHEN ? >= ?
                                    THEN DATE_ADD(
                                        CURRENT_TIMESTAMP,
                                        INTERVAL ? MINUTE
                                    )
                                ELSE NULL
                            END
                        WHERE id = ?
                        `,
                        [
                            intentos,
                            intentos,
                            configuracion.maxIntentos,
                            configuracion.minutosBloqueo,
                            usuarioExistente.id
                        ]
                    );
                }

                return res.status(401).json({
                    success: false,
                    mensaje: 'Usuario o contraseña incorrectos'
                });
            }

            const nombreCompleto = (
                typeof cuentaAD.nombreCompleto === 'string' &&
                cuentaAD.nombreCompleto.trim()
                    ? cuentaAD.nombreCompleto.trim()
                    : usuarioIngresado
            ).slice(0, 120);

            const token = criptografia.crearTokenSesion();
            const tokenHash = criptografia.hashearToken(token);
            const conexion = await baseDatos.getConnection();

            let cuenta;
            try {
                await conexion.beginTransaction();

                // Si es el primer ingreso, crea la cuenta con rol CONSULTA.
                // En cuentas existentes solo sincroniza el nombre: nunca cambia
                // el rol ni reactiva cuentas que un administrador deshabilitó.
                await conexion.query(
                    `
                    INSERT INTO usuario (
                        nombre,
                        usuario,
                        clave_hash,
                        rol,
                        estado,
                        intentos_fallidos,
                        bloqueado_hasta,
                        ultimo_acceso
                    )
                    VALUES (?, ?, NULL, 'CONSULTA', 'ACTIVO', 0, NULL, CURRENT_TIMESTAMP)
                    ON DUPLICATE KEY UPDATE
                        nombre = IF(estado = 'ACTIVO', VALUES(nombre), nombre)
                    `,
                    [nombreCompleto, usuarioIngresado]
                );

                const [usuarios] = await conexion.query(
                    `
                    SELECT id, nombre, usuario, rol, estado
                    FROM usuario
                    WHERE usuario = ?
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [usuarioIngresado]
                );

                cuenta = usuarios[0] || null;

                if (!cuenta || cuenta.estado !== 'ACTIVO') {
                    await conexion.rollback();
                    return res.status(403).json({
                        success: false,
                        mensaje: 'Tu acceso al sistema está deshabilitado. Contacta al administrador'
                    });
                }

                await conexion.query(
                    `
                    UPDATE usuario
                    SET
                        intentos_fallidos = 0,
                        bloqueado_hasta = NULL,
                        ultimo_acceso = CURRENT_TIMESTAMP
                    WHERE id = ?
                    `,
                    [cuenta.id]
                );

                await conexion.query(
                    'DELETE FROM sesion_usuario WHERE usuario_id = ?',
                    [cuenta.id]
                );

                await conexion.query(
                    `
                    INSERT INTO sesion_usuario (
                        usuario_id,
                        token_hash,
                        expira_en
                    )
                    VALUES (
                        ?,
                        ?,
                        DATE_ADD(
                            CURRENT_TIMESTAMP,
                            INTERVAL ? HOUR
                        )
                    )
                    `,
                    [
                        cuenta.id,
                        tokenHash,
                        configuracion.duracionSesionHoras
                    ]
                );

                await conexion.commit();
            } catch (error) {
                await conexion.rollback();
                throw error;
            } finally {
                conexion.release();
            }

            return res.json({
                success: true,
                data: {
                    token,
                    expira_en: new Date(
                        Date.now() +
                        configuracion.duracionSesionHoras * 60 * 60 * 1000
                    ).toISOString(),
                    usuario: {
                        id: Number(cuenta.id),
                        nombre: cuenta.nombre,
                        usuario: cuenta.usuario,
                        rol: cuenta.rol
                    }
                }
            });
        } catch (error) {
            console.error('Error al iniciar sesión:', error);

            return res.status(500).json({
                success: false,
                mensaje: 'No se pudo iniciar sesión'
            });
        }
    };

    const obtenerSesion = (req, res) => res.json({
        success: true,
        data: {
            usuario: req.usuario
        }
    });

    const cerrarSesion = async (req, res) => {
        const token = extraerToken(req.get?.('authorization'));

        try {
            if (token) {
                await baseDatos.query(
                    'DELETE FROM sesion_usuario WHERE token_hash = ?',
                    [criptografia.hashearToken(token)]
                );
            }

            return res.json({
                success: true,
                mensaje: 'Sesión cerrada correctamente'
            });
        } catch (error) {
            console.error('Error al cerrar sesión:', error);

            return res.status(500).json({
                success: false,
                mensaje: 'No se pudo cerrar la sesión'
            });
        }
    };

    return {
        cerrarSesion,
        iniciarSesion,
        obtenerSesion
    };
};

module.exports = {
    crearControladorAutenticacion,
    ...crearControladorAutenticacion()
};
