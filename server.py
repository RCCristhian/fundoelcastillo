#!/usr/bin/env python3
"""
Servidor Web y API REST para Gestión de Campo Agrícola.
Sin dependencias externas - Funciona en cualquier macOS / Linux con Python 3.
"""

import http.server
import socketserver
import json
import urllib.parse
import os
import sys
import mimetypes
from database import get_connection, init_db

PORT = 8000
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), "public")

class FieldManagerHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def _send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def _read_json_body(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length > 0:
                body = self.rfile.read(content_length).decode("utf-8")
                return json.loads(body)
        except Exception as e:
            print("Error leyendo JSON:", e)
        return {}

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/"):
            self._handle_api_get(path, urllib.parse.parse_qs(parsed.query))
        else:
            # Archivo estático
            if path == "/" or path == "":
                self.path = "/index.html"
            return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self._read_json_body()

        if path.startswith("/api/"):
            self._handle_api_post(path, body)
        else:
            self.send_error(404, "Endpoint no encontrado")

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self._read_json_body()

        if path.startswith("/api/"):
            self._handle_api_put(path, body)
        else:
            self.send_error(404, "Endpoint no encontrado")

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/"):
            self._handle_api_delete(path)
        else:
            self.send_error(404, "Endpoint no encontrado")

    # ================= API GET =================
    def _handle_api_get(self, path, params):
        conn = get_connection()
        cursor = conn.cursor()

        try:
            # 1. Dashboard & Resumen por Variedad
            if path == "/api/dashboard":
                dashboard = self._calculate_dashboard(conn)
                self._send_json(dashboard)

            # 2. Variedades
            elif path == "/api/variedades":
                cursor.execute("""
                SELECT v.*, p.nombre as parcela_nombre, p.propietario as parcela_propietario
                FROM variedades v
                LEFT JOIN parcelas p ON v.parcela_id = p.id
                ORDER BY v.nombre ASC
                """)
                rows = [dict(r) for r in cursor.fetchall()]
                self._send_json({"success": True, "data": rows})

            # 3. Parcelas
            elif path == "/api/parcelas":
                cursor.execute("SELECT * FROM parcelas ORDER BY id ASC")
                rows = [dict(r) for r in cursor.fetchall()]
                self._send_json({"success": True, "data": rows})

            # 4. Productos / Inventario
            elif path == "/api/productos":
                cursor.execute("""
                SELECT p.*,
                       COALESCE((SELECT SUM(cantidad) FROM compras_productos WHERE producto_id = p.id), 0) as total_comprado,
                       COALESCE((SELECT SUM(cantidad) FROM tratamientos WHERE producto_id = p.id), 0) as total_aplicado
                FROM productos p
                ORDER BY p.nombre ASC
                """)
                rows = [dict(r) for r in cursor.fetchall()]
                # Calcular valor de stock
                for r in rows:
                    r["valor_stock"] = round(r["stock_actual"] * r["precio_referencial"], 2)
                self._send_json({"success": True, "data": rows})

            # 5. Compras de Insumos
            elif path == "/api/compras":
                cursor.execute("""
                SELECT c.*, p.nombre as producto_nombre, p.unidad as producto_unidad
                FROM compras_productos c
                JOIN productos p ON c.producto_id = p.id
                ORDER BY c.fecha DESC, c.id DESC
                """)
                rows = [dict(r) for r in cursor.fetchall()]
                self._send_json({"success": True, "data": rows})

            # 6. Tratamientos / Aplicaciones
            elif path == "/api/tratamientos":
                cursor.execute("""
                SELECT t.*, v.nombre as variedad_nombre, p.nombre as producto_nombre, p.unidad as producto_unidad
                FROM tratamientos t
                JOIN variedades v ON t.variedad_id = v.id
                JOIN productos p ON t.producto_id = p.id
                ORDER BY t.fecha DESC, t.id DESC
                """)
                rows = [dict(r) for r in cursor.fetchall()]
                self._send_json({"success": True, "data": rows})

            # 7. Ventas (Cosechas)
            elif path == "/api/ventas":
                cursor.execute("""
                SELECT vt.*, v.nombre as variedad_nombre
                FROM ventas vt
                JOIN variedades v ON vt.variedad_id = v.id
                ORDER BY vt.fecha DESC, vt.id DESC
                """)
                rows = [dict(r) for r in cursor.fetchall()]
                self._send_json({"success": True, "data": rows})

            # 8. Ingresos Financieros
            elif path == "/api/ingresos-financieros":
                cursor.execute("SELECT * FROM ingresos_financieros ORDER BY fecha DESC, id DESC")
                rows = [dict(r) for r in cursor.fetchall()]
                self._send_json({"success": True, "data": rows})

            # 9. Gastos Específicos
            elif path == "/api/gastos-especificos":
                cursor.execute("""
                SELECT ge.*, COALESCE(v.nombre, 'Sin Variedad') as variedad_nombre
                FROM gastos_especificos ge
                LEFT JOIN variedades v ON ge.variedad_id = v.id
                ORDER BY ge.fecha DESC, ge.id DESC
                """)
                rows = [dict(r) for r in cursor.fetchall()]
                self._send_json({"success": True, "data": rows})

            # 10. Gastos Generales
            elif path == "/api/gastos-generales":
                cursor.execute("SELECT * FROM gastos_generales ORDER BY fecha DESC, id DESC")
                rows = [dict(r) for r in cursor.fetchall()]
                self._send_json({"success": True, "data": rows})

            # 11. Trabajadores
            elif path == "/api/trabajadores":
                cursor.execute("SELECT * FROM trabajadores WHERE activo = 1 ORDER BY nombre ASC")
                rows = [dict(r) for r in cursor.fetchall()]
                self._send_json({"success": True, "data": rows})

            # 12. Jornales
            elif path == "/api/jornales":
                cursor.execute("""
                SELECT j.*, t.nombre as trabajador_nombre, COALESCE(v.nombre, 'General / Campo') as variedad_nombre
                FROM jornales j
                JOIN trabajadores t ON j.trabajador_id = t.id
                LEFT JOIN variedades v ON j.variedad_id = v.id
                ORDER BY j.fecha DESC, j.id DESC
                """)
                rows = [dict(r) for r in cursor.fetchall()]
                self._send_json({"success": True, "data": rows})

            # 13. Resumen Mensual Jornales (matriz como el Excel)
            elif path == "/api/jornales/resumen-mensual":
                resumen = self._calculate_jornales_mensual(conn)
                self._send_json({"success": True, "data": resumen})

            # 14. Backup general
            elif path == "/api/backup":
                backup_data = self._get_full_backup(conn)
                self._send_json({"success": True, "data": backup_data})

            # 15. Campañas Agrícolas
            elif path == "/api/campanas":
                cursor.execute("SELECT * FROM campanas ORDER BY anio DESC")
                rows = [dict(r) for r in cursor.fetchall()]
                self._send_json({"success": True, "data": rows})

            else:
                self.send_error(404, "Endpoint GET no reconocido")
        except Exception as e:
            print("Error en API GET:", e)
            self._send_json({"success": False, "error": str(e)}, status=500)
        finally:
            conn.close()

    # ================= API POST =================
    def _handle_api_post(self, path, body):
        conn = get_connection()
        cursor = conn.cursor()

        try:
            # 1. Nueva Variedad
            if path == "/api/variedades":
                cursor.execute("""
                INSERT INTO variedades (nombre, especie, num_arboles, anio_plantacion, hectareas, parcela_id, notas)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    body.get("nombre", "").strip(),
                    body.get("especie", "").strip() or body.get("nombre", "").strip(),
                    int(body.get("num_arboles", 0) or 0),
                    int(body.get("anio_plantacion") or 0) if body.get("anio_plantacion") else None,
                    float(body.get("hectareas", 0) or 0),
                    int(body["parcela_id"]) if body.get("parcela_id") else None,
                    body.get("notas", "")
                ))
                conn.commit()
                self._send_json({"success": True, "id": cursor.lastrowid})

            # 2. Nueva Parcela / Arriendo
            elif path == "/api/parcelas":
                cursor.execute("""
                INSERT INTO parcelas (nombre, hectareas, tipo_tenencia, propietario, costo_alquiler_mensual, notas)
                VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    body.get("nombre", "").strip(),
                    float(body.get("hectareas", 0) or 0),
                    body.get("tipo_tenencia", "Alquilado"),
                    body.get("propietario", ""),
                    float(body.get("costo_alquiler_mensual", 0) or 0),
                    body.get("notas", "")
                ))
                conn.commit()
                self._send_json({"success": True, "id": cursor.lastrowid})

            # 3. Nuevo Insumo
            elif path == "/api/productos":
                cursor.execute("""
                INSERT INTO productos (nombre, categoria, unidad, stock_anterior, stock_actual, precio_referencial, notas)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    body.get("nombre", "").strip().upper(),
                    body.get("categoria", "Fertilizante / Fitosanitario"),
                    body.get("unidad", "Kg/L"),
                    float(body.get("stock_anterior", 0) or 0),
                    float(body.get("stock_actual", 0) or body.get("stock_anterior", 0) or 0),
                    float(body.get("precio_referencial", 0) or 0),
                    body.get("notas", "")
                ))
                conn.commit()
                self._send_json({"success": True, "id": cursor.lastrowid})

            # 4. Nueva Compra de Insumo (suma a stock_actual)
            elif path == "/api/compras":
                producto_id = int(body["producto_id"])
                cantidad = float(body.get("cantidad", 0))
                precio_unitario = float(body.get("precio_unitario", 0))
                total = float(body.get("total", cantidad * precio_unitario))

                cursor.execute("""
                INSERT INTO compras_productos (fecha, producto_id, cantidad, precio_unitario, total, proveedor, nro_factura, nro_albaran, pagado, notas)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    body.get("fecha"),
                    producto_id,
                    cantidad,
                    precio_unitario,
                    total,
                    body.get("proveedor", ""),
                    body.get("nro_factura", ""),
                    body.get("nro_albaran", ""),
                    1 if body.get("pagado", True) else 0,
                    body.get("notas", "")
                ))
                # Actualizar stock y precio referencial del producto
                cursor.execute("""
                UPDATE productos
                SET stock_actual = stock_actual + ?,
                    precio_referencial = CASE WHEN ? > 0 THEN ? ELSE precio_referencial END
                WHERE id = ?
                """, (cantidad, precio_unitario, precio_unitario, producto_id))
                conn.commit()
                self._send_json({"success": True, "id": cursor.lastrowid})

            # 5. Nuevo Tratamiento (descuenta de stock_actual)
            elif path == "/api/tratamientos":
                variedad_id = int(body["variedad_id"])
                producto_id = int(body["producto_id"])
                cantidad = float(body.get("cantidad", 0))
                precio_unitario = float(body.get("precio_unitario", 0))
                total = float(body.get("total", cantidad * precio_unitario))

                cursor.execute("""
                INSERT INTO tratamientos (fecha, variedad_id, producto_id, cantidad, precio_unitario, total, notas)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    body.get("fecha"),
                    variedad_id,
                    producto_id,
                    cantidad,
                    precio_unitario,
                    total,
                    body.get("notas", "")
                ))
                # Descontar del stock
                cursor.execute("""
                UPDATE productos
                SET stock_actual = stock_actual - ?
                WHERE id = ?
                """, (cantidad, producto_id))
                conn.commit()
                self._send_json({"success": True, "id": cursor.lastrowid})

            # 6. Nueva Venta (Cosecha)
            elif path == "/api/ventas":
                variedad_id = int(body["variedad_id"])
                kilos = float(body.get("kilos", 0))
                precio_kilo = float(body.get("precio_kilo", 0))
                total = float(body.get("total", kilos * precio_kilo))

                cursor.execute("""
                INSERT INTO ventas (fecha, variedad_id, kilos, precio_kilo, total, comprador, nro_boleta, nro_factura, cobrado, notas)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    body.get("fecha"),
                    variedad_id,
                    kilos,
                    precio_kilo,
                    total,
                    body.get("comprador", ""),
                    body.get("nro_boleta", ""),
                    body.get("nro_factura", ""),
                    1 if body.get("cobrado", True) else 0,
                    body.get("notas", "")
                ))
                conn.commit()
                self._send_json({"success": True, "id": cursor.lastrowid})

            # 7. Ingreso Financiero
            elif path == "/api/ingresos-financieros":
                cursor.execute("""
                INSERT INTO ingresos_financieros (fecha, concepto, total, pagador, nro_factura, notas)
                VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    body.get("fecha"),
                    body.get("concepto", "").strip(),
                    float(body.get("total", 0)),
                    body.get("pagador", ""),
                    body.get("nro_factura", ""),
                    body.get("notas", "")
                ))
                conn.commit()
                self._send_json({"success": True, "id": cursor.lastrowid})

            # 8. Gasto Específico (por variedad)
            elif path == "/api/gastos-especificos":
                variedad_id = int(body["variedad_id"]) if body.get("variedad_id") else None
                cursor.execute("""
                INSERT INTO gastos_especificos (fecha, concepto, total, empresa, nro_factura, variedad_id, notas)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    body.get("fecha"),
                    body.get("concepto", "").strip(),
                    float(body.get("total", 0)),
                    body.get("empresa", ""),
                    body.get("nro_factura", ""),
                    variedad_id,
                    body.get("notas", "")
                ))
                conn.commit()
                self._send_json({"success": True, "id": cursor.lastrowid})

            # 9. Gasto General
            elif path == "/api/gastos-generales":
                cursor.execute("""
                INSERT INTO gastos_generales (fecha, concepto, total, empresa, nro_factura, categoria, notas)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    body.get("fecha"),
                    body.get("concepto", "").strip(),
                    float(body.get("total", 0)),
                    body.get("empresa", ""),
                    body.get("nro_factura", ""),
                    body.get("categoria", "Mantenimiento / Operación"),
                    body.get("notas", "")
                ))
                conn.commit()
                self._send_json({"success": True, "id": cursor.lastrowid})

            # 10. Trabajador
            elif path == "/api/trabajadores":
                cursor.execute("""
                INSERT INTO trabajadores (nombre, telefono, rol, costo_hora_defecto)
                VALUES (?, ?, ?, ?)
                """, (
                    body.get("nombre", "").strip(),
                    body.get("telefono", ""),
                    body.get("rol", "Jornalero"),
                    float(body.get("costo_hora_defecto", 10.0) or 10.0)
                ))
                conn.commit()
                self._send_json({"success": True, "id": cursor.lastrowid})

            # 11. Jornal
            elif path == "/api/jornales":
                horas = float(body.get("horas", 0))
                precio_hora = float(body.get("precio_hora", 0))
                total = float(body.get("total", horas * precio_hora))
                variedad_id = int(body["variedad_id"]) if body.get("variedad_id") else None

                cursor.execute("""
                INSERT INTO jornales (fecha, trabajador_id, variedad_id, horas, precio_hora, total, labor, notas)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    body.get("fecha"),
                    int(body["trabajador_id"]),
                    variedad_id,
                    horas,
                    precio_hora,
                    total,
                    body.get("labor", ""),
                    body.get("notas", "")
                ))
                conn.commit()
                self._send_json({"success": True, "id": cursor.lastrowid})

            # 12. Restaurar Backup
            elif path == "/api/restore":
                self._restore_full_backup(conn, body)
                self._send_json({"success": True, "message": "Datos restaurados con éxito"})

            # 13. Crear Campaña Agrícola
            elif path == "/api/campanas":
                cursor.execute("""
                INSERT INTO campanas (nombre, anio, activa, notas)
                VALUES (?, ?, ?, ?)
                """, (
                    body.get("nombre"),
                    int(body.get("anio", 2026)),
                    1 if body.get("activa", False) else 0,
                    body.get("notas", "")
                ))
                conn.commit()
                self._send_json({"success": True, "id": cursor.lastrowid})

            else:
                self.send_error(404, "Endpoint POST no reconocido")
        except Exception as e:
            print("Error en API POST:", e)
            self._send_json({"success": False, "error": str(e)}, status=500)
        finally:
            conn.close()

    # ================= API PUT =================
    def _handle_api_put(self, path, body):
        conn = get_connection()
        cursor = conn.cursor()

        try:
            parts = path.strip("/").split("/")
            # Formato: api/<recurso>/<id>
            if len(parts) == 3 and parts[0] == "api":
                resource = parts[1]
                rec_id = int(parts[2])

                if resource == "variedades":
                    cursor.execute("""
                    UPDATE variedades
                    SET nombre = ?, especie = ?, num_arboles = ?, anio_plantacion = ?, hectareas = ?, parcela_id = ?, notas = ?
                    WHERE id = ?
                    """, (
                        body.get("nombre", "").strip(),
                        body.get("especie", "").strip(),
                        int(body.get("num_arboles", 0) or 0),
                        int(body.get("anio_plantacion") or 0) if body.get("anio_plantacion") else None,
                        float(body.get("hectareas", 0) or 0),
                        int(body["parcela_id"]) if body.get("parcela_id") else None,
                        body.get("notas", ""),
                        rec_id
                    ))
                    conn.commit()
                    self._send_json({"success": True})

                elif resource == "parcelas":
                    cursor.execute("""
                    UPDATE parcelas
                    SET nombre = ?, hectareas = ?, tipo_tenencia = ?, propietario = ?, costo_alquiler_mensual = ?, notas = ?
                    WHERE id = ?
                    """, (
                        body.get("nombre", "").strip(),
                        float(body.get("hectareas", 0) or 0),
                        body.get("tipo_tenencia", "Alquilado"),
                        body.get("propietario", ""),
                        float(body.get("costo_alquiler_mensual", 0) or 0),
                        body.get("notas", ""),
                        rec_id
                    ))
                    conn.commit()
                    self._send_json({"success": True})

                elif resource == "productos":
                    cursor.execute("""
                    UPDATE productos
                    SET nombre = ?, categoria = ?, unidad = ?, stock_actual = ?, precio_referencial = ?, notas = ?
                    WHERE id = ?
                    """, (
                        body.get("nombre", "").strip().upper(),
                        body.get("categoria", "Fertilizante / Fitosanitario"),
                        body.get("unidad", "Kg/L"),
                        float(body.get("stock_actual", 0) or 0),
                        float(body.get("precio_referencial", 0) or 0),
                        body.get("notas", ""),
                        rec_id
                    ))
                    conn.commit()
                    self._send_json({"success": True})

                elif resource == "trabajadores":
                    cursor.execute("""
                    UPDATE trabajadores
                    SET nombre = ?, telefono = ?, rol = ?, costo_hora_defecto = ?, activo = ?
                    WHERE id = ?
                    """, (
                        body.get("nombre", "").strip(),
                        body.get("telefono", ""),
                        body.get("rol", "Jornalero"),
                        float(body.get("costo_hora_defecto", 10.0) or 10.0),
                        1 if body.get("activo", True) else 0,
                        rec_id
                    ))
                    conn.commit()
                    self._send_json({"success": True})

                elif resource == "ventas":
                    kilos = float(body.get("kilos", 0))
                    precio_kilo = float(body.get("precio_kilo", 0))
                    total = float(body.get("total", kilos * precio_kilo))
                    cursor.execute("""
                    UPDATE ventas
                    SET fecha = ?, variedad_id = ?, kilos = ?, precio_kilo = ?, total = ?, comprador = ?,
                        nro_boleta = ?, nro_factura = ?, cobrado = ?, notas = ?
                    WHERE id = ?
                    """, (
                        body.get("fecha"),
                        int(body["variedad_id"]),
                        kilos,
                        precio_kilo,
                        total,
                        body.get("comprador", ""),
                        body.get("nro_boleta", ""),
                        body.get("nro_factura", ""),
                        1 if body.get("cobrado", True) else 0,
                        body.get("notas", ""),
                        rec_id
                    ))
                    conn.commit()
                    self._send_json({"success": True})
                else:
                    self.send_error(400, "Recurso no editable vía PUT")
            else:
                self.send_error(404, "Endpoint PUT inválido")
        except Exception as e:
            print("Error en API PUT:", e)
            self._send_json({"success": False, "error": str(e)}, status=500)
        finally:
            conn.close()

    # ================= API DELETE =================
    def _handle_api_delete(self, path):
        conn = get_connection()
        cursor = conn.cursor()

        try:
            parts = path.strip("/").split("/")
            if len(parts) == 3 and parts[0] == "api":
                resource = parts[1]
                rec_id = int(parts[2])

                # Mapear recurso a tabla
                table_map = {
                    "variedades": "variedades",
                    "parcelas": "parcelas",
                    "productos": "productos",
                    "compras": "compras_productos",
                    "tratamientos": "tratamientos",
                    "ventas": "ventas",
                    "ingresos-financieros": "ingresos_financieros",
                    "gastos-especificos": "gastos_especificos",
                    "gastos-generales": "gastos_generales",
                    "trabajadores": "trabajadores",
                    "jornales": "jornales"
                }

                table = table_map.get(resource)
                if table:
                    # En tratamientos y compras, revertir stock si aplica
                    if table == "tratamientos":
                        cursor.execute("SELECT producto_id, cantidad FROM tratamientos WHERE id = ?", (rec_id,))
                        r = cursor.fetchone()
                        if r:
                            cursor.execute("UPDATE productos SET stock_actual = stock_actual + ? WHERE id = ?", (r["cantidad"], r["producto_id"]))
                    elif table == "compras_productos":
                        cursor.execute("SELECT producto_id, cantidad FROM compras_productos WHERE id = ?", (rec_id,))
                        r = cursor.fetchone()
                        if r:
                            cursor.execute("UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ?", (r["cantidad"], r["producto_id"]))

                    cursor.execute(f"DELETE FROM {table} WHERE id = ?", (rec_id,))
                    conn.commit()
                    self._send_json({"success": True})
                else:
                    self.send_error(400, "Recurso desconocido para eliminación")
            else:
                self.send_error(404, "Ruta DELETE inválida")
        except Exception as e:
            print("Error en API DELETE:", e)
            self._send_json({"success": False, "error": str(e)}, status=500)
        finally:
            conn.close()

    # ================= CÁLCULO DE DASHBOARD & P&L =================
    def _calculate_dashboard(self, conn):
        cursor = conn.cursor()

        # 1. Totales Generales
        cursor.execute("SELECT COALESCE(SUM(total), 0) as total_ventas, COALESCE(SUM(kilos), 0) as total_kilos FROM ventas")
        ventas_row = cursor.fetchone()
        total_ventas = float(ventas_row["total_ventas"])
        total_kilos = float(ventas_row["total_kilos"])

        cursor.execute("SELECT COALESCE(SUM(total), 0) as total_financieros FROM ingresos_financieros")
        total_financieros = float(cursor.fetchone()["total_financieros"])

        total_ingresos = total_ventas + total_financieros

        # Gastos
        cursor.execute("SELECT COALESCE(SUM(total), 0) as total_compras FROM compras_productos")
        total_compras = float(cursor.fetchone()["total_compras"])

        cursor.execute("SELECT COALESCE(SUM(total), 0) as total_tratamientos FROM tratamientos")
        total_tratamientos = float(cursor.fetchone()["total_tratamientos"])

        cursor.execute("SELECT COALESCE(SUM(total), 0) as total_especificos FROM gastos_especificos")
        total_especificos = float(cursor.fetchone()["total_especificos"])

        cursor.execute("SELECT COALESCE(SUM(total), 0) as total_generales FROM gastos_generales")
        total_generales = float(cursor.fetchone()["total_generales"])

        cursor.execute("SELECT COALESCE(SUM(total), 0) as total_jornales, COALESCE(SUM(horas), 0) as total_horas FROM jornales")
        jornales_row = cursor.fetchone()
        total_jornales = float(jornales_row["total_jornales"])
        total_horas_jornal = float(jornales_row["total_horas"])

        # Valorización de Stock
        cursor.execute("SELECT COALESCE(SUM(stock_actual * precio_referencial), 0) as valor_stock FROM productos")
        valor_stock_actual = float(cursor.fetchone()["valor_stock"])

        # Total Gastos Operativos (siguiendo modelo del Excel: Insumos aplicados o compras + específicos + generales + jornales)
        total_gastos = total_tratamientos + total_especificos + total_generales + total_jornales
        resultado_general = total_ingresos - total_gastos

        # 2. Resumen Detallado por Variedad / Especie (P&L Agrícola)
        cursor.execute("SELECT * FROM variedades ORDER BY nombre ASC")
        variedades = [dict(v) for v in cursor.fetchall()]

        total_hectareas_campo = sum(v["hectareas"] for v in variedades) or 1.0

        resumen_variedades = []
        for v in variedades:
            vid = v["id"]
            arboles = v["num_arboles"] or 0
            ha = v["hectareas"] or 0

            # Ventas de esta variedad
            cursor.execute("SELECT COALESCE(SUM(total), 0) as ingresos, COALESCE(SUM(kilos), 0) as kilos FROM ventas WHERE variedad_id = ?", (vid,))
            v_ventas = cursor.fetchone()
            ingresos_v = float(v_ventas["ingresos"])
            kilos_v = float(v_ventas["kilos"])
            precio_prom_kg = round(ingresos_v / kilos_v, 2) if kilos_v > 0 else 0.0

            # Gastos químicos / tratamientos aplicados a esta variedad
            cursor.execute("SELECT COALESCE(SUM(total), 0) as costo_quimicos FROM tratamientos WHERE variedad_id = ?", (vid,))
            gasto_quimicos = float(cursor.fetchone()["costo_quimicos"])

            # Gastos específicos directos
            cursor.execute("SELECT COALESCE(SUM(total), 0) as costo_especificos FROM gastos_especificos WHERE variedad_id = ?", (vid,))
            gasto_especifico = float(cursor.fetchone()["costo_especificos"])

            # Gastos de jornales aplicados a esta variedad
            cursor.execute("SELECT COALESCE(SUM(total), 0) as costo_jornales, COALESCE(SUM(horas), 0) as horas FROM jornales WHERE variedad_id = ?", (vid,))
            j_row = cursor.fetchone()
            gasto_jornal = float(j_row["costo_jornales"])
            horas_v = float(j_row["horas"])

            # Gastos generales prorrateados por hectárea
            prorrateo_generales = round((ha / total_hectareas_campo) * total_generales, 2) if total_hectareas_campo > 0 else 0.0

            total_gastos_v = gasto_quimicos + gasto_especifico + gasto_jornal + prorrateo_generales
            resultado_v = ingresos_v - total_gastos_v

            # Indicadores de rendimiento técnico y económico
            resultado_por_arbol = round(resultado_v / arboles, 2) if arboles > 0 else None
            kilos_por_arbol = round(kilos_v / arboles, 2) if arboles > 0 else None
            kilos_por_ha = round(kilos_v / ha, 2) if ha > 0 else None
            costo_por_kilo = round(total_gastos_v / kilos_v, 2) if kilos_v > 0 else None
            margen_pct = round((resultado_v / ingresos_v) * 100, 1) if ingresos_v > 0 else 0.0

            resumen_variedades.append({
                "id": vid,
                "nombre": v["nombre"],
                "especie": v["especie"],
                "num_arboles": arboles,
                "hectareas": ha,
                "anio_plantacion": v["anio_plantacion"],
                "ingresos_ventas": ingresos_v,
                "kilos_vendidos": kilos_v,
                "precio_promedio_kg": precio_prom_kg,
                "gasto_quimicos": gasto_quimicos,
                "gasto_especificos": gasto_especifico,
                "gasto_jornales": gasto_jornal,
                "horas_jornal": horas_v,
                "gasto_generales_prorrateado": prorrateo_generales,
                "total_gastos": round(total_gastos_v, 2),
                "resultado_neto": round(resultado_v, 2),
                "resultado_por_arbol": resultado_por_arbol,
                "kilos_por_arbol": kilos_por_arbol,
                "kilos_por_hectarea": kilos_por_ha,
                "costo_por_kilo": costo_por_kilo,
                "margen_porcentaje": margen_pct
            })

        # 3. Evolución mensual de Ventas y Gastos
        cursor.execute("""
        SELECT strftime('%Y-%m', fecha) as mes, SUM(total) as total
        FROM ventas
        GROUP BY mes
        ORDER BY mes ASC
        """)
        ventas_mensuales = {r["mes"]: r["total"] for r in cursor.fetchall()}

        return {
            "success": True,
            "totales": {
                "total_ingresos": round(total_ingresos, 2),
                "total_ventas": round(total_ventas, 2),
                "total_financieros": round(total_financieros, 2),
                "total_kilos_cosechados": round(total_kilos, 2),
                "total_gastos": round(total_gastos, 2),
                "total_quimicos_aplicados": round(total_tratamientos, 2),
                "total_compras_insumos": round(total_compras, 2),
                "total_gastos_especificos": round(total_especificos, 2),
                "total_gastos_generales": round(total_generales, 2),
                "total_jornales": round(total_jornales, 2),
                "total_horas_jornal": round(total_horas_jornal, 1),
                "valor_stock_actual": round(valor_stock_actual, 2),
                "resultado_general": round(resultado_general, 2),
                "total_hectareas": total_hectareas_campo,
                "total_arboles": sum(v["num_arboles"] or 0 for v in variedades)
            },
            "resumen_por_variedad": resumen_variedades,
            "distribucion_gastos": {
                "Insumos Fitosanitarios": round(total_tratamientos, 2),
                "Jornales / Mano de Obra": round(total_jornales, 2),
                "Gastos Específicos": round(total_especificos, 2),
                "Gastos Generales": round(total_generales, 2)
            }
        }

    # ================= RESUMEN MENSUAL DE JORNALES =================
    def _calculate_jornales_mensual(self, conn):
        cursor = conn.cursor()
        cursor.execute("SELECT id, nombre, rol, costo_hora_defecto FROM trabajadores WHERE activo = 1 ORDER BY nombre ASC")
        trabajadores = [dict(t) for t in cursor.fetchall()]

        meses_nombres = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                         "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

        resultado_trabajadores = []
        totales_mes_horas = [0.0] * 12
        totales_mes_costo = [0.0] * 12

        for t in trabajadores:
            tid = t["id"]
            # Buscar jornadas de este trabajador agrupadas por mes (01..12)
            cursor.execute("""
            SELECT cast(strftime('%m', fecha) as integer) as mes_num,
                   SUM(horas) as horas,
                   SUM(total) as costo
            FROM jornales
            WHERE trabajador_id = ?
            GROUP BY mes_num
            """, (tid,))
            registros = {r["mes_num"]: (r["horas"], r["costo"]) for r in cursor.fetchall()}

            meses_detalle = []
            total_horas_t = 0.0
            total_costo_t = 0.0

            for m in range(1, 13):
                h, c = registros.get(m, (0.0, 0.0))
                meses_detalle.append({
                    "mes_num": m,
                    "mes_nombre": meses_nombres[m - 1],
                    "horas": round(h, 1),
                    "costo": round(c, 2)
                })
                total_horas_t += h
                total_costo_t += c
                totales_mes_horas[m - 1] += h
                totales_mes_costo[m - 1] += c

            resultado_trabajadores.append({
                "trabajador_id": tid,
                "nombre": t["nombre"],
                "rol": t["rol"],
                "meses": meses_detalle,
                "total_horas": round(total_horas_t, 1),
                "total_costo": round(total_costo_t, 2)
            })

        totales_generales = []
        for m in range(1, 13):
            totales_generales.append({
                "mes_num": m,
                "mes_nombre": meses_nombres[m - 1],
                "horas": round(totales_mes_horas[m - 1], 1),
                "costo": round(totales_mes_costo[m - 1], 2)
            })

        return {
            "trabajadores": resultado_trabajadores,
            "totales_mensuales": totales_generales,
            "gran_total_horas": round(sum(totales_mes_horas), 1),
            "gran_total_costo": round(sum(totales_mes_costo), 2)
        }

    # ================= BACKUP Y RESTORE =================
    def _get_full_backup(self, conn):
        cursor = conn.cursor()
        backup = {}
        tablas = ["parcelas", "variedades", "productos", "compras_productos",
                  "tratamientos", "ventas", "ingresos_financieros", "gastos_especificos",
                  "gastos_generales", "trabajadores", "jornales"]
        for t in tablas:
            cursor.execute(f"SELECT * FROM {t}")
            backup[t] = [dict(r) for r in cursor.fetchall()]
        return backup

    def _restore_full_backup(self, conn, backup_data):
        cursor = conn.cursor()
        tablas = ["jornales", "tratamientos", "compras_productos", "ventas",
                  "gastos_especificos", "gastos_generales", "ingresos_financieros",
                  "variedades", "parcelas", "productos", "trabajadores"]
        for t in tablas:
            cursor.execute(f"DELETE FROM {t}")

        # Insertar datos restaurados
        for t, filas in backup_data.items():
            if not filas:
                continue
            cols = list(filas[0].keys())
            placeholders = ", ".join(["?"] * len(cols))
            col_names = ", ".join(cols)
            for f in filas:
                cursor.execute(f"INSERT OR REPLACE INTO {t} ({col_names}) VALUES ({placeholders})", [f[c] for c in cols])
        conn.commit()

def run_server(port=PORT):
    init_db()
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    server_address = ("", port)
    
    # Permitir reuso inmediato del puerto para evitar Address already in use
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(server_address, FieldManagerHandler) as httpd:
        print(f"\n🌱 =========================================================")
        print(f"🌾 SISTEMA DE GESTIÓN DE CAMPO AGRÍCOLA INICIADO CON ÉXITO")
        print(f"👉 Abre tu navegador en: http://localhost:{port}")
        print(f"=========================================================\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nDeteniendo servidor...")
            httpd.server_close()

if __name__ == "__main__":
    p = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    run_server(p)
