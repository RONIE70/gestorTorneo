import React, { useState, useEffect, useCallback } from 'react'; 
import { supabase } from '../supabaseClient';
import axios from 'axios';
import CarnetJugadora from '../components/CarnetJugadora'; 
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import EXIF from 'exif-js';
import * as faceapi from 'face-api.js';


// Borra la constante vieja y pon esta:
const URL_MODELOS = window.location.origin + '/models';

const AdminDelegado = () => {
  // --- ESTADOS DE SESIÓN Y PERFIL ---
  const [errorDni, setErrorDni] = useState(""); // Estado para el mensaje de error
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

  // eslint-disable-next-line no-unused-vars
  const [loadingSession, setLoadingSession] = useState(true);
  const [datosFichaje, setDatosFichaje] = useState({ 
    nombre: '', apellido: '', dni: '', fecha_nacimiento: '', equipo_id: '', club_nombre: '', club_escudo: ''   
  });
  const [logoBase64, setLogoBase64] = useState(null);
  


const fetchData = useCallback(async () => {
  setLoadingSession(true);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      // setUserRol('publico'); <--- BORRÁ ESTO
      setLoadingSession(false);
      return;
    }

    const { data: perfil, error: perfilError } = await supabase
      .from('perfiles')
      .select('organizacion_id, equipo_id, rol')
      .eq('id', session.user.id)
      .single();

    if (perfilError || !perfil) {
      // setUserRol('publico'); <--- BORRÁ ESTO
      setLoadingSession(false);
      return;
    }

    setPerfilUsuario(perfil);

    // ID de filtrado blindado
    const idParaFiltrar = perfil.rol === 'superadmin' ? (perfil.equipo_id || 4) : (perfil.equipo_id || 0);
    setEquipoIdActual(idParaFiltrar);

    // 1. Cargar Configuración (Logo y Nombre)
    const { data: config } = await supabase
      .from('configuracion_liga')
      .select('*')
      .eq('organizacion_id', perfil.organizacion_id)
      .single();
    
    if (config) {
        setConfigLiga(config);
        if (config.logo_url) {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0);
                    setLogoBase64(canvas.toDataURL('image/png'));
                }
            };
            img.src = config.logo_url;
        }
    }

    if (idParaFiltrar !== 0) {
      // 2. Cargar Plantel
      const { data: jugadorasData } = await supabase
        .from('jugadoras')
        .select(`*, sanciones(id, motivo, estado)`)
        .eq('organizacion_id', perfil.organizacion_id)
        .eq('equipo_id', idParaFiltrar);
      
      setPlantel(jugadorasData?.map(j => ({
        ...j,
        estaSuspendida: j.sanciones?.some(s => s.estado === 'cumpliendo') || j.sancionada === true
      })) || []);

      // 3. Cargar Expedientes
      const { data: sancData } = await supabase
        .from('sanciones')
        .select(`
          *,
          jugadora:jugadoras!inner(nombre, apellido, dni, equipo_id, organizacion_id),
          partido:partidos(
            nro_fecha, 
            local:equipos!local_id(nombre), 
            visitante:equipos!visitante_id(nombre)
          )
        `)
        .eq('jugadora.equipo_id', idParaFiltrar)
        .order('created_at', { ascending: false });
      
      setExpedientes(sancData || []);

      // 4. Cargar Partidos
      const { data: partidosData } = await supabase
        .from('partidos')
        .select('*, local:equipos!local_id(nombre), visitante:equipos!visitante_id(nombre)')
        .or(`local_id.eq.${idParaFiltrar},visitante_id.eq.${idParaFiltrar}`)
        .eq('organizacion_id', perfil.organizacion_id)
        .eq('finalizado', false); 
      setPartidos(partidosData || []);
    }

    // 5. Clubes siempre se cargan
    const { data: clubesData } = await supabase
      .from('equipos')
      .select('*')
      .eq('organizacion_id', perfil.organizacion_id)
      .order('nombre');
    setClubes(clubesData || []);

  } catch (error) {
    console.error("Error en fetchData:", error);
  } finally {
    setLoadingSession(false);
  }
  // ELIMINAMOS LAS DEPENDENCIAS QUE DAN ERROR
}, []);

  // --- AGREGAMOS ESTA PIEZA QUE FALTA: CARGA DE MODELOS IA ---
  useEffect(() => {
    const cargarModelosIA = async () => {
        try {
            console.log("Intentando cargar modelos desde:", URL_MODELOS);
            //const MODEL_URL = '/models';
            // Verificamos que faceapi esté disponible
            //await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
            await faceapi.nets.faceLandmark68Net.loadFromUri(URL_MODELOS);
            await faceapi.nets.faceRecognitionNet.loadFromUri(URL_MODELOS);
            await faceapi.nets.tinyFaceDetector.loadFromUri(URL_MODELOS);
            
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
    const pageWidth = doc.internal.pageSize.getWidth();

    // --- 1. ENCABEZADO ESTILO PREMIUM ---
    doc.setFillColor(30, 41, 59); // Color Slate-800
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    // Inserción de Logo Dinámico
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', 15, 10, 25, 25);
      // eslint-disable-next-line no-unused-vars
      } catch (e) {
        doc.setFillColor(217, 0, 130); // Rosa de respaldo
        doc.ellipse(27, 22, 12, 12, 'F');
      }
    } else {
      doc.setFillColor(217, 0, 130);
      doc.ellipse(27, 22, 12, 12, 'F'); 
    }
    
    // Títulos del Encabezado
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(config?.nombre_liga?.toUpperCase() || "LIGA OFICIAL", 105, 20, { align: 'center' });
    
    
    doc.setFontSize(12);
    doc.setTextColor(217, 0, 130); // Rosa fuerte
    doc.text("NOTIFICACIÓN DE SANCIÓN VIGENTE", 105, 28, { align: 'center' });
    
    doc.setFontSize(8);
    doc.setTextColor(200, 200, 200);
    doc.text(`Expediente Electrónico Tribunal | Fecha de Emisión: ${new Date().toLocaleDateString()}`, 105, 36, { align: 'center' });

    // --- 2. CUERPO DE DATOS PRINCIPALES ---
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("DATOS DE LA JUGADORA INHABILITADA:", 20, 60);
    doc.line(20, 62, 190, 62);

    doc.setFont("helvetica", "normal");
    doc.text(`APELLIDO Y NOMBRE: ${jugadora.apellido}, ${jugadora.nombre}`, 20, 75);
    doc.text(`DOCUMENTO (DNI): ${jugadora.dni || 'N/A'}`, 20, 85);
    doc.text(`CLUB PERTENECIENTE: ${clubes.find(c => c.id === equipoIdActual)?.nombre || 'S/D'}`, 20, 95);

    // Recuadro de Estado
    doc.setFillColor(254, 242, 242); // Rojo muy claro
    doc.setDrawColor(239, 68, 68); // Rojo borde
    doc.rect(20, 105, 170, 25, 'FD');
    
    doc.setTextColor(185, 28, 28); // Rojo oscuro
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("ESTADO: INHABILITADA PARA COMPETIR", 105, 121, { align: 'center' });

    // --- 3. RESOLUCIÓN DEL TRIBUNAL ---
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("FUNDAMENTOS DE LA SANCIÓN:", 20, 150);
    
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    const motivo = jugadora.aclaracion_tribunal || "Sanción aplicada por el Tribunal de Disciplina según informe arbitral. La jugadora no podrá participar de encuentros oficiales hasta cumplir la totalidad de la pena o recibir amnistía.";
    const lineasMotivo = doc.splitTextToSize(motivo, 160);
    doc.text(lineasMotivo, 25, 160);

    // --- 4. PIE DE PÁGINA, QR Y FIRMA ---
    // QR de validación (apunta a la verificación pública)
    const urlQR = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + "/verificar/" + jugadora.id)}`;
    try {
      doc.addImage(urlQR, 'PNG', 20, 245, 30, 30);
    // eslint-disable-next-line no-unused-vars
    } catch (err) {
      console.warn("QR no disponible");
    }

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Escanee el código para verificar la vigencia de esta sanción en tiempo real.", 55, 260);
    doc.text(`Identificador Único Org: ${perfilUsuario?.organizacion_id || 'N/A'}`, 55, 265);

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("__________________________", 140, 260);
    doc.text("Secretaría de Competencia", 142, 265);
    
    doc.save(`Dictamen_Oficial_${jugadora.apellido}.pdf`);
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
    return new Promise((resolve, reject) => { // Ahora sí lo usamos
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const escala = Math.min(400 / img.width, 400 / img.height, 1);
                canvas.width = img.width * escala;
                canvas.height = img.height * escala;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas);
            };
            img.onerror = () => reject("Error al cargar la imagen"); // Uso de reject
            img.src = e.target.result;
        };
        reader.onerror = () => reject("Error al leer el archivo"); // Uso de reject
        reader.readAsDataURL(archivo);
    });
};

const manejarEnvioFichaje = async (e) => {
    e.preventDefault();
    
    // 1. Validaciones iniciales
    if (!equipoIdActual || !filePerfil || !fileDNI) return alert("⚠️ Faltan datos obligatorios");
    
    if (!faceapi.nets.tinyFaceDetector.params) {
        return alert("⏳ La IA todavía se está cargando. Espera un segundo e intenta de nuevo.");
    }

    setCargandoFichaje(true); // Usamos tu estado de carga

    try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        // 2. Análisis Forense e IA Biométrica
        const analisisPerfil = await analizarImagen(filePerfil);
        const analisisDNI = await analizarImagen(fileDNI);

        const imgPerfilLimpa = await preprocesarImagenIA(filePerfil);
        const imgDNILimpia = await preprocesarImagenIA(fileDNI);

        const opcionesIA = new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.3 });

        let distanciaFinal = 1.0; 
        let requiereRevisionBiometrica = false;

        const detPerfil = await faceapi.detectSingleFace(imgPerfilLimpa, opcionesIA).withFaceLandmarks().withFaceDescriptor();
        const detDNI = await faceapi.detectSingleFace(imgDNILimpia, opcionesIA).withFaceLandmarks().withFaceDescriptor();

        if (!detPerfil || !detDNI) {
            console.warn("IA no detectó rostro.");
            requiereRevisionBiometrica = true;
            distanciaFinal = 1.1; 
        } else {
            distanciaFinal = faceapi.euclideanDistance(detPerfil.descriptor, detDNI.descriptor);
            if (distanciaFinal > 0.6) {
                requiereRevisionBiometrica = true;
            }
        }

        // 3. Consolidación de motivos de sospecha
        const motivos = [
            requiereRevisionBiometrica ? "Fallo/Duda Biometría" : null,
            analisisPerfil.sospechosa ? `Perfil: ${analisisPerfil.motivo}` : null,
            analisisDNI.sospechosa ? `DNI: ${analisisDNI.motivo}` : null
        ].filter(Boolean).join(" | ");

        const esSospechosa = requiereRevisionBiometrica || analisisPerfil.sospechosa || analisisDNI.sospechosa;

        // 4. Preparación de FormData
        const formData = new FormData();
        formData.append('foto', filePerfil);
        formData.append('dni_foto', fileDNI);
        formData.append('nombre', datosFichaje.nombre);
        formData.append('apellido', datosFichaje.apellido);
        formData.append('dni', datosFichaje.dni);
        formData.append('fecha_nacimiento', datosFichaje.fecha_nacimiento);
        formData.append('organizacion_id', perfilUsuario?.organizacion_id);
        formData.append('equipo_id', equipoIdActual);
        formData.append('verificacion_manual', esSospechosa);
        formData.append('distancia_biometrica', distanciaFinal);
        formData.append('observaciones_ia', motivos || "Sin observaciones");

        // 5. Envío al Servidor
        const res = await axios.post(`${import.meta.env.VITE_API_URL}/fichar`, formData, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        }); 

        // 6. ÉXITO: EFECTOS Y LIMPIEZA
        if (res.status === 200 || res.status === 201) {
            const { mensaje } = res.data;

            // Alerta personalizada según sospecha
            if (esSospechosa) {
                alert(`⚠️ ATENCIÓN: ${mensaje}\n\nEl sistema detectó inconsistencias: (${motivos}). El administrador revisará el fichaje.`);
            } else {
                alert("✅ Fichaje completado y validado correctamente.");
            }

            // Reset de formulario
            setDatosFichaje({ nombre: '', apellido: '', dni: '', fecha_nacimiento: '' });
            setFilePerfil(null);
            setFileDNI(null);
            
            // Recargar datos (si tienes estas funciones)
            if (typeof fetchData === 'function') fetchData();
            if (typeof cargarJugadoras === 'function') fetchData();

        }

    } catch (err) { 
        console.error("Error en fichaje:", err);
        alert("🚨 Error: " + (err.response?.data?.error || err.message));
    } finally { 
        setCargandoFichaje(false); 
    }
};

// --- VALIDACIÓN PREVIA DE DNI ---
const verificarDniDuplicado = async (dni) => {
    if (dni.length < 7) {
        setErrorDni(""); 
        return;
    }
    
    try {
        const { data, error } = await supabase
            .from('jugadoras')
            .select('id, apellido, nombre')
            .eq('dni', dni)
            .eq('organizacion_id', perfilUsuario?.organizacion_id)
            .maybeSingle();

        if (data) {
            setErrorDni(`⚠️ Este DNI ya pertenece a ${data.apellido}, ${data.nombre}`);
            setDatosFichaje(prev => ({ ...prev, dni: '' })); // Opcional: limpiar si querés bloquear
        } else {
            setErrorDni(""); // Limpiar error si el DNI está libre
        }
        if (error) console.error("Error en validación DNI:", error);
    } catch (err) {
        console.error("Error inesperado:", err);
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
              <form id="formFicha"   onSubmit={manejarEnvioFichaje} className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
/>
<div className="flex flex-col gap-1">
  <input 
    id="dni" 
    type="text" 
    maxLength="8" 
    placeholder="DNI" 
    value={datosFichaje.dni} 
    onChange={(e) => {
      const val = e.target.value.replace(/\D/g, ''); 
      setDatosFichaje({...datosFichaje, dni: val});
      if (errorDni) setErrorDni(""); // Limpiar error mientras escribe de nuevo
    }} 
    onBlur={(e) => verificarDniDuplicado(e.target.value)} 
    className={`bg-slate-950 p-4 rounded-xl border ${errorDni ? 'border-rose-500' : 'border-slate-800'} text-xs font-bold transition-colors`} 
    required 
  />
  {/* EL CARTELITO ROJO */}
  {errorDni && (
    <span className="text-[9px] font-black text-rose-500 uppercase tracking-tighter ml-2 animate-pulse">
      {errorDni}
    </span>
  )}
</div>

 {/* INPUT FECHA NACIMIENTO - Restaurado */}
<div className="flex flex-col gap-1">
  <label for="nacimiento"  id="FechNac"  className="text-[9px] font-black uppercase text-slate-500 ml-2 mb-1 block tracking-widest">
    Fecha de Nacimiento
  </label>
  <input 
    id="nacimiento"
    type="date" 
    className="bg-slate-950 p-5 rounded-2xl border border-slate-800 text-xs font-bold uppercase outline-none focus:border-emerald-500 text-white" 
    value={datosFichaje.fecha_nacimiento}
    onChange={(e) => setDatosFichaje({...datosFichaje, fecha_nacimiento: e.target.value})} 
    required 
  />
</div>

  <div className="relative group">
  <label for="clubAsig"  id="clubAsig"  className="text-[9px] font-black uppercase text-slate-500 ml-2 mb-1 block tracking-widest">
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
                                <button onClick={() => generarPDFDictamenDelegado(exp.jugadora, configLiga)} className="bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase border border-blue-500/30 transition-all shadow-xl shadow-blue-900/40">📥 Informe PDF</button>
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