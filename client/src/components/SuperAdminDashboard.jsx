import React, { useState, useEffect, useRef } from 'react'; // Quitamos useCallback
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { 
  PrinterIcon, EyeIcon, DocumentDuplicateIcon, 
  UserGroupIcon, UserIcon, CheckCircleIcon, PlusIcon 
} from '@heroicons/react/24/solid';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

import { CarnetDelDelegado } from './GestionDelegados'; 
import CarnetJugadora from './CarnetJugadora'; 

const SuperAdminDashboard = () => {
  const navigate = useNavigate();

  // --- ESTADOS DE CONTROL ---
  const [userOrgId, setUserOrgId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [loading, setLoading] = useState(true);

  // --- ESTADOS SAAS (LIGAS) ---
  const [nombreLiga, setNombreLiga] = useState('');
  const [emailAdmin, setEmailAdmin] = useState('');
  const [passwordAdmin, setPasswordAdmin] = useState('');
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  const [stats, setStats] = useState({ ligas: 0, jugadoras: 0, alertas: 0 });
  const [rankingLigas, setRankingLigas] = useState([]);
  const [kitBienvenida, setKitBienvenida] = useState(null); 

  // --- ESTADOS CONFIGURACIÓN TORNEO ---
  const [configActual, setConfigActual] = useState({
    id: null,
    nombre_edicion: '',
    modelo_torneo: 'todos_contra_todos',
    año_lectivo: 2026,
    valor_modulo: 1000,
    dias_juego: [],
  });

  // --- ESTADOS IMPRESIÓN ---
  const [delegadosLiga, setDelegadosLiga] = useState([]);
  const [jugadorasLiga, setJugadorasLiga] = useState([]); 
  const [clubesMap, setClubesMap] = useState({});
  const [configLiga, setConfigLiga] = useState(null);
  const [generandoLona, setGenerandoLona] = useState(false); 
  const [verLienzo, setVerLienzo] = useState(false); 
  const [tipoLienzo, setTipoLienzo] = useState('delegados'); 
  
  const lienzoDelegadosRef = useRef(null);
  const lienzoJugadorasRef = useRef(null);

  // 1. CARGA DE CONTEXTO INICIAL
  useEffect(() => {
    const cargarContexto = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate('/login');

      const { data: perfilData } = await supabase.from('perfiles').select('organizacion_id').eq('id', user.id).single();
      if (perfilData) setUserOrgId(perfilData.organizacion_id);
      
      const cargarStats = async () => {
        const { count: l } = await supabase.from('organizaciones').select('*', { count: 'exact', head: true });
        const { count: j } = await supabase.from('jugadoras').select('*', { count: 'exact', head: true });
        const { count: a } = await supabase.from('jugadoras').select('*', { count: 'exact', head: true }).or('verificacion_biometrica_estado.eq.rechazado,distancia_biometrica_oficial.gt.0.6');
        setStats({ ligas: l || 0, jugadoras: j || 0, alertas: a || 0 });
      };

      const cargarRanking = async () => {
        const { data: orgs } = await supabase.from('organizaciones').select('id, nombre').limit(5);
        if (orgs) {
          const ranking = await Promise.all(orgs.map(async (o) => {
            const { count } = await supabase.from('jugadoras').select('*', { count: 'exact', head: true }).eq('organizacion_id', o.id);
            return { ...o, totalJugadoras: count || 0 };
          }));
          setRankingLigas(ranking);
        }
      };

      await Promise.all([cargarStats(), cargarRanking()]);
      setLoading(false);
    };
    cargarContexto();
  }, [navigate]);

  // 2. CARGA DE DATA DE LA LIGA SELECCIONADA
  useEffect(() => {
    if (!userOrgId) return;

    const cargarDataLiga = async () => {
      const { data: config } = await supabase.from('configuracion_torneo').select('*').eq('organizacion_id', userOrgId).order('id', { ascending: false }).limit(1).maybeSingle();
      if (config) setConfigActual(config);

      const { data: cLiga } = await supabase.from('configuracion_liga').select('*').eq('organizacion_id', userOrgId).maybeSingle();
      setConfigLiga(cLiga);

      const { data: equipos } = await supabase.from('equipos').select('id, nombre').eq('organizacion_id', userOrgId);
      const mapping = {};
      equipos?.forEach(e => mapping[e.id] = e.nombre);
      setClubesMap(mapping);

      const { data: dels } = await supabase.from('delegados').select('*').eq('organizacion_id', userOrgId);
      setDelegadosLiga(dels || []);
      
      const { data: jugs } = await supabase.from('jugadoras').select('*').eq('organizacion_id', userOrgId).eq('estado_habil_admin', true);
      setJugadorasLiga(jugs || []);
    };

    cargarDataLiga();
  }, [userOrgId, refreshTrigger]);

  // 3. LOGICA DE IMPRESIÓN
  const descargarPliego = async (ref, nombre) => {
    if (!ref.current) return;
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

  const guardarCambiosTorneo = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!userOrgId || !session) return alert("Sesión inválida");
    try {
      const { data, error } = await supabase.from('configuracion_torneo').upsert({
        ...configActual,
        organizacion_id: userOrgId,
        configurado_por: session.user.id
      }).select().single();
      if (!error) {
        alert("✅ Torneo actualizado");
        setConfigActual(data);
        setRefreshTrigger(prev => prev + 1);
      }
    // eslint-disable-next-line no-unused-vars
    } catch (err) { alert("Error"); }
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
      
      setKitBienvenida({ email: emailAdmin, password: passwordAdmin });
      setMensaje({ tipo: 'success', texto: `Liga ${nombreLiga} creada.` });
    } catch (error) { setMensaje({ tipo: 'error', texto: error.message }); }
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen bg-[#0a0f18] flex items-center justify-center font-black animate-pulse text-white">CONECTANDO AL NÚCLEO...</div>;

  return (
    <div className="p-4 md:p-8 bg-[#0a0f18] min-h-screen text-white space-y-10 font-sans">
      
      {/* HEADER */}
      <header className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-center gap-6 border-b border-slate-800 pb-8">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter">CONTROL <span className="text-rose-600">MAESTRO</span></h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-1">SaaS Infrastructure NCS-1125</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setVerLienzo(!verLienzo)} className={`px-6 py-3 rounded-2xl text-[10px] font-black flex items-center gap-2 border transition-all ${verLienzo ? 'bg-rose-600 border-rose-400' : 'bg-slate-800 border-slate-700'}`}>
            <EyeIcon className="w-5 h-5 text-blue-400" /> {verLienzo ? 'CERRAR PREVIEW' : 'VISUALIZAR PLIEGOS'}
          </button>
          <button disabled={generandoLona} onClick={() => descargarPliego(lienzoDelegadosRef, 'PLIEGO_DELEGADOS')} className="bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-2xl text-[10px] font-black flex items-center gap-2 shadow-lg disabled:opacity-50">
            <PrinterIcon className="w-5 h-5" /> {generandoLona ? 'PROCESANDO...' : 'LONA DELEGADOS'}
          </button>
          <button disabled={generandoLona} onClick={() => descargarPliego(lienzoJugadorasRef, 'PLIEGO_JUGADORAS')} className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-2xl text-[10px] font-black flex items-center gap-2 shadow-lg disabled:opacity-50">
            <PrinterIcon className="w-5 h-5" /> {generandoLona ? 'PROCESANDO...' : 'LONA JUGADORAS'}
          </button>
        </div>
      </header>

      {/* KPIs */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl text-center">
          <p className="text-slate-500 font-black text-[10px] uppercase">Ligas SaaS</p>
          <h3 className="text-5xl font-black italic mt-2">{stats.ligas}</h3>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl border-b-emerald-500 text-center">
          <p className="text-emerald-500 font-black text-[10px] uppercase">Jugadoras Activas</p>
          <h3 className="text-5xl font-black italic mt-2 text-emerald-500">{stats.jugadoras}</h3>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl border-b-rose-600 text-center">
          <p className="text-rose-600 font-black text-[10px] uppercase">Alertas Biometría</p>
          <h3 className={`text-5xl font-black italic mt-2 ${stats.alertas > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-700'}`}>{stats.alertas}</h3>
        </div>
      </div>

      {/* PREVIEW */}
      {verLienzo && (
        <section className="max-w-7xl mx-auto animate-in zoom-in duration-300 space-y-6">
          <div className="flex bg-slate-900 p-1.5 rounded-2xl w-fit border border-slate-800">
            <button onClick={() => setTipoLienzo('delegados')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${tipoLienzo === 'delegados' ? 'bg-emerald-600' : 'text-slate-500'}`}>Delegados</button>
            <button onClick={() => setTipoLienzo('jugadoras')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${tipoLienzo === 'jugadoras' ? 'bg-blue-600' : 'text-slate-500'}`}>Jugadoras</button>
          </div>
          <div className="bg-white p-4 rounded-[3rem] border-8 border-slate-900 overflow-hidden shadow-2xl">
            <div className="max-h-[600px] overflow-auto p-10 bg-slate-50 rounded-[2rem] custom-scrollbar">
              {tipoLienzo === 'delegados' ? (
                <div ref={lienzoDelegadosRef} className="grid gap-2 bg-white" style={{ width: '1000mm', height: '1000mm', gridTemplateColumns: 'repeat(12, 66.8mm)', gridAutoRows: '86.9mm', padding: '10mm' }}>
                  {delegadosLiga.map(del => <CarnetDelDelegado key={del.id} data={del} clubNombre={clubesMap[del.club_id] || "CLUB"} soloDiseño={true} configLiga={configLiga} />)}
                </div>
              ) : (
                <div ref={lienzoJugadorasRef} className="grid gap-4 bg-white" style={{ width: '1000mm', height: '1000mm', gridTemplateColumns: 'repeat(8, 85.6mm)', gridAutoRows: '54mm', padding: '10mm' }}>
                  {jugadorasLiga.map(jug => <CarnetJugadora key={jug.id} jugadora={{...jug, equipos: { nombre: clubesMap[jug.equipo_id] }}} config={configLiga} />)}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* DASHBOARD */}
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="space-y-8">
           <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-xl">
              <h2 className="text-xl font-black uppercase italic mb-6 text-blue-500 flex items-center gap-2"><DocumentDuplicateIcon className="w-6 h-6"/> Configuración Torneo</h2>
              <div className="space-y-4">
                <input type="text" className="w-full bg-slate-950 p-5 rounded-2xl border border-slate-800 outline-none font-bold" value={configActual.nombre_edicion} onChange={(e) => setConfigActual({...configActual, nombre_edicion: e.target.value})} placeholder="Nombre de Edición" />
                <div className="grid grid-cols-2 gap-4">
                  <select className="bg-slate-950 p-5 rounded-2xl border border-slate-800 font-bold" value={configActual.modelo_torneo} onChange={(e) => setConfigActual({...configActual, modelo_torneo: e.target.value})}>
                    <option value="todos_contra_todos">Liga</option>
                    <option value="eliminacion_directa">Playoff</option>
                  </select>
                  <input type="number" className="bg-slate-950 p-5 rounded-2xl border border-slate-800 font-bold" value={configActual.año_lectivo} onChange={(e) => setConfigActual({...configActual, año_lectivo: parseInt(e.target.value)})} />
                </div>
                <button onClick={guardarCambiosTorneo} className="w-full bg-blue-600 hover:bg-blue-500 py-5 rounded-2xl font-black uppercase text-xs">Guardar Cambios Torneo</button>
              </div>
           </div>
           <HistorialTorneos userOrgId={userOrgId} onEdit={setConfigActual} refreshTrigger={refreshTrigger} />
        </div>

        <div className="space-y-8">
           <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-xl text-center">
              <h2 className="text-xl font-black uppercase italic mb-6 text-rose-600 flex items-center justify-center gap-2"><PlusIcon className="w-6 h-6"/> Alta Nueva Liga</h2>
              <form onSubmit={crearNuevaLiga} className="space-y-4">
                <input type="text" required className="w-full bg-slate-950 p-5 rounded-2xl border border-slate-800 uppercase outline-none font-bold" placeholder="Nombre Liga" value={nombreLiga} onChange={(e) => setNombreLiga(e.target.value)} />
                <input type="email" required className="w-full bg-slate-950 p-5 rounded-2xl border border-slate-800 font-bold" placeholder="Email Admin" value={emailAdmin} onChange={(e) => setEmailAdmin(e.target.value)} />
                <input type="password" required className="w-full bg-slate-950 p-5 rounded-2xl border border-slate-800 font-bold" placeholder="Password" value={passwordAdmin} onChange={(e) => setPasswordAdmin(e.target.value)} />
                <button type="submit" className="w-full bg-rose-600 hover:bg-rose-500 py-5 rounded-2xl font-black uppercase text-xs">🚀 Instalar Liga</button>
                {mensaje.texto && <div className={`p-4 rounded-xl text-[10px] font-black uppercase ${mensaje.tipo === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-600'}`}>{mensaje.texto}</div>}
              </form>
           </div>
           <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-950 p-4 text-[9px] font-black uppercase text-slate-500">
                  <tr><th className="p-6">Clientes SaaS</th><th className="p-6 text-right">Acción</th></tr>
                </thead>
                <tbody className="text-xs">
                  {rankingLigas.map(liga => (
                    <tr key={liga.id} className="border-b border-slate-800/50">
                      <td className="p-6 font-bold uppercase">{liga.nombre} <br/><span className="text-[8px] text-emerald-500">{liga.totalJugadoras} JUG.</span></td>
                      <td className="p-6 text-right">
                        <button onClick={() => setUserOrgId(liga.id)} className="bg-slate-800 hover:bg-blue-600 px-4 py-2 rounded-xl text-[8px] font-black">GESTIONAR</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
           </div>
        </div>
      </main>

      {/* MODAL BIENVENIDA */}
      {kitBienvenida && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[200] flex items-center justify-center p-4">
           <div className="bg-white text-slate-950 p-10 rounded-[3rem] text-center space-y-6">
              <CheckCircleIcon className="w-16 h-16 text-emerald-500 mx-auto" />
              <h2 className="text-3xl font-black uppercase italic">¡Liga Lista!</h2>
              <div className="bg-slate-100 p-6 rounded-2xl text-left space-y-1">
                 <p className="text-xs font-bold">Email: {kitBienvenida.email}</p>
                 <p className="text-xs font-bold">Pass: {kitBienvenida.password}</p>
              </div>
              <button onClick={() => setKitBienvenida(null)} className="w-full bg-slate-950 text-white py-4 rounded-2xl font-black uppercase text-xs">Cerrar</button>
           </div>
        </div>
      )}

      {/* LIENZOS OCULTOS PARA DESCARGA (REFS PERMANENTES) */}
      <div style={{ position: 'absolute', left: '-9999px', top: '0', pointerEvents: 'none' }}>
        <div ref={lienzoDelegadosRef} className="grid bg-white" style={{ width: '1000mm', height: '1000mm', gridTemplateColumns: 'repeat(12, 66.8mm)', gridAutoRows: '86.9mm', padding: '10mm' }}>
           {delegadosLiga.map(del => <CarnetDelDelegado key={del.id} data={del} clubNombre={clubesMap[del.club_id] || "CLUB"} soloDiseño={true} configLiga={configLiga} />)}
        </div>
        <div ref={lienzoJugadorasRef} className="grid bg-white" style={{ width: '1000mm', height: '1000mm', gridTemplateColumns: 'repeat(8, 85.6mm)', gridAutoRows: '54mm', padding: '10mm' }}>
           {jugadorasLiga.map(jug => <CarnetJugadora key={jug.id} jugadora={{...jug, equipos: { nombre: clubesMap[jug.equipo_id] }}} config={configLiga} />)}
        </div>
      </div>

    </div>
  );
};

// --- SUB-COMPONENTE HISTORIAL ---
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
    alert("Activado");
    const { data } = await supabase.from('configuracion_torneo').select('*').eq('organizacion_id', userOrgId).order('id', { ascending: false });
    if (data) setHistorial(data);
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-[3rem] shadow-2xl h-full">
      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-8 italic">Archivo Ligas</h3>
      <div className="grid gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {historial.map((t) => (
          <div key={t.id} className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex justify-between items-center group transition-all">
            <div className="cursor-pointer" onClick={() => onEdit(t)}>
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${t.activo ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-slate-800'}`}></span>
                <h4 className="font-bold uppercase text-slate-200 text-sm">{t.nombre_edicion}</h4>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">Temporada {t.año_lectivo}</p>
            </div>
            {!t.activo && <button onClick={() => activar(t.id)} className="bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white px-3 py-1.5 rounded-xl text-[8px] font-black uppercase border border-blue-500/20 transition-all">Activar</button>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SuperAdminDashboard;