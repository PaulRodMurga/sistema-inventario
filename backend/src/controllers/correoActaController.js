const pool = require('../config/database');

const enviarActaPorCorreo = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { tipo, html } = req.body || {};

        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, mensaje: 'La asignación indicada no es válida' });
        }
        if (!['ENTREGA', 'DEVOLUCION'].includes(tipo)) {
            return res.status(400).json({ success: false, mensaje: 'El tipo de acta no es válido' });
        }
        if (typeof html !== 'string' || !html.trim() || html.length > 800000) {
            return res.status(400).json({ success: false, mensaje: 'El contenido del acta no es válido' });
        }

        const [filas] = await pool.query(`
            SELECT c.correo, c.nombres, c.apellidos, a.id AS asignacion_id
            FROM asignacion a
            INNER JOIN colaborador c ON c.id = a.colaborador_id
            WHERE a.id = ? LIMIT 1
        `, [id]);
        const colaborador = filas[0];
        if (!colaborador) {
            return res.status(404).json({ success: false, mensaje: 'No se encontró la asignación o su colaborador' });
        }
        if (!colaborador.correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(colaborador.correo)) {
            return res.status(422).json({ success: false, mensaje: 'El colaborador no tiene un correo válido registrado' });
        }

        const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
        if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
            console.error('Falta configurar SMTP_HOST, SMTP_PORT, SMTP_USER y SMTP_PASS en el .env');
            return res.status(503).json({ success: false, mensaje: 'El correo no está configurado. Completa los parámetros SMTP en el archivo .env del backend.' });
        }

        const nodemailer = require('nodemailer');
        const puppeteer = require('puppeteer');
        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: Number(SMTP_PORT),
            secure: String(SMTP_SECURE).toLowerCase() === 'true',
            auth: { user: SMTP_USER, pass: SMTP_PASS }
        });

        let navegador;
        let pdf;
        try {
            navegador = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
            const pagina = await navegador.newPage();
            const htmlSeguro = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
            await pagina.setContent(htmlSeguro, { waitUntil: 'networkidle0', timeout: 30000 });
            pdf = await pagina.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' } });
        } finally {
            if (navegador) await navegador.close();
        }

        const esDevolucion = tipo === 'DEVOLUCION';
        const nombreArchivo = `${esDevolucion ? 'Cargo-de-devolucion' : 'Acta-de-entrega'}-ASG-${String(id).padStart(6, '0')}.pdf`;
        await transporter.sendMail({
            from: SMTP_FROM || SMTP_USER,
            to: colaborador.correo,
            subject: `${esDevolucion ? 'Cargo de devolución' : 'Acta de entrega'} de equipo - ASG-${String(id).padStart(6, '0')}`,
            text: `Hola ${colaborador.nombres || ''} ${colaborador.apellidos || ''},\n\nAdjuntamos el documento correspondiente a la ${esDevolucion ? 'devolución' : 'entrega'} de tu equipo.\n\nEste correo fue generado automáticamente por el Sistema de Inventario.`,
            html: `<p>Hola ${String(colaborador.nombres || '').replace(/[&<>"']/g, '')} ${String(colaborador.apellidos || '').replace(/[&<>"']/g, '')},</p><p>Adjuntamos el documento correspondiente a la ${esDevolucion ? 'devolución' : 'entrega'} de tu equipo.</p><p>Este correo fue generado automáticamente por el Sistema de Inventario.</p>`,
            attachments: [{ filename: nombreArchivo, content: pdf, contentType: 'application/pdf' }]
        });

        return res.json({ success: true, mensaje: `Acta enviada correctamente a ${colaborador.correo}`, correo: colaborador.correo });
    } catch (error) {
        console.error('Error al enviar acta por correo:', error);
        return res.status(500).json({ success: false, mensaje: 'No se pudo enviar el acta por correo. Verifica la configuración SMTP y las dependencias del backend.' });
    }
};

module.exports = { enviarActaPorCorreo };
