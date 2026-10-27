const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const multer = require('multer');
const pool = require('../config/database');

const directorio = path.resolve(__dirname, '../../uploads/actas');
fs.mkdirSync(directorio, { recursive: true });

const almacenamiento = multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, directorio),
    filename: (_req, file, callback) => {
        callback(null, `acta-${Date.now()}-${crypto.randomBytes(12).toString('hex')}.pdf`);
    }
});

const cargarPdf = multer({
    storage: almacenamiento,
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, callback) => {
        const extensionPdf = path.extname(file.originalname).toLowerCase() === '.pdf';
        const tipoPdf = file.mimetype === 'application/pdf';
        if (!extensionPdf || !tipoPdf) {
            return callback(new Error('Solo se permiten archivos PDF'));
        }
        callback(null, true);
    }
}).single('archivo');

const camposDocumento = {
    firmas: { columna: 'archivo_firmas_pdf', etiqueta: 'firmas AMO y DMO' },
    devolucion: { columna: 'archivo_devolucion_pdf', etiqueta: 'de devolución' }
};

const validarId = (id) =>
    /^[1-9]\d*$/.test(String(id)) &&
    Number.isSafeInteger(Number(id)) &&
    Number(id) <= 2147483647;

const subirDocumentoActa = (tipo) => async (req, res) => {
    let archivoSubido = null;
    try {
        if (!validarId(req.params.id)) {
            return res.status(400).json({ success: false, mensaje: 'ID de acta no válido' });
        }
        await new Promise((resolve, reject) => {
            cargarPdf(req, res, (error) => error ? reject(error) : resolve());
        });
        archivoSubido = req.file;
        if (!archivoSubido) {
            return res.status(400).json({ success: false, mensaje: 'Selecciona un archivo PDF' });
        }

        const [actas] = await pool.query('SELECT id, ?? AS archivo_actual FROM acta WHERE id = ?', [
            camposDocumento[tipo].columna, Number(req.params.id)
        ]);
        if (actas.length === 0) {
            fs.unlink(archivoSubido.path, () => {});
            return res.status(404).json({ success: false, mensaje: 'Acta no encontrada' });
        }

        const rutaRelativa = path.posix.join('actas', archivoSubido.filename);
        await pool.query(`UPDATE acta SET ${camposDocumento[tipo].columna} = ? WHERE id = ?`, [
            rutaRelativa, Number(req.params.id)
        ]);

        if (actas[0].archivo_actual) {
            const anterior = path.resolve(directorio, path.basename(actas[0].archivo_actual));
            if (anterior.startsWith(directorio + path.sep)) fs.unlink(anterior, () => {});
        }

        return res.json({
            success: true,
            mensaje: `PDF ${camposDocumento[tipo].etiqueta} guardado correctamente`,
            archivo: { disponible: true }
        });
    } catch (error) {
        if (archivoSubido?.path) fs.unlink(archivoSubido.path, () => {});
        if (error instanceof multer.MulterError) {
            const mensaje = error.code === 'LIMIT_FILE_SIZE'
                ? 'El PDF supera el límite de 10 MB'
                : 'No se pudo procesar el archivo PDF';
            return res.status(400).json({ success: false, mensaje });
        }
        if (error.message === 'Solo se permiten archivos PDF') {
            return res.status(400).json({ success: false, mensaje: error.message });
        }
        console.error('Error al guardar PDF de acta:', error);
        return res.status(500).json({ success: false, mensaje: 'No se pudo guardar el PDF del acta' });
    }
};

const descargarDocumentoActa = (tipo) => async (req, res) => {
    try {
        if (!validarId(req.params.id)) {
            return res.status(400).json({ success: false, mensaje: 'ID de acta no válido' });
        }
        const [filas] = await pool.query(
            `SELECT ${camposDocumento[tipo].columna} AS ruta FROM acta WHERE id = ?`,
            [Number(req.params.id)]
        );
        if (!filas.length) return res.status(404).json({ success: false, mensaje: 'Acta no encontrada' });
        if (!filas[0].ruta) return res.status(404).json({ success: false, mensaje: 'Este documento aún no se ha cargado' });

        const archivo = path.resolve(directorio, path.basename(filas[0].ruta));
        if (!archivo.startsWith(directorio + path.sep)) {
            return res.status(400).json({ success: false, mensaje: 'Ruta de documento no válida' });
        }
        await fs.promises.access(archivo, fs.constants.R_OK);
        return res.sendFile(archivo, {
            headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline' }
        });
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({ success: false, mensaje: 'El archivo PDF no está disponible en el servidor' });
        }
        console.error('Error al consultar PDF de acta:', error);
        return res.status(500).json({ success: false, mensaje: 'No se pudo consultar el PDF del acta' });
    }
};

module.exports = {
    subirFirmasActa: subirDocumentoActa('firmas'),
    subirDevolucionActa: subirDocumentoActa('devolucion'),
    descargarFirmasActa: descargarDocumentoActa('firmas'),
    descargarDevolucionActa: descargarDocumentoActa('devolucion')
};
