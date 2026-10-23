const pool = require('../config/database');

const LIMITE_PREDETERMINADO = 100;
const LIMITE_MAXIMO = 200;

const validarLimite = (valor) => {
    if (valor === undefined) {
        return { valido: true, valor: LIMITE_PREDETERMINADO };
    }

    if (!/^[1-9]\d*$/.test(String(valor))) {
        return { valido: false };
    }

    const numero = Number(valor);
    return {
        valido: Number.isSafeInteger(numero) && numero <= LIMITE_MAXIMO,
        valor: numero
    };
};

const crearControladorAuditoria = (baseDatos = pool) => {
    const listarAuditoria = async (req, res) => {
        const limite = validarLimite(req.query?.limite);

        if (!limite.valido) {
            return res.status(400).json({
                success: false,
                mensaje: `El límite debe ser un entero entre 1 y ${LIMITE_MAXIMO}`
            });
        }

        try {
            const [filas] = await baseDatos.query(
                `
                SELECT
                    id,
                    usuario_id,
                    cuenta_usuario,
                    nombre_usuario,
                    rol_usuario,
                    accion,
                    recurso,
                    recurso_id,
                    metodo,
                    ruta,
                    resultado,
                    estado_http,
                    ip,
                    creado_en
                FROM auditoria
                ORDER BY creado_en DESC, id DESC
                LIMIT ?
                `,
                [limite.valor]
            );

            return res.json({
                success: true,
                cantidad: filas.length,
                data: filas
            });
        } catch (error) {
            console.error('No se pudo consultar la auditoría:', error);

            return res.status(500).json({
                success: false,
                mensaje: 'No se pudo consultar la auditoría'
            });
        }
    };

    return { listarAuditoria };
};

module.exports = {
    crearControladorAuditoria,
    validarLimite,
    ...crearControladorAuditoria()
};

