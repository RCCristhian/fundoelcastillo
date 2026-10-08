# 🚀 Guía de Despliegue: Supabase y GitHub Pages para Fundo El Castillo

Esta guía te explica paso a paso cómo conectar tu base de datos en la nube con **Supabase** y publicar la web de forma 100% gratuita en **GitHub Pages** para que puedas registrar cosechas, jornales y gastos desde cualquier celular en el campo.

---

## 🟢 PASO 1: Configurar la Base de Datos en Supabase

Dado que ya tienes tu proyecto creado en Supabase:

1. **Abre tu proyecto en [Supabase](https://supabase.com/dashboard)**.
2. En el menú lateral izquierdo, haz clic en el icono **SQL Editor** (o *"New query"*).
3. Abre el archivo [`supabase_schema.sql`](./supabase_schema.sql) que está en tu carpeta, copia todo su contenido y pégalo en el editor de Supabase.
4. Presiona el botón verde **RUN** (abajo a la derecha).
   * *Esto creará automáticamente todas las tablas (`variedades`, `parcelas`, `ventas`, `jornales`, `tratamientos`, `gastos`, etc.), configurará los permisos de lectura/escritura y precargará tus 3 hectáreas, lotes de Palta Hass, Fuerte, Plátano, Mauro Robles, Kike y los 45 insumos químicos.*
5. Ahora ve a **Project Settings** (icono de engranaje ⚙️ abajo a la izquierda) y luego a **API**.
6. Copia dos datos:
   - **Project URL** (algo como `https://xyzabcdef.supabase.co`)
   - **Project API keys -> `anon` / `public`** (clave larga que empieza con `eyJ...`)

---

## 🐙 PASO 2: Subir tu Proyecto a GitHub

Ya hemos inicializado Git y creado el primer commit en tu máquina. Ahora solo debes vincularlo a tu cuenta de GitHub:

1. Entra a tu cuenta en [GitHub.com](https://github.com) y haz clic en **New repository** (o el botón verde `+` arriba a la derecha).
2. Ponle nombre al repositorio (por ejemplo: `fundoelcastillo`).
3. Déjalo en **Public** (para que GitHub Pages sea gratuito) y **NO marques** *"Initialize this repository with a README"* (ya tenemos todo listo).
4. Haz clic en **Create repository**.
5. En tu Mac, abre la terminal en esta carpeta y corre los siguientes comandos (reemplazando `TU_USUARIO` y `TU_REPOSITORIO` por los tuyos):

```bash
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```

---

## 🌐 PASO 3: Activar GitHub Pages (Web en Vivo)

Una vez subido el código a GitHub:

1. En la página de tu repositorio en GitHub, ve a la pestaña **Settings** (arriba a la derecha).
2. En el menú lateral izquierdo, haz clic en **Pages**.
3. En la sección **Build and deployment**:
   - **Source:** Selecciona `Deploy from a branch`.
   - **Branch:** Selecciona `main` y en la carpeta deja `/ (root)`.
4. Haz clic en el botón **Save**.
5. Espera unos 60 segundos y recarga la página. Verás un banner verde que dice:
   > *"Your site is live at https://TU_USUARIO.github.io/TU_REPOSITORIO/"*

---

## 📱 PASO 4: Conectar la Web en tu Celular

1. Abre el enlace de GitHub Pages en el navegador de tu celular (Safari o Chrome).
2. En el menú o en la esquina inferior izquierda del panel, toca el botón que dice **SQLite Local ⚙️** (o el botón de engranaje).
3. Pega tu **Project URL** y tu **Anon Key** de Supabase (solo tendrás que hacerlo una vez; se guardará de forma segura en tu navegador).
4. Toca **Guardar y Conectar**.
5. ¡Listo! El indicador cambiará a **Supabase Nube ⚡**. Ahora cualquier venta, jornal o aplicación que anotes desde el celular se guardará en tiempo real en tu base de datos de Supabase.

---

### 📲 Consejo: Instalar como App en la pantalla de inicio de tu Celular
* **En iPhone / Safari:** Toca el botón de compartir (cuadrado con flecha hacia arriba) y selecciona **"Agregar a pantalla de inicio"**.
* **En Android / Chrome:** Toca los 3 puntos arriba a la derecha y selecciona **"Agregar a la pantalla principal"** o **"Instalar aplicación"**.

¡Así tendrás un icono de **Fundo El Castillo** en tu teléfono que se abrirá a pantalla completa como una aplicación nativa!
