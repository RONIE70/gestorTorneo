import React, { useState, useEffect, useCallback } from 'react'; 
import { supabase } from '../supabaseClient';
import axios from 'axios';
import CarnetJugadora from '../components/CarnetJugadora'; 
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import EXIF from 'exif-js';
import * as faceapi from 'face-api.js';

const URL_MODELOS = 'models';

const AdminDelegado = () => {
  // --- ESTADOS DE SESIÓN Y PERFIL ---
  // eslint-disable-next-line no-unused-vars
  const [perfilUsuario, setPerfilUsuario] = useState(null);
  const [equipoIdActual, setEquipoIdActual] = useState(null);

  // --- ESTADOS DE INTERFAZ ---
  const [activeTab, setActiveTab] = useState('planilla'); 
  const [plantel, setPlantel] = useState([]);
  const [partidos, setPartidos] = useState([]);
  const [clubes, setClubes] = useState([]); 
  const [partidoSeleccionado, setPartidoSeleccionado] = useState('');
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [expedientes, setExpedientes] = useState([]);
  const [configLiga, setConfigLiga] = useState(null);

  const navigate = useNavigate();

  // --- ESTADOS DE EDICIÓN Y FICHAJE ---
  const [editandoId, setEditandoId] = useState(null);
  const [datosEdicion, setDatosEdicion] = useState({ nombre: '', apellido: '', dni: '', fecha_nacimiento: '' });
  const [filePerfil, setFilePerfil] = useState(null);
  const [fileDNI, setFileDNI] = useState(null);
  const [jugadoraRegistrada, setJugadoraRegistrada] = useState(null);
  const [cargandoFichaje, setCargandoFichaje] = useState(false);
  const [datosFichaje, setDatosFichaje] = useState({ 
    nombre: '', apellido: '', dni: '', fecha_nacimiento: '', equipo_id: '', club_nombre: '', club_escudo: ''   
  });

const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: perfil, error: perfilError } = await supabase
        .from('perfiles')
        .select('equipo_id, rol')
        .eq('id', session.user.id)
        .single();

      if (perfilError || !perfil) return;

      setPerfilUsuario(perfil);
      
      // USAMOS ESTA VARIABLE LOCAL PARA TODA LA FUNCIÓN
      const idParaFiltrar = (perfil.rol === 'superadmin') ? (perfil.equipo_id || 4) : perfil.equipo_id;
      setEquipoIdActual(idParaFiltrar);

      // 2. Cargar configuración
      const { data: config } = await supabase.from('configuracion_liga').select('*').eq('id', 1).single();
      setConfigLiga(config);

      // 3. Plantel (Filtrado por ID Directo)
      const { data: jugadorasData } = await supabase
        .from('jugadoras')
        .select(`*, sanciones(id, motivo, estado)`)
        .eq('equipo_id', idParaFiltrar);
      
      setPlantel(jugadorasData?.map(j => ({
        ...j,
        estaSuspendida: j.sanciones?.some(s => s.estado === 'cumpliendo') || j.sancionada === true
      })) || []);

      // 4. CORRECCIÓN ERROR 400: Expedientes Disciplinarios
      // Filtramos por jugadoras que pertenecen al equipo para evitar el error de relación
      const { data: sancData } = await supabase
        .from('sanciones')
        .select(`
          *,
          jugadora:jugadoras!inner(nombre, apellido, dni, equipo_id),
          partido:partidos(
            nro_fecha, 
            local:equipos!local_id(nombre), 
            visitante:equipos!visitante_id(nombre)
          )
        `)
        .eq('jugadora.equipo_id', idParaFiltrar) // Filtro a través de la relación inner
        .order('created_at', { ascending: false });
      
      setExpedientes(sancData || []);

      // 5. Partidos y Clubes
      const { data: partidosData } = await supabase
        .from('partidos')
        .select('*, local:equipos!local_id(nombre), visitante:equipos!visitante_id(nombre)')
        .or(`local_id.eq.${idParaFiltrar},visitante_id.eq.${idParaFiltrar}`)
        .eq('finalizado', false); 
      setPartidos(partidosData || []);

      const { data: clubesData } = await supabase.from('equipos').select('*').order('nombre');
      setClubes(clubesData || []);

    } catch (error) {
      console.error("Error en fetchData:", error);
    }
  }, []);

  // --- AGREGAMOS ESTA PIEZA QUE FALTA: CARGA DE MODELOS IA ---
  useEffect(() => {
    const cargarModelosIA = async () => {
        try {
            console.log("Intentando cargar modelos desde:", URL_MODELOS);
            const MODEL_URL = '/models';
            // Verificamos que faceapi esté disponible
            await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
            await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
            await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
            
            console.log("✅ IA Biométrica cargada y lista en el puerto 5173");
        } catch (err) {
            console.error("❌ Error de red al cargar modelos:", err);
            // Si sale Failed to fetch aquí, es porque la carpeta no está en public/models
        }
    };
    cargarModelosIA();
}, []);


  useEffect(() => { 
    fetchData(); 
  }, [fetchData]);
  

  // LOGICA FORENSE EXIF (Punto 2)
  const analizarImagen = (archivo) => {
    return new Promise((resolve) => {
      EXIF.getData(archivo, function() {
        const tags = EXIF.getAllTags(this);
        const software = (tags.Software || "").toLowerCase();
        const tieneModelo = !!tags.Model;
        const tieneFechaOriginal = !!tags.DateTimeOriginal;
        let flagSospecha = false;
        let motivo = "";
        const editoresProhibidos = ["photoshop", "adobe", "gimp", "canva", "picsart", "lightroom"];
        if (editoresProhibidos.some(ed => software.includes(ed))) {
          flagSospecha = true;
          motivo = "Manipulación detectada: Imagen procesada con software de edición.";
        }
        if (!tieneModelo && !tieneFechaOriginal) {
          if (archivo.name.toLowerCase().includes("screenshot") || archivo.name.toLowerCase().includes("captura")) {
            flagSospecha = true;
            motivo = "La imagen parece ser una captura de pantalla.";
          }
        }
        resolve({ sospechosa: flagSospecha, motivo });
      });
    });
  };

  // FUNCIÓN PARA GENERAR EL PDF DEL DICTAMEN CON IDENTIDAD VISUAL NUEVA
  const generarPDFDictamenDelegado = (jugadora, config) => {
    const doc = new jsPDF();
    
    // Configuración de Colores basada en Regla de Estilo
    const colores = {
        fondo: '#000000', // Negro
        textoPrincipal: '#d90082', // Rosa fuerte
        subtitulo: '#ffffff', // Blanco
        divisor: '#000000'
    };

    // Cabecera Estilo Carnet/Reporte
    doc.setFillColor(colores.fondo);
    doc.rect(0, 0, 210, 45, 'F');
    
    doc.setTextColor(colores.textoPrincipal);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(config?.nombre_liga || "LIGA OFICIAL", 105, 20, { align: 'center' });
    
    doc.setTextColor(colores.subtitulo);
    doc.setFontSize(14);
    doc.text("NOTIFICACIÓN DE SANCIÓN VIGENTE", 105, 35, { align: 'center' });
    
    // Cuerpo del documento
    doc.setTextColor(colores.divisor);
    doc.line(20, 50, 190, 50);

    doc.setFontSize(12);
    doc.text(`Jugadora: ${jugadora.apellido}, ${jugadora.nombre}`, 20, 70);
    doc.text(`Documento: ${jugadora.dni || 'N/A'}`, 20, 80);
    doc.text(`Estado Disciplinario: INHABILITADA`, 20, 90);
    
    doc.setFont("helvetica", "bold");
    doc.text(`Resolución del Tribunal:`, 20, 110);
    
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    const motivo = jugadora.aclaracion_tribunal || "Sanción aplicada por el Tribunal de Disciplina según informe arbitral correspondiente.";
    const lineasMotivo = doc.splitTextToSize(motivo, 170);
    doc.text(lineasMotivo, 20, 120);

    // Pie de página con QR simbólico y firma
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Este documento es una notificación oficial para el delegado del club.", 105, 270, { align: 'center' });
    doc.text(`ID Equipo de Gestión: ${equipoIdActual} | `, 105, 275, { align: 'center' });
    
    doc.save(`Dictamen_${jugadora.apellido}.pdf`);
  };

  // FUNCIÓN PARA ENVIAR DESCARGO
  const enviarDescargo = async (sancionId, textoDescargo, esLocal) => {
    if (!textoDescargo || textoDescargo.trim().length < 5) return alert("Escribe un descargo válido");
    
    const campoDescargo = esLocal ? 'descargo_local' : 'descargo_visitante';
    
    const { error } = await supabase
      .from('sanciones')
      .update({ [campoDescargo]: textoDescargo })
      .eq('id', sancionId);

    if (!error) {
      alert("✅ Tu descargo ha sido registrado. El Tribunal lo revisará antes de dictar sentencia.");
      fetchData();
    }
  };

  const descargarInformeSancion = (sancion) => {
    const doc = new jsPDF();
    const colores = { fondo: '#000000', texto: '#d90082' };
    
    doc.setFillColor(colores.fondo);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(colores.texto);
    doc.setFontSize(18);
    doc.text("BOLETÍN OFICIAL - TRIBUNAL", 105, 25, { align: 'center' });
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text(`Expediente: #${sancion.id}`, 20, 55);
    doc.text(`Sancionada: ${sancion.jugadora?.apellido}, ${sancion.jugadora?.nombre}`, 20, 65);
    doc.text(`Penalidad: ${sancion.cantidad_fechas || 'Pendiente'} fecha(s)`, 20, 75);
    doc.text(`Considerandos:`, 20, 90);
    doc.setFontSize(10);
    doc.text(sancion.aclaracion_tribunal || sancion.motivo, 20, 100, { maxWidth: 170 });
    
    doc.save(`Resolucion_Tribunal_${sancion.id}.pdf`);
  };

  const toggleJugadora = (jugadora) => {
    if (editandoId) return;
    if (jugadora.estaSuspendida) {
        alert("🚫 ACCIÓN DENEGADA: Jugadora suspendida por el Tribunal.");
        return;
    }
    setSeleccionadas(prev => 
      prev.includes(jugadora.id) ? prev.filter(item => item !== jugadora.id) : [...prev, jugadora.id]
    );
  };

  const guardarPlanilla = async () => {
    if (!partidoSeleccionado) return alert("Selecciona un partido");
    if (seleccionadas.length === 0) return alert("Selecciona jugadoras");
    const rows = seleccionadas.map(jId => ({ partido_id: partidoSeleccionado, jugadora_id: jId, equipo_id: equipoIdActual }));
    const { error } = await supabase.from('planillas_citadas').insert(rows);
    if (!error) {
      alert("🚀 Planilla enviada con éxito");
      setSeleccionadas([]);
    }
  };

  

  // Agrega esta función de utilidad arriba de manejarEnvioFichaje
const preprocesarImagenIA = async (archivo) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Creamos un canvas para normalizar la imagen
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                // Redimensionamos a un tamaño estándar para IA (max 600px) para evitar saturación de memoria
                const escala = Math.min(600 / img.width, 600 / img.height, 1);
                canvas.width = img.width * escala;
                canvas.height = img.height * escala;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas); // Devolvemos el canvas que face-api entiende perfectamente
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(archivo);
    });
};

const manejarEnvioFichaje = async (e) => {
    e.preventDefault();
    if (!equipoIdActual || !filePerfil || !fileDNI) return alert("⚠️ Faltan datos obligatorios");
    // Verificación de seguridad: ¿Está cargado el modelo Tiny?
    if (!faceapi.nets.tinyFaceDetector.params) {
        return alert("⏳ La IA todavía se está cargando. Espera un segundo e intenta de nuevo.");
    }
    setCargandoFichaje(true);

    try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const imgPerfilLimpa = await preprocesarImagenIA(filePerfil);
        const imgDNILimpia = await preprocesarImagenIA(fileDNI);

        const opcionesIA = new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.3 });

        // Variables para la biometría
        let distanciaFinal = 1.0; // Valor por defecto (máxima duda)
        let requiereRevisionBiometrica = false;

        const detPerfil = await faceapi.detectSingleFace(imgPerfilLimpa, opcionesIA).withFaceLandmarks().withFaceDescriptor();
        const detDNI = await faceapi.detectSingleFace(imgDNILimpia, opcionesIA).withFaceLandmarks().withFaceDescriptor();

        if (!detPerfil || !detDNI) {
            // CAMBIO CLAVE: En lugar de lanzar Error, avisamos y marcamos para revisión
            console.warn("IA no detectó rostro.");
            requiereRevisionBiometrica = true;
            distanciaFinal = 1.1; // Usamos 1.1 para indicar que ni siquiera hubo detección
        } else {
            distanciaFinal = faceapi.euclideanDistance(detPerfil.descriptor, detDNI.descriptor);
            if (distanciaFinal > 0.6) {
                // Si detectó pero son distintos, podrías elegir bloquear o mandar a revisión
                // Aquí elegimos mandar a revisión con alerta
                requiereRevisionBiometrica = true;
            }
        }

        const analisisDNI = await analizarImagen(fileDNI);
        
        const formData = new FormData();
        formData.append('foto', filePerfil);
        formData.append('dni_foto', fileDNI);
        formData.append('nombre', datosFichaje.nombre);
        formData.append('apellido', datosFichaje.apellido);
        formData.append('dni', datosFichaje.dni);
        formData.append('fecha_nacimiento', datosFichaje.fecha_nacimiento);
        formData.append('equipo_id', equipoIdActual);
        
        // Marcamos revisión manual si falló la IA o el análisis forense
        formData.append('verificacion_manual', requiereRevisionBiometrica || analisisDNI.sospechosa);
        formData.append('distancia_biometrica', distanciaFinal);

        const res = await axios.post('http://localhost:5000/fichar', formData, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        
        const { mensaje } = res.data;

        if (requiereRevisionBiometrica) {
            alert(`⚠️ ATENCIÓN: ${mensaje}\n Se ha enviado una ALERTA AL ADMINISTRADOR para su revisión manual.`);
        } else {
            alert("✅ Fichaje completado y validado correctamente.");
        }

        setJugadoraRegistrada({ ...res.data.jugadora });
        fetchData();

    } catch (err) { 
        alert("🚨 Error: " + (err.response?.data?.error || err.message));
    } finally { 
        setCargandoFichaje(false); 
    }
};


  const iniciarEdicion = (e, j) => {
    e.stopPropagation();
    setEditandoId(j.id);
    setDatosEdicion({ nombre: j.nombre, apellido: j.apellido, dni: j.dni, distancia_biometrica: j.distancia_biometrica, fecha_nacimiento: j.fecha_nacimiento });
  };

  const guardarActualizacion = async (e, id) => {
    e.stopPropagation();
    const { error } = await supabase.from('jugadoras').update(datosEdicion).eq('id', id);
    if (!error) { setEditandoId(null); fetchData(); }
  };

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-white font-sans">
      <header className="mb-8 border-b border-slate-800 pb-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase italic text-blue-500">Panel de Delegado</h1>
          <p className="text-slate-400 text-[10px] uppercase tracking-widest italic">Liga Oficial</p>
        </div>
        <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800 overflow-x-auto shadow-2xl">
          <button onClick={() => setActiveTab('planilla')} className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all ${activeTab === 'planilla' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>📋 CITACIONES</button>
          <button onClick={() => setActiveTab('fichaje')} className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all ${activeTab === 'fichaje' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>⚽ FICHAJE</button>
          <button onClick={() => setActiveTab('disciplina')} className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all ${activeTab === 'disciplina' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>⚖️ TRIBUNAL</button>
        </div>
      </header>

      {/* CENTRO DE ESTADÍSTICAS */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center gap-4 shadow-2xl mb-8">
        <div>
          <h2 className="text-xl font-black uppercase italic text-blue-500">Centro de Estadísticas</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Consulta el rendimiento oficial</p>
        </div>
        <button onClick={() => navigate('/posiciones')} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-tighter shadow-lg shadow-blue-900/20 transition-all active:scale-95 flex items-center gap-3">
          📊 Ver Tabla de Posiciones
        </button>
      </div>

      {/* SECCIÓN DISCIPLINARIA PARA EL DELEGADO */}
      <div className="max-w-full mx-auto mb-8">
        <h3 className="text-xs font-black uppercase text-slate-500 mb-4 ml-4 tracking-widest">Avisos del Tribunal de Disciplina</h3>
        <div className="grid gap-4">
          {plantel.filter(j => j.estaSuspendida || j.tiene_deuda).map(j => (
            <div key={j.id} className="bg-rose-600/10 border border-rose-500/20 p-5 rounded-[2rem] flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-rose-600 rounded-full flex items-center justify-center font-black text-white">!</div>
                <div>
                  <p className="text-xs font-black uppercase">{j.apellido}, {j.nombre}</p>
                  <p className="text-[10px] text-rose-500 font-bold uppercase tracking-tighter">Sanción Vigente: {j.aclaracion_tribunal || "Inhabilitación en proceso"}</p>
                </div>
              </div>
              
              <button 
                onClick={() => generarPDFDictamenDelegado(j, configLiga)}
                className="bg-rose-600 hover:bg-rose-500 text-white px-6 py-3 rounded-xl text-[9px] font-black uppercase shadow-lg transition-all"
              >
                Descargar Dictamen Oficial ↓
              </button>
            </div>
          ))}
          {plantel.filter(j => j.estaSuspendida || j.tiene_deuda).length === 0 && (
            <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl text-center">
              <p className="text-[9px] text-emerald-500 font-black uppercase tracking-widest">✅ No hay jugadoras sancionadas en tu plantel</p>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'planilla' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl">
              <h2 className="text-xs font-black uppercase mb-4 text-slate-400 tracking-tighter">1. Próximo Encuentro</h2>
              <select id="jornada" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs font-bold text-white outline-none" onChange={(e) => setPartidoSeleccionado(e.target.value)}>
                <option value="">Elegir fecha...</option>
                {partidos.map(p => (
                  <option key={p.id} value={p.id}>Fecha {p.nro_fecha}: {p.local.nombre} vs {p.visitante.nombre}</option>
                ))}
              </select>
            </div>
            <div className="bg-blue-600/5 p-8 rounded-[2rem] border border-blue-500/20 text-center shadow-inner relative overflow-hidden">
               <div className="relative z-10">
                  <p className="text-[10px] text-blue-400 font-black uppercase mb-2">Jugadoras Citadas</p>
                  <span className="text-6xl font-black text-white">{seleccionadas.length}</span>
                  <button onClick={guardarPlanilla} className="w-full mt-8 bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all">ENVIAR PLANILLA</button>
               </div>
            </div>
          </div>
          <div className="lg:col-span-2 bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
             <h2 className="text-xs font-black uppercase mb-6 text-slate-400 flex justify-between">
                <span>2. Plantel Disponible</span>
                <span className="text-blue-500">{plantel.length} Jugadoras</span>
             </h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plantel.map(j => (
                  <div key={j.id} onClick={() => toggleJugadora(j)} className={`relative flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${j.estaSuspendida ? 'bg-red-950/20 border-red-900/30 opacity-60' : seleccionadas.includes(j.id) ? 'bg-blue-600/10 border-blue-500' : 'bg-slate-800/40 border-transparent hover:border-slate-700'}`}>
                    {editandoId === j.id ? (
                      <div className="flex-1 space-y-2" onClick={e => e.stopPropagation()}>
                        <input className="w-full bg-slate-950 text-[10px] p-2 rounded-lg border border-slate-700 text-white" value={datosEdicion.apellido} onChange={e => setDatosEdicion({...datosEdicion, apellido: e.target.value})} placeholder="Apellido" />
                        <div className="flex gap-2">
                           <button onClick={(e) => guardarActualizacion(e, j.id)} className="flex-1 bg-emerald-600 text-[9px] font-black py-2 rounded-lg uppercase">OK</button>
                           <button onClick={(e) => { e.stopPropagation(); setEditandoId(null); }} className="flex-1 bg-slate-700 text-[9px] font-black py-2 rounded-lg uppercase">X</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <img src={j.foto_url} className={`w-12 h-12 rounded-xl object-cover ${j.estaSuspendida ? 'grayscale border-2 border-red-600' : ''}`} alt="p" />
                        <div className="flex-1">
                          <p className={`font-black text-xs uppercase ${j.estaSuspendida ? 'text-red-500' : 'text-slate-100'}`}>{j.apellido}, {j.nombre.charAt(0)}.</p>
                          <p className="text-[9px] text-slate-500 font-bold uppercase">{j.estaSuspendida ? 'SUSPENDIDA' : `DNI: ${j.dni}`}</p>
                        </div>
                        {!j.estaSuspendida && <button onClick={(e) => iniciarEdicion(e, j)} className="p-2 hover:bg-slate-700 rounded-lg text-[10px]">✏️</button>}
                      </>
                    )}
                  </div>
                ))}
             </div>
          </div>
        </div>
      )}

      {activeTab === 'fichaje' && (
        <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-8 duration-500">
          {jugadoraRegistrada ? (
             <div className="flex flex-col items-center gap-6"><CarnetJugadora jugadora={jugadoraRegistrada} config={configLiga}/><button onClick={() => setJugadoraRegistrada(null)} className="bg-blue-600 text-white px-10 py-3 rounded-full font-black uppercase text-[10px]">Nuevo Fichaje</button></div>
          ) : (
            <div className="bg-slate-900 p-8 rounded-[3rem] border border-slate-800 shadow-2xl">
              <h2 className="text-xl font-black uppercase text-emerald-500 mb-6 italic">Fichaje Oficial</h2>
              <form onSubmit={manejarEnvioFichaje} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* INPUT NOMBRE */}
<input id="nombre"
  type="text" 
  placeholder="NOMBRE" 
  className="bg-slate-950 p-5 rounded-2xl border border-slate-800 text-xs font-bold uppercase outline-none focus:border-emerald-500" 
  value={datosFichaje.nombre}
  onChange={(e) => {
    // 1. Filtrar: Solo permite letras (incluyendo ñ y tildes) y espacios
    const val = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
    setDatosFichaje({...datosFichaje, nombre: val});
  }} 
  required 
/>

{/* INPUT APELLIDO */}
<input id="apellido"
  type="text" 
  placeholder="APELLIDO" 
  className="bg-slate-950 p-5 rounded-2xl border border-slate-800 text-xs font-bold uppercase outline-none focus:border-emerald-500" 
  value={datosFichaje.apellido}
  onChange={(e) => {
    // 1. Filtrar: Solo permite letras y espacios
    const val = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
    setDatosFichaje({...datosFichaje, apellido: val});
  }} 
  required 
/><input id="dni" type="text" maxLength="8" placeholder="DNI" value={datosFichaje.dni} onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, ''); // Elimina lo que no sea número
                  setDatosFichaje({...datosFichaje, dni: val});
                }} className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-bold"  required />
                <input id="fecha" type="date" placeholder="FECHA NACIMIENTO XX/XX/XXXX"className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-bold" onChange={e => setDatosFichaje({...datosFichaje, fecha_nacimiento: e.target.value})} required />
                 
                <div className="relative group">
  <label className="text-[9px] font-black uppercase text-slate-500 ml-2 mb-1 block tracking-widest">
    Club Asignado
  </label>
  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex items-center gap-3 shadow-inner">
    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
    <span className="text-xs font-black uppercase text-white tracking-tighter">
      {clubes.find(c => c.id === equipoIdActual)?.nombre || "Cargando Club..."}
    </span>
  </div>
  {/* Campo oculto para asegurar que el valor viaje en el formulario si fuera necesario */}
  <input type="hidden" value={equipoIdActual || ''} required />
</div>
                <div className="col-span-full grid grid-cols-2 gap-4">
                   <div className="space-y-2"><p className="text-[9px] font-black uppercase text-blue-500 ml-2 italic">Foto Carnet Actual</p><input type="file" className="w-full text-[10px] text-slate-500" onChange={e => setFilePerfil(e.target.files[0])} required /></div>
                   <div className="space-y-2"><p className="text-[9px] font-black uppercase text-emerald-500 ml-2 italic">Foto frente DNI </p><input type="file" className="w-full text-[10px] text-slate-500" onChange={e => setFileDNI(e.target.files[0])} required /></div>
                </div>
                <button disabled={cargandoFichaje} className={`col-span-full py-5 rounded-2xl font-black text-xs uppercase shadow-xl ${cargandoFichaje ? 'bg-slate-700 text-slate-500' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}>
                  {cargandoFichaje ? "PROCESANDO BIOMETRÍA..." : "VALIDAR Y GENERAR CREDENCIAL"}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {activeTab === 'disciplina' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-lg font-black uppercase italic text-rose-500">Expedientes Disciplinarios</h2>
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-[9px] font-bold text-slate-500 uppercase">
               Historial Reciente
            </div>
          </div>
          
          <div className="grid gap-4 max-w-5xl mx-auto">
            {expedientes.map(exp => {
              const esLocal = exp.partido.local_id === equipoIdActual;
              const descargoEnviado = esLocal ? exp.descargo_local : exp.descargo_visitante;

              return (
                <div key={exp.id} className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden group hover:border-rose-500/30 transition-all">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
                    <div className="space-y-1">
                      <span className="text-[9px] font-black bg-slate-800 px-4 py-1.5 rounded-full text-rose-500 border border-rose-500/20 uppercase tracking-widest">EXP. #{exp.id}</span>
                      <h3 className="text-xl font-black uppercase mt-4 italic">{exp.partido.local.nombre} <span className="text-slate-700 text-sm mx-1">VS</span> {exp.partido.visitante.nombre}</h3>
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tighter">Sujeto: <span className="text-blue-500">{exp.jugadora ? `${exp.jugadora.apellido} ${exp.jugadora.nombre}` : 'PERSONAL EXTRA-CAMPO'}</span></p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <span className={`text-[10px] font-black px-5 py-2 rounded-2xl uppercase shadow-lg ${exp.estado === 'pendiente' ? 'bg-amber-600 text-white' : 'bg-emerald-600 text-white'}`}>
                            {exp.estado === 'pendiente' ? '● En Proceso' : '● Dictaminado'}
                        </span>
                        <p className="text-[8px] font-black text-slate-700 uppercase">{new Date(exp.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                     <div className="bg-slate-950/50 p-6 rounded-[2rem] border border-slate-800 space-y-3">
                        <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Relato del Árbitro:</p>
                        <p className="text-xs text-slate-400 italic leading-relaxed">" {exp.motivo} "</p>
                     </div>

                     <div className="bg-slate-800/20 p-6 rounded-[2rem] border border-slate-800/50 space-y-4">
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Descargo de Mi Club:</p>
                        {exp.estado === 'pendiente' ? (
                          <>
                            {descargoEnviado ? (
                              <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl">
                                 <p className="text-[11px] text-emerald-400 font-medium italic">" {descargoEnviado} "</p>
                                 <p className="text-[8px] text-emerald-600 font-black uppercase mt-3">✓ Recibido por el tribunal</p>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <textarea id={`desc-${exp.id}`} placeholder="Escriba aquí los motivos o aclaraciones para que el Tribunal los considere..." className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white outline-none focus:border-rose-500 transition-all h-24" />
                                <button onClick={() => enviarDescargo(exp.id, document.getElementById(`desc-${exp.id}`).value, esLocal)} className="w-full bg-rose-600 hover:bg-rose-500 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Enviar Descargo Oficial</button>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="space-y-4">
                             <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
                                <p className="text-xs font-black uppercase text-slate-300 italic">{exp.aclaracion_tribunal || 'Sanción Confirmada'}</p>
                                <button onClick={() => descargarInformeSancion(exp)} className="bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase border border-blue-500/30 transition-all shadow-xl shadow-blue-900/40">📥 Informe PDF</button>
                             </div>
                          </div>
                        )}
                     </div>
                  </div>
                </div>
              );
            })}
            
            {expedientes.length === 0 && (
              <div className="py-24 text-center border-4 border-dashed border-slate-900 rounded-[4rem] space-y-4">
                <div className="text-5xl opacity-20 grayscale">⚖️</div>
                <p className="text-slate-700 font-black uppercase italic tracking-[0.4em]">Sin Expedientes Abiertos</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDelegado;