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

// --- CONFIGURACIÓN DE CORS REFORZADA ---
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.sendStatus(200);
});

app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

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

// RUTA RAIZ
app.get('/', (req, res) => {
    res.status(200).json({ status: "Online", message: "API Funcionando" });
});

// RUTA DASHBOARD (La que hace que cargue la principal)
app.get('/dashboard-resumen', async (req, res) => {
    try {
        const { data: proximos } = await supabase.from('partidos').select('*, local:equipos!local_id(nombre, escudo_url), visitante:equipos!visitante_id(nombre, escudo_url)').eq('finalizado', false).limit(6);
        const { data: clubes } = await supabase.from('equipos').select('*').order('nombre');
        const { data: goleadoras } = await supabase.from('jugadoras').select('*').gt('goles_totales', 0).limit(4);
        res.json({ proximos: proximos || [], clubes: clubes || [], goleadoras: goleadoras || [] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// RUTA FICHAJE
app.post('/fichar', upload.fields([{ name: 'foto', maxCount: 1 }, { name: 'dni_foto', maxCount: 1 }]), async (req, res) => {
    try {
        const { nombre, apellido, dni, fecha_nacimiento, equipo_id, organizacion_id, verificacion_manual, distancia_biometrica, observaciones_ia } = req.body;
        const foto_url = req.files['foto'] ? req.files['foto'][0].path : null;
        const dni_foto_url = req.files['dni_foto'] ? req.files['dni_foto'][0].path : null;

        const { data: { text: textoExtraido } } = await Tesseract.recognize(dni_foto_url, 'spa');
        const dniLimpio = dni.replace(/\D/g, '');
        
        const nacimiento = new Date(fecha_nacimiento);
        const hoy = new Date();
        let edad = hoy.getFullYear() - nacimiento.getFullYear();
        let categoria = edad <= 17 ? `Sub ${edad % 2 === 0 ? edad : edad + 1}` : "Primera";

        const { data, error: dbError } = await supabase.from('jugadoras').insert([{
            nombre, apellido, dni, fecha_nacimiento, equipo_id: Number(equipo_id), organizacion_id,
            foto_url, dni_foto_url, categoria_actual: categoria,
            verificacion_manual: (verificacion_manual === 'true' || parseFloat(distancia_biometrica) > 0.6),
            distancia_biometrica: parseFloat(distancia_biometrica) || 0,
            observaciones_ia
        }]).select();

        if (dbError) throw dbError;
        res.status(200).json({ mensaje: "Fichaje procesado", jugadora: data[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// OTRAS RUTAS
app.get('/jugadoras', async (req, res) => {
    const { data } = await supabase.from('jugadoras').select('*').order('created_at', { ascending: false });
    res.json(data || []);
});

app.patch('/jugadoras/:id/aprobar', async (req, res) => {
    await supabase.from('jugadoras').update({ verificacion_manual: false }).eq('id', req.params.id);
    res.json({ mensaje: "Habilitada" });
});

app.get('/validar-jugadora/:id', async (req, res) => {
    const { data } = await supabase.from('jugadoras').select('*').eq('id', req.params.id).single();
    res.json(data || { error: "No encontrada" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor activo`));

module.exports = app;