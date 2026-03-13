//version funcional 13/3/2026
import React, { useRef, useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../supabaseClient';

const CarnetJugadora = ({ jugadora, config, mostrarDorso = false }) => {

  const carnetRef = useRef(null);
  const dorsoRef = useRef(null);
  const [nombreCategoria, setNombreCategoria] = useState("");

  const EstilosPactados = {
    magenta: '#de1777',
    negro: '#000000',
    texto: '#ffffff'
  };

  useEffect(() => {

    const calcularCategoriaSaaS = async () => {

      if (!jugadora?.fecha_nacimiento || !jugadora?.organizacion_id) {
        setNombreCategoria(jugadora?.categoria_actual || "S/D");
        return;
      }

      try {

        const { data: categorias } = await supabase
          .from('categorias')
          .select('nombre, año_desde, año_hasta')
          .eq('organizacion_id', jugadora.organizacion_id);

        if (categorias) {

          const añoNac = new Date(jugadora.fecha_nacimiento).getFullYear();

          const catMatch = categorias.find(c =>
            añoNac >= c.año_desde && añoNac <= (c.año_hasta || añoNac)
          );

          setNombreCategoria(catMatch ? catMatch.nombre : (jugadora.categoria_actual || "S/D"));
        }

      } catch {
        setNombreCategoria(jugadora.categoria_actual || "S/D");
      }

    };

    calcularCategoriaSaaS();

  }, [jugadora]);

  if (!jugadora) return null;

  const urlBase = "https://gestor-torneo.vercel.app";
  const urlValidacion = `${urlBase}/#/verificar/${jugadora.dni}`;

  const esperarImagenes = async (elemento) => {

    await document.fonts.ready;

    const imgs = elemento.querySelectorAll("img");

    await Promise.all(
      Array.from(imgs)
        .filter(img => !img.complete)
        .map(img =>
          new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
          })
        )
    );

  };

  const handleDescargarPDF = async () => {

    const pdf = new jsPDF('l', 'mm', [85.6, 54]);

    const opcionesCanvas = {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      imageTimeout: 0,
      logging: false
    };

    await esperarImagenes(carnetRef.current);

    const canvasFrente = await html2canvas(carnetRef.current, opcionesCanvas);

    pdf.addImage(canvasFrente.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 54);

    pdf.addPage([85.6, 54], 'l');

    await esperarImagenes(dorsoRef.current);

    const canvasDorso = await html2canvas(dorsoRef.current, opcionesCanvas);

    pdf.addImage(canvasDorso.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 54);

    pdf.save(`Carnet_${jugadora.apellido}.pdf`);

  };

  const cardContainerStyle = {
    width: '323px',
    height: '204px',
    background: `linear-gradient(145deg, ${EstilosPactados.magenta} 0%, ${EstilosPactados.negro} 75%)`,
    color: EstilosPactados.texto,
    position: 'relative',
    overflow: 'hidden'
  };

  return (

    <div className="flex flex-col items-center mt-6 space-y-6">

      <div className="flex flex-col gap-6 scale-110">

        {/* FRENTE */}

        {!mostrarDorso && (

          <div
            ref={carnetRef}
            style={cardContainerStyle}
            className="rounded-xl p-3 shadow-2xl border border-white/10 flex flex-col justify-between"
          >

            <span className="absolute -right-2 -bottom-2 text-[55px] font-black italic opacity-10 uppercase">
              {config?.nombre_liga?.split(' ')[0] || 'LIGA'}
            </span>

            <div className="z-10 flex justify-between items-start">

              <div>

                <h2 className="text-2xl font-black italic uppercase">
                  {config?.nombre_liga || 'LIGA DE LAS NENAS'}
                </h2>

                <p className="text-[6px] font-bold uppercase tracking-[0.3em] opacity-80">
                  TEMPORADA OFICIAL 2026
                </p>

              </div>

              {(jugadora.club_escudo || jugadora.equipos?.escudo_url) && (

                <img
                  src={jugadora.club_escudo || jugadora.equipos?.escudo_url}
                  crossOrigin="anonymous"
                  className="h-10 w-12 object-contain"
                  alt="club"
                />

              )}

            </div>

            <div className="flex gap-3 z-10 flex-1 mt-2">

              <div
                className="w-[95px] h-[115px] bg-black/40 border-2 border-white/30 rounded-lg"
                style={{
                  backgroundImage: `url(${jugadora.foto_url || 'https://placehold.co/150x200/000/FFF?text=FOTO'})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              />

              <div className="flex-1 flex flex-col justify-between py-0.5">

                <div className="space-y-1">

                  <h3 className="text-[15px] font-black uppercase">
                    {jugadora.apellido} {jugadora.nombre}
                  </h3>

                  <div className="flex gap-3">

                    <div>
                      <p className="text-[6px] font-black opacity-60 uppercase">DNI</p>
                      <p className="text-[11px] font-bold">{jugadora.dni}</p>
                    </div>

                    <div>
                      <p className="text-[6px] font-black opacity-60 uppercase">CATEGORÍA</p>
                      <p className="text-[11px] font-bold uppercase">{nombreCategoria}</p>
                    </div>

                  </div>

                  <div>
                    <p className="text-[6px] font-black opacity-60 uppercase">CLUB</p>
                    <p className="text-[11px] font-bold uppercase">
                      {jugadora.equipos?.nombre || jugadora.club_nombre || 'SIN EQUIPO'}
                    </p>
                  </div>

                </div>

                <div className={`mt-1 inline-flex px-2 py-1 rounded-md border ${
                  jugadora.verificacion_manual || Number(jugadora.distancia_biometrica_oficial) > 0.6
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                }`}>

                  <p className="text-[7px] font-black uppercase tracking-widest">
                    {jugadora.verificacion_manual || Number(jugadora.distancia_biometrica_oficial) > 0.6
                      ? 'VERIFICACIÓN PENDIENTE'
                      : 'BIOMETRÍA OK'}
                  </p>

                </div>

              </div>

            </div>

          </div>

        )}

        {/* DORSO */}

        {mostrarDorso && (

          <div
            ref={dorsoRef}
            style={cardContainerStyle}
            className="rounded-xl p-4 shadow-2xl border border-white/10 flex items-center justify-between"
          >

            <div className="w-1/2 flex flex-col items-center">

              <div className="w-36 h-32 rounded-full bg-white/10 flex items-center justify-center p-4">

                {config?.logo_url && (

                  <img
                    src={config.logo_url}
                    crossOrigin="anonymous"
                    className="w-full h-full object-contain"
                    alt="logo"
                    
                  />

                )}

              </div>

              <p className="text-[6px] font-black uppercase mt-4 opacity-40 text-center">
                DOCUMENTO OFICIAL
              </p>

            </div>

            <div className="w-1/2 flex flex-col items-center">

              <div className="bg-white p-2 rounded-lg">

                <QRCodeSVG value={urlValidacion} size={85} level="H" />

              </div>

              <p className="text-[6px] font-black mt-2 opacity-60 uppercase">
                VERIFICACIÓN DIGITAL
              </p>

            </div>

          </div>

        )}

      </div>

      {!mostrarDorso && (

        <button
          onClick={handleDescargarPDF}
          className="text-white text-[11px] font-black py-4 px-12 rounded-2xl shadow-2xl uppercase"
          style={{ backgroundColor: EstilosPactados.magenta }}
        >
          📥 Descargar Carnet PDF
        </button>

      )}

    </div>

  );

};

export default CarnetJugadora;
//////////////////////////////////////////////
//import React, { useState, useEffect, useRef } from 'react';
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
  // eslint-disable-next-line no-unused-vars
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ ligas: 0, jugadoras: 0, alertas: 0 });
  const [rankingLigas, setRankingLigas] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [kitBienvenida, setKitBienvenida] = useState(null);

  // --- ESTADOS PARA IMPRESIÓN ---
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

  // --- CORRECCIÓN: ESTE EFECTO CARGA LOS DATOS CUANDO EL PERFIL YA EXISTE ---
  useEffect(() => {
    if (perfil) {
      // Si el superadmin no tiene organizacion_id (es nulo), traemos todas las jugadoras
      // o las de la primera liga para que el lienzo no esté vacío.
      const orgId = perfil.organizacion_id;
      cargarDatosLienzo(orgId);
    }
  }, [perfil]);

  const cargarDatosLienzo = async (orgId) => {
    try {
      console.log("Iniciando carga de datos para el pliego...");
      
      // 1. Cargar jugadoras (Si eres SuperAdmin y orgId es null, traemos todas para que veas algo)
      let queryJugs = supabase.from('jugadoras').select('*');
      if (orgId) queryJugs = queryJugs.eq('organizacion_id', orgId);
      
      const { data: jugs } = await queryJugs;
      console.log("Jugadoras encontradas:", jugs?.length || 0);
      setJugadorasLiga(jugs || []);
      
      // 2. Cargar equipos para el clubesMap
      let queryEqs = supabase.from('equipos').select('id, nombre, logo_url');
      if (orgId) queryEqs = queryEqs.eq('organizacion_id', orgId);
      
      const { data: eqs } = await queryEqs;
      const mapping = {};
      eqs?.forEach(e => mapping[e.id] = { nombre: e.nombre, logo: e.logo_url });
      setClubesMap(mapping);

      // 3. Config de liga
      if (orgId) {
        const { data: conf } = await supabase.from('configuracion_liga').select('*').eq('organizacion_id', orgId).maybeSingle();
        setConfigLiga(conf);
      }
    } catch (err) {
      console.error("Error cargando datos de liga:", err);
    }
  };

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

  // --- FUNCIÓN DE DESCARGA CON ESPERA PARA QR ---
  const descargarLona1Metro = async (ref, nombreArchivo) => {

  if (!ref.current) return;

  setGenerandoLona(true);

  try {

    // esperar carga de fuentes
    await document.fonts.ready;

    // esperar imágenes
    const images = Array.from(ref.current.querySelectorAll("img"));

    await Promise.all(
          images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
              img.onload = resolve;
              img.onerror = resolve;
            });
          })
        );

    // 1. ESPERA DE SEGURIDAD: Damos 2 segundos para que los escudos 
      // y los QR se dibujen en el lienzo oculto antes de "sacar la foto".
      await new Promise(resolve => setTimeout(resolve, 2500));    

    const canvas = await html2canvas(ref.current, {
      scale: 1.7,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      imageTimeout: 0,
      logging: false,
      windowWidth: ref.current.scrollWidth,
      windowHeight: ref.current.scrollHeight
    });

    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF({
      orientation: "l",
      unit: "mm",
      format: [1000, 500],
      compress: true
    });

    pdf.addImage(imgData, "PNG", 0, 0, 1000, 500);

    pdf.save(`${nombreArchivo}.pdf`);

  } catch (error) {

    console.error("Error generando PDF:", error);

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
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] mt-2 italic">
              Gestionando: {configLiga?.nombre_liga || 'Liga NCS'}
            </p>
          </div>
          
          {/* BOTÓN IMPRIMIR LONA */}
          <button 
            disabled={generandoLona || jugadorasLiga.length === 0}
            onClick={() => descargarLona1Metro(lienzoJugadorasRef, 'LONA_JUGADORAS')}
            className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-2xl text-[10px] font-black flex items-center gap-2 shadow-lg transition-all disabled:opacity-30"
          >
            <PrinterIcon className="w-5 h-5" />
            {generandoLona ? 'PROCESANDO...' : 'IMPRIMIR PLIEGO 1MT'}
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
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Lienzo Técnico 1000mm x 1000mm</p>
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
            </form>
          </div>
        </div>

        {/* --- LIENZO OCULTO TÉCNICO --- */}
        <div style={{ position: 'absolute', left: '-9999px', top: '0', pointerEvents: 'none', background: 'white' }}>
          <div 
            ref={lienzoJugadorasRef} 
            style={{ 
              width: '1000mm', 
              height: '500mm', 
              background: 'white', 
              padding: '10mm',
              display: 'grid',
              // Definimos 5 pares (frente+dorso) por fila
              gridTemplateColumns: 'repeat(5, 185mm)', 
              gridAutoRows: '54mm',
              gap: '5mm'
            }}
          >
            {jugadorasLiga.map(jug => (
              <div key={`lona-${jug.id}`} style={{ display: 'flex'}}>
                
                {/* LADO FRENTE */}
                <div style={{ width: '85.6mm', height: '54mm' }}>
                  <CarnetJugadora 
                    jugadora={{
                      ...jug, 
                      equipos: { 
                        nombre: clubesMap[jug.equipo_id]?.nombre, 
                        logo_url: clubesMap[jug.equipo_id]?.logo 
                      } 
                    }} 
                    config={configLiga}
                    mostrarDorso={false} 
                  />
                </div>

                {/* LADO DORSO (QR) */}
                <div style={{ width: '85.6mm', height: '54mm', marginLeft: '10mm' }}>
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

//export default SuperAdminDashboard;