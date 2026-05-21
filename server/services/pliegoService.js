const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const axios = require('axios');

// Función auxiliar para descargar imágenes externas de forma segura sin romper el bucle
async function descargarImagenSegura(url) {
  if (!url) return null;
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(res.data);
  } catch (e) {
    console.warn(`No se pudo descargar la imagen: ${url}`);
    return null;
  }
}

/**
 * Dibuja los carnets directamente sobre un pliego de 158 cm de ancho usando tipografía vectorial e imágenes incrustadas.
 * @param {Array} listaJugadores - Datos de los carnets enviados por el frontend.
 */
async function generarPliegoIndustrial(listaJugadores) {
  const MM_A_PUNTOS = 2.834645;
  const ANCHO_PLIEGO = 1580 * MM_A_PUNTOS; // 158 cm en puntos fijos
  
  // Dimensiones de cada celda de carnet según tu lienzo (Frente + Dorso)
  const ANCHO_CARNET_BLOQUE = 185 * MM_A_PUNTOS; 
  const ALTO_CARNET_BLOQUE = 54 * MM_A_PUNTOS;
  
  const CARNETS_POR_FILA = 8;
  const MARGEN_X = 14 * MM_A_PUNTOS;
  const MARGEN_Y = 15 * MM_A_PUNTOS;
  const GAP_X = 10 * MM_A_PUNTOS;
  const GAP_Y = 12 * MM_A_PUNTOS;

  // Calculamos cuántas filas totales se necesitan e inferimos el alto del rollo
  const totalFilas = Math.ceil(listaJugadores.length / CARNETS_POR_FILA);
  const ALTO_PLIEGO_FINAL = MARGEN_Y * 2 + totalFilas * (ALTO_CARNET_BLOQUE + GAP_Y);

  const pdfMaestro = await PDFDocument.create();
  const lienzoPliego = pdfMaestro.addPage([ANCHO_PLIEGO, ALTO_PLIEGO_FINAL]);
  const fuenteBold = await pdfMaestro.embedFont(StandardFonts.HelveticaBold);
  const fuenteNormal = await pdfMaestro.embedFont(StandardFonts.Helvetica);

  // Procesamos e imponemos cada credencial de forma matemática
  for (let index = 0; index < listaJugadores.length; index++) {
    const jug = listaJugadores[index];
    const fila = Math.floor(index / CARNETS_POR_FILA);
    const col = index % CARNETS_POR_FILA;

    // Coordenadas de ubicación en el plano cartesiano
    const x = MARGEN_X + col * (ANCHO_CARNET_BLOQUE + GAP_X);
    const yOriginal = MARGEN_Y + fila * (ALTO_CARNET_BLOQUE + GAP_Y);
    // Corrección para pdf-lib (eje Y empieza abajo a la izquierda)
    const y = ALTO_PLIEGO_FINAL - yOriginal - ALTO_CARNET_BLOQUE;

    // 1. DIBUJAR ESTRUCTURA BASE (Fondo del carnet)
    lienzoPliego.drawRectangle({
      x: x, y: y,
      width: ANCHO_CARNET_BLOQUE, height: ALTO_CARNET_BLOQUE,
      borderColor: rgb(0.12, 0.16, 0.23), borderWidth: 1,
      color: rgb(0.06, 0.09, 0.16) // Color Slate-900 aproximado
    });

    // Línea decorativa del color primario de la liga
    lienzoPliego.drawRectangle({
      x: x, y: y + ALTO_CARNET_BLOQUE - (4 * MM_A_PUNTOS),
      width: ANCHO_CARNET_BLOQUE, height: 4 * MM_A_PUNTOS,
      color: rgb(0.85, 0, 0.51) // Rosa SC-1225
    });

    // 2. PROCESAR E INCRUSTAR IMÁGENES (Foto de la jugadora)
    const fotoBuffer = await descargarImagenSegura(jug.foto_url);
    if (fotoBuffer) {
      try {
        const imgIncrustada = await pdfMaestro.embedPng(fotoBuffer);
        lienzoPliego.drawImage(imgIncrustada, {
          x: x + (6 * MM_A_PUNTOS), y: y + (6 * MM_A_PUNTOS),
          width: 32 * MM_A_PUNTOS, height: 40 * MM_A_PUNTOS
        });
      } catch (err) {
        // Respaldo si no es PNG válido (Procesa el JPEG de forma limpia)
        try {
          const imgIncrustadaJpg = await pdfMaestro.embedJpeg(fotoBuffer);
          lienzoPliego.drawImage(imgIncrustadaJpg, {
            x: x + (6 * MM_A_PUNTOS), y: y + (6 * MM_A_PUNTOS),
            width: 32 * MM_A_PUNTOS, height: 40 * MM_A_PUNTOS
          });
        } catch (e) {}
      }
    }

    // 3. ESTAMPAR TEXTO VECTORIAL (Letras perfectamente nítidas para imprenta)
    lienzoPliego.drawText(`${jug.apellido.toUpperCase()}, ${jug.nombre.toUpperCase()}`, {
      x: x + (42 * MM_A_PUNTOS), y: y + (36 * MM_A_PUNTOS),
      size: 10, font: fuenteBold, color: rgb(1, 1, 1)
    });

    lienzoPliego.drawText(`DNI: ${jug.dni}`, {
      x: x + (42 * MM_A_PUNTOS), y: y + (26 * MM_A_PUNTOS),
      size: 9, font: fuenteNormal, color: rgb(0.6, 0.6, 0.6)
    });

    lienzoPliego.drawText(`CAT: ${jug.categoria.toUpperCase()}`, {
      x: x + (42 * MM_A_PUNTOS), y: y + (16 * MM_A_PUNTOS),
      size: 9, font: fuenteBold, color: rgb(0, 0.7, 0.4)
    });

    lienzoPliego.drawText(jug.club_nombre.toUpperCase(), {
      x: x + (42 * MM_A_PUNTOS), y: y + (7 * MM_A_PUNTOS),
      size: 8, font: fuenteNormal, color: rgb(0.4, 0.6, 1)
    });

    // Sello de Habilitación
    // Dibujamos la palabra soportada por WinAnsi
    lienzoPliego.drawText("HABILITADA", {
      x: x + ANCHO_CARNET_BLOQUE - (27 * MM_A_PUNTOS), y: y + (7 * MM_A_PUNTOS),
      size: 8, font: fuenteBold, color: rgb(0, 0.8, 0.2)
    });

    // Dibujamos el tilde (✓) vectorialmente para mantener el diseño original sin crashear la fuente
    const tildeX = x + ANCHO_CARNET_BLOQUE - (35 * MM_A_PUNTOS);
    const tildeY = y + (7 * MM_A_PUNTOS);
    
    lienzoPliego.drawLine({
      start: { x: tildeX, y: tildeY + (3 * MM_A_PUNTOS) },
      end: { x: tildeX + (2 * MM_A_PUNTOS), y: tildeY },
      thickness: 1.5, color: rgb(0, 0.8, 0.2)
    });
    lienzoPliego.drawLine({
      start: { x: tildeX + (2 * MM_A_PUNTOS), y: tildeY },
      end: { x: tildeX + (6 * MM_A_PUNTOS), y: tildeY + (7 * MM_A_PUNTOS) },
      thickness: 1.5, color: rgb(0, 0.8, 0.2)
    });
  }

  return await pdfMaestro.save();
}

module.exports = { generarPliegoIndustrial };