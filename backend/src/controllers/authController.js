const pool = require('../config/database');
const { obtenerConfiguracion } = require('../config/entorno');
const {
    crearTokenSesion,
    hashearToken,
    obtenerHashFicticio,
    verificarClave
} = require('../utils/criptografia');
const { extraerToken } = require('../middleware/autenticacion');

const normalizarUsuario = (valor) =>
    typeof valor === 'string' ? valor.trim().toLowerCase() : '';

const crearControladorAutenticacion = ({
    baseDatos = pool,
    configuracion = obtenerConfiguracion().autenticacion,
    criptografia = {
        crearTokenSesion,
        hashearToken,
        obtenerHashFicticio,
        verificarClave
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
            const [filas] = await baseDatos.query(
                `
                SELECT
                    id,
                    nombre,
                    usuario,
                    clave_hash,
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

            const cuenta = filas[0] || null;
            const hash = cuenta?.clave_hash ||
                await criptografia.obtenerHashFicticio();
            const claveCorrecta = await criptografia.verificarClave(
                clave,
                hash
            );

            if (!cuenta || cuenta.estado !== 'ACTIVO') {
                return res.status(401).json({
                    success: false,
                    mensaje: 'Usuario o contraseña incorrectos'
                });
            }

            const bloqueadoHasta = cuenta.bloqueado_hasta
                ? new Date(cuenta.bloqueado_hasta)
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

            if (!claveCorrecta) {
                const intentos = Number(cuenta.intentos_fallidos || 0) + 1;

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
                        cuenta.id
                    ]
                );

                return res.status(401).json({
                    success: false,
                    mensaje: 'Usuario o contraseña incorrectos'
                });
            }

            const token = criptografia.crearTokenSesion();
            const tokenHash = criptografia.hashearToken(token);

            const conexion = await baseDatos.getConnection();

            try {
                await conexion.beginTransaction();

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

                // Una sola sesión activa por usuario simplifica la revocación.
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
