-- Perfil de usuario: foto de perfil persistente.
-- Ejecutar una sola vez en la base de datos del sistema de inventario.

CREATE TABLE IF NOT EXISTS usuario_perfil (
    usuario_id INT UNSIGNED NOT NULL,
    foto_perfil VARCHAR(255) NULL,
    actualizado_en TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id),
    CONSTRAINT fk_usuario_perfil_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuario (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
