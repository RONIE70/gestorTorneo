import React, { useState, useEffect, useCallback } from 'react';

const AdminJugadoras = () => {
  const [jugadoras, setJugadoras] = useState([]);
  const [busquedaClub, setBusquedaClub] = useState('');
  const [cargando, setCargando] = useState(true);

  // 1. Definimos la función con useCallback para que sea una referencia estable
  const obtenerJugadoras = useCallback(async () => {
    try {
      // Usamos la variable de entorno para que funcione en Vercel
      const resp = await fetch(`${import.meta.env.VITE_API_URL}/jugadoras`);
      const data = await resp.json();
      
      setJugadoras(data);
      setCargando(false);
    } catch (err) {
      console.error("Error al obtener jugadoras:", err);
      setCargando(false);
    }
  }, []);

  // 2. El efecto llama a la función asíncrona de forma segura
  useEffect(() => {
    let montado = true;

    const ejecutarCarga = async () => {
      if (montado) {
        await obtenerJugadoras();
      }
    };

    ejecutarCarga();

    return () => { montado = false; }; // Cleanup para evitar fugas de memoria
  }, [obtenerJugadoras]);

  // 3. Función para aprobar (CORREGIDA la URL a dinámica)
  const aprobar = async (id) => {
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL}/jugadoras/${id}/aprobar`, { 
        method: 'PATCH' 
      });
      if (resp.ok) {
        obtenerJugadoras(); // Recargar la lista
      } else {
        alert("No se pudo completar la aprobación");
      }
    // eslint-disable-next-line no-unused-vars
    } catch (err) { 
      alert("Error al conectar con el servidor"); 
    }
  };

  // Filtro por Club
  const jugadorasFiltradas = jugadoras.filter(j => 
    j.equipo_id.toString().includes(busquedaClub)
  );

  return (
    <div className="p-4 md:p-8 bg-slate-900 min-h-screen text-slate-100 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 border-b border-slate-700 pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-blue-500 uppercase italic">Gestión de Jugadoras</h1>
            <p className="text-slate-400 text-xs font-bold tracking-widest uppercase mt-1">Panel de Control Central</p>
          </div>
          <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
            <label className="block text-[10px] uppercase font-black text-slate-500 mb-1">Filtrar por Club (ID)</label>
            <input 
              type="text" 
              className="bg-slate-900 border border-slate-600 rounded px-3 py-1 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="Ej: 5"
              value={busquedaClub}
              onChange={(e) => setBusquedaClub(e.target.value)}
            />
          </div>
        </header>

        {cargando ? (
          <div className="text-center py-20 animate-pulse font-black text-slate-500 uppercase tracking-widest">
            Sincronizando base de datos...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jugadorasFiltradas.map(j => (
              <div key={j.id} className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden relative group hover:border-blue-500/50 transition-all">
                
                {j.verificacion_manual && (
                  <div className="absolute top-2 right-2 bg-amber-500 text-slate-900 text-[9px] font-black px-3 py-1 rounded-full animate-bounce shadow-lg z-10">
                    ⚠️ REVISIÓN IA
                  </div>
                )}

                <div className="p-5 flex gap-4">
                  <img src={j.foto_url} className="w-20 h-20 rounded-xl object-cover border-2 border-slate-700" alt="Perfil" />
                  <div className="flex-1">
                    <h2 className="text-lg font-black uppercase leading-tight tracking-tighter">{j.apellido}, {j.nombre}</h2>
                    <p className="text-blue-400 font-black text-[10px] uppercase italic">{j.categoria_actual}</p>
                    <p className="text-slate-500 text-[10px] font-bold mt-2">DNI: {j.dni} | Club: {j.equipo_id}</p>
                  </div>
                </div>

                <div className="bg-slate-900/80 p-4 flex items-center justify-between border-t border-slate-700/50">
                  <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${j.verificacion_manual ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {j.verificacion_manual ? '● Pendiente' : '✓ Verificada'}
                  </span>
                  
                  {j.verificacion_manual && (
                    <button 
                      onClick={() => aprobar(j.id)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black py-2 px-4 rounded-xl transition-all active:scale-95"
                    >
                      Aprobar Fichaje
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminJugadoras;