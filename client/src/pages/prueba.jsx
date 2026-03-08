/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback } from 'react'; 
import { supabase } from '../supabaseClient';
import axios from 'axios';
import CarnetJugadora from '../components/CarnetJugadora'; 
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import GestionDelegados from '../components/GestionDelegados';

// --- 1. FUNCIÓN DE APOYO PARA CATEGORÍAS (Fuera del componente) ---
const obtenerCategoriaPorAnio = (fechaNacimiento, categorias) => {
  if (!fechaNacimiento || !categorias) return "S/D";
  const anio = new Date(fechaNacimiento).getFullYear();
  const match = categorias.find(c => anio >= c.año_desde && anio <= (c.año_hasta || anio));
  return match ? match.nombre : "S/D";
};

const AdminDelegado = () => {
  // --- ESTADOS DE SESIÓN Y PERFIL ---
  const [errorDni, setErrorDni] = useState(""); 
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
  const [leyendoOCR, setLeyendoOCR] = useState(false);

  const categoriasDisponibles = [...new Set(partidos.map(p => p.categoria))].sort();
  const navigate = useNavigate();

  // --- ESTADOS DE EDICIÓN Y FICHAJE ---
  const [editandoId, setEditandoId] = useState(null);
  const [datosEdicion, setDatosEdicion] = useState({ nombre: '', apellido: '', dni: '', fecha_nacimiento: '' });
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

  const fetchData = useCallback(async () => {
    setLoadingSession(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoadingSession(false); return; }

      const { data: perfil, error: perfilError } = await supabase
        .from('perfiles')
        .select('organizacion_id, equipo_id, rol')
        .eq('id', session.user.id)
        .maybeSingle();

      if (perfilError || !perfil) { setLoadingSession(false); return; }

      setPerfilUsuario(perfil);
      const userOrgId = perfil.organizacion_id;

      if (perfil.rol === 'delegado') {
        setEquipoIdActual(perfil.equipo_id);
      } else {
        setEquipoIdActual(null);
      }

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

          if (orgData) {
              setConfigLiga({ nombre_liga: orgData.nombre, logo_url: orgData.logo_url });
          }
      }

      const idParaFiltrar = perfil.rol === 'delegado' ? perfil.equipo_id : 0;

      if (idParaFiltrar && idParaFiltrar !== 0) {
        const { data: jugadorasData, error: errorPlantel } = await supabase
          .from('jugadoras')
          .select(`*, sanciones(id, motivo, estado), equipos!equipo_id (id, nombre, escudo_url)`)
          .eq('organizacion_id', userOrgId)
          .eq('equipo_id', idParaFiltrar);

        if (!errorPlantel) {
            setPlantel(jugadorasData?.map(j => ({
              ...j,
              estaSuspendida: j.sanciones?.some(s => s.estado === 'cumpliendo') || j.sancionada === true
            })) || []);
        }

        const { data: sancData } = await supabase
          .from('sanciones')
          .select(`*, jugadora:jugadoras!inner(nombre, apellido, dni, equipo_id, organizacion_id), partido:partidos(nro_fecha, local:equipos!local_id(nombre), visitante:equipos!visitante_id(nombre))`)
          .eq('jugadora.equipo_id', idParaFiltrar)
          .order('created_at', { ascending: false });
        
        setExpedientes(sancData || []);

        const { data: partidosData } = await supabase
          .from('partidos')
          .select('*, local:equipos!local_id(nombre), visitante:equipos!visitante_id(nombre)')
          .or(`local_id.eq.${idParaFiltrar},visitante_id.eq.${idParaFiltrar}`)
          .eq('organizacion_id', userOrgId)
          .eq('finalizado', false); 
        setPartidos(partidosData || []);
      }

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

  useEffect(() => { fetchData(); }, [fetchData]);

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
            estaSuspendida: j.sanciones?.some(s => s.estado === 'cumpliendo') || j.sancionada === true
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

  const generarPDFDictamenDelegado = (jugadora, config) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 45, 'F');
    if (logoBase64) {
      try { doc.addImage(logoBase64, 'PNG', 15, 10, 25, 25); } catch (e) {
        doc.setFillColor(217, 0, 130); doc.ellipse(27, 22, 12, 12, 'F');
      }
    } else {
      doc.setFillColor(217, 0, 130); doc.ellipse(27, 22, 12, 12, 'F'); 
    }
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18); doc.setFont("helvetica", "bold");
    doc.text(config?.nombre_liga?.toUpperCase() || "LIGA OFICIAL", 105, 20, { align: 'center' });
    doc.setFontSize(12); doc.setTextColor(217, 0, 130);
    doc.text("NOTIFICACIÓN DE SANCIÓN VIGENTE", 105, 28, { align: 'center' });
    doc.setFontSize(8); doc.setTextColor(200, 200, 200);
    doc.text(`Expediente Electrónico Tribunal | Fecha de Emisión: ${new Date().toLocaleDateString()}`, 105, 36, { align: 'center' });
    doc.setTextColor(0, 0, 0); doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text("DATOS DE LA JUGADORA INHABILITADA:", 20, 60);
    doc.line(20, 62, 190, 62);
    doc.setFont("helvetica", "normal");
    doc.text(`APELLIDO Y NOMBRE: ${jugadora.apellido}, ${jugadora.nombre}`, 20, 75);
    doc.text(`DOCUMENTO (DNI): ${jugadora.dni || 'N/A'}`, 20, 85);
    doc.text(`CLUB PERTENECIENTE: ${clubes.find(c => c.id === equipoIdActual)?.nombre || 'S/D'}`, 20, 95);
    doc.setFillColor(254, 242, 242); doc.setDrawColor(239, 68, 68);
    doc.rect(20, 105, 170, 25, 'FD');
    doc.setTextColor(185, 28, 28); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text("ESTADO: INHABILITADA PARA COMPETIR", 105, 121, { align: 'center' });
    doc.setTextColor(0, 0, 0); doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text("FUNDAMENTOS DE LA SANCIÓN:", 20, 150);
    doc.setFont("helvetica", "italic"); doc.setFontSize(10);
    const motivo = jugadora.aclaracion_tribunal || "Sanción aplicada por el Tribunal de Disciplina.";
    const lineasMotivo = doc.splitTextToSize(motivo, 160);
    doc.text(lineasMotivo, 25, 160);
    const urlQR = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + "/#/verificar/" + jugadora.id)}`;
    const imgQR = new Image();
    imgQR.crossOrigin = "Anonymous";
    imgQR.src = urlQR;
    imgQR.onload = () => {
      try { doc.addImage(imgQR, 'PNG', 20, 245, 30, 30); } catch (e) {}
      finalizarYGuardar();
    };
    imgQR.onerror = () => { finalizarYGuardar(); };
    const finalizarYGuardar = () => {
      doc.setFontSize(8); doc.setTextColor(100, 100, 100);
      doc.text("Escanee el código para verificar la vigencia en tiempo real.", 55, 260);
      doc.text(`Identificador Único Org: ${perfilUsuario?.organizacion_id || 'N/A'}`, 55, 265);
      doc.text("__________________________", 140, 260);
      doc.text("Secretaría de Competencia", 142, 265);
      doc.save(`Dictamen_Oficial_${jugadora.apellido}.pdf`);
    };
    setTimeout(() => { if (doc.internal.pages.length > 0) finalizarYGuardar(); }, 2000);
  };

  const enviarDescargo = async (sancionId, textoDescargo, esLocal) => {
    if (!textoDescargo || textoDescargo.trim().length < 5) return alert("Escribe un descargo válido");
    const campoDescargo = esLocal ? 'descargo_local' : 'descargo_visitante';
    const { error } = await supabase.from('sanciones').update({ [campoDescargo]: textoDescargo }).eq('id', sancionId);
    if (!error) { alert("✅ Descargo registrado."); fetchData(); }
  };

  const toggleJugadora = (jugadora) => {
    if (editandoId) return;
    if (jugadora.estaSuspendida) { alert("🚫 Jugadora suspendida."); return; }
    setSeleccionadas(prev => prev.includes(jugadora.id) ? prev.filter(item => item !== jugadora.id) : [...prev, jugadora.id]);
  };

  const guardarPlanilla = async () => {
    if (!partidoSeleccionado) return alert("Selecciona un partido");
    if (seleccionadas.length === 0) return alert("Selecciona jugadoras");
    const rows = seleccionadas.map(jId => ({ partido_id: partidoSeleccionado, jugadora_id: jId, equipo_id: equipoIdActual }));
    const { error } = await supabase.from('planillas_citadas').insert(rows);
    if (!error) { alert("🚀 Planilla enviada"); setSeleccionadas([]); }
  };

  // --- LÓGICA DE PDF DINÁMICO POR CATEGORÍA (FUSIONADO) ---
const handleDescargarPlanilla = async () => {
  if (!partidoSeleccionado) return alert("Selecciona un partido");

  setLoadingSession(true);
  try {
    // 1. Traer datos del partido, incluyendo organizacion_id para buscar las reglas
    const { data: partido, error: pErr } = await supabase
      .from('partidos')
      .select('id, local_id, visitante_id, categoria, nro_fecha, organizacion_id')
      .eq('id', partidoSeleccionado)
      .single();

    if (pErr || !partido) throw new Error("Partido no encontrado");

    // 2. Obtener las reglas de categorías configuradas para esta organización
    const { data: reglasCategorias, error: catErr } = await supabase
      .from('categorias')
      .select('*')
      .eq('organizacion_id', partido.organizacion_id);

    if (catErr) throw catErr;

    // 3. Traer jugadoras de ambos equipos (incluimos fecha_nacimiento para el filtrado dinámico)
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

    if (localErr || visitaErr) throw new Error("Error cargando los planteles");

    // 4. Lógica de filtrado: Comparamos el año de nacimiento contra los rangos de la tabla categorias
    const filtrarPorCategoriaReal = (lista) => lista.filter(j => {
      if (!j.fecha_nacimiento) return false;

      const anioNac = new Date(j.fecha_nacimiento).getFullYear();
      
      // Buscamos cuál es la categoría que le corresponde por año según la tabla
      const catMatch = reglasCategorias.find(c => 
        anioNac >= c.año_desde && anioNac <= (c.año_hasta || anioNac)
      );

      // Solo incluimos si el nombre de la categoría encontrada coincide con la del partido
      // Ejemplo: Si nació en 2011, catMatch.nombre será "5ta Div." o "2011-2012"
      return catMatch && catMatch.nombre === partido.categoria;
    });

    const localP = filtrarPorCategoriaReal(localTodos || []);
    const visitaP = filtrarPorCategoriaReal(visitaTodos || []);

    // 5. Preparar objeto para el PDF manteniendo tu lógica de nombres de clubes
    const partidoParaPDF = {
      ...partido,
      local: { nombre: clubes.find(c => c.id === partido.local_id)?.nombre || "Local" },
      visitante: { nombre: clubes.find(c => c.id === partido.visitante_id)?.nombre || "Visitante" }
    };

    // 6. Generar el PDF final
    generarPDF(partidoParaPDF, localP, visitaP);

  } catch (err) {
    console.error("Error en planilla dinámica:", err.message);
    alert("Error al generar planilla: " + err.message);
  } finally {
    setLoadingSession(false);
  }
};

  const generarPDF = (partido, localPlayers, visitaPlayers) => {
    const doc = new jsPDF();
    const colorMagenta = [217, 0, 130]; 
    const nombreLiga = configLiga?.nombre_liga || "LIGA OFICIAL";

    if (logoBase64) { try { doc.addImage(logoBase64, 'PNG', 14, 8, 22, 22); } catch (e) {} }
    doc.setFontSize(16); doc.setTextColor(...colorMagenta); doc.setFont("helvetica", "bold");
    doc.text(`${nombreLiga.toUpperCase()}`, 105, 15, { align: 'center' });
    doc.setFontSize(10); doc.setTextColor(100, 100, 100);
    doc.text("PLANILLA DE JUEGO OFICIAL", 105, 21, { align: 'center' });
    doc.setFontSize(9); doc.setTextColor(0, 0, 0);
    doc.text(`FECHA NRO: ${partido.nro_fecha}`, 45, 30);
    doc.text(`CATEGORÍA: ${partido.categoria.toUpperCase()}`, 130, 30);
    doc.line(14, 33, 196, 33); 

    const configuracionTabla = {
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: 0, fontSize: 8, fontStyle: 'bold', halign: 'center' },
      styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0] },
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 70 }, 2: { cellWidth: 25, halign: 'center' }, 3: { cellWidth: 45 }, 4: { cellWidth: 15, halign: 'center' }, 5: { cellWidth: 10, halign: 'center' }, 6: { cellWidth: 10, halign: 'center' } }
    };

    const drawControlesGlobales = (startX, startY) => {
      doc.setFontSize(8); doc.setTextColor(0); doc.setFont("helvetica", "bold");
      doc.text("FALTAS 1T:", startX, startY);
      for (let i = 0; i < 5; i++) doc.rect(startX + 18 + (i * 6), startY - 3.5, 4.5, 4.5);
      doc.text("FALTAS 2T:", startX + 55, startY);
      for (let i = 0; i < 5; i++) doc.rect(startX + 73 + (i * 6), startY - 3.5, 4.5, 4.5);
      doc.text("EXPULSIÓN: J", startX + 110, startY);
      doc.rect(startX + 130, startY - 3.5, 4.5, 4.5);
      doc.text("D", startX + 137, startY); doc.rect(startX + 141, startY - 3.5, 4.5, 4.5);
      doc.text("P", startX + 148, startY); doc.rect(startX + 152, startY - 3.5, 4.5, 4.5);
    };

    doc.setFontSize(11); doc.setTextColor(...colorMagenta);
    doc.text(`LOCAL: ${partido.local.nombre}`, 14, 42);
    autoTable(doc, {
      ...configuracionTabla,
      startY: 45,
      head: [['N°', 'NOMBRE Y APELLIDO', 'DNI', 'FIRMA JUGADORA', 'GOLES', 'A', 'R']],
      body: localPlayers.map((j, i) => [i + 1, j.apellido.toUpperCase() + " " + j.nombre, j.dni, "", "", "", ""]),
    });
    drawControlesGlobales(14, doc.lastAutoTable.finalY + 8);

    const nextY = doc.lastAutoTable.finalY + 20;
    doc.text(`VISITA: ${partido.visitante.nombre}`, 14, nextY);
    autoTable(doc, {
      ...configuracionTabla,
      startY: nextY + 3,
      head: [['N°', 'NOMBRE Y APELLIDO', 'DNI', 'FIRMA JUGADORA', 'GOLES', 'A', 'R']],
      body: visitaPlayers.map((j, i) => [i + 1, j.apellido.toUpperCase() + " " + j.nombre, j.dni, "", "", "", ""]),
    });
    drawControlesGlobales(14, doc.lastAutoTable.finalY + 8);

    const resY = 255;
    doc.rect(14, resY, 63, 8, 'FD'); 
    doc.setFontSize(8); doc.setTextColor(0);
    doc.text("TABLA DE RESULTADOS FINALES", 14 + 31.5, resY + 5.5, { align: 'center' });
    const drawExcelRow = (x, y, label) => {
      doc.rect(x, y, 45, 10); doc.rect(x + 45, y, 18, 10);
      doc.setFont("helvetica", "bold"); doc.text(label, x + 2, y + 6.5);
    };
    drawExcelRow(14, resY + 8, `LOC: ${partido.local.nombre.substring(0, 15)}`);
    drawExcelRow(14, resY + 18, `VIS: ${partido.visitante.nombre.substring(0, 15)}`);
    doc.line(80, 285, 110, 285); doc.text("FIRMA ÁRBITRO", 95, 289, { align: 'center' });
    doc.save(`Planilla_${partido.local.nombre}_vs_${partido.visitante.nombre}.pdf`);
  };

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
    setDatosEdicion({ nombre: j.nombre, apellido: j.apellido, dni: j.dni, fecha_nacimiento: j.fecha_nacimiento });
  };

  const guardarActualizacion = async (e, id) => {
    e.stopPropagation();
    const { error } = await supabase.from('jugadoras').update(datosEdicion).eq('id', id);
    if (!error) { setEditandoId(null); fetchData(); }
  };

  const manejarEnvioFichaje = async (e) => {
      e.preventDefault();
      if (!equipoIdActual || equipoIdActual === 0 || !filePerfil || !fileDNI) {
          return alert("⚠️ Debes seleccionar un CLUB y cargar fotos.");
      }
      if (errorDni) return alert("⚠️ DNI ya existe.");
      setCargandoFichaje(true);
      try {
          const { data: { session } } = await supabase.auth.getSession();
          const formData = new FormData();
          formData.append('foto', filePerfil);
          formData.append('dni_foto', fileDNI);
          formData.append('nombre', datosFichaje.nombre);
          formData.append('apellido', datosFichaje.apellido);
          formData.append('dni', datosFichaje.dni);
          formData.append('fecha_nacimiento', datosFichaje.fecha_nacimiento);
          formData.append('organizacion_id', perfilUsuario?.organizacion_id);
          formData.append('equipo_id', equipoIdActual); 
          formData.append('verificacion_manual', true); 
          formData.append('distancia_biometrica_oficial', 0);

          const res = await axios.post(`${import.meta.env.VITE_API_URL}/fichar`, formData, { 
              headers: { 'Authorization': `Bearer ${session?.access_token}` } 
          }); 

          if (res.status === 200 || res.status === 201) {
              alert("🚀 Fichaje enviado.");
              setJugadoraRegistrada({ ...(res.data.jugadora || res.data), equipos: { nombre: clubes.find(c => c.id === equipoIdActual)?.nombre } });
              setDatosFichaje({ nombre: '', apellido: '', dni: '', fecha_nacimiento: '' });
              setFilePerfil(null); setFileDNI(null);
              fetchData();
          }
      } catch (err) { alert("🚨 Error: " + (err.response?.data?.error || "Error servidor")); } finally { setCargandoFichaje(false); }
  };

  const verificarDniDuplicado = async (dni) => {
      if (dni.length < 7) return;
      const { data } = await supabase.from('jugadoras').select('id, apellido, nombre').eq('dni', dni).eq('organizacion_id', perfilUsuario?.organizacion_id).maybeSingle();
      if (data) { setErrorDni(`⚠️ DNI de ${data.apellido}`); setDatosFichaje(p => ({ ...p, dni: '' })); } else { setErrorDni(""); }
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

      <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center gap-4 shadow-2xl mb-8">
        <div><h2 className="text-xl font-black uppercase italic text-blue-500">Centro de Estadísticas</h2><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Rendimiento oficial</p></div>
        <button onClick={() => navigate('/posiciones')} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase shadow-lg transition-all active:scale-95">📊 Ver Posiciones</button>
      </div>

      <div className="max-w-full mx-auto mb-8">
        <h3 className="text-xs font-black uppercase text-slate-500 mb-4 ml-4 tracking-widest">Avisos del Tribunal</h3>
        <div className="grid gap-4">
          {plantel.filter(j => j.estaSuspendida || j.tiene_deuda).map(j => (
            <div key={j.id} className="bg-rose-600/10 border border-rose-500/20 p-5 rounded-[2rem] flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4"><div className="w-10 h-10 bg-rose-600 rounded-full flex items-center justify-center font-black text-white">!</div><div><p className="text-xs font-black uppercase">{j.apellido}, {j.nombre}</p><p className="text-[10px] text-rose-500 font-bold uppercase tracking-tighter">Sanción: {j.aclaracion_tribunal || "Inhabilitada"}</p></div></div>
              <button onClick={() => generarPDFDictamenDelegado(j, configLiga)} className="bg-rose-600 hover:bg-rose-500 text-white px-6 py-3 rounded-xl text-[9px] font-black uppercase shadow-lg transition-all">Descargar Dictamen ↓</button>
            </div>
          ))}
          {plantel.filter(j => j.estaSuspendida || j.tiene_deuda).length === 0 && <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl text-center"><p className="text-[9px] text-emerald-500 font-black uppercase tracking-widest">✅ Plantel sin sanciones</p></div>}
        </div>
      </div>

      {activeTab === 'planilla' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
          <div className="space-y-6">
            <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl h-full">
              <h2 className="text-xs font-black uppercase mb-6 text-blue-500 flex items-center gap-2"><span className="w-6 h-6 bg-blue-600/20 rounded-full flex items-center justify-center text-[10px]">1</span>Seleccionar Jornada</h2>
              <div className="space-y-4">
                <div><label className="text-[10px] text-slate-500 uppercase font-bold ml-2">Próximo Partido</label>
                <select className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs font-bold text-white outline-none mt-1 focus:border-blue-500" onChange={(e) => setPartidoSeleccionado(e.target.value)} value={partidoSeleccionado}>
                  <option value="">Elegir fecha...</option>{partidos.map(p => (<option key={p.id} value={p.id}>Fecha {p.nro_fecha}: {p.local.nombre} vs {p.visitante.nombre}</option>))}</select></div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl h-full relative overflow-hidden">
              <h2 className="text-xs font-black uppercase mb-6 text-emerald-500 flex items-center justify-between"><div className="flex items-center gap-2"><span className="w-6 h-6 bg-emerald-600/20 rounded-full flex items-center justify-center text-[10px]">2</span>Citación</div>{!cargandoPlantel && <span className="text-[10px] text-slate-500">{plantel.length} Total</span>}</h2>
              <div className="grid grid-cols-1 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {cargandoPlantel ? <div className="flex flex-col items-center py-20 gap-4"><div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div></div> : plantel.map(j => (
                  <div key={j.id} onClick={() => toggleJugadora(j)} className={`relative flex flex-col p-4 rounded-2xl border-2 transition-all cursor-pointer ${j.estaSuspendida ? 'bg-red-950/20 border-red-900/30 opacity-60' : seleccionadas.includes(j.id) ? 'bg-emerald-600/10 border-emerald-500' : 'bg-slate-800/40 border-transparent hover:border-slate-700'}`}>
                    {editandoId === j.id ? <div className="space-y-2 w-full" onClick={e => e.stopPropagation()}><input className="w-full bg-slate-950 text-[10px] p-2 rounded-lg border border-slate-700 text-white uppercase" value={datosEdicion.apellido} onChange={e => setDatosEdicion({...datosEdicion, apellido: e.target.value})} /><div className="flex gap-2"><button onClick={(e) => guardarActualizacion(e, j.id)} className="flex-1 bg-emerald-600 text-[9px] font-black py-2 rounded-lg text-white">Guardar</button></div></div> : 
                    <div className="flex items-center gap-4 w-full"><img src={j.foto_url} className="w-10 h-10 rounded-xl object-cover shadow-lg" /><div className="flex-1"><p className={`font-black text-[10px] uppercase ${j.estaSuspendida ? 'text-red-500' : 'text-slate-100'}`}>{j.apellido}, {j.nombre.charAt(0)}.</p><p className="text-[8px] text-slate-500 font-bold uppercase">{j.estaSuspendida ? 'SUSPENDIDA' : `DNI: ${j.dni}`}</p></div><button onClick={(e) => iniciarEdicion(e, j)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-[10px]">✏️</button></div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl flex flex-col justify-between h-full">
              <h2 className="text-xs font-black uppercase mb-6 text-rose-500 flex items-center gap-2"><span className="w-6 h-6 bg-rose-600/20 rounded-full flex items-center justify-center text-[10px]">3</span>Finalizar</h2>
              <div className="bg-blue-600/5 p-8 rounded-[2rem] border border-blue-500/20 text-center mb-6"><span className="text-6xl font-black text-white">{seleccionadas.length}</span></div>
              <div className="space-y-3">
                <button onClick={guardarPlanilla} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black text-xs uppercase shadow-xl transition-all">🚀 ENVIAR</button>
                <button onClick={handleDescargarPlanilla} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black px-8 py-4 rounded-2xl text-[10px] uppercase shadow-lg">📥 PDF PLANILLA</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'fichaje' && (
        <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-8 duration-500">
          {jugadoraRegistrada ? <div className="flex flex-col items-center gap-6"><CarnetJugadora jugadora={jugadoraRegistrada} config={configLiga}/><button onClick={() => setJugadoraRegistrada(null)} className="bg-blue-600 text-white px-10 py-3 rounded-full font-black uppercase text-[10px]">Nuevo Fichaje</button></div> : 
          <div className="bg-slate-900 p-8 rounded-[3rem] border border-slate-800 shadow-2xl">
            <h2 className="text-xl font-black uppercase text-emerald-500 mb-6 italic">Fichaje Oficial</h2>
            <form onSubmit={manejarEnvioFichaje} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <input type="text" placeholder="NOMBRE" className="bg-slate-950 p-5 rounded-2xl border border-slate-800 text-xs font-bold uppercase text-white outline-none" value={datosFichaje.nombre} onChange={(e) => setDatosFichaje({...datosFichaje, nombre: e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '')})} required />
              <input type="text" placeholder="APELLIDO" className="bg-slate-950 p-5 rounded-2xl border border-slate-800 text-xs font-bold uppercase text-white outline-none" value={datosFichaje.apellido} onChange={(e) => setDatosFichaje({...datosFichaje, apellido: e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '')})} required />
              <div className="flex flex-col gap-1"><input type="text" maxLength="8" placeholder="DNI" value={datosFichaje.dni} onChange={(e) => setDatosFichaje({...datosFichaje, dni: e.target.value.replace(/\D/g, '')})} onBlur={(e) => verificarDniDuplicado(e.target.value)} className={`bg-slate-950 p-4 rounded-xl border ${errorDni ? 'border-rose-500' : 'border-slate-800'} text-xs font-bold text-white transition-colors`} required />{errorDni && <span className="text-[9px] font-black text-rose-500 uppercase ml-2 animate-pulse">{errorDni}</span>}</div>
              <div className="flex flex-col gap-1"><label className="text-[9px] font-black uppercase text-slate-500 ml-2 mb-1">Fecha Nacimiento</label><input type="date" className="bg-slate-950 p-5 rounded-2xl border border-slate-800 text-xs font-bold uppercase text-white outline-none" value={datosFichaje.fecha_nacimiento} onChange={(e) => setDatosFichaje({...datosFichaje, fecha_nacimiento: e.target.value})} required /></div>
              <div className="relative group col-span-full">
                {(perfilUsuario?.rol === 'admin_liga' || perfilUsuario?.rol === 'superadmin') ? (
                  <select className="bg-slate-950 p-5 rounded-2xl border border-slate-800 w-full text-xs font-black uppercase text-white outline-none" value={equipoIdActual || ""} onChange={(e) => setEquipoIdActual(Number(e.target.value))} required>
                    <option value="">-- SELECCIONAR CLUB --</option>{clubes.map(club => (<option key={club.id} value={club.id}>{club.nombre}</option>))}</select>
                ) : <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 text-xs font-black uppercase text-white shadow-inner">{clubes.find(c => c.id === equipoIdActual)?.nombre || "Cargando Club..."}</div>}
              </div>
              <div className="col-span-full grid grid-cols-2 gap-4"><input type="file" onChange={e => setFilePerfil(e.target.files[0])} required /><input type="file" onChange={e => setFileDNI(e.target.files[0])} required /></div>
              <button disabled={cargandoFichaje} className={`col-span-full py-5 rounded-2xl font-black text-xs uppercase shadow-xl ${cargandoFichaje ? 'bg-slate-700 text-slate-500' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}>{cargandoFichaje ? "PROCESANDO..." : "VALIDAR Y GENERAR"}</button>
            </form>
          </div>}
        </div>
      )}

      {activeTab === 'delegados' && <GestionDelegados clubData={{ id: equipoIdActual, nombre: clubes.find(c => c.id === equipoIdActual)?.nombre || "Club" }} />}
      {activeTab === 'disciplina' && (
        <div className="space-y-6">
          <h2 className="text-lg font-black uppercase italic text-rose-500">Expedientes</h2>
          <div className="grid gap-4 max-w-5xl mx-auto">
            {expedientes.map(exp => {
              const esLocal = exp.partido.local_id === equipoIdActual;
              const descargoEnviado = esLocal ? exp.descargo_local : exp.descargo_visitante;
              return (
                <div key={exp.id} className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden group hover:border-rose-500/30 transition-all">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
                    <div className="space-y-1"><span className="text-[9px] font-black bg-slate-800 px-4 py-1.5 rounded-full text-rose-500 border border-rose-500/20 uppercase">EXP. #{exp.id}</span><h3 className="text-xl font-black uppercase mt-4 italic">{exp.partido.local.nombre} VS {exp.partido.visitante.nombre}</h3><p className="text-[11px] font-bold text-slate-500 uppercase">Sujeto: <span className="text-blue-500">{exp.jugadora ? `${exp.jugadora.apellido} ${exp.jugadora.nombre}` : 'PERSONAL'}</span></p></div>
                    <span className={`text-[10px] font-black px-5 py-2 rounded-2xl uppercase ${exp.estado === 'pendiente' ? 'bg-amber-600' : 'bg-emerald-600'} text-white`}>{exp.estado === 'pendiente' ? '● En Proceso' : '● Dictaminado'}</span>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-slate-950/50 p-6 rounded-[2rem] border border-slate-800 space-y-3"><p className="text-[10px] font-black text-rose-500 uppercase">Relato:</p><p className="text-xs text-slate-400 italic">" {exp.motivo} "</p></div>
                    <div className="bg-slate-800/20 p-6 rounded-[2rem] border border-slate-800/50 space-y-4"><p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Descargo:</p>
                    {exp.estado === 'pendiente' ? (descargoEnviado ? <p className="text-[11px] text-emerald-400 italic">" {descargoEnviado} "</p> : <div><textarea id={`desc-${exp.id}`} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white h-24" /><button onClick={() => enviarDescargo(exp.id, document.getElementById(`desc-${exp.id}`).value, esLocal)} className="w-full bg-rose-600 text-white py-4 rounded-xl text-[10px] font-black uppercase">Enviar Descargo</button></div>) : <p className="text-xs font-black uppercase text-slate-300 italic">{exp.aclaracion_tribunal || 'Sanción Confirmada'}</p>}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDelegado;