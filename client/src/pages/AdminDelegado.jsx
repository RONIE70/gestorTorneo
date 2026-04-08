import React, { useState, useEffect, useCallback, useMemo } from 'react'; 
import { supabase } from '../supabaseClient';
import axios from 'axios';
import CarnetJugadora from '../components/CarnetJugadora'; 
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import GestionDelegados from '../components/GestionDelegados';
// 1. Asegurrate de que esté justo después de los imports
import { 
  ViewColumnsIcon, 
  TableCellsIcon, 
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  IdentificationIcon 
} from '@heroicons/react/24/outline';


// --- ESTA ES LA LÍNEA QUE FALTA ---
const CATEGORIAS_OFICIALES = ['2011-2012', '2013-2014', '2015-2016', '2017-2018'];

const AdminDelegado = () => {
  // --- ESTADOS DE SESIÓN Y PERFIL ---
  const [errorDni, setErrorDni] = useState(""); // Estado para el mensaje de error
  const [perfilUsuario, setPerfilUsuario] = useState(null);
  const [equipoIdActual, setEquipoIdActual] = useState(null);
  //const [nombreCategoria, setNombreCategoria] = useState("Cargando...");
  

  // --- ESTADOS DE INTERFAZ ---
  const [activeTab, setActiveTab] = useState('planilla'); 
  const [plantel, setPlantel] = useState([]);
  const [partidos, setPartidos] = useState([]);
  const [clubes, setClubes] = useState([]); 
  const [partidoSeleccionado, setPartidoSeleccionado] = useState('');
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [expedientes, setExpedientes] = useState([]);
  const [configLiga, setConfigLiga] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [leyendoOCR, setLeyendoOCR] = useState(false);
  
  // Obtenemos las categorías únicas de la lista de partidos cargados
  //const categoriasDisponibles = [...new Set(partidos.map(p => p.categoria))].sort();

  const navigate = useNavigate();

  // --- ESTADOS DE EDICIÓN Y FICHAJE ---
  
  const [editandoId, setEditandoId] = useState(null);
  const [datosEdicion, setDatosEdicion] = useState({ nombre: '', apellido: '', dni: '', fecha_nacimiento: '', distancia_biometrica_oficial: '' });
  const [filePerfil, setFilePerfil] = useState(null);
  const [fileDNI, setFileDNI] = useState(null);
  const [jugadoraRegistrada, setJugadoraRegistrada] = useState(null);
  const [cargandoFichaje, setCargandoFichaje] = useState(false);

  const [filtroFechaPlanilla, setFiltroFechaPlanilla] = useState(1);
  const [filtroCatPlanilla, setFiltroCatPlanilla] = useState(""); 


  const [loadingSession, setLoadingSession] = useState(true);
  const [cargandoPlantel, setCargandoPlantel] = useState(false);

  const [datosFichaje, setDatosFichaje] = useState({ 
    nombre: '', apellido: '', dni: '', fecha_nacimiento: '', equipo_id: '', club_nombre: '', club_escudo: ''   
  });
  const [logoBase64, setLogoBase64] = useState(null);

  // --- 2. NUEVOS ESTADOS DE CONTROL ---
  const [matchupActual, setMatchupActual] = useState(null);
  const [categoriaSelCred, setCategoriaSelCred] = useState('TODAS');
  const [vistaCred, setVistaCred] = useState('credencial');

  // --- 3. LÓGICA DE FILTRADO (MEMOS) ---
  
  // Agrupar partidos para que no se repitan en el Select de Jornada
  const crucesUnicos = useMemo(() => {
    const vistos = new Set();
    return partidos.filter(p => {
      const idCruce = `${p.nro_fecha}-${p.local_id}-${p.visitante_id}`;
      if (vistos.has(idCruce)) return false;
      vistos.add(idCruce);
      return true;
    });
  }, [partidos]);

  // Obtener categorías del cruce seleccionado
  const categoriasDelCruce = useMemo(() => {
    if (!matchupActual) return [];
    return partidos
      .filter(p => 
        p.nro_fecha === matchupActual.nro_fecha && 
        p.local_id === matchupActual.local_id && 
        p.visitante_id === matchupActual.visitante_id
      )
      .map(p => p.categoria)
      .sort();
  }, [partidos, matchupActual]);

  // Contadores y Alertas para Credenciales
  const statsCred = useMemo(() => {
    const data = {
      conteos: { 'TODAS': plantel.length },
      alertas: { 'TODAS': false }
    };
    CATEGORIAS_OFICIALES.forEach(cat => {
      data.conteos[cat] = 0;
      data.alertas[cat] = false;
    });
    plantel.forEach(j => {
      const catKey = j.categoria_actual || j.categoria;
      if (catKey && Object.hasOwn(data.conteos, catKey)) {
        data.conteos[catKey]++;
        if (j.verificacion_biometrica_estado !== 'aprobado') {
          data.alertas[catKey] = true;
          data.alertas['TODAS'] = true;
        }
      }
    });
    return data;
  }, [plantel]);

  const jugadorasFiltradasCred = useMemo(() => {
    if (categoriaSelCred === 'TODAS') return plantel;
    return plantel.filter(j => (j.categoria_actual || j.categoria) === categoriaSelCred);
  }, [plantel, categoriaSelCred]);
  


const fetchData = useCallback(async () => {
  setLoadingSession(true);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      setLoadingSession(false);
      return;
    }

    // 1. Obtener Perfil del usuario
    const { data: perfil, error: perfilError } = await supabase
      .from('perfiles')
      .select('organizacion_id, equipo_id, rol')
      .eq('id', session.user.id)
      .maybeSingle();

    if (perfilError || !perfil) {
      setLoadingSession(false);
      return;
    }

    setPerfilUsuario(perfil);
    const userOrgId = perfil.organizacion_id;

    // --- LÓGICA DE FILTRADO PARA FICHAR (Admin vs Delegado) ---
    let idParaFiltrar = 0;
    if (perfil.rol === 'delegado') {
      idParaFiltrar = perfil.equipo_id;
      setEquipoIdActual(perfil.equipo_id);
    } else {
      idParaFiltrar = 0; 
      setEquipoIdActual(null); // Obliga al Admin a usar el SELECT
    }

    // 2. CARGAR CONFIGURACIÓN O DATOS BÁSICOS
    const { data: config } = await supabase
      .from('configuracion_liga')
      .select('*')
      .eq('organizacion_id', userOrgId)
      .maybeSingle();
    
    if (config) {
        setConfigLiga(config);
        if (config.logo_url) {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width; canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) { ctx.drawImage(img, 0, 0); setLogoBase64(canvas.toDataURL('image/png')); }
            };
            img.src = config.logo_url;
        }
    } else {
        const { data: orgData, error: orgError } = await supabase
          .from('organizaciones')
          .select('nombre, logo_url')
          .eq('id', userOrgId)
          .maybeSingle();

        if (orgError) console.error("Error en organizaciones:", orgError.message);

        if (orgData) {
            setConfigLiga({
                nombre_liga: orgData.nombre,
                logo_url: orgData.logo_url
            });
        }
    }

    // --- RESTAURACIÓN DE PARTIDOS, EXPEDIENTES Y PLANTEL ---
    // Solo cargamos si hay un equipo asignado (Delegado)
    if (idParaFiltrar && idParaFiltrar !== 0) {
      
      // A. Cargar Plantel
      const { data: jugadorasData, error: errorPlantel } = await supabase
    .from('jugadoras')
    .select(`
      *, 
      sanciones(id, motivo, estado),
      equipos!equipo_id (id, nombre, escudo_url)
    `) // !equipo_id le dice a Supabase qué columna usar para el JOIN
    .eq('organizacion_id', userOrgId)
    .eq('equipo_id', idParaFiltrar);

  if (errorPlantel) {
    console.error("Error 400 en Plantel:", errorPlantel.message);
    setPlantel([]);
  } else {
      
      
      setPlantel(jugadorasData?.map(j => ({
        ...j,
        estaSuspendida: j.sanciones?.some(s => s.estado === 'cumpliendo') || j.sancionada === true
      })) || []);
    }
      // B. Cargar Expedientes (Sanciones) - RESTAURADO
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

      // C. Cargar Partidos - RESTAURADO
      const { data: partidosData } = await supabase
        .from('partidos')
        .select('*, local:equipos!local_id(nombre), visitante:equipos!visitante_id(nombre)')
        .or(`local_id.eq.${idParaFiltrar},visitante_id.eq.${idParaFiltrar}`)
        .eq('organizacion_id', userOrgId)
        .eq('finalizado', false); 
      setPartidos(partidosData || []);
    }

    // 3. CLUBES (Siempre cargamos para el Select del Admin)
    const { data: clubesData } = await supabase
      .from('equipos')
      .select('*')
      .eq('organizacion_id', userOrgId)
      .order('nombre');
    setClubes(clubesData || []);

  } catch (error) {
    console.error("Error en fetchData:", error);
  } finally {
    setLoadingSession(false);
  }
}, []);

  useEffect(() => { 
    fetchData(); 
  }, [fetchData]);

  useEffect(() => {
    const actualizarPlantelDinamico = async () => {
      if (!partidoSeleccionado) return;
      const partidoInfo = partidos.find(p => p.id === parseInt(partidoSeleccionado));
      if (!partidoInfo) return;

      setCargandoPlantel(true); 
      try {
        const { data: jugadorasData, error } = await supabase
          .from('jugadoras')
          .select(`*, sanciones(id, motivo, estado)`)
          .eq('equipo_id', equipoIdActual)
          .ilike('categoria_actual', partidoInfo.categoria);

        if (!error) {
          setPlantel(jugadorasData?.map(j => ({
            ...j,
            estaSuspendida: j.sanciones?.some(s => s.estado === 'cumpliendo') || j.sancionada === true,
            club_nombre: j.equipos?.nombre || 'S/D',
            club_escudo: j.equipos?.escudo_url || null
          })) || []);
        }
      } finally {
        setCargandoPlantel(false); 
      }
    };
    actualizarPlantelDinamico();
  }, [partidoSeleccionado, partidos, equipoIdActual]);


  useEffect(() => {
    if (partidoSeleccionado) {
      const partidoInfo = partidos.find(p => p.id === parseInt(partidoSeleccionado));
      if (partidoInfo) {
        setFiltroFechaPlanilla(partidoInfo.nro_fecha);
        setFiltroCatPlanilla(partidoInfo.categoria);
      }
    }
  }, [partidoSeleccionado, partidos]);


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
   // --- 4. PIE DE PÁGINA, QR Y FIRMA ---
// Agregamos el /#/ justo antes de "verificar"
const urlQR = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + "/#/verificar/" + jugadora.id)}`;
// Usamos una técnica de precarga para evitar que el 404 rompa el PDF
const imgQR = new Image();
imgQR.crossOrigin = "Anonymous";
imgQR.src = urlQR;

imgQR.onload = () => {
    try {
        doc.addImage(imgQR, 'PNG', 20, 245, 30, 30);
    // eslint-disable-next-line no-unused-vars
    } catch (e) {
        console.warn("No se pudo añadir el QR al PDF");
    }
    finalizarYGuardar();
};

imgQR.onerror = () => {
    console.warn("Error 404 o CORS al traer el QR");
    finalizarYGuardar();
};

// Función auxiliar para no repetir código
const finalizarYGuardar = () => {
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Escanee el código para verificar la vigencia de esta sanción en tiempo real.", 55, 260);
    doc.save(`Dictamen_Oficial_${jugadora.apellido}.pdf`);
};

// Si por alguna razón la imagen tarda demasiado, lanzamos el guardado igual a los 2 segundos
setTimeout(() => {
    if (doc.internal.pages.length > 0) finalizarYGuardar();
}, 2000);

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
  
const manejarEnvioFichaje = async (e) => {
    e.preventDefault();
    
    // 1. MODIFICACIÓN: Validación inteligente según Rol
    // El admin debe haber seleccionado un club en el <select> (equipoIdActual)
    if (!equipoIdActual || equipoIdActual === 0 || !filePerfil || !fileDNI) {
        return alert("⚠️ Debes seleccionar un CLUB, cargar ambas fotos y completar los datos antes de enviar.");
    }
    
    if (errorDni) {
        return alert("⚠️ No puedes continuar: el DNI ingresado ya existe en la base de datos.");
    }

    if (datosFichaje.dni.length < 7) return alert("⚠️ El DNI es demasiado corto.");

    setCargandoFichaje(true);

    try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const formData = new FormData();
        formData.append('foto', filePerfil);
        formData.append('dni_foto', fileDNI);
        formData.append('nombre', datosFichaje.nombre);
        formData.append('apellido', datosFichaje.apellido);
        formData.append('dni', datosFichaje.dni);
        formData.append('fecha_nacimiento', datosFichaje.fecha_nacimiento);
        
        // El organizacion_id siempre viene del perfil del que está logueado (Liga de las Nenas)
        formData.append('organizacion_id', perfilUsuario?.organizacion_id);
        
        // El equipo_id ahora es dinámico: 
        // Si eres delegado, equipoIdActual ya tiene tu club.
        // Si eres Admin, equipoIdActual tiene el valor del <select> que elegiste.
        formData.append('equipo_id', equipoIdActual); 
        
        formData.append('verificacion_manual', true); 
        formData.append('distancia_biometrica_oficial', 0);
        formData.append('observaciones_ia', "Pendiente de validación biométrica en PC");

        const res = await axios.post(`${import.meta.env.VITE_API_URL}/fichar`, formData, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        }); 

        if (res.status === 200 || res.status === 201) {
            alert("🚀 Fichaje enviado con éxito.");

            // Buscamos el nombre del club localmente para no re-consultar
    const nombreClubSeleccionado = clubes.find(c => c.id === equipoIdActual)?.nombre;
    const escudoClubSeleccionado = clubes.find(c => c.id === equipoIdActual)?.escudo_url;

    const jugadoraConClub = {
        ...(res.data.jugadora || res.data),
        club_nombre: nombreClubSeleccionado,
        club_escudo: escudoClubSeleccionado,
        equipos: { nombre: nombreClubSeleccionado } // Para compatibilidad total
    };
            

            // Asegúrate de que el backend devuelva la jugadora correctamente
            setJugadoraRegistrada(jugadoraConClub);

            // Limpieza
            setDatosFichaje({ nombre: '', apellido: '', dni: '', fecha_nacimiento: '' });
            setFilePerfil(null);
            setFileDNI(null);
            setErrorDni("");
            
            // Si eres Admin, reseteamos el select para evitar fichajes accidentales en el mismo club
            if (perfilUsuario?.rol !== 'delegado') setEquipoIdActual(null);
            
            if (typeof fetchData === 'function') fetchData();
        }

    } catch (err) { 
        console.error("Error en servidor:", err);
        alert("🚨 Error: " + (err.response?.data?.error || "No se pudo conectar con el servidor"));
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


  // 2. Función para generar y descargar
 // --- LÓGICA DE PDF (FRONTEND MVP - DINÁMICO) ---
 // --- LÓGICA DE PDF (FRONTEND MVP - DINÁMICO) ---
 const handleDescargarPlanilla = async () => {
  if (!partidoSeleccionado) return alert("Selecciona un partido");

  // Función interna para determinar la categoría por año según la tabla de la DB
  const calcularCategoriaSaaS = (fechaNac, reglas) => {
    if (!fechaNac || !reglas || reglas.length === 0) return "S/D";
    const anioNac = new Date(fechaNac).getFullYear();
    const match = reglas.find(c => 
      anioNac >= c.año_desde && anioNac <= (c.año_hasta || anioNac)
    );
    return match ? match.nombre : "S/D";
  };

  setLoadingSession(true);
  try {
    // 1. Obtener datos del partido y su organización
    const { data: partido, error: pErr } = await supabase
      .from('partidos')
      .select('id, local_id, visitante_id, categoria, nro_fecha, organizacion_id')
      .eq('id', partidoSeleccionado)
      .single();

    if (pErr || !partido) throw new Error("Partido no encontrado");

    // 2. Obtener las reglas de categorías de esta organización (desde tu tabla 'categorias')
    const { data: reglasCategorias, error: catErr } = await supabase
      .from('categorias')
      .select('*')
      .eq('organizacion_id', partido.organizacion_id);

    if (catErr) throw catErr;

    // 3. Traer jugadoras de ambos equipos (incluyendo fecha_nacimiento para validar)
    const { data: localTodos, error: localErr } = await supabase
      .from('jugadoras')
      .select('nombre, apellido, dni, fecha_nacimiento')
      .eq('equipo_id', partido.local_id)
      .order('apellido');

    const { data: visitaTodos, error: visitaErr } = await supabase
      .from('jugadoras')
      .select('nombre, apellido, dni, fecha_nacimiento')
      .eq('equipo_id', partido.visitante_id)
      .order('apellido');

    if (localErr || visitaErr) throw new Error("Error cargando planteles");

    // 4. Filtrar jugadoras: Solo incluimos si su categoría por año coincide con la del partido
    const localP = (localTodos || []).filter(j => 
      calcularCategoriaSaaS(j.fecha_nacimiento, reglasCategorias) === partido.categoria
    );

    const visitaP = (visitaTodos || []).filter(j => 
      calcularCategoriaSaaS(j.fecha_nacimiento, reglasCategorias) === partido.categoria
    );

    // 5. Preparar objeto para el PDF con los nombres de los clubes
    const partidoParaPDF = {
      ...partido,
      local: { nombre: clubes.find(c => c.id === partido.local_id)?.nombre || "Local" },
      visitante: { nombre: clubes.find(c => c.id === partido.visitante_id)?.nombre || "Visitante" }
    };

    // 6. Generar el documento final
    generarPDF(partidoParaPDF, localP, visitaP);

  } catch (err) {
    console.error("Error detallado:", err.message);
    alert("No se pudo generar la planilla: " + err.message);
  } finally {
    setLoadingSession(false);
  }
 };

 const generarPDF = (partido, localPlayers, visitaPlayers) => {
  const doc = new jsPDF();
  const colorMagenta = [217, 0, 130]; 
  const nombreLiga = configLiga?.nombre_liga || "LIGA OFICIAL";

  // --- 1. ENCABEZADO Y LOGO ---
  if (logoBase64) {
    // eslint-disable-next-line no-unused-vars, no-empty
    try { doc.addImage(logoBase64, 'PNG', 14, 8, 22, 22); } catch (e) {}
  }

  doc.setFontSize(16);
  doc.setTextColor(...colorMagenta);
  doc.setFont("helvetica", "bold");
  doc.text(`${nombreLiga.toUpperCase()}`, 105, 15, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("PLANILLA DE JUEGO OFICIAL", 105, 21, { align: 'center' });

  // Información del Encuentro
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0); // Texto negro para impresión
  doc.text(`FECHA NRO: ${partido.nro_fecha}`, 45, 30);
  doc.text(`FECHA REAL: ${partido.fecha_calendario || ' / / '}`, 85, 30);
  doc.text(`CATEGORÍA: ${partido.categoria.toUpperCase()}`, 130, 30);
  doc.text(`ZONA: ${partido.zona || '---'}`, 175, 30);
  
  doc.setDrawColor(0); // Líneas negras
  doc.line(14, 33, 196, 33); 

  // --- 2. CONFIGURACIÓN DE TABLAS JUGADORAS ---
  const configuracionTabla = {
    theme: 'grid',
    headStyles: { fillColor: [240, 240, 240], textColor: 0, fontSize: 8, fontStyle: 'bold', halign: 'center' },
    styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0] }, // Bordes negros
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },   // N°
      1: { cellWidth: 70 },                    // Nombre y Apellido
      2: { cellWidth: 25, halign: 'center' },  // DNI
      3: { cellWidth: 45 },                    // FIRMA JUGADORA
      4: { cellWidth: 15, halign: 'center' },  // GOLES
      5: { cellWidth: 10, halign: 'center' },  // A
      6: { cellWidth: 10, halign: 'center' }   // R
    }
  };

  // --- FUNCIÓN PARA DIBUJAR FALTAS Y CONTROL DISCIPLINARIO ---
  const drawControlesGlobales = (startX, startY) => {
    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.setDrawColor(0);
    
    // Faltas Horizontales
    doc.text("FALTAS 1T:", startX, startY);
    for (let i = 0; i < 5; i++) doc.rect(startX + 18 + (i * 6), startY - 3.5, 4.5, 4.5);

    doc.text("FALTAS 2T:", startX + 55, startY);
    for (let i = 0; i < 5; i++) doc.rect(startX + 73 + (i * 6), startY - 3.5, 4.5, 4.5);

    // Expulsión J, D, P
    doc.text("EXPULSIÓN: J", startX + 110, startY);
    doc.rect(startX + 130, startY - 3.5, 4.5, 4.5);
    doc.text("D", startX + 137, startY);
    doc.rect(startX + 141, startY - 3.5, 4.5, 4.5);
    doc.text("P", startX + 148, startY);
    doc.rect(startX + 152, startY - 3.5, 4.5, 4.5);

    // Informe
    doc.text("INFORME:", startX + 162, startY);
    doc.rect(startX + 178, startY - 3.5, 4.5, 4.5);
  };

  // --- TABLA LOCAL ---
  doc.setFontSize(11);
  doc.setTextColor(...colorMagenta);
  doc.text(`LOCAL: ${partido.local.nombre}`, 14, 42);
  
  autoTable(doc, {
    ...configuracionTabla,
    startY: 45,
    head: [['N°', 'NOMBRE Y APELLIDO', 'DNI', 'FIRMA JUGADORA', 'GOLES', 'A', 'R']],
    body: localPlayers.map((j, i) => [i + 1, j.apellido.toUpperCase() + " " + j.nombre, j.dni, "", "", "", ""]),
  });

  let currentY = doc.lastAutoTable.finalY + 8;
  drawControlesGlobales(14, currentY);

  // --- TABLA VISITANTE ---
  currentY += 12;
  doc.setFontSize(11);
  doc.text(`VISITA: ${partido.visitante.nombre}`, 14, currentY);
  
  autoTable(doc, {
    ...configuracionTabla,
    startY: currentY + 3,
    head: [['N°', 'NOMBRE Y APELLIDO', 'DNI', 'FIRMA JUGADORA', 'GOLES', 'A', 'R']],
    body: visitaPlayers.map((j, i) => [i + 1, j.apellido.toUpperCase() + " " + j.nombre, j.dni, "", "", "", ""]),
  });

  currentY = doc.lastAutoTable.finalY + 8;
  drawControlesGlobales(14, currentY);

  // --- 3. CUADRO DE RESULTADOS ESTILO EXCEL (AJUSTADO) ---
  const resY = 255;
  doc.setDrawColor(0);
  doc.setLineWidth(0.4);
  
  // Encabezado (Más estrecho para evitar solapamiento)
  const tableWidth = 63; // Ancho total reducido de 80 a 70
  doc.setFillColor(240, 240, 240);
  doc.rect(14, resY, tableWidth, 8, 'FD'); 
  doc.setFontSize(8);
  doc.setTextColor(0);
  doc.text("TABLA DE RESULTADOS FINALES", 14 + (tableWidth / 2), resY + 5.5, { align: 'center' });

  // Función para filas ajustadas
  const drawExcelRow = (x, y, label) => {
    doc.setLineWidth(0.2);
    doc.rect(x, y, 45, 10); // Celda Nombre reducida de 55 a 50
    doc.rect(x + 45, y, 18, 10); // Celda Score reducida de 25 a 20
    doc.setFont("helvetica", "bold");
    doc.text(label, x + 2, y + 6.5);
  };

  drawExcelRow(14, resY + 8, `LOC: ${partido.local.nombre.substring(0, 15)}`);
  drawExcelRow(14, resY + 18, `VIS: ${partido.visitante.nombre.substring(0, 15)}`);

  // --- 4. FIRMAS FINALES (Líneas Negras) ---
  doc.setFontSize(7);
  doc.setDrawColor(0);
  const lineY = 285;
  
  doc.line(80, lineY, 110, lineY);
  doc.text("FIRMA ÁRBITRO", 95, lineY + 4, { align: 'center' });

  doc.line(125, lineY, 155, lineY);
  doc.text("FIRMA DEL. LOCAL", 140, lineY + 4, { align: 'center' });

  doc.line(170, lineY, 200, lineY);
  doc.text("FIRMA DEL. VISITA", 185, lineY + 4, { align: 'center' });

  doc.save(`Planilla_${partido.local.nombre}_vs_${partido.visitante.nombre}.pdf`);
 };

    // --- RENDER DE CARGA ---
    if (loadingSession) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="font-black uppercase italic animate-pulse">Cargando datos oficiales...</p>
                </div>
            </div>
        );
    }

  
  const iniciarEdicion = (e, j) => {
    e.stopPropagation();
    setEditandoId(j.id);
    setDatosEdicion({ nombre: j.nombre, apellido: j.apellido, dni: j.dni, distancia_biometrica_oficial: j.distancia_biometrica_oficial, fecha_nacimiento: j.fecha_nacimiento });
  };

  const guardarActualizacion = async (e, id) => {
    e.stopPropagation();
    const { error } = await supabase.from('jugadoras').update(datosEdicion).eq('id', id);
    if (!error) { setEditandoId(null); fetchData(); }
  };

  // --- NUEVA FUNCIÓN PARA SELECCIONAR TODAS ---
const toggleSeleccionarTodas = () => {
  // Filtramos solo las jugadoras que NO están suspendidas
  const jugadorasHabilitadas = plantel.filter(j => !j.estaSuspendida).map(j => j.id);

  // Si ya están todas seleccionadas, las desmarcamos (limpiamos el array)
  if (seleccionadas.length === jugadorasHabilitadas.length) {
    setSeleccionadas([]);
  } else {
    // Si no, metemos todos los IDs habilitados de una vez
    setSeleccionadas(jugadorasHabilitadas);
  }
};

// --- 5. HANDLERS DE SELECCIÓN DE CRUCES ---
  const handleMatchupChange = (id) => {
    const p = partidos.find(part => part.id === parseInt(id));
    if (p) {
      setMatchupActual({ nro_fecha: p.nro_fecha, local_id: p.local_id, visitante_id: p.visitante_id });
      setPartidoSeleccionado(id);
      setFiltroFechaPlanilla(p.nro_fecha);
      setFiltroCatPlanilla(p.categoria);
    }
  };

  const handleCategoryChange = (cat) => {
    setFiltroCatPlanilla(cat);
    const partidoReal = partidos.find(p => 
      p.nro_fecha === matchupActual.nro_fecha && 
      p.local_id === matchupActual.local_id && 
      p.visitante_id === matchupActual.visitante_id && 
      p.categoria === cat
    );
    if (partidoReal) setPartidoSeleccionado(partidoReal.id.toString());
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
          <button onClick={() => setActiveTab('delegados')} className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all ${activeTab === 'delegados' ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>👔 DELEGADOS</button>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
          
          {/* COLUMNA 1: SELECCIÓN JORNADA */}
          <div className="space-y-6">
            <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl h-full">
              <h2 className="text-xs font-black uppercase mb-6 text-blue-500 flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-600/20 rounded-full flex items-center justify-center text-[10px]">1</span>
                Seleccionar Jornada
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-bold ml-2">Próximo Partido</label>
                  <select 
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs font-bold text-white outline-none mt-1 focus:border-blue-500" 
                    onChange={(e) => handleMatchupChange(e.target.value)}
                    value={matchupActual ? (partidos.find(p => p.nro_fecha === matchupActual.nro_fecha && p.local_id === matchupActual.local_id)?.id || "") : ""}
                  >
                    <option value="">Elegir fecha...</option>
                    {crucesUnicos.map(p => (
                      <option key={p.id} value={p.id}>Fecha {p.nro_fecha}: {p.local.nombre} vs {p.visitante.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="pt-4 border-t border-slate-800">
                  <label className="text-[10px] text-slate-500 uppercase font-bold ml-2">Bloque / Categoría</label>
                  <div className="flex gap-2 mt-2">
                    <input type="number" value={filtroFechaPlanilla} readOnly className="w-16 bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white opacity-50" />
                    <select 
                      value={filtroCatPlanilla} 
                      onChange={e => handleCategoryChange(e.target.value)} 
                      disabled={!matchupActual}
                      className="flex-1 bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white outline-none focus:border-emerald-500"
                    >
                      <option value="">Categoría...</option>
                      {categoriasDelCruce.map(cat => (
                        <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* BOTÓN RÁPIDO A CREDENCIALES */}
                <div className="pt-6 border-t border-slate-800">
                  <button 
                    onClick={() => setActiveTab('credenciales')}
                    className="w-full bg-slate-800 hover:bg-slate-700 p-4 rounded-2xl flex items-center justify-between group transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-600/20 rounded-xl group-hover:bg-blue-600 transition-colors">
                        <IdentificationIcon className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-black uppercase text-white leading-none">Ver Credenciales</p>
                        <p className="text-[8px] font-bold text-slate-500 uppercase mt-1">Frente de Carnets</p>
                      </div>
                    </div>
                    <span className="text-slate-600">→</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* COLUMNA 2: CITACIONES (CON SOPORTE PARA EDICIÓN) */}
 <div className="lg:col-span-1 space-y-6">
  <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl h-full relative overflow-hidden">
    <h2 className="text-xs font-black uppercase mb-6 text-emerald-500 flex items-center justify-between">
      {/* NUEVO: BOTÓN / CHECKBOX SELECCIONAR TODAS */}
{!cargandoPlantel && plantel.length > 0 && (
  <div 
    onClick={toggleSeleccionarTodas}
    className="mb-4 flex items-center gap-3 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 cursor-pointer hover:bg-slate-800 transition-all group"
  >
    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
      seleccionadas.length === plantel.filter(j => !j.estaSuspendida).length && plantel.length > 0
        ? 'bg-emerald-500 border-emerald-500' 
        : 'border-slate-600 group-hover:border-emerald-500'
    }`}>
      {seleccionadas.length === plantel.filter(j => !j.estaSuspendida).length && (
        <span className="text-[10px] text-white">✓</span>
      )}
    </div>
    <span className="text-[10px] font-black uppercase text-slate-400 group-hover:text-white tracking-widest">
      {seleccionadas.length === plantel.filter(j => !j.estaSuspendida).length 
        ? 'Desmarcar todas' 
        : 'Citar a todas'}
    </span>
  </div>
)}
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 bg-emerald-600/20 rounded-full flex items-center justify-center text-[10px]">2</span>
        Citación de Jugadoras
      </div>
      {!cargandoPlantel && <span className="text-[10px] text-slate-500">{plantel.length} Total</span>}
    </h2>
    
    <div className="grid grid-cols-1 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
      {cargandoPlantel ? (
        <div className="flex flex-col items-center py-20 gap-4">
          <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
          <p className="text-[10px] text-slate-500 font-black animate-pulse uppercase">Sincronizando...</p>
        </div>
      ) : plantel.map(j => (
        <div 
          key={j.id} 
          onClick={() => toggleJugadora(j)} 
          className={`relative flex flex-col p-4 rounded-2xl border-2 transition-all cursor-pointer ${
            j.estaSuspendida ? 'bg-red-950/20 border-red-900/30 opacity-60' : 
            seleccionadas.includes(j.id) ? 'bg-emerald-600/10 border-emerald-500' : 
            'bg-slate-800/40 border-transparent hover:border-slate-700'
          }`}
        >
          {/* MODO EDICIÓN ACTIVO */}
          {editandoId === j.id ? (
            <div className="space-y-2 w-full" onClick={e => e.stopPropagation()}>
              <input 
                className="w-full bg-slate-950 text-[10px] p-2 rounded-lg border border-slate-700 text-white uppercase" 
                value={datosEdicion.apellido} 
                onChange={e => setDatosEdicion({...datosEdicion, apellido: e.target.value})} 
                placeholder="APELLIDO" 
              />
              <div className="flex gap-2">
                <button 
                  onClick={(e) => guardarActualizacion(e, j.id)} 
                  className="flex-1 bg-emerald-600 text-[9px] font-black py-2 rounded-lg uppercase text-white"
                >
                  Guardar
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setEditandoId(null); }} 
                  className="flex-1 bg-slate-700 text-[9px] font-black py-2 rounded-lg uppercase text-white"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            /* VISTA NORMAL */
            <div className="flex items-center gap-4 w-full">
              <img src={j.foto_url} className="w-10 h-10 rounded-xl object-cover shadow-lg" alt="p" />
              <div className="flex-1">
                <p className={`font-black text-[10px] uppercase ${j.estaSuspendida ? 'text-red-500' : 'text-slate-100'}`}>
                  {j.apellido}, {j.nombre.charAt(0)}.
                </p>
                <p className="text-[8px] text-slate-500 font-bold uppercase">
                  {j.estaSuspendida ? 'SUSPENDIDA' : `DNI: ${j.dni}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!j.estaSuspendida && (
                  <button 
                    onClick={(e) => iniciarEdicion(e, j)} 
                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-[10px] transition-colors"
                  >
                    ✏️
                  </button>
                )}
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  seleccionadas.includes(j.id) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-700'
                }`}>
                  {seleccionadas.includes(j.id) && <span className="text-[10px] text-white">✓</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
 </div>
          {/* COLUMNA 3: ENVÍO Y DESCARGA */}
          <div className="space-y-6">
            <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl flex flex-col justify-between h-full">
              <h2 className="text-xs font-black uppercase mb-6 text-rose-500 flex items-center gap-2">
                <span className="w-6 h-6 bg-rose-600/20 rounded-full flex items-center justify-center text-[10px]">3</span>
                Finalizar Trámite
              </h2>

              <div className="bg-blue-600/5 p-8 rounded-[2rem] border border-blue-500/20 text-center shadow-inner mb-6">
                <p className="text-[10px] text-blue-400 font-black uppercase mb-2">Total Citadas</p>
                <span className="text-6xl font-black text-white">{seleccionadas.length}</span>
              </div>

              <div className="space-y-3">
                <button 
                  onClick={guardarPlanilla} 
                  className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95"
                >
                  🚀 ENVIAR AL ÁRBITRO
                </button>
                
                <button 
                  onClick={handleDescargarPlanilla} 
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black px-8 py-4 rounded-2xl text-[10px] uppercase transition-all shadow-lg active:scale-95"
                >
                  📥 GENERAR COPIA PDF
                </button>
              </div>

              <p className="text-[9px] text-slate-600 uppercase font-bold text-center mt-6 leading-tight italic">
                * Una vez enviada, la planilla será visible para el árbitro.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* --- VISTA DE CREDENCIALES (DENTRO DE ADMIN DELEGADO) --- */}
      {activeTab === 'credenciales' && (
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 space-y-8 pb-20">
          <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-md py-4 border-b border-white/5">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
              <div className="flex bg-slate-900 p-1 rounded-2xl border border-white/10 shadow-inner">
                <button onClick={() => setVistaCred('tabla')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${vistaCred === 'tabla' ? 'bg-slate-800 text-white shadow-lg border border-white/10' : 'text-slate-500'}`}>Lista</button>
                <button onClick={() => setVistaCred('credencial')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${vistaCred === 'credencial' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}>Fotos</button>
              </div>
              <button onClick={() => setActiveTab('planilla')} className="text-[10px] font-black text-slate-500 uppercase hover:text-white bg-slate-900 px-6 py-3 rounded-xl border border-white/5 transition-all">✕ Cerrar y volver</button>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
              {['TODAS', ...CATEGORIAS_OFICIALES].map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoriaSelCred(cat)}
                  className={`relative whitespace-nowrap px-5 py-2.5 rounded-full text-[10px] font-black uppercase border-2 transition-all duration-300 flex items-center gap-2 ${categoriaSelCred === cat ? 'bg-white border-white text-black scale-105' : 'bg-transparent border-slate-800 text-slate-500'}`}
                >
                  {cat}
                  <span className={`px-2 py-0.5 rounded-md text-[8px] flex items-center gap-1 font-black ${statsCred.alertas[cat] ? 'bg-rose-600 text-white animate-pulse' : (categoriaSelCred === cat ? 'bg-black text-white' : 'bg-slate-800 text-slate-400')}`}>
                    {statsCred.alertas[cat] && <ExclamationTriangleIcon className="w-3 h-3" />}
                    {statsCred.conteos[cat] || 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className={vistaCred === 'tabla' ? "max-w-4xl mx-auto" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-y-16 gap-x-8 pt-4 justify-items-center"}>
            {jugadorasFiltradasCred.map(jug => (
              vistaCred === 'tabla' ? (
                <div key={jug.id} className="bg-slate-900/50 p-5 rounded-2xl border border-white/5 mb-3 flex justify-between items-center group">
                  <div className="flex items-center gap-4">
                    <img src={jug.foto_url} className="w-10 h-10 rounded-lg object-cover" alt="p" />
                    <span className="font-black uppercase italic tracking-tighter text-slate-200">{jug.apellido}, {jug.nombre}</span>
                  </div>
                  <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-lg ${jug.verificacion_biometrica_estado === 'aprobado' ? 'text-emerald-500 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10 animate-pulse'}`}>{jug.verificacion_biometrica_estado}</span>
                </div>
              ) : (
                <div key={jug.id} className="relative group flex flex-col items-center">
                  
                  {/* CONTENEDOR RELATIVO CON ANCHO AJUSTADO AL CARNET */}
                  <div className="relative w-fit">
                    <CarnetJugadora 
                      jugadora={{
                        ...jug, 
                        club_escudo: clubes.find(c => c.id === (jug.equipo_id || equipoIdActual))?.escudo_url || clubes.find(c => c.id === (jug.equipo_id || equipoIdActual))?.logo_url,
                        club_nombre: clubes.find(c => c.id === (jug.equipo_id || equipoIdActual))?.nombre
                      }} 
                      config={configLiga} 
                      mostrarDorso={false} 
                    />

                    {/* LOGO DE LA LIGA (MÁS GRANDE Y POSICIONADO) */}
                    <div className="absolute bottom-[8px] right-[10px] z-50 pointer-events-none">
                      <img 
                        src="https://res.cloudinary.com/dgtc9qfmv/image/upload/v1770690271/rt0j5lpxilkn8o6ugate.png" 
                        alt="logo-liga"
                        // Subimos de h-12 a h-16 para que destaque más
                        className="h-16 w-16 object-contain drop-shadow-2xl brightness-110 filter saturate-150"
                      />
                    </div>
                  </div>

                  <div className={`absolute -bottom-5 left-1/2 -translate-x-1/2 px-8 py-3 rounded-2xl text-[10px] font-black uppercase shadow-2xl border-2 z-10 whitespace-nowrap tracking-widest ${jug.verificacion_biometrica_estado === 'aprobado' ? 'bg-emerald-600 border-emerald-400 text-white shadow-emerald-900/40' : 'bg-rose-600 border-rose-400 text-white animate-pulse shadow-rose-900/40'}`}>
                    {jug.verificacion_biometrica_estado === 'aprobado' ? '✓ Habilitada' : '✕ Inhabilitada'}
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}


      {activeTab === 'fichaje' && (
        <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-8 duration-500">
          {jugadoraRegistrada ? (
             <div className="flex flex-col items-center gap-6"><CarnetJugadora jugadora={jugadoraRegistrada} config={configLiga}/>
             <button onClick={() => setJugadoraRegistrada(null)} className="bg-blue-600 text-white px-10 py-3 rounded-full font-black uppercase text-[10px]">Nuevo Fichaje</button></div>
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
  <label htmlFor="clubAsig" className="text-[9px] font-black uppercase text-slate-500 ml-2 mb-1 block tracking-widest">
    Club Destino del Fichaje
  </label>
  
  {/* REGLA DE NEGOCIO: Selección dinámica para Admins / Fijo para Delegados */}
  {(perfilUsuario?.rol === 'admin_liga' || perfilUsuario?.rol === 'superadmin') ? (
    <select 
      id="clubAsig"
      className="bg-slate-950 p-5 rounded-2xl border border-slate-800 w-full text-xs font-black uppercase text-white outline-none focus:border-emerald-500"
      value={equipoIdActual || ""}
      onChange={(e) => setEquipoIdActual(Number(e.target.value))}
      required
    >
      <option value="">-- SELECCIONAR CLUB --</option>
      {clubes.map(club => (
        <option key={club.id} value={club.id}>{club.nombre}</option>
      ))}
    </select>
  ) : (
    /* Vista para DELEGADO */
    <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex items-center gap-3 shadow-inner">
      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
      <span className="text-xs font-black uppercase text-white tracking-tighter">
        {clubes.find(c => c.id === equipoIdActual)?.nombre || "Cargando Club..."}
      </span>
    </div>
  )}

  {/* MANTENEMOS TU INPUT HIDDEN: Así respetamos la persistencia que mencionaste */}
  <input 
    type="hidden" 
    name="equipo_id_hidden" 
    value={equipoIdActual || ''} 
    required 
  />
 </div>
                <div className="col-span-full grid grid-cols-2 gap-4">
                   <div className="space-y-2"><p className="text-[9px] font-black uppercase text-blue-500 ml-2 italic">Foto Carnet Actual</p><input type="file" className="w-full text-[10px] text-slate-500" onChange={e => setFilePerfil(e.target.files[0])} required /></div>
                   <div className="space-y-2">
  <p className="text-[9px] font-black uppercase text-emerald-500 ml-2 italic">
    Foto frente DNI 
  </p>
  <input 
    type="file" 
    className="w-full text-[10px] text-slate-500" 
    onChange={(e) => {
      const archivo = e.target.files[0];
      if (archivo) {
        setFileDNI(archivo); // Mantiene tu lógica para biometría/servidor
        //escanearDNI(archivo); // Dispara la lectura automática del texto
      }
    }} 
    required 
  />
 </div>
                </div>
                <button disabled={cargandoFichaje} className={`col-span-full py-5 rounded-2xl font-black text-xs uppercase shadow-xl ${cargandoFichaje ? 'bg-slate-700 text-slate-500' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}>
                  {cargandoFichaje ? "PROCESANDO BIOMETRÍA..." : "VALIDAR Y GENERAR CREDENCIAL"}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {activeTab === 'delegados' && (
        <div className="animate-in fade-in duration-500">
          <GestionDelegados 
            clubData={{ 
              id: equipoIdActual, 
              nombre: clubes.find(c => c.id === equipoIdActual)?.nombre || "Club" 
            }}
            configLiga={configLiga} 
          />
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