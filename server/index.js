const util = require('util');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const Tesseract = require('tesseract.js'); // Librería de OCR

const app = express();
app.use(cors());
app.use(express.json());

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

        if (!foto_url || !dni_foto_url) return res.status(400).json({ error: "Faltan fotos." });

        // --- LÓGICA DE EDAD (Precisa) ---
        const nacimiento = new Date(fecha_nacimiento);
        const hoy = new Date();
        let edad = hoy.getFullYear() - nacimiento.getFullYear();
        const m = hoy.getMonth() - nacimiento.getMonth();
        if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) { 
            edad--; 
        }

        // --- TU LÓGICA DE CATEGORÍAS (RESTAURADA) ---
        let categoria = "";
        if (edad <= 7) categoria = "Sub 7";
        else if (edad <= 9) categoria = "Sub 9";
        else if (edad <= 11) categoria = "Sub 11";
        else if (edad <= 13) categoria = "Sub 13";
        else if (edad <= 15) categoria = "Sub 15";
        else if (edad <= 17) categoria = "Sub 17";
        else if (edad < 30) categoria = "Reserva/Primera";
        else if (edad < 45) categoria = "Unicas (+30/35)";
        else categoria = "Reinas (+45)";

        // --- GUARDADO RÁPIDO ---
// En tu server/index.js (Ruta /fichar)
const { data, error: dbError } = await supabase
    .from('jugadoras')
    .insert([{
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        dni: dni.trim(),
        fecha_nacimiento: fecha_nacimiento,
        equipo_id: parseInt(equipo_id), // <--- Obligamos a que sea número
        organizacion_id: organizacion_id, // <--- Debe ser el UUID
        foto_url: foto_url,
        dni_foto_url: dni_foto_url,
        categoria_actual: categoria,
        verificacion_manual: true,
        distancia_biometrica: 0
    }])
    .select();

        if (dbError) {
            if (dbError.code === '23505') return res.status(409).json({ error: "DNI DUPLICADO" });
            throw dbError;
        }

        // Respuesta inmediata: Evita el 504 de Vercel
        return res.status(200).json({ mensaje: "✅ Fichaje Exitoso", jugadora: data[0] });

    } catch (err) {
        console.error("Error:", err);
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

const { jsPDF } = require("jspdf");
require("jspdf-autotable");

app.post('/generar-planilla-pdf', async (req, res) => {
  try {
    const { partidoId, organizacion_id } = req.body;

    // 1. Obtener datos del partido y nombres de equipos
    const { data: partido, error: pErr } = await supabase
      .from('partidos')
      .select(`
        *,
        local:equipos!local_id(id, nombre),
        visitante:equipos!visitante_id(id, nombre)
      `)
      .eq('id', partidoId)
      .single();

    if (pErr || !partido) return res.status(404).json({ error: "Partido no encontrado" });

    // 2. Obtener jugadoras de ambos equipos (Lista de Buena Fe por categoría)
    const { data: jugLocal } = await supabase
      .from('jugadoras')
      .select('nombre, apellido, dni, numero')
      .eq('equipo_id', partido.local_id)
      .eq('categoria', partido.categoria)
      .order('apellido', { ascending: true });

    const { data: jugVisita } = await supabase
      .from('jugadoras')
      .select('nombre, apellido, dni, numero')
      .eq('equipo_id', partido.visitante_id)
      .eq('categoria', partido.categoria)
      .order('apellido', { ascending: true });

    // 3. Configuración del PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // Encabezado principal
    doc.setFontSize(14);
    doc.text("PLANILLA DE JUEGO - LA LIGA DE LAS NENAS 2025", pageWidth / 2, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`FECHA: ${partido.nro_fecha || '---'}`, 20, 25);
    doc.text(`CATEGORÍA: ${partido.categoria.toUpperCase()}`, 80, 25);
    doc.text(`ZONA: ${partido.zona || 'ÚNICA'}`, 150, 25);

    const columns = ["№", "Nombre y Apellido", "DNI", "Firma", "Goles", "A", "R", "Faltas"];

    // --- TABLA EQUIPO LOCAL ---
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`LOCAL: ${partido.local.nombre.toUpperCase()}`, 20, 35);
    
    doc.autoTable({
      startY: 38,
      head: [columns],
      body: (jugLocal || []).map(j => [j.numero || "", `${j.nombre} ${j.apellido}`, j.dni, "", "", "", "", ""]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1 },
      headStyles: { fillGray: [200, 200, 200], textColor: 0, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 22 } }
    });

    let currentY = doc.lastAutoTable.finalY + 8;

    // Espacio de control para Local
    doc.setFontSize(9);
    doc.text("1ER TIEMPO: _________  2DO TIEMPO: _________  TOTAL GOLES: _________", 20, currentY);
    
    currentY += 12;

    // --- TABLA EQUIPO VISITANTE ---
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`VISITA: ${partido.visitante.nombre.toUpperCase()}`, 20, currentY);

    doc.autoTable({
      startY: currentY + 3,
      head: [columns],
      body: (jugVisita || []).map(j => [j.numero || "", `${j.nombre} ${j.apellido}`, j.dni, "", "", "", "", ""]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1 },
      headStyles: { fillGray: [200, 200, 200], textColor: 0, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 22 } }
    });

    currentY = doc.lastAutoTable.finalY + 8;

    // Espacio de control para Visita
    doc.setFontSize(9);
    doc.text("1ER TIEMPO: _________  2DO TIEMPO: _________  TOTAL GOLES: _________", 20, currentY);

    // Pie de página con firmas de delegados/árbitro
    currentY += 20;
    doc.line(20, currentY, 70, currentY); // Firma Local
    doc.line(140, currentY, 190, currentY); // Firma Visita
    doc.text("Firma Delegado Local", 30, currentY + 5);
    doc.text("Firma Delegado Visita", 150, currentY + 5);

    // 4. Salida del archivo
    const pdfOutput = doc.output('arraybuffer');
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=Planilla_F${partido.nro_fecha}.pdf`);
    res.send(Buffer.from(pdfOutput));

  } catch (error) {
    console.error("Error generando PDF:", error);
    res.status(500).json({ error: "Error interno del servidor" });
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

const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Servidor nc-s1125 INTELIGENTE en puerto ${PORT}`));

module.exports = app;