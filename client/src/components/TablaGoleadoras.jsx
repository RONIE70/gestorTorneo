import React, { useState, useEffect } from 'react';

const TablaGoleadoras = () => {
  const [goleadoras, setGoleadoras] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGoleadoras = async () => {
      try {
        // Traemos jugadoras ordenadas por goles, incluyendo el nombre de su equipo
        const { data, error } = await supabase
          .from('jugadoras')
          .select('id, nombre, apellido, goles_totales, foto_url, equipos(nombre)')
          .gt('goles_totales', 0) // Solo las que tengan al menos un gol
          .order('goles_totales', { ascending: false })
          .limit(10); // Top 10

        if (error) throw error;
        setGoleadoras(data);
      } catch (err) {
        console.error("Error cargando goleadoras:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchGoleadoras();
  }, []);

  if (loading) return <div className="text-white text-center p-10">Cargando tabla de goleadoras...</div>;

  return (
    <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-2xl max-w-2xl mx-auto mt-10">
      <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 uppercase mb-6 text-center italic">
        🏆 Top Goleadoras - Temporada 2026
      </h2>

      <div className="space-y-3">
        {goleadoras.map((j, index) => (
          <div 
            key={j.id} 
            className={`flex items-center justify-between p-3 rounded-2xl transition-all ${
              index === 0 ? 'bg-blue-600/20 border border-blue-500/50 shadow-lg shadow-blue-900/20' : 'bg-slate-800/50 border border-slate-700'
            }`}
          >
            <div className="flex items-center gap-4">
              <span className={`text-xl font-black w-6 ${index === 0 ? 'text-yellow-400' : 'text-slate-500'}`}>
                {index + 1}
              </span>
              <img 
                src={j.foto_url} 
                className={`w-12 h-12 rounded-full object-cover border-2 ${index === 0 ? 'border-yellow-400' : 'border-slate-600'}`} 
                alt="Jugadora" 
              />
              <div>
                <p className="font-bold text-white uppercase leading-none">{j.apellido}, {j.nombre}</p>
                <p className="text-[10px] text-blue-400 font-bold uppercase">{j.equipos?.nombre}</p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-2xl font-black text-white">{j.goles_totales}</p>
              <p className="text-[8px] text-slate-400 uppercase font-bold tracking-widest">Goles</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TablaGoleadoras;