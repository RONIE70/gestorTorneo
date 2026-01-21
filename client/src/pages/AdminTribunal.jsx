import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import jsPDF from 'jspdf';

const AdminTribunal = () => {
  // --- ESTADOS DE DATOS ---
  const [expedientes, setExpedientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabActiva, setTabActiva] = useState('expedientes'); 
  const [sancionadas, setSancionadas] = useState([]);
  
  // --- ESTADOS DE CONFIGURACIÓN Y LOGO ---
  const [configLiga, setConfigLiga] = useState(null);
  const [logoBase64, setLogoBase64] = useState(null);

  // --- ESTADOS DE MODAL Y FORMULARIO ---
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

  // --- EFECTOS INICIALES ---
  useEffect(() => {
    fetchExpedientes();
    fetchSancionadas();
    fetchConfiguracion(); // Carga la configuración y el logo al montar el componente
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- FUNCIONES AUXILIARES ---

  /**
   * Convierte una URL de imagen a Base64 usando Canvas.
   * Esto previene el error de XMLHttpRequest síncrono en jsPDF.
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
   * Trae los datos de la liga y procesa el logo si existe.
   */
  const fetchConfiguracion = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracion_liga')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setConfigLiga(data);
        if (data.logo_torneo) {
          try {
            const b64 = await getBase64ImageFromURL(data.logo_torneo);
            setLogoBase64(b64);
          } catch (imgErr) {
            console.error("Error al procesar logo a Base64:", imgErr);
          }
        }
      }
    } catch (err) {
      console.error("Error al cargar configuración de liga:", err.message);
    }
  };

  /**
   * Obtiene los expedientes pendientes desde la tabla de sanciones.
   * INCLUYE LOS DESCARGOS PARA VISUALIZACIÓN
   */
  const fetchExpedientes = async () => {
    try {
      setLoading(true);
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
   * Obtiene el listado de jugadoras actualmente sancionadas.
   */
  const fetchSancionadas = async () => {
    try {
      const { data, error } = await supabase
        .from('jugadoras')
        .select(`
          id, 
          nombre, 
          apellido, 
          tiene_deuda, 
          monto_deuda, 
          equipo_id, 
          aclaracion_tribunal, 
          sancionada,
          equipos(nombre)
        `)
        .eq('sancionada', true);
      
      if (error) throw error;
      setSancionadas(data || []);
    } catch (err) {
      console.error("Error al buscar sancionadas:", err.message);
    }
  };

  /**
   * Prepara los datos para el modal de dictamen.
   */
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
      console.error("Error cargando jugadoras del partido:", err);
      alert("No se pudieron cargar las jugadoras del encuentro.");
    }
  };

  /**
   * Genera el boletín oficial en formato PDF.
   */
  const generarPDFDictamen = async (datos, jugadoraDirecta = null) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // --- 1. ENCABEZADO ---
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    // Inserción del Logo pre-procesado
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', 15, 10, 25, 25);
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
    doc.setTextColor(225, 29, 72); 
    doc.text("BOLETÍN OFICIAL", 105, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.text("TRIBUNAL DE DISCIPLINA", 105, 28, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`Expediente ${configLiga?.nombre_liga || 'NC-S1125'} | Dictamen: ${new Date().toLocaleDateString()}`, 105, 36, { align: 'center' });
    
    // --- 2. CUERPO DE DATOS ---
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    
    // Determinar encuentro
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

    // Detalle de la resolución
    doc.setFillColor(248, 250, 252);
    doc.rect(20, 105, 170, 40, 'F');
    doc.text(`SANCIÓN DEPORTIVA: ${datos.fechas} fecha(s).`, 30, 115);
    doc.text(`SANCIÓN ECONÓMICA: $${datos.modulos * 1000}.`, 30, 125);
    
    doc.text("CONSIDERANDO:", 20, 160);
    doc.setFont("helvetica", "normal");
    doc.text(datos.motivo, 20, 170, { maxWidth: 170, align: 'justify' });

    // Pie de página con QR
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + "/posiciones")}`;
    try {
      doc.addImage(qrUrl, 'PNG', 20, 250, 25, 25);
    // eslint-disable-next-line no-unused-vars
    } catch (errQR) {
      console.warn("No se pudo insertar QR en PDF.");
    }
    
    doc.text("__________________________", 140, 260);
    doc.text("Dirección Tribunal", 145, 265);

    doc.save(`Boletin_${nombreSancionado.replace(/\s/g, '_')}.pdf`);
  };

  /**
   * Rehabilita a una jugadora quitando marcas de sanción y deuda.
   */
  const habilitarJugadora = async (id) => {
    try {
      const { error: errorJugadora } = await supabase
        .from('jugadoras')
        .update({ 
          sancionada: false, 
          tiene_deuda: false, 
          monto_deuda: 0,
          aclaracion_tribunal: null 
        })
        .eq('id', id);

      if (errorJugadora) throw errorJugadora;

      const { error: errorSancion } = await supabase
        .from('sanciones')
        .update({ estado: 'cumplida' })
        .eq('jugadora_id', id)
        .eq('estado', 'cumpliendo');

      if (errorSancion) throw errorSancion;

      alert("✅ Jugadora habilitada y deuda saldada.");
      fetchSancionadas();
      fetchExpedientes();
    } catch (err) {
      alert("Error al habilitar: " + err.message);
    }
  };

  /**
   * Procesa y guarda la resolución de una sanción.
   */
  const guardarSancion = async () => {
    if ((sancion.tipo_sujeto === 'JUGADORA' && !sancion.jugadora_id) || !sancion.motivo) {
      return alert("Completa todos los campos obligatorios");
    }
    
    setGuardando(true);
    try {
      const jugadoraIdLimpio = sancion.tipo_sujeto === 'JUGADORA' ? parseInt(sancion.jugadora_id) : null;

      // 1. Actualizar el registro del expediente
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

      // 2. Impactar en la ficha de la jugadora si corresponde
      if (sancion.tipo_sujeto === 'JUGADORA') {
        const montoFinal = parseInt(sancion.modulos) * 1000;
        const { error: errorJugadora } = await supabase
          .from('jugadoras')
          .update({ 
            sancionada: parseInt(sancion.fechas) > 0,
            tiene_deuda: parseInt(sancion.modulos) > 0,
            monto_deuda: montoFinal,
            aclaracion_tribunal: `Dictamen: ${sancion.fechas} fecha(s). Multa: $${montoFinal}. Motivo: ${sancion.motivo}`
          })
          .eq('id', jugadoraIdLimpio);

        if (errorJugadora) throw errorJugadora;
      }

      // 3. Generar PDF y cerrar
      await generarPDFDictamen(sancion);
      
      alert("✅ Sanción aplicada y Boletín PDF generado con éxito.");
      setModalAbierto(false);
      setSancion({ jugadora_id: '', tipo_sujeto: 'JUGADORA', fechas: 1, modulos: 0, motivo: '' });
      
      fetchExpedientes();
      fetchSancionadas();
      
    } catch (err) {
      console.error("Error en el proceso de guardado:", err);
      alert("Error: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  // --- RENDERIZADO PRINCIPAL ---

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-rose-600 font-black uppercase animate-pulse tracking-[0.3em]">
        Sincronizando Expedientes...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-slate-950 min-h-screen text-white font-sans relative">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* ENCABEZADO DE PÁGINA */}
        <header className="border-l-4 border-rose-600 pl-4 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase italic tracking-tighter">
              Tribunal de <span className="text-rose-600">Disciplina</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
              Resolución de Sanciones nc-s1125
            </p>
          </div>
          <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800">
            <button 
              onClick={() => setTabActiva('expedientes')} 
              className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${tabActiva === 'expedientes' ? 'bg-rose-600 text-white' : 'text-slate-500 hover:text-white'}`}
            >
              EXPEDIENTES
            </button>
            <button 
              onClick={() => setTabActiva('activas')} 
              className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${tabActiva === 'activas' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-white'}`}
            >
              SANCIONES ACTIVAS
            </button>
          </div>
        </header>

        {/* CONTENIDO DE PESTAÑAS */}
        {tabActiva === 'expedientes' ? (
          <div className="grid gap-4">
            {expedientes.length > 0 ? (
              expedientes.map((exp) => (
                <div key={exp.id} className="bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] shadow-xl space-y-4 transition-all hover:border-slate-700">
                  
                  {/* CARD DE DATOS TÉCNICOS */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-950/50 p-5 rounded-3xl border border-slate-800/50 mb-2">
                    <div>
                      <p className="text-[7px] font-black text-rose-500 uppercase tracking-widest">Nombre de Arbitro</p>
                      <p className="text-[10px] font-bold uppercase text-slate-200">{exp.partido?.firma_arbitro || 'Sin Firma'}</p>
                    </div>
                    <div>
                      <p className="text-[7px] font-black text-rose-500 uppercase tracking-widest">Fecha Real</p>
                      <p className="text-[10px] font-bold uppercase text-slate-200">{new Date(exp.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-[7px] font-black text-rose-500 uppercase tracking-widest">Fecha Fixture</p>
                      <p className="text-[10px] font-bold uppercase text-slate-200">Fecha {exp.partido?.nro_fecha}</p>
                    </div>
                    <div>
                      <p className="text-[7px] font-black text-rose-500 uppercase tracking-widest">ID Partido</p>
                      <p className="text-[10px] font-bold uppercase text-slate-400">#{exp.partido_id}</p>
                    </div>
                  </div>

                  {/* DATOS DEL PARTIDO */}
                  <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex-1">
                      <h3 className="text-lg font-black uppercase italic">
                        {exp.partido?.local?.nombre} <span className="text-slate-700 mx-2">VS</span> {exp.partido?.visitante?.nombre}
                      </h3>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Sujeto a resolución</p>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => abrirDictamen(exp)} 
                        className={`w-full md:w-auto px-10 py-4 rounded-2xl text-[11px] font-black uppercase shadow-xl transition-all active:scale-95 ${
                            (exp.descargo_local || exp.descargo_visitante) 
                            ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30 text-white' 
                            : 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/30 text-white'
                        }`}
                      >
                        {(exp.descargo_local || exp.descargo_visitante) ? 'Resolución Sanción' : 'Dictar Sanción'}
                      </button>
                    </div>
                  </div>

                  {/* APARTADO DE INCIDENTE DETALLADO (RELATO DEL ÁRBITRO) */}
                  <div className="bg-slate-950/50 rounded-3xl p-4 border border-slate-800 space-y-2">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-2">Incidente Reportado por Árbitro:</p>
                    <div className="flex items-center justify-between bg-slate-900/50 p-3 rounded-2xl border border-slate-800/50">
                      <div className="flex items-center gap-3">
                        <span className="text-[8px] font-black px-2 py-1 rounded-md bg-rose-600 text-white">PENDIENTE</span>
                        <div>
                          <p className="text-[10px] font-bold uppercase">
                            {exp.jugadora ? `${exp.jugadora.apellido}, ${exp.jugadora.nombre}` : `INFORME EXTRA: ${exp.motivo?.split(':')[0]}`}
                            <span className="text-[7px] text-rose-400 ml-2 italic">({exp.jugadora ? 'JUGADORA' : 'AUTORIDAD'})</span>
                          </p>
                          <p className="text-[9px] text-slate-500 italic mt-0.5">Aclaración: "{exp.motivo}"</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* NUEVA SECCIÓN: DESCARGOS DE LOS DELEGADOS (AQUÍ SE SOLUCIONA LA VISUALIZACIÓN) */}
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800/50 pt-4">
                    <div className={`p-4 rounded-2xl border ${exp.descargo_local ? 'bg-emerald-600/5 border-emerald-500/30' : 'bg-slate-950/50 border-slate-800'}`}>
                        <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                            🛡️ Descargo Club Local ({exp.partido?.local?.nombre}):
                        </p>
                        <p className="text-[10px] italic text-slate-300 leading-relaxed">
                            {exp.descargo_local ? `"${exp.descargo_local}"` : "El delegado no ha presentado descargo formal aún."}
                        </p>
                    </div>

                    <div className={`p-4 rounded-2xl border ${exp.descargo_visitante ? 'bg-emerald-600/5 border-emerald-500/30' : 'bg-slate-950/50 border-slate-800'}`}>
                        <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                            🛡️ Descargo Club Visitante ({exp.partido?.visitante?.nombre}):
                        </p>
                        <p className="text-[10px] italic text-slate-300 leading-relaxed">
                            {exp.descargo_visitante ? `"${exp.descargo_visitante}"` : "El delegado no ha presentado descargo formal aún."}
                        </p>
                    </div>
                  </div>

                </div>
              ))
            ) : (
              <div className="py-20 text-center text-slate-700 font-black uppercase italic tracking-widest border-2 border-dashed border-slate-900 rounded-[3rem]">
                Sin expedientes pendientes de resolución
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {sancionadas.length > 0 ? (
              sancionadas.map(j => (
                <div key={j.id} className="bg-slate-900 p-6 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center border border-slate-800 gap-4">
                  <div className="flex-1">
                    <p className="font-black uppercase text-sm">{j.apellido}, {j.nombre}</p>
                    <p className="text-[10px] text-blue-500 font-bold uppercase">{j.equipos?.nombre}</p>
                    <div className="mt-3 p-3 bg-slate-950 rounded-2xl border border-slate-800">
                      <p className="text-[7px] font-black text-rose-500 uppercase tracking-tighter">Resolución Oficial:</p>
                      <p className="text-[10px] text-slate-300 italic mt-1">{j.aclaracion_tribunal || 'En proceso de resolución'}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 w-full md:w-auto">
                    <button 
                      onClick={() => {
                        const datosReconstruidos = {
                          jugadora_id: j.id,
                          tipo_sujeto: 'JUGADORA',
                          fechas: j.aclaracion_tribunal?.match(/\d+/)?.[0] || 0,
                          modulos: j.monto_deuda / 1000,
                          motivo: j.aclaracion_tribunal
                        };
                        generarPDFDictamen(datosReconstruidos, j);
                      }}
                      className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-4 rounded-xl text-[10px] font-black uppercase transition-all flex-1 md:flex-none"
                    >
                      📄 Ver Informe
                    </button>
                    
                    <button 
                      onClick={() => habilitarJugadora(j.id)} 
                      className="bg-emerald-600 hover:bg-emerald-500 px-6 py-4 rounded-xl text-[10px] font-black uppercase transition-all flex-1 md:flex-none"
                    >
                      HABILITAR / PAGÓ
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 text-center text-slate-700 font-black uppercase italic border-2 border-dashed border-slate-900 rounded-[3rem]">
                No hay sanciones activas
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL DE DICTAMEN FINAL */}
      {modalAbierto && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-[3rem] p-8 shadow-2xl space-y-6 animate-in zoom-in duration-300">
            <div className="text-center">
              <h3 className="text-xl font-black uppercase italic text-rose-500">Resolución Oficial</h3>
              <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mt-1">
                Informe del Árbitro : {partidoSeleccionado?.firma_arbitro || 'Oficial'}
              </p>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-600 ml-2">Sujeto</label>
                  <select 
                    onChange={(e) => setSancion({...sancion, tipo_sujeto: e.target.value})} 
                    className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-[10px] font-bold text-white outline-none" 
                    value={sancion.tipo_sujeto}
                  >
                    <option value="JUGADORA">JUGADORA</option>
                    <option value="DELEGADO">DELEGADO</option>
                    <option value="PUBLICO">PÚBLICO</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-600 ml-2">Seleccionar</label>
                  <select 
                    disabled={sancion.tipo_sujeto !== 'JUGADORA'} 
                    onChange={(e) => setSancion({...sancion, jugadora_id: e.target.value})} 
                    className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-[10px] font-bold outline-none text-white focus:border-rose-500 disabled:opacity-50" 
                    value={sancion.jugadora_id}
                  >
                    <option value="">-- Buscar Jugadora --</option>
                    {jugadorasPartido.map(j => (
                      <option key={j.id} value={j.id}>
                        {j.nombreCompleto}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-600 ml-2">Fechas Suspensión</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={sancion.fechas} 
                    onChange={(e) => setSancion({...sancion, fechas: e.target.value})} 
                    className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-xs font-black text-rose-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-600 ml-2">Multa (Módulos)</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={sancion.modulos} 
                    onChange={(e) => setSancion({...sancion, modulos: e.target.value})} 
                    className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-xs font-black text-emerald-500 outline-none" 
                  />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-slate-600 ml-2">Motivo / Informe</label>
                <textarea 
                  placeholder="Detalles de la sanción..." 
                  value={sancion.motivo} 
                  onChange={(e) => setSancion({...sancion, motivo: e.target.value})} 
                  className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-xs outline-none h-24 focus:border-rose-500 transition-all text-white" 
                />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button 
                onClick={() => setModalAbierto(false)} 
                className="flex-1 bg-slate-800 hover:bg-slate-700 py-4 rounded-2xl text-[10px] font-black uppercase transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={guardarSancion} 
                disabled={guardando} 
                className="flex-1 bg-rose-600 hover:bg-rose-500 py-4 rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-rose-900/20 transition-all"
              >
                {guardando ? 'Firmando...' : 'Aplicar Sanción'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTribunal;