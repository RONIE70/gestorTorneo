import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const FixturePublico = () => {
  const navigate = useNavigate();
  const [partidos, setPartidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zonaSeleccionada, setZonaSeleccionada] = useState('TODAS');
  const [zonasDisponibles, setZonasDisponibles] = useState([]);
  const [busquedaEquipo, setBusquedaEquipo] = useState('');

  // Configuración de Identidad (basada en tu snippet)
  const identidad = {
    fondo: '#0f172a', // Slate 900
    acento: '#ec4899', // Pink 500
    texto: '#ffffff',
    subtitulo: '#3b82f6' // Blue 500
  };

  useEffect(() => {
    fetchFixture();
  }, []);

  const fetchFixture = async () => {
    try {
      const { data, error } = await supabase
        .from('partidos')
        .select(`
          *,
          local:equipos!local_id(nombre, escudo_url),
          visitante:equipos!visitante_id(nombre, escudo_url)
        `)
        .eq('finalizado', false)
        .order('nro_fecha', { ascending: true });

      if (error) throw error;
      const zonas = [...new Set(data.map(p => p.zona).filter(Boolean))].sort();
      setZonasDisponibles(zonas);
      setPartidos(data);
    } catch (error) {
      console.error("Error:", error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- LÓGICA DE AGRUPACIÓN POR CRUCE ÚNICO ---
  const obtenerAgrupados = (zona) => {
    const filtrados = partidos.filter(p => {
      const coincideZona = zona === 'TODAS' || p.zona === zona;
      const nombreLoc = (p.local?.nombre || p.nombre_manual_loc || "").toLowerCase();
      const nombreVis = (p.visitante?.nombre || p.nombre_manual_vis || "").toLowerCase();
      const coincideBusqueda = nombreLoc.includes(busquedaEquipo.toLowerCase()) || 
                               nombreVis.includes(busquedaEquipo.toLowerCase());
      return coincideZona && coincideBusqueda;
    });

    return filtrados.reduce((acc, p) => {
      const fecha = p.nro_fecha;
      if (!acc[fecha]) acc[fecha] = [];
      // Clave única para evitar repetir el mismo cruce de clubes en la misma fecha
      const cruceId = `${p.local_id}-${p.visitante_id}-${p.nombre_manual_loc}`;
      const existe = acc[fecha].find(x => `${x.local_id}-${x.visitante_id}-${x.nombre_manual_loc}` === cruceId);
      if (!existe) acc[fecha].push(p);
      return acc;
    }, {});
  };

  // --- FUNCIÓN DESCARGAR PDF (Estilo Heredado) ---
  const descargarPDF = (zonaLabel) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const datosAgrupados = obtenerAgrupados(zonaLabel);

    // 1. ENCABEZADO
    doc.setFillColor(0, 0, 0); // Fondo Negro
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    doc.setTextColor(identidad.texto);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("LIGA DE LAS NENAS", 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(59, 130, 246); // Azul
    doc.text("CALENDARIO DE PARTIDOS OFICIAL", 105, 28, { align: 'center' });
    
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`${zonaLabel} | Temporada 2026 | Generado: ${new Date().toLocaleDateString()}`, 105, 36, { align: 'center' });

    // 2. CONSTRUCCIÓN DE TABLA
    const body = [];
    Object.keys(datosAgrupados).forEach(numFecha => {
      datosAgrupados[numFecha].forEach(p => {
        body.push([
          `FECHA ${p.nro_fecha}`,
          p.fecha_calendario || 'S/D',
          (p.local?.nombre || p.nombre_manual_loc || 'A DEFINIR').toUpperCase(),
          'VS',
          (p.visitante?.nombre || p.nombre_manual_vis || 'A DEFINIR').toUpperCase(),
          p.zona || '-'
        ]);
      });
    });

    autoTable(doc, {
      startY: 55,
      head: [['FECHA', 'DIA REAL', 'LOCAL', '', 'VISITANTE', 'ZONA']],
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [0, 0, 0], textColor: [236, 72, 153], lineColor: [51, 65, 85], lineWidth: 0.1 },
      styles: { fontSize: 8, cellPadding: 3, halign: 'center' },
      columnStyles: { 2: { halign: 'right', fontStyle: 'bold' }, 4: { halign: 'left', fontStyle: 'bold' } }
    });

    doc.save(`Fixture_${zonaLabel.replace(/\s+/g, '_')}.pdf`);
  };

  const agrupados = obtenerAgrupados(zonaSeleccionada);

  if (loading) return <div className="p-20 text-center text-pink-500 font-black animate-pulse uppercase">Sincronizando Calendario...</div>;

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-8 min-h-screen bg-slate-950 text-white font-sans">
      
      {/* HEADER */}
      <div className="text-center space-y-2 mb-6">
        <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white">Cronograma de Partidos</h1>
        <p className="text-pink-500 font-bold text-[10px] uppercase tracking-[0.3em]">Cruce Oficial entre Clubes</p>
      </div>

      {/* BOTONES DE ACCIÓN Y DESCARGA */}
      <div className="flex flex-wrap justify-center gap-3 mb-4">
        <button onClick={() => navigate('/ListaJugadoras')} className="bg-slate-900 text-white px-5 py-2 rounded-2xl font-black uppercase text-[9px] border border-white/10 hover:bg-slate-800 transition-all">
          👤 Galería Jugadoras
        </button>
        <div className="h-8 w-px bg-white/10 hidden md:block"></div>
        <button onClick={() => descargarPDF('TODAS')} className="bg-blue-600 hover:bg-blue-500 px-5 py-2 rounded-2xl font-black uppercase text-[9px] shadow-lg transition-all">
          📥 Fixture Completo
        </button>
        <button onClick={() => descargarPDF('Zona A')} className="bg-indigo-600 hover:bg-indigo-500 px-5 py-2 rounded-2xl font-black uppercase text-[9px] shadow-lg transition-all">
          📥 PDF Zona A
        </button>
        <button onClick={() => descargarPDF('Zona B')} className="bg-rose-600 hover:bg-rose-500 px-5 py-2 rounded-2xl font-black uppercase text-[9px] shadow-lg transition-all">
          📥 PDF Zona B
        </button>
      </div>

      {/* FILTROS */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-900/40 p-6 rounded-[3rem] border border-white/5 shadow-2xl">
        <div className="flex flex-wrap justify-center gap-2">
          <button onClick={() => setZonaSeleccionada('TODAS')} className={`px-5 py-2 rounded-2xl text-[9px] font-black uppercase transition-all ${zonaSeleccionada === 'TODAS' ? 'bg-pink-600 text-white' : 'bg-slate-950 text-slate-500'}`}>Todas</button>
          {zonasDisponibles.map(z => (
            <button key={z} onClick={() => setZonaSeleccionada(z)} className={`px-5 py-2 rounded-2xl text-[9px] font-black uppercase transition-all ${zonaSeleccionada === z ? 'bg-blue-600 text-white' : 'bg-slate-950 text-slate-500'}`}>{z}</button>
          ))}
        </div>
        <input type="text" placeholder="BUSCAR MI CLUB..." value={busquedaEquipo} onChange={(e) => setBusquedaEquipo(e.target.value)} className="w-full md:w-64 bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-[10px] font-black outline-none focus:border-pink-500 uppercase transition-all" />
      </div>

      {/* RESULTADOS AGRUPADOS */}
      <div className="space-y-12 mt-8">
        {Object.keys(agrupados).length > 0 ? (
          Object.keys(agrupados).map((nroFecha) => (
            <div key={nroFecha} className="space-y-6">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-black text-white uppercase italic">Jornada {nroFecha}</h2>
                <div className="h-px flex-1 bg-gradient-to-r from-pink-500/50 to-transparent"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agrupados[nroFecha].map((p) => (
                  <div key={p.id} className="bg-slate-900/80 border border-white/5 p-6 rounded-[2.5rem] relative overflow-hidden group">
                    <div className="absolute top-0 right-10 bg-pink-600 text-white text-[7px] font-black px-4 py-1 rounded-b-xl uppercase tracking-widest">{p.zona}</div>
                    
                    <div className="text-center mb-4">
                      <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest bg-blue-400/5 px-4 py-1 rounded-full border border-blue-400/10">
                        {p.fecha_calendario || 'Fecha a Confirmar'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col items-center flex-1 gap-2">
                        <div className="w-14 h-14 bg-white/5 rounded-2xl p-2 flex items-center justify-center border border-white/5 transition-transform group-hover:scale-110">
                          <img src={p.local?.escudo_url || 'https://via.placeholder.com/50'} alt="L" className="max-h-full object-contain" />
                        </div>
                        <span className="text-[10px] font-black uppercase text-center leading-tight h-8 flex items-center">
                          {p.local?.nombre || p.nombre_manual_loc}
                        </span>
                      </div>

                      <div className="flex flex-col items-center px-4">
                        <span className="text-xl font-black italic text-slate-800 group-hover:text-pink-500 transition-colors">VS</span>
                      </div>

                      <div className="flex flex-col items-center flex-1 gap-2">
                        <div className="w-14 h-14 bg-white/5 rounded-2xl p-2 flex items-center justify-center border border-white/5 transition-transform group-hover:scale-110">
                          <img src={p.visitante?.escudo_url || 'https://via.placeholder.com/50'} alt="V" className="max-h-full object-contain" />
                        </div>
                        <span className="text-[10px] font-black uppercase text-center leading-tight h-8 flex items-center">
                          {p.visitante?.nombre || p.nombre_manual_vis}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="py-20 text-center text-slate-600 font-black uppercase italic tracking-widest">No se encontraron cruces para esta búsqueda</div>
        )}
      </div>
    </div>
  );
};

export default FixturePublico;