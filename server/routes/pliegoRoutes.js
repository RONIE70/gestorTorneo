const express = require('express');
const router = express.Router();
// Importamos la función de renderizado directo desde la carpeta hermana 'services'
const { generarPliegoIndustrial } = require('../services/pliegoService');

router.post('/crear-pliego-impresion', async (req, res) => {
  try {
    const { listaJugadores } = req.body; 

    if (!listaJugadores || !Array.isArray(listaJugadores) || listaJugadores.length === 0) {
      return res.status(400).json({ error: "No se recibieron datos de jugadoras para procesar el pliego." });
    }

    // El servicio procesa los carnets de las jugadoras directo a bytes vectoriales
    const pliegoBytes = await generarPliegoIndustrial(listaJugadores);

    // Configuramos las cabeceras HTTP para indicarle al navegador que recibe un PDF binario
    res.contentType("application/pdf");
    
    // Con 'attachment' forzamos a que el navegador lo descargue automáticamente
    res.setHeader("Content-Disposition", "attachment; filename=pliego_158cm_carnets.pdf");
    
    // Enviamos la ráfaga binaria de vuelta al cliente de React
    res.send(Buffer.from(pliegoBytes));

  } catch (err) {
    console.error("Error crítico en la compilación del pliego:", err);
    res.status(500).json({ error: "Fallo al compilar pliego vectorial: " + err.message });
  }
});

module.exports = router;