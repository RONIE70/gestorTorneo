import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { 
  PrinterIcon, EyeIcon, DocumentDuplicateIcon, 
  UserGroupIcon, UserIcon, CheckCircleIcon, PlusIcon,
  MagnifyingGlassIcon, TrashIcon
} from '@heroicons/react/24/solid';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// IMPORTANTE: Asegúrate de que las rutas sean correctas en tu proyecto
import { CarnetDelDelegado } from './GestionDelegados'; 
import CarnetJugadora from './CarnetJugadora'; 

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  
  // --- 1. ESTADOS SaaS Y SESIÓN (BASADOS EN TU CÓDIGO) ---
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ ligas: 0, jugadoras: 0, alertas: 0 });
  const [rankingLigas, setRankingLigas] = useState([]);
  const [nombreLigaForm, setNombreLigaForm] = useState('');
  const [emailAdminForm, setEmailAdminForm] = useState('');
  const [passwordAdminForm, setPasswordAdminForm] = useState('');
  // eslint-disable-next-line no-unused-vars
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  const [kitBienvenida, setKitBienvenida] = useState(null);

  // --- 2. ESTADOS DE GESTIÓN LIGA (PARA EL BUSCADOR Y ESCUDOS) ---
  const [userOrgId, setUserOrgId] = useState(null);
  const [nombreLigaActiva, setNombreLigaActiva] = useState("Sin Seleccionar");
  const [busqueda, setBusqueda] = useState("");
  const [seleccionada, setSeleccionada] = useState(null);
  const [jugadorasLiga, setJugadorasLiga] = useState([]);
  const [delegadosLiga, setDelegadosLiga] = useState([]);
  const [clubesMap, setClubesMap] = useState({}); 
  const [configLiga, setConfigLiga] = useState(null);
  const [configActual, setConfigActual] = useState({ id: null, nombre_edicion: '', modelo_torneo: 'todos_contra_todos', año_lectivo: 2026 });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // --- 3. ESTADOS DE IMPRESIÓN ---
  const [generandoLona, setGenerandoLona] = useState(false); 
  const [verLienzo, setVerLienzo] = useState(false); 
  // eslint-disable-next-line no-unused-vars
  const [tipoLienzo, setTipoLienzo] = useState('jugadoras'); 
  const lienzoDelegadosRef = useRef(null);
  const lienzoJugadorasRef = useRef(null);

  // --- EFECTO: CARGA INICIAL SaaS ---
  useEffect(() => {
    const cargarSaaS = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate('/login');

      const { data: p } = await supabase.from('perfiles').select('*').eq('id', user.id).single();
      if (p) {
        setPerfil(p);
        if (!userOrgId) setUserOrgId(p.organizacion_id);
      }

      const { count: l } = await supabase.from('organizaciones').select('*', { count: 'exact', head: true });
      const { count: j } = await supabase.from('jugadoras').select('*', { count: 'exact', head: true });
      const { count: a } = await supabase.from('jugadoras').select('*', { count: 'exact', head: true }).or('verificacion_biometrica_estado.eq.rechazado,distancia_biometrica_oficial.gt.0.6');
      setStats({ ligas: l || 0, jugadoras: j || 0, alertas: a || 0 });

      const { data: listado } = await supabase.from('organizaciones').select('id, nombre').limit(5);
      if (listado) {
        const ranking = await Promise.all(listado.map(async (o) => {
          const { count } = await supabase.from('jugadoras').select('*', { count: 'exact', head: true }).eq('organizacion_id', o.id);
          return { ...o, totalJugadoras: count || 0 };
        }));
        setRankingLigas(ranking);
        if (ranking.length > 0 && !userOrgId) {
            setUserOrgId(ranking[0].id);
            setNombreLigaActiva(ranking[0].nombre);
        }
      }
      setLoading(false);
    };
    cargarSaaS();
  }, [navigate, userOrgId]);

  // --- EFECTO: CARGA DATA LIGA (CORRECCIÓN ESCUDOS Y ERROR 400) ---
  useEffect(() => {
    if (!userOrgId) return;
    const cargarData = async () => {
      // 1. Equipos con logo_url para que aparezca el escudo
      const { data: equipos } = await supabase.from('equipos').select('id, nombre, logo_url').eq('organizacion_id', userOrgId);
      const mapping = {}; 
      const idsEquipos = equipos?.map(e => {
          mapping[e.id] = { nombre: e.nombre, logo: e.logo_url };
          return e.id;
      }) || [];
      setClubesMap(mapping);

      // 2. Delegados (Safe check para evitar error 400 ya que no tienen organizacion_id)
      if (idsEquipos.length > 0) {
        const { data: dels } = await supabase.from('delegados').select('*').in('club_id', idsEquipos);
        setDelegadosLiga(dels || []);
      }

      // 3. Jugadoras
      const { data: jugs } = await supabase.from('jugadoras').select('*').eq('organizacion_id', userOrgId);
      setJugadorasLiga(jugs || []);
      if (jugs?.length > 0) setSeleccionada(jugs[0]);

      // 4. Nombre Liga Activa
      const { data: orgActiva } = await supabase.from('organizaciones').select('nombre').eq('id', userOrgId).single();
      if (orgActiva) setNombreLigaActiva(orgActiva.nombre);

      const { data: cLiga } = await supabase.from('configuracion_liga').select('*').eq('organizacion_id', userOrgId).maybeSingle();
      setConfigLiga(cLiga);
    };
    cargarData();
  }, [userOrgId, refreshTrigger]);

  const jugadorasFiltradas = jugadorasLiga.filter(j => 
    j.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
    j.apellido?.toLowerCase().includes(busqueda.toLowerCase()) ||
    j.dni.includes(busqueda)
  );

  // --- ACCIONES ---
  const guardarTorneo = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    try {
      await supabase.from('configuracion_torneo').upsert({ ...configActual, organizacion_id: userOrgId, configurado_por: session.user.id });
      alert("✅ Guardado"); setRefreshTrigger(prev => prev + 1);
    // eslint-disable-next-line no-unused-vars
    } catch (e) { alert("Error al guardar"); }
  };

  const crearNuevaLiga = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: org } = await supabase.from('organizaciones').insert([{ nombre: nombreLigaForm, slug: nombreLigaForm.toLowerCase().replace(/ /g, '-') }]).select().single();
      const { data: authData } = await supabase.auth.signUp({ email: emailAdminForm, password: passwordAdminForm, options: { data: { rol: 'admin_liga', organizacion_id: org.id } } });
      await supabase.from('perfiles').insert([{ id: authData.user.id, email: emailAdminForm, rol: 'admin_liga', organizacion_id: org.id }]);
      setKitBienvenida({ email: emailAdminForm, password: passwordAdminForm });
      setMensaje({ tipo: 'success', texto: 'Liga Instalada con éxito.' });
      const { data } = await supabase.from('organizaciones').select('id, nombre').limit(5);
      setRankingLigas(data);
    } catch (error) { setMensaje({ tipo: 'error', texto: error.message }); }
    setLoading(false);
  };

  const descargarPDF = async (ref, nombre) => {
    if (!ref.current) return;
    setGenerandoLona(true);
    try {
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: [1000, 1000] });
      const canvas = await html2canvas(ref.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 1000, 1000);
      doc.save(`${nombre}.pdf`);
    } finally { setGenerandoLona(false); }
  };

  if (loading || !perfil) return <div className="min-h-screen bg-slate-950 flex items-center justify-center font-black animate-pulse text-white">RECONFIGURANDO PANEL MAESTRO...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 font-sans space-y-12">
      
      {/* 1. HEADER CON BOTONES DE PLIEGO */}
      <header className="flex flex-col lg:flex-row justify-between items-center gap-6 border-b border-white/10 pb-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">
            Control <span className="text-rose-600">Maestro</span>
          </h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] mt-2 tracking-widest italic">Liga: {nombreLigaActiva}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setVerLienzo(!verLienzo)} className={`px-5 py-3 rounded-2xl text-[10px] font-black border transition-all ${verLienzo ? 'bg-rose-600 border-rose-400' : 'bg-slate-800 border-slate-700'}`}>
            <EyeIcon className="w-5 h-5" /> {verLienzo ? 'CERRAR PLIEGO' : 'VISUALIZAR PLIEGO'}
          </button>
          <button disabled={generandoLona} onClick={() => descargarPDF(lienzoDelegadosRef, 'LONA_DELEGADOS')} className="bg-emerald-600 px-5 py-3 rounded-2xl text-[10px] font-black shadow-lg disabled:opacity-50">
            <PrinterIcon className="w-5 h-5" /> DELEGADOS
          </button>
          <button disabled={generandoLona} onClick={() => descargarPDF(lienzoJugadorasRef, 'LONA_JUGADORAS')} className="bg-blue-600 px-5 py-3 rounded-2xl text-[10px] font-black shadow-lg disabled:opacity-50">
            <PrinterIcon className="w-5 h-5" /> JUGADORAS (F+D)
          </button>
        </div>
      </header>

      {/* 2. KPIs GLOBALES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] shadow-xl text-center">
          <p className="text-slate-500 font-black text-[10px] uppercase mb-2">Ligas</p>
          <h3 className="text-4xl font-black italic">{stats.ligas}</h3>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] shadow-xl border-b-emerald-500 text-center">
          <p className="text-emerald-500 font-black text-[10px] uppercase mb-2">Jugadoras</p>
          <h3 className="text-4xl font-black italic text-emerald-500">{stats.jugadoras}</h3>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] shadow-xl border-b-rose-500 text-center">
          <p className="text-rose-500 font-black text-[10px] uppercase mb-2 text-rose-500">Alertas</p>
          <h3 className={`text-4xl font-black italic ${stats.alertas > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-700'}`}>{stats.alertas}</h3>
        </div>
      </div>

      {/* 3. ESTACIÓN DE TRABAJO (VISOR DE CALIDAD FRENTE Y DORSO) */}
      <section className="bg-slate-900/50 rounded-[3rem] border border-white/5 overflow-hidden shadow-2xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[600px]">
            {/* PANEL IZQUIERDO */}
            <div className="lg:col-span-4 border-r border-white/5 flex flex-col bg-slate-950/30">
                <div className="p-5 relative">
                    <MagnifyingGlassIcon className="w-4 h-4 absolute left-9 top-1/2 -translate-y-1/2 text-slate-600" />
                    <input type="text" className="w-full bg-slate-950 border border-slate-800 p-4 pl-12 rounded-2xl text-xs outline-none font-bold" placeholder="Buscar..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                </div>
                <div className="flex-1 overflow-y-auto max-h-[500px] custom-scrollbar">
                    {jugadorasFiltradas.map(j => (
                        <div key={j.id} onClick={() => setSeleccionada(j)} className={`p-4 border-b border-white/5 cursor-pointer transition-all flex justify-between items-center ${seleccionada?.id === j.id ? 'bg-blue-600/20 border-l-4 border-l-blue-500 shadow-inner' : 'hover:bg-white/5'}`}>
                            <div className="uppercase font-black text-[11px] text-slate-200">{j.apellido}, {j.nombre}</div>
                        </div>
                    ))}
                </div>
            </div>
            {/* PANEL DERECHO CON SCROLL PARA FRENTE Y QR */}
            <div className="lg:col-span-8 bg-black/40 flex flex-col items-center justify-start p-10 overflow-y-auto max-h-[650px] space-y-10 custom-scrollbar">
                {seleccionada ? (
                    <div className="scale-95 lg:scale-105 transform transition-all flex flex-col items-center space-y-8">
                        <div className="shadow-2xl rounded-xl border border-white/10 overflow-hidden">
                            <CarnetJugadora 
                              jugadora={{...seleccionada, equipos: { nombre: clubesMap[seleccionada.equipo_id]?.nombre, logo_url: clubesMap[seleccionada.equipo_id]?.logo }}} 
                              config={configLiga} 
                            />
                        </div>
                        <div className="shadow-2xl rounded-xl border border-white/10 overflow-hidden">
                            <CarnetJugadora 
                              jugadora={{...seleccionada, equipos: { nombre: clubesMap[seleccionada.equipo_id]?.nombre, logo_url: clubesMap[seleccionada.equipo_id]?.logo }}} 
                              config={configLiga} 
                              mostrarDorso={true} 
                            />
                        </div>
                    </div>
                ) : (
                    <div className="m-auto opacity-20 uppercase font-black text-xs tracking-widest text-center">Selecciona del listado</div>
                )}
            </div>
        </div>
      </section>

      {/* 4. LIENZO MASIVO (PARES FRENTE/DORSO + 2MM GAP) */}
      {verLienzo && (
        <section className="bg-white p-4 rounded-[3rem] border-8 border-slate-900 shadow-2xl overflow-hidden animate-in zoom-in duration-300">
          <p className="text-black font-black text-center text-[10px] mb-4 uppercase tracking-[1em]">Previsualización Técnica (1000mm)</p>
          <div className="max-h-[600px] overflow-auto p-12 bg-slate-100 rounded-[2rem] custom-scrollbar shadow-inner">
              {tipoLienzo === 'delegados' ? (
                <div ref={lienzoDelegadosRef} className="grid bg-white" style={{ width: '1000mm', height: '1000mm', gridTemplateColumns: 'repeat(12, 66.8mm)', gridAutoRows: '86.9mm', gap: '2mm', padding: '10mm' }}>
                  {delegadosLiga.map(del => <CarnetDelDelegado key={del.id} data={del} clubNombre={clubesMap[del.club_id]?.nombre} soloDiseño={true} configLiga={configLiga} />)}
                </div>
              ) : (
                <div ref={lienzoJugadorasRef} className="grid bg-white" style={{ width: '1000mm', height: '1000mm', gridTemplateColumns: 'repeat(4, 175mm)', gridAutoRows: '56mm', gap: '2mm', padding: '10mm' }}>
                  {jugadorasLiga.map(jug => (
                    <div key={jug.id} className="flex gap-[2mm]">
                      <CarnetJugadora jugadora={{...jug, equipos: { nombre: clubesMap[jug.equipo_id]?.nombre, logo_url: clubesMap[jug.equipo_id]?.logo }}} config={configLiga} />
                      <CarnetJugadora jugadora={{...jug, equipos: { nombre: clubesMap[jug.equipo_id]?.nombre, logo_url: clubesMap[jug.equipo_id]?.logo }}} config={configLiga} mostrarDorso={true} />
                    </div>
                  ))}
                </div>
              )}
          </div>
        </section>
      )}

      {/* 5. GESTIÓN SaaS E HISTORIAL */}
      <main className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-xl">
                <h2 className="text-xl font-black uppercase italic text-blue-500 mb-6 flex items-center gap-3"><DocumentDuplicateIcon className="w-5 h-5"/> Configuración</h2>
                <input type="text" className="w-full bg-slate-950 p-5 rounded-2xl border border-slate-800 outline-none font-bold uppercase text-sm mb-4" value={configActual.nombre_edicion} onChange={(e) => setConfigActual({...configActual, nombre_edicion: e.target.value})} />
                <button onClick={guardarTorneo} className="w-full bg-blue-600 py-4 rounded-2xl font-black uppercase text-[10px]">Guardar Temporada</button>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-xl max-h-[300px] overflow-hidden flex flex-col">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 italic">Ranking Ligas</h3>
                <div className="overflow-y-auto flex-1 space-y-2 custom-scrollbar">
                    {rankingLigas.map(l => (
                        <div key={l.id} className="bg-slate-950 p-4 rounded-xl border border-white/5 flex justify-between items-center"><p className="text-xs font-bold uppercase text-slate-300">{l.nombre}</p><button onClick={() => { setUserOrgId(l.id); setNombreLigaActiva(l.nombre); }} className="text-[9px] font-black text-blue-500">GESTIONAR</button></div>
                    ))}
                </div>
              </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-xl space-y-6">
            <h2 className="text-xl font-black uppercase italic text-rose-600 flex items-center gap-3"><PlusIcon className="w-6 h-6"/> Nueva Liga SaaS</h2>
            <form onSubmit={crearNuevaLiga} className="space-y-4">
              <input type="text" required placeholder="Nombre Liga" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs uppercase" value={nombreLigaForm} onChange={(e) => setNombreLigaForm(e.target.value)} />
              <div className="grid grid-cols-2 gap-4">
                <input type="email" required placeholder="Email Admin" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs" value={emailAdminForm} onChange={(e) => setEmailAdminForm(e.target.value)} />
                <input type="password" required placeholder="Pass Inicial" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs" value={passwordAdminForm} onChange={(e) => setPasswordAdminForm(e.target.value)} />
              </div>
              <button type="submit" className="w-full bg-rose-600 py-5 rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95">Instalar Liga</button>
            </form>
          </div>
      </main>

      {/* MODAL BIENVENIDA */}
      {kitBienvenida && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[500] flex items-center justify-center p-4">
           <div className="bg-white text-slate-950 p-10 rounded-[3rem] text-center space-y-6 max-w-sm shadow-2xl animate-in zoom-in duration-300">
              <CheckCircleIcon className="w-16 h-16 text-emerald-500 mx-auto" />
              <h2 className="text-3xl font-black uppercase italic tracking-tighter">Liga Instalada</h2>
              <p className="text-xs text-slate-500 font-bold uppercase">Admin: {kitBienvenida.email}</p>
              <button onClick={() => setKitBienvenida(null)} className="w-full bg-slate-950 text-white py-4 rounded-2xl font-black uppercase text-xs">Cerrar</button>
           </div>
        </div>
      )}

      {/* REFS OCULTAS PARA IMPRESIÓN (JUGADORAS CON FRENTE Y DORSO) */}
      <div style={{ position: 'absolute', left: '-9999px', top: '0', pointerEvents: 'none' }}>
        <div ref={lienzoDelegadosRef} className="grid bg-white" style={{ width: '1000mm', height: '1000mm', gridTemplateColumns: 'repeat(12, 66.8mm)', gridAutoRows: '86.9mm', gap: '2mm', padding: '10mm' }}>
           {delegadosLiga.map(del => <CarnetDelDelegado key={del.id} data={del} clubNombre={clubesMap[del.club_id]?.nombre} soloDiseño={true} configLiga={configLiga} />)}
        </div>
        <div ref={lienzoJugadorasRef} className="grid bg-white" style={{ width: '1000mm', height: '1000mm', gridTemplateColumns: 'repeat(4, 175mm)', gridAutoRows: '56mm', gap: '2mm', padding: '10mm' }}>
           {jugadorasLiga.map(jug => (
              <div key={jug.id} style={{ display: 'flex', gap: '2mm' }}>
                  <CarnetJugadora jugadora={{...jug, equipos: { nombre: clubesMap[jug.equipo_id]?.nombre, logo_url: clubesMap[jug.equipo_id]?.logo }}} config={configLiga} />
                  <CarnetJugadora jugadora={{...jug, equipos: { nombre: clubesMap[jug.equipo_id]?.nombre, logo_url: clubesMap[jug.equipo_id]?.logo }}} config={configLiga} mostrarDorso={true} />
              </div>
           ))}
        </div>
      </div>

    </div>
  );
};

export default SuperAdminDashboard;