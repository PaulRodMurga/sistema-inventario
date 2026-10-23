const pool = require('../config/database');
const { hashearToken } = require('../utils/criptografia');

const ROLES = Object.freeze({
    ADMINISTRADOR: 'ADMINISTRADOR',
    OPERADOR: 'OPERADOR',
    CONSULTA: 'CONSULTA'
});

const extraerToken = (cabecera) => {
    if (typeof cabecera !== 'string') return null;

    const coincidencia = cabecera.match(
        /^Bearer\s+([A-Za-z0-9_-]{43})$/
    );

    return coincidencia?.[1] || null;
};

const crearMiddlewareAutenticacion = (baseDatos = pool) =>
    async (req, res, next) => {
        const token = extraerToken(req.get?.('authorization'));

        if (!token) {
            return res.status(401).json({
                success: false,
                mensaje: 'Debes iniciar sesión'
            });
        }

        try {
            const [filas] = await baseDatos.query(
                `
                SELECT
                    u.id,
                    u.nombre,
                    u.usuario,
                    u.rol
                FROM sesion_usuario s
                INNER JOIN usuario u
                    ON u.id = s.usuario_id
                WHERE s.token_hash = ?
                  AND s.expira_en > CURRENT_TIMESTAMP
                  AND u.estado = 'ACTIVO'
                LIMIT 1
                `,
                [hashearToken(token)]
            );

            if (filas.length === 0) {
                return res.status(401).json({
                    success: false,
                    mensaje: 'La sesión venció o ya no es válida'
                });
            }

            req.usuario = Object.freeze({
                id: Number(filas[0].id),
                nombre: filas[0].nombre,
                usuario: filas[0].usuario,
                rol: filas[0].rol
            });

            return next();
        } catch (error) {
            console.error('Error al validar la sesión:', error);

            return res.status(500).json({
                success: false,
                mensaje: 'No se pudo validar la sesión'
            });
        }
    };

const permitirRoles = (...rolesPermitidos) => {
    const permitidos = new Set(rolesPermitidos);

    return (req, res, next) => {
        if (!req.usuario || !permitidos.has(req.usuario.rol)) {
            return res.status(403).json({
                success: false,
                mensaje: 'No tienes permisos para realizar esta operación'
            });
        }

        return next();
    };
};

const permitirMutaciones = (...rolesPermitidos) => {
    const autorizar = permitirRoles(...rolesPermitidos);
    const metodosLectura = new Set(['GET', 'HEAD', 'OPTIONS']);

    return (req, res, next) => {
        if (metodosLectura.has(req.method)) return next();
        return autorizar(req, res, next);
    };
};

module.exports = {
    ROLES,
    crearMiddlewareAutenticacion,
    extraerToken,
    permitirMutaciones,
    permitirRoles,
    requiereAutenticacion: crearMiddlewareAutenticacion()
};
