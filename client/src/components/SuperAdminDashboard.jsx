/* eslint-disable no-irregular-whitespace */
import React, { useState, useEffect, useRef } from 'react'; // NUEVO: useRef
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas'; // NUEVO
import jsPDF from 'jspdf'; // NUEVO
import { PrinterIcon, EyeIcon, MagnifyingGlassIcon, CheckCircleIcon } from '@heroicons/react/24/solid'; // NUEVO

import GestionFichajesAdmin from './GestionFichajesAdmin';
import CarnetJugadora from './CarnetJugadora'; // NUEVO: Import necesario para el lienzo

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  
  // --- ESTADOS ORIGINALES ---
  const [perfil, setPerfil] = useState(null);
  const [nombreLiga, setNombreLiga] = useState('');
  const [emailAdmin, setEmailAdmin] = useState('');
  const [passwordAdmin, setPasswordAdmin] = useState('');
// eslint-disable-next-line no-unused-vars
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ ligas: 0, jugadoras: 0, alertas: 0 });
  const [rankingLigas, setRankingLigas] = useState([]);
// eslint-disable-next-line no-unused-vars
  const [kitBienvenida, setKitBienvenida] = useState(null);

  // --- ESTADOS PARA LAS PROPUESTAS E IMPRESIÓN ---
  const [generandoLona, setGenerandoLona] = useState(false);
  const [jugadorasLiga, setJugadorasLiga] = useState([]);
  const [clubesMap, setClubesMap] = useState({});
  const [configLiga, setConfigLiga] = useState(null);
  const lienzoJugadorasRef = useRef(null);

  // --- NUEVO: ESTADO PARA SELECCIÓN MÚLTIPLE (CHECKBOXES) ---
  const [seleccionadasIds, setSeleccionadasIds] = useState([]);
  const [busqueda, setBusqueda] = useState(""); // Necesario para filtrar la lista
  const [seleccionada, setSeleccionada] = useState(null); // Para el visor individual

  // --- CARGA INICIAL (CONSOLIDADA PARA EVITAR QUE EL PLIEGO SALGA VACÍO) ---
  useEffect(() => {
    const cargarTodoAlInicio = async () => {
      await fetchPerfil();
      await fetchGlobalStats();
      await fetchRankingLigas();
    };
    cargarTodoAlInicio();
  }, []);

  // Efecto que reacciona cuando tenemos el perfil para cargar la data de la liga
  useEffect(() => {
    if (perfil?.organizacion_id) {
      cargarDatosLienzo(perfil.organizacion_id);
    }
  }, [perfil]);

  const cargarDatosLienzo = async (orgId) => {
    console.log("🛰️ CARGANDO DATOS PARA IMPRESIÓN...");
    // Cargar jugadoras
    const { data: jugs } = await supabase.from('jugadoras').select('*').eq('organizacion_id', orgId);
    setJugadorasLiga(jugs || []);
    
    // Cargar equipos para el clubesMap (Escudos)
    const { data: eqs } = await supabase.from('equipos').select('id, nombre, logo_url').eq('organizacion_id', orgId);
    const mapping = {};
    eqs?.forEach(e => mapping[e.id] = { nombre: e.nombre, logo: e.logo_url });
    setClubesMap(mapping);

    // Config de liga
    const { data: conf } = await supabase.from('configuracion_liga').select('*').eq('organizacion_id', orgId).maybeSingle();
    setConfigLiga(conf);
  };

  const fetchPerfil = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.from('perfiles').select('*').eq('id', user.id).single();
      if (error) {
        setPerfil({ rol: 'invitado' }); 
      } else {
        setPerfil(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGlobalStats = async () => {
    try {
      const { count: ligasCount } = await supabase.from('organizaciones').select('*', { count: 'exact', head: true });
      const { count: jugadorasCount } = await supabase.from('jugadoras').select('*', { count: 'exact', head: true });
      const { count: alertasCount } = await supabase.from('jugadoras').select('*', { count: 'exact', head: true }).or('verificacion_biometrica_estado.eq.rechazado,distancia_biometrica_oficial.gt.0.6');
      setStats({ ligas: ligasCount || 0, jugadoras: jugadorasCount || 0, alertas: alertasCount || 0 });
    } catch (error) { console.error(error); }
  };

  const fetchRankingLigas = async () => {
    try {
      const { data: organizaciones } = await supabase.from('organizaciones').select('id, nombre, logo_url, created_at').order('created_at', { ascending: false }).limit(5);
      if (organizaciones) {
        const rankingConConteo = await Promise.all(organizaciones.map(async (org) => {
          const { count } = await supabase.from('jugadoras').select('*', { count: 'exact', head: true }).eq('organizacion_id', org.id);
          return { ...org, totalJugadoras: count || 0 };
        }));
        setRankingLigas(rankingConConteo);
      }
    } catch (error) { console.error(error); }
  };

  const eliminarLiga = async (id, nombre) => {
    const confirmar = window.confirm(`⚠️ ¿ELIMINAR ${nombre}?`);
    if (confirmar && window.prompt(`Escribe el nombre: ${nombre}`) === nombre) {
      await supabase.from('organizaciones').delete().eq('id', id);
      fetchGlobalStats();
      fetchRankingLigas();
    }
  };

  const crearNuevaLiga = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: org, error: orgError } = await supabase.from('organizaciones').insert([{ nombre: nombreLiga, slug: nombreLiga.toLowerCase().replace(/ /g, '-') }]).select().single();
      if (orgError) throw orgError;
      const { data: authData, error: authError } = await supabase.auth.signUp({ email: emailAdmin, password: passwordAdmin, options: { data: { rol: 'admin_liga', organizacion_id: org.id } } });
      if (authError) throw authError;
      await supabase.from('perfiles').insert([{ id: authData.user.id, email: emailAdmin, rol: 'admin_liga', organizacion_id: org.id }]);
      setMensaje({ tipo: 'success', texto: `¡Éxito!` });
    } catch (error) {
      setMensaje({ tipo: 'error', texto: error.message });
    } finally {
      setLoading(false);
    }
  };

  // --- NUEVA LÓGICA: FUNCIONES DEL SELECTOR MASIVO ---
  const jugadorasFiltradas = jugadorasLiga.filter(j => 
    j.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
    j.apellido?.toLowerCase().includes(busqueda.toLowerCase()) ||
    j.dni.includes(busqueda)
  );

  const toggleSeleccionarTodasMaster = () => {
    const idsVisibles = jugadorasFiltradas.map(j => j.id);
    if (idsVisibles.every(id => seleccionadasIds.includes(id)) && idsVisibles.length > 0) {
      setSeleccionadasIds(seleccionadasIds.filter(id => !idsVisibles.includes(id)));
    } else {
      setSeleccionadasIds(Array.from(new Set([...seleccionadasIds, ...idsVisibles])));
    }
  };

  const toggleSeleccionIndividual = (id) => {
    setSeleccionadasIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  // --- PROPUESTA 1: FUNCIÓN DE DESCARGA (ACTUALIZADA PARA DEBUG) ---
  const descargarLona1Metro = async (ref, nombre) => {
    if (!ref.current) {
      console.error("❌ ERROR: El elemento del lienzo no existe.");
      return;
    }
    
    if (seleccionadasIds.length === 0) {
      return alert("⚠️ Selecciona al menos una jugadora con el checkbox para imprimir.");
    }

    setGenerandoLona(true);
    console.log("🎨 INICIANDO CAPTURA DE LIENZO 1MT...");

    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [1000, 1000],
        compress: true
      });

      const canvas = await html2canvas(ref.current, {
        scale: 2, // Bajado a 2 para mayor velocidad, sigue siendo HD
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: true, // Habilitado para ver progreso en consola
        windowWidth: 3779,
        windowHeight: 3779
      });

      console.log("📸 CANVAS GENERADO, CREANDO PDF...");
      const imgData = canvas.toDataURL('image/png');
      doc.addImage(imgData, 'PNG', 0, 0, 1000, 1000);
      doc.save(`${nombre}_SUBLIMACION.pdf`);
      console.log("✅ PDF DESCARGADO EXITOSAMENTE.");

    } catch (error) {
      console.error("❌ Error en pliego:", error);
      alert("Error al generar el archivo. Revisa la consola.");
    } finally {
      setGenerandoLona(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-12">
        
        <header className="flex flex-col md:flex-row justify-between items-center gap-6 border-b border-white/5 pb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">
              Control <span className="text-rose-600">Maestro</span>
          </h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] mt-2 italic">
            Liga: {configLiga?.nombre_liga || "Sincronizando..."}
          </p>
          </div>
          
          <div className="flex gap-3">
            <button 
              disabled={generandoLona || seleccionadasIds.length === 0}
              onClick={() => descargarLona1Metro(lienzoJugadorasRef, 'PLIEGO')}
              className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-2xl text-[10px] font-black flex items-center gap-2 shadow-lg transition-all disabled:opacity-30"
            >
              <PrinterIcon className="w-5 h-5" />
              {generandoLona ? 'PROCESANDO...' : `IMPRIMIR ${seleccionadasIds.length} CARNETS`}
            </button>
          </div>
        </header>

        {/* KPIs GLOBALES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] shadow-xl">
            <p className="text-slate-500 font-black text-[10px] uppercase mb-2">Ligas Activas</p>
            <h3 className="text-4xl font-black italic">{stats.ligas}</h3>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] shadow-xl border-b-emerald-500/50">
            <p className="text-emerald-500 font-black text-[10px] uppercase mb-2 text-emerald-500">Jugadoras Totales</p>
            <h3 className="text-4xl font-black italic text-emerald-500">{stats.jugadoras}</h3>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] shadow-xl border-b-rose-500/50">
            <p className="text-rose-500 font-black text-[10px] uppercase mb-2 text-rose-500">Alertas Fraude</p>
            <h3 className={`text-4xl font-black italic ${stats.alertas > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-700'}`}>{stats.alertas}</h3>
          </div>
        </div>

        {/* --- ESTACIÓN DE TRABAJO (VISOR + BUSCADOR) --- */}
        <section className="bg-slate-900/50 rounded-[3rem] border border-white/5 overflow-hidden shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[600px]">
              {/* PANEL IZQUIERDO: LISTADO CON CHECKBOXES */}
              <div className="lg:col-span-4 border-r border-white/5 flex flex-col bg-slate-950/30">
                  <div className="p-5 space-y-4">
                      <div className="relative">
                          <MagnifyingGlassIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                          <input type="text" className="w-full bg-slate-950 border border-slate-800 p-4 pl-12 rounded-2xl text-xs outline-none font-bold" placeholder="Filtrar por nombre o DNI..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                      </div>
                      {/* BOTÓN SELECCIONAR TODAS */}
                      <div 
                        onClick={toggleSeleccionarTodasMaster}
                        className="flex items-center gap-3 p-3 bg-slate-900 border border-white/5 rounded-xl cursor-pointer hover:bg-slate-800 transition-all"
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${jugadorasFiltradas.length > 0 && jugadorasFiltradas.every(j => seleccionadasIds.includes(j.id)) ? 'bg-blue-600 border-blue-500' : 'border-slate-700'}`}>
                          {jugadorasFiltradas.length > 0 && jugadorasFiltradas.every(j => seleccionadasIds.includes(j.id)) && <span className="text-[10px] text-white">✓</span>}
                        </div>
                        <span className="text-[9px] font-black uppercase text-slate-500">Seleccionar resultados visibles ({jugadorasFiltradas.length})</span>
                      </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto max-h-[500px] custom-scrollbar">
                      {jugadorasFiltradas.map(j => (
                          <div key={j.id} className="flex items-center border-b border-white/5 group">
                              <div onClick={() => toggleSeleccionIndividual(j.id)} className="pl-5 cursor-pointer">
                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${seleccionadasIds.includes(j.id) ? 'bg-blue-600 border-blue-500' : 'border-slate-700'}`}>
                                  {seleccionadasIds.includes(j.id) && <span className="text-[10px] text-white">✓</span>}
                                </div>
                              </div>
                              <div 
                                onClick={() => setSeleccionada(j)} 
                                className={`flex-1 p-5 cursor-pointer transition-all ${seleccionada?.id === j.id ? 'bg-blue-600/20 border-l-4 border-l-blue-500' : 'hover:bg-white/5'}`}
                              >
                                <h4 className="text-[11px] font-black uppercase">{j.apellido}, {j.nombre}</h4>
                                <p className="text-[9px] text-slate-500">DNI: {j.dni}</p>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>

              {/* PANEL DERECHO: VISOR FRENTE/DORSO */}
              <div className="lg:col-span-8 bg-black/40 flex flex-col items-center justify-center p-12 overflow-y-auto max-h-[600px] space-y-10 custom-scrollbar">
                  {seleccionada ? (
                    <>
                      <CarnetJugadora jugadora={{...seleccionada, equipos: { nombre: clubesMap[seleccionada.equipo_id]?.nombre, logo_url: clubesMap[seleccionada.equipo_id]?.logo }}} config={configLiga} />
                      <CarnetJugadora jugadora={{...seleccionada, equipos: { nombre: clubesMap[seleccionada.equipo_id]?.nombre, logo_url: clubesMap[seleccionada.equipo_id]?.logo }}} config={configLiga} mostrarDorso={true} />
                    </>
                  ) : (
                    <div className="text-slate-700 font-black uppercase text-xs animate-pulse">Selecciona una jugadora del listado</div>
                  )}
              </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 pt-12">
          {/* RANKING Y ACCIONES */}
          <div className="space-y-6">
            <h2 className="text-xl font-black uppercase italic flex items-center gap-3"><span className="w-8 h-[2px] bg-rose-600"></span> Últimas Ligas</h2>
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
              <table className="w-full text-left">
                <thead className="bg-slate-950/50 text-[9px] font-black uppercase text-slate-500 tracking-widest">
                  <tr><th className="p-5">Nombre Liga</th><th className="p-5 text-center">Jugadoras</th><th className="p-5 text-right">Acción</th></tr>
                </thead>
                <tbody className="text-xs">
                  {rankingLigas.map(liga => (
                    <tr key={liga.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-all">
                      <td className="p-5 font-bold uppercase">{liga.nombre}</td>
                      <td className="p-5 text-center font-black text-emerald-500">{liga.totalJugadoras}</td>
                      <td className="p-5 text-right flex flex-col items-end gap-2">
                        <button onClick={() => navigate(`/mastercontrol/liga/${liga.id}`)} className="bg-slate-800 hover:bg-blue-600 text-white text-[8px] font-black px-3 py-1.5 rounded-lg transition-all">👁️ INSPECCIONAR</button>
                        <button onClick={() => eliminarLiga(liga.id, liga.nombre)} className="text-rose-900 hover:text-rose-500 text-[7px] font-black uppercase tracking-tighter">🗑️ DAR DE BAJA</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FORMULARIO DE ALTA */}
          <div className="space-y-6">
            <h2 className="text-xl font-black uppercase italic flex items-center gap-3"><span className="w-8 h-[2px] bg-rose-600"></span> Alta de Nuevo Cliente</h2>
            <form onSubmit={crearNuevaLiga} className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-4">
              <input type="text" required placeholder="EJ: LIGA SUR" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl outline-none focus:border-rose-600 uppercase text-xs" value={nombreLiga} onChange={(e) => setNombreLiga(e.target.value)} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="email" required placeholder="admin@liga.com" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl outline-none focus:border-rose-600 text-xs" value={emailAdmin} onChange={(e) => setEmailAdmin(e.target.value)} />
                <input type="password" required placeholder="••••••••" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl outline-none focus:border-rose-600 text-xs" value={passwordAdmin} onChange={(e) => setPasswordAdmin(e.target.value)} />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-rose-600 hover:bg-rose-500 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all disabled:opacity-50 mt-4">{loading ? 'Procesando...' : '🚀 Crear e Instalar Liga'}</button>
            </form>
          </div>
        </div>

        {/* --- PROPUESTA 2: LIENZO OCULTO TÉCNICO (USA LAS SELECCIONADAS) --- */}
        <div style={{ position: 'absolute', left: '-9999px', top: '0', pointerEvents: 'none' }}>
          <div 
            ref={lienzoJugadorasRef} 
            style={{ 
              width: '1000mm', 
              height: '1000mm', 
              background: 'white', 
              padding: '10mm',
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 180mm)', 
              gridAutoRows: '60mm',
              gap: '2mm'
            }}
          >
            {jugadorasLiga.filter(j => seleccionadasIds.includes(j.id)).map(jug => (
              <div key={jug.id} style={{ display: 'flex', gap: '2mm', alignItems: 'center' }}>
                <div style={{ width: '85.6mm', height: '54mm', overflow: 'hidden' }}>
                  <CarnetJugadora 
                    jugadora={{
                      ...jug, 
                      equipos: { 
                        nombre: clubesMap[jug.equipo_id]?.nombre, 
                        logo_url: clubesMap[jug.equipo_id]?.logo 
                      } 
                    }} 
                    config={configLiga} 
                  />
                </div>
                <div style={{ width: '85.6mm', height: '54mm', overflow: 'hidden' }}>
                  <CarnetJugadora 
                    jugadora={{
                      ...jug, 
                      equipos: { 
                        nombre: clubesMap[jug.equipo_id]?.nombre, 
                        logo_url: clubesMap[jug.equipo_id]?.logo 
                      } 
                    }} 
                    config={configLiga} 
                    mostrarDorso={true} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default SuperAdminDashboard;