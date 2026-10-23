import { useRef, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    Download,
    FileSpreadsheet,
    LoaderCircle,
    Upload,
    X
} from 'lucide-react';

import DialogoAccesible from './DialogoAccesible';
import { contarRegistrosImportacion } from '../utils/importacionExcel';

import './ImportacionExcelModal.css';

function ImportacionExcelModal({
    abierto,
    titulo,
    descripcion,
    plantilla,
    leerArchivo,
    validar,
    importar,
    onCerrar,
    onImportado
}) {
    const [archivo, setArchivo] = useState(null);
    const [carga, setCarga] = useState(null);
    const [resultado, setResultado] = useState(null);
    const [error, setError] = useState('');
    const [procesando, setProcesando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const inputRef = useRef(null);

    const limpiar = () => {
        setArchivo(null);
        setCarga(null);
        setResultado(null);
        setError('');
        setProcesando(false);
        setGuardando(false);
        if (inputRef.current) inputRef.current.value = '';
    };

    const cerrar = () => {
        if (procesando || guardando) return;
        limpiar();
        onCerrar();
    };

    if (!abierto) return null;

    const seleccionarArchivo = async (evento) => {
        const seleccionado = evento.target.files?.[0] || null;
        setArchivo(seleccionado);
        setCarga(null);
        setResultado(null);
        setError('');

        if (!seleccionado) return;

        if (!seleccionado.name.toLowerCase().endsWith('.xlsx')) {
            setError('Selecciona un archivo de Excel con extensión .xlsx');
            evento.target.value = '';
            setArchivo(null);
            return;
        }

        try {
            setProcesando(true);
            const datos = await leerArchivo(seleccionado);
            const validacion = await validar(datos);
            setCarga(datos);
            setResultado(validacion);
        } catch (errorSolicitud) {
            setError(errorSolicitud.message || 'No se pudo leer el archivo');
        } finally {
            setProcesando(false);
        }
    };

    const ejecutarImportacion = async () => {
        if (!carga || !resultado?.valido || guardando) return;

        try {
            setGuardando(true);
            setError('');
            const respuesta = await importar(carga);
            limpiar();
            onImportado(respuesta.mensaje || 'Información importada correctamente');
        } catch (errorSolicitud) {
            if (Array.isArray(errorSolicitud.datos?.errores)) {
                setResultado(errorSolicitud.datos);
            }
            setError(errorSolicitud.message || 'No se pudo completar la importación');
        } finally {
            setGuardando(false);
        }
    };

    const conteos = contarRegistrosImportacion(carga);
    const errores = resultado?.errores || [];

    return (
        <DialogoAccesible
            className="modal-importacion-excel"
            tituloId="importacion-excel-titulo"
            descripcionId="importacion-excel-descripcion"
            onCerrar={cerrar}
            bloqueado={procesando || guardando}
            ocupado={procesando || guardando}
        >
            <div className="modal-encabezado">
                <div>
                    <h3 id="importacion-excel-titulo">{titulo}</h3>
                    <p id="importacion-excel-descripcion">{descripcion}</p>
                </div>
                <button
                    type="button"
                    className="modal-cerrar"
                    onClick={cerrar}
                    disabled={procesando || guardando}
                    aria-label="Cerrar importación"
                >
                    <X size={20} aria-hidden="true" />
                </button>
            </div>

            <div className="importacion-excel-cuerpo">
                <section className="importacion-paso">
                    <span className="importacion-numero">1</span>
                    <div>
                        <strong>Descarga y completa la plantilla</strong>
                        <p>No cambies los nombres de las hojas ni de las columnas.</p>
                        <a className="boton-plantilla" href={plantilla} download>
                            <Download size={17} aria-hidden="true" />
                            Descargar plantilla Excel
                        </a>
                    </div>
                </section>

                <section className="importacion-paso">
                    <span className="importacion-numero">2</span>
                    <div>
                        <strong>Selecciona el archivo completado</strong>
                        <p>Se validará el contenido antes de guardar cualquier registro.</p>
                        <input
                            ref={inputRef}
                            className="importacion-input-oculto"
                            type="file"
                            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            onChange={seleccionarArchivo}
                            disabled={procesando || guardando}
                        />
                        <button
                            type="button"
                            className="importacion-selector"
                            onClick={() => inputRef.current?.click()}
                            disabled={procesando || guardando}
                        >
                            {procesando ? (
                                <LoaderCircle className="girando" size={20} aria-hidden="true" />
                            ) : (
                                <Upload size={20} aria-hidden="true" />
                            )}
                            <span>{archivo?.name || 'Elegir archivo .xlsx'}</span>
                        </button>
                    </div>
                </section>

                {error && (
                    <div className="importacion-aviso importacion-aviso-error" role="alert">
                        <AlertTriangle size={19} aria-hidden="true" />
                        <span>{error}</span>
                    </div>
                )}

                {resultado && (
                    <section className="importacion-resultado">
                        <div className={resultado.valido ? 'importacion-aviso importacion-aviso-exito' : 'importacion-aviso importacion-aviso-error'}>
                            {resultado.valido ? (
                                <CheckCircle2 size={20} aria-hidden="true" />
                            ) : (
                                <AlertTriangle size={20} aria-hidden="true" />
                            )}
                            <div>
                                <strong>
                                    {resultado.valido
                                        ? 'Archivo listo para importar'
                                        : `Se encontraron ${errores.length} errores`}
                                </strong>
                                <span>
                                    {conteos.equipos > 0 && `${conteos.equipos} equipos`}
                                    {conteos.equipos > 0 && conteos.perifericos > 0 && ' · '}
                                    {conteos.perifericos > 0 && `${conteos.perifericos} periféricos`}
                                    {conteos.colaboradores > 0 && `${conteos.colaboradores} colaboradores`}
                                </span>
                            </div>
                        </div>

                        {errores.length > 0 && (
                            <div className="importacion-errores-scroll">
                                <table className="importacion-errores">
                                    <thead>
                                        <tr>
                                            <th>Hoja</th>
                                            <th>Fila</th>
                                            <th>Campo</th>
                                            <th>Problema</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {errores.map((item, indice) => (
                                            <tr key={`${item.hoja}-${item.fila}-${item.campo}-${indice}`}>
                                                <td>{item.hoja || '-'}</td>
                                                <td>{item.fila || '-'}</td>
                                                <td>{item.campo || '-'}</td>
                                                <td>{item.mensaje}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                )}
            </div>

            <div className="modal-acciones">
                <button
                    type="button"
                    className="boton-cancelar"
                    onClick={cerrar}
                    disabled={procesando || guardando}
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    className="boton-guardar"
                    onClick={ejecutarImportacion}
                    disabled={!resultado?.valido || procesando || guardando}
                >
                    {guardando ? (
                        <LoaderCircle className="girando" size={18} aria-hidden="true" />
                    ) : (
                        <FileSpreadsheet size={18} aria-hidden="true" />
                    )}
                    {guardando ? 'Importando...' : 'Importar registros'}
                </button>
            </div>
        </DialogoAccesible>
    );
}

export default ImportacionExcelModal;
