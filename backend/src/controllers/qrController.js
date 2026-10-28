const pool = require('../config/database');
const QRCode = require('qrcode');

const normalizarCodigo = (valor) =>
    typeof valor === 'string' && /^(EQ|PF)-[1-9]\d*$/.test(valor)
        ? valor
        : null;

const obtenerUrlActivo = (req, codigo) => {
    const base = process.env.FRONTEND_URL || req.headers.origin;
    if (!base) throw new Error('Configura FRONTEND_URL para generar los QR');
    return `${base.replace(/\/+$/, '')}/activo/${codigo}`;
};

const listarActivosQR = async (req, res) => {
    try {
        const [filas] = await pool.query(`
            SELECT
                e.id,
                e.tipo,
                e.marca,
                e.modelo,
                e.serie,
                e.codigo_patrimonial,
                e.estado_actual,
                CASE WHEN e.tipo IN ('MONITOR', 'TECLADO', 'MOUSE', 'PARLANTES', 'CAMARA WEB', 'AUDIFONOS') THEN 'PF' ELSE 'EQ' END AS prefijo
            FROM equipo e
            LEFT JOIN equipo_periferico ep ON ep.periferico_id = e.id
            ORDER BY e.id
        `);

        const activos = await Promise.all(filas.map(async (fila) => {
            const codigo = `${fila.prefijo}-${fila.id}`;
            const url = obtenerUrlActivo(req, codigo);
            return {
                ...fila,
                codigo_qr: codigo,
                url,
                qr: await QRCode.toDataURL(url, {
                    errorCorrectionLevel: 'M',
                    margin: 2,
                    width: 240
                })
            };
        }));

        return res.json({ success: true, cantidad: activos.length, data: activos });
    } catch (error) {
        console.error('Error al generar etiquetas QR:', error);
        return res.status(500).json({
            success: false,
            mensaje: 'No se pudieron generar las etiquetas QR. Verifica FRONTEND_URL y la conexión con la base de datos.'
        });
    }
};

const obtenerActivoQR = async (req, res) => {
    const codigo = normalizarCodigo(req.params.codigo);
    if (!codigo) {
        return res.status(400).json({ success: false, mensaje: 'El código QR no es válido' });
    }

    const [prefijo, idTexto] = codigo.split('-');
    const id = Number(idTexto);

    try {
        const [filas] = await pool.query(`
            SELECT
                e.id, e.tipo, e.marca, e.modelo, e.serie,
                e.codigo_patrimonial, e.imei, e.estado_actual,
                e.observaciones, e.contrato_gama_id,
                cm.nro_contrato,
                ep.equipo_principal_id,
                principal.serie AS serie_equipo_principal,
                (
                    SELECT CONCAT(c.nombres, ' ', c.apellidos)
                    FROM asignacion a
                    INNER JOIN colaborador c ON c.id = a.colaborador_id
                    WHERE a.estado = 'ACTIVA'
                      AND (a.equipo_id = e.id OR a.equipo_id = principal.id)
                    ORDER BY a.id DESC LIMIT 1
                ) AS colaborador_asignado
            FROM equipo e
            LEFT JOIN equipo_periferico ep ON ep.periferico_id = e.id
            LEFT JOIN equipo principal ON principal.id = ep.equipo_principal_id
            LEFT JOIN contrato_gama cg ON cg.id = e.contrato_gama_id
            LEFT JOIN contrato_movil cm ON cm.id = cg.contrato_id
            WHERE e.id = ?
            LIMIT 1
        `, [id]);

        const activo = filas[0];
        if (!activo || (prefijo === 'PF' && !activo.equipo_principal_id) ||
            (prefijo === 'EQ' && activo.equipo_principal_id)) {
            return res.status(404).json({ success: false, mensaje: 'No se encontró el activo asociado a este QR' });
        }

        const [perifericos] = await pool.query(`
            SELECT p.id, ep.tipo_periferico, p.marca, p.modelo,
                   p.serie, p.codigo_patrimonial, p.estado_actual
            FROM equipo_periferico ep
            INNER JOIN equipo p ON p.id = ep.periferico_id
            WHERE ep.equipo_principal_id = ?
            ORDER BY ep.tipo_periferico
        `, [activo.equipo_principal_id || activo.id]);

        return res.json({
            success: true,
            data: {
                ...activo,
                codigo_qr: codigo,
                ubicacion: null,
                perifericos: prefijo === 'EQ' ? perifericos : []
            }
        });
    } catch (error) {
        console.error('Error al consultar activo por QR:', error);
        return res.status(500).json({ success: false, mensaje: 'No se pudo consultar el activo' });
    }
};

module.exports = { listarActivosQR, obtenerActivoQR };
