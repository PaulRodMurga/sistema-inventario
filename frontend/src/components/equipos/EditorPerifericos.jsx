import { ListPlus, Plus, Trash2 } from 'lucide-react';

import {
    TIPOS_PERIFERICO,
    TIPOS_PERIFERICO_OBLIGATORIOS_COMPUTADOR
} from '../../utils/equipos.helpers';
import CampoTecnico from './CampoTecnico';

function EditorPerifericos({
    catalogo,
    valores,
    prefijo,
    disabled,
    compacto = false,
    onCambiar,
    onCambiarEspecificacion,
    onAgregar,
    onEliminar
}) {
    return (
        <fieldset className={`editor-perifericos ${compacto ? 'compacto' : ''}`}>
            <legend>Periféricos del equipo</legend>
            <div className="ayuda-perifericos">
                <div className="ayuda-perifericos-icono"><ListPlus size={16} aria-hidden="true" /></div>
                <div>
                    <strong>Configuración de periféricos</strong>
                    <p>Para un COMPUTADOR son obligatorios un MONITOR, un TECLADO y un MOUSE. También puedes agregar periféricos adicionales, incluso más de uno del mismo tipo.</p>
                </div>
            </div>

            <div className="lista-editores-periferico">
                {TIPOS_PERIFERICO.map((tipo) => {
                    const perifericos = Array.isArray(valores[tipo])
                        ? valores[tipo]
                        : [valores[tipo]];
                    const definicion = catalogo.find(
                        ({ codigo }) => codigo === tipo
                    );

                    return (
                        <article className="editor-periferico" key={tipo}>
                            <div className="encabezado-editor-periferico">
                                <div className="titulo-editor-periferico">
                                    <strong>{tipo}</strong>
                                    {TIPOS_PERIFERICO_OBLIGATORIOS_COMPUTADOR.includes(tipo) && (
                                        <span className="badge-obligatorio">Obligatorio</span>
                                    )}
                                </div>
                                <span className="contador-editor-periferico">
                                    {perifericos.filter(({ habilitado }) => habilitado).length} incluido(s)
                                </span>
                            </div>

                            {perifericos.map((periferico, indice) => {
                                const idBase = `${prefijo}-${tipo.toLowerCase().replaceAll(' ', '-')}-${indice}`;
                                return (
                                    <div className="bloque-periferico" key={`${tipo}-${indice}`}>
                                        <label className="selector-periferico" htmlFor={`${idBase}-habilitado`}>
                                            <input
                                                id={`${idBase}-habilitado`}
                                                type="checkbox"
                                                checked={periferico.habilitado}
                                                onChange={(evento) => onCambiar(tipo, indice, 'habilitado', evento.target.checked)}
                                                disabled={disabled}
                                            />
                                            <span>{tipo} {perifericos.length > 1 ? `#${indice + 1}` : ''}</span>
                                            <small className={periferico.habilitado ? 'estado-incluido' : ''}>{periferico.habilitado ? 'Se registrará y vinculará' : 'No incluido'}</small>
                                        </label>

                                        {periferico.habilitado && (
                                            <div className="campos-periferico">
                                                <div className="campo-formulario">
                                                    <label htmlFor={`${idBase}-marca`}>Marca *</label>
                                                    <input id={`${idBase}-marca`} value={periferico.marca} maxLength="50" onChange={(evento) => onCambiar(tipo, indice, 'marca', evento.target.value)} disabled={disabled} required />
                                                </div>
                                                <div className="campo-formulario">
                                                    <label htmlFor={`${idBase}-modelo`}>Modelo *</label>
                                                    <input id={`${idBase}-modelo`} value={periferico.modelo} maxLength="100" onChange={(evento) => onCambiar(tipo, indice, 'modelo', evento.target.value)} disabled={disabled} required />
                                                </div>
                                                <div className="campo-formulario">
                                                    <label htmlFor={`${idBase}-patrimonio`}>Código patrimonial</label>
                                                    <input id={`${idBase}-patrimonio`} value={periferico.codigo_patrimonial} maxLength="50" onChange={(evento) => onCambiar(tipo, indice, 'codigo_patrimonial', evento.target.value)} disabled={disabled} />
                                                </div>
                                                <div className="campo-formulario">
                                                    <label htmlFor={`${idBase}-serie`}>Serie</label>
                                                    <input id={`${idBase}-serie`} value={periferico.serie} maxLength="30" onChange={(evento) => onCambiar(tipo, indice, 'serie', evento.target.value)} disabled={disabled} />
                                                </div>
                                                {definicion?.campos.map((campo) => (
                                                    <CampoTecnico
                                                        key={campo.clave}
                                                        id={`${idBase}-${campo.clave}`}
                                                        campo={campo}
                                                        valor={periferico.especificaciones[campo.clave] ?? ''}
                                                        onChange={(valor) => onCambiarEspecificacion(tipo, indice, campo.clave, valor)}
                                                        disabled={disabled}
                                                    />
                                                ))}
                                                <div className="campo-formulario campo-completo">
                                                    <label htmlFor={`${idBase}-observaciones`}>Observaciones</label>
                                                    <textarea id={`${idBase}-observaciones`} value={periferico.observaciones} maxLength="5000" rows="2" onChange={(evento) => onCambiar(tipo, indice, 'observaciones', evento.target.value)} disabled={disabled} />
                                                </div>
                                                {perifericos.length > 1 && (
                                                    <button type="button" className="boton-quitar-periferico" onClick={() => onEliminar(tipo, indice)} disabled={disabled}>
                                                        <Trash2 size={15} aria-hidden="true" /> Quitar este periférico
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            <button type="button" className="boton-agregar-periferico" onClick={() => onAgregar(tipo)} disabled={disabled}>
                                <Plus size={15} aria-hidden="true" />
                                Agregar otro {tipo}
                            </button>
                        </article>
                    );
                })}
            </div>
        </fieldset>
    );
}

export default EditorPerifericos;
