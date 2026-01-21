// 1. PARCHE DE COMPATIBILIDAD (Línea 1)
const util = require('util');
global.TextEncoder = util.TextEncoder;
global.TextDecoder = util.TextDecoder;

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const faceapi = require('face-api.js');
const canvas = require('canvas');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const Tesseract = require('tesseract.js');

const { Canvas, Image, ImageData, loadImage } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// CARGA DE MODELOS
async function cargarIA() {
    const modelPath = './models';
    try {
        await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
        await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
        await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
        console.log("✅ IA Biométrica cargada en nc-s1125");
    } catch (err) {
        console.error("❌ Error modelos:", err.message);
    }
}
cargarIA();

// CLOUDINARY
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary,
    params: { folder: 'jugadoras_ncs1125', resource_type: 'image' }
});
const upload = multer({ storage: storage });

// --- RUTA DE FICHAJE ---

app.post('/fichar', upload.fields([
    { name: 'foto', maxCount: 1 }, 
    { name: 'dni_foto', maxCount: 1 }
]), async (req, res) => {
    try {
        const { nombre, apellido, dni, fecha_nacimiento, equipo_id } = req.body;
        const foto_url = req.files['foto'] ? req.files['foto'][0].path : null;
        const dni_foto_url = req.files['dni_foto'] ? req.files['dni_foto'][0].path : null;

        if (!foto_url || !dni_foto_url) return res.status(400).json({ error: "Faltan fotos" });

        // --- VALIDACIÓN BIOMÉTRICA (Sensibilidad Máxima) ---
        const imgPerfil = await loadImage(foto_url);
        const imgDNI = await loadImage(dni_foto_url);
        const opciones = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.2 });

        const detPerfil = await faceapi.detectSingleFace(imgPerfil, opciones).withFaceLandmarks().withFaceDescriptor();
        const detDNI = await faceapi.detectSingleFace(imgDNI, opciones).withFaceLandmarks().withFaceDescriptor();

        let requiereRevision = false;
        if (detPerfil && detDNI) {
            const distancia = faceapi.euclideanDistance(detPerfil.descriptor, detDNI.descriptor);
            console.log(`📊 Distancia: ${distancia.toFixed(2)}`);
            if (distancia > 0.6) return res.status(401).json({ error: "La foto no coincide con el DNI." });
        } else {
            console.warn("⚠️ Rostro no detectado claramente. Se marcará para revisión.");
            requiereRevision = true;
        }

        // --- LÓGICA DE CATEGORÍAS REGLAMENTARIAS ---
        const nacimiento = new Date(fecha_nacimiento);
        const hoy = new Date();
        let edad = hoy.getFullYear() - nacimiento.getFullYear();
        const m = hoy.getMonth() - nacimiento.getMonth();
        if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
            edad--;
        }

        let categoria = "Sin categoría";
        if (edad <= 7) categoria = "Sub 7";
        else if (edad <= 9) categoria = "Sub 9";
        else if (edad <= 11) categoria = "Sub 11";
        else if (edad <= 13) categoria = "Sub 13";
        else if (edad <= 15) categoria = "Sub 15";
        else if (edad <= 17) categoria = "Sub 17";
        else if (edad < 30) categoria = "Reserva/Primera";
        else if (edad < 45) categoria = "Unicas (+30/35)";
        else categoria = "Reinas (+45)";

        console.log(`📌 Jugadora: ${apellido} | Edad: ${edad} | Categoría: ${categoria}`);

        // --- GUARDAR EN SUPABASE ---
        const { data, error } = await supabase
            .from('jugadoras')
            .insert([{
                nombre, apellido, dni,
                fecha_nacimiento,
                equipo_id: Number(equipo_id),
                foto_url,
                categoria_actual: categoria,
                verificacion_manual: requiereRevision
            }])
            .select();

        if (error) throw error;

        res.json({ 
            mensaje: requiereRevision ? "Fichaje pendiente de revisión visual" : "Fichaje exitoso",
            categoria,
            jugadora: data[0] 
        });

    } catch (err) {
        console.error("❌ Error:", err.message);
        res.status(500).json({ error: "Error procesando el registro" });
    }
});

const PORT = 5000;

// --- RUTA PARA APROBAR VERIFICACIÓN MANUAL ---
app.patch('/jugadoras/:id/aprobar', async (req, res) => {
    const { id } = req.params;

    try {
        const { data, error } = await supabase
            .from('jugadoras')
            .update({ verificacion_manual: false }) // Al ponerlo en false, queda como verificada
            .eq('id', id)
            .select();

        if (error) throw error;

        res.json({ 
            mensaje: "Jugadora aprobada manualmente con éxito", 
            jugadora: data[0] 
        });
    } catch (err) {
        console.error("❌ Error al aprobar jugadora:", err.message);
        res.status(500).json({ error: "No se pudo actualizar el estado de la jugadora" });
    }
});

app.get('/dashboard-resumen', async (req, res) => {
  try {
    // 1. Obtener los próximos 6 partidos (con info de equipos y zonas)
    const { data: proximos, error: errPartidos } = await supabase
      .from('partidos')
      .select(`
        *,
        local_info:equipos!local_id(nombre, escudo_url),
        visitante_info:equipos!visitante_id(nombre, escudo_url)
      `)
      .eq('finalizado', false)
      .order('nro_fecha', { ascending: true })
      .limit(6);

    // 2. Obtener todos los clubes inscriptos (por si no hay fixture aún)
    const { data: clubes, error: errClubes } = await supabase
      .from('equipos')
      .select('id, nombre, escudo_url')
      .order('nombre', { ascending: true });

    // 3. Obtener el Top Goleadoras (Simulado por ahora o desde tu tabla de estadísticas)
    const { data: goleadoras } = await supabase
      .from('jugadoras')
      .select('nombre, apellido, foto_url, goles_totales, equipo_id')
      .gt('goles_totales', 0)
      .order('goles_totales', { ascending: false })
      .limit(4);

    if (errPartidos || errClubes) throw new Error("Error al obtener datos de Supabase");

    // Enviamos el JSON completo al Frontend
    res.json({
      proximos: proximos || [],
      clubes: clubes || [],
      goleadoras: goleadoras || []
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Endpoint público para validación de QR
app.get('/validar-jugadora/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase
            .from('jugadoras')
            .select('nombre, apellido, foto_url, categoria_actual, verificacion_manual, equipos(nombre_equipo)')
            .eq('id', id)
            .single();

        if (error || !data) return res.status(404).json({ error: "Jugadora no encontrada" });

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Error en el servidor" });
    }
});

app.post('/registrar-sancion', async (req, res) => {
    const { jugadora_id, tarjeta_color, motivo } = req.body;
    
    try {
        // 1. Insertar la sanción
        await supabase.from('sanciones').insert([{ jugadora_id, tarjeta_color, motivo }]);

        // 2. Si es Roja, bloqueamos a la jugadora
        if (tarjeta_color === 'roja') {
            await supabase
                .from('jugadoras')
                .update({ sancionada: true })
                .eq('id', jugadora_id);
        }

        res.json({ mensaje: "Informe arbitral registrado correctamente" });
    } catch (err) {
        res.status(500).json({ error: "Error al registrar informe" });
    }
});

app.post('/registrar-incidencia-partido', async (req, res) => {
    const { jugadora_id, partido_id, tarjeta_color, goles, motivo } = req.body;

    try {
        // 1. Guardar la sanción/incidencia en la tabla de sanciones
        if (tarjeta_color) {
            await supabase.from('sanciones').insert([{ 
                jugadora_id, 
                partido_id, 
                tarjeta_color, 
                motivo 
            }]);

            // BLOQUEO AUTOMÁTICO: Si es roja, actualizamos la tabla jugadoras
            if (tarjeta_color === 'roja') {
                await supabase.from('jugadoras').update({ sancionada: true }).eq('id', jugadora_id);
            }
        }

        // 2. Si hizo goles, sumamos a su estadística personal
        if (goles > 0) {
            // Asumiendo que tienes una columna 'goles_totales' en la tabla jugadoras
            const { data } = await supabase.from('jugadoras').select('goles_totales').eq('id', jugadora_id).single();
            await supabase.from('jugadoras')
                .update({ goles_totales: (data.goles_totales || 0) + parseInt(goles) })
                .eq('id', jugadora_id);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/dashboard-resumen', async (req, res) => {
    try {
        // 1. Obtener Tabla de Posiciones (Top 5)
        const { data: posiciones } = await supabase
            .from('equipos')
            .select('nombre, puntos, pj, pg, pe, pp, gf, gc')
            .order('puntos', { ascending: false })
            .limit(5);

        // 2. Obtener Próximos Partidos
        const { data: proximos } = await supabase
            .from('partidos')
            .select('id, fecha_hora, categoria, local_info:local(nombre), visitante_info:visitante(nombre)')
            .eq('jugado', false)
            .order('fecha_hora', { ascending: true })
            .limit(3);

        // 3. Obtener Top 3 Goleadoras
        const { data: goleadoras } = await supabase
            .from('jugadoras')
            .select('nombre, apellido, goles_totales, foto_url')
            .gt('goles_totales', 0)
            .order('goles_totales', { ascending: false })
            .limit(3);

        res.json({ posiciones, proximos, goleadoras });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/dashboard-resumen', async (req, res) => {
    try {
        // ... (lo que ya tenías de posiciones, proximos y goleadoras)

        // 4. Obtener Últimos Comunicados
        const { data: noticias } = await supabase
            .from('comunicados')
            .select('*')
            .order('fecha_publicacion', { ascending: false })
            .limit(3);

        res.json({ posiciones, proximos, goleadoras, noticias });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => console.log(`✅ Servidor nc-s1125 en puerto ${PORT}`));