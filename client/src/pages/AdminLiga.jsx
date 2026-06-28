import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; 
import { PlusIcon, PrinterIcon, XMarkIcon } from '@heroicons/react/24/solid';

const AdminLiga = () => {
  const [tab, setTab] = useState('partidos');
  const [nuevoComunicado, setNuevoComunicado] = useState({ titulo: '', contenido: '', prioridad: 'normal' });
  
  // --- ESTADOS PARA EL CONTROL DE FICHAJE E IDENTIDAD ---
  const [configLiga, setConfigLiga] = useState(null);
  const [userOrgId, setUserOrgId] = useState(null);
  const [cargandoConfig, setCargandoConfig] = useState(true);

  // --- ESTADOS PARA LA GESTIÓN DE PARTIDOS ---
  const [equipos, setEquipos] = useState([]);
  const [partidos, setPartidos] = useState([]);
  const [mostrarModalPartido, setMostrarModalPartido] = useState(false);
  
  // Estado adaptado exactamente a las columnas de tu DB
  const [nuevoPartido, setNuevoPartido] = useState({
    nro_fecha: 1, 
    local_id: '',
    visitante_id: '',
    categoria: '',
    zona: '', // En tu DB se llama 'zona', lo usaremos para la Sede
    fecha_hora_temp: '' // Campo temporal para el input datetime
  });

  // --- 1. CARGAR CONFIGURACIÓN Y DATOS INICIALES ---
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setCargandoConfig(false);
          return;
        }

        const { data: perfil } = await supabase
          .from('perfiles')
          .select('organizacion_id')
          .eq('id', session.user.id)
          .single();

        if (perfil?.organizacion_id) {
          setUserOrgId(perfil.organizacion_id);
          
          const { data: config } = await supabase
            .from('configuracion_liga')
            .select('*')
            .eq('organizacion_id', perfil.organizacion_id)
            .maybeSingle();
          if (config) setConfigLiga(config);

          const { data: eqs } = await supabase
            .from('equipos')
            .select('id, nombre')
            .eq('organizacion_id', perfil.organizacion_id)
            .order('nombre');
          if (eqs) setEquipos(eqs);

          cargarPartidos(perfil.organizacion_id);
        }
      } catch (err) {
        console.error("Error cargando datos:", err);
      } finally {
        setCargandoConfig(false);
      }
    };

    cargarDatos();
  }, []);

  const cargarPartidos = async (orgId) => {
    // Adaptado a las relaciones correctas de local_id y visitante_id
    const { data, error } = await supabase
      .from('partidos')
      .select(`
        *,
        local:local_id(nombre),
        visitante:visitante_id(nombre)
      `)
      .eq('organizacion_id', orgId)
      .eq('finalizado', false)
      // Ordenamos por fecha de creacion ya que fecha_calendario es texto
      .order('created_at', { ascending: true });
    
    if (!error && data) setPartidos(data);
  };

  // --- 2. FUNCIÓN TOGGLE RÁPIDO FICHAJE ---
  const toggleFichajeRapido = async () => {
    if (!userOrgId || !configLiga) return;
    const nuevoEstado = !configLiga.inscripciones_abiertas;
    const { error } = await supabase
      .from('configuracion_liga')
      .update({ inscripciones_abiertas: nuevoEstado })
      .eq('organizacion_id', userOrgId);

    if (!error) {
      setConfigLiga({ ...configLiga, inscripciones_abiertas: nuevoEstado });
      alert(nuevoEstado ? "🔓 Fichaje Abierto" : "🔒 Fichaje Cerrado");
    }
  };

  const crearComunicado = async () => {
    const { error } = await supabase.from('comunicados').insert([nuevoComunicado]);
    if (!error) {
      alert("Comunicado publicado con éxito");
      setNuevoComunicado({ titulo: '', contenido: '', prioridad: 'normal' });
    }
  };

  // --- 3. LÓGICA DE GUARDAR EL PARTIDO (ADAPTADA A TU DB) ---
  const guardarPartido = async (e) => {
    e.preventDefault();
    if (!nuevoPartido.local_id || !nuevoPartido.visitante_id || !nuevoPartido.categoria) {
      return alert("Faltan datos requeridos para el partido.");
    }
    // Obtenemos los nombres de los equipos seleccionados usando los IDs
    const equipoLocal = equipos.find(e => e.id.toString() === nuevoPartido.local_id.toString());
    const equipoVisitante = equipos.find(e => e.id.toString() === nuevoPartido.visitante_id.toString());
    
    if (nuevoPartido.local_id === nuevoPartido.visitante_id) {
      return alert("El equipo local y visitante no pueden ser el mismo.");
    }
    if (!nuevoPartido.fecha_hora_temp) {
      return alert("El día y la hora son obligatorios.");
    }

    // Tu DB requiere separar la fecha_calendario (texto) y el horario (texto)
    const [fecha, hora] = nuevoPartido.fecha_hora_temp.split('T');

    // Cambiamos el formato de la fecha de YYYY-MM-DD a DD/MM/YYYY para que se vea lindo
    const [year, month, day] = fecha.split('-');
    const fechaCalendarioLimpia = `${day}/${month}/${year}`;

    try {
      const payload = {
        nro_fecha: parseInt(nuevoPartido.nro_fecha),
        local_id: parseInt(nuevoPartido.local_id),
        visitante_id: parseInt(nuevoPartido.visitante_id),
        nombre_manual_loc: equipoLocal ? equipoLocal.nombre : 'Sin nombre', // <-- AGREGADO
        nombre_manual_vis: equipoVisitante ? equipoVisitante.nombre : 'Sin nombre', // <-- AGREGADO
        categoria: nuevoPartido.categoria,
        zona: nuevoPartido.zona,
        fecha_calendario: fechaCalendarioLimpia,
        horario: hora,
        organizacion_id: userOrgId
      };

      const { error } = await supabase.from('partidos').insert([payload]);

      if (error) throw error;
      alert("✅ Partido programado con éxito");
      setMostrarModalPartido(false);
      
      // Limpiamos el formulario
      setNuevoPartido({ nro_fecha: 1, local_id: '', visitante_id: '', categoria: '', zona: '', fecha_hora_temp: '' });
      cargarPartidos(userOrgId);
    } catch (error) {
      alert("❌ Error al guardar partido: " + error.message);
    }
  };

  // --- 4. MOTOR DE DESCARGA DE PLANILLAS PDF ---
  const descargarPlanillaPartido = async (partido) => {
    try {
      const { data: localPlayers } = await supabase
        .from('jugadoras')
        .select('*')
        .eq('equipo_id', partido.local_id) // Usamos local_id
        .eq('categoria_actual', partido.categoria)
        .eq('estado_habil_admin', true); 

      const { data: visitaPlayers } = await supabase
        .from('jugadoras')
        .select('*')
        .eq('equipo_id', partido.visitante_id) // Usamos visitante_id
        .eq('categoria_actual', partido.categoria)
        .eq('estado_habil_admin', true); 

      generarPDF(partido, localPlayers || [], visitaPlayers || []);
    } catch (error) {
      console.error("Error obteniendo datos para el PDF:", error);
      alert("Hubo un error al compilar la planilla oficial.");
    }
  };

  const generarPDF = (partido, localPlayers, visitaPlayers) => {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const colorMagenta = [217, 0, 130]; 
    const nombreLiga = configLiga?.nombre_liga || "LIGA OFICIAL";
    const logoBase64 = null; 

    const drawControlesGlobales = (startX, startY) => {
      doc.setFontSize(8);
      doc.setTextColor(0);
      doc.setFont("helvetica", "bold");
      doc.setDrawColor(0);
      
      doc.text("FALTAS 1T:", startX, startY);
      for (let i = 0; i < 5; i++) doc.rect(startX + 18 + (i * 6), startY - 3.5, 4.5, 4.5);

      doc.text("FALTAS 2T:", startX + 55, startY);
      for (let i = 0; i < 5; i++) doc.rect(startX + 73 + (i * 6), startY - 3.5, 4.5, 4.5);

      doc.text("EXPULSIÓN: J", startX + 110, startY);
      doc.rect(startX + 130, startY - 3.5, 4.5, 4.5);
      doc.text("D", startX + 137, startY);
      doc.rect(startX + 141, startY - 3.5, 4.5, 4.5);
      doc.text("P", startX + 148, startY);
      doc.rect(startX + 152, startY - 3.5, 4.5, 4.5);

      doc.text("INFORME:", startX + 162, startY);
      doc.rect(startX + 178, startY - 3.5, 4.5, 4.5);
    };

    const FILAS_VACIAS_MANUAL = [
      ['', '', '', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '']
    ];

    if (logoBase64) {
      try { doc.addImage(logoBase64, 'PNG', 14, 8, 22, 22); } catch (e) { console.error("Error logo:", e); }
    }

    doc.setFontSize(16);
    doc.setTextColor(...colorMagenta);
    doc.setFont("helvetica", "bold");
    doc.text(`${nombreLiga.toUpperCase()}`, 105, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("PLANILLA DE JUEGO OFICIAL", 105, 21, { align: 'center' });

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0); 
    doc.text(`FECHA NRO: ${partido.nro_fecha || '---'}`, 14, 30);
    doc.text(`FECHA REAL: ${partido.fecha_calendario || ' / / '} - ${partido.horario || ''} hs`, 40, 30);
    doc.text(`CAT.: ${(partido.categoria || '---').toUpperCase()}`, 115, 30);
    doc.text(`SEDE: ${partido.zona || '---'}`, 170, 30); // Usamos 'zona' de la DB
    
    doc.setDrawColor(0); 
    doc.line(14, 33, 196, 33); 

    const configuracionTabla = {
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: 0, fontSize: 8, fontStyle: 'bold', halign: 'center' },
      styles: { fontSize: 7.5, cellPadding: 1, lineColor: [0, 0, 0], minCellHeight: 4 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 72 },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 45 },
        4: { cellWidth: 15, halign: 'center' },
        5: { cellWidth: 8, halign: 'center' },
        6: { cellWidth: 8, halign: 'center' }
      }
    };

    doc.setFontSize(10);
    doc.setTextColor(...colorMagenta);
    doc.text(`LOCAL: ${partido.local?.nombre || '---'}`, 14, 42);
    
    autoTable(doc, {
      ...configuracionTabla,
      startY: 45,
      head: [['N°', 'NOMBRE Y APELLIDO', 'DNI', 'FIRMA JUGADORA', 'GOLES', 'A', 'R']],
      body: [
        ...localPlayers.map((j) => [" ", j.apellido.toUpperCase() + " " + j.nombre, j.dni, "", "", "", ""]),
        ...FILAS_VACIAS_MANUAL
      ],
    });

    let currentY = doc.lastAutoTable.finalY + 6;
    drawControlesGlobales(14, currentY);

    currentY += 10;
    doc.setFontSize(10);
    doc.setTextColor(...colorMagenta);
    doc.text(`VISITA: ${partido.visitante?.nombre || '---'}`, 14, currentY);
    
    autoTable(doc, {
      ...configuracionTabla,
      startY: currentY + 3,
      head: [['N°', 'NOMBRE Y APELLIDO', 'DNI', 'FIRMA JUGADORA', 'GOLES', 'A', 'R']],
      body: [
        ...visitaPlayers.map((j) => [" ", j.apellido.toUpperCase() + " " + j.nombre, j.dni, "", "", "", ""]),
        ...FILAS_VACIAS_MANUAL
      ],
    });

    currentY = doc.lastAutoTable.finalY + 6;
    drawControlesGlobales(14, currentY);

    const resY = 260;
    doc.setDrawColor(0);
    doc.setFillColor(240, 240, 240);
    doc.rect(14, resY, 63, 6, 'FD'); 
    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.text("TABLA DE RESULTADOS FINALES", 45.5, resY + 4.5, { align: 'center' });

    const drawExcelRow = (x, y, label) => {
      doc.setLineWidth(0.2);
      doc.rect(x, y, 45, 8); 
      doc.rect(x + 45, y, 18, 8); 
      doc.setFont("helvetica", "bold");
      doc.text(label, x + 2, y + 5.5);
    };

    drawExcelRow(14, resY + 6, `LOC: ${(partido.local?.nombre || '').substring(0, 15)}`);
    drawExcelRow(14, resY + 14, `VIS: ${(partido.visitante?.nombre || '').substring(0, 15)}`);

    const lineY = 285;
    doc.setFontSize(7);
    doc.line(80, lineY, 110, lineY); doc.text("FIRMA ÁRBITRO", 95, lineY + 4, { align: 'center' });
    doc.line(125, lineY, 155, lineY); doc.text("FIRMA DEL. LOCAL", 140, lineY + 4, { align: 'center' });
    doc.line(170, lineY, 200, lineY); doc.text("FIRMA DEL. VISITA", 185, lineY + 4, { align: 'center' });

    doc.save(`Planilla_${partido.local?.nombre}_vs_${partido.visitante?.nombre}.pdf`);
  };

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-white font-sans">
      <header className="mb-6">
        <h1 className="text-3xl font-black uppercase italic text-emerald-500 tracking-tighter">
          Sede Central <span className="text-white">NC-S1125</span>
        </h1>
        
        {!cargandoConfig && (
          <div className="mt-6 flex justify-between items-center bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xl">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Acceso a Delegados</p>
              <h3 className="text-xs font-bold uppercase italic">Sistema de Fichaje Online</h3>
            </div>
            <button 
              onClick={toggleFichajeRapido}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-lg active:scale-95 ${
                configLiga?.inscripciones_abiertas 
                ? 'bg-emerald-600 text-white shadow-emerald-900/20' 
                : 'bg-rose-600 text-white shadow-rose-900/20'
              }`}
            >
              {configLiga?.inscripciones_abiertas ? '🔓 Abierto' : '🔒 Cerrado'}
            </button>
          </div>
        )}

        <div className="flex gap-4 mt-6">
          <button onClick={() => setTab('partidos')} className={`px-6 py-2 rounded-full font-bold text-xs uppercase transition-all ${tab === 'partidos' ? 'bg-emerald-600' : 'bg-slate-900 border border-slate-800'}`}>Fixture</button>
          <button onClick={() => setTab('equipos')} className={`px-6 py-2 rounded-full font-bold text-xs uppercase transition-all ${tab === 'equipos' ? 'bg-emerald-600' : 'bg-slate-900 border border-slate-800'}`}>Equipos</button>
          <button onClick={() => setTab('noticias')} className={`px-6 py-2 rounded-full font-bold text-xs uppercase transition-all ${tab === 'noticias' ? 'bg-emerald-600' : 'bg-slate-900 border border-slate-800'}`}>Comunicados</button>
        </div>
      </header>

      {tab === 'noticias' && (
        <div className="max-w-2xl bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl animate-in fade-in duration-500">
          <h2 className="text-xl font-black mb-6 uppercase italic text-emerald-400">Publicar Anuncio Oficial</h2>
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Título del anuncio..." 
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-emerald-500"
              value={nuevoComunicado.titulo}
              onChange={(e) => setNuevoComunicado({...nuevoComunicado, titulo: e.target.value})}
            />
            <textarea 
              placeholder="Contenido del mensaje..." 
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 h-32 outline-none focus:ring-2 focus:ring-emerald-500"
              value={nuevoComunicado.contenido}
              onChange={(e) => setNuevoComunicado({...nuevoComunicado, contenido: e.target.value})}
            />
            <select 
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 outline-none"
              value={nuevoComunicado.prioridad}
              onChange={(e) => setNuevoComunicado({...nuevoComunicado, prioridad: e.target.value})}
            >
              <option value="normal">Prioridad: Normal</option>
              <option value="urgente">Prioridad: Urgente (Rojo)</option>
            </select>
            <button onClick={crearComunicado} className="w-full bg-emerald-600 py-4 rounded-2xl font-black uppercase hover:bg-emerald-500 transition-all shadow-lg">
              Publicar en Dashboard
            </button>
          </div>
        </div>
      )}

      {tab === 'partidos' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl flex justify-between items-center">
            <div>
              <h2 className="text-xl font-black uppercase italic text-emerald-400">Programación de Fecha</h2>
              <p className="text-slate-500 text-sm italic mt-1">Filtra, edita y gestiona los cruces de la jornada desde aquí.</p>
            </div>
            <button 
              onClick={() => setMostrarModalPartido(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-900/20"
            >
              <PlusIcon className="w-4 h-4" /> Nuevo Partido
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {partidos.length === 0 ? (
              <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-800 rounded-3xl text-slate-600 font-bold uppercase text-[11px] tracking-widest">
                No hay partidos programados
              </div>
            ) : (
              partidos.map((partido) => (
                <div key={partido.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[9px] font-black uppercase px-3 py-1 rounded-bl-xl">
                    FECHA {partido.nro_fecha}
                  </div>
                  
                  <div className="mt-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-black text-sm uppercase truncate w-2/5 text-right">{partido.local?.nombre || 'TBD'}</span>
                      <span className="text-slate-500 text-[10px] font-black italic">VS</span>
                      <span className="text-white font-black text-sm uppercase truncate w-2/5 text-left">{partido.visitante?.nombre || 'TBD'}</span>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-center">
                    <div>
                      <p className="text-emerald-500 text-[9px] font-black uppercase tracking-widest">{partido.categoria}</p>
                      <p className="text-slate-500 text-[10px]">{partido.fecha_calendario} | {partido.horario} hs</p>
                      <p className="text-slate-600 text-[9px] italic">{partido.zona || 'Sede a confirmar'}</p>
                    </div>
                    <button 
                      onClick={() => descargarPlanillaPartido(partido)}
                      className="bg-slate-800 hover:bg-emerald-600 text-white p-2.5 rounded-xl transition-all shadow-md group-hover:scale-110"
                      title="Descargar Planilla Oficial"
                    >
                      <PrinterIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* --- MODAL NUEVO PARTIDO CON SELECTS --- */}
      {mostrarModalPartido && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-[2rem] overflow-hidden shadow-2xl">
            <div className="bg-emerald-600 p-5 flex justify-between items-center text-white">
              <h3 className="font-black uppercase italic tracking-tighter text-lg">Cargar Cruce</h3>
              <button onClick={() => setMostrarModalPartido(false)} className="hover:scale-110 transition-transform">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            
            <form className="p-6 space-y-5" onSubmit={guardarPartido}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Nro Jornada</label>
                  <input 
                    type="number" 
                    required 
                    min="1"
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 text-xs" 
                    placeholder="Ej: 1"
                    value={nuevoPartido.nro_fecha}
                    onChange={(e) => setNuevoPartido({...nuevoPartido, nro_fecha: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Sede / Cancha</label>
                  <select 
                    required
                    className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 text-xs"
                    value={nuevoPartido.zona}
                    onChange={(e) => setNuevoPartido({...nuevoPartido, zona: e.target.value})}
                  >
                    <option value="">Seleccione Sede...</option>
                    <option value="Sede Central">Sede Central</option>
                    <option value="Club Social">Club Social</option>
                    <option value="Polideportivo">Polideportivo Municipal</option>
                    <option value="Cancha Auxiliar">Cancha Auxiliar</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4 p-4 border border-slate-800 rounded-2xl bg-slate-950/50">
                <div>
                  <label className="text-[10px] font-black uppercase text-emerald-500 ml-1">Equipo Local</label>
                  <select 
                    required
                    className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 text-xs"
                    value={nuevoPartido.local_id}
                    onChange={(e) => setNuevoPartido({...nuevoPartido, local_id: e.target.value})}
                  >
                    <option value="">Seleccione equipo...</option>
                    {equipos.map(eq => <option key={`loc-${eq.id}`} value={eq.id}>{eq.nombre}</option>)}
                  </select>
                </div>
                <div className="text-center text-slate-600 text-xs font-black italic">VS</div>
                <div>
                  <label className="text-[10px] font-black uppercase text-rose-500 ml-1">Equipo Visitante</label>
                  <select 
                    required
                    className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 text-xs"
                    value={nuevoPartido.visitante_id}
                    onChange={(e) => setNuevoPartido({...nuevoPartido, visitante_id: e.target.value})}
                  >
                    <option value="">Seleccione equipo...</option>
                    {equipos.map(eq => <option key={`vis-${eq.id}`} value={eq.id}>{eq.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Categoría</label>
                  <select 
                    required
                    className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 text-xs"
                    value={nuevoPartido.categoria}
                    onChange={(e) => setNuevoPartido({...nuevoPartido, categoria: e.target.value})}
                  >
                    <option value="">Seleccione Categoría...</option>
                    <option value="2011-2012">2011-2012</option>
                    <option value="2013-2014">2013-2014</option>
                    <option value="2015-2016">2015-2016</option>
                    <option value="2017-2018">2017-2018</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Día y Hora</label>
                  <input 
                    type="datetime-local" 
                    required
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 text-xs [color-scheme:dark]" 
                    value={nuevoPartido.fecha_hora_temp}
                    onChange={(e) => setNuevoPartido({...nuevoPartido, fecha_hora_temp: e.target.value})}
                  />
                </div>
              </div>

              <button type="submit" className="w-full bg-emerald-600 text-white font-black py-4 rounded-xl transition-all active:scale-95 uppercase tracking-widest text-xs mt-4">
                Programar Partido
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminLiga;