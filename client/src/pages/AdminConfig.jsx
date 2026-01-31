import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import axios from 'axios';
import AdminFixture from './AdminFixture';
import RegistroEquipo from '../components/RegistroEquipo';
import { useNavigate } from 'react-router-dom';


const AdminConfig = () => {
const navigate = useNavigate();
const [categorias, setCategorias] = useState([]);
const [clubes, setClubes] = useState([]);
const [filtroClub, setFiltroClub] = useState('');
const [loading, setLoading] = useState(true);
const [torneoModo, setTorneoModo] = useState('todos_contra_todos');
const [userOrgId, setUserOrgId] = useState(null);

// Función para obtener la organización del perfil logueado
useEffect(() => {
  const obtenerContextoOrg = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('organizacion_id')
          .eq('id', session.user.id)
          .single();
        
        if (perfil) setUserOrgId(perfil.organizacion_id);
      }
    } catch (err) {
      console.error("Error obteniendo organización:", err.message);
    }
  };
  obtenerContextoOrg();
}, []);

// eslint-disable-next-line no-unused-vars
const [tipoPlayOff, setTipoPlayOff] = useState('eliminacion_directa'); // ESTA ES LA QUE FALTA
const [cantidadZonas, setCantidadZonas] = useState(2);
const [fixtureTemporal, setFixtureTemporal] = useState(null);

// --- ESTADOS DE IDENTIDAD, CALENDARIO, PERFIL Y MENSAJES ---
const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0]);
const [diasSeleccionados, setDiasSeleccionados] = useState(['6']);
const [perfil, setPerfil] = useState({
email_contacto: '',
whatsapp_contacto: '',
nombre_liga: 'Sc-1225',
nombre_torneo: 'Torneo Oficial 2026',
logo_torneo: '',
inscripciones_abiertas: true

});

const [guardandoPerfil, setGuardandoPerfil] = useState(false);
const [subiendoLogo, setSubiendoLogo] = useState(false);
const [mensajes, setMensajes] = useState([]);

// --- NUEVOS ESTADOS SOLICITADOS POR EL CLIENTE ---
const [torneos, setTorneos] = useState([]); // REQ 6: Historial
const [torneoActivoId, setTorneoActivoId] = useState(null);
const [clasificanPorZona, setClasificanPorZona] = useState(2); // REQ 3
const [tablaPosiciones, setTablaPosiciones] = useState([]);
const [showModalPlayoff, setShowModalPlayoff] = useState(false);

const diasSemana = [
{ id: '1', label: 'Lu' }, { id: '2', label: 'Ma' }, { id: '3', label: 'Mi' },
{ id: '4', label: 'Ju' }, { id: '5', label: 'Vi' }, { id: '6', label: 'Sá' }, { id: '0', label: 'Do' }
];


// Memoria para la categoría: Esto evita que se pierda al refrescar
// eslint-disable-next-line no-unused-vars
const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(() => {
return localStorage.getItem('categoria_activa_nc') || 'Primera';
});

// Función para cambiar categoría (Aquí se soluciona el error de "not used")
// eslint-disable-next-line no-unused-vars
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

// --- MOVER ESTO ARRIBA DE FETCHDATA ---
const calcularTablaPosiciones = useCallback((partidos, clubes) => {
const tabla = {};
clubes.forEach(c => {
tabla[c.id] = { id: c.id, nombre: c.nombre, zona: c.zona, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
});

partidos.filter(p => p.jugado === true).forEach(p => {
const local = tabla[p.local_id];
const vis = tabla[p.visitante_id];
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

// --- FUNCIÓN fetchData FUSIONADA Y CORREGIDA PARA PERSISTENCIA TOTAL ---

const fetchData = useCallback(async () => {
  if (!userOrgId) return;

  setLoading(true);
  try {
    // 1. Ejecutamos las consultas. 
    // NOTA: Quitamos perfilData del Promise.all para manejarlo con .maybeSingle() por separado
    const [
      { data: catData },
      { data: clubData },
      { data: msgData },
      { data: tData },
      { data: partidosDB }
    ] = await Promise.all([
      supabase.from('categorias').select('*').eq('organizacion_id', userOrgId).order('orden_correlativo', { ascending: true }),
      supabase.from('equipos').select('*').eq('organizacion_id', userOrgId).order('nombre'),
      supabase.from('mensajes_contacto').select('*').eq('organizacion_id', userOrgId).order('created_at', { ascending: false }),
      supabase.from('configuracion_torneo').select('*').eq('organizacion_id', userOrgId).order('id', { ascending: false }),
      supabase.from('partidos').select('*, local:equipos!local_id(id, nombre, zona), visitante:equipos!visitante_id(id, nombre, zona)').eq('organizacion_id', userOrgId)
    ]);

    // 2. AQUÍ ESTÁ EL CAMBIO: Manejo específico para evitar el error 406
    const { data: perfilData } = await supabase
      .from('configuracion_liga')
      .select('*')
      .eq('organizacion_id', userOrgId)
      .maybeSingle(); // <--- Esto evita que falle si la fila no existe todavía

    if (perfilData) {
      setPerfil(perfilData);
    } else {
      // Si no existe fila en configuracion_liga, intentamos traer al menos el nombre de la Org
      const { data: orgData } = await supabase
        .from('organizaciones')
        .select('nombre, logo_url')
        .eq('id', userOrgId)
        .maybeSingle();
      
      if (orgData) {
        setPerfil(prev => ({
          ...prev,
          nombre_liga: orgData.nombre,
          logo_torneo: orgData.logo_url
        }));
      }
    }

    // --- Procesamiento de Partidos y el resto de tus estados ---
    if (partidosDB) {
      const agrupados = partidosDB.reduce((acc, p) => {
        const key = `${p.nro_fecha}-${p.zona || 'General'}`;
        if (!acc[key]) {
          acc[key] = { numero: p.nro_fecha, fechaReal: p.fecha_calendario || 'S/D', zona: p.zona, encuentros: [] };
        }
        acc[key].encuentros.push({
          id: p.id,
          loc: p.local || { id: null, nombre: "A DEFINIR" },
          vis: p.visitante || { id: null, nombre: "A DEFINIR" },
          categoria: p.categoria || 'Primera',
          horario: p.horario || '16:00',
          goles_loc: p.goles_local,
          goles_vis: p.goles_visitante,
          jugado: p.jugado,
          finalizado: p.finalizado
        });
        return acc;
      }, {});
      setFixtureTemporal(Object.values(agrupados).sort((a, b) => a.numero - b.numero));
    }

    if (catData) setCategorias(catData);
    if (clubData) {
      setClubes(clubData);
      if (partidosDB) setTablaPosiciones(calcularTablaPosiciones(partidosDB, clubData));
    }
    if (msgData) setMensajes(msgData);
    if (tData) {
      setTorneos(tData);
      const activo = tData.find(t => t.activo === true) || tData[0];
      if (activo) setTorneoActivoId(activo.id);
    }

  } catch (err) {
    console.error('Error en fetchData:', err);
  } finally {
    setLoading(false);
  }
}, [userOrgId, calcularTablaPosiciones]);


useEffect(() => {
  fetchData();
}, [fetchData]);


// --- FUNCIONES DE EDICIÓN MANUAL ---
const editarEquipoPartido = async (partidoId, campo, nuevoEquipoId) => {
setLoading(true);
try {
const valor = nuevoEquipoId === "" ? null : nuevoEquipoId;
const { error } = await supabase
.from('partidos')
.update({ [campo]: valor })
.eq('id', partidoId);
if (error) throw error;
await fetchData();
// eslint-disable-next-line no-unused-vars
} catch (err) {
alert("Error al editar equipo");
} finally {
setLoading(false);
}
};

const intercambiarLocalia = async (partido) => {
setLoading(true);
try {
const { error } = await supabase
.from('partidos')
.update({
local_id: partido.vis?.id || null,
visitante_id: partido.loc?.id || null,
nombre_manual_loc: partido.vis?.nombre || "A DEFINIR",
nombre_manual_vis: partido.loc?.nombre || "A DEFINIR"
})

.eq('id', partido.id);
if (error) throw error;
await fetchData();
// eslint-disable-next-line no-unused-vars
} catch (err) {
alert("Error al intercambiar");
} finally {
setLoading(false);
}
};


const toggleInscripciones = async () => {
const nuevoEstado = !perfil.inscripciones_abiertas;
const { error } = await supabase
.from('configuracion_liga')
.update({ inscripciones_abiertas: nuevoEstado })
.eq('organizacion_id', userOrgId);
if (error) {
alert("Error al cambiar estado: " + error.message);
} else {
setPerfil({ ...perfil, inscripciones_abiertas: nuevoEstado });
alert(nuevoEstado ? "🔓 Inscripciones ABIERTAS para nuevos clubes." : "🔒 Inscripciones CERRADAS. El fixture ahora puede ser generado.");
}
};

const handleLogoUpload = async (e) => {
const file = e.target.files[0];
if (!file) return;
setSubiendoLogo(true);
const formData = new FormData();
formData.append('file', file);
formData.append('upload_preset', 'nc_s1125_presets');
try {
const res = await axios.post(
'https://api.cloudinary.com/v1_1/dgtc9qfmv/image/upload',
formData
);

setPerfil({ ...perfil, logo_torneo: res.data.secure_url });
alert("✅ Logo subido correctamente");
} catch (err) {
console.error(err);
alert("❌ Error al subir el archivo");
} finally {
setSubiendoLogo(false);
}
};

const toggleDia = (id) => {
setDiasSeleccionados(prev =>
prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
);
};


const calcularFechaCalendario = (numFecha) => {
let base = new Date(fechaInicio + 'T00:00:00');
let diasValidos = diasSeleccionados.map(Number);
if (diasValidos.length === 0) diasValidos = [6];
let fechaEncontrada = new Date(base);
let fechasContadas = 0;
while (fechasContadas < numFecha) {
if (diasValidos.includes(fechaEncontrada.getDay())) {
fechasContadas++;
if (fechasContadas === numFecha) break;
}
fechaEncontrada.setDate(fechaEncontrada.getDate() + 1);
}
return fechaEncontrada.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const actualizarPerfil = async () => {
  if (!userOrgId) return alert("Error: No se identificó la organización");
  setGuardandoPerfil(true);

  try {
    // ACTUALIZACIÓN A: Tabla 'organizaciones' (Esto es lo que lee el NAVBAR)
    const { error: errorOrg } = await supabase
      .from('organizaciones')
      .update({
        nombre: perfil.nombre_liga, // Aquí va "Liga de las Nenas"
        logo_url: perfil.logo_torneo  // La URL de Cloudinary
      })
      .eq('id', userOrgId);

    if (errorOrg) throw errorOrg;

    // ACTUALIZACIÓN B: Tabla 'configuracion_liga' (Parámetros internos)
    const { error: errorConfig } = await supabase
      .from('configuracion_liga')
      .upsert({
        organizacion_id: userOrgId,
        nombre_liga: perfil.nombre_liga,
        whatsapp_contacto: perfil.whatsapp_contacto,
        logo_url: perfil.logo_torneo,
        nombre_torneo: perfil.nombre_torneo
      }, { onConflict: 'organizacion_id' });

    if (errorConfig) throw errorConfig;

    alert("✅ Marca actualizada. Refresca para ver los cambios en el Navbar.");
    
    // Forzamos la recarga de datos para que el estado local sea el de la DB
    await fetchData(); 

  } catch (err) {
    console.error(err);
    alert("❌ Error al sincronizar: " + err.message);
  } finally {
    setGuardandoPerfil(false);
  }
};


const toggleCabezaSerie = async (id, estadoActual) => {
const nuevoEstado = !estadoActual;
setClubes(prev => prev.map(c => c.id === id ? { ...c, es_cabeza_serie: nuevoEstado } : c));
const { error } = await supabase
.from('equipos')
.update({ es_cabeza_serie: nuevoEstado })
.eq('id', id);

if (error) {
alert("Error al actualizar cabeza de serie");
fetchData();
}
};


const eliminarEquipo = async (id, nombre) => {
const confirmar = window.confirm(
`⚠️ ¡ATENCIÓN!\nPara eliminar a "${nombre}" primero debemos borrar todos sus partidos asignados en el fixture.\n\n¿Deseas eliminar el club y todos sus registros asociados?`
);
if (!confirmar) return;
try {
setLoading(true);

// 1. Borramos todos los partidos donde el equipo sea local o visitante
const { error: errorPartidos } = await supabase
.from('partidos')
.delete()
.or(`local_id.eq.${id},visitante_id.eq.${id}`);
if (errorPartidos) throw new Error("No se pudieron borrar los partidos asociados.");

// 2. Ahora que no hay referencias, borramos el equipo
const { error: errorEquipo } = await supabase
.from('equipos')
.delete()
.eq('id', id);

if (errorEquipo) throw errorEquipo;
alert("✅ Club y partidos asociados eliminados correctamente.");
fetchData(); // Recargamos todo el panel
} catch (error) {
console.error("Error en proceso de borrado:", error);
alert("❌ Error: " + error.message);
} finally {
setLoading(false);
}
};

const handleNuevoTorneo = async () => {
  const nombre = prompt("Nombre del nuevo torneo (Ej: Clausura 2026):");
  if (!nombre) return;

  // IMPORTANTE: Asegúrate de que userOrgId esté disponible en el componente
  if (!userOrgId) {
    return alert("❌ Error: No se puede crear el torneo porque no se identificó tu organización.");
  }

  const { error } = await supabase
    .from('configuracion_torneo') // Usamos la tabla SaaS
    .insert({
      nombre_edicion: nombre,
      organizacion_id: userOrgId, // <--- VINCULACIÓN VITAL
      modelo_torneo: 'todos_contra_todos', // Valor por defecto para cumplir el CHECK
      año_lectivo: 2026,
      sorteo_realizado: false,
      dias_juego: []
    })
    .select();

  if (error) {
    console.error("Error al crear torneo:", error);
    alert("❌ Error: " + error.message);
  } else {
    alert("✅ Nuevo torneo '" + nombre + "' creado y vinculado a tu liga.");
    // Si tienes una función para refrescar la lista de torneos:
    fetchData(); 
  }
};


const handleSorteo = async () => {
if (perfil.inscripciones_abiertas) return alert("⚠️ Debes CERRAR las inscripciones antes de poder realizar el sorteo oficial.");
const confirmar = window.confirm("⚠️ Esta acción borrará el sorteo anterior (fechas, zonas y cruces). Los clubes registrados NO se eliminarán. ¿Deseas continuar?");
if (!confirmar) return;

if (torneoModo === 'zonas') {
// REGLA DE NEGOCIO: Antes de sortear zonas, preguntamos la modalidad de Play-off
setShowModalPlayoff(true);
} else {
ejecutarSorteoFinal('eliminacion_directa');
}
};

const ejecutarSorteoFinal = async (modalidadSeleccionada) => {
setLoading(true);
setShowModalPlayoff(false);
setTipoPlayOff(modalidadSeleccionada);
try {
// --- 1. LIMPIEZA TOTAL DE DATOS PREVIOS ---
const { error: errorLimpieza } = await supabase
.from('partidos')
.delete()
.neq('id', 0);

if (errorLimpieza) throw new Error("No se pudo resetear la tabla de partidos.");
await supabase.from('equipos').update({ zona: null }).neq('id', 0);

// --- 2. PREPARACIÓN DE EQUIPOS ---
let fixtureFinal = [];
const cabezas = clubes.filter(c => c.es_cabeza_serie);
const resto = clubes.filter(c => !c.es_cabeza_serie).sort(() => Math.random() - 0.5);

if (torneoModo === 'zonas') {
const grupos = Array.from({ length: cantidadZonas }, () => []);
cabezas.forEach((c, i) => grupos[i % cantidadZonas].push(c));
resto.forEach((eq, index) => {
grupos[(index + cabezas.length) % cantidadZonas].push(eq);
});


let maxFechaZonas = 0;
for (let i = 0; i < grupos.length; i++) {
const letraZona = String.fromCharCode(65 + i);
const nombreZona = `Zona ${letraZona}`;
const ids = grupos[i].map(e => e.id);
await supabase.from('equipos').update({ zona: nombreZona }).in('id', ids);

const fixGrupo = generarFixtureBerger(grupos[i]);
if (fixGrupo.length > maxFechaZonas) maxFechaZonas = fixGrupo.length;
fixtureFinal.push(...fixGrupo.map(fecha => ({
...fecha,
zona: nombreZona,
fechaReal: calcularFechaCalendario(fecha.numero)
})));
}

// --- 3. GENERACIÓN DE CRUCES DE PLAY-OFF ---
const fechaPlayoff = maxFechaZonas + 1;
let encuentrosPlayoff = [];
if (modalidadSeleccionada === 'eliminacion_directa') {
encuentrosPlayoff.push({
id: 'f-1',
loc: { id: null, nombre: "1° ZONA A" },
vis: { id: null, nombre: "1° ZONA B" },
etapa: 'GRAN FINAL'
});
}
else if (modalidadSeleccionada === 'semis_y_final') {
encuentrosPlayoff.push({ id: 's-1', loc: { id: null, nombre: "1° ZONA A" }, vis: { id: null, nombre: "2° ZONA B" }, etapa: 'SEMIFINAL 1' });
encuentrosPlayoff.push({ id: 's-2', loc: { id: null, nombre: "1° ZONA B" }, vis: { id: null, nombre: "2° ZONA A" }, etapa: 'SEMIFINAL 2' });
}

// --- NUEVA MODALIDAD AGREGADA AQUÍ ---
else if (modalidadSeleccionada === 'finales_por_puesto') {
// Partido por el título
encuentrosPlayoff.push({
id: 'f-titulo',
loc: { id: null, nombre: "1° ZONA A" },
vis: { id: null, nombre: "1° ZONA B" },
etapa: 'GRAN FINAL'
});

// Partido por el tercer puesto
encuentrosPlayoff.push({
id: 'f-tercer-puesto',
loc: { id: null, nombre: "2° ZONA A" },
vis: { id: null, nombre: "2° ZONA B" },
etapa: '3° PUESTO'
});
}
fixtureFinal.push({
numero: fechaPlayoff,
fechaReal: calcularFechaCalendario(fechaPlayoff),
zona: 'PLAY-OFFS',
encuentros: encuentrosPlayoff
});
} else {
const ida = generarFixtureBerger([...clubes].sort(() => Math.random() - 0.5));
fixtureFinal = ida.map(f => ({ ...f, fechaReal: calcularFechaCalendario(f.numero), zona: 'Única' }));
}

// --- 4. GUARDADO MASIVO MULTI-CATEGORÍA ---
// Filtramos solo las categorías que marcaste como "Participa del Torneo"
const categoriasQueJuegan = categorias.filter(c => c.participa_torneo);
const partidosParaInsertar = fixtureFinal.flatMap(fecha =>

fecha.encuentros.flatMap(enc => {
// Si es un partido de zona (donde hay equipos reales)
if (enc.loc.id && enc.vis.id) {
// CREAMOS UN PARTIDO POR CADA CATEGORÍA ACTIVA
return categoriasQueJuegan.map(cat => ({
nro_fecha: fecha.numero,
fecha_calendario: fecha.fechaReal,
zona: fecha.zona || null,
local_id: enc.loc.id,
visitante_id: enc.vis.id,
horario: cat.horario || '16:00', // Usa el horario configurado en la regla de categoría
categoria: cat.nombre, // AQUÍ SE GUARDA LA CATEGORÍA REAL AUTOMÁTICAMENTE
jugado: false,
finalizado: false
}));
} else {
// Si es un Play-off (todavía sin IDs), guardamos solo un registro con la etapa
return [{
nro_fecha: fecha.numero,
fecha_calendario: fecha.fechaReal,
zona: 'PLAY-OFFS',
local_id: null,
visitante_id: null,
horario: '16:00',
categoria: enc.etapa || 'Final',
nombre_manual_loc: enc.loc?.nombre || "A DEFINIR",
nombre_manual_vis: enc.vis?.nombre || "A DEFINIR",
jugado: false,
finalizado: false
}];
}
})
);

const { error: errorInsert } = await supabase.from('partidos').insert(partidosParaInsertar);
if (errorInsert) throw errorInsert;
setFixtureTemporal(fixtureFinal);
await fetchData();
alert(`✅ Sorteo "${modalidadSeleccionada}" generado y guardado.`);
} catch (error) {
console.error("Error crítico en el sorteo:", error);
alert("❌ Error: " + error.message);
} finally {
setLoading(false);
}
};

const generarFixtureBerger = (lista) => {
const equipos = [...lista];
// Si es impar, agregamos equipo fantasma para la rotación
if (equipos.length % 2 !== 0) {
equipos.push({ id: 'libre', nombre: "FECHA LIBRE" });
}

const N = equipos.length;
const numFechas = N - 1;
let fechas = [];
for (let i = 0; i < numFechas; i++) {
let encuentros = [];
for (let j = 0; j < N / 2; j++) {
let local = (i + j) % (N - 1);
let visitante = (N - 1 - j + i) % (N - 1);
if (j === 0) visitante = N - 1;

const eqLoc = equipos[local];
const eqVis = equipos[visitante];
// Solo agregamos el partido si ninguno de los dos es el equipo "LIBRE"
if (eqLoc.id !== 'libre' && eqVis.id !== 'libre') {
const partido = i % 2 === 0
? { loc: eqLoc, vis: eqVis }
: { loc: eqVis, vis: eqLoc };
encuentros.push({
...partido,
id: Math.random().toString(36).substr(2, 9),
categoria: 'Primera',
horario: '16:00',
jugado: false
});
}
}
fechas.push({ numero: i + 1, encuentros });
}
return fechas;
};


const borrarMensaje = async (id) => {
if (!window.confirm("¿Seguro que deseas borrar este mensaje?")) return;
const { error } = await supabase.from('mensajes_contacto').delete().eq('id', id);
if (!error) setMensajes(mensajes.filter(m => m.id !== id));
};


const guardarCambioDB = async (id, camposActualizados) => {
try { await supabase.from('categorias').update(camposActualizados).eq('id', id); } catch (error) { console.error(error); }
};


const handleUpdate = (id, campo, valor) => {
setCategorias(prev => prev.map(cat => cat.id === id ? { ...cat, [campo]: valor } : cat));
};


const clubesFiltrados = clubes.filter(c => c.nombre.toLowerCase().includes(filtroClub.toLowerCase()));
// --- LÓGICA DE CLASIFICACIÓN DINÁMICA PARA BRACKETS ---
const obtenerClasificadosZona = (zona, puesto) => {
const tablaZona = tablaPosiciones
.filter(t => t.zona === zona)
.sort((a, b) =>
b.pts - a.pts ||
b.dg - a.dg ||
b.gf - a.gf
);
return tablaZona[puesto - 1]
? tablaZona[puesto - 1].nombre
: `${puesto}° ${zona}`;
};

const obtenerGanador = (zona) => obtenerClasificadosZona(zona, 1);
if (loading) return <div className="p-20 text-center text-amber-500 font-black animate-pulse uppercase tracking-widest">Sincronizando nc-s1125...</div>;
return (
<div className="p-4 md:p-8 bg-slate-950 min-h-screen text-white font-sans">
{perfil.whatsapp_contacto && (
<a href={`https://wa.me/${perfil.whatsapp_contacto}`} target="_blank" rel="noreferrer" className="fixed bottom-8 right-8 z-[200] bg-emerald-500 p-4 rounded-full shadow-2xl hover:bg-emerald-400 hover:scale-110 transition-all group">
<span className="absolute right-full mr-3 bg-slate-900 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">¿Necesitás ayuda?</span>
<svg className="w-6 h-6 text-white fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.588-5.946 0-6.556 5.332-11.888 11.888-11.888 3.176 0 6.161 1.237 8.404 3.48 2.245 2.244 3.481 5.229 3.481 8.404 0 6.556-5.332 11.888-11.888 11.888-2.01 0-3.988-.511-5.741-1.482l-6.143 1.609z" /></svg>
</a>
)}
<div className="max-w-6xl mx-auto space-y-8">
<header className="border-l-4 border-amber-500 pl-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
<div>
<h1 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-white">
Panel Maestro <span className="text-amber-500">SC1225</span>
</h1>
<p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 italic">
Organización e Identidad del Torneo
</p>
<button 
  onClick={() => navigate('/validador-biometrico')}
  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-4 rounded-2xl text-xs font-black uppercase shadow-lg flex items-center gap-3 transition-all"
>
  🛡️ Estación de Validación Biométrica
</button>
</div>
<div className="flex gap-2">
<button onClick={handleNuevoTorneo} className="bg-emerald-600 hover:bg-emerald-500 px-6 py-4 rounded-2xl font-black uppercase text-[10px] shadow-lg transition-all">+ Nuevo Torneo</button>
<button onClick={() => window.location.href = '/AdminConfiguracion'} className="w-full md:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-8 py-4 rounded-2xl font-black uppercase text-[10px] transition-all shadow-lg border border-white/10 flex items-center gap-2">
<span>🎨 Estilos y Carnet</span>
</button>
</div>
</header>
<section className="bg-slate-900/50 p-6 rounded-[2.5rem] border border-slate-800/50 shadow-inner">
<h2 className="text-[10px] font-black uppercase text-slate-500 mb-4 tracking-widest italic text-center">Historial y Estados de Liga</h2>
<div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
{torneos.map(t => (
<div key={t.id} onClick={() => setTorneoActivoId(t.id)}
className={`flex-shrink-0 w-64 p-5 rounded-3xl border-2 transition-all cursor-pointer ${torneoActivoId === t.id ? 'bg-blue-600/20 border-blue-500' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}>
<div className="flex justify-between items-start mb-3">
{perfil.logo_torneo ? (
<img src={perfil.logo_torneo} alt="logo" className="w-8 h-8 object-contain rounded-lg bg-white/5 p-1" />
) : (
<div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-[8px]">NC</div>
)}
<span className={`text-[7px] px-2 py-0.5 rounded-full font-black uppercase ${perfil.inscripciones_abiertas ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
{perfil.inscripciones_abiertas ? 'Inscrip. Abiertas' : 'Inscrip. Cerradas'}
</span>
</div>
<h3 className="font-black uppercase text-xs italic truncate text-white">{t.nombre}</h3>
<p className="text-[9px] text-blue-400 font-bold uppercase mt-1">{perfil.nombre_liga}</p>
<div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3">
<span className="text-[8px] text-slate-500 uppercase font-black">Inicio: {new Date(t.created_at).toLocaleDateString()}</span>
<div className={`w-2 h-2 rounded-full ${t.id === torneoActivoId ? 'bg-emerald-500 animate-ping' : 'bg-slate-700'}`}></div>
</div>
</div>
))}
</div>
</section>

<section className="bg-slate-900 border border-blue-500/30 rounded-[2.5rem] p-6 shadow-2xl space-y-6">
<div className="flex justify-between items-center">
<h2 className="text-[10px] font-black uppercase text-blue-500 tracking-widest italic">⚙️ Perfil e Identidad Visual</h2>
<div className="flex items-center gap-3 bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800">
<span className={`text-[9px] font-black uppercase ${perfil.inscripciones_abiertas ? 'text-emerald-500' : 'text-rose-500'}`}>
Inscripciones {perfil.inscripciones_abiertas ? 'Abiertas' : 'Cerradas'}
</span>
<button onClick={toggleInscripciones} className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${perfil.inscripciones_abiertas ? 'bg-emerald-600' : 'bg-slate-700'}`}>
<div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${perfil.inscripciones_abiertas ? 'translate-x-6' : 'translate-x-0'}`}></div>
</button>
</div>
</div>
<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
<div className="space-y-4">
<div className="space-y-1">
<label className="text-[9px] font-black uppercase text-slate-500 ml-2">Nombre del Torneo</label>
<input type="text" placeholder="Ej: Clausura 2026" value={perfil.nombre_torneo} onChange={(e) => setPerfil({...perfil, nombre_torneo: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-blue-500 transition-all" />
</div>
<div className="space-y-1">
<label className="text-[9px] font-black uppercase text-emerald-500 ml-2">WhatsApp Contacto</label>
<input type="text" placeholder="54911..." value={perfil.whatsapp_contacto} onChange={(e) => setPerfil({...perfil, whatsapp_contacto: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-emerald-400 font-bold outline-none focus:border-emerald-500 transition-all" />
</div>
</div>
<div className="space-y-4 bg-slate-950/40 p-5 rounded-3xl border border-slate-800/50">
<div className="space-y-2">
<label className="text-[9px] font-black uppercase text-slate-500 ml-2">Subir Logo Oficial</label>
<input type="file" accept="image/*" onChange={handleLogoUpload} className="w-full text-[10px] text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-600/10 file:text-blue-500 file:font-black hover:file:bg-blue-600/20 transition-all" />
{subiendoLogo && <p className="text-[8px] text-blue-400 animate-pulse font-black uppercase ml-2">Procesando imagen...</p>}
</div>
<div className="space-y-1">
<label className="text-[9px] font-black uppercase text-slate-500 ml-2">O pegar URL del Logo</label>
<input type="text" placeholder="https://..." value={perfil.logo_torneo} onChange={(e) => setPerfil({...perfil, logo_torneo: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-blue-500 transition-all" />
</div>
</div>
</div>
<button onClick={actualizarPerfil} disabled={guardandoPerfil} className="w-full bg-slate-800 hover:bg-blue-600 py-4 rounded-2xl font-black uppercase text-[10px] transition-all border border-slate-700 shadow-xl">
{guardandoPerfil ? 'Sincronizando...' : '💾 Guardar Cambios de Perfil'}
</button>
</section>

{/* REGLAS DEL SISTEMA DE COMPETICIÓN */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
<section className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-2xl space-y-6">
<div>
<h2 className="text-[10px] font-black uppercase text-blue-500 mb-3 tracking-widest">Sistema de Competición</h2>
<select value={torneoModo} onChange={(e) => setTorneoModo(e.target.value)} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 text-sm font-bold outline-none mb-4 cursor-pointer">
<option value="todos_contra_todos">Liga (Ida y Vuelta)</option>
<option value="apertura_clausura">Apertura y Clausura</option>
<option value="zonas">Zonas / Clasificación</option>
<option value="permanencia">Clasificación y Permanencia</option>
</select>

{torneoModo === 'zonas' && (
<div className="grid grid-cols-2 gap-3 mb-4 animate-in fade-in">
<div className="space-y-1">
<label className="text-[8px] font-black uppercase text-amber-500 ml-1">Clasifican</label>
<input type="number" value={clasificanPorZona} onChange={(e) => setClasificanPorZona(e.target.value)} className="w-full bg-slate-950 p-2 rounded-lg border border-slate-800 text-xs text-blue-400 font-black" />
</div>
<div className="space-y-1">
<label className="text-[8px] font-black uppercase text-amber-500 ml-1">Zonas</label>
<input type="number" min="2" max="4" value={cantidadZonas} onChange={(e) => setCantidadZonas(parseInt(e.target.value))} className="w-full bg-slate-950 p-2 rounded-lg border border-slate-800 text-xs text-amber-500 font-black" />
</div>
</div>
)}
{/* SELECCIÓN DE CABEZAS DE SERIE (Solo visible en modo zonas) */}
    {torneoModo === 'zonas' && (
      <div className="mt-4 pt-4 border-t border-slate-800 animate-in fade-in slide-in-from-top-2">
        <h2 className="text-[10px] font-black uppercase text-amber-500 mb-4 tracking-widest italic text-center">
          Designar Cabezas de Serie
        </h2>
        <div className="flex flex-wrap gap-2 mb-4 justify-center">
          {clubes.map(c => (
            <button 
              key={c.id} 
              onClick={() => toggleCabezaSerie(c.id, c.es_cabeza_serie)} 
              className={`px-3 py-2 rounded-xl text-[9px] font-black border transition-all flex items-center gap-2 ${
                c.es_cabeza_serie 
                ? 'bg-amber-600 border-amber-400 text-white shadow-lg shadow-amber-900/20' 
                : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'
              }`}
            >
              {c.es_cabeza_serie ? '⭐' : '☆'} {c.nombre}
            </button>
          ))}
        </div>
        <p className="text-[8px] text-slate-600 text-center uppercase font-bold italic">
          * Los cabezas de serie se distribuirán equitativamente entre las {cantidadZonas} zonas.
        </p>
      </div>
    )}

<h2 className="text-[10px] font-black uppercase text-amber-500 mb-2 tracking-widest">Días de Juego (Multiselección)</h2>
<div className="flex flex-wrap gap-2 mb-4">
{diasSemana.map(dia => (
<button key={dia.id} onClick={() => toggleDia(dia.id)} className={`px-3 py-2 rounded-lg text-[10px] font-black border transition-all ${diasSeleccionados.includes(dia.id) ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'}`}>{dia.label}</button>
))}
</div>
<div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/50 italic text-[11px] text-slate-400 leading-relaxed">{descripcionesTorneo[torneoModo]}</div>
</div>
</section>

{/* COLUMNA DERECHA: ECONOMÍA Y EJECUCIÓN */}
<div className="space-y-4">
<div className="bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] shadow-xl space-y-6">
<h3 className="text-[10px] font-black text-orange-500 uppercase tracking-widest ml-2">Parámetros Económicos</h3>
<div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
<label className="text-[9px] font-black text-slate-500 uppercase ml-1">Valor Multa por Módulo</label>
<div className="flex items-center gap-3 mt-2">
<span className="text-xl font-black text-slate-700">$</span>
<input
type="number"
className="w-full bg-transparent text-emerald-500 text-2xl font-black outline-none"
value={perfil?.valor_modulo || 1000}
onChange={(e) => setPerfil({...perfil, valor_modulo: e.target.value})}
/>
</div>
</div>
<button onClick={actualizarPerfil} className="w-full bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black py-3 rounded-xl transition-all">
ACTUALIZAR PARÁMETROS
</button>
</div>

<section className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-2xl flex flex-col justify-center text-center">
<h3 className="text-[10px] font-black text-amber-500 mb-3 tracking-widest italic">Ejecución del Sorteo</h3>
<div className="space-y-4">
<div className="text-left">
<p className="text-[9px] font-black uppercase text-slate-600 mb-1 ml-2 tracking-widest">Fecha de Inicio General</p>
<input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-bold text-blue-400 outline-none" />
</div>
<button onClick={handleSorteo} className={`w-full py-6 rounded-[2rem] font-black uppercase text-xs shadow-xl active:scale-95 transition-all ${perfil.inscripciones_abiertas ? 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50' : 'bg-blue-600 hover:bg-blue-500 text-white animate-pulse'}`}>
{perfil.inscripciones_abiertas ? '🔒 Cierra inscripciones' : '🚀 Generar Fixture Completo'}
</button>
</div>
</section>
</div>
</div>


</div>


{/* VISTA DEL TORNEO COMPLETO (ZONAS + BRACKETS EN COLUMNAS) */}
{fixtureTemporal && torneoModo === 'zonas' && (
<section className="bg-slate-900 border border-slate-800 rounded-[3rem] p-8 space-y-6 overflow-hidden animate-in fade-in duration-700">
<div className="text-center mb-8">
<h2 className="text-xl font-black uppercase italic text-white tracking-tighter">
Estructura Completa del Torneo <span className="text-blue-500">Vigente</span>
</h2>
</div>
<div className="flex flex-col lg:flex-row gap-8 items-start justify-start overflow-x-auto pb-6">

{/* COLUMNA 1: ZONAS (Fase Clasificatoria) */}
<div className="flex-1 min-w-[300px] space-y-4">
<h3 className="text-[10px] font-black uppercase text-emerald-500 text-center mb-4 bg-emerald-500/10 py-2 rounded-full italic tracking-widest">1. Fase de Grupos</h3>
<div className="grid grid-cols-1 gap-4">
{Array.from({ length: cantidadZonas }).map((_, i) => {
const letraZona = String.fromCharCode(65 + i);
const equiposZona = clubes.filter(c => c.zona === `Zona ${letraZona}`);
return (
<div key={i} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 group hover:border-emerald-500/40 transition-all">
<h4 className="text-amber-500 font-black uppercase text-[9px] mb-3 italic text-center">Grupo {letraZona}</h4>
<div className="space-y-1">
{equiposZona.map(c => (
<div key={c.id} className="text-[10px] font-bold uppercase flex justify-between items-center bg-slate-900/50 p-2 rounded-lg">
<span>{c.nombre}</span>
{c.es_cabeza_serie && <span className="text-amber-500 text-[8px]">⭐</span>}
</div>
))}
</div>
</div>
);
})}
</div>
</div>

{/* Colócalo entre el local y el visitante o en la barra de acciones del partido */}
{/* CONECTOR VISUAL */}
<div className="hidden lg:flex items-center self-center text-slate-700">
<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
</div>

{/* COLUMNA 2: SEMIFINALES (Si aplica) */}
{cantidadZonas === 4 && (
<div className="flex-1 min-w-[250px] space-y-8 self-center">
<h3 className="text-[10px] font-black uppercase text-amber-500 text-center mb-4 bg-amber-500/10 py-2 rounded-full italic tracking-widest">2. Semifinales</h3>
<div className="bg-slate-950 border-l-4 border-amber-500 p-4 rounded-xl shadow-lg space-y-2">
<div className="flex justify-between bg-slate-900 p-2 rounded text-[10px] font-bold text-slate-400 italic"><span>{obtenerGanador("ZONA A")}</span><span>--</span></div>
<div className="flex justify-between bg-slate-900 p-2 rounded text-[10px] font-bold text-slate-400 italic"><span>{obtenerGanador("ZONA B")}</span><span>--</span></div>
</div>
<div className="bg-slate-950 border-l-4 border-amber-500 p-4 rounded-xl shadow-lg space-y-2 mt-4">
<div className="flex justify-between bg-slate-900 p-2 rounded text-[10px] font-bold text-slate-400 italic"><span>{obtenerGanador("ZONA C")}</span><span>--</span></div>
<div className="flex justify-between bg-slate-900 p-2 rounded text-[10px] font-bold text-slate-400 italic"><span>{obtenerGanador("ZONA D")}</span><span>--</span></div>
</div>
</div>
)}

{/* COLUMNA 3: GRAN FINAL */}
<div className="flex-1 min-w-[280px] self-center">
<h3 className="text-[10px] font-black uppercase text-blue-500 text-center mb-4 bg-blue-500/10 py-2 rounded-full italic tracking-widest">3. Gran Final</h3>
<div className="bg-gradient-to-br from-blue-600 to-indigo-900 p-1 rounded-[2.5rem] shadow-2xl">
<div className="bg-slate-950 p-6 rounded-[2.4rem] text-center">
<span className="text-[10px] font-black text-emerald-500 italic uppercase tracking-[0.2em]">The Grand Final</span>
<div className="mt-4 space-y-3">
<div className="bg-blue-600/10 border border-blue-500/20 p-3 rounded-xl text-[10px] font-black uppercase italic text-slate-400">
{cantidadZonas === 2 ? obtenerGanador("ZONA A") : "GANADOR SEMI 1"}
</div>
<div className="text-white font-black italic text-xs animate-pulse">VS</div>
<div className="bg-blue-600/10 border border-blue-500/20 p-3 rounded-xl text-[10px] font-black uppercase italic text-slate-400">
{cantidadZonas === 2 ? obtenerGanador("ZONA B") : "GANADOR SEMI 2"}
</div>
</div>
</div>
</div>
</div>
</div>
</section>
)}
<RegistroEquipo onEquipoCreado={fetchData} inscripcionesAbiertas={perfil.inscripciones_abiertas} />
<section className="bg-slate-900/50 p-6 rounded-[2.5rem] border border-slate-800/50 shadow-inner">
<div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
<h2 className="text-lg font-black uppercase italic tracking-tighter">Clubes Registrados ({clubes.length})</h2>
<input type="text" placeholder="Buscar club..." value={filtroClub} onChange={(e) => setFiltroClub(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-2xl px-6 py-3 text-xs w-full md:w-72 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-lg shadow-blue-900/10" />
</div>
<div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
{clubesFiltrados.map(club => (
<div key={club.id} className="flex flex-col items-center group relative">
{/* BOTÓN ELIMINAR EQUIPO */}
<button
onClick={() => eliminarEquipo(club.id, club.nombre)}
className="absolute -top-2 -right-1 z-10 bg-rose-600 text-white w-5 h-5 rounded-full text-[10px] font-black opacity-0 group-hover:opacity-100 transition-opacity shadow-lg flex items-center justify-center hover:bg-rose-500"
title="Eliminar Equipo"
>
✕
</button>

<div className="w-14 h-14 bg-slate-950 rounded-2xl flex items-center justify-center p-3 border border-slate-800 group-hover:border-amber-500/50 group-hover:scale-110 transition-all duration-300">
<img src={club.escudo_url || 'https://via.placeholder.com/50'} alt="logo" className="max-h-full object-contain grayscale group-hover:grayscale-0 transition-all" />
</div>
<span className="text-[7px] font-black uppercase mt-3 text-slate-500 group-hover:text-white truncate w-full text-center tracking-tighter">{club.nombre}</span>
</div>
))}
</div>
</section>
{fixtureTemporal && (
<AdminFixture
fechasGeneradas={fixtureTemporal}
categoriasDisponibles={categorias}
clubes={clubes}
onEditar={editarEquipoPartido}
onIntercambiar={intercambiarLocalia}
readOnly={false}
/>
)}

<section className="space-y-4">
<div className="flex items-center gap-3"><div className="h-px flex-1 bg-slate-800"></div><h2 className="text-lg font-black uppercase italic tracking-tighter px-4 text-slate-400">Reglas por Categoría</h2><div className="h-px flex-1 bg-slate-800"></div></div>
<div className="grid gap-3">
{categorias.map((cat) => (
<div key={cat.id} className="bg-slate-900 border border-slate-800 p-4 rounded-3xl flex flex-col xl:flex-row items-center justify-between gap-4 hover:border-slate-700 transition-all group">
<div className="w-full xl:w-44"><h3 className="text-xl font-black uppercase italic tracking-tighter group-hover:text-amber-500 transition-colors">{cat.nombre}</h3><p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Configuración Técnica</p></div>
<div className="flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800">
<span className="text-[8px] font-black text-slate-600 uppercase italic">Años comprendidos</span>
<input type="number" value={cat.año_desde || ''} onChange={(e) => handleUpdate(cat.id, 'año_desde', e.target.value)} onBlur={() => guardarCambioDB(cat.id, { año_desde: cat.año_desde })} className="w-12 bg-transparent text-center text-xs font-black outline-none text-blue-400" />
<span className="text-slate-700">~</span>
<input type="number" value={cat.año_hasta || ''} onChange={(e) => handleUpdate(cat.id, 'año_hasta', e.target.value)} onBlur={() => guardarCambioDB(cat.id, { año_hasta: cat.año_hasta })} className="w-12 bg-transparent text-center text-xs font-black outline-none text-blue-400" />
</div>
<div className="bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800 flex items-center gap-3">
<span className="text-[8px] font-black text-slate-600 uppercase">Inicio</span>
<input type="time" value={cat.horario || '00:00'} onChange={(e) => handleUpdate(cat.id, 'horario', e.target.value)} onBlur={() => guardarCambioDB(cat.id, { horario: cat.horario })} className="bg-transparent text-xs font-black text-amber-500 outline-none" />
</div>
<div className="flex gap-2 w-full xl:w-auto">
<button onClick={() => { const v = !cat.participa_torneo; handleUpdate(cat.id, 'participa_torneo', v); guardarCambioDB(cat.id, { participa_torneo: v }); }} className={`flex-1 xl:w-40 py-3 rounded-2xl text-[9px] font-black uppercase transition-all duration-300 border ${cat.participa_torneo ? 'bg-emerald-600/10 border-emerald-500 text-emerald-500' : 'bg-rose-950/20 border-rose-900 text-rose-700'}`}>{cat.participa_torneo ? '🔥 Competitiva / Participa del Torneo' : '❄️ Formativa / Juega Amistosos'}</button>
<button onClick={() => { const v = !cat.suma_general; handleUpdate(cat.id, 'suma_general', v); guardarCambioDB(cat.id, { suma_general: v }); }} className={`flex-1 xl:w-40 py-3 rounded-2xl text-[9px] font-black uppercase transition-all border ${cat.suma_general ? 'bg-blue-600/10 border-blue-500 text-blue-500' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>{cat.suma_general ? '+ Suma General' : '- Promocional'}</button>
</div>
</div>
))}
</div>
</section>

<section className="bg-slate-900 rounded-[2.5rem] p-8 border border-slate-800 shadow-2xl space-y-6">
<div className="flex justify-between items-center border-b border-slate-800 pb-4">
<div>
<h2 className="text-xl font-black uppercase italic text-emerald-500 tracking-tighter">Buzón de Mensajes</h2>
<p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Consultas recibidas</p>
</div>
<span className="bg-emerald-500/10 text-emerald-500 px-4 py-1 rounded-full text-[10px] font-black uppercase">{mensajes.length} Recibidos</span>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
{mensajes.length > 0 ? (
mensajes.map((m) => (
<div key={m.id} className="bg-slate-950 border border-slate-800 p-5 rounded-3xl relative group hover:border-emerald-500/30 transition-all">
<button onClick={() => borrarMensaje(m.id)} className="absolute top-4 right-4 text-slate-700 hover:text-rose-500 text-xs font-black transition-colors uppercase">Borrar</button>
<div className="mb-2">
<span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded uppercase font-black">{m.asunto || 'General'}</span>
<h3 className="text-xs font-black uppercase mt-1">{m.nombre}</h3>
</div>
<p className="text-[11px] text-slate-400 italic mt-3 bg-slate-900/50 p-3 rounded-xl border border-slate-800/40">"{m.mensaje}"</p>
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
<div className="bg-slate-900 border border-amber-500/50 p-8 rounded-[2.5rem] max-w-md w-full shadow-2xl">
<h2 className="text-xl font-black uppercase italic text-amber-500 mb-2">Finalizar Sorteo</h2>
<p className="text-slate-400 text-[10px] mb-6 font-bold uppercase tracking-widest">
Selecciona cómo se definirán los clasificados
</p>
<div className="space-y-3">
{[
{ id: 'eliminacion_directa', label: 'Final Directa', desc: 'Solo cruce por el campeonato (1° A vs 1° B)' },
{ id: 'finales_por_puesto', label: 'Finales por Puesto', desc: '1ros por el Título y 2dos por el 3° Puesto' }, // OPCIÓN NUEVA
{ id: 'semis_y_final', label: 'Semifinales y Final', desc: 'Cruces entre 1° y 2° de cada zona' },
{ id: 'ida_vuelta', label: 'Ida y Vuelta', desc: 'Cruces eliminatorios de doble partido' }
].map((opt) => (
<button
key={opt.id}
onClick={() => ejecutarSorteoFinal(opt.id)}
className="w-full text-left p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-amber-500 transition-all group"
>
<div className={`text-[10px] font-black uppercase group-hover:text-amber-500 ${opt.id === 'finales_por_puesto' ? 'text-purple-400' : 'text-white'}`}>
{opt.label}
</div>
<div className="text-[8px] text-slate-500 font-bold uppercase mt-1">{opt.desc}</div>
</button>
))}
</div>

<button onClick={() => setShowModalPlayoff(false)} className="w-full mt-6 py-3 text-[10px] font-black uppercase text-slate-500 hover:text-rose-500 transition-colors">
Cancelar y volver
</button>
</div>
</div>
)}
{/* --- HASTA AQUÍ --- */}
</div>
);
};
export default AdminConfig;