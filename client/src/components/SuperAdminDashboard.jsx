import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { PrinterIcon, EyeIcon } from '@heroicons/react/24/solid';

import GestionFichajesAdmin from './GestionFichajesAdmin';
import CarnetJugadora from './CarnetJugadora';

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

  // --- ESTADOS PARA IMPRESIÓN ---
  const [generandoLona, setGenerandoLona] = useState(false);
  const [jugadorasLiga, setJugadorasLiga] = useState([]);
  const [clubesMap, setClubesMap] = useState({});
  const [configLiga, setConfigLiga] = useState(null);
  const lienzoJugadorasRef = useRef(null);
  const [loteParaImprimir, setLoteParaImprimir] = useState([]);

  useEffect(() => {
    fetchPerfil();
    fetchGlobalStats();
    fetchRankingLigas();
  }, []);

  useEffect(() => {
    if (perfil) {
      cargarDatosLienzo(perfil.organizacion_id);
    }
  }, [perfil]);

  const cargarDatosLienzo = async (orgId) => {
    try {
      const { data: jugs } = await supabase.from('jugadoras').select('*').eq('organizacion_id', orgId);
      setJugadorasLiga(jugs || []);
      const { data: eqs } = await supabase.from('equipos').select('id, nombre, logo_url').eq('organizacion_id', orgId);
      const mapping = {};
      eqs?.forEach(e => mapping[e.id] = { nombre: e.nombre, logo: e.logo_url });
      setClubesMap(mapping);
      if (orgId) {
        const { data: conf } = await supabase.from('configuracion_liga').select('*').eq('organizacion_id', orgId).maybeSingle();
        setConfigLiga(conf);
      }
    } catch (err) { console.error(err); }
  };

  const fetchPerfil = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setLoading(false);
      const { data } = await supabase.from('perfiles').select('*').eq('id', user.id).single();
      setPerfil(data || { rol: 'invitado' });
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const fetchGlobalStats = async () => {
    const { count: l } = await supabase.from('organizaciones').select('*', { count: 'exact', head: true });
    const { count: j } = await supabase.from('jugadoras').select('*', { count: 'exact', head: true });
    const { count: a } = await supabase.from('jugadoras').select('*', { count: 'exact', head: true }).or('verificacion_biometrica_estado.eq.rechazado,distancia_biometrica_oficial.gt.0.6');
    setStats({ ligas: l || 0, jugadoras: j || 0, alertas: a || 0 });
  };

  const fetchRankingLigas = async () => {
    const { data } = await supabase.from('organizaciones').select('id, nombre, logo_url, created_at').order('created_at', { ascending: false }).limit(5);
    if (data) {
      const ranking = await Promise.all(data.map(async (org) => {
        const { count } = await supabase.from('jugadoras').select('*', { count: 'exact', head: true }).eq('organizacion_id', org.id);
        return { ...org, totalJugadoras: count || 0 };
      }));
      setRankingLigas(ranking);
    }
  };

  const eliminarLiga = async (id, nombre) => {
    if (window.confirm(`⚠️ ELIMINAR ${nombre}?`) && window.prompt(`Escribe ${nombre}`) === nombre) {
      await supabase.from('organizaciones').delete().eq('id', id);
      fetchGlobalStats(); fetchRankingLigas();
    }
  };

  const crearNuevaLiga = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const { data: org } = await supabase.from('organizaciones').insert([{ nombre: nombreLiga, slug: nombreLiga.toLowerCase().replace(/ /g, '-') }]).select().single();
      const { data: auth } = await supabase.auth.signUp({ email: emailAdmin, password: passwordAdmin, options: { data: { rol: 'admin_liga', organizacion_id: org.id } } });
      await supabase.from('perfiles').insert([{ id: auth.user.id, email: emailAdmin, rol: 'admin_liga', organizacion_id: org.id }]);
      setMensaje({ tipo: 'success', texto: 'Éxito' });
    } catch (err) { setMensaje({ tipo: 'error', texto: err.message }); } finally { setLoading(false); }
  };

  // --- FUNCIÓN DE DESCARGA POR LOTES (1000x500) ---
  const descargarLona1Metro = async (ref, nombreArchivo) => {
    if (!ref.current || jugadorasLiga.length === 0) return;
    setGenerandoLona(true);
    const JUGADORAS_POR_PLIEGO = 45;
    try {
      for (let i = 0; i < jugadorasLiga.length; i += JUGADORAS_POR_PLIEGO) {
        const lote = jugadorasLiga.slice(i, i + JUGADORAS_POR_PLIEGO);
        setLoteParaImprimir(lote);
        await new Promise(r => setTimeout(r, 4000)); // Espera para blindaje de imágenes
        const canvas = await html2canvas(ref.current, {
          scale: 1.8, 
          useCORS: true, 
          backgroundColor: "#ffffff",
          allowTaint: true,
          imageTimeout: 0,
          logging: false,
          width: 3779, 
          height: 1890 // 1000mm x 500mm
        });
        const pdf = new jsPDF({ orientation: "l", unit: "mm", format: [1000, 500], compress: true });
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 1000, 500);
        pdf.save(`${nombreArchivo}_PARTE_${Math.floor(i/45)+1}.pdf`);
      }
      alert("✅ Pliegos generados.");
    } catch (e) { console.error(e); } finally { setGenerandoLona(false); setLoteParaImprimir([]); }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-12">
        
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">Control <span className="text-rose-600">Maestro</span></h1>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] mt-2 italic">Gestionando: {configLiga?.nombre_liga || 'Liga NCS'}</p>
          </div>
          <button 
            disabled={generandoLona || jugadorasLiga.length === 0}
            onClick={() => descargarLona1Metro(lienzoJugadorasRef, 'LONA_PRO')}
            className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-2xl text-[10px] font-black flex items-center gap-2 shadow-lg transition-all"
          >
            <PrinterIcon className="w-5 h-5" /> {generandoLona ? 'GENERANDO...' : 'IMPRIMIR PLIEGOS 1000x500'}
          </button>
        </header>

        {/* KPIs GLOBALES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] shadow-xl text-center"><p className="text-slate-500 font-black text-[10px] uppercase">Ligas</p><h3 className="text-4xl font-black italic">{stats.ligas}</h3></div>
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] shadow-xl border-b-emerald-500/50 text-center"><p className="text-emerald-500 font-black text-[10px] uppercase">Jugadoras</p><h3 className="text-4xl font-black italic text-emerald-500">{stats.jugadoras}</h3></div>
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] shadow-xl border-b-rose-500/50 text-center"><p className="text-rose-500 font-black text-[10px] uppercase">Alertas</p><h3 className="text-4xl font-black italic">{stats.alertas}</h3></div>
        </div>

        <section className="bg-slate-900/30 rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
            <div><h2 className="text-xl font-black uppercase italic">Fichajes</h2><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Lotes de 45 jugadoras</p></div>
          </div>
          {perfil ? <GestionFichajesAdmin perfil={perfil} /> : <div className="p-10 text-center text-slate-500 font-black text-xs animate-pulse">Cargando...</div>}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* RANKING */}
          <div className="space-y-6">
            <h2 className="text-xl font-black uppercase italic flex items-center gap-3"><span className="w-8 h-[2px] bg-rose-600"></span> Últimas Ligas</h2>
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
              <table className="w-full text-left">
                <thead className="bg-slate-950/50 text-[9px] font-black uppercase text-slate-500">
                  <tr><th className="p-5">Nombre</th><th className="p-5 text-center">Cant</th><th className="p-5 text-right">Acción</th></tr>
                </thead>
                <tbody className="text-xs">
                  {rankingLigas.map(liga => (
                    <tr key={liga.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-all">
                      <td className="p-5 font-bold uppercase">{liga.nombre}</td>
                      <td className="p-5 text-center font-black text-emerald-500">{liga.totalJugadoras}</td>
                      <td className="p-5 text-right flex flex-col items-end gap-2">
                        <button onClick={() => navigate(`/mastercontrol/liga/${liga.id}`)} className="bg-slate-800 hover:bg-blue-600 text-white text-[8px] font-black px-3 py-1.5 rounded-lg">👁️ INSPECCIONAR</button>
                        <button onClick={() => eliminarLiga(liga.id, liga.nombre)} className="text-rose-900 hover:text-rose-500 text-[7px] font-black uppercase">🗑️ DAR DE BAJA</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ALTA DE LIGA */}
          <div className="space-y-6">
            <h2 className="text-xl font-black uppercase italic flex items-center gap-3"><span className="w-8 h-[2px] bg-rose-600"></span> Nuevo Cliente</h2>
            <form onSubmit={crearNuevaLiga} className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-4">
              <input type="text" required placeholder="NOMBRE LIGA" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl outline-none focus:border-rose-600 uppercase text-xs" value={nombreLiga} onChange={(e) => setNombreLiga(e.target.value)} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="email" required placeholder="admin@liga.com" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl outline-none focus:border-rose-600 text-xs" value={emailAdmin} onChange={(e) => setEmailAdmin(e.target.value)} />
                <input type="password" required placeholder="••••••••" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl outline-none focus:border-rose-600 text-xs" value={passwordAdmin} onChange={(e) => setPasswordAdmin(e.target.value)} />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-rose-600 hover:bg-rose-500 py-4 rounded-2xl font-black uppercase text-xs transition-all disabled:opacity-50 mt-4">{loading ? 'PROCESANDO...' : '🚀 INSTALAR LIGA'}</button>
              {mensaje.texto && <div className={`p-4 rounded-xl text-[10px] font-black text-center uppercase ${mensaje.tipo === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>{mensaje.texto}</div>}
            </form>
          </div>
        </div>

        {/* LIENZO OCULTO (1000mm x 500mm) */}
        <div style={{ position: 'absolute', left: '-9999px', top: '0', pointerEvents: 'none', background: 'white' }}>
          <div ref={lienzoJugadorasRef} style={{ width: '1000mm', height: '500mm', background: 'white', padding: '10mm', display: 'grid', gridTemplateColumns: 'repeat(5, 185mm)', gridAutoRows: '54mm', gap: '5mm' }}>
            {loteParaImprimir.map(jug => (
              <div key={`pair-${jug.id}`} style={{ display: 'flex', gap: '2mm', alignItems: 'center' }}>
                <div style={{ width: '85.6mm', height: '54mm' }}>
                  <CarnetJugadora jugadora={{...jug, club_nombre: clubesMap[jug.equipo_id]?.nombre, club_logo: clubesMap[jug.equipo_id]?.logo}} config={configLiga} mostrarDorso={false} />
                </div>
                <div style={{ width: '85.6mm', height: '54mm' }}>
                  <CarnetJugadora jugadora={{...jug, club_nombre: clubesMap[jug.equipo_id]?.nombre, club_logo: clubesMap[jug.equipo_id]?.logo}} config={configLiga} mostrarDorso={true} />
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