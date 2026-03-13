import React, { useState, useEffect, useRef } from 'react'; // NUEVO: useRef
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas'; // NUEVO
import jsPDF from 'jspdf'; // NUEVO
import { PrinterIcon, EyeIcon } from '@heroicons/react/24/solid'; // NUEVO para los botones

import GestionFichajesAdmin from './GestionFichajesAdmin';
import CarnetJugadora from './CarnetJugadora'; // NUEVO: Import necesario para el lienzo

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  
  // --- ESTADOS ORIGINALES ---
  const [perfil, setPerfil] = useState(null);
  const [nombreLiga, setNombreLiga] = useState('');
  const [emailAdmin, setEmailAdmin] = useState('');
  const [passwordAdmin, setPasswordAdmin] = useState('');
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ ligas: 0, jugadoras: 0, alertas: 0 });
  const [rankingLigas, setRankingLigas] = useState([]);
  const [kitBienvenida, setKitBienvenida] = useState(null);

  // --- NUEVO: ESTADOS Y REFS PARA LAS PROPUESTAS ---
  const [generandoLona, setGenerandoLona] = useState(false);
  const [jugadorasLiga, setJugadorasLiga] = useState([]);
  const [clubesMap, setClubesMap] = useState({});
  const [configLiga, setConfigLiga] = useState(null);
  const lienzoJugadorasRef = useRef(null);

  // --- CARGA INICIAL ---
  useEffect(() => {
    fetchPerfil();
    fetchGlobalStats();
    fetchRankingLigas();
  }, []);

  // --- NUEVO: EFECTO PARA CARGAR DATOS DEL PLIEGO ---
  // Esta función carga los datos necesarios para que el lienzo de Propuesta 2 no esté vacío
  useEffect(() => {
    const cargarDatosLienzo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: per } = await supabase.from('perfiles').select('organizacion_id').eq('id', user.id).single();
      if (per?.organizacion_id) {
        // Cargar jugadoras
        const { data: jugs } = await supabase.from('jugadoras').select('*').eq('organizacion_id', per.organizacion_id);
        setJugadorasLiga(jugs || []);
        
        // Cargar equipos para el clubesMap
        const { data: eqs } = await supabase.from('equipos').select('id, nombre, logo_url').eq('organizacion_id', per.organizacion_id);
        const mapping = {};
        eqs?.forEach(e => mapping[e.id] = { nombre: e.nombre, logo: e.logo_url });
        setClubesMap(mapping);

        // Config de liga
        const { data: conf } = await supabase.from('configuracion_liga').select('*').eq('organizacion_id', per.organizacion_id).maybeSingle();
        setConfigLiga(conf);
      }
    };
    cargarDatosLienzo();
  }, []);

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

  // --- PROPUESTA 1: FUNCIÓN DE DESCARGA ---
  const descargarLona1Metro = async (ref, nombre) => {
    if (!ref.current) return;
    setGenerandoLona(true);
    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [1000, 1000],
        compress: true
      });
      const canvas = await html2canvas(ref.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 3779,
        windowHeight: 3779
      });
      const imgData = canvas.toDataURL('image/png');
      doc.addImage(imgData, 'PNG', 0, 0, 1000, 1000);
      doc.save(`${nombre}_SUBLIMACION.pdf`);
    } catch (error) {
      console.error("Error en pliego:", error);
      alert("Error al generar el archivo.");
    } finally {
      setGenerandoLona(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-12">
        
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">
              Control <span className="text-rose-600">Maestro</span>
            </h1>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">Gestión Global NCS-1125</p>
          </div>
          
          {/* NUEVO: BOTÓN PARA ACTIVAR LA FUNCIÓN DE PROPUESTA 1 */}
          <button 
            disabled={generandoLona || jugadorasLiga.length === 0}
            onClick={() => descargarLona1Metro(lienzoJugadorasRef, 'PLIEGO_JUGADORAS')}
            className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-2xl text-[10px] font-black flex items-center gap-2 shadow-lg transition-all"
          >
            <PrinterIcon className="w-5 h-5" />
            {generandoLona ? 'GENERANDO...' : 'IMPRIMIR PLIEGO 1MT'}
          </button>
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

        <section className="bg-slate-900/30 rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-black uppercase italic">Impresión Masiva de Carnets</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Preparación de lienzo 1 mt²</p>
            </div>
          </div>
          {perfil ? <GestionFichajesAdmin perfil={perfil} /> : <div className="p-10 text-center text-slate-500 uppercase font-black text-xs animate-pulse">Cargando...</div>}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
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
              {mensaje.texto && <div className={`p-4 rounded-xl text-[10px] font-black text-center uppercase ${mensaje.tipo === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>{mensaje.texto}</div>}
            </form>
          </div>
        </div>

        {/* KIT DE BIENVENIDA */}
        {kitBienvenida && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="bg-white text-slate-950 w-full max-w-sm rounded-[3rem] p-8 text-center shadow-2xl animate-in zoom-in duration-300">
              <div className="bg-rose-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl text-white">🚀</div>
              <h2 className="text-2xl font-black uppercase italic leading-none mb-6">¡Liga Activada!</h2>
              <div className="bg-slate-100 p-4 rounded-2xl mb-6 text-left space-y-2 border border-slate-200">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Admin: <span className="text-slate-950">{kitBienvenida.email}</span></p>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Pass: <span className="text-slate-950">{kitBienvenida.password}</span></p>
              </div>
              <button onClick={() => setKitBienvenida(null)} className="w-full bg-slate-950 text-white py-4 rounded-2xl font-black uppercase text-xs hover:bg-slate-800 transition-all">Cerrar y Continuar</button>
            </div>
          </div>
        )}

        {/* --- PROPUESTA 2: LIENZO OCULTO TÉCNICO --- */}
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
            {jugadorasLiga.map(jug => (
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