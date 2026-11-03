const multer = require('multer');

const TAMANO_MAXIMO_FOTO = 2 * 1024 * 1024;
const TIPOS_PERMITIDOS = new Set([
    'image/jpeg',
    'image/png',
    'image/webp'
]);

const carga = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: TAMANO_MAXIMO_FOTO,
        files: 1
    },
    fileFilter(req, file, callback) {
        if (!TIPOS_PERMITIDOS.has(file.mimetype)) {
            const error = new Error('La foto debe estar en formato JPG, PNG o WEBP');
            error.status = 400;
            callback(error);
            return;
        }

        callback(null, true);
    }
});

const recibirFotoPerfil = (req, res, next) => {
    carga.single('foto')(req, res, (error) => {
        if (!error) {
            next();
            return;
        }

        const mensaje = error.code === 'LIMIT_FILE_SIZE'
            ? 'La foto no debe superar los 2 MB'
            : error.message || 'No se pudo recibir la foto de perfil';

        res.status(error.status || 400).json({
            success: false,
            mensaje
        });
    });
};

module.exports = { recibirFotoPerfil };
