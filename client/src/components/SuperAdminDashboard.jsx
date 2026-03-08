import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { 
  PrinterIcon, EyeIcon, DocumentDuplicateIcon, 
  UserGroupIcon, UserIcon, CheckCircleIcon, PlusIcon,
  MagnifyingGlassIcon, ShieldExclamationIcon, TrashIcon
} from '@heroicons/react/24/solid';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

import { CarnetDelDelegado } from './GestionDelegados'; 
import CarnetJugadora from './CarnetJugadora'; 

const SuperAdminDashboard = () => {
  const navigate = useNavigate();

  // --- 1. ESTADOS DE CONTROL ---
  const [userOrgId, setUserOrgId] = useState(null);
  const [nombreLigaActiva, setNombreLigaActiva] = useState("Cargando...");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionada, setSeleccionada] = useState(null);

  // --- 2. ESTADOS SaaS (KPIs Y LIGAS) ---
  const [stats, setStats] = useState({ ligas: 0, jugadoras: 0, alertas: 0 });
  const [rankingLigas, setRankingLigas] = useState([]);
  const [nombreLigaForm, setNombreLigaForm] = useState('');
  const [emailAdminForm, setEmailAdminForm] = useState('');
  const [passwordAdminForm, setPasswordAdminForm] = useState('');
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  // eslint-disable-next-line no-unused-vars
  const [kitBienvenida, setKitBienvenida] = useState(null);

  // --- 3. ESTADOS DE DATA LIGA ---
  const [configActual, setConfigActual] = useState({ id: null, nombre_edicion: '', modelo_torneo: 'todos_contra_todos', año_lectivo: 2026, valor_modulo: 1000 });
  const [delegadosLiga, setDelegadosLiga] = useState([]);
  const [jugadorasLiga, setJugadorasLiga] = useState([]); 
  const [clubesMap, setClubesMap] = useState({}); 
  const [configLiga, setConfigLiga] = useState(null);

  // --- 4. ESTADOS IMPRESIÓN ---
  const [generandoLona, setGenerandoLona] = useState(false); 
  const [verLienzo, setVerLienzo] = useState(false); 
  const [tipoLienzo, setTipoLienzo] = useState('jugadoras'); 
  
  const lienzoDelegadosRef = useRef(null);
  const lienzoJugadorasRef = useRef(null);

  // --- EFECTO: CARGA INICIAL SaaS (SOLUCIÓN AL ERROR 'perfil') ---
  useEffect(() => {
    const cargarContextoGlobal = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate('/login');

      // Obtenemos el perfil y lo usamos para establecer la organización inicial
      const { data: perfil } = await supabase.from('perfiles').select('organizacion_id').eq('id', user.id).single();
      
      if (perfil?.organizacion_id) {
        setUserOrgId(perfil.organizacion_id);
        // Intentamos ponerle nombre a esa organización
        const { data: miOrg } = await supabase.from('organizaciones').select('nombre').eq('id', perfil.organizacion_id).single();
        if (miOrg) setNombreLigaActiva(miOrg.nombre);
      } else {
        // Si el admin no tiene org, cargamos la primera disponible
        const { data: orgs } = await supabase.from('organizaciones').select('id, nombre').limit(1);
        if (orgs?.length > 0) {
          setUserOrgId(orgs[0].id);
          setNombreLigaActiva(orgs[0].nombre);
        }
      }

      // Cargar KPIs
      const { count: l } = await supabase.from('organizaciones').select('*', { count: 'exact', head: true });
      const { count: j } = await supabase.from('jugadoras').select('*', { count: 'exact', head: true });
      const { count: a } = await supabase.from('jugadoras').select('*', { count: 'exact', head: true }).or('verificacion_biometrica_estado.eq.rechazado,distancia_biometrica_oficial.gt.0.6');
      setStats({ ligas: l || 0, jugadoras: j || 0, alertas: a || 0 });

      // Cargar Ranking
      const { data: listadoOrgs } = await supabase.from('organizaciones').select('id, nombre').limit(5);
      if (listadoOrgs) {
        const ranking = await Promise.all(listadoOrgs.map(async (o) => {
          const { count } = await supabase.from('jugadoras').select('*', { count: 'exact', head: true }).eq('organizacion_id', o.id);
          return { ...o, totalJugadoras: count || 0 };
        }));
        setRankingLigas(ranking);
      }
      setLoading(false);
    };
    cargarContextoGlobal();
  }, [navigate]);

  // --- EFECTO: CARGA DE DATOS DE LIGA ---
  useEffect(() => {
    if (!userOrgId) return;
    const cargarInformacionDeLiga = async () => {
      // 1. Equipos con Escudos
      const { data: equipos } = await supabase.from('equipos').select('id, nombre, logo_url').eq('organizacion_id', userOrgId);
      const mapping = {}; 
      equipos?.forEach(e => { mapping[e.id] = { nombre: e.nombre, logo: e.logo_url }; });
      setClubesMap(mapping);

      // 2. Configuración
      const { data: configT } = await supabase.from('configuracion_torneo').select('*').eq('organizacion_id', userOrgId).order('id', { ascending: false }).limit(1).maybeSingle();
      if (configT) setConfigActual(configT);
      const { data: cLiga } = await supabase.from('configuracion_liga').select('*').eq('organizacion_id', userOrgId).maybeSingle();
      setConfigLiga(cLiga);

      // 3. Personas (Delegados con seguro anti-error 400)
      try {
        const { data: dels } = await supabase.from('delegados').select('*').eq('organizacion_id', userOrgId);
        setDelegadosLiga(dels || []);
      // eslint-disable-next-line no-unused-vars
      } catch (e) { setDelegadosLiga([]); }

      const { data: jugs } = await supabase.from('jugadoras').select('*').eq('organizacion_id', userOrgId);
      setJugadorasLiga(jugs || []);
      if (jugs?.length > 0) setSeleccionada(jugs[0]);
    };
    cargarInformacionDeLiga();
  }, [userOrgId, refreshTrigger]);

  // FILTRO
  const jugadorasFiltradas = jugadorasLiga.filter(j => 
    j.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
    j.apellido?.toLowerCase().includes(busqueda.toLowerCase()) ||
    j.dni.includes(busqueda)
  );

  // ACCIONES
  const guardarCambiosTorneo = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const { data, error } = await supabase.from('configuracion_torneo').upsert({
        ...configActual, organizacion_id: userOrgId, configurado_por: session.user.id
      }).select().single();
      if (!error) { alert("✅ Guardado"); setConfigActual(data); setRefreshTrigger(prev => prev + 1); }
    // eslint-disable-next-line no-unused-vars
    } catch (e) { alert("Error"); }
  };

  const crearNuevaLiga = async (e) => {
    e.preventDefault();
    try {
      const { data: org } = await supabase.from('organizaciones').insert([{ nombre: nombreLigaForm, slug: nombreLigaForm.toLowerCase().replace(/ /g, '-') }]).select().single();
      const { data: auth } = await supabase.auth.signUp({ email: emailAdminForm, password: passwordAdminForm, options: { data: { rol: 'admin_liga', organizacion_id: org.id } } });
      await supabase.from('perfiles').insert([{ id: auth.user.id, email: emailAdminForm, rol: 'admin_liga', organizacion_id: org.id }]);
      setKitBienvenida({ email: emailAdminForm, password: passwordAdminForm });
      setMensaje({ tipo: 'success', texto: 'Liga creada.' });
    } catch (err) { setMensaje({ tipo: 'error', texto: err.message }); }
  };

  const descargarPDF = async (ref, nombre) => {
    setGenerandoLona(true);
    try {
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: [1000, 1000] });
      const canvas = await html2canvas(ref.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 1000, 1000);
      doc.save(`${nombre}_${new Date().getTime()}.pdf`);
    // eslint-disable-next-line no-unused-vars
    } catch (e) { alert("Error PDF"); }
    setGenerandoLona(false);
  };

  if (loading) return <div className="min-h-screen bg-[#0a0f18] flex items-center justify-center font-black animate-pulse text-white uppercase tracking-widest">Sincronizando Sistema Maestro...</div>;

  return (
    <div className="p-4 md:p-8 bg-[#0a0f18] min-h-screen text-white space-y-10 font-sans">
      
      {/* HEADER */}
      <header className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-center gap-6 border-b border-slate-800 pb-8">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter">CONTROL <span className="text-rose-600">MAESTRO</span></h1>
          <p className="text-emerald-500 text-[10px] font-black uppercase mt-1">Liga Activa: {nombreLigaActiva}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setVerLienzo(!verLienzo)} className={`px-6 py-3 rounded-2xl text-[10px] font-black flex items-center gap-2 border transition-all ${verLienzo ? 'bg-rose-600 border-rose-400' : 'bg-slate-800 border-slate-700'}`}>
            <EyeIcon className="w-5 h-5" /> {verLienzo ? 'CERRAR PLIEGO' : 'PREPARAR PLIEGO 1MT²'}
          </button>
          <button disabled={generandoLona} onClick={() => descargarPDF(lienzoJugadorasRef, 'LONA_COMPLETA')} className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-2xl text-[10px] font-black flex items-center gap-2 shadow-lg disabled:opacity-50">
            <PrinterIcon className="w-5 h-5" /> {generandoLona ? '...' : 'IMPRIMIR PLIEGO JUGADORAS'}
          </button>
        </div>
      </header>

      {/* KPIs */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl text-center">
          <p className="text-slate-500 font-black text-[10px] uppercase">Ligas</p>
          <h3 className="text-5xl font-black mt-2">{stats.ligas}</h3>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl border-b-emerald-500 text-center">
          <p className="text-emerald-500 font-black text-[10px] uppercase">Jugadoras</p>
          <h3 className="text-5xl font-black mt-2 text-emerald-500">{stats.jugadoras}</h3>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl border-b-rose-600 text-center">
          <p className="text-rose-600 font-black text-[10px] uppercase">Alertas</p>
          <h3 className={`text-5xl font-black mt-2 ${stats.alertas > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-700'}`}>{stats.alertas}</h3>
        </div>
      </div>

      {/* ESTACIÓN DE TRABAJO (LISTADO + PREVIEW) */}
      <section className="max-w-7xl mx-auto bg-slate-900/50 rounded-[3rem] border border-white/5 overflow-hidden shadow-2xl">
        <div className="p-6 bg-white/5 border-b border-white/5">
            <h2 className="text-xl font-black uppercase italic text-slate-200">Visor de Calidad</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[650px]">
            {/* PANEL IZQUIERDO */}
            <div className="lg:col-span-4 border-r border-white/5 flex flex-col bg-slate-950/30">
                <div className="p-5">
                    <div className="relative">
                        <MagnifyingGlassIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                        <input type="text" className="w-full bg-slate-950 border border-slate-800 p-4 pl-12 rounded-2xl text-xs outline-none focus:border-blue-500 transition-all font-bold" placeholder="Buscar..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto max-h-[550px] custom-scrollbar">
                    {jugadorasFiltradas.map(j => (
                        <div key={j.id} onClick={() => setSeleccionada(j)} className={`p-5 border-b border-white/5 cursor-pointer transition-all flex justify-between items-center ${seleccionada?.id === j.id ? 'bg-blue-600/20 border-l-4 border-l-blue-500' : 'hover:bg-white/5'}`}>
                            <div><h4 className="text-[12px] font-black uppercase">{j.apellido}, {j.nombre}</h4><p className="text-[9px] text-slate-500">DNI: {j.dni}</p></div>
                            <span className="text-[9px] font-black text-blue-400 uppercase">{j.categoria_actual || "S/C"}</span>
                        </div>
                    ))}
                </div>
            </div>
            {/* PANEL DERECHO CON SCROLL */}
            <div className="lg:col-span-8 bg-black/40 flex flex-col items-center justify-start p-6 lg:p-12 overflow-y-auto max-h-[650px] space-y-10 custom-scrollbar">
                {seleccionada ? (
                    <div className="scale-90 lg:scale-105 transform transition-all flex flex-col items-center space-y-10">
                        <div className="shadow-2xl rounded-xl border border-white/5 overflow-hidden">
                            <CarnetJugadora jugadora={{...seleccionada, equipos: { nombre: clubesMap[seleccionada.equipo_id]?.nombre, logo_url: clubesMap[seleccionada.equipo_id]?.logo }}} config={configLiga} />
                        </div>
                        <div className="shadow-2xl rounded-xl border border-white/5 overflow-hidden">
                            <CarnetJugadora jugadora={{...seleccionada, equipos: { nombre: clubesMap[seleccionada.equipo_id]?.nombre, logo_url: clubesMap[seleccionada.equipo_id]?.logo }}} config={configLiga} mostrarDorso={true} />
                        </div>
                    </div>
                ) : (
                    <div className="m-auto text-center opacity-20"><UserIcon className="w-20 h-20 mx-auto" /><p className="text-xs font-black uppercase mt-4">Selecciona del listado</p></div>
                )}
            </div>
        </div>
      </section>

      {/* LIENZO MASIVO (2MM GAP + PARES) */}
      {verLienzo && (
        <section className="max-w-7xl mx-auto space-y-6 animate-in zoom-in duration-300">
          <div className="flex bg-slate-900 p-1.5 rounded-2xl w-fit border border-slate-800">
            <button onClick={() => setTipoLienzo('delegados')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${tipoLienzo === 'delegados' ? 'bg-emerald-600' : 'text-slate-500'}`}>Delegados</button>
            <button onClick={() => setTipoLienzo('jugadoras')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${tipoLienzo === 'jugadoras' ? 'bg-blue-600' : 'text-slate-500'}`}>Jugadoras (Frente+Dorso)</button>
          </div>
          <div className="bg-white p-4 rounded-[3rem] border-8 border-slate-950 shadow-2xl overflow-hidden">
            <div className="max-h-[800px] overflow-auto p-12 bg-slate-100 rounded-[2.5rem] custom-scrollbar shadow-inner">
              {tipoLienzo === 'delegados' ? (
                <div ref={lienzoDelegadosRef} className="grid bg-white" style={{ width: '1000mm', height: '1000mm', gridTemplateColumns: 'repeat(12, 66.8mm)', gridAutoRows: '86.9mm', gap: '2mm', padding: '10mm' }}>
                  {delegadosLiga.map(del => <CarnetDelDelegado key={del.id} data={del} clubNombre={clubesMap[del.club_id]?.nombre} soloDiseño={true} configLiga={configLiga} />)}
                </div>
              ) : (
                <div ref={lienzoJugadorasRef} className="grid bg-white" style={{ width: '1000mm', height: '1000mm', gridTemplateColumns: 'repeat(4, 175mm)', gridAutoRows: '58mm', gap: '2mm', padding: '10mm' }}>
                  {jugadorasLiga.map(jug => (
                    <div key={jug.id} className="flex gap-[2mm]">
                      <CarnetJugadora jugadora={{...jug, equipos: { nombre: clubesMap[jug.equipo_id]?.nombre, logo_url: clubesMap[jug.equipo_id]?.logo }}} config={configLiga} />
                      <CarnetJugadora jugadora={{...jug, equipos: { nombre: clubesMap[jug.equipo_id]?.nombre, logo_url: clubesMap[jug.equipo_id]?.logo }}} config={configLiga} mostrarDorso={true} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* GESTIÓN Y SaaS */}
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="space-y-8">
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-xl">
                <h2 className="text-xl font-black uppercase italic text-blue-500 mb-6 flex items-center gap-3"><DocumentDuplicateIcon className="w-6 h-6"/> Torneo Activo</h2>
                <input type="text" className="w-full bg-slate-950 p-5 rounded-2xl border border-slate-800 outline-none font-bold uppercase text-sm mb-4" value={configActual.nombre_edicion} onChange={(e) => setConfigActual({...configActual, nombre_edicion: e.target.value})} />
                <button onClick={guardarCambiosTorneo} className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase text-xs">Guardar Configuración</button>
            </div>
            {/* HISTORIAL: Altura limitada */}
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-xl max-h-[350px] overflow-hidden flex flex-col">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Archivo de Temporadas</h3>
                <div className="overflow-y-auto custom-scrollbar flex-1">
                    <HistorialTorneos userOrgId={userOrgId} onEdit={setConfigActual} refreshTrigger={refreshTrigger} />
                </div>
            </div>
        </div>

        <div className="space-y-8">
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-xl">
                <h2 className="text-xl font-black uppercase italic text-rose-600 mb-6 flex items-center gap-3"><PlusIcon className="w-6 h-6"/> Nueva Liga SaaS</h2>
                <form onSubmit={crearNuevaLiga} className="space-y-4">
                    <input type="text" required className="w-full bg-slate-950 p-5 rounded-2xl border border-slate-800 uppercase font-bold text-sm" placeholder="Nombre Liga" value={nombreLigaForm} onChange={(e) => setNombreLigaForm(e.target.value)} />
                    <input type="email" required className="w-full bg-slate-950 p-5 rounded-2xl border border-slate-800 font-bold text-sm" placeholder="Email Admin" value={emailAdminForm} onChange={(e) => setEmailAdminForm(e.target.value)} />
                    <input type="password" required className="w-full bg-slate-950 p-5 rounded-2xl border border-slate-800 font-bold text-sm" placeholder="Password" value={passwordAdminForm} onChange={(e) => setPasswordAdminForm(e.target.value)} />
                    <button type="submit" className="w-full bg-rose-600 py-5 rounded-2xl font-black uppercase text-xs transition-all active:scale-95 shadow-lg">🚀 Instalar Nueva Liga</button>
                    {mensaje.texto && <div className={`p-4 rounded-xl text-center text-[10px] font-black uppercase ${mensaje.tipo === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-600'} mt-4`}>{mensaje.texto}</div>}
                </form>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-950 p-4 text-[9px] font-black uppercase text-slate-500 tracking-widest">
                        <tr><th className="p-6">Últimas Ligas</th><th className="p-6 text-right">Acción</th></tr>
                    </thead>
                    <tbody className="text-xs">
                        {rankingLigas.map(liga => (
                            <tr key={liga.id} className="border-b border-white/5 hover:bg-white/5 transition-all">
                                <td className="p-6 font-bold uppercase">{liga.nombre} <br/><span className="text-[8px] text-emerald-500 font-black">{liga.totalJugadoras} Jugadoras</span></td>
                                <td className="p-6 text-right">
                                    <button onClick={() => { setUserOrgId(liga.id); setNombreLigaActiva(liga.nombre); }} className="bg-slate-800 hover:bg-blue-600 px-4 py-2 rounded-xl text-[8px] font-black border border-white/10 uppercase">GESTIONAR</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </main>

      {/* REFS OCULTAS */}
      <div style={{ position: 'absolute', left: '-9999px', top: '0', pointerEvents: 'none' }}>
        <div ref={lienzoDelegadosRef} className="grid bg-white" style={{ width: '1000mm', height: '1000mm', gridTemplateColumns: 'repeat(12, 66.8mm)', gridAutoRows: '86.9mm', gap: '2mm', padding: '10mm' }}>
           {delegadosLiga.map(del => <CarnetDelDelegado key={del.id} data={del} clubNombre={clubesMap[del.club_id]?.nombre} soloDiseño={true} configLiga={configLiga} />)}
        </div>
        <div ref={lienzoJugadorasRef} className="grid bg-white" style={{ width: '1000mm', height: '1000mm', gridTemplateColumns: 'repeat(4, 175mm)', gridAutoRows: '58mm', gap: '2mm', padding: '10mm' }}>
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

const HistorialTorneos = ({ userOrgId, onEdit, refreshTrigger }) => {
  const [historial, setHistorial] = useState([]);
  useEffect(() => {
    if (!userOrgId) return;
    const load = async () => {
      const { data } = await supabase.from('configuracion_torneo').select('*').eq('organizacion_id', userOrgId).order('id', { ascending: false });
      if (data) setHistorial(data);
    };
    load();
  }, [userOrgId, refreshTrigger]);

  const activar = async (id) => {
    await supabase.from('configuracion_torneo').update({ activo: false }).eq('organizacion_id', userOrgId);
    await supabase.from('configuracion_torneo').update({ activo: true }).eq('id', id);
    alert("Activada");
    const { data } = await supabase.from('configuracion_torneo').select('*').eq('organizacion_id', userOrgId).order('id', { ascending: false });
    if (data) setHistorial(data);
  };

  return (
    <div className="space-y-3">
        {historial.map((t) => (
          <div key={t.id} className="bg-slate-950 p-4 rounded-xl border border-white/5 flex justify-between items-center">
            <div className="cursor-pointer" onClick={() => onEdit(t)}>
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${t.activo ? 'bg-emerald-500' : 'bg-slate-800'}`}></span>
                <h4 className="font-bold uppercase text-slate-200 text-xs">{t.nombre_edicion}</h4>
              </div>
            </div>
            {!t.activo && <button onClick={() => activar(t.id)} className="bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white px-3 py-1.5 rounded-lg text-[8px] font-black uppercase">Activar</button>}
          </div>
        ))}
    </div>
  );
};

export default SuperAdminDashboard;