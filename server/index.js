const util = require('util');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const Tesseract = require('tesseract.js'); // Librería de OCR
const pliegoRoutes = require('./routes/pliegoRoutes');


const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use('/api', pliegoRoutes);

// server/index.js
// Forzamos que use la variable correcta
const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY 
);


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

// --- RUTA DE FICHAJE CON FILTRO OCR Y VALIDACIÓN DE DUPLICADOS ---

// Usamos upload.none() porque el frontend ahora manda URLs en texto dentro del FormData, ya no manda los archivos binarios.
app.post('/fichar', upload.none(), async (req, res) => {
    try {
        const { 
            nombre, apellido, dni, fecha_nacimiento, equipo_id, 
            organizacion_id, verificacion_manual, distancia_biometrica_oficial, observaciones_ia,
            foto_url, dni_foto_url // <--- Ahora extraemos las URLs directamente del body
        } = req.body;

        if (!foto_url || !dni_foto_url) return res.status(400).json({ error: "Faltan las URLs de las fotos." });

        const nacimiento = new Date(fecha_nacimiento);
        const anioNac = nacimiento.getFullYear();
        const hoy = new Date();
        let edad = hoy.getFullYear() - anioNac;
        const m = hoy.getMonth() - nacimiento.getMonth();
        if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) { 
            edad--; 
        }

        // --- LÓGICA DE CATEGORÍAS PERSONALIZADA ---
        let categoria = "";
        const ID_LIGA_NENAS = "af190e5a-f84a-4fbf-8a82-1b04dbb72178";
                                
        if (organizacion_id === ID_LIGA_NENAS) {
            // Reglas específicas Liga de las Nenas (Por años)
            if (anioNac >= 2017) categoria = "2017-2018";
            else if (anioNac >= 2015) categoria = "2015-2016";
            else if (anioNac >= 2013) categoria = "2013-2014";
            else if (anioNac >= 2011) categoria = "2011-2012";
            else categoria = "No Categorizada";
        } else {
            // Reglas estándar para otras organizaciones
            if (edad <= 7) categoria = "Sub 7";
            else if (edad <= 9) categoria = "Sub 9";
            else if (edad <= 11) categoria = "Sub 11";
            else if (edad <= 13) categoria = "Sub 13";
            else if (edad <= 15) categoria = "Sub 15";
            else if (edad <= 17) categoria = "Sub 17";
            else if (edad < 30) categoria = "Reserva/Primera";
            else if (edad < 45) categoria = "Unicas (+30/35)";
            else categoria = "Reinas (+45)";
        }

        // --- GUARDADO EN SUPABASE ---
        const { data, error: dbError } = await supabase
            .from('jugadoras')
            .insert([{
                nombre: nombre.trim().toUpperCase(),
                apellido: apellido.trim().toUpperCase(),
                dni: dni.trim(),
                fecha_nacimiento: fecha_nacimiento,
                equipo_id: parseInt(equipo_id),
                organizacion_id: organizacion_id,
                foto_url: foto_url,         // <--- Guardamos el texto directo
                dni_foto_url: dni_foto_url, // <--- Guardamos el texto directo
                categoria_actual: categoria, 
                verificacion_manual: verificacion_manual === 'true' || verificacion_manual === true,
                distancia_biometrica_oficial: parseFloat(distancia_biometrica_oficial) || 0,
                observaciones_ia: observaciones_ia || ""
            }])
            .select();

        if (dbError) {
            if (dbError.code === '23505') return res.status(409).json({ error: "DNI DUPLICADO" });
            throw dbError;
        }

        return res.status(200).json({ mensaje: "✅ Fichaje Exitoso", jugadora: data[0] });

    } catch (err) {
        console.error("Error crítico en fichaje:", err);
        return res.status(500).json({ error: err.message });
    }
});

// Agregá esto en server/index.js
app.get('/', (req, res) => {
    res.status(200).json({
        status: "Online",
        message: "SaaS Gestión Deportiva API - Sistema Activo",
        timestamp: new Date().toISOString()
    });
});

app.post('/generar-planilla-pdf', async (req, res) => {
    const { partidoId, organizacion_id } = req.body;
    if (!partidoId) return res.status(400).json({ error: "Falta partidoId" });
    
    // Respondemos con éxito para que el frontend tome el control
    res.json({ status: "success", message: "Generando documento dinámico" });
});


// --- RUTA DASHBOARD ---
app.get('/dashboard-resumen', async (req, res) => {
    try {
        const { data: proximos } = await supabase.from('partidos').select('*, local_info:equipos!local_id(nombre, escudo_url), visitante_info:equipos!visitante_id(nombre, escudo_url)').eq('finalizado', false).limit(6);
        const { data: clubes } = await supabase.from('equipos').select('*').order('nombre');
        const { data: goleadoras } = await supabase.from('jugadoras').select('*').gt('goles_totales', 0).limit(4);
        res.json({ proximos: proximos || [], clubes: clubes || [], goleadoras: goleadoras || [] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/jugadoras/verificar/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('jugadoras')
      .update({ verificacion_manual: false })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Jugadora no encontrada' });
    }

    res.json({ message: 'Jugadora verificada correctamente', jugadora: data });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.get('/api/verificar/delegado/:dni', async (req, res) => {
  const { dni } = req.params;
  try {
    const { data, error } = await supabase
      .from('delegados')
      .select('*, equipos:club_id(nombre, escudo_url)')
      .eq('dni', dni.trim())
      .maybeSingle();

    if (error) return res.status(500).json({ habilitado: false, error: error.message });
    if (!data) return res.status(404).json({ habilitado: false, mensaje: "No encontrado" });

    res.json({ habilitado: true, datos: data });
  } catch (err) {
    res.status(500).json({ habilitado: false, error: err.message });
  }
});

// Ruta para guardar delegados
app.post('/api/delegados', async (req, res) => {
  try {
    const db = getDb(); // O como sea que llames a tu conexión de base de datos
    const nuevoDelegado = req.body;
    
    // Guardamos en una colección llamada 'delegados'
    const resultado = await db.collection('delegados').insertOne(nuevoDelegado);
    
    res.status(201).json({ _id: resultado.insertedId, ...nuevoDelegado });
  } catch (error) {
    res.status(500).json({ error: "No se pudo guardar el delegado" });
  }
});

// Ruta para traer los delegados de un club
app.get('/api/delegados/:clubId', async (req, res) => {
  try {
    const db = getDb();
    const clubId = req.params.clubId;
    const delegados = await db.collection('delegados').find({ club_id: clubId }).toArray();
    res.json(delegados);
  } catch (error) {
    res.status(500).json({ error: "Error al traer delegados" });
  }
});


// --- RUTA APROBAR MANUAL ---
app.patch('/jugadoras/:id/aprobar', async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase.from('jugadoras').update({ verificacion_manual: false }).eq('id', id).select();
        if (error) throw error;
        res.json({ mensaje: "Habilitada con éxito", jugadora: data[0] });
    } catch (err) {
        res.status(500).json({ error: "Error al actualizar" });
    }
});



if (process.env.NODE_ENV !== 'production') {
  const PORT = 5000;

  app.listen(PORT, () => {
    console.log(`🚀 Servidor en puerto ${PORT}`);
  });
}

module.exports = app;