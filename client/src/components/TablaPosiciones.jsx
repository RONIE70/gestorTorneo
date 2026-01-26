import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const TablaPosiciones = () => {
  const [datosEstructurados, setDatosEstructurados] = useState({});
  const [tablaGeneral, setTablaGeneral] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // --- NUEVOS ESTADOS PARA IDENTIDAD SAAS ---
  const [ligaNombre, setLigaNombre] = useState('LIGA OFICIAL');
  const [logoBase64, setLogoBase64] = useState(null);

  // Colores de identidad definidos
  const identidad = {
    fondo: '#000000',
    texto: '#d90082',
    acento: '#000000',
    textoSecundario: '#ffffff'
  };

  useEffect(() => {
    fetchResultados();
    cargarIdentidadSaaS();
  }, []);

  // Función para cargar nombre y logo de la liga para el PDF
  const cargarIdentidadSaaS = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('organizaciones(nombre, logo_url)')
        .eq('id', session.user.id)
        .single();

      if (perfil?.organizaciones) {
        setLigaNombre(perfil.organizaciones.nombre);
        
        // Convertir logo a Base64 para el PDF si existe
        if (perfil.organizaciones.logo_url) {
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          img.src = perfil.organizaciones.logo_url;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            setLogoBase64({
              data: canvas.toDataURL('image/png'),
              format: 'PNG'
            });
          };
        }
      }
    }
  };

  const fetchResultados = async () => {
    try {
      setLoading(true);
      const { data: partidos, error } = await supabase
        .from('partidos')
        .select(`
          resultado_local, resultado_visitante, local_id, visitante_id, zona, categoria,
          local:equipos!local_id(nombre, escudo_url),
          visitante:equipos!visitante_id(nombre, escudo_url)
        `)
        .eq('finalizado', true);

      if (error) throw error;

      const estructura = {}; 
      const gen = {};         

      const procesarFila = (contenedor, id, info, gF, gC) => {
        if (!contenedor[id]) {
          contenedor[id] = { 
            nombre: info.nombre, escudo: info.escudo_url, 
            pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dif: 0, pts: 0 
          };
        }
        const s = contenedor[id];
        s.pj += 1;
        s.gf += (gF || 0);
        s.gc += (gC || 0);
        s.dif = s.gf - s.gc;
        if (gF > gC) { s.pg += 1; s.pts += 3; }
        else if (gF === gC) { s.pe += 1; s.pts += 1; }
        else { s.pp += 1; }
      };

      partidos.forEach(p => {
        const cat = p.categoria || "Única";
        const zona = p.zona || "Zona Única";
        if (!estructura[cat]) estructura[cat] = {};
        if (!estructura[cat][zona]) estructura[cat][zona] = {};

        procesarFila(estructura[cat][zona], p.local_id, p.local, p.resultado_local, p.resultado_visitante);
        procesarFila(estructura[cat][zona], p.visitante_id, p.visitante, p.resultado_visitante, p.resultado_local);
        procesarFila(gen, p.local_id, p.local, p.resultado_local, p.resultado_visitante);
        procesarFila(gen, p.visitante_id, p.visitante, p.resultado_visitante, p.resultado_local);
      });

      const ordenar = (obj) => Object.values(obj).sort((a, b) => b.pts - a.pts || b.dif - a.dif || b.gf - a.gf);

      const finalEstructura = {};
      Object.keys(estructura).forEach(cat => {
        finalEstructura[cat] = {};
        Object.keys(estructura[cat]).forEach(zona => {
          finalEstructura[cat][zona] = ordenar(estructura[cat][zona]);
        });
      });

      setDatosEstructurados(finalEstructura);
      setTablaGeneral(ordenar(gen));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const descargarPDF = (datos, titulo) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // 1. ENCABEZADO
    doc.setFillColor(identidad.fondo);;
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    if (logoBase64?.data) {
      try {
        doc.addImage(logoBase64.data, logoBase64.format, 15, 10, 25, 25);
      // eslint-disable-next-line no-unused-vars
      } catch (e) {
        doc.setFillColor(identidad.fondo); // Fondo Negro
        doc.ellipse(27, 22, 12, 12, 'F');
      }
    } else {
      doc.setFillColor(59, 130, 246);
      doc.ellipse(27, 22, 12, 12, 'F'); 
    }
    
    doc.setTextColor(identidad.texto);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(ligaNombre.toUpperCase(), 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(59, 130, 246); 
    doc.text("TABLA DE POSICIONES OFICIAL", 105, 28, { align: 'center' });
    
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`${titulo} | Generado el: ${new Date().toLocaleDateString()}`, 105, 36, { align: 'center' });

    // 2. TABLA
    const body = datos.map((c, i) => [i + 1, c.nombre.toUpperCase(), c.pj, c.gf, c.gc, c.dif, c.pts]);

    autoTable(doc, {
      startY: 55,
      head: [['POS', 'CLUB / EQUIPO', 'PJ', 'GF', 'GC', 'DIF', 'PTS']],
      body: body,
      theme: 'grid',
       headStyles: { 
        fillColor: identidad.fondo, 
        textColor: identidad.texto,
        lineColor: identidad.acento,
        lineWidth: 0.1
      }, styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: { 6: { fontStyle: 'bold', fillColor: [248, 250, 252] } }
    });

    // 3. PIE Y QR
    const urlQR = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + "/posiciones")}`;
    try {
      doc.addImage(urlQR, 'PNG', 20, 250, 25, 25);
    } catch (err) { console.warn(err); }

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Este documento es una exportación oficial del sistema.", 50, 260);
    doc.save(`Posiciones_${titulo.replace(/\s+/g, '_')}.pdf`);
  };

  // --- SUB-COMPONENTE DE TABLA ---
  const ComponenteTabla = ({ datos, titulo, esGeneral = false }) => (
    <div className="space-y-3 mb-8">
      <div className="flex justify-between items-end px-2">
        <h3 className={`text-[10px] md:text-sm font-black uppercase tracking-[0.2em] ${esGeneral ? 'text-amber-500' : 'text-slate-400'}`}>
          {titulo}
        </h3>
        <button 
            onClick={() => descargarPDF(datos, titulo)} 
            className="text-[8px] font-black px-3 py-1 rounded-full border border-pink-500/30 text-pink-500 hover:bg-pink-500 hover:text-white transition-all uppercase italic"
        >
            Descargar Reporte ↓
        </button>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <table className="w-full text-left table-fixed">
          <thead>
            <tr className="bg-black text-[7px] md:text-[9px] font-black uppercase text-pink-500 border-b border-slate-800">
              <th className="w-[10%] py-4 text-center">Pos</th>
              <th className="w-[35%] px-1">Club</th>
              <th className="w-[9%] text-center">PJ</th>
              <th className="w-[9%] text-center">GF</th>
              <th className="w-[9%] text-center">GC</th>
              <th className="w-[12%] text-center text-white">DIF</th>
              <th className="w-[16%] text-center bg-pink-500/10">PTS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {datos.map((club, index) => {
              const clasifica = !esGeneral && index < 2;
              return (
                <tr key={index} className="hover:bg-slate-800/30 transition-all">
                  <td className={`py-4 font-black italic text-center text-[9px] md:text-xs ${clasifica ? 'text-pink-500' : 'text-slate-600'}`}>
                    {index + 1}º
                  </td>
                  <td className="px-1 py-4">
                    <div className="flex items-center gap-1 md:gap-2">
                      <div className="relative">
                        <img src={club.escudo} alt="" className="w-4 h-4 md:w-6 md:h-6 object-contain z-10 relative" />
                        <div className={`absolute inset-0 rounded-full blur-[6px] opacity-40 ${clasifica ? 'bg-pink-500' : 'bg-blue-500'}`}></div>
                      </div>
                      <span className={`text-[8px] md:text-[10px] font-black uppercase truncate ${clasifica ? 'text-white' : 'text-slate-400'}`}>
                        {club.nombre}
                      </span>
                    </div>
                  </td>
                  <td className="text-center text-[9px] md:text-xs font-bold text-slate-300">{club.pj}</td>
                  <td className="text-center text-[9px] md:text-xs font-bold text-emerald-500/60">{club.gf}</td>
                  <td className="text-center text-[9px] md:text-xs font-bold text-rose-500/60">{club.gc}</td>
                  <td className={`text-center text-[9px] md:text-xs font-black ${club.dif > 0 ? 'text-blue-400' : club.dif < 0 ? 'text-rose-600' : 'text-slate-600'}`}>{club.dif > 0 ? `+${club.dif}` : club.dif}</td>
                  <td className="text-center text-[10px] md:text-sm font-black text-pink-500 bg-pink-500/5">{club.pts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (loading) return (
    <div className="p-10 text-center bg-slate-950 min-h-screen flex items-center justify-center text-white font-black uppercase tracking-[0.3em]">
      Sincronizando Estadísticas...
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-2 md:p-4 bg-slate-950 min-h-screen text-white pb-20 font-sans">
      <header className="text-center space-y-2 mb-10 mt-6">
        <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter">Posiciones <span className="text-pink-500">Oficiales</span></h1>
        <p className="text-slate-500 font-bold text-[8px] md:text-[10px] uppercase tracking-[0.3em]">{ligaNombre}</p>
      </header>

      {Object.keys(datosEstructurados).sort().map(cat => (
        <div key={cat} className="mb-12">
          <div className="border-l-4 border-pink-500 pl-3 mb-6 bg-gradient-to-r from-pink-500/10 to-transparent py-2">
            <h2 className="text-lg md:text-2xl font-black uppercase italic text-white tracking-tight">Categoría {cat}</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
            {Object.keys(datosEstructurados[cat]).sort().map(zona => (
              <ComponenteTabla key={zona} datos={datosEstructurados[cat][zona]} titulo={zona} />
            ))}
          </div>
        </div>
      ))}

      <div className="mt-20 pt-10 border-t border-slate-800 bg-black/40 rounded-[3rem] p-8">
        <div className="text-center mb-8">
            <h2 className="text-xl md:text-3xl font-black uppercase italic text-rose-500">Ranking Institucional</h2>
            <p className="text-[7px] md:text-[9px] text-slate-500 uppercase font-bold tracking-widest mt-1">Sumatoria total por club</p>
        </div>
        <div className="max-w-2xl mx-auto">
            <ComponenteTabla datos={tablaGeneral} titulo="Tabla General Acumulada" esGeneral={true} />
        </div>
      </div>
    </div>
  );
};

export default TablaPosiciones;