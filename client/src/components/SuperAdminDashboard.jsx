import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  
  // --- ESTADOS DE FORMULARIO ---
  const [nombreLiga, setNombreLiga] = useState('');
  const [emailAdmin, setEmailAdmin] = useState('');
  const [passwordAdmin, setPasswordAdmin] = useState('');
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  const [loading, setLoading] = useState(false);
  
  // --- ESTADOS DE DATOS GLOBALES ---
  const [stats, setStats] = useState({ ligas: 0, jugadoras: 0, alertas: 0 });
  const [rankingLigas, setRankingLigas] = useState([]);
  const [kitBienvenida, setKitBienvenida] = useState(null);

  // --- CARGA INICIAL DE KPIs Y RANKING ---
  useEffect(() => {
    fetchGlobalStats();
    fetchRankingLigas();
  }, []);

  const fetchGlobalStats = async () => {
    try {
      const { count: ligasCount } = await supabase.from('organizaciones').select('*', { count: 'exact', head: true });
      const { count: jugadorasCount } = await supabase.from('jugadoras').select('*', { count: 'exact', head: true });
      const { count: alertasCount } = await supabase.from('jugadoras')
        .select('*', { count: 'exact', head: true })
        .or('verificacion_biometrica_estado.eq.rechazado,distancia_biometrica_oficial.gt.0.6');

      setStats({ ligas: ligasCount || 0, jugadoras: jugadorasCount || 0, alertas: alertasCount || 0 });
    } catch (error) { console.error("Error cargando KPIs:", error); }
  };

  const fetchRankingLigas = async () => {
    try {
      const { data: organizaciones } = await supabase
        .from('organizaciones')
        .select('id, nombre, logo_url, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (organizaciones) {
        const rankingConConteo = await Promise.all(organizaciones.map(async (org) => {
          const { count } = await supabase
            .from('jugadoras')
            .select('*', { count: 'exact', head: true })
            .eq('organizacion_id', org.id);
          return { ...org, totalJugadoras: count || 0 };
        }));
        setRankingLigas(rankingConConteo);
      }
    } catch (error) { console.error("Error cargando Ranking:", error); }
  };

  // --- LÓGICA DE ELIMINACIÓN (CIERRE DE GRIFO) ---
  const eliminarLiga = async (id, nombre) => {
    const confirmar = window.confirm(`⚠️ ¿ESTÁS SEGURO? Se eliminará la liga "${nombre}" y TODOS sus datos (jugadoras, fotos, equipos). Esta acción NO tiene vuelta atrás.`);
    
    if (confirmar) {
        const palabraClave = window.prompt(`Para confirmar, escribí el nombre de la liga exactamente: ${nombre}`);
        
        if (palabraClave === nombre) {
            try {
                const { error } = await supabase.from('organizaciones').delete().eq('id', id);
                if (error) throw error;

                alert("🚫 Liga eliminada correctamente.");
                fetchGlobalStats();
                fetchRankingLigas();
            } catch (error) {
                alert("Error al eliminar: " + error.message);
            }
        } else {
            alert("❌ El nombre no coincide. Operación cancelada.");
        }
    }
  };

  // --- LÓGICA DE ALTA (RESPETANDO TUS REGLAS DE ROLES) ---
  const crearNuevaLiga = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMensaje({ tipo: '', texto: '' });

    try {
      // 1. Crear la Organización
      const { data: org, error: orgError } = await supabase
        .from('organizaciones')
        .insert([{ nombre: nombreLiga, slug: nombreLiga.toLowerCase().replace(/ /g, '-') }])
        .select()
        .single();

      if (orgError) throw orgError;

      // 2. Crear el Usuario Auth con metadatos de rol
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailAdmin,
        password: passwordAdmin,
        options: {
          data: {
            rol: 'admin_liga',
            organizacion_id: org.id
          }
        }
      });

      if (authError) throw authError;

      // 3. Crear el perfil vinculado en la tabla perfiles
      const { error: perfilError } = await supabase
        .from('perfiles')
        .insert([{
          id: authData.user.id,
          rol: 'admin_liga',
          organizacion_id: org.id,
          email: emailAdmin
        }]);

      if (perfilError) throw perfilError;

      // 4. Preparar Kit de Bienvenida y Notificar éxito
      setKitBienvenida({
        nombre: nombreLiga,
        email: emailAdmin,
        password: passwordAdmin,
        urlFichaje: `https://gestor-torneo.vercel.app/registro?org=${org.id}`
      });

      setMensaje({ tipo: 'success', texto: `Liga "${nombreLiga}" creada con éxito. Admin: ${emailAdmin}` });
      setNombreLiga(''); setEmailAdmin(''); setPasswordAdmin('');
      
      // Refrescar Dashboard
      fetchGlobalStats();
      fetchRankingLigas();

    } catch (error) {
      setMensaje({ tipo: 'error', texto: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-12">
        
        <header>
          <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">
            Control <span className="text-rose-600">Maestro</span>
          </h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">Gestión Global NCS-1125</p>
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
            <h3 className={`text-4xl font-black italic ${stats.alertas > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-700'}`}>
              {stats.alertas}
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          
          {/* RANKING Y ACCIONES */}
          <div className="space-y-6">
            <h2 className="text-xl font-black uppercase italic flex items-center gap-3">
              <span className="w-8 h-[2px] bg-rose-600"></span> Últimas Ligas
            </h2>
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
              <table className="w-full text-left">
                <thead className="bg-slate-950/50 text-[9px] font-black uppercase text-slate-500 tracking-widest">
                  <tr>
                    <th className="p-5">Nombre Liga</th>
                    <th className="p-5 text-center">Jugadoras</th>
                    <th className="p-5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {rankingLigas.map(liga => (
                    <tr key={liga.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-all">
                      <td className="p-5 font-bold uppercase">{liga.nombre}</td>
                      <td className="p-5 text-center font-black text-emerald-500">{liga.totalJugadoras}</td>
                      <td className="p-5 text-right flex flex-col items-end gap-2">
                        <button 
                          onClick={() => navigate(`/mastercontrol/liga/${liga.id}`)}
                          className="bg-slate-800 hover:bg-blue-600 text-white text-[8px] font-black px-3 py-1.5 rounded-lg transition-all"
                        >👁️ INSPECCIONAR</button>
                        <button 
                          onClick={() => eliminarLiga(liga.id, liga.nombre)}
                          className="text-rose-900 hover:text-rose-500 text-[7px] font-black uppercase tracking-tighter"
                        >🗑️ DAR DE BAJA</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FORMULARIO DE ALTA (TU DISEÑO ORIGINAL) */}
          <div className="space-y-6">
            <h2 className="text-xl font-black uppercase italic flex items-center gap-3">
              <span className="w-8 h-[2px] bg-rose-600"></span> Alta de Nuevo Cliente
            </h2>
            <form onSubmit={crearNuevaLiga} className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-500 ml-2">Nombre de la Nueva Liga</label>
                <input type="text" required placeholder="EJ: LIGA SUR" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl outline-none focus:border-rose-600 uppercase text-xs" value={nombreLiga} onChange={(e) => setNombreLiga(e.target.value)} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-500 ml-2">Email del Admin</label>
                  <input type="email" required placeholder="admin@liga.com" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl outline-none focus:border-rose-600 text-xs" value={emailAdmin} onChange={(e) => setEmailAdmin(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-500 ml-2">Password Inicial</label>
                  <input type="password" required placeholder="••••••••" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl outline-none focus:border-rose-600 text-xs" value={passwordAdmin} onChange={(e) => setPasswordAdmin(e.target.value)} />
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full bg-rose-600 hover:bg-rose-500 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all disabled:opacity-50 mt-4">
                {loading ? 'Procesando...' : '🚀 Crear e Instalar Liga'}
              </button>
              
              {mensaje.texto && (
                <div className={`p-4 rounded-xl text-[10px] font-black text-center uppercase ${mensaje.tipo === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                  {mensaje.texto}
                </div>
              )}
            </form>
          </div>
        </div>

        {/* KIT DE BIENVENIDA DINÁMICO */}
        {kitBienvenida && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="bg-white text-slate-950 w-full max-w-sm rounded-[3rem] p-8 text-center shadow-2xl animate-in zoom-in duration-300">
              <div className="bg-rose-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl text-white">🚀</div>
              <h2 className="text-2xl font-black uppercase italic leading-none mb-6">¡Liga Activada!</h2>
              
              <div className="bg-slate-100 p-4 rounded-2xl mb-6 text-left space-y-2 border border-slate-200">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Admin: <span className="text-slate-950">{kitBienvenida.email}</span></p>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Pass: <span className="text-slate-950">{kitBienvenida.password}</span></p>
              </div>
              
              <div className="space-y-2 mb-6">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">QR Formulario de Registro</p>
                <img 
                    src={`https://chart.googleapis.com/chart?chs=150x150&cht=qr&chl=${encodeURIComponent(kitBienvenida.urlFichaje)}&choe=UTF-8`} 
                    className="mx-auto bg-slate-100 p-2 rounded-xl" 
                    alt="QR" 
                />
              </div>

              <button 
                onClick={() => setKitBienvenida(null)} 
                className="w-full bg-slate-950 text-white py-4 rounded-2xl font-black uppercase text-xs hover:bg-slate-800 transition-all"
              >Cerrar y Continuar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminDashboard;