const definirCampo = (
    clave,
    etiqueta,
    tipo = 'text',
    opciones = {}
) => Object.freeze({
    clave,
    etiqueta,
    tipo,
    requerido: false,
    por_unidad: false,
    ...opciones
});

const CAMPOS = Object.freeze({
    nombre_equipo: definirCampo(
        'nombre_equipo',
        'Nombre del equipo',
        'text',
        { max_length: 100, por_unidad: true, placeholder: 'Ejemplo: LAP-TI-001' }
    ),
    direccion_ip: definirCampo(
        'direccion_ip',
        'Dirección IP',
        'text',
        { max_length: 45, por_unidad: true, placeholder: 'Ejemplo: 192.168.1.20' }
    ),
    direccion_mac: definirCampo(
        'direccion_mac',
        'Dirección MAC',
        'text',
        { max_length: 17, por_unidad: true, placeholder: 'AA:BB:CC:DD:EE:FF', formato: 'mac' }
    ),
    ubicacion: definirCampo(
        'ubicacion',
        'Ubicación',
        'text',
        { max_length: 150, por_unidad: true, placeholder: 'Sede, piso o ambiente' }
    ),
    procesador: definirCampo(
        'procesador',
        'Procesador',
        'text',
        { max_length: 120, placeholder: 'Ejemplo: Intel Core i7' }
    ),
    memoria_ram_gb: definirCampo(
        'memoria_ram_gb',
        'Memoria RAM',
        'number',
        { min: 0, max: 1048576, step: 0.01, unidad: 'GB' }
    ),
    almacenamiento_gb: definirCampo(
        'almacenamiento_gb',
        'Almacenamiento',
        'number',
        { min: 0, max: 10485760, step: 0.01, unidad: 'GB' }
    ),
    sistema_operativo: definirCampo(
        'sistema_operativo',
        'Sistema operativo',
        'text',
        { max_length: 100, placeholder: 'Ejemplo: Windows 11 Pro' }
    ),
    capacidad_btu: definirCampo(
        'capacidad_btu',
        'Capacidad',
        'number',
        { min: 0, max: 1000000, step: 1, unidad: 'BTU' }
    ),
    voltaje: definirCampo(
        'voltaje',
        'Voltaje',
        'text',
        { max_length: 30, placeholder: 'Ejemplo: 220 V' }
    ),
    refrigerante: definirCampo(
        'refrigerante',
        'Tipo de refrigerante',
        'text',
        { max_length: 50, placeholder: 'Ejemplo: R410A' }
    ),
    resolucion: definirCampo(
        'resolucion',
        'Resolución',
        'text',
        { max_length: 50, placeholder: 'Ejemplo: 1920x1080' }
    ),
    tipo_camara: definirCampo(
        'tipo_camara',
        'Tipo de cámara',
        'select',
        { opciones: ['IP', 'ANALOGICA', 'OTRA'] }
    ),
    canales: definirCampo(
        'canales',
        'Cantidad de canales',
        'number',
        { min: 1, max: 10000, step: 1, entero: true }
    ),
    capacidad_tb: definirCampo(
        'capacidad_tb',
        'Capacidad',
        'number',
        { min: 0, max: 1048576, step: 0.01, unidad: 'TB' }
    ),
    ancho_banda_mbps: definirCampo(
        'ancho_banda_mbps',
        'Ancho de banda',
        'number',
        { min: 0, max: 100000000, step: 0.01, unidad: 'Mbps' }
    ),
    frecuencia_ghz: definirCampo(
        'frecuencia_ghz',
        'Frecuencia',
        'number',
        { min: 0, max: 100000, step: 0.001, unidad: 'GHz' }
    ),
    puertos: definirCampo(
        'puertos',
        'Cantidad de puertos',
        'number',
        { min: 1, max: 10000, step: 1, entero: true }
    ),
    rendimiento_mbps: definirCampo(
        'rendimiento_mbps',
        'Rendimiento',
        'number',
        { min: 0, max: 100000000, step: 0.01, unidad: 'Mbps' }
    ),
    unidades_rack: definirCampo(
        'unidades_rack',
        'Unidades de rack',
        'number',
        { min: 1, max: 1000, step: 1, entero: true, unidad: 'U' }
    ),
    interfaz: definirCampo(
        'interfaz',
        'Interfaz',
        'text',
        { max_length: 80, placeholder: 'Ejemplo: USB-C, SAS o iSCSI' }
    ),
    tecnologia_impresion: definirCampo(
        'tecnologia_impresion',
        'Tecnología de impresión',
        'select',
        { opciones: ['LASER', 'TINTA', 'TERMICA', 'OTRA'] }
    ),
    impresion_color: definirCampo(
        'impresion_color',
        'Impresión a color',
        'select',
        { opciones: ['SI', 'NO'] }
    ),
    tamano_papel: definirCampo(
        'tamano_papel',
        'Tamaño máximo de papel',
        'text',
        { max_length: 40, placeholder: 'Ejemplo: A3' }
    ),
    tamano_pulgadas: definirCampo(
        'tamano_pulgadas',
        'Tamaño de pantalla',
        'number',
        { min: 0, max: 1000, step: 0.1, unidad: 'pulgadas' }
    ),
    luminosidad_lumenes: definirCampo(
        'luminosidad_lumenes',
        'Luminosidad',
        'number',
        { min: 0, max: 10000000, step: 1, unidad: 'lúmenes' }
    ),
    tipo_conexion: definirCampo(
        'tipo_conexion',
        'Tipo de conexión',
        'text',
        { max_length: 80, placeholder: 'Ejemplo: HDMI, USB o Ethernet' }
    ),
    conectividad: definirCampo(
        'conectividad',
        'Conectividad',
        'select',
        { opciones: ['ALAMBRICO', 'INALAMBRICO'] }
    ),
    distribucion_teclado: definirCampo(
        'distribucion_teclado',
        'Distribución del teclado',
        'text',
        { max_length: 50, placeholder: 'Ejemplo: Español Latinoamérica' }
    ),
    dpi: definirCampo(
        'dpi',
        'Resolución del sensor',
        'number',
        { min: 1, max: 100000, step: 1, entero: true, unidad: 'DPI' }
    ),
    botones: definirCampo(
        'botones',
        'Cantidad de botones',
        'number',
        { min: 1, max: 100, step: 1, entero: true }
    ),
    estandar_movil: definirCampo(
        'estandar_movil',
        'Tecnología móvil',
        'text',
        { max_length: 40, placeholder: 'Ejemplo: 4G LTE o 5G' }
    ),
    iccid: definirCampo(
        'iccid',
        'ICCID',
        'text',
        { max_length: 40, por_unidad: true, placeholder: 'Código de la SIM' }
    ),
    numero_telefono: definirCampo(
        'numero_telefono',
        'Número telefónico',
        'text',
        { max_length: 20, por_unidad: true, placeholder: 'Ejemplo: 999888777' }
    ),
    estandar_wifi: definirCampo(
        'estandar_wifi',
        'Estándar Wi-Fi',
        'text',
        { max_length: 50, placeholder: 'Ejemplo: Wi-Fi 6' }
    ),
    poe: definirCampo(
        'poe',
        'Soporta PoE',
        'select',
        { opciones: ['SI', 'NO'] }
    ),
    slots: definirCampo(
        'slots',
        'Cantidad de slots',
        'number',
        { min: 1, max: 10000, step: 1, entero: true }
    ),
    extension: definirCampo(
        'extension',
        'Extensión',
        'text',
        { max_length: 20, por_unidad: true, placeholder: 'Ejemplo: 1420' }
    ),
    identificador_token: definirCampo(
        'identificador_token',
        'Identificador del token',
        'text',
        { max_length: 100, por_unidad: true }
    ),
    fecha_vencimiento: definirCampo(
        'fecha_vencimiento',
        'Fecha de vencimiento',
        'date',
        { por_unidad: true }
    ),
    altura_metros: definirCampo(
        'altura_metros',
        'Altura',
        'number',
        { min: 0, max: 10000, step: 0.01, unidad: 'm' }
    ),
    capacidad_va: definirCampo(
        'capacidad_va',
        'Capacidad',
        'number',
        { min: 0, max: 100000000, step: 0.01, unidad: 'VA' }
    ),
    potencia_w: definirCampo(
        'potencia_w',
        'Potencia',
        'number',
        { min: 0, max: 100000000, step: 0.01, unidad: 'W' }
    ),
    autonomia_minutos: definirCampo(
        'autonomia_minutos',
        'Autonomía',
        'number',
        { min: 0, max: 1000000, step: 1, entero: true, unidad: 'minutos' }
    ),
    aplicacion: definirCampo(
        'aplicacion',
        'Aplicación o servicio',
        'text',
        { max_length: 120, placeholder: 'Nombre de la aplicación protegida' }
    )
});

const campos = (...claves) => claves.map((clave) => CAMPOS[clave]);

const TIPOS = Object.freeze([
    { codigo: 'ACCESS POINT', perfil: 'RED', acepta_imei: false, campos: campos('nombre_equipo', 'direccion_ip', 'direccion_mac', 'estandar_wifi', 'poe', 'ubicacion') },
    { codigo: 'AIRE ACONDICIONADO', perfil: 'CLIMATIZACION', acepta_imei: false, campos: campos('capacidad_btu', 'voltaje', 'refrigerante', 'ubicacion') },
    { codigo: 'CAMARA VIGILANCIA', perfil: 'VIDEOVIGILANCIA', acepta_imei: false, campos: campos('direccion_ip', 'direccion_mac', 'resolucion', 'tipo_camara', 'ubicacion') },
    { codigo: 'CELULAR', perfil: 'MOVIL', acepta_imei: true, campos: campos('numero_telefono', 'sistema_operativo', 'memoria_ram_gb', 'almacenamiento_gb') },
    { codigo: 'COMPUTADOR', perfil: 'COMPUTO', acepta_imei: false, campos: campos('nombre_equipo', 'procesador', 'memoria_ram_gb', 'almacenamiento_gb', 'sistema_operativo', 'direccion_ip', 'direccion_mac') },
    { codigo: 'DVR', perfil: 'VIDEOVIGILANCIA', acepta_imei: false, campos: campos('direccion_ip', 'direccion_mac', 'canales', 'capacidad_tb', 'ubicacion') },
    { codigo: 'ENLACE', perfil: 'COMUNICACIONES', acepta_imei: false, campos: campos('direccion_ip', 'direccion_mac', 'ancho_banda_mbps', 'frecuencia_ghz', 'ubicacion') },
    { codigo: 'EQUIPO VIDEO CONFERENCIA', perfil: 'AUDIOVISUAL', acepta_imei: false, campos: campos('direccion_ip', 'direccion_mac', 'resolucion', 'tipo_conexion', 'ubicacion') },
    { codigo: 'FIREWALL', perfil: 'RED', acepta_imei: false, campos: campos('nombre_equipo', 'direccion_ip', 'direccion_mac', 'puertos', 'rendimiento_mbps') },
    { codigo: 'GABINETE', perfil: 'INFRAESTRUCTURA', acepta_imei: false, campos: campos('unidades_rack', 'ubicacion') },
    { codigo: 'GATEWAY', perfil: 'RED', acepta_imei: false, campos: campos('nombre_equipo', 'direccion_ip', 'direccion_mac', 'puertos') },
    { codigo: 'HD EXTERNO', perfil: 'ALMACENAMIENTO', acepta_imei: false, campos: campos('capacidad_tb', 'interfaz') },
    { codigo: 'IMPRESORA', perfil: 'IMPRESION', acepta_imei: false, campos: campos('direccion_ip', 'direccion_mac', 'tecnologia_impresion', 'impresion_color', 'tamano_papel', 'ubicacion') },
    { codigo: 'LAPTOP', perfil: 'COMPUTO', acepta_imei: false, campos: campos('nombre_equipo', 'procesador', 'memoria_ram_gb', 'almacenamiento_gb', 'sistema_operativo', 'direccion_mac') },
    { codigo: 'MODEM', perfil: 'MOVIL', acepta_imei: true, campos: campos('direccion_ip', 'direccion_mac', 'estandar_movil', 'iccid') },
    { codigo: 'MONITOR', perfil: 'AUDIOVISUAL', acepta_imei: false, campos: campos('tamano_pulgadas', 'resolucion', 'tipo_conexion') },
    { codigo: 'MOUSE', perfil: 'PERIFERICO', acepta_imei: false, campos: campos('conectividad', 'tipo_conexion', 'dpi', 'botones') },
    { codigo: 'NVR', perfil: 'VIDEOVIGILANCIA', acepta_imei: false, campos: campos('direccion_ip', 'direccion_mac', 'canales', 'capacidad_tb', 'ubicacion') },
    { codigo: 'PANTALLA DIGITAL', perfil: 'AUDIOVISUAL', acepta_imei: false, campos: campos('tamano_pulgadas', 'resolucion', 'tipo_conexion', 'ubicacion') },
    { codigo: 'PLOTTER', perfil: 'IMPRESION', acepta_imei: false, campos: campos('direccion_ip', 'direccion_mac', 'tecnologia_impresion', 'impresion_color', 'tamano_papel', 'ubicacion') },
    { codigo: 'POST', perfil: 'COMPUTO', acepta_imei: false, campos: campos('nombre_equipo', 'procesador', 'memoria_ram_gb', 'almacenamiento_gb', 'sistema_operativo', 'direccion_ip', 'direccion_mac') },
    { codigo: 'PROYECTOR', perfil: 'AUDIOVISUAL', acepta_imei: false, campos: campos('resolucion', 'luminosidad_lumenes', 'tipo_conexion', 'ubicacion') },
    { codigo: 'RADIO ENLACE', perfil: 'COMUNICACIONES', acepta_imei: false, campos: campos('direccion_ip', 'direccion_mac', 'ancho_banda_mbps', 'frecuencia_ghz', 'ubicacion') },
    { codigo: 'RAS', perfil: 'RED', acepta_imei: false, campos: campos('nombre_equipo', 'direccion_ip', 'direccion_mac', 'sistema_operativo', 'puertos') },
    { codigo: 'ROUTER', perfil: 'RED', acepta_imei: false, campos: campos('nombre_equipo', 'direccion_ip', 'direccion_mac', 'puertos', 'rendimiento_mbps') },
    { codigo: 'SCANNER', perfil: 'IMPRESION', acepta_imei: false, campos: campos('resolucion', 'tipo_conexion', 'tamano_papel') },
    { codigo: 'SERVIDOR', perfil: 'COMPUTO', acepta_imei: false, campos: campos('nombre_equipo', 'procesador', 'memoria_ram_gb', 'almacenamiento_gb', 'sistema_operativo', 'direccion_ip', 'direccion_mac') },
    { codigo: 'SIM CARD', perfil: 'MOVIL', acepta_imei: false, campos: campos('iccid', 'numero_telefono', 'estandar_movil') },
    { codigo: 'STORAGE', perfil: 'ALMACENAMIENTO', acepta_imei: false, campos: campos('nombre_equipo', 'direccion_ip', 'direccion_mac', 'capacidad_tb', 'interfaz', 'slots') },
    { codigo: 'SWITCH', perfil: 'RED', acepta_imei: false, campos: campos('nombre_equipo', 'direccion_ip', 'direccion_mac', 'puertos', 'poe', 'rendimiento_mbps') },
    { codigo: 'TABLET', perfil: 'MOVIL', acepta_imei: true, campos: campos('nombre_equipo', 'sistema_operativo', 'memoria_ram_gb', 'almacenamiento_gb', 'direccion_mac') },
    { codigo: 'TAPE LIBRARY', perfil: 'ALMACENAMIENTO', acepta_imei: false, campos: campos('capacidad_tb', 'interfaz', 'slots') },
    { codigo: 'TECLADO', perfil: 'PERIFERICO', acepta_imei: false, campos: campos('conectividad', 'tipo_conexion', 'distribucion_teclado') },
    { codigo: 'TELEFONO', perfil: 'TELEFONIA', acepta_imei: false, campos: campos('numero_telefono', 'extension', 'direccion_ip', 'direccion_mac', 'tipo_conexion') },
    { codigo: 'TELEFONO SATELITAL', perfil: 'MOVIL', acepta_imei: true, campos: campos('numero_telefono', 'iccid', 'estandar_movil') },
    { codigo: 'TOKEN USB', perfil: 'SEGURIDAD', acepta_imei: false, campos: campos('identificador_token', 'fecha_vencimiento') },
    { codigo: 'TORRE COMUNICACION', perfil: 'INFRAESTRUCTURA', acepta_imei: false, campos: campos('altura_metros', 'ubicacion') },
    { codigo: 'UPS', perfil: 'ENERGIA', acepta_imei: false, campos: campos('capacidad_va', 'potencia_w', 'voltaje', 'autonomia_minutos', 'ubicacion') },
    { codigo: 'WASS', perfil: 'SEGURIDAD', acepta_imei: false, campos: campos('nombre_equipo', 'direccion_ip', 'direccion_mac', 'sistema_operativo', 'aplicacion') }
]);

const POR_CODIGO = new Map(TIPOS.map((tipo) => [tipo.codigo, tipo]));
const MAC = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i;

const normalizarFecha = (valor) => {
    if (typeof valor !== 'string') return null;
    const coincidencia = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!coincidencia) return null;
    const fecha = new Date(Date.UTC(
        Number(coincidencia[1]),
        Number(coincidencia[2]) - 1,
        Number(coincidencia[3])
    ));
    return fecha.getUTCFullYear() === Number(coincidencia[1]) &&
        fecha.getUTCMonth() === Number(coincidencia[2]) - 1 &&
        fecha.getUTCDate() === Number(coincidencia[3])
        ? valor
        : null;
};

const normalizarEspecificaciones = (codigoTipo, entrada) => {
    const definicion = POR_CODIGO.get(codigoTipo);

    if (!definicion) {
        return { ok: false, mensaje: 'Selecciona un tipo de equipo válido' };
    }

    if (entrada === null || entrada === undefined) {
        return { ok: true, valor: {} };
    }

    if (typeof entrada !== 'object' || Array.isArray(entrada)) {
        return { ok: false, mensaje: 'Las especificaciones deben ser un objeto' };
    }

    const permitidos = new Map(
        definicion.campos.map((campo) => [campo.clave, campo])
    );
    const salida = {};

    for (const [clave, valorOriginal] of Object.entries(entrada)) {
        const campo = permitidos.get(clave);

        if (!campo) {
            return {
                ok: false,
                mensaje: `La especificación ${clave} no corresponde al tipo ${codigoTipo}`
            };
        }

        if (valorOriginal === '' || valorOriginal === null || valorOriginal === undefined) {
            continue;
        }

        if (campo.tipo === 'number') {
            if (
                typeof valorOriginal !== 'number' ||
                !Number.isFinite(valorOriginal) ||
                valorOriginal < campo.min ||
                valorOriginal > campo.max ||
                (campo.entero && !Number.isInteger(valorOriginal))
            ) {
                return { ok: false, mensaje: `${campo.etiqueta} no tiene un valor válido` };
            }
            salida[clave] = valorOriginal;
            continue;
        }

        if (campo.tipo === 'date') {
            const fecha = normalizarFecha(valorOriginal);
            if (!fecha) {
                return { ok: false, mensaje: `${campo.etiqueta} debe ser una fecha válida` };
            }
            salida[clave] = fecha;
            continue;
        }

        if (typeof valorOriginal !== 'string') {
            return { ok: false, mensaje: `${campo.etiqueta} debe ser texto` };
        }

        const valor = valorOriginal.trim();
        if (!valor) continue;

        if (campo.tipo === 'select' && !campo.opciones.includes(valor)) {
            return { ok: false, mensaje: `${campo.etiqueta} no tiene una opción válida` };
        }

        if (campo.max_length && valor.length > campo.max_length) {
            return { ok: false, mensaje: `${campo.etiqueta} supera ${campo.max_length} caracteres` };
        }

        if (campo.formato === 'mac' && !MAC.test(valor)) {
            return { ok: false, mensaje: `${campo.etiqueta} debe usar el formato AA:BB:CC:DD:EE:FF` };
        }

        salida[clave] = valor;
    }

    for (const campo of definicion.campos) {
        if (campo.requerido && !Object.hasOwn(salida, campo.clave)) {
            return { ok: false, mensaje: `${campo.etiqueta} es obligatorio` };
        }
    }

    return { ok: true, valor: salida };
};

module.exports = {
    TIPOS,
    TIPOS_EQUIPO: new Set(TIPOS.map(({ codigo }) => codigo)),
    TIPOS_PRINCIPALES_PERIFERICOS: new Set(['COMPUTADOR', 'LAPTOP']),

    TIPOS_PERIFERICO: new Set([
        'MONITOR',
        'TECLADO',
        'MOUSE',
        'PARLANTES',
        'CAMARA WEB',
        'AUDIFONOS'
    ]),
    obtenerTipoEquipo: (codigo) => POR_CODIGO.get(codigo) || null,
    normalizarEspecificaciones
};
