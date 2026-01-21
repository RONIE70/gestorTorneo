import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import jsPDF from 'jspdf';

const AdminTribunal = () => {
  // --- ESTADOS DE DATOS Y NAVEGACIÓN ---
  const [expedientes, setExpedientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabActiva, setTabActiva] = useState('expedientes'); 
  const [sancionadas, setSancionadas] = useState([]);

  // --- ESTADOS DE CONFIGURACIÓN E IMAGEN ---
  const [logoBase64, setLogoBase64] = useState(null);
  const [configLiga, setConfigLiga] = useState(null);

  // --- ESTADOS DEL MODAL DE DICTAMEN ---
  const [modalAbierto, setModalAbierto] = useState(false);
  const [incidenteSeleccionado, setIncidenteSeleccionado] = useState(null);
  const [partidoSeleccionado, setPartidoSeleccionado] = useState(null);
  const [sancion, setSancion] = useState({ 
    jugadora_id: '', 
    tipo_sujeto: 'JUGADORA', 
    fechas: 1, 
    modulos: 0, 
    motivo: '' 
  });
  
  const [jugadorasPartido, setJugadorasPartido] = useState([]);
  const [guardando, setGuardando] = useState(false);

  // --- FUNCIONES AUXILIARES ---

  /**
   * Convierte URL a Base64 detectando formato para evitar errores en jsPDF.
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
        
        const extension = url.split('.').pop().toLowerCase();
        const format = (extension === 'png') ? 'image/png' : 'image/jpeg';
        
        resolve({
          data: canvas.toDataURL(format),
          format: (extension === 'png') ? 'PNG' : 'JPEG'
        });
      };
      img.onerror = (error) => reject(error);
      img.src = url;
    });
  };

  /**
   * Carga la configuración de la liga y pre-procesa el logo oficial.
   */
  const fetchConfiguracion = useCallback(async () => {
    try {
      // eslint-disable-next-line no-unused-vars
      const { data, error } = await supabase
        .from('configuracion_liga')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (data) {
        setConfigLiga(data);
        if (data.logo_torneo) {
          const logoObj = await getBase64ImageFromURL(data.logo_torneo);
          setLogoBase64(logoObj);
        }
      }
    } catch (error) {
      console.error("Error al cargar configuración:", error);
    }
  }, []);

  /**
   * Obtiene todos los expedientes pendientes incluyendo los descargos de los delegados.
   */
  const fetchExpedientes = async () => {
    try {
      setLoading(true);
      // REGLA DE NEGOCIO: Traemos SANCIONES pendientes y todos los datos de partidos/equipos vinculados
      const { data, error } = await supabase
        .from('sanciones')
        .select(`
          *,
          jugadora:jugadoras(id, nombre, apellido),
          partido:partidos(
            id, 
            nro_fecha, 
            firma_arbitro, 
            created_at,
            local_id,
            visitante_id,
            local:equipos!local_id(nombre),
            visitante:equipos!visitante_id(nombre)
          )
        `)
        .eq('estado', 'pendiente')
        .not('motivo', 'ilike', '%GOL%')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExpedientes(data || []);
    } catch (err) {
      console.error("Error en Tribunal:", err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Obtiene la lista de jugadoras sancionadas actualmente.
   */
  const fetchSancionadas = async () => {
    const { data } = await supabase
      .from('jugadoras')
      .select('id, nombre, apellido, tiene_deuda, monto_deuda, equipo_id, aclaracion_tribunal, equipos(nombre)')
      .eq('sancionada', true);
    setSancionadas(data || []);
  };

  useEffect(() => {
    fetchExpedientes();
    fetchSancionadas();
    fetchConfiguracion(); 
  }, [fetchConfiguracion]);

  // --- LÓGICA DE DICTAMEN ---

  const abrirDictamen = async (exp) => {
    setIncidenteSeleccionado(exp);
    setPartidoSeleccionado(exp.partido);
    setSancion({
        ...sancion,
        jugadora_id: exp.jugadora_id || '',
        motivo: exp.motivo || '',
        tipo_sujeto: exp.jugadora_id ? 'JUGADORA' : 'AUTORIDAD',
        fechas: 1,
        modulos: 0
    });

    try {
      // Cargamos jugadoras de ambos equipos involucrados en el partido
      const { data, error } = await supabase
        .from('jugadoras')
        .select(`id, nombre, apellido, equipos!inner(nombre)`)
        .or(`nombre.eq."${exp.partido.local.nombre}",nombre.eq."${exp.partido.visitante.nombre}"`, { foreignTable: 'equipos' })
        .order('apellido', { ascending: true });

      if (error) throw error;

      const listaFormateada = data.map(j => ({
        id: j.id,
        nombreCompleto: `${j.apellido}, ${j.nombre} (${j.equipos.nombre})`
      }));

      setJugadorasPartido(listaFormateada);
      setModalAbierto(true);
    } catch (err) {
      console.error("Error cargando jugadoras:", err);
      alert("No se pudieron cargar las jugadoras del encuentro.");
    }
  };

  /**
   * Genera el PDF del dictamen con estilo institucional.
   */
  const generarPDFDictamen = async (datos, jugadoraDirecta = null) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // --- 1. ENCABEZADO ---
    doc.setFillColor(30, 41, 59); // Slate-900
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    if (logoBase64) {
      try {
        doc.addImage(logoBase64.data, logoBase64.format, 15, 10, 25, 25, undefined, 'FAST');
      // eslint-disable-next-line no-unused-vars
      } catch (e) {
        doc.setFillColor(225, 29, 72);
        doc.ellipse(30, 22, 12, 12, 'F');
      }
    } else {
      doc.setFillColor(225, 29, 72);
      doc.ellipse(30, 22, 12, 12, 'F'); 
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    if (!logoBase64) doc.text("NC", 30, 24, { align: 'center' }); 

    doc.setFontSize(18);
    doc.setTextColor(225, 29, 72); // Rose-600
    doc.text("BOLETÍN OFICIAL", 110, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.text("TRIBUNAL DE DISCIPLINA", 110, 28, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`Expediente ${configLiga?.nombre_liga || 'NC-S1125'} | Dictamen: ${new Date().toLocaleDateString()}`, 110, 36, { align: 'center' });
    
    // --- 2. DATOS DE IDENTIFICACIÓN ---
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    const p = partidoSeleccionado;
    if (p) {
        doc.text(`ENCUENTRO: Fecha ${p?.nro_fecha} - ${p?.local?.nombre} vs ${p?.visitante?.nombre}`, 20, 55);
        doc.line(20, 58, 190, 58);
    }
    
    let nombreSancionado = "";
    let equipoSancionado = "No aplica";

    if (jugadoraDirecta) {
        nombreSancionado = `${jugadoraDirecta.apellido}, ${jugadoraDirecta.nombre}`;
        equipoSancionado = jugadoraDirecta.equipos?.nombre || "Desconocido";
    } else if (datos.tipo_sujeto === 'JUGADORA' && datos.jugadora_id) {
        const sujetoObj = jugadorasPartido.find(j => j.id === parseInt(datos.jugadora_id));
        nombreSancionado = sujetoObj ? sujetoObj.nombreCompleto.split(' (')[0] : "No identificado";
        equipoSancionado = sujetoObj ? sujetoObj.nombreCompleto.split('(')[1]?.replace(')', '') : "Desconocido";
    } else {
        nombreSancionado = datos.tipo_sujeto;
    }

    doc.setFont("helvetica", "bold");
    doc.text(`SANCIONADO: ${nombreSancionado}`, 20, 75);
    doc.text(`CLUB / PERTENENCIA: ${equipoSancionado}`, 20, 85);
    doc.text(`TIPO DE SUJETO: ${datos.tipo_sujeto || 'JUGADORA'}`, 20, 95);

    // --- 3. SANCIÓN Y CONSIDERANDO ---
    doc.setFillColor(248, 250, 252);
    doc.rect(20, 105, 170, 40, 'F');
    doc.text(`SANCIÓN DEPORTIVA: ${datos.fechas} fecha(s).`, 30, 115);
    doc.text(`SANCIÓN ECONÓMICA: $${datos.modulos * 1000}.`, 30, 125);
    
    doc.text("CONSIDERANDO:", 20, 160);
    doc.setFont("helvetica", "normal");
    doc.text(datos.motivo, 20, 170, { maxWidth: 170, align: 'justify' });

    // Pie de página
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + "/posiciones")}`;
    doc.addImage(qrUrl, 'PNG', 20, 250, 25, 25);
    doc.text("__________________________", 140, 260);
    doc.text("Dirección Tribunal", 145, 265);

    doc.save(`Dictamen_${nombreSancionado.replace(/\s/g, '_')}.pdf`);
  };
  
  const habilitarJugadora = async (id) => {
    try {
      const { error } = await supabase
        .from('jugadoras')
        .update({ sancionada: false, tiene_deuda: false, monto_deuda: 0, aclaracion_tribunal: null })
        .eq('id', id);

      if (error) throw error;

      await supabase
        .from('sanciones')
        .update({ estado: 'cumplida' })
        .eq('jugadora_id', id)
        .eq('estado', 'cumpliendo');

      alert("✅ Jugadora rehabilitada exitosamente.");
      fetchSancionadas();
    } catch (err) {
      alert("Error al habilitar: " + err.message);
    }
  };

  const guardarSancion = async () => {
    if ((sancion.tipo_sujeto === 'JUGADORA' && !sancion.jugadora_id) || !sancion.motivo) {
      return alert("Debe completar todos los campos obligatorios.");
    }
    
    setGuardando(true);
    try {
      const jugadoraIdLimpio = sancion.tipo_sujeto === 'JUGADORA' ? parseInt(sancion.jugadora_id) : null;

      // 1. Actualizar sanción
      const { error: errorSancion } = await supabase
        .from('sanciones')
        .update({
          jugadora_id: jugadoraIdLimpio, 
          cantidad_fechas: parseInt(sancion.fechas),
          motivo: sancion.motivo,
          estado: 'cumpliendo'
        })
        .eq('id', incidenteSeleccionado.id);

      if (errorSancion) throw errorSancion;

      // 2. Impactar en jugadora
      if (sancion.tipo_sujeto === 'JUGADORA') {
        const montoFinal = sancion.modulos * 1000;
        await supabase
          .from('jugadoras')
          .update({ 
            sancionada: parseInt(sancion.fechas) > 0,
            tiene_deuda: parseInt(sancion.modulos) > 0,
            monto_deuda: montoFinal,
            aclaracion_tribunal: `Dictamen: ${sancion.fechas} fecha(s). Multa: $${montoFinal}. Motivo: ${sancion.motivo}`
          })
          .eq('id', jugadoraIdLimpio);
      }

      await generarPDFDictamen(sancion);
      alert("✅ Sanción procesada y Dictamen generado.");
      setModalAbierto(false);
      setSancion({ jugadora_id: '', tipo_sujeto: 'JUGADORA', fechas: 1, modulos: 0, motivo: '' });
      fetchExpedientes();
      fetchSancionadas();
      
    } catch (err) {
      alert("Error crítico: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  // --- RENDERIZADO PRINCIPAL ---

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-rose-600 font-black uppercase animate-pulse tracking-[0.3em]">
        Sincronizando Tribunal...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-slate-950 min-h-screen text-white font-sans relative">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* HEADER */}
        <header className="border-l-4 border-rose-600 pl-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter">
              Tribunal de <span className="text-rose-600">Disciplina</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">
              Gestión de Resoluciones nc-s1125
            </p>
          </div>
          <div className="flex bg-slate-900 p-1.5 rounded-[2rem] border border-slate-800 shadow-2xl">
            <button 
              onClick={() => setTabActiva('expedientes')} 
              className={`px-8 py-3 rounded-2xl text-[10px] font-black transition-all ${tabActiva === 'expedientes' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
            >
              EXPEDIENTES
            </button>
            <button 
              onClick={() => setTabActiva('activas')} 
              className={`px-8 py-3 rounded-2xl text-[10px] font-black transition-all ${tabActiva === 'activas' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
            >
              SANCIONES ACTIVAS
            </button>
          </div>
        </header>

        {/* LISTADO DE EXPEDIENTES */}
        {tabActiva === 'expedientes' ? (
          <div className="grid gap-6 animate-in fade-in duration-700">
            {expedientes.length > 0 ? (
              expedientes.map((exp) => (
                <div key={exp.id} className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-2xl space-y-6 transition-all hover:border-rose-600/30">
                  
                  {/* BARRA TÉCNICA */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-slate-950/50 p-6 rounded-[2rem] border border-slate-800/50">
                    <div>
                      <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest">Informante</p>
                      <p className="text-[10px] font-bold uppercase text-slate-200 mt-1">{exp.partido?.firma_arbitro || 'Árbitro Oficial'}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest">Fecha Partido</p>
                      <p className="text-[10px] font-bold uppercase text-slate-200 mt-1">{new Date(exp.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest">Fixture</p>
                      <p className="text-[10px] font-bold uppercase text-slate-200 mt-1">Fecha {exp.partido?.nro_fecha}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest">ID Exp.</p>
                      <p className="text-[10px] font-bold uppercase text-slate-400 mt-1">#{exp.id.slice(0,8)}</p>
                    </div>
                  </div>

                  {/* DATOS DEL PARTIDO */}
                  <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex-1">
                      <h3 className="text-2xl font-black uppercase italic text-slate-100">
                        {exp.partido?.local?.nombre} <span className="text-slate-700 mx-2">VS</span> {exp.partido?.visitante?.nombre}
                      </h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">En espera de dictamen definitivo</p>
                    </div>
                    <button 
                      onClick={() => abrirDictamen(exp)} 
                      className="w-full md:w-auto bg-rose-600 hover:bg-rose-500 px-10 py-4 rounded-2xl text-[11px] font-black uppercase shadow-xl shadow-rose-900/30 transition-all active:scale-95"
                    >
                      Dictar Sanción
                    </button>
                  </div>

                  {/* RELATO DEL ÁRBITRO */}
                  <div className="bg-slate-950/50 rounded-[2rem] p-6 border border-slate-800">
                    <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-3">Relato de Incidencia:</p>
                    <p className="text-xs font-bold uppercase text-slate-200 mb-1">
                      {exp.jugadora ? `${exp.jugadora.apellido}, ${exp.jugadora.nombre}` : `EXTRA: ${exp.motivo?.split(':')[0]}`}
                      <span className="text-[8px] text-rose-400 ml-3 italic">({exp.jugadora ? 'JUGADORA' : 'AUTORIDAD'})</span>
                    </p>
                    <p className="text-[11px] text-slate-400 italic leading-relaxed">"{exp.motivo}"</p>
                  </div>

                  {/* NUEVA SECCIÓN: ALEGATOS DE LOS DELEGADOS (REGLA DE NEGOCIO) */}
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-800/50 pt-6">
                    <div className={`p-5 rounded-2xl border ${exp.descargo_local ? 'bg-emerald-600/5 border-emerald-500/30' : 'bg-slate-950/50 border-slate-800'}`}>
                      <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        🛡️ Alegato Local ({exp.partido?.local?.nombre}):
                      </p>
                      <p className="text-[11px] italic text-slate-300 leading-relaxed">
                        {exp.descargo_local ? `"${exp.descargo_local}"` : "El delegado no ha presentado descargo formal."}
                      </p>
                    </div>
                    <div className={`p-5 rounded-2xl border ${exp.descargo_visitante ? 'bg-emerald-600/5 border-emerald-500/30' : 'bg-slate-950/50 border-slate-800'}`}>
                      <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        🛡️ Alegato Visitante ({exp.partido?.visitante?.nombre}):
                      </p>
                      <p className="text-[11px] italic text-slate-300 leading-relaxed">
                        {exp.descargo_visitante ? `"${exp.descargo_visitante}"` : "El delegado no ha presentado descargo formal."}
                      </p>
                    </div>
                  </div>

                </div>
              ))
            ) : (
              <div className="py-28 text-center text-slate-700 font-black uppercase italic tracking-[0.5em] border-4 border-dashed border-slate-900 rounded-[4rem]">
                Sin expedientes pendientes
              </div>
            )}
          </div>
        ) : (
          /* PESTAÑA SANCIONES ACTIVAS */
          <div className="grid gap-4 animate-in slide-in-from-bottom-5">
            {sancionadas.map(j => (
              <div key={j.id} className="bg-slate-900 p-8 rounded-[3rem] flex flex-col md:flex-row justify-between items-center border border-slate-800 gap-8 shadow-xl">
                <div className="flex-1">
                  <p className="font-black uppercase text-xl text-slate-100">{j.apellido}, {j.nombre}</p>
                  <p className="text-[11px] text-blue-500 font-black uppercase tracking-widest mt-1">{j.equipos?.nombre}</p>
                  <div className="mt-4 p-4 bg-slate-950 rounded-2xl border border-slate-800 shadow-inner">
                    <p className="text-[8px] font-black text-rose-500 uppercase mb-1">Sentencia Vigente:</p>
                    <p className="text-xs text-slate-300 italic">"{j.aclaracion_tribunal || 'Cumpliendo sanción automática'}"</p>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                  <button 
                    onClick={() => {
                      const datosRecu = {
                        jugadora_id: j.id,
                        tipo_sujeto: 'JUGADORA',
                        fechas: j.aclaracion_tribunal?.match(/\d+/)?.[0] || 0,
                        modulos: j.monto_deuda / 1000,
                        motivo: j.aclaracion_tribunal
                      };
                      generarPDFDictamen(datosRecu, j);
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase transition-all flex-1"
                  >
                    📄 Descargar Comprobante
                  </button>
                  <button 
                    onClick={() => habilitarJugadora(j.id)} 
                    className="bg-emerald-600 hover:bg-emerald-500 px-8 py-4 rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-emerald-900/20 transition-all flex-1"
                  >
                    Habilitar Jugadora
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DE DICTAMEN FINAL */}
      {modalAbierto && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-[4rem] p-10 shadow-2xl space-y-8 animate-in zoom-in duration-300">
            <div className="text-center">
              <h3 className="text-2xl font-black uppercase italic text-rose-500">Dictamen Institucional</h3>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-2">Expediente #{incidenteSeleccionado?.id.slice(0,8)}</p>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Tipo de Sujeto</label>
                  <select 
                    onChange={(e) => setSancion({...sancion, tipo_sujeto: e.target.value})} 
                    className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl text-xs font-bold text-white outline-none focus:border-rose-500" 
                    value={sancion.tipo_sujeto}
                  >
                    <option value="JUGADORA">JUGADORA</option>
                    <option value="AUTORIDAD">AUTORIDAD</option>
                    <option value="DELEGADO">DELEGADO</option>
                    <option value="PUBLICO">PÚBLICO</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Persona Identificada</label>
                  <select 
                    disabled={sancion.tipo_sujeto !== 'JUGADORA'} 
                    onChange={(e) => setSancion({...sancion, jugadora_id: e.target.value})} 
                    className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl text-xs font-bold outline-none text-white focus:border-rose-500 disabled:opacity-30" 
                    value={sancion.jugadora_id}
                  >
                    <option value="">-- Buscar en el Acta --</option>
                    {jugadorasPartido.map(j => (
                      <option key={j.id} value={j.id}>{j.nombreCompleto}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Fechas Suspensión</label>
                  <input type="number" min="0" value={sancion.fechas} onChange={(e) => setSancion({...sancion, fechas: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl text-sm font-black text-rose-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Multa (Unidades)</label>
                  <input type="number" min="0" value={sancion.modulos} onChange={(e) => setSancion({...sancion, modulos: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl text-sm font-black text-emerald-500 outline-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Resolución / Considerando Final</label>
                <textarea 
                  placeholder="Detalle los motivos de la sanción basados en el acta y descargos..." 
                  value={sancion.motivo} 
                  onChange={(e) => setSancion({...sancion, motivo: e.target.value})} 
                  className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl text-xs outline-none h-32 focus:border-rose-500 text-white transition-all" 
                />
              </div>
            </div>

            <div className="flex gap-4 pt-6">
              <button onClick={() => setModalAbierto(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 py-5 rounded-3xl text-[11px] font-black uppercase tracking-widest transition-all">Cancelar</button>
              <button 
                onClick={guardarSancion} 
                disabled={guardando} 
                className="flex-2 bg-rose-600 hover:bg-rose-500 py-5 rounded-3xl text-[11px] font-black uppercase shadow-xl shadow-rose-900/40 transition-all active:scale-95"
              >
                {guardando ? 'Firmando Dictamen...' : 'Emitir Sentencia Oficial'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTribunal;