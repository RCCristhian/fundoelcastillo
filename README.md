# 🌾 Fundo El Castillo - Sistema de Gestión Agrícola y Control por Cultivo

Sistema web moderno, intuitivo y 100% responsivo para celular y computadora, diseñado a la medida de **Fundo El Castillo** para el control de costes, ingresos y jornales por cultivo, replicando con exactitud la plantilla contable de Excel.

---

## 👨‍🌾 Identidad del Fundo

* **Nombre:** Fundo El Castillo
* **Distintivo:** Campesino con sombrero tradicional de campo.
* **Superficie:** 3 Hectáreas arrendadas (2 Ha a Propietario 1, 1 Ha a Propietario 2).
* **Cultivos:** Palta Fuerte (Lotes 1 y 2), Palta Hass, Plátano y Frutales Varios.
* **Personal inicial:** Mauro Robles, Kike y personal de apoyo.

---

## 📱 Diseñado para usar en Celular en el Campo

* **Barra de navegación inferior móvil:** Acceso rápido con el pulgar a Inicio, Especies (P&L), Ventas y Menú completo.
* **Botón central "+ Anotar":** Modal rápido para registrar ventas, jornales de operarios, tratamientos químicos o gastos generales en menos de 10 segundos.
* **Modales responsivos:** Formularios con teclado numérico optimizado y cálculo automático en vivo.
* **Agregable a la pantalla de inicio:** Funciona como aplicación móvil nativa en iPhone y Android sin necesidad de descargar nada de la App Store.

---

## ☁️ Arquitectura Híbrida (Local + Nube)

1. **Modo Nube (Supabase + GitHub Pages):**
   - Se conecta directamente a tu base de datos PostgreSQL en **Supabase**.
   - No requiere servidor propio; se publica gratis en **GitHub Pages**.
   - Toda la información se sincroniza en tiempo real entre tu celular y tu computadora.
2. **Modo Local (SQLite):**
   - Funciona sin internet en tu Mac usando la base de datos `campo_agricola.db` y el servidor Python (`./iniciar.sh`).

---

## 🚀 Despliegue en Supabase y GitHub

Para conectar tu proyecto de Supabase y publicarlo en GitHub Pages, consulta la guía paso a paso:
👉 **[GUIA_GITHUB_Y_SUPABASE.md](./GUIA_GITHUB_Y_SUPABASE.md)**

---

## 💻 Ejecución Local en Mac

```bash
./iniciar.sh
```
Abre en tu navegador: **[http://localhost:8000](http://localhost:8000)**
