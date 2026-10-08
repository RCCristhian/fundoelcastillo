#!/usr/bin/env python3
"""
Base de datos SQLite y migraciones iniciales para Gestión de Campo Agrícola.
Inicializa la base de datos con los datos extraídos del Excel del usuario:
- 3 hectáreas alquiladas (2 ha a Propietario A, 1 ha a Propietario B)
- Variedades: Palta Fuerte 1 (140 árboles, 2009), Palta Fuerte 2 (260 árboles, 2023), Palta Hass (600 árboles, 2010), Plátano (300 plantas), Frutales Varios
- Catálogo de insumos agrícolas
- Trabajadores (Mauro Robles, Kike, etc.)
- Gasto inicial de 220 (Movimiento de tierra a caballo)
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "campo_agricola.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    # Tabla de Campañas Agrícolas (Escenarios por año)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS campanas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE,
        anio INTEGER NOT NULL,
        activa INTEGER DEFAULT 0,
        notas TEXT
    );
    """)

    # Tabla de Configuración y Parcelas/Arriendos
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS parcelas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        hectareas REAL NOT NULL,
        tipo_tenencia TEXT DEFAULT 'Alquilado', -- 'Alquilado' o 'Propio'
        propietario TEXT,
        costo_alquiler_mensual REAL DEFAULT 0,
        notas TEXT
    );
    """)

    # Tabla de Variedades / Especies
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS variedades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE,
        especie TEXT NOT NULL,
        num_arboles INTEGER DEFAULT 0,
        anio_plantacion INTEGER,
        hectareas REAL DEFAULT 0,
        parcela_id INTEGER,
        notas TEXT,
        FOREIGN KEY (parcela_id) REFERENCES parcelas(id) ON DELETE SET NULL
    );
    """)

    # Tabla de Insumos / Productos Químicos
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS productos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE,
        categoria TEXT DEFAULT 'Fertilizante / Fitosanitario',
        unidad TEXT DEFAULT 'Litros/Kg',
        stock_anterior REAL DEFAULT 0,
        stock_actual REAL DEFAULT 0,
        precio_referencial REAL DEFAULT 0,
        notas TEXT
    );
    """)

    # Compras de Insumos / Químicos
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS compras_productos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL,
        producto_id INTEGER NOT NULL,
        cantidad REAL NOT NULL,
        precio_unitario REAL NOT NULL,
        total REAL NOT NULL,
        proveedor TEXT,
        nro_factura TEXT,
        nro_albaran TEXT,
        pagado INTEGER DEFAULT 1, -- 1: Si, 0: No
        notas TEXT,
        FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT
    );
    """)

    # Tratamientos / Aplicaciones en campo
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tratamientos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL,
        variedad_id INTEGER NOT NULL,
        producto_id INTEGER NOT NULL,
        cantidad REAL NOT NULL,
        precio_unitario REAL NOT NULL,
        total REAL NOT NULL,
        notas TEXT,
        FOREIGN KEY (variedad_id) REFERENCES variedades(id) ON DELETE RESTRICT,
        FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT
    );
    """)

    # Venta de Productos (Cosecha)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ventas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL,
        variedad_id INTEGER NOT NULL,
        kilos REAL NOT NULL,
        precio_kilo REAL NOT NULL,
        total REAL NOT NULL,
        comprador TEXT,
        nro_boleta TEXT,
        nro_factura TEXT,
        cobrado INTEGER DEFAULT 1, -- 1: Si, 0: No
        notas TEXT,
        FOREIGN KEY (variedad_id) REFERENCES variedades(id) ON DELETE RESTRICT
    );
    """)

    # Ingresos Financieros / Otros
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ingresos_financieros (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL,
        concepto TEXT NOT NULL,
        total REAL NOT NULL,
        pagador TEXT,
        nro_factura TEXT,
        notas TEXT
    );
    """)

    # Gastos Específicos (por variedad)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS gastos_especificos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL,
        concepto TEXT NOT NULL,
        total REAL NOT NULL,
        empresa TEXT,
        nro_factura TEXT,
        variedad_id INTEGER,
        notas TEXT,
        FOREIGN KEY (variedad_id) REFERENCES variedades(id) ON DELETE SET NULL
    );
    """)

    # Gastos Generales (del campo / comunes)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS gastos_generales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL,
        concepto TEXT NOT NULL,
        total REAL NOT NULL,
        empresa TEXT,
        nro_factura TEXT,
        categoria TEXT DEFAULT 'Mantenimiento / Operación',
        notas TEXT
    );
    """)

    # Trabajadores
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS trabajadores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE,
        telefono TEXT,
        rol TEXT DEFAULT 'Jornalero',
        costo_hora_defecto REAL DEFAULT 10.0,
        activo INTEGER DEFAULT 1
    );
    """)

    # Jornales / Mano de Obra diaria
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS jornales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL,
        trabajador_id INTEGER NOT NULL,
        variedad_id INTEGER,
        horas REAL NOT NULL,
        precio_hora REAL NOT NULL,
        total REAL NOT NULL,
        labor TEXT,
        notas TEXT,
        FOREIGN KEY (trabajador_id) REFERENCES trabajadores(id) ON DELETE CASCADE,
        FOREIGN KEY (variedad_id) REFERENCES variedades(id) ON DELETE SET NULL
    );
    """)

    # Sembrar datos iniciales si no existen
    cursor.execute("SELECT COUNT(*) FROM parcelas")
    if cursor.fetchone()[0] == 0:
        cursor.executemany("""
        INSERT INTO parcelas (nombre, hectareas, tipo_tenencia, propietario, notas)
        VALUES (?, ?, ?, ?, ?)
        """, [
            ("Lote Alquilado 1 (2 Ha)", 2.0, "Alquilado", "Propietario 1", "Arriendo agrícola de 2 hectáreas"),
            ("Lote Alquilado 2 (1 Ha)", 1.0, "Alquilado", "Propietario 2", "Arriendo agrícola de 1 hectárea")
        ])

    cursor.execute("SELECT COUNT(*) FROM variedades")
    if cursor.fetchone()[0] == 0:
        # Palta fuerte 1 (140, 2009), Palta fuerte 2 (260, 2023), Palta Hass (600, 2010), Plátano (300), Frutales Varios
        cursor.executemany("""
        INSERT INTO variedades (nombre, especie, num_arboles, anio_plantacion, hectareas, notas)
        VALUES (?, ?, ?, ?, ?, ?)
        """, [
            ("PALTA FUERTE 1", "Palta Fuerte", 0, 2009, 0.4, "Plantación año 2009 en producción alta"),
            ("PALTA FUERTE 2", "Palta Fuerte", 0, 2023, 0.6, "Plantación año 2023 en desarrollo"),
            ("PALTA HASS", "Palta Hass", 0, 2010, 2.0, "2 hectáreas de Palta Hass"),
            ("PLATANO", "Plátano", 0, None, 1.0, "1 hectárea con cultivo de plátano"),
            ("FRUTALES VARIOS", "Frutales Varios", 0, None, 0.2, "Cítricos y frutales diversos")
        ])

    cursor.execute("SELECT COUNT(*) FROM trabajadores")
    if cursor.fetchone()[0] == 0:
        cursor.executemany("""
        INSERT INTO trabajadores (nombre, rol, costo_hora_defecto)
        VALUES (?, ?, ?)
        """, [
            ("Mauro Robles", "Jornalero / Operador", 10.0),
            ("Kike", "Jornalero / Poda y Riego", 10.0),
            ("Trabajador de Apoyo", "Jornalero Temporal", 10.0)
        ])

    cursor.execute("SELECT COUNT(*) FROM productos")
    if cursor.fetchone()[0] == 0:
        productos_excel = [
            "ABONO FOLIAR", "ABONO ORGANICO", "ACEITE AGRICOLA (FGA)", "ACIDO FOLICO",
            "ADHERENTE SILICONADO", "AKRON", "ALGAS MARINAS", "SULFATO DE AMONIO",
            "AMINOACIDOS", "AZUFRE", "BIOL", "BORO", "CAL OMEX", "CALCIO BORO ZINC",
            "CARBENDAZINA", "CICLON", "CITOQUININA", "JABON POTASICO", "EMAMECTIN BENZOATO",
            "ACETAMIPRID", "ENRAIZADOR", "ERAIZER", "FOSFATO DIAMONICO", "FOSFORO",
            "MELAZA", "METOMIL", "MICROELEMENTOS", "NITRATO DE AMONIO", "OLIGOMIX",
            "PERMETRINA", "SULFATO DE COBRE", "SULFATO DE COBRE GRANULADO", "SULFATO DE POTASIO",
            "TIFON", "YESO AGRICOLA", "SANIX", "ZINC", "ABONO 20 20 20", "SILICIO",
            "PIRIMETANIL", "BACILLUS", "STIMULATE", "VIGOR PHOS", "REGULADOR PH", "TABACAZO"
        ]
        for prod in productos_excel:
            cursor.execute("""
            INSERT OR IGNORE INTO productos (nombre, categoria, unidad, stock_anterior, stock_actual, precio_referencial)
            VALUES (?, 'Insumo Fitosanitario / Fertilizante', 'Kg/L', 0, 0, 0)
            """, (prod,))

    cursor.execute("SELECT COUNT(*) FROM gastos_generales")
    if cursor.fetchone()[0] == 0:
        # Del Excel: 2026-03-18 MOVIMIENTO DE TIERRA A CABALLO 220
        cursor.execute("""
        INSERT INTO gastos_generales (fecha, concepto, total, empresa, categoria, notas)
        VALUES ('2026-03-18', 'MOVIMIENTO DE TIERRA A CABALLO', 220.0, 'Servicio Local', 'Preparación de Suelos', 'Registro inicial migrado del Excel')
        """)

    cursor.execute("SELECT COUNT(*) FROM campanas")
    if cursor.fetchone()[0] == 0:
        cursor.executemany("""
        INSERT INTO campanas (nombre, anio, activa, notas)
        VALUES (?, ?, ?, ?)
        """, [
            ("Campaña 2026", 2026, 1, "Campaña agrícola principal en curso"),
            ("Campaña 2025", 2025, 0, "Campaña agrícola anterior")
        ])

    conn.commit()
    conn.close()
    print("Base de datos inicializada exitosamente en:", DB_PATH)

if __name__ == "__main__":
    init_db()
