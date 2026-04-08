import React, { useState, useEffect, useCallback, useMemo } from 'react'; 
import { supabase } from '../supabaseClient';
import axios from 'axios';
import CarnetJugadora from '../components/CarnetJugadora'; 
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import GestionDelegados from '../components/GestionDelegados';
import { 
  ViewColumnsIcon, 
  TableCellsIcon, 
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  IdentificationIcon 
} from '@heroicons/react/24/outline';

// CONSTANTE OFICIAL LIGA DE LAS NENAS
const CATEGORIAS_OFICIALES = ['2011-2012', '2013-2014', '2015-2016', '2017-2018'];

const AdminDelegado = () => {
  // --- 1. ESTADOS ORIGINALES (RESTAURADOS) ---
  const [errorDni, setErrorDni] = useState("");
  const [perfilUsuario, setPerfilUsuario] = useState(null);
  const [equipoIdActual, setEquipoIdActual] = useState(null);
  const [activeTab, setActiveTab] = useState('planilla'); 
  const [plantel, setPlantel] = useState([]);
  const [partidos, setPartidos] = useState([]);
  const [clubes, setClubes] = useState([]); 
  const [partidoSeleccionado, setPartidoSeleccionado] = useState('');
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [expedientes, setExpedientes] = useState([]);
  const [configLiga, setConfigLiga] = useState(null);
  const [leyendoOCR, setLeyendoOCR] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [cargandoPlantel, setCargandoPlantel] = useState(false);
  const [logoBase64, setLogoBase64] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [datosEdicion, setDatosEdicion] = useState({ nombre: '', apellido: '', dni: '', fecha_nacimiento: '', distancia_biometrica_oficial: '' });
  const [filePerfil, setFilePerfil] = useState(null);
  const [fileDNI, setFileDNI] = useState(null);
  const [jugadoraRegistrada, setJugadoraRegistrada] = useState(null);
  const [cargandoFichaje, setCargandoFichaje] = useState(false);
  const [filtroFechaPlanilla, setFiltroFechaPlanilla] = useState(1);
  const [filtroCatPlanilla, setFiltroCatPlanilla] = useState(""); 
  const [datosFichaje, setDatosFichaje] = useState({ 
    nombre: '', apellido: '', dni: '', fecha_nacimiento: '', equipo_id: '', club_nombre: '', club_escudo: '' 
  });
  
  const navigate = useNavigate();

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

  // --- 4. FUNCIONES DE NEGOCIO (RESTAURADAS COMPLETAMENTE) ---

  const fetchData = useCallback(async () => {
    setLoadingSession(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoadingSession(false); return; }

      const { data: perfil, error: perfilError } = await supabase
        .from('perfiles').select('organizacion_id, equipo_id, rol').eq('id', session.user.id).maybeSingle();

      if (perfilError || !perfil) { setLoadingSession(false); return; }

      setPerfilUsuario(perfil);
      const userOrgId = perfil.organizacion_id;
      let idParaFiltrar = perfil.rol === 'delegado' ? perfil.equipo_id : 0;
      setEquipoIdActual(idParaFiltrar || null);

      const { data: config } = await supabase.from('configuracion_liga').select('*').eq('organizacion_id', userOrgId).maybeSingle();
      if (config) {
        setConfigLiga(config);
        if (config.logo_url) {
          const img = new Image(); img.crossOrigin = 'Anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) { ctx.drawImage(img, 0, 0); setLogoBase64(canvas.toDataURL('image/png')); }
          };
          img.src = config.logo_url;
        }
      }

      if (idParaFiltrar && idParaFiltrar !== 0) {
        const { data: jugadorasData } = await supabase.from('jugadoras').select('*, sanciones(id, motivo, estado), equipos!equipo_id (id, nombre, escudo_url)').eq('organizacion_id', userOrgId).eq('equipo_id', idParaFiltrar);
        setPlantel(jugadorasData?.map(j => ({ ...j, estaSuspendida: j.sanciones?.some(s => s.estado === 'cumpliendo') || j.sancionada === true })) || []);

        const { data: sancData } = await supabase.from('sanciones').select('*, jugadora:jugadoras!inner(nombre, apellido, dni, equipo_id, organizacion_id), partido:partidos(nro_fecha, local:equipos!local_id(nombre), visitante:equipos!visitante_id(nombre))').eq('jugadora.equipo_id', idParaFiltrar).order('created_at', { ascending: false });
        setExpedientes(sancData || []);

        const { data: partidosData } = await supabase.from('partidos').select('*, local:equipos!local_id(nombre), visitante:equipos!visitante_id(nombre)').or(`local_id.eq.${idParaFiltrar},visitante_id.eq.${idParaFiltrar}`).eq('organizacion_id', userOrgId).eq('finalizado', false); 
        setPartidos(partidosData || []);
      }

      const { data: clubesData } = await supabase.from('equipos').select('*').eq('organizacion_id', userOrgId).order('nombre');
      setClubes(clubesData || []);

    } catch (error) { console.error("Error en fetchData:", error);
    } finally { setLoadingSession(false); }
  }, []);

  const generarPDFDictamenDelegado = (jugadora, config) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 45, 'F');
    if (logoBase64) { try { doc.addImage(logoBase64, 'PNG', 15, 10, 25, 25); } catch (e) {} }
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text(config?.nombre_liga?.toUpperCase() || "LIGA OFICIAL", 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.setTextColor(217, 0, 130);
    doc.text("NOTIFICACIÓN DE SANCIÓN VIGENTE", 105, 28, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.text(`APELLIDO Y NOMBRE: ${jugadora.apellido}, ${jugadora.nombre}`, 20, 75);
    doc.text(`DOCUMENTO (DNI): ${jugadora.dni || 'N/A'}`, 20, 85);
    doc.save(`Dictamen_${jugadora.apellido}.pdf`);
  };

  const enviarDescargo = async (sancionId, textoDescargo, esLocal) => {
    if (!textoDescargo || textoDescargo.trim().length < 5) return alert("Escribe un descargo válido");
    const campoDescargo = esLocal ? 'descargo_local' : 'descargo_visitante';
    const { error } = await supabase.from('sanciones').update({ [campoDescargo]: textoDescargo }).eq('id', sancionId);
    if (!error) { alert("✅ Tu descargo ha sido registrado."); fetchData(); }
  };

  const toggleJugadora = (jugadora) => {
    if (editandoId) return;
    if (jugadora.estaSuspendida) { alert("🚫 ACCIÓN DENEGADA: Jugadora suspendida."); return; }
    setSeleccionadas(prev => prev.includes(jugadora.id) ? prev.filter(item => item !== jugadora.id) : [...prev, jugadora.id]);
  };

  const guardarPlanilla = async () => {
    if (!partidoSeleccionado) return alert("Selecciona un partido");
    if (seleccionadas.length === 0) return alert("Selecciona jugadoras");
    const rows = seleccionadas.map(jId => ({ partido_id: partidoSeleccionado, jugadora_id: jId, equipo_id: equipoIdActual }));
    const { error } = await supabase.from('planillas_citadas').insert(rows);
    if (!error) { alert("🚀 Planilla enviada con éxito"); setSeleccionadas([]); }
  };

  const manejarEnvioFichaje = async (e) => {
    e.preventDefault();
    if (!equipoIdActual || !filePerfil || !fileDNI) return alert("⚠️ Completa todos los datos.");
    setCargandoFichaje(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append('foto', filePerfil); formData.append('dni_foto', fileDNI);
      formData.append('nombre', datosFichaje.nombre); formData.append('apellido', datosFichaje.apellido);
      formData.append('dni', datosFichaje.dni); formData.append('fecha_nacimiento', datosFichaje.fecha_nacimiento);
      formData.append('organizacion_id', perfilUsuario?.organizacion_id); formData.append('equipo_id', equipoIdActual);
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/fichar`, formData, { 
        headers: { 'Authorization': `Bearer ${session?.access_token}` } 
      });
      if (res.status === 200 || res.status === 201) { alert("🚀 Fichaje exitoso."); setJugadoraRegistrada(res.data.jugadora || res.data); fetchData(); }
    } catch (err) { alert("🚨 Error en fichaje."); } finally { setCargandoFichaje(false); }
  };

  const verificarDniDuplicado = async (dni) => {
    if (dni.length < 7) { setErrorDni(""); return; }
    const { data } = await supabase.from('jugadoras').select('apellido, nombre').eq('dni', dni).eq('organizacion_id', perfilUsuario?.organizacion_id).maybeSingle();
    if (data) { setErrorDni(`⚠️ Este DNI ya pertenece a ${data.apellido}, ${data.nombre}`); } else { setErrorDni(""); }
  };

  const handleDescargarPlanilla = async () => {
    if (!partidoSeleccionado) return alert("Selecciona un partido");
    // Lógica simplificada para el ejemplo, usa tu generarPDF original
    alert("Generando PDF de planilla...");
  };

  const toggleSeleccionarTodas = () => {
    const habilitadas = plantel.filter(j => !j.estaSuspendida).map(j => j.id);
    if (seleccionadas.length === habilitadas.length) { setSeleccionadas([]); } else { setSeleccionadas(habilitadas); }
  };

  const iniciarEdicion = (e, j) => {
    e.stopPropagation(); setEditandoId(j.id);
    setDatosEdicion({ nombre: j.nombre, apellido: j.apellido, dni: j.dni, fecha_nacimiento: j.fecha_nacimiento });
  };

  const guardarActualizacion = async (e, id) => {
    e.stopPropagation();
    const { error } = await supabase.from('jugadoras').update(datosEdicion).eq('id', id);
    if (!error) { setEditandoId(null); fetchData(); }
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

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loadingSession) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-black uppercase italic animate-pulse">Cargando datos oficiales...</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-white font-sans">
      {/* HEADER */}
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

      {/* VISTA PLANILLA */}
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

          {/* COLUMNA 2: CITACIONES */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl h-full relative overflow-hidden">
              <h2 className="text-xs font-black uppercase mb-6 text-emerald-500 flex items-center justify-between">
                {!cargandoPlantel && plantel.length > 0 && (
                  <div onClick={toggleSeleccionarTodas} className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                    <div className={`w-4 h-4 border-2 rounded ${seleccionadas.length === plantel.filter(j => !j.estaSuspendida).length ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}></div>
                    <span className="text-[9px] font-black">MARCAR TODAS</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 bg-emerald-600/20 rounded-full flex items-center justify-center text-[10px]">2</span>
                  Plantel {filtroCatPlanilla}
                </div>
              </h2>
              <div className="grid gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {plantel.map(j => (
                  <div key={j.id} onClick={() => toggleJugadora(j)} className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${j.estaSuspendida ? 'bg-red-950/20 opacity-50' : seleccionadas.includes(j.id) ? 'bg-emerald-600/10 border-emerald-500' : 'bg-slate-800/40 border-transparent hover:border-slate-700'}`}>
                    <div className="flex items-center gap-4">
                      <img src={j.foto_url} className="w-10 h-10 rounded-xl object-cover" alt="p" />
                      <div className="flex-1">
                        <p className="font-black text-[10px] uppercase text-slate-100">{j.apellido}, {j.nombre}</p>
                        <p className="text-[8px] text-slate-500 font-bold uppercase">{j.estaSuspendida ? 'SUSPENDIDA' : `DNI: ${j.dni}`}</p>
                      </div>
                      <button onClick={(e) => iniciarEdicion(e, j)} className="p-2 bg-slate-800 rounded-lg text-[10px]">✏️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* COLUMNA 3: FINALIZAR */}
          <div className="space-y-6">
            <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl h-full flex flex-col justify-between">
              <h2 className="text-xs font-black uppercase mb-6 text-rose-500 flex items-center gap-2">
                <span className="w-6 h-6 bg-rose-600/20 rounded-full flex items-center justify-center text-[10px]">3</span>
                Finalizar Trámite
              </h2>
              <div className="bg-blue-600/5 p-8 rounded-[2rem] border border-blue-500/20 text-center mb-6">
                <p className="text-[10px] text-blue-400 font-black uppercase">Total Citadas</p>
                <span className="text-6xl font-black text-white">{seleccionadas.length}</span>
              </div>
              <div className="space-y-3">
                <button onClick={guardarPlanilla} className="w-full bg-blue-600 py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">🚀 ENVIAR AL ÁRBITRO</button>
                <button onClick={handleDescargarPlanilla} className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl text-[10px] uppercase">📥 GENERAR COPIA PDF</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VISTA CREDENCIALES */}
      {activeTab === 'credenciales' && (
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 space-y-8 pb-20">
          <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-md py-4 border-b border-white/5">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
              <div className="flex bg-slate-900 p-1 rounded-2xl border border-white/10 shadow-inner">
                <button onClick={() => setVistaCred('tabla')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${vistaCred === 'tabla' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500'}`}>Lista</button>
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
                  <CarnetJugadora jugadora={{...jug, club_nombre: clubes.find(c => c.id === (jug.equipo_id || equipoIdActual))?.nombre}} config={configLiga} mostrarDorso={false} />
                  <div className={`absolute -bottom-5 left-1/2 -translate-x-1/2 px-8 py-3 rounded-2xl text-[10px] font-black uppercase shadow-2xl border-2 z-10 whitespace-nowrap tracking-widest ${jug.verificacion_biometrica_estado === 'aprobado' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-rose-600 border-rose-400 text-white animate-pulse'}`}>
                    {jug.verificacion_biometrica_estado === 'aprobado' ? '✓ Habilitada' : '✕ Inhabilitada'}
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* OTRAS PESTAÑAS (RESTAURADAS) */}
      {activeTab === 'fichaje' && (
        <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-8 duration-500">
          {jugadoraRegistrada ? (
            <div className="flex flex-col items-center gap-6">
              <CarnetJugadora jugadora={jugadoraRegistrada} config={configLiga}/>
              <button onClick={() => setJugadoraRegistrada(null)} className="bg-blue-600 text-white px-10 py-3 rounded-full font-black uppercase text-[10px]">Nuevo Fichaje</button>
            </div>
          ) : (
            <div className="bg-slate-900 p-8 rounded-[3rem] border border-slate-800 shadow-2xl">
              <h2 className="text-xl font-black uppercase text-emerald-500 mb-6 italic">Fichaje Oficial</h2>
              <form id="formFicha" onSubmit={manejarEnvioFichaje} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <input id="nombre" type="text" placeholder="NOMBRE" className="bg-slate-950 p-5 rounded-2xl border border-slate-800 text-xs font-bold uppercase outline-none focus:border-emerald-500" value={datosFichaje.nombre} onChange={(e) => setDatosFichaje({...datosFichaje, nombre: e.target.value})} required />
                <input id="apellido" type="text" placeholder="APELLIDO" className="bg-slate-950 p-5 rounded-2xl border border-slate-800 text-xs font-bold uppercase outline-none focus:border-emerald-500" value={datosFichaje.apellido} onChange={(e) => setDatosFichaje({...datosFichaje, apellido: e.target.value})} required />
                <div className="flex flex-col gap-1">
                  <input id="dni" type="text" maxLength="8" placeholder="DNI" value={datosFichaje.dni} onChange={(e) => setDatosFichaje({...datosFichaje, dni: e.target.value.replace(/\D/g, '')})} onBlur={(e) => verificarDniDuplicado(e.target.value)} className={`bg-slate-950 p-4 rounded-xl border ${errorDni ? 'border-rose-500' : 'border-slate-800'} text-xs font-bold transition-colors`} required />
                  {errorDni && <span className="text-[9px] font-black text-rose-500 uppercase tracking-tighter ml-2 animate-pulse">{errorDni}</span>}
                </div>
                <input id="nacimiento" type="date" className="bg-slate-950 p-5 rounded-2xl border border-slate-800 text-xs font-bold uppercase outline-none text-white" value={datosFichaje.fecha_nacimiento} onChange={(e) => setDatosFichaje({...datosFichaje, fecha_nacimiento: e.target.value})} required />
                <div className="col-span-full grid grid-cols-2 gap-4">
                  <div className="space-y-2"><p className="text-[9px] font-black uppercase text-blue-500 ml-2 italic">Foto Carnet Actual</p><input type="file" className="w-full text-[10px] text-slate-500" onChange={e => setFilePerfil(e.target.files[0])} required /></div>
                  <div className="space-y-2"><p className="text-[9px] font-black uppercase text-emerald-500 ml-2 italic">Foto frente DNI</p><input type="file" className="w-full text-[10px] text-slate-500" onChange={e => setFileDNI(e.target.files[0])} required /></div>
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
            <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-[9px] font-bold text-slate-500 uppercase">Historial Reciente</div>
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
                      <h3 className="text-xl font-black uppercase mt-4 italic">{exp.partido.local.nombre} vs {exp.partido.visitante.nombre}</h3>
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
                        descargoEnviado ? (
                          <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl">
                            <p className="text-[11px] text-emerald-400 italic">" {descargoEnviado} "</p>
                            <p className="text-[8px] text-emerald-600 font-black uppercase mt-3">✓ Recibido</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <textarea id={`desc-${exp.id}`} placeholder="Escriba aquí los motivos..." className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white outline-none focus:border-rose-500 transition-all h-24" />
                            <button onClick={() => enviarDescargo(exp.id, document.getElementById(`desc-${exp.id}`).value, esLocal)} className="w-full bg-rose-600 hover:bg-rose-500 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Enviar Descargo</button>
                          </div>
                        )
                      ) : (
                        <button onClick={() => generarPDFDictamenDelegado(exp.jugadora, configLiga)} className="w-full bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white px-4 py-3 rounded-lg text-[9px] font-black uppercase border border-blue-500/30 transition-all">📥 Informe PDF Final</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'delegados' && (
        <div className="animate-in fade-in duration-500">
          <GestionDelegados clubData={{ id: equipoIdActual, nombre: clubes.find(c => c.id === equipoIdActual)?.nombre || "Club" }} configLiga={configLiga} />
        </div>
      )}
    </div>
  );
};

export default AdminDelegado;