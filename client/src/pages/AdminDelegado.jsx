import React, { useState, useEffect, useCallback } from 'react'; 
import { supabase } from '../supabaseClient';
import axios from 'axios';
import CarnetJugadora from '../components/CarnetJugadora'; 
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';

const AdminDelegado = ({ equipoId = 4 }) => {
  // --- ESTADOS DE NAVEGACIÓN Y PESTAÑAS ---
  const [activeTab, setActiveTab] = useState('planilla'); 
  const navigate = useNavigate();

  // --- ESTADOS DE DATOS PRINCIPALES ---
  const [plantel, setPlantel] = useState([]);
  const [partidos, setPartidos] = useState([]);
  const [clubes, setClubes] = useState([]); 
  const [partidoSeleccionado, setPartidoSeleccionado] = useState('');
  const [seleccionadas, setSeleccionadas] = useState([]);

  // --- ESTADOS DISCIPLINARIOS (REGLA DE NEGOCIO NUEVA) ---
  const [expedientes, setExpedientes] = useState([]);
  const [configLiga, setConfigLiga] = useState(null);
  const [logoBase64, setLogoBase64] = useState(null);

  // --- ESTADOS DE EDICIÓN DE JUGADORAS ---
  const [editandoId, setEditandoId] = useState(null);
  const [datosEdicion, setDatosEdicion] = useState({ 
    nombre: '', 
    apellido: '', 
    dni: '', 
    fecha_nacimiento: '' 
  });

  // --- ESTADOS DEL FORMULARIO DE FICHAJE ---
  const [filePerfil, setFilePerfil] = useState(null);
  const [fileDNI, setFileDNI] = useState(null);
  const [jugadoraRegistrada, setJugadoraRegistrada] = useState(null);
  const [cargandoFichaje, setCargandoFichaje] = useState(false);
  const [datosFichaje, setDatosFichaje] = useState({ 
    nombre: '', 
    apellido: '', 
    dni: '', 
    fecha_nacimiento: '', 
    equipo_id: '', 
    club_nombre: '', 
    club_escudo: ''   
  });

  // --- FUNCIONES AUXILIARES ---

  /**
   * Convierte URL a Base64 para PDF sin errores de seguridad.
   */
  const getBase64ImageFromURL = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.setAttribute("crossOrigin", "anonymous");
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL("image/png");
        resolve(dataURL);
      };
      img.onerror = (error) => reject(error);
      img.src = url;
    });
  };

  /**
   * Carga inicial de datos: Jugadoras, Partidos, Clubes y Configuración.
   */
  const fetchData = useCallback(async () => {
    console.log("🔍 Sincronizando datos del equipo:", equipoId);

    // 1. Cargar Configuración de la Liga
    const { data: config } = await supabase.from('configuracion_liga').select('*').eq('id', 1).single();
    if (config) {
      setConfigLiga(config);
      if (config.logo_torneo) {
        try {
          const b64 = await getBase64ImageFromURL(config.logo_torneo);
          setLogoBase64(b64);
        } catch (e) { console.error("Error logo b64", e); }
      }
    }

    // 2. Cargar Plantel con Sanciones vinculadas
    const { data: jugadorasData, error: errorJ } = await supabase
      .from('jugadoras')
      .select(`*, sanciones(id, motivo, estado, cantidad_fechas)`)
      .eq('equipo_id', equipoId);
    
    if (errorJ) console.error("❌ Error Supabase Jugadoras:", errorJ);

    const plantelProcesado = jugadorasData?.map(j => ({
      ...j,
      estaSuspendida: j.sanciones?.some(s => s.estado === 'cumpliendo') || j.sancionada === true
    })) || [];
    setPlantel(plantelProcesado);

    // 3. Cargar Partidos No Finalizados
    // eslint-disable-next-line no-unused-vars
    const { data: partidosData, error: errorP } = await supabase
      .from('partidos')
      .select('*, local:equipos!local_id(nombre), visitante:equipos!visitante_id(nombre)')
      .or(`local_id.eq.${equipoId},visitante_id.eq.${equipoId}`)
      .eq('finalizado', false); 
    
    setPartidos(partidosData || []);

    // 4. Cargar Expedientes de Sanciones (Regla: Ver donde el club participó)
    const { data: sancData, error: errorS } = await supabase
      .from('sanciones')
      .select(`
        *,
        jugadora:jugadoras(nombre, apellido),
        partido:partidos(
          id, nro_fecha, 
          local:equipos!local_id(nombre), 
          visitante:equipos!visitante_id(nombre),
          local_id, visitante_id
        )
      `)
      .eq('jugadora.equipo_id', equipoId)
      .order('created_at', { ascending: false });
    
    if (errorS) {
      console.error("❌ Error en consulta de sanciones:", errorS.message);
    } else {
      console.log("⚖️ Expedientes encontrados para equipo", equipoId, ":", sancData?.length);
      setExpedientes(sancData || []);
    }
    
    // 5. Cargar Lista General de Clubes para fichaje
    const { data: clubesData } = await supabase.from('equipos').select('*').order('nombre');
    setClubes(clubesData || []);

  }, [equipoId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- LÓGICA DE GESTIÓN DE JUGADORAS ---

  const iniciarEdicion = (e, jugadora) => {
    e.stopPropagation();
    setEditandoId(jugadora.id);
    setDatosEdicion({
      nombre: jugadora.nombre,
      apellido: jugadora.apellido,
      dni: jugadora.dni,
      fecha_nacimiento: jugadora.fecha_nacimiento
    });
  };

  const guardarActualizacion = async (e, id) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('jugadoras')
        .update(datosEdicion)
        .eq('id', id);
      if (error) throw error;
      setEditandoId(null);
      alert("✅ Datos actualizados correctamente");
      fetchData();
    // eslint-disable-next-line no-unused-vars
    } catch (err) {
      alert("❌ Error al actualizar datos");
    }
  };

  const toggleJugadora = (jugadora) => {
    if (editandoId) return; 
    if (jugadora.estaSuspendida) {
        alert("🚫 ACCIÓN DENEGADA: La jugadora se encuentra suspendida por el Tribunal de Disciplina.");
        return;
    }
    setSeleccionadas(prev => 
      prev.includes(jugadora.id) ? prev.filter(item => item !== jugadora.id) : [...prev, jugadora.id]
    );
  };

  const guardarPlanilla = async () => {
    if (!partidoSeleccionado) return alert("Selecciona un partido");
    if (seleccionadas.length === 0) return alert("Selecciona al menos una jugadora");

    const rows = seleccionadas.map(jId => ({
      partido_id: parseInt(partidoSeleccionado),
      jugadora_id: jId,
      equipo_id: equipoId
    }));

    const { error } = await supabase.from('planillas_citadas').insert(rows);
    if (!error) {
      alert("¡Planilla enviada al árbitro con éxito!");
      setSeleccionadas([]);
    } else {
      alert("Error: " + error.message);
    }
  };

  // --- LÓGICA DISCIPLINARIA ---

  const enviarDescargo = async (sancionId, texto, esLocal) => {
  if (!texto || texto.trim().length < 5) return alert("Escribe un descargo válido");
  
  const campo = esLocal ? 'descargo_local' : 'descargo_visitante';
  
  const { error } = await supabase
    .from('sanciones')
    .update({ [campo]: texto })
    .eq('id', sancionId);

  if (!error) {
    console.log("✅ Descargo guardado en columna:", campo);
    alert("✅ Tu descargo ha sido enviado al Tribunal. Será revisado antes del dictamen.");
    fetchData(); // Recargamos para que vea el check verde
  } else {
    alert("Error al enviar: " + error.message);
  }
};

  const descargarInformeSancion = async (sancion) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Estilo institucional (Igual al AdminTribunal)
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', 15, 10, 25, 25);
    }

    doc.setFontSize(18);
    doc.setTextColor(225, 29, 72); 
    doc.setFont("helvetica", "bold");
    doc.text("BOLETÍN OFICIAL", 110, 20, { align: 'center' });
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(`EXPEDIENTE DISCIPLINARIO #${sancion.id}`, 110, 30, { align: 'center' });
    doc.text(`LIGA: ${configLiga?.nombre_liga || 'NC-S1125'}`, 110, 36, { align: 'center' });

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.text(`FECHA DE EMISIÓN: ${new Date().toLocaleDateString()}`, 20, 60);
    doc.line(20, 62, 190, 62);

    doc.setFont("helvetica", "bold");
    doc.text(`SANCIONADA: ${sancion.jugadora?.apellido}, ${sancion.jugadora?.nombre}`, 20, 75);
    doc.text(`RESOLUCIÓN: ${sancion.cantidad_fechas || 0} fecha(s) de suspensión.`, 20, 85);
    
    doc.setFillColor(248, 250, 252);
    doc.rect(20, 95, 170, 40, 'F');
    doc.setFont("helvetica", "normal");
    doc.text("DICTAMEN DEL TRIBUNAL:", 25, 105);
    doc.text(sancion.aclaracion_tribunal || sancion.motivo, 25, 115, { maxWidth: 160 });

    doc.text("__________________________", 140, 260);
    doc.text("Firma Tribunal Disciplinario", 140, 265);

    doc.save(`Dictamen_Oficial_Expediente_${sancion.id}.pdf`);
  };

  // --- LÓGICA DE FICHAJE Y BIOMETRÍA ---

  const manejarEnvioFichaje = async (e) => {
    e.preventDefault();
    if (!datosFichaje.equipo_id) return alert("Por favor, selecciona un club");
    if (!filePerfil || !fileDNI) return alert("Faltan las fotos obligatorias");
    
    setCargandoFichaje(true);
    const formData = new FormData();
    formData.append('foto', filePerfil);
    formData.append('dni_foto', fileDNI);
    formData.append('nombre', datosFichaje.nombre);
    formData.append('apellido', datosFichaje.apellido);
    formData.append('dni', datosFichaje.dni);
    formData.append('fecha_nacimiento', datosFichaje.fecha_nacimiento);
    formData.append('equipo_id', datosFichaje.equipo_id);

    try {
      const res = await axios.post('http://localhost:5000/fichar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const jugadoraFull = {
        ...res.data.jugadora,
        club_nombre: datosFichaje.club_nombre,
        club_escudo: datosFichaje.club_escudo
      };
      
      setJugadoraRegistrada(jugadoraFull);
      alert("✅ Fichaje y Validación Biométrica completados con éxito.");
      fetchData(); 
    } catch (err) {
      console.error(err);
      alert("❌ Error: " + (err.response?.data?.error || "Servidor de validación desconectado"));
    } finally {
      setCargandoFichaje(false);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-slate-950 min-h-screen text-white font-sans">
      
      {/* NAVEGACIÓN SUPERIOR */}
      <header className="max-w-6xl mx-auto mb-10 border-b border-slate-800 pb-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h1 className="text-3xl font-black uppercase italic text-blue-500 tracking-tighter">Panel de <span className="text-white">Delegado</span></h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-1">Gestión Oficial nc-s1125</p>
        </div>
        
        <div className="flex bg-slate-900 p-1.5 rounded-[2rem] border border-slate-800 shadow-xl overflow-x-auto w-full md:w-auto">
          <button 
            onClick={() => setActiveTab('planilla')} 
            className={`flex-1 md:flex-none px-8 py-3 rounded-2xl text-[10px] font-black transition-all ${activeTab === 'planilla' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-500 hover:text-white'}`}
          >
            📋 CITACIONES
          </button>
          <button 
            onClick={() => setActiveTab('fichaje')} 
            className={`flex-1 md:flex-none px-8 py-3 rounded-2xl text-[10px] font-black transition-all ${activeTab === 'fichaje' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40' : 'text-slate-500 hover:text-white'}`}
          >
            ⚽ NUEVO FICHAJE
          </button>
          <button 
            onClick={() => setActiveTab('disciplina')} 
            className={`flex-1 md:flex-none px-8 py-3 rounded-2xl text-[10px] font-black transition-all ${activeTab === 'disciplina' ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/40' : 'text-slate-500 hover:text-white'}`}
          >
            ⚖️ TRIBUNAL
          </button>
        </div>
      </header>

      {/* CONTENIDO DINÁMICO POR PESTAÑA */}
      <main className="max-w-7xl mx-auto">

        {/* PESTAÑA 1: CITACIÓN Y PLANILLA */}
        {activeTab === 'planilla' && (
          <div className="space-y-8 animate-in fade-in duration-700">
            {/* ACCESO RÁPIDO ESTADÍSTICAS */}
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full -mr-32 -mt-32 blur-3xl transition-all group-hover:bg-blue-600/10"></div>
              <div className="relative z-10">
                <h2 className="text-2xl font-black uppercase italic text-blue-500">Centro de Estadísticas</h2>
                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-2">Consulta tablas, goleadoras y fixture oficial</p>
              </div>
              <button 
                onClick={() => navigate('/posiciones')}
                className="relative z-10 bg-blue-600 hover:bg-blue-500 text-white px-10 py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center gap-4"
              >
                📊 Ver Tabla de Posiciones
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              {/* COLUMNA IZQUIERDA: CONFIGURACIÓN PLANILLA */}
              <section className="lg:col-span-1 space-y-6">
                <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-xl">
                  <h2 className="text-xs font-black uppercase mb-6 text-slate-400 tracking-widest flex items-center gap-2">
                    <span className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-[10px]">1</span>
                    Seleccionar Partido
                  </h2>
                  <select 
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 text-white appearance-none" 
                    onChange={(e) => setPartidoSeleccionado(e.target.value)}
                  >
                    <option value="">Elegir fecha de fixture...</option>
                    {partidos.map(p => (
                      <option key={p.id} value={p.id}>FECHA {p.nro_fecha}: {p.local?.nombre} VS {p.visitante?.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="bg-blue-600/5 p-8 rounded-[2.5rem] border border-blue-500/20 text-center shadow-inner relative overflow-hidden">
                  <p className="text-[10px] text-blue-400 font-black uppercase mb-4 tracking-widest">Jugadoras Citadas</p>
                  <span className="text-7xl font-black text-white tabular-nums">{seleccionadas.length}</span>
                  <button 
                    onClick={guardarPlanilla} 
                    className="w-full mt-8 bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-900/30"
                  >
                    🚀 ENVIAR PLANILLA AL ÁRBITRO
                  </button>
                </div>
              </section>

              {/* COLUMNA DERECHA: SELECCIÓN DE PLANTEL */}
              <section className="lg:col-span-2 bg-slate-900 p-8 rounded-[3rem] border border-slate-800 shadow-xl">
                <h2 className="text-xs font-black uppercase mb-8 text-slate-400 tracking-widest flex items-center gap-2">
                   <span className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-[10px]">2</span>
                   Conformar Lista de Buena Fe
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plantel.map(j => (
                    <div 
                      key={j.id} 
                      onClick={() => toggleJugadora(j)} 
                      className={`relative group flex items-center gap-4 p-4 rounded-3xl cursor-pointer transition-all border-2 
                        ${j.estaSuspendida ? 'bg-red-950/20 border-red-900/30 opacity-60 cursor-not-allowed' : 
                          seleccionadas.includes(j.id) ? 'bg-blue-600/10 border-blue-500' : 'bg-slate-800/40 border-transparent hover:border-slate-700'}`}
                    >
                      {editandoId === j.id ? (
                        <div className="flex-1 space-y-3" onClick={e => e.stopPropagation()}>
                           <div className="grid grid-cols-2 gap-2">
                             <input className="bg-slate-950 text-[10px] p-3 rounded-xl border border-slate-700 text-white outline-none focus:border-blue-500" value={datosEdicion.nombre} onChange={e => setDatosEdicion({...datosEdicion, nombre: e.target.value})} placeholder="Nombre" />
                             <input className="bg-slate-950 text-[10px] p-3 rounded-xl border border-slate-700 text-white outline-none focus:border-blue-500" value={datosEdicion.apellido} onChange={e => setDatosEdicion({...datosEdicion, apellido: e.target.value})} placeholder="Apellido" />
                           </div>
                           <button onClick={(e) => guardarActualizacion(e, j.id)} className="w-full bg-emerald-600 text-[10px] font-black py-2 rounded-xl uppercase">Guardar Cambios</button>
                        </div>
                      ) : (
                        <>
                          <div className="relative">
                            <img src={j.foto_url || 'https://via.placeholder.com/100'} className={`w-14 h-14 rounded-2xl object-cover ${j.estaSuspendida ? 'grayscale border-2 border-red-600' : 'shadow-lg'}`} alt="p" />
                            {j.estaSuspendida && <span className="absolute -top-2 -right-2 bg-red-600 text-[6px] font-black px-2 py-1 rounded-full shadow-lg border border-slate-950">SUSPENDIDA</span>}
                          </div>
                          <div className="flex-1">
                            <p className={`font-black text-xs uppercase tracking-tight ${j.estaSuspendida ? 'text-red-500' : 'text-slate-100'}`}>{j.apellido}, {j.nombre}</p>
                            <p className="text-[9px] text-slate-500 font-bold mt-1">DNI: {j.dni}</p>
                          </div>
                          <div className="flex flex-col gap-2">
                             {!j.estaSuspendida && <button onClick={(e) => iniciarEdicion(e, j)} className="p-2 bg-slate-900 rounded-xl text-[10px] hover:bg-amber-500/20 transition-colors">✏️</button>}
                             <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${seleccionadas.includes(j.id) ? 'bg-blue-500 scale-110' : 'bg-slate-700 opacity-20'}`}>✓</div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* PESTAÑA 2: NUEVO FICHAJE (BIOMETRÍA) */}
        {activeTab === 'fichaje' && (
          <div className="max-w-5xl mx-auto animate-in slide-in-from-bottom-10 duration-700">
            {jugadoraRegistrada ? (
              <div className="flex flex-col items-center p-6 space-y-10 bg-slate-900 rounded-[4rem] border border-slate-800 shadow-2xl">
                <CarnetJugadora jugadora={jugadoraRegistrada} />
                <button 
                  onClick={() => setJugadoraRegistrada(null)} 
                  className="bg-blue-600 text-white px-12 py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-900/40"
                >
                  Fichar Nueva Jugadora
                </button>
              </div>
            ) : (
              <div className="bg-slate-900 p-10 md:p-16 rounded-[4rem] border border-slate-800 shadow-2xl flex flex-col lg:flex-row gap-16 relative overflow-hidden">
                <div className="flex-1 z-10">
                  <div className="mb-10">
                    <h2 className="text-4xl font-black uppercase text-emerald-500 italic tracking-tighter">Fichaje Oficial</h2>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Validación Biométrica Obligatoria</p>
                  </div>

                  <form onSubmit={manejarEnvioFichaje} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Club de Destino</label>
                      <select 
                        className="w-full bg-slate-950 p-5 rounded-2xl border border-slate-800 text-white text-sm font-bold outline-none focus:border-emerald-500 transition-all" 
                        required 
                        value={datosFichaje.equipo_id} 
                        onChange={(e) => {
                          const club = clubes.find(c => c.id === parseInt(e.target.value));
                          setDatosFichaje({...datosFichaje, equipo_id: e.target.value, club_nombre: club?.nombre || '', club_escudo: club?.escudo_url || '' });
                        }}
                      >
                        <option value="">-- Seleccionar Institución --</option>
                        {clubes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <input type="text" placeholder="NOMBRE/S" className="bg-slate-950 p-5 rounded-2xl border border-slate-800 text-sm font-bold uppercase outline-none focus:border-emerald-500" onChange={e => setDatosFichaje({...datosFichaje, nombre: e.target.value})} required />
                      <input type="text" placeholder="APELLIDO/S" className="bg-slate-950 p-5 rounded-2xl border border-slate-800 text-sm font-bold uppercase outline-none focus:border-emerald-500" onChange={e => setDatosFichaje({...datosFichaje, apellido: e.target.value})} required />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <input type="text" placeholder="NRO DNI" className="bg-slate-950 p-5 rounded-2xl border border-slate-800 text-sm font-bold outline-none focus:border-emerald-500" onChange={e => setDatosFichaje({...datosFichaje, dni: e.target.value})} required />
                      <input type="date" className="bg-slate-950 p-5 rounded-2xl border border-slate-800 text-sm font-bold outline-none focus:border-emerald-500" onChange={e => setDatosFichaje({...datosFichaje, fecha_nacimiento: e.target.value})} required />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-blue-500 uppercase ml-2 tracking-widest flex items-center gap-2">📸 Foto Carnet</label>
                        <input type="file" className="text-[10px] text-slate-500 file:bg-blue-600/10 file:text-blue-500 file:border-0 file:rounded-xl file:px-6 file:py-3 file:mr-4 hover:file:bg-blue-600/20 cursor-pointer" onChange={e => setFilePerfil(e.target.files[0])} required />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-emerald-500 uppercase ml-2 tracking-widest flex items-center gap-2">📄 Foto DNI</label>
                        <input type="file" className="text-[10px] text-slate-500 file:bg-emerald-600/10 file:text-emerald-500 file:border-0 file:rounded-xl file:px-6 file:py-3 file:mr-4 hover:file:bg-emerald-600/20 cursor-pointer" onChange={e => setFileDNI(e.target.files[0])} required />
                      </div>
                    </div>

                    <button 
                      disabled={cargandoFichaje} 
                      className={`w-full mt-10 py-6 rounded-[2.5rem] font-black uppercase text-xs tracking-widest transition-all shadow-2xl ${cargandoFichaje ? 'bg-slate-800 text-slate-600 animate-pulse' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'}`}
                    >
                      {cargandoFichaje ? "PROCESANDO BIOMETRÍA..." : "VALIDAR IDENTIDAD Y FINALIZAR REGISTRO"}
                    </button>
                  </form>
                </div>

                <div className="lg:w-80 bg-slate-950/40 p-10 rounded-[3rem] border border-dashed border-slate-800 flex flex-col items-center justify-center text-center space-y-6">
                  <div className="w-20 h-20 bg-emerald-600/10 text-emerald-500 rounded-full flex items-center justify-center text-3xl shadow-inner">🪪</div>
                  <h4 className="text-xs font-black uppercase text-slate-300">Seguridad NC-S1125</h4>
                  <p className="text-[11px] text-slate-500 font-bold uppercase leading-relaxed tracking-wide">
                    El sistema detectará automáticamente rostros y comparará con el documento nacional de identidad para evitar suplantaciones.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA 3: TRIBUNAL Y EXPEDIENTES (REGLA SOLICITADA) */}
        {activeTab === 'disciplina' && (
          <div className="space-y-10 animate-in fade-in duration-700 max-w-5xl mx-auto">
            <div className="flex justify-between items-end px-4">
              <div>
                <h2 className="text-3xl font-black uppercase italic text-rose-500 tracking-tighter">Tribunal <span className="text-white">Disciplinario</span></h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Seguimiento de expedientes y descargos</p>
              </div>
            </div>

            <div className="grid gap-6">
              {expedientes.map(exp => {
                const esLocal = exp.partido?.local_id === equipoId;
                const descargoEnviado = esLocal ? exp.descargo_local : exp.descargo_visitante;

                return (
                  <div key={exp.id} className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-2xl transition-all hover:border-rose-600/30 group">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                           <span className="text-[9px] font-black bg-slate-800 px-4 py-1.5 rounded-full text-rose-500 border border-rose-500/20 uppercase tracking-widest">EXP. #{exp.id}</span>
                           <span className={`text-[9px] font-black px-4 py-1.5 rounded-full uppercase ${exp.estado === 'pendiente' ? 'bg-amber-600/10 text-amber-500' : 'bg-emerald-600/10 text-emerald-500'}`}>
                             {exp.estado === 'pendiente' ? '● En Proceso' : '● Dictaminado'}
                           </span>
                        </div>
                        <h3 className="text-lg font-black uppercase italic text-slate-100">{exp.partido?.local?.nombre} <span className="text-slate-700 mx-1">VS</span> {exp.partido?.visitante?.nombre}</h3>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tighter">Sujeto: <span className="text-blue-500">{exp.jugadora ? `${exp.jugadora.apellido} ${exp.jugadora.nombre}` : 'PERSONAL EXTRA-CAMPO'}</span></p>
                      </div>
                      
                      {exp.estado === 'cumpliendo' && (
                        <button 
                          onClick={() => descargarInformeSancion(exp)}
                          className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase shadow-xl transition-all active:scale-95"
                        >
                          📥 DESCARGAR INFORME PDF
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* DETALLE DEL INCIDENTE */}
                      <div className="bg-slate-950/50 p-6 rounded-[2rem] border border-slate-800 space-y-3">
                         <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Relato del Árbitro:</p>
                         <p className="text-xs text-slate-400 italic leading-relaxed">" {exp.motivo} "</p>
                      </div>

                      {/* ESPACIO PARA DESCARGO */}
                      <div className="bg-slate-800/20 p-6 rounded-[2rem] border border-slate-800/50 space-y-4">
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Descargo del Club ({esLocal ? 'LOCAL' : 'VISITANTE'}):</p>
                        
                        {exp.estado === 'pendiente' ? (
                          <>
                            {descargoEnviado ? (
                              <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl">
                                 <p className="text-[11px] text-emerald-400 font-medium italic">" {descargoEnviado} "</p>
                                 <p className="text-[8px] text-emerald-600 font-black uppercase mt-3 tracking-widest">✓ RECIBIDO POR EL TRIBUNAL</p>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <textarea 
                                  id={`desc-${exp.id}`}
                                  placeholder="Escriba su defensa o aclaración para el Tribunal..."
                                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white outline-none focus:border-emerald-500 transition-all h-28"
                                />
                                <button 
                                  onClick={() => enviarDescargo(exp.id, document.getElementById(`desc-${exp.id}`).value, esLocal)}
                                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                  ENVIAR DESCARGO OFICIAL
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                             <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">DICTAMEN FINAL:</p>
                             <p className="text-xs text-slate-100 font-black mt-2 uppercase tracking-tighter">{exp.aclaracion_tribunal || 'Suspensión Confirmada'}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {expedientes.length === 0 && (
                <div className="py-24 text-center border-4 border-dashed border-slate-900 rounded-[4rem] space-y-4">
                  <div className="text-5xl opacity-20 grayscale">⚖️</div>
                  <p className="text-slate-700 font-black uppercase italic tracking-[0.4em]">Sin Expedientes Abiertos</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* FOOTER ESPACIO ADICIONAL */}
      <footer className="max-w-6xl mx-auto mt-20 pt-10 border-t border-slate-900 text-center opacity-30">
        <p className="text-[9px] font-black uppercase tracking-widest">© 2026 Liga nc-s1125 | Sistema de Gestión para Delegados Oficiales</p>
      </footer>
    </div>
  );
};

export default AdminDelegado;