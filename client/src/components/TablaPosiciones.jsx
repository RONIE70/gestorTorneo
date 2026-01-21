import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const TablaPosiciones = () => {
  const [datosEstructurados, setDatosEstructurados] = useState({});
  const [tablaGeneral, setTablaGeneral] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResultados();
  }, []);

  const fetchResultados = async () => {
    try {
      setLoading(true);
      const { data: partidos, error } = await supabase
        .from('partidos')
        .select(`
          id, resultado_local, resultado_visitante, local_id, visitante_id, zona, categoria,
          local:equipos!local_id(nombre, escudo_url),
          visitante:equipos!visitante_id(nombre, escudo_url)
        `)
        .eq('finalizado', true);

      if (error) throw error;

      const estructura = {}; 
      const gen = {};        

      const procesarFila = (contenedor, id, info, golesFavor, golesContra) => {
        if (!contenedor[id]) {
          contenedor[id] = { 
            nombre: info.nombre, escudo: info.escudo_url, 
            pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dif: 0, pts: 0 
          };
        }
        const s = contenedor[id];
        s.pj += 1;
        s.gf += (golesFavor || 0);
        s.gc += (golesContra || 0);
        s.dif = s.gf - s.gc;

        if (golesFavor > golesContra) { s.pg += 1; s.pts += 3; }
        else if (golesFavor === golesContra) { s.pe += 1; s.pts += 1; }
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

      const ordenar = (obj) => Object.values(obj).sort((a, b) => 
        b.pts - a.pts || b.dif - a.dif || b.gf - a.gf
      );

      const finalEstructura = {};
      Object.keys(estructura).forEach(cat => {
        finalEstructura[cat] = {};
        Object.keys(estructura[cat]).forEach(zona => {
          finalEstructura[cat][zona] = ordenar(estructura[cat][zona]);
        });
      });

      setDatosEstructurados(finalEstructura);
      setTablaGeneral(ordenar(gen));
    } catch (error) {
      console.error("Error en Tabla:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const ComponenteTabla = ({ datos, titulo, esGeneral = false }) => (
    <div className="space-y-3 mb-8 animate-in fade-in duration-700">
      <h3 className={`text-[10px] md:text-sm font-black uppercase tracking-[0.2em] ml-2 ${esGeneral ? 'text-amber-500' : 'text-slate-500'}`}>
        {titulo}
      </h3>
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <table className="w-full text-left table-fixed">
          <thead>
            <tr className="bg-slate-950/50 text-[7px] md:text-[9px] font-black uppercase text-slate-500 border-b border-slate-800">
              <th className="w-[10%] py-3 text-center">Pos</th>
              <th className="w-[35%] px-1">Club</th>
              <th className="w-[9%] text-center">PJ</th>
              <th className="w-[9%] text-center">GF</th>
              <th className="w-[9%] text-center">GC</th>
              <th className="w-[12%] text-center">DIF</th>
              <th className="w-[16%] text-center text-blue-400 bg-blue-500/5">PTS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {datos.map((club, index) => {
              const clasifica = !esGeneral && index < 2;
              return (
                <tr key={index} className="hover:bg-slate-800/30 transition-colors">
                  <td className={`py-3 font-black italic text-center text-[9px] md:text-xs ${clasifica ? 'text-emerald-500' : 'text-slate-600'}`}>
                    {index + 1}º
                  </td>
                  <td className="px-1 py-3">
                    <div className="flex items-center gap-1 md:gap-2">
                      <img src={club.escudo} alt="" className="w-4 h-4 md:w-6 md:h-6 object-contain flex-shrink-0" />
                      <span className={`text-[8px] md:text-[10px] font-black uppercase truncate ${clasifica ? 'text-white' : 'text-slate-400'}`}>
                        {club.nombre}{clasifica && '⭐'}
                      </span>
                    </div>
                  </td>
                  <td className="text-center text-[9px] md:text-xs font-bold text-slate-300">{club.pj}</td>
                  <td className="text-center text-[9px] md:text-xs font-bold text-emerald-500/60">{club.gf}</td>
                  <td className="text-center text-[9px] md:text-xs font-bold text-rose-500/60">{club.gc}</td>
                  <td className={`text-center text-[9px] md:text-xs font-black ${club.dif > 0 ? 'text-blue-400' : club.dif < 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                    {club.dif > 0 ? `+${club.dif}` : club.dif}
                  </td>
                  <td className="text-center text-[10px] md:text-sm font-black text-white bg-blue-500/5">{club.pts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (loading) return <div className="p-10 text-center text-emerald-500 font-black animate-pulse uppercase tracking-[0.3em] bg-slate-950 min-h-screen flex items-center justify-center">Generando Tablas...</div>;

  return (
    <div className="max-w-6xl mx-auto p-2 md:p-4 bg-slate-950 min-h-screen text-white pb-20">
      <header className="text-center space-y-2 mb-10 mt-6">
        <h1 className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter">Posiciones <span className="text-blue-500">Oficiales</span></h1>
        <p className="text-slate-500 font-bold text-[8px] md:text-[10px] uppercase tracking-[0.3em]">Criterio de desempate: PTS / DIF / GF</p>
      </header>

      {Object.keys(datosEstructurados).sort().map(cat => (
        <div key={cat} className="mb-12">
          <div className="border-l-4 border-blue-600 pl-3 mb-6">
            <h2 className="text-lg md:text-2xl font-black uppercase italic text-white">Cat. {cat}</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
            {Object.keys(datosEstructurados[cat]).sort().map(zona => (
              <ComponenteTabla key={zona} datos={datosEstructurados[cat][zona]} titulo={zona} />
            ))}
          </div>
        </div>
      ))}

      <div className="mt-20 pt-10 border-t border-slate-800">
        <div className="text-center mb-8">
            <h2 className="text-xl md:text-3xl font-black uppercase italic text-amber-500">Ranking Institucional</h2>
            <p className="text-[7px] md:text-[9px] text-slate-500 uppercase font-bold tracking-widest mt-1">Sumatoria total de puntos todas las categorías</p>
        </div>
        <div className="max-w-2xl mx-auto">
            <ComponenteTabla datos={tablaGeneral} titulo="Tabla General Acumulada" esGeneral={true} />
        </div>
      </div>
    </div>
  );
};

export default TablaPosiciones;