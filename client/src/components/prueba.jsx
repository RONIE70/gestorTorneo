import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import axios from 'axios'; 
import AdminFixture from './AdminFixture'; 
import RegistroEquipo from '../components/RegistroEquipo';

const AdminConfig = () => {
  const [categorias, setCategorias] = useState([]);
  const [clubes, setClubes] = useState([]);
  const [filtroClub, setFiltroClub] = useState('');
  const [loading, setLoading] = useState(true);
  const [torneoModo, setTorneoModo] = useState('todos_contra_todos');
  // eslint-disable-next-line no-unused-vars
  const [tipoPlayOff, setTipoPlayOff] = useState('eliminacion_directa');
  const [cantidadZonas, setCantidadZonas] = useState(2);
  const [fixtureTemporal, setFixtureTemporal] = useState(null);

  // --- ESTADOS DE IDENTIDAD, CALENDARIO, PERFIL Y MENSAJES ---
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0]);
  const [diasSeleccionados, setDiasSeleccionados] = useState(['6']); 
  const [perfil, setPerfil] = useState({ 
    email_contacto: '', 
    whatsapp_contacto: '', 
    nombre_liga: 'nc-s1125',
    nombre_torneo: 'Torneo Oficial 2026',
    logo_torneo: '',
    inscripciones_abiertas: true,
    valor_modulo: 1000 
  });
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false); 
  const [mensajes, setMensajes] = useState([]); 

  // --- NUEVOS ESTADOS SOLICITADOS POR EL CLIENTE ---
  const [torneos, setTorneos] = useState([]); 
  const [torneoActivoId, setTorneoActivoId] = useState(null);
  const [clasificanPorZona, setClasificanPorZona] = useState(2); 
  
  const [tablaPosiciones, setTablaPosiciones] = useState([]);
  const [showModalPlayoff, setShowModalPlayoff] = useState(false);
  
  const diasSemana = [
    { id: '1', label: 'Lu' }, { id: '2', label: 'Ma' }, { id: '3', label: 'Mi' },
    { id: '4', label: 'Ju' }, { id: '5', label: 'Vi' }, { id: '6', label: 'Sá' }, { id: '0', label: 'Do' }
  ];

  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(() => {
    return localStorage.getItem('categoria_activa_nc') || 'Primera';
  });

  const manejarCambioCategoria = (nuevaCat) => {
    setCategoriaSeleccionada(nuevaCat);
    localStorage.setItem('categoria_activa_nc', nuevaCat);
  };

  const descripcionesTorneo = {
    todos_contra_todos: "Liga de larga duración: todos se enfrentan entre sí en partidos de Ida y Vuelta, alternando localía en cada fecha.",
    apertura_clausura: "Dos torneos cortos en el año. Los ganadores de cada etapa disputarán una Finalísima para coronar al Campeón Anual.",
    permanencia: "Ronda clasificatoria: los mejores avanzan a la 'Copa de Oro' (Campeonato) y el resto a la 'Copa de Plata' (Permanencia).",
    zonas: "Los equipos se dividen en grupos independientes. Los clasificados de cada zona pasan a una fase final de eliminación o campeonato."
  };

  const calcularTablaPosiciones = useCallback((partidos, clubes) => {
    const tabla = {};
    clubes.forEach(c => {
      tabla[c.id] = { id: c.id, nombre: c.nombre, zona: c.zona, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
    });
    partidos.filter(p => p.jugado === true).forEach(p => {
      const local = tabla[p.local_id]; const vis = tabla[p.visitante_id];
      if (!local || !vis) return;
      local.pj++; vis.pj++;
      local.gf += p.goles_local; local.gc += p.goles_visitante;
      vis.gf += p.goles_visitante; vis.gc += p.goles_local;
      if (p.goles_local > p.goles_visitante) { local.pg++; local.pts += 3; vis.pp++; }
      else if (p.goles_local < p.goles_visitante) { vis.pg++; vis.pts += 3; local.pp++; }
      else { local.pe++; vis.pe++; local.pts += 1; vis.pts += 1; }
      local.dg = local.gf - local.gc; vis.dg = vis.gf - vis.gc;
    });
    return Object.values(tabla).sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: catData }, { data: clubData }, { data: perfilData },
        { data: msgData }, { data: tData }, { data: partidosDB }
      ] = await Promise.all([
        supabase.from('categorias').select('*').order('orden_correlativo', { ascending: true }),
        supabase.from('equipos').select('*').order('nombre'),
        supabase.from('configuracion_liga').select('*').eq('id', 1).single(),
        supabase.from('mensajes_contacto').select('*').order('created_at', { ascending: false }),
        supabase.from('configuracion_torneo').select('*').order('id', { ascending: false }),
        supabase.from('partidos').select('*, local:equipos!local_id(id, nombre, zona), visitante:equipos!visitante_id(id, nombre, zona)')
      ]);

      if (partidosDB && partidosDB.length > 0) {
        const agrupados = partidosDB.reduce((acc, p) => {
          const key = `${p.nro_fecha}-${p.zona || 'General'}`;
          if (!acc[key]) acc[key] = { numero: p.nro_fecha, fechaReal: p.fecha_calendario || 'S/D', zona: p.zona, encuentros: [] };
          let localData = p.local; let visitanteData = p.visitante;
          if (!localData && p.zona === 'PLAY-OFFS') {
             if (p.categoria === 'GRAN FINAL') { localData = { id: null, nombre: "1° ZONA A" }; visitanteData = { id: null, nombre: "1° ZONA B" }; }
             else if (p.categoria === '3° PUESTO') { localData = { id: null, nombre: "2° ZONA A" }; visitanteData = { id: null, nombre: "2° ZONA B" }; }
             else if (p.categoria === 'SEMIFINAL 1') { localData = { id: null, nombre: "1° ZONA A" }; visitanteData = { id: null, nombre: "2° ZONA B" }; }
             else if (p.categoria === 'SEMIFINAL 2') { localData = { id: null, nombre: "1° ZONA B" }; visitanteData = { id: null, nombre: "2° ZONA A" }; }
          }
          acc[key].encuentros.push({ id: p.id, loc: localData || { id: null, nombre: "A DEFINIR" }, vis: visitanteData || { id: null, nombre: "A DEFINIR" }, categoria: p.categoria || 'Primera', horario: p.horario || '16:00', goles_loc: p.goles_local, goles_vis: p.goles_visitante, jugado: p.jugado, finalizado: p.finalizado });
          return acc;
        }, {});
        const fixtureOrdenado = Object.values(agrupados).sort((a, b) => a.numero - b.numero);
        setFixtureTemporal(fixtureOrdenado);
        if (clubData && clubData.length > 0) setTablaPosiciones(calcularTablaPosiciones(partidosDB, clubData));
      }
      if (catData) setCategorias(catData);
      if (clubData) setClubes(clubData);
      if (perfilData) setPerfil(perfilData);
      if (msgData) setMensajes(msgData);
      if (tData) setTorneos(tData);
    } catch (err) { console.error('Error en fetchData:', err); } finally { setLoading(false); }
  }, [calcularTablaPosiciones]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const editarEquipoPartido = async (partidoId, campo, nuevoEquipoId) => {
    setLoading(true);
    try {
      const valor = nuevoEquipoId === "" ? null : nuevoEquipoId;
      await supabase.from('partidos').update({ [campo]: valor }).eq('id', partidoId);
      await fetchData(); 
    } catch (err) { alert("Error al editar equipo"); } finally { setLoading(false); }
  };

  const intercambiarLocalia = async (partido) => {
    setLoading(true);
    try {
      await supabase.from('partidos').update({
        local_id: partido.vis?.id || null, visitante_id: partido.loc?.id || null,
        nombre_manual_loc: partido.vis?.nombre || "A DEFINIR", nombre_manual_vis: partido.loc?.nombre || "A DEFINIR"
      }).eq('id', partido.id);
      await fetchData();
    } catch (err) { alert("Error al intercambiar"); } finally { setLoading(false); }
  };

  const toggleInscripciones = async () => {
    const nuevoEstado = !perfil.inscripciones_abiertas;
    const { error } = await supabase.from('configuracion_liga').update({ inscripciones_abiertas: nuevoEstado }).eq('id', 1);
    if (!error) { setPerfil({ ...perfil, inscripciones_abiertas: nuevoEstado }); alert(nuevoEstado ? "🔓 Inscripciones ABIERTAS." : "🔒 Inscripciones CERRADAS."); }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setSubiendoLogo(true);
    const formData = new FormData(); formData.append('file', file); formData.append('upload_preset', 'nc_s1125_presets'); 
    try {
      const res = await axios.post('https://api.cloudinary.com/v1_1/dgtc9qfmv/image/upload', formData);
      setPerfil({ ...perfil, logo_torneo: res.data.secure_url });
      alert("✅ Logo subido correctamente");
    } catch (err) { alert("❌ Error al subir el archivo"); } finally { setSubiendoLogo(false); }
  };

  const toggleDia = (id) => { setDiasSeleccionados(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]); };

  const calcularFechaCalendario = (numFecha) => {
    let base = new Date(fechaInicio + 'T00:00:00'); let diasValidos = diasSeleccionados.map(Number);
    if (diasValidos.length === 0) diasValidos = [6];
    let fechaEncontrada = new Date(base); let fechasContadas = 0;
    while (fechasContadas < numFecha) {
      if (diasValidos.includes(fechaEncontrada.getDay())) { fechasContadas++; if (fechasContadas === numFecha) break; }
      fechaEncontrada.setDate(fechaEncontrada.getDate() + 1);
    }
    return fechaEncontrada.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const actualizarPerfil = async () => {
    setGuardandoPerfil(true);
    const { error } = await supabase.from('configuracion_liga').update({
      email_contacto: perfil.email_contacto, whatsapp_contacto: perfil.whatsapp_contacto,
      nombre_liga: perfil.nombre_liga, nombre_torneo: perfil.nombre_torneo,
      logo_torneo: perfil.logo_torneo, inscripciones_abiertas: perfil.inscripciones_abiertas,
      valor_modulo: parseInt(perfil.valor_modulo)
    }).eq('id', 1);
    if (!error) alert("✅ Perfil y Parámetros actualizados.");
    setGuardandoPerfil(false);
  };

  const toggleCabezaSerie = async (id, estadoActual) => {
    const nuevoEstado = !estadoActual;
    setClubes(prev => prev.map(c => c.id === id ? { ...c, es_cabeza_serie: nuevoEstado } : c));
    await supabase.from('equipos').update({ es_cabeza_serie: nuevoEstado }).eq('id', id);
  };

  const eliminarEquipo = async (id, nombre) => {
    const confirmar = window.confirm(`⚠️ ¡ATENCIÓN!\n¿Deseas eliminar "${nombre}" y borrar sus partidos?`);
    if (!confirmar) return;
    try {
      setLoading(true);
      await supabase.from('partidos').delete().or(`local_id.eq.${id},visitante_id.eq.${id}`);
      await supabase.from('equipos').delete().eq('id', id);
      fetchData();
    } catch (error) { alert("❌ Error: " + error.message); } finally { setLoading(false); }
  };

  const handleNuevoTorneo = async () => {
    const nombre = prompt("Nombre del nuevo torneo:"); if (!nombre) return;
    const { error } = await supabase.from('torneos').insert({ nombre, config_json: { modo: torneoModo, zonas: cantidadZonas, clasifican: clasificanPorZona } });
    if (!error) { alert("✅ Nuevo torneo inicializado."); fetchData(); }
  };

  const handleSorteo = async () => {
    if (perfil.inscripciones_abiertas) return alert("⚠️ Cierra inscripciones primero.");
    const confirmar = window.confirm("⚠️ ¿Deseas generar un nuevo sorteo?");
    if (!confirmar) return;
    if (torneoModo === 'zonas') setShowModalPlayoff(true);
    else ejecutarSorteoFinal('eliminacion_directa');
  };

  const ejecutarSorteoFinal = async (modalidadSeleccionada) => {
    setLoading(true); setShowModalPlayoff(false); setTipoPlayOff(modalidadSeleccionada);
    try {
      await supabase.from('partidos').delete().neq('id', 0); 
      await supabase.from('equipos').update({ zona: null }).neq('id', 0);
      let fixtureFinal = []; const cabezas = clubes.filter(c => c.es_cabeza_serie);
      const resto = clubes.filter(c => !c.es_cabeza_serie).sort(() => Math.random() - 0.5);
      if (torneoModo === 'zonas') {
        const grupos = Array.from({ length: cantidadZonas }, () => []);
        cabezas.forEach((c, i) => grupos[i % cantidadZonas].push(c));
        resto.forEach((eq, index) => { grupos[(index + cabezas.length) % cantidadZonas].push(eq); });
        let maxFechaZonas = 0;
        for (let i = 0; i < grupos.length; i++) {
          const letraZona = String.fromCharCode(65 + i); const nombreZona = `Zona ${letraZona}`;
          await supabase.from('equipos').update({ zona: nombreZona }).in('id', grupos[i].map(e => e.id));
          const fixGrupo = generarFixtureBerger(grupos[i]);
          if (fixGrupo.length > maxFechaZonas) maxFechaZonas = fixGrupo.length;
          fixtureFinal.push(...fixGrupo.map(f => ({ ...f, zona: nombreZona, fechaReal: calcularFechaCalendario(f.numero) })));
        }
        const fP = maxFechaZonas + 1; let encP = [];
        if (modalidadSeleccionada === 'eliminacion_directa') encP.push({ id: 'f-1', loc: { id: null, nombre: "1° ZONA A" }, vis: { id: null, nombre: "1° ZONA B" }, etapa: 'GRAN FINAL' });
        else if (modalidadSeleccionada === 'semis_y_final') {
          encP.push({ id: 's-1', loc: { id: null, nombre: "1° ZONA A" }, vis: { id: null, nombre: "2° ZONA B" }, etapa: 'SEMIFINAL 1' });
          encP.push({ id: 's-2', loc: { id: null, nombre: "1° ZONA B" }, vis: { id: null, nombre: "2° ZONA A" }, etapa: 'SEMIFINAL 2' });
        }
        else if (modalidadSeleccionada === 'finales_por_puesto') {
          encP.push({ id: 'f-t', loc: { id: null, nombre: "1° ZONA A" }, vis: { id: null, nombre: "1° ZONA B" }, etapa: 'GRAN FINAL' });
          encP.push({ id: 'f-3', loc: { id: null, nombre: "2° ZONA A" }, vis: { id: null, nombre: "2° ZONA B" }, etapa: '3° PUESTO' });
        }
        fixtureFinal.push({ numero: fP, fechaReal: calcularFechaCalendario(fP), zona: 'PLAY-OFFS', encuentros: encP });
      } else {
        const ida = generarFixtureBerger([...clubes].sort(() => Math.random() - 0.5));
        fixtureFinal = ida.map(f => ({ ...f, fechaReal: calcularFechaCalendario(f.numero), zona: 'Única' }));
      }
      const catsJuegan = categorias.filter(c => c.participa_torneo);
      const partIns = fixtureFinal.flatMap(fecha => 
        fecha.encuentros.flatMap(enc => {
          if (enc.loc.id && enc.vis.id) {
            return catsJuegan.map(cat => ({
              nro_fecha: fecha.numero, fecha_calendario: fecha.fechaReal, zona: fecha.zona || null,
              local_id: enc.loc.id, visitante_id: enc.vis.id, horario: cat.horario || '16:00',
              categoria: cat.nombre, jugado: false, finalizado: false
            }));
          } else {
            return [{
              nro_fecha: fecha.numero, fecha_calendario: fecha.fechaReal, zona: 'PLAY-OFFS',
              local_id: null, visitante_id: null, horario: '16:00', categoria: enc.etapa || 'Final', 
              nombre_manual_loc: enc.loc?.nombre || "A DEFINIR", nombre_manual_vis: enc.vis?.nombre || "A DEFINIR",
              jugado: false, finalizado: false
            }];
          }
        })
      );
      await supabase.from('partidos').insert(partIns); fetchData(); 
      alert(`✅ Sorteo generado.`);
    } catch (error) { alert("❌ Error: " + error.message); } finally { setLoading(false); }
  };

  const generarFixtureBerger = (lista) => {
    const equipos = [...lista]; if (equipos.length % 2 !== 0) equipos.push({ id: 'libre', nombre: "FECHA LIBRE" });
    const N = equipos.length; const numF = N - 1; let fechas = [];
    for (let i = 0; i < numF; i++) {
        let encs = [];
        for (let j = 0; j < N / 2; j++) {
            let l = (i + j) % (N - 1); let v = (N - 1 - j + i) % (N - 1);
            if (j === 0) v = N - 1;
            const eqL = equipos[l]; const eqV = equipos[v];
            if (eqL.id !== 'libre' && eqV.id !== 'libre') {
                const p = i % 2 === 0 ? { loc: eqL, vis: eqV } : { loc: eqV, vis: eqL };
                encs.push({ ...p, id: Math.random().toString(36).substr(2, 9), categoria: 'Primera', horario: '16:00', jugado: false });
            }
        }
        fechas.push({ numero: i + 1, encuentros: encs });
    }
    return fechas;
  };

  const borrarMensaje = async (id) => {
    if (!window.confirm("¿Borrar mensaje?")) return;
    await supabase.from('mensajes_contacto').delete().eq('id', id);
    setMensajes(mensajes.filter(m => m.id !== id));
  };

  const guardarCambioDB = async (id, campos) => { try { await supabase.from('categorias').update(campos).eq('id', id); } catch (e) { console.error(e); } };

  const handleUpdate = (id, campo, valor) => { setCategorias(prev => prev.map(cat => cat.id === id ? { ...cat, [campo]: valor } : cat)); };

  const obtenerClasificadosZona = (zona, puesto) => {
    const tZ = tablaPosiciones.filter(t => t.zona === zona).sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
    return tZ[puesto - 1] ? tZ[puesto - 1].nombre : `${puesto}° ${zona}`;
  };

  const obtenerGanador = (zona) => obtenerClasificadosZona(zona, 1);

  if (loading) return <div className="p-20 text-center text-amber-500 font-black animate-pulse uppercase tracking-widest">Sincronizando nc-s1125...</div>;

  return (
    <div className="p-4 md:p-8 bg-slate-950 min-h-screen text-white font-sans">
      {perfil.whatsapp_contacto && (
        <a href={`https://wa.me/${perfil.whatsapp_contacto}`} target="_blank" rel="noreferrer" className="fixed bottom-8 right-8 z-[200] bg-emerald-500 p-4 rounded-full shadow-2xl hover:bg-emerald-400 transition-all">
          <svg className="w-6 h-6 text-white fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.588-5.946 0-6.556 5.332-11.888 11.888-11.888 3.176 0 6.161 1.237 8.404 3.48 2.245 2.244 3.481 5.229 3.481 8.404 0 6.556-5.332 11.888-11.888 11.888-2.01 0-3.988-.511-5.741-1.482l-6.143 1.609z" /></svg>
        </a>
      )}

      <div className="max-w-6xl mx-auto space-y-8">
        <header className="border-l-4 border-amber-500 pl-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter">Panel Maestro <span className="text-amber-500">nc-s1125</span></h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 italic">Organización e Identidad del Torneo</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleNuevoTorneo} className="bg-emerald-600 px-6 py-4 rounded-2xl font-black uppercase text-[10px] shadow-lg transition-all">+ Nuevo Torneo</button>
            <button onClick={() => window.location.href = '/admin/configuracion'} className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-4 rounded-2xl font-black uppercase text-[10px] transition-all shadow-lg border border-white/10 flex items-center gap-2"><span>🎨 Estilos y Carnet</span></button>
          </div>
        </header>

        <section className="bg-slate-900/50 p-6 rounded-[2.5rem] border border-slate-800/50 shadow-inner">
            <h2 className="text-[10px] font-black uppercase text-slate-500 mb-4 tracking-widest italic text-center">Historial y Estados de Liga</h2>
            <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                {torneos.map(t => (
                    <div key={t.id} onClick={() => setTorneoActivoId(t.id)} className={`flex-shrink-0 w-64 p-5 rounded-3xl border-2 transition-all cursor-pointer ${torneoActivoId === t.id ? 'bg-blue-600/20 border-blue-500' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}>
                        <div className="flex justify-between items-start mb-3">
                            {perfil.logo_torneo ? <img src={perfil.logo_torneo} alt="logo" className="w-8 h-8 object-contain" /> : <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-[8px]">NC</div>}
                            <span className={`text-[7px] px-2 py-0.5 rounded-full font-black uppercase ${perfil.inscripciones_abiertas ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>{perfil.inscripciones_abiertas ? 'Abiertas' : 'Cerradas'}</span>
                        </div>
                        <h3 className="font-black uppercase text-xs italic truncate">{t.nombre}</h3>
                        <p className="text-[9px] text-blue-400 font-bold mt-1">{perfil.nombre_liga}</p>
                    </div>
                ))}
            </div>
        </section>

        <section className="bg-slate-900 border border-blue-500/30 rounded-[2.5rem] p-6 shadow-2xl space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-[10px] font-black uppercase text-blue-500 tracking-widest italic">⚙️ Perfil e Identidad Visual</h2>
            <div className="flex items-center gap-3 bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800">
                <span className={`text-[9px] font-black uppercase ${perfil.inscripciones_abiertas ? 'text-emerald-500' : 'text-rose-500'}`}>Inscripciones {perfil.inscripciones_abiertas ? 'Abiertas' : 'Cerradas'}</span>
                <button onClick={toggleInscripciones} className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${perfil.inscripciones_abiertas ? 'bg-emerald-600' : 'bg-slate-700'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${perfil.inscripciones_abiertas ? 'translate-x-6' : 'translate-x-0'}`}></div></button>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <input type="text" placeholder="Nombre Torneo" value={perfil.nombre_torneo} onChange={(e) => setPerfil({...perfil, nombre_torneo: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white" />
              <input type="text" placeholder="WhatsApp" value={perfil.whatsapp_contacto} onChange={(e) => setPerfil({...perfil, whatsapp_contacto: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-emerald-400 font-bold" />
            </div>
            <div className="space-y-4 bg-slate-950/40 p-5 rounded-3xl border border-slate-800/50">
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="w-full text-[10px] text-slate-500" />
              <input type="text" placeholder="URL Logo" value={perfil.logo_torneo} onChange={(e) => setPerfil({...perfil, logo_torneo: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white" />
            </div>
          </div>
          <button onClick={actualizarPerfil} disabled={guardandoPerfil} className="w-full bg-slate-800 hover:bg-blue-600 py-4 rounded-2xl font-black uppercase text-[10px] transition-all border border-slate-700 shadow-xl">{guardandoPerfil ? 'Sincronizando...' : '💾 Guardar Cambios de Perfil'}</button>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-2xl space-y-6">
            <h2 className="text-[10px] font-black uppercase text-blue-500 mb-3 tracking-widest">Sistema de Competición</h2>
            <select value={torneoModo} onChange={(e) => setTorneoModo(e.target.value)} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 text-sm font-bold text-white mb-4 cursor-pointer">
              <option value="todos_contra_todos">Liga (Ida y Vuelta)</option>
              <option value="apertura_clausura">Apertura y Clausura</option>
              <option value="zonas">Zonas / Clasificación</option>
              <option value="permanencia">Clasificación y Permanencia</option>
            </select>
            {torneoModo === 'zonas' && (
              <div className="grid grid-cols-2 gap-3 mb-4 animate-in fade-in">
                <input type="number" value={clasificanPorZona} onChange={(e) => setClasificanPorZona(e.target.value)} className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-xs text-blue-400 font-black" />
                <input type="number" min="2" max="4" value={cantidadZonas} onChange={(e) => setCantidadZonas(parseInt(e.target.value))} className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-xs text-amber-500 font-black" />
              </div>
            )}
            
            {/* REINSERCIÓN DE CABEZAS DE SERIE */}
            {torneoModo === 'zonas' && (
              <div className="mt-4 pt-4 border-t border-slate-800 animate-in fade-in">
                <h2 className="text-[10px] font-black uppercase text-amber-500 mb-2 tracking-widest italic text-center">Seleccionar cabeza de serie para cada zona</h2>
                <div className="flex flex-wrap gap-2 mb-4 justify-center">
                  {clubes.map(c => (
                    <button key={c.id} onClick={() => toggleCabezaSerie(c.id, c.es_cabeza_serie)} className={`px-2 py-1 rounded-lg text-[8px] font-black border transition-all ${c.es_cabeza_serie ? 'bg-amber-600 border-amber-400 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-600'}`}>
                      {c.es_cabeza_serie ? '⭐ ' : ''}{c.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <h2 className="text-[10px] font-black uppercase text-amber-500 mb-2 tracking-widest">Días de Juego</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {diasSemana.map(dia => (
                <button key={dia.id} onClick={() => toggleDia(dia.id)} className={`px-3 py-2 rounded-lg text-[10px] font-black border transition-all ${diasSeleccionados.includes(dia.id) ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>{dia.label}</button>
              ))}
            </div>
            <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/50 italic text-[11px] text-slate-400 leading-relaxed">{descripcionesTorneo[torneoModo]}</div>
          </section>

          <div className="space-y-4">
            <section className="bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] shadow-xl space-y-6">
              <h3 className="text-[10px] font-black text-orange-500 uppercase tracking-widest ml-2">Parámetros Económicos</h3>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Valor Multa por Módulo</label>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xl font-black text-slate-700">$</span>
                  <input type="number" className="w-full bg-transparent text-emerald-500 text-2xl font-black outline-none" value={perfil?.valor_modulo || 1000} onChange={(e) => setPerfil({...perfil, valor_modulo: e.target.value})} />
                </div>
              </div>
              <button onClick={actualizarPerfil} className="w-full bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black py-3 rounded-xl transition-all uppercase tracking-widest">Actualizar Parámetros</button>
            </section>

            <section className="bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] shadow-xl space-y-6">
              <label className="text-[10px] font-black uppercase text-amber-500 block ml-2">Categoría de Trabajo Actual</label>
              <select value={categoriaSeleccionada} onChange={(e) => manejarCambioCategoria(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-2xl text-xs font-bold text-white outline-none focus:border-amber-500">
                {categorias.map(cat => <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>)}
              </select>
            </section>
          </div>
        </div>

        <section className="bg-slate-900 p-8 rounded-[3rem] border border-slate-800 shadow-2xl flex flex-col justify-center text-center">
            <h3 className="text-[10px] font-black uppercase text-amber-500 mb-3 tracking-widest italic">Ejecución del Sorteo</h3>
            <div className="space-y-4 text-left">
                <p className="text-[9px] font-black uppercase text-slate-600 mb-1 ml-2 tracking-widest">Fecha de Inicio General</p>
                <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="w-full bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs font-bold text-blue-400 outline-none" />
                <button onClick={handleSorteo} className={`w-full py-6 rounded-[2.5rem] font-black uppercase text-xs shadow-xl transition-all ${perfil.inscripciones_abiertas ? 'bg-slate-800 text-slate-600 opacity-50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white animate-pulse'}`}>
                  {perfil.inscripciones_abiertas ? '🔒 Cierra inscripciones' : '🚀 Generar Fixture Completo'}
                </button>
            </div>
        </section>

        <RegistroEquipo onEquipoCreado={fetchData} inscripcionesAbiertas={perfil.inscripciones_abiertas} />

        <section className="bg-slate-900/50 p-6 rounded-[2.5rem] border border-slate-800/50 shadow-inner">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
            <h2 className="text-lg font-black uppercase italic tracking-tighter">Clubes Registrados ({clubes.length})</h2>
            <input type="text" placeholder="Buscar club..." value={filtroClub} onChange={(e) => setFiltroClub(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-2xl px-6 py-3 text-xs w-full md:w-72 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
          </div>
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {clubesFiltrados.map(club => (
              <div key={club.id} className="flex flex-col items-center group relative">
                <button onClick={() => eliminarEquipo(club.id, club.nombre)} className="absolute -top-2 -right-1 z-10 bg-rose-600 text-white w-5 h-5 rounded-full text-[10px] font-black opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-rose-500 shadow-lg">✕</button>
                <div className="w-14 h-14 bg-slate-950 rounded-2xl flex items-center justify-center p-3 border border-slate-800 group-hover:border-amber-500/50 transition-all duration-300">
                  <img src={club.escudo_url || 'https://via.placeholder.com/50'} alt="logo" className="max-h-full object-contain grayscale group-hover:grayscale-0 transition-all" />
                </div>
                <span className="text-[7px] font-black uppercase mt-3 text-slate-500 group-hover:text-white truncate w-full text-center tracking-tighter">{club.nombre}</span>
              </div>
            ))}
          </div>
        </section>

        {fixtureTemporal && (
          <AdminFixture fechasGeneradas={fixtureTemporal} categoriasDisponibles={categorias} clubes={clubes} onEditar={editarEquipoPartido} onIntercambiar={intercambiarLocalia} readOnly={false} />
        )}

        <section className="space-y-4">
          <div className="flex items-center gap-3"><div className="h-px flex-1 bg-slate-800"></div><h2 className="text-lg font-black uppercase italic tracking-tighter px-4 text-slate-400">Reglas por Categoría</h2><div className="h-px flex-1 bg-slate-800"></div></div>
          <div className="grid gap-3">
            {categorias.map((cat) => (
              <div key={cat.id} className="bg-slate-900 border border-slate-800 p-4 rounded-3xl flex flex-col xl:flex-row items-center justify-between gap-4 hover:border-slate-700 transition-all group">
                <div className="w-full xl:w-44"><h3 className="text-xl font-black uppercase italic tracking-tighter group-hover:text-amber-500">{cat.nombre}</h3><p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Configuración Técnica</p></div>
                <div className="flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800">
                  <span className="text-[8px] font-black text-slate-600 uppercase italic">Años</span>
                  <input type="number" value={cat.año_desde || ''} onChange={(e) => handleUpdate(cat.id, 'año_desde', e.target.value)} onBlur={() => guardarCambioDB(cat.id, { año_desde: cat.año_desde })} className="w-12 bg-transparent text-center text-xs font-black text-blue-400 outline-none" />
                  <span className="text-slate-700">~</span>
                  <input type="number" value={cat.año_hasta || ''} onChange={(e) => handleUpdate(cat.id, 'año_hasta', e.target.value)} onBlur={() => guardarCambioDB(cat.id, { año_hasta: cat.año_hasta })} className="w-12 bg-transparent text-center text-xs font-black text-blue-400 outline-none" />
                </div>
                <div className="flex gap-2 w-full xl:w-auto">
                  <button onClick={() => { const v = !cat.participa_torneo; handleUpdate(cat.id, 'participa_torneo', v); guardarCambioDB(cat.id, { participa_torneo: v }); }} className={`flex-1 xl:w-40 py-3 rounded-2xl text-[9px] font-black uppercase border transition-all ${cat.participa_torneo ? 'bg-emerald-600/10 border-emerald-500 text-emerald-500' : 'bg-rose-950/20 border-rose-900 text-rose-700'}`}>{cat.participa_torneo ? 'Competitiva' : 'Formativa'}</button>
                  <button onClick={() => { const v = !cat.suma_general; handleUpdate(cat.id, 'suma_general', v); guardarCambioDB(cat.id, { suma_general: v }); }} className={`flex-1 xl:w-40 py-3 rounded-2xl text-[9px] font-black uppercase border transition-all ${cat.suma_general ? 'bg-blue-600/10 border-blue-500 text-blue-500' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>{cat.suma_general ? '+ Suma General' : '- Promocional'}</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-900 rounded-[2.5rem] p-8 border border-slate-800 shadow-2xl space-y-6">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div><h2 className="text-xl font-black uppercase italic text-emerald-500 tracking-tighter">Buzón de Mensajes</h2><p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Consultas recibidas</p></div>
            <span className="bg-emerald-500/10 text-emerald-500 px-4 py-1 rounded-full text-[10px] font-black uppercase">{mensajes.length} Recibidos</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mensajes.length > 0 ? (
              mensajes.map((m) => (
                <div key={m.id} className="bg-slate-950 border border-slate-800 p-5 rounded-3xl relative group hover:border-emerald-500/30 transition-all">
                  <button onClick={() => borrarMensaje(m.id)} className="absolute top-4 right-4 text-slate-700 hover:text-rose-500 text-xs font-black transition-colors uppercase">Borrar</button>
                  <div className="mb-2"><span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded uppercase font-black">{m.asunto || 'General'}</span><h3 className="text-xs font-black uppercase mt-1 text-white">{m.nombre}</h3></div>
                  <p className="text-[11px] text-slate-400 italic mt-3 bg-slate-900/50 p-3 rounded-xl">"{m.mensaje}"</p>
                  <p className="text-[8px] text-slate-600 mt-3 font-mono text-right">{new Date(m.created_at).toLocaleString('es-AR')}</p>
                </div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center text-slate-700 font-bold uppercase text-[10px] italic">No hay mensajes nuevos</div>
            )}
          </div>
        </section>

        {showModalPlayoff && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
            <div className="bg-slate-900 border border-amber-500/50 p-8 rounded-[2.5rem] max-w-md w-full shadow-2xl animate-in zoom-in duration-300">
              <h2 className="text-xl font-black uppercase italic text-amber-500 mb-2">Finalizar Sorteo</h2>
              <p className="text-slate-400 text-[10px] mb-6 font-bold uppercase tracking-widest">Selecciona cómo se definirán los clasificados</p>
              <div className="space-y-3">
                {[
                  { id: 'eliminacion_directa', label: 'Final Directa', desc: 'Solo cruce por el campeonato (1° A vs 1° B)' },
                  { id: 'finales_por_puesto', label: 'Finales por Puesto', desc: '1ros por el Título y 2dos por el 3° Puesto' },
                  { id: 'semis_y_final', label: 'Semifinales y Final', desc: 'Cruces entre 1° y 2° de cada zona' },
                  { id: 'ida_vuelta', label: 'Ida y Vuelta', desc: 'Cruces eliminatorios de doble partido' }
                ].map((opt) => (
                  <button key={opt.id} onClick={() => ejecutarSorteoFinal(opt.id)} className="w-full text-left p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-amber-500 transition-all group">
                    <div className={`text-[10px] font-black uppercase group-hover:text-amber-500 ${opt.id === 'finales_por_puesto' ? 'text-purple-400' : 'text-white'}`}>{opt.label}</div>
                    <div className="text-[8px] text-slate-500 font-bold uppercase mt-1">{opt.desc}</div>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowModalPlayoff(false)} className="w-full mt-6 py-3 text-[10px] font-black uppercase text-slate-500 hover:text-rose-500 transition-colors">Cancelar y volver</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminConfig;