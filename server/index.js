const util = require('util');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const Tesseract = require('tesseract.js');

const app = express();

// --- CONFIGURACIÓN DE CORS PROFESIONAL ---
const corsOptions = {
    origin: '*', // En producción puedes cambiar '*' por 'https://gestor-torneo.vercel.app'
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Habilita pre-flight para todas las rutas

app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// --- CONFIGURACIÓN CLOUDINARY ---
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

// --- RUTA RAIZ (Para evitar el 404 de Vercel) ---
app.get('/', (req, res) => {
    res.status(200).json({
        status: "Online",
        message: "SaaS Gestión Deportiva API - Sistema Activo",
        timestamp: new Date().toISOString()
    });
});

// --- RUTA DE FICHAJE ---
app.post('/fichar', upload.fields([
    { name: 'foto', maxCount: 1 }, 
    { name: 'dni_foto', maxCount: 1 }
]), async (req, res) => {
    try {
        const { 
            nombre, apellido, dni, fecha_nacimiento, equipo_id, 
            organizacion_id, verificacion_manual, distancia_biometrica, observaciones_ia 
        } = req.body;

        const foto_url = req.files['foto'] ? req.files['foto'][0].path : null;
        const dni_foto_url = req.files['dni_foto'] ? req.files['dni_foto'][0].path : null;

        if (!foto_url || !dni_foto_url) {
            return res.status(400).json({ error: "Faltan fotos obligatorias." });
        }

        // Validación OCR
        const { data: { text: textoExtraido } } = await Tesseract.recognize(dni_foto_url, 'spa');
        const dniEscritoManual = dni.replace(/\D/g, '');
        const textoLimpioOCR = textoExtraido.replace(/\D/g, '');

        if (!textoLimpioOCR.includes(dniEscritoManual)) {
            return res.status(400).json({ 
                error: "RECHAZADO: El DNI manual no coincide con la imagen del documento." 
            });
        }

        // Cálculo Categoría
        const nacimiento = new Date(fecha_nacimiento);
        const hoy = new Date();
        let edad = hoy.getFullYear() - nacimiento.getFullYear();
        if (hoy.getMonth() < nacimiento.getMonth() || (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate())) {
            edad--;
        }

        let categoria = edad <= 17 ? `Sub ${edad % 2 === 0 ? edad : edad + 1}` : "Primera";

        const distanciaNum = parseFloat(distancia_biometrica) || 0;
        const flagRevision = verificacion_manual === 'true' || distanciaNum > 0.6;

        const { data, error: dbError } = await supabase
            .from('jugadoras')
            .insert([{
                nombre, apellido, dni, fecha_nacimiento,
                equipo_id: Number(equipo_id), organizacion_id,
                foto_url, dni_foto_url, categoria_actual: categoria,
                verificacion_manual: flagRevision,
                distancia_biometrica: distanciaNum,
                observaciones_ia: observaciones_ia
            }])
            .select();

        if (dbError) throw dbError;

        return res.status(200).json({ 
            mensaje: flagRevision ? "⚠️ En revisión manual." : "✅ Validado correctamente.", 
            jugadora: data[0]
        });

    } catch (err) {
        console.error("❌ ERROR:", err);
        return res.status(500).json({ error: err.message });
    }
});

// --- RUTA DASHBOARD ---
app.get('/dashboard-resumen', async (req, res) => {
    try {
        const { data: proximos } = await supabase.from('partidos').select('*, local:equipos!local_id(nombre, escudo_url), visitante:equipos!visitante_id(nombre, escudo_url)').eq('finalizado', false).limit(6);
        const { data: clubes } = await supabase.from('equipos').select('*').order('nombre');
        res.json({ proximos: proximos || [], clubes: clubes || [] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- RUTA APROBAR ---
app.patch('/jugadoras/:id/aprobar', async (req, res) => {
    try {
        const { data, error } = await supabase.from('jugadoras').update({ verificacion_manual: false }).eq('id', req.params.id).select();
        if (error) throw error;
        res.json({ mensaje: "Habilitada", jugadora: data[0] });
    } catch (err) {
        res.status(500).json({ error: "Error al actualizar" });
    }
});

// Para Local
if (process.env.NODE_ENV !== 'production') {
    app.listen(5000, () => console.log(`🚀 Server en puerto 5000`));
}

module.exports = app;