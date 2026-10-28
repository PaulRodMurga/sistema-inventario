-- Módulo de inventario físico. Ejecutar una sola vez.
CREATE TABLE IF NOT EXISTS inventario_fisico (
 id INT NOT NULL AUTO_INCREMENT,
 nombre VARCHAR(150) NOT NULL,
 fecha_inicio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 fecha_cierre DATETIME DEFAULT NULL,
 responsable_id INT NOT NULL,
 estado ENUM('ABIERTA','CERRADA') NOT NULL DEFAULT 'ABIERTA',
 observaciones TEXT DEFAULT NULL,
 PRIMARY KEY (id),
 KEY idx_inventario_fisico_estado (estado),
 CONSTRAINT fk_inventario_fisico_responsable FOREIGN KEY (responsable_id) REFERENCES usuario(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS detalle_inventario_fisico (
 id INT NOT NULL AUTO_INCREMENT,
 inventario_fisico_id INT NOT NULL,
 equipo_id INT NOT NULL,
 estado_revision ENUM('PENDIENTE','VERIFICADO','UBICACION_DIFERENTE','CON_OBSERVACIONES') NOT NULL DEFAULT 'PENDIENTE',
 fecha_verificacion DATETIME DEFAULT NULL,
 ubicacion_esperada VARCHAR(150) DEFAULT NULL,
 ubicacion_observada VARCHAR(150) DEFAULT NULL,
 observaciones TEXT DEFAULT NULL,
 verificado_por INT DEFAULT NULL,
 PRIMARY KEY (id),
 UNIQUE KEY uq_inventario_fisico_equipo (inventario_fisico_id,equipo_id),
 KEY idx_detalle_inventario_fisico_estado (inventario_fisico_id,estado_revision),
 CONSTRAINT fk_detalle_inventario_fisico_sesion FOREIGN KEY (inventario_fisico_id) REFERENCES inventario_fisico(id) ON DELETE CASCADE,
 CONSTRAINT fk_detalle_inventario_fisico_equipo FOREIGN KEY (equipo_id) REFERENCES equipo(id),
 CONSTRAINT fk_detalle_inventario_fisico_usuario FOREIGN KEY (verificado_por) REFERENCES usuario(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
