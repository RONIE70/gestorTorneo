import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { PrinterIcon, EyeIcon, DocumentDuplicateIcon, UserGroupIcon, UserIcon } from '@heroicons/react/24/solid';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
// IMPORTANTE: Asegúrate de que CarnetDelDelegado esté exportado en GestionDelegados.js
import { CarnetDelDelegado } from './GestionDelegados'; 
// IMPORTANTE: Asegúrate de que CarnetJugadora esté en la ruta correcta
import CarnetJugadora from './CarnetJugadora'; 

const AdminMaestro = () => {
  // --- 1. ESTADOS DE IDENTIDAD Y CONTROL ---
  const [userOrgId, setUserOrgId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [cargandoConfig, setCargandoConfig] = useState(true);

  // --- 2. ESTADOS PARA LA CONFIGURACIÓN ACTUAL DEL TORNEO ---
  const [configActual, setConfigActual] = useState({
    id: null,
    modelo_torneo: 'todos_contra_todos',
    año_lectivo: 2026,
    valor_modulo: 1000,
    dias_juego: [],
    nombre_edicion: '',
  });

  // --- 3. ESTADOS PARA IMPRESIÓN GLOBAL (LONA 1MT) ---
  const [delegadosLiga, setDelegadosLiga] = useState([]);
  const [jugadorasLiga, setJugadorasLiga] = useState([]); 
  const [clubesMap, setClubesMap] = useState({});
  const [configLiga, setConfigLiga] = useState(null);
  const [generandoLona, setGenerandoLona] = useState(false);
  const [verLienzo, setVerLienzo] = useState(false); 
  const [tipoLienzo, setTipoLienzo] = useState('delegados'); // 'delegados' | 'jugadoras'
  
  const lienzoDelegadosRef = useRef(null);
  const lienzoJugadorasRef = useRef(null);

  // --- 4. FUNCIÓN: OBTENER CONTEXTO DE ORGANIZACIÓN ---
  useEffect(() => {
    const obtenerContextoOrg = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: perfil, error } = await supabase
            .from('perfiles')
            .select('organizacion_id')
            .eq('id', session.user.id)
            .single();
          
          if (error) throw error;
          if (perfil && perfil.organizacion_id !== userOrgId) {
            setUserOrgId(perfil.organizacion_id);
          }
        }
      } catch (err) {
        console.error("Error obteniendo organización:", err.message);
      } finally {
        if (!userOrgId) setCargandoConfig(false);
      }
    };
    obtenerContextoOrg();
  }, [userOrgId]); 

  // --- 5. FUNCIÓN: CARGAR TODOS LOS DATOS (CONFIG, CLUBES, DELEGADOS, JUGADORAS) ---
  useEffect(() => {
    if (!userOrgId) return;

    const cargarTodo = async () => {
      try {
        // A. Cargar última configuración de torneo
        const { data: configData } = await supabase
          .from('configuracion_torneo')
          .select('*')
          .eq('organizacion_id', userOrgId)
          .order('id', { ascending: false })
          .limit(1)
          .single();
        if (configData) setConfigActual(configData);

        // B. Cargar Configuración de Liga (Logo y Nombre)
        const { data: cLiga } = await supabase
          .from('configuracion_liga')
          .select('*')
          .eq('organizacion_id', userOrgId)
          .maybeSingle();
        setConfigLiga(cLiga);

        // C. Mapear Clubes (ID -> Nombre)
        const { data: equipos } = await supabase
          .from('equipos')
          .select('id, nombre')
          .eq('organizacion_id', userOrgId);
        
        const mapping = {};
        equipos?.forEach(e => mapping[e.id] = e.nombre);
        setClubesMap(mapping);

        // D. Cargar todos los delegados de la liga
        const { data: dels } = await supabase
          .from('delegados')
          .select('*')
          .eq('organizacion_id', userOrgId);
        setDelegadosLiga(dels || []);

        // E. Cargar jugadoras habilitadas para impresión masiva
        const { data: jugs } = await supabase
          .from('jugadoras')
          .select('*, equipos:equipo_id(nombre)')
          .eq('organizacion_id', userOrgId)
          .eq('estado_habil_admin', true);
        setJugadorasLiga(jugs || []);

      // eslint-disable-next-line no-unused-vars
      } catch (err) {
        console.log("Error al sincronizar datos maestros.");
      } finally {
        setCargandoConfig(false);
      }
    };
    cargarTodo();
  }, [userOrgId, refreshTrigger]);

  // --- 6. FUNCIÓN: GUARDAR CONFIGURACIÓN DE TORNEO ---
  const guardarCambiosTorneo = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!userOrgId || !session) return alert("❌ Error de sesión.");

    setCargandoConfig(true);
    try {
      const { data, error } = await supabase
        .from('configuracion_torneo')
        .upsert({
          id: configActual.id || undefined, 
          nombre_edicion: configActual.nombre_edicion,
          modelo_torneo: configActual.modelo_torneo,
          año_lectivo: configActual.año_lectivo,
          valor_modulo: parseInt(configActual.valor_modulo),
          organizacion_id: userOrgId,
          configurado_por: session.user.id,
          dias_juego: configActual.dias_juego
        })
        .select().single();

      if (error) throw error;
      alert("✅ Torneo registrado con éxito.");
      setConfigActual(data);
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      alert("❌ Error: " + err.message);
    } finally {
      setCargandoConfig(false);
    }
  };

  // --- 7. LÓGICA DE IMPRESIÓN DINÁMICA (1MT X 1MT) ---
  const descargarPliegoMasivo = async (referencia, nombreArchivo) => {
    if (!referencia.current) return alert("El pliego no está listo para captura.");
    setGenerandoLona(true);
    try {
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: [1000, 1000] });
      const canvas = await html2canvas(referencia.current, { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: '#ffffff' 
      });
      const imgData = canvas.toDataURL('image/png');
      doc.addImage(imgData, 'PNG', 0, 0, 1000, 1000);
      doc.save(`${nombreArchivo}_${new Date().getFullYear()}.pdf`);
    } catch (error) {
      console.error("Error PDF:", error);
      alert("Error al generar el pliego masivo.");
    } finally {
      setGenerandoLona(false);
    }
  };

  return (
    <div className="p-6 bg-[#0a0f18] min-h-screen text-white space-y-8 font-sans">
      
      {/* --- HEADER CON BOTONES DE ACCIÓN --- */}
      <header className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-center gap-6 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white">
            CONTROL <span className="text-blue-500">MAESTRO</span>
          </h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.3em] mt-1">Impresión Masiva & Torneos</p>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-3">
          {/* BOTÓN VISTA PREVIA */}
          <button 
            onClick={() => setVerLienzo(!verLienzo)}
            className={`px-5 py-3 rounded-xl text-[10px] font-black flex items-center gap-2 transition-all border ${verLienzo ? 'bg-blue-600 border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-slate-800 border-slate-700'}`}
          >
            <EyeIcon className="w-5 h-5 text-blue-200" />
            {verLienzo ? 'OCULTAR PREVIEW' : 'VISUALIZAR PLIEGOS'}
          </button>

          {/* BOTÓN IMPRIMIR DELEGADOS */}
          <button 
            onClick={() => descargarPliegoMasivo(lienzoDelegadosRef, 'PLIEGO_DELEGADOS')}
            disabled={generandoLona || delegadosLiga.length === 0}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 rounded-xl text-[10px] font-black flex items-center gap-2 shadow-lg shadow-emerald-900/20 active:scale-95 disabled:opacity-50"
          >
            <PrinterIcon className="w-5 h-5" />
            IMPRIMIR DELEGADOS
          </button>

          {/* BOTÓN IMPRIMIR JUGADORAS */}
          <button 
            onClick={() => descargarPliegoMasivo(lienzoJugadorasRef, 'PLIEGO_JUGADORAS')}
            disabled={generandoLona || jugadorasLiga.length === 0}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl text-[10px] font-black flex items-center gap-2 shadow-lg shadow-blue-900/20 active:scale-95 disabled:opacity-50"
          >
            <PrinterIcon className="w-5 h-5" />
            IMPRIMIR JUGADORAS
          </button>
        </div>
      </header>

      {/* --- SECCIÓN DE ESTADÍSTICAS --- */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] shadow-xl flex justify-between items-center">
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <UserGroupIcon className="w-4 h-4" /> Delegados Registrados
                </p>
                <h2 className="text-5xl font-black text-emerald-500 mt-2">{delegadosLiga.length}</h2>
              </div>
              <div className="text-slate-800 text-6xl font-black opacity-20">👔</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] shadow-xl flex justify-between items-center">
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <UserIcon className="w-4 h-4" /> Jugadoras Habilitadas
                </p>
                <h2 className="text-5xl font-black text-blue-500 mt-2">{jugadorasLiga.length}</h2>
              </div>
              <div className="text-slate-800 text-6xl font-black opacity-20">⚽</div>
          </div>
      </div>

      {/* --- SECCIÓN DE VISTA PREVIA (DINÁMICA) --- */}
      {verLienzo && (
        <div className="max-w-7xl mx-auto space-y-4 animate-in fade-in zoom-in duration-500">
          <div className="flex bg-slate-900 p-1 rounded-2xl w-fit border border-slate-800">
            <button onClick={() => setTipoLienzo('delegados')} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${tipoLienzo === 'delegados' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Vista Delegados</button>
            <button onClick={() => setTipoLienzo('jugadoras')} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${tipoLienzo === 'jugadoras' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Vista Jugadoras</button>
          </div>

          <div className="bg-slate-900 border-2 border-dashed border-blue-500/30 p-4 rounded-[2.5rem] overflow-hidden">
            <h3 className="text-blue-400 font-black text-[10px] uppercase mb-4 text-center tracking-[0.5em]">
              PREVISUALIZACIÓN TÉCNICA - LIENZO 1000mm x 1000mm
            </h3>
            <div className="max-h-[600px] overflow-auto bg-white p-10 rounded-2xl custom-scrollbar border-8 border-slate-950 shadow-inner">
               {tipoLienzo === 'delegados' ? (
                 <div className="grid gap-2 bg-white" style={{ width: '1000mm', height: '1000mm', gridTemplateColumns: 'repeat(12, 66.8mm)', gridAutoRows: '86.9mm', padding: '10mm' }}>
                    {delegadosLiga.map(del => (
                      <CarnetDelDelegado key={del.id} data={del} clubNombre={clubesMap[del.club_id] || "S/D"} soloDiseño={true} configLiga={configLiga} />
                    ))}
                 </div>
               ) : (
                 <div className="grid gap-4 bg-white" style={{ width: '1000mm', height: '1000mm', gridTemplateColumns: 'repeat(8, 85.6mm)', gridAutoRows: '54mm', padding: '10mm' }}>
                    {jugadorasLiga.map(jug => (
                      <CarnetJugadora key={jug.id} jugadora={{...jug, equipos: { nombre: jug.equipos?.nombre || clubesMap[jug.equipo_id] }}} config={configLiga} />
                    ))}
                 </div>
               )}
            </div>
          </div>
        </div>
      )}

      {/* --- GRID PRINCIPAL: HISTORIAL Y FORMULARIO --- */}
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* COLUMNA IZQUIERDA: HISTORIAL DE TORNEOS */}
        <div className="space-y-6">
           <HistorialTorneos 
             userOrgId={userOrgId} 
             refreshTrigger={refreshTrigger}
             onEdit={(torneo) => setConfigActual(torneo)} 
           />
        </div>

        {/* COLUMNA DERECHA: FORMULARIO DE CONFIGURACIÓN */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-xl space-y-8">
            <h3 className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
              <DocumentDuplicateIcon className="w-4 h-4" /> Configuración Activa del Torneo
            </h3>
            
            <div className="space-y-6">
               <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Nombre de la Edición</label>
                  <input 
                    type="text" 
                    className="w-full bg-transparent text-white text-lg font-bold outline-none mt-1"
                    value={configActual.nombre_edicion}
                    onChange={(e) => setConfigActual({...configActual, nombre_edicion: e.target.value})}
                    placeholder="Ej: Femenino Apertura 2026"
                  />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Modelo de Torneo</label>
                    <select 
                      className="w-full bg-transparent text-white font-bold outline-none mt-1"
                      value={configActual.modelo_torneo}
                      onChange={(e) => setConfigActual({...configActual, modelo_torneo: e.target.value})}
                    >
                      <option value="todos_contra_todos">Todos contra Todos</option>
                      <option value="eliminacion_directa">Eliminación Directa</option>
                      <option value="grupos_y_playoff">Grupos + Playoff</option>
                    </select>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Año Lectivo</label>
                    <input 
                      type="number" 
                      className="w-full bg-transparent text-white font-bold outline-none mt-1"
                      value={configActual.año_lectivo}
                      onChange={(e) => setConfigActual({...configActual, año_lectivo: parseInt(e.target.value)})}
                    />
                  </div>
               </div>

               <div className="bg-slate-950 p-6 rounded-[2rem] border border-slate-800">
                  <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Valor Multa por Módulo</label>
                  <div className="flex items-center gap-4 mt-3">
                    <span className="text-3xl font-black text-slate-800">$</span>
                    <input 
                      type="number" 
                      className="w-full bg-transparent text-emerald-500 text-4xl font-black outline-none tabular-nums"
                      value={configActual.valor_modulo}
                      onChange={(e) => setConfigActual({...configActual, valor_modulo: e.target.value})}
                    />
                  </div>
               </div>
            </div>

            <button 
              onClick={guardarCambiosTorneo}
              disabled={cargandoConfig}
              className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50"
            >
              {configActual.id ? 'Actualizar Torneo Seleccionado' : 'Crear Nuevo Torneo Oficial'}
            </button>
          </div>
        </div>
      </main>

      {/* --- LIENZOS TÉCNICOS INVISIBLES (REFS PARA EL MOTOR DE DESCARGA) --- */}
      <div style={{ position: 'absolute', left: '-9999px', top: '0', pointerEvents: 'none' }}>
          <div ref={lienzoDelegadosRef} style={{ width: '1000mm', height: '1000mm', display: 'grid', gridTemplateColumns: 'repeat(12, 66.8mm)', gridAutoRows: '86.9mm', gap: '5mm', background: 'white', padding: '10mm' }}>
              {delegadosLiga.map(del => (
                  <CarnetDelDelegado key={del.id} data={del} clubNombre={clubesMap[del.club_id] || "S/D"} soloDiseño={true} configLiga={configLiga} />
              ))}
          </div>
          <div ref={lienzoJugadorasRef} style={{ width: '1000mm', height: '1000mm', display: 'grid', gridTemplateColumns: 'repeat(8, 85.6mm)', gridAutoRows: '54mm', gap: '5mm', background: 'white', padding: '10mm' }}>
              {jugadorasLiga.map(jug => (
                  <CarnetJugadora key={jug.id} jugadora={{...jug, equipos: { nombre: jug.equipos?.nombre || clubesMap[jug.equipo_id] }}} config={configLiga} />
              ))}
          </div>
      </div>
    </div>
  );
};

// --- SUB-COMPONENTE: HISTORIAL DE TORNEOS ---
const HistorialTorneos = ({ userOrgId, onEdit, refreshTrigger }) => {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchHistorial = useCallback(async () => {
    if (!userOrgId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('configuracion_torneo')
        .select('*')
        .eq('organizacion_id', userOrgId)
        .order('id', { ascending: false });

      if (error) throw error;
      setHistorial(data || []);
    } catch (err) {
      console.error("Error historial:", err.message);
    } finally {
      setLoading(false);
    }
  }, [userOrgId]);

  useEffect(() => {
    fetchHistorial();
  }, [fetchHistorial, refreshTrigger]);

  const activarTorneo = async (torneoId) => {
    try {
      // Desactivar todos
      await supabase.from('configuracion_torneo').update({ activo: false }).eq('organizacion_id', userOrgId);
      // Activar seleccionado
      const { error } = await supabase.from('configuracion_torneo').update({ activo: true }).eq('id', torneoId);
      if (error) throw error;
      alert("🚀 Torneo activado correctamente");
      fetchHistorial(); 
    // eslint-disable-next-line no-unused-vars
    } catch (err) {
      alert("No se pudo activar el torneo");
    }
  };

  if (loading) return <div className="text-center py-20 animate-pulse text-slate-600 text-[10px] font-black uppercase tracking-widest italic">Sincronizando Historial con Servidor...</div>;

  return (
    <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-[3rem] shadow-2xl h-full">
      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-8 italic">Archivo de Torneos Registrados</h3>
      <div className="grid gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
        {historial.length === 0 ? (
          <p className="text-slate-600 text-[10px] font-black uppercase text-center py-10 tracking-widest">No hay torneos registrados</p>
        ) : (
          historial.map((torneo) => (
            <div key={torneo.id} className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex justify-between items-center group hover:border-blue-500/50 transition-all">
              <div className="space-y-1 cursor-pointer" onClick={() => onEdit(torneo)}>
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${torneo.activo ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-slate-800'}`}></span>
                  <span className="text-blue-500 font-black italic text-xs">#{torneo.id}</span>
                  <h4 className="font-bold uppercase text-slate-200 text-sm tracking-tighter">{torneo.nombre_edicion}</h4>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">Año: {torneo.año_lectivo} | Módulo: ${torneo.valor_modulo}</p>
              </div>
              <div className="flex items-center gap-4">
                {!torneo.activo && (
                  <button onClick={() => activarTorneo(torneo.id)} className="bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white px-3 py-1.5 rounded-xl text-[8px] font-black uppercase border border-blue-500/20 transition-all">Activar</button>
                )}
                <span className="text-[18px] cursor-pointer" onClick={() => onEdit(torneo)}>📂</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminMaestro;