# 🥑 AgroCampo PRO - Sistema de Gestión Agrícola y Control de Costes por Especie

Sistema web moderno, intuitivo y local diseñado específicamente para el control integral de tu campo agrícola, adaptando fielmente la estructura y fórmulas de tu plantilla de Excel.

---

## 🌟 Características Principales

1. **📊 Panel General (Dashboard Dinámico)**
   - Métricas en tiempo real: Ingresos Totales, Gastos/Egresos, Resultado Neto, Kilos Cosechados y Horas de Mano de Obra.
   - Gráficos interactivos de rentabilidad por cultivo y desglose de costes operativos.
   - Resumen visual del arriendo de las **3 hectáreas** (2 Ha a Propietario 1 y 1 Ha a Propietario 2).

2. **📈 Cuenta de Resultados por Variedad / Especie (P&L Agrícola)**
   - Tabla idéntica a la del Excel que calcula para cada cultivo (**Palta Hass, Palta Fuerte 1, Palta Fuerte 2, Plátano, Frutales Varios**):
     - Ingresos por ventas de cosecha.
     - Gastos en insumos y tratamientos químicos aplicados.
     - Gastos específicos imputados al cultivo.
     - Gastos generales prorrateados por superficie (Ha).
     - Gasto en mano de obra / jornales.
     - **Resultado Neto por cultivo y Rentabilidad por Árbol**.
     - Rendimiento de producción en Kg/Árbol y Kg/Hectárea.

3. **🥑 Ventas y Cosecha**
   - Registro rápido de corte/cosecha: Fecha, Variedad, Kilos, Precio por Kilo, Total calculado automáticamente, Comprador, Comprobante y estado (Cobrado / Por cobrar).

4. **🚜 Gastos Específicos y Generales**
   - **Gastos Específicos:** Podas especializadas, fletes o labores exclusivas de un cultivo.
   - **Gastos Generales:** Mantenimiento de acequias, alquiler de las 3 hectáreas a los propietarios, preparación de suelos (incluye el registro histórico del Excel: *"Movimiento de tierra a caballo - 220"*).

5. **👨‍🌾 Jornales & Mano de Obra (Matriz Mensual como en el Excel)**
   - Registro diario de horas por trabajador (**Mauro Robles, Kike**, etc.) asignando la labor y el cultivo trabajado.
   - **Pestaña Matriz Anual:** Cuadro de Enero a Diciembre con las horas y costes mensuales de cada trabajador y totales del campo.

6. **🧪 Tratamientos Fitosanitarios & Almacén de Insumos**
   - Al registrar una aplicación en campo, el sistema descuenta automáticamente las existencias del almacén y suma el costo a la variedad tratada.
   - Catálogo precargado con los 45 productos fitosanitarios y fertilizantes de tu Excel.
   - Registro de compras de insumos para reabastecer stock.

7. **🗺️ Gestión de Parcelas y Cultivos**
   - Configura las 3 hectáreas arrendadas, propietarios, número de árboles por lote y años de plantación (2009, 2010, 2023).

8. **💾 Copias de Seguridad y Exportación a Excel/CSV**
   - Exporta cualquier tabla a Excel (formato CSV compatible) con 1 clic.
   - Descarga un archivo de respaldo JSON completo de tu base de datos o restáuralo cuando quieras.

---

## 🚀 Cómo Iniciar la Web en tu Mac

### Opción 1: Ejecutar el script automático (Recomendado)
Abre la terminal en esta carpeta y ejecuta:
```bash
./iniciar.sh
```
*Esto iniciará el servidor local y abrirá automáticamente tu navegador en `http://localhost:8000`.*

### Opción 2: Comando directo de terminal
```bash
python3 server.py 8000
```
Luego abre tu navegador favorito (Chrome, Safari, etc.) e ingresa a:
👉 **[http://localhost:8000](http://localhost:8000)**

---

## 🗄️ Base de Datos y Estructura Técnica

- **Base de datos local:** SQLite (`campo_agricola.db`).
  - No requiere instalar servidores complejos ni dependencias externas.
  - Guarda todas las tablas de forma relacional y persistente.
- **Preparado para la nube:** La estructura de tablas está normalizada en SQL estándar, lo que permitirá migrarla fácilmente a PostgreSQL, Supabase, MySQL o Firebase cuando decidas alojarla en la web para consultarla desde cualquier lugar.
