const CAMPOS_SQL_INTERNOS = new Set([
    'stack',
    'sql',
    'sqlMessage'
]);

const crearOpcionesCors = (origenesPermitidos) => {
    const permitidos = new Set(origenesPermitidos);

    return {
        origin(origen, callback) {
            if (!origen || permitidos.has(origen)) {
                callback(null, true);
                return;
            }

            const error = new Error('Origen no permitido');
            error.code = 'CORS_ORIGIN_DENIED';
            callback(error);
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        optionsSuccessStatus: 204
    };
};

const ocultarDetallesInternos = (esProduccion) => (
    req,
    res,
    next
) => {
    const enviarJson = res.json.bind(res);

    res.json = (cuerpo) => {
        if (
            !esProduccion ||
            cuerpo === null ||
            typeof cuerpo !== 'object' ||
            Array.isArray(cuerpo)
        ) {
            return enviarJson(cuerpo);
        }

        const cuerpoPublico = Object.fromEntries(
            Object.entries(cuerpo).filter(([campo]) => {
                if (CAMPOS_SQL_INTERNOS.has(campo)) return false;
                if (res.statusCode >= 500 && campo === 'error') return false;
                return true;
            })
        );

        return enviarJson(cuerpoPublico);
    };

    next();
};

const manejarErroresHttp = (error, req, res, next) => {
    if (error?.code === 'CORS_ORIGIN_DENIED') {
        return res.status(403).json({
            success: false,
            mensaje: 'Origen no permitido'
        });
    }

    if (error?.type === 'entity.too.large') {
        return res.status(413).json({
            success: false,
            mensaje: 'La solicitud supera el tamaño permitido'
        });
    }

    if (
        error instanceof SyntaxError &&
        error.status === 400 &&
        Object.prototype.hasOwnProperty.call(error, 'body')
    ) {
        return res.status(400).json({
            success: false,
            mensaje: 'El cuerpo JSON no es válido'
        });
    }

    console.error('Error HTTP no controlado:', error);

    if (res.headersSent) {
        return next(error);
    }

    return res.status(500).json({
        success: false,
        mensaje: 'Error interno del servidor'
    });
};

module.exports = {
    crearOpcionesCors,
    ocultarDetallesInternos,
    manejarErroresHttp
};
