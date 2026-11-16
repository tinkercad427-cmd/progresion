# ProgresionPage — Training OS

Aplicación de seguimiento de entrenamiento hecha con HTML, CSS y JavaScript puro.

## Cómo ejecutar
1. Descomprimí la carpeta.
2. Abrí `index.html` en Microsoft Edge, Chrome o Firefox.
3. No necesita instalación, frameworks ni servidor.

## Datos y compatibilidad
- Conserva los registros existentes de `localStorage` con las claves `gym-series-v1` y `gym-ejercicios-v1`.
- Los nuevos módulos usan claves independientes.
- Los datos se guardan en el navegador y no se sincronizan automáticamente entre dispositivos.
- Usá Configuración → Exportar respaldo para guardar una copia JSON.

## Funciones
Dashboard, registro y edición de series, rutinas, biblioteca de ejercicios, estadísticas, récords, calendario, seguimiento corporal, logros, temporizador, asistente local, exportación CSV y respaldo JSON.

## Informe PDF
Configuración → Generar informe PDF abre la vista de impresión del navegador. Elegí “Guardar como PDF”.

## Asistente inteligente
El asistente genera observaciones mediante reglas y cálculos locales; no se conecta a un modelo de IA externo y no ofrece consejo médico.

## Estructura
- `index.html`
- `css/styles.css`
- `js/app.js`
