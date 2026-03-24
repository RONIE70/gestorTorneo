import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';

const FixturePublico = () => {
  const navigate = useNavigate();
  const [partidos, setPartidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zonaSeleccionada, setZonaSeleccionada] = useState('TODAS');
  const [zonasDisponibles, setZonasDisponibles] = useState([]);
  const [busquedaEquipo, setBusquedaEquipo] = useState('');

  const identidad = {
    fondo: '#0f172a',
    acento: '#ec4899', // Pink
    texto: '#ffffff',
    subtitulo: '#3b82f6' // Blue
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
      const cruceId = `${p.local_id}-${p.visitante_id}-${p.nombre_manual_loc}-${p.nro_fecha}`;
      const existe = acc[fecha].find(x => `${x.local_id}-${x.visitante_id}-${x.nombre_manual_loc}-${x.nro_fecha}` === cruceId);
      if (!existe) acc[fecha].push(p);
      return acc;
    }, {});
  };

  // --- FUNCIÓN PARA CARGAR IMÁGENES PARA EL PDF ---
  const cargarImagen = (url) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = url;
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
    });
  };

  // --- DESCARGA DE PDF CON DISEÑO DE CARDS ---
  const descargarPDF = async (zonaLabel) => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const datosAgrupados = obtenerAgrupados(zonaLabel);
      
      // HEADER DEL PDF usando identidad.fondo e identidad.texto
      doc.setFillColor(identidad.fondo);
      doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setTextColor(identidad.texto);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("LIGA DE LAS NENAS", pageWidth / 2, 18, { align: 'center' });
      
      // SUBTÍTULO usando identidad.acento
      doc.setFontSize(10);
      doc.setTextColor(identidad.acento); 
      doc.text(`FIXTURE OFICIAL - ${zonaLabel.toUpperCase()}`, pageWidth / 2, 26, { align: 'center' });
      
      doc.setTextColor(identidad.texto);
      doc.setFontSize(8);
      doc.text(`Temporada 2026 | Generado: ${new Date().toLocaleDateString()}`, pageWidth / 2, 32, { align: 'center' });

      let yPos = 50;
      const cardWidth = 90;
      const cardHeight = 45;
      const margin = 10;

      for (const numFecha of Object.keys(datosAgrupados)) {
        if (yPos > 230) { doc.addPage(); yPos = 20; }
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.text(`JORNADA ${numFecha}`, margin, yPos);
        yPos += 8;

        const cruces = datosAgrupados[numFecha];
        for (let i = 0; i < cruces.length; i++) {
          const p = cruces[i];
          const xPos = i % 2 === 0 ? margin : margin + cardWidth + 5;
          
          doc.setDrawColor(220, 220, 220);
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(xPos, yPos, cardWidth, cardHeight, 4, 4, 'FD');

          // Fecha usando identidad.subtitulo (Blue)
          doc.setFontSize(7);
          doc.setTextColor(identidad.subtitulo); 
          doc.text(`${p.fecha_calendario || 'S/D'} • ${p.zona}`, xPos + cardWidth / 2, yPos + 6, { align: 'center' });

          const imgLoc = await cargarImagen(p.local?.escudo_url);
          const imgVis = await cargarImagen(p.visitante?.escudo_url);
          if (imgLoc) doc.addImage(imgLoc, 'PNG', xPos + 10, yPos + 10, 15, 15);
          if (imgVis) doc.addImage(imgVis, 'PNG', xPos + cardWidth - 25, yPos + 10, 15, 15);

          doc.setFontSize(8);
          doc.setTextColor(0, 0, 0);
          doc.text((p.local?.nombre || p.nombre_manual_loc || 'A DEF.').toUpperCase(), xPos + 17.5, yPos + 32, { align: 'center', maxWidth: 30 });
          doc.text((p.visitante?.nombre || p.nombre_manual_vis || 'A DEF.').toUpperCase(), xPos + cardWidth - 17.5, yPos + 32, { align: 'center', maxWidth: 30 });

          // VS usando identidad.acento (Pink)
          doc.setTextColor(identidad.acento);
          doc.setFontSize(12);
          doc.text("VS", xPos + cardWidth / 2, yPos + 22, { align: 'center' });

          if (i % 2 !== 0 || i === cruces.length - 1) { if (i % 2 !== 0) yPos += cardHeight + 5; }
          if (yPos > 240) { doc.addPage(); yPos = 20; }
        }
        yPos += 15;
      }
      doc.save(`Fixture_LdlN_2026_${zonaLabel.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error("Error PDF:", err);
    }
  };

  const agrupados = obtenerAgrupados(zonaSeleccionada);

  if (loading) return <div className="p-20 text-center text-pink-500 font-black animate-pulse uppercase tracking-widest">Sincronizando Calendario...</div>;

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-10 min-h-screen bg-slate-950 text-white font-sans">
      
      {/* HEADER AJUSTADO */}
      <div className="text-center space-y-3">
        <h1 className="text-5xl font-black uppercase italic tracking-tighter text-white">Fixture 2026</h1>
        <div className="h-1 w-24 bg-pink-500 mx-auto rounded-full"></div>
        <p className="text-blue-400 font-bold text-xs uppercase tracking-[0.4em]">Calendario Oficial Liga de las Nenas</p>
      </div>

      {/* BOTONES DE DESCARGA ESTRATÉGICOS */}
      <div className="flex flex-wrap justify-center gap-3">
        <button onClick={() => navigate('/ListaJugadoras')} className="bg-slate-900 border border-white/10 px-6 py-3 rounded-2xl font-black uppercase text-[10px] hover:bg-slate-800 transition-all flex items-center gap-2">
          👤 Galería
        </button>
        <button onClick={() => descargarPDF('TODAS')} className="bg-blue-600 px-6 py-3 rounded-2xl font-black uppercase text-[10px] shadow-lg hover:scale-105 transition-all">
          📥 Fixture Completo
        </button>
        <button onClick={() => descargarPDF('Zona A')} className="bg-indigo-600 px-6 py-3 rounded-2xl font-black uppercase text-[10px] shadow-lg hover:scale-105 transition-all">
          📥 Zona A
        </button>
        <button onClick={() => descargarPDF('Zona B')} className="bg-rose-600 px-6 py-3 rounded-2xl font-black uppercase text-[10px] shadow-lg hover:scale-105 transition-all">
          📥 Zona B
        </button>
      </div>

      {/* FILTROS Y BUSCADOR COMPACTOS */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-slate-900/50 p-4 rounded-[2rem] border border-white/5 shadow-2xl">
        <div className="flex flex-wrap justify-center gap-2">
          <button onClick={() => setZonaSeleccionada('TODAS')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${zonaSeleccionada === 'TODAS' ? 'bg-pink-600 text-white shadow-lg' : 'bg-slate-950 text-slate-500'}`}>Todas</button>
          {zonasDisponibles.map(z => (
            <button key={z} onClick={() => setZonaSeleccionada(z)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${zonaSeleccionada === z ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-950 text-slate-500'}`}>{z}</button>
          ))}
        </div>
        <div className="relative w-full lg:w-80">
          <input type="text" placeholder="BUSCAR CLUB..." value={busquedaEquipo} onChange={(e) => setBusquedaEquipo(e.target.value)} className="w-full bg-slate-950 border border-white/10 rounded-xl px-5 py-3 text-xs font-black outline-none focus:border-pink-500 transition-all uppercase placeholder:text-slate-700" />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20">🔍</span>
        </div>
      </div>

      {/* RENDERIZADO EN 3 COLUMNAS (LG) */}
      <div className="space-y-16">
        {Object.keys(agrupados).map((nroFecha) => (
          <div key={nroFecha} className="space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-700">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Fecha {nroFecha}</h2>
              <div className="h-px flex-1 bg-gradient-to-r from-pink-500/50 via-slate-800 to-transparent"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agrupados[nroFecha].map((p) => (
                <div key={p.id} className="bg-slate-900 border border-white/5 p-4 rounded-[2rem] relative group hover:border-pink-500/30 transition-all shadow-xl overflow-hidden">
                  
                  {/* TAG ZONA */}
                  <div className="absolute top-0 right-8 bg-slate-800 border-x border-b border-white/10 text-white text-[7px] font-black px-3 py-1 rounded-b-lg uppercase tracking-widest group-hover:bg-pink-600 transition-colors">
                    {p.zona}
                  </div>

                  {/* FECHA CALENDARIO */}
                  <div className="text-center mb-4 pt-2">
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                      {p.fecha_calendario || 'SÁBADO A CONFIRMAR'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 px-1">
                    {/* CLUB LOCAL */}
                    <div className="flex flex-col items-center flex-1 gap-2">
                      <div className="w-20 h-20 bg-black/40 rounded-3xl p-3 flex items-center justify-center border border-white/5 transition-transform group-hover:scale-110 duration-500 shadow-inner">
                        <img src={p.local?.escudo_url || 'https://via.placeholder.com/80'} alt="L" className="max-h-full object-contain" />
                      </div>
                      <span className="text-[11px] font-black uppercase text-center leading-[1.1] h-9 flex items-center">
                        {p.local?.nombre || p.nombre_manual_loc}
                      </span>
                    </div>

                    {/* SEPARADOR VS */}
                    <div className="flex flex-col items-center min-w-[40px]">
                      <span className="text-2xl font-black italic text-slate-800 group-hover:text-pink-500 transition-colors">VS</span>
                    </div>

                    {/* CLUB VISITANTE */}
                    <div className="flex flex-col items-center flex-1 gap-2">
                      <div className="w-20 h-20 bg-black/40 rounded-3xl p-3 flex items-center justify-center border border-white/5 transition-transform group-hover:scale-110 duration-500 shadow-inner">
                        <img src={p.visitante?.escudo_url || 'https://via.placeholder.com/80'} alt="V" className="max-h-full object-contain" />
                      </div>
                      <span className="text-[11px] font-black uppercase text-center leading-[1.1] h-9 flex items-center">
                        {p.visitante?.nombre || p.nombre_manual_vis}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FixturePublico;