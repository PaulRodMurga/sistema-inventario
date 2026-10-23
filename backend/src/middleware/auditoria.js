const pool = require('../config/database');

const METODOS_MUTACION = new Set([
    'POST',
    'PUT',
    'PATCH',
    'DELETE'
]);

const limitarTexto = (valor, longitud) =>
    String(valor ?? '').trim().slice(0, longitud);

const obtenerRuta = (req) =>
    limitarTexto(
        String(req.originalUrl || req.url || '').split('?')[0],
        255
    );

const obtenerRecurso = (ruta) => {
    const segmentos = ruta.split('/').filter(Boolean);
    const posicionApi = segmentos.indexOf('api');
    return limitarTexto(
        segmentos[posicionApi + 1] || 'desconocido',
        60
    );
};

const convertirId = (valor) => {
    if (!/^[1-9]\d*$/.test(String(valor ?? ''))) return null;

    const numero = Number(valor);
    return Number.isSafeInteger(numero) ? numero : null;
};

const obtenerIdRuta = (ruta) => {
    const segmentos = ruta.split('/').filter(Boolean);

    for (let indice = 2; indice < segmentos.length; indice += 1) {
        const id = convertirId(segmentos[indice]);
        if (id !== null) return id;
    }

    return null;
};

const obtenerIdRespuesta = (cuerpo) => {
    if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
        return null;
    }

    const candidatos = [
        cuerpo.data?.id,
        cuerpo.id,
        cuerpo.acta_id,
        cuerpo.asignacion_id
    ];

    for (const candidato of candidatos) {
        const id = convertirId(candidato);
        if (id !== null) return id;
    }

    return null;
};

const obtenerAccion = (req, recurso, ruta) => {
    if (recurso === 'auth' && /\/logout$/.test(ruta)) {
        return 'CERRAR_SESION';
    }

    if (/\/devolver$/.test(ruta)) return 'DEVOLVER';
    if (/\/clave$/.test(ruta)) return 'RESTABLECER_CLAVE';
    if (/\/inhabilitar$/.test(ruta)) return 'INHABILITAR';
    if (/\/importar$/.test(ruta)) return 'IMPORTAR';
    if (recurso === 'equipos' && /\/lote$/.test(ruta)) {
        return 'REGISTRAR_LOTE';
    }

    if (recurso === 'usuarios' && req.method === 'PUT') {
        const estado = String(req.body?.estado || '')
            .trim()
            .toUpperCase();

        if (estado === 'INACTIVO') return 'DESACTIVAR_USUARIO';
        if (estado === 'ACTIVO') return 'ACTIVAR_USUARIO';
    }

    if (recurso === 'asignaciones' && req.method === 'POST') {
        return 'ASIGNAR';
    }

    if (req.method === 'POST') return 'CREAR';
    if (req.method === 'DELETE') return 'ELIMINAR';
    return 'ACTUALIZAR';
};

const obtenerResultado = (estadoHttp) => {
    if (estadoHttp >= 500) return 'ERROR';
    if (estadoHttp >= 400) return 'RECHAZADO';
    return 'EXITO';
};

const crearMiddlewareAuditoria = (baseDatos = pool) =>
    (req, res, next) => {
        if (
            !METODOS_MUTACION.has(req.method) ||
            !String(req.originalUrl || req.url || '').startsWith('/api/')
        ) {
            return next();
        }

        let idRespuesta = null;
        const jsonOriginal = res.json.bind(res);

        res.json = (cuerpo) => {
            idRespuesta = obtenerIdRespuesta(cuerpo) ?? idRespuesta;
            return jsonOriginal(cuerpo);
        };

        res.once('finish', () => {
            const usuario = req.usuario;
            if (!usuario?.id) return;

            const ruta = obtenerRuta(req);
            const recurso = obtenerRecurso(ruta);
            const estadoHttp = Number(res.statusCode || 500);
            const recursoId = obtenerIdRuta(ruta) ?? idRespuesta;
            const parametros = [
                Number(usuario.id),
                limitarTexto(usuario.usuario, 60),
                limitarTexto(usuario.nombre, 120),
                limitarTexto(usuario.rol, 30),
                obtenerAccion(req, recurso, ruta),
                recurso,
                recursoId,
                limitarTexto(req.method, 10),
                ruta,
                obtenerResultado(estadoHttp),
                estadoHttp,
                limitarTexto(req.ip, 45) || null
            ];

            void Promise.resolve().then(() => baseDatos.query(
                `
                INSERT INTO auditoria (
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
                    ip
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                parametros
            )).catch((error) => {
                console.error('No se pudo registrar la auditoría:', error);
            });
        });

        return next();
    };

module.exports = {
    crearMiddlewareAuditoria,
    obtenerAccion,
    obtenerIdRespuesta,
    obtenerRecurso,
    obtenerResultado,
    obtenerRuta,
    registrarAuditoria: crearMiddlewareAuditoria()
};
