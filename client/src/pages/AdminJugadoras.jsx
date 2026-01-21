import React, { useState, useEffect } from 'react';

const AdminJugadoras = () => {
  const [jugadoras, setJugadoras] = useState([]);
  const [busquedaClub, setBusquedaClub] = useState('');
  const [cargando, setCargando] = useState(true);

  // Cargar datos
  const obtenerJugadoras = async () => {
    try {
      const resp = await fetch('http://localhost:5000/jugadoras');
      const data = await resp.json();
      setJugadoras(data);
      setCargando(false);
    } catch (err) {
      console.error("Error al obtener jugadoras:", err);
    }
  };

  useEffect(() => { obtenerJugadoras(); }, []);

  // Función para aprobar manualmente
  const aprobar = async (id) => {
    try {
      const resp = await fetch(`http://localhost:5000/jugadoras/${id}/aprobar`, { method: 'PATCH' });
      if (resp.ok) obtenerJugadoras(); // Recargar lista
    // eslint-disable-next-line no-unused-vars
    } catch (err) { alert("Error al conectar con el servidor"); }
  };

  // Filtro por Club (ID o nombre si lo tienes)
  const jugadorasFiltradas = jugadoras.filter(j => 
    j.equipo_id.toString().includes(busquedaClub)
  );

  return (
    <div className="p-4 md:p-8 bg-slate-900 min-h-screen text-slate-100 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 border-b border-slate-700 pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-blue-500">Gestión de Jugadoras</h1>
            <p className="text-slate-400">Proyecto nc-s1125 - NO COUNTRY</p>
          </div>
          <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
            <label className="block text-xs uppercase font-bold text-slate-500 mb-1">Filtrar por Club (ID)</label>
            <input 
              type="text" 
              className="bg-slate-900 border border-slate-600 rounded px-3 py-1 text-white focus:outline-none focus:border-blue-500"
              placeholder="Ej: 5"
              onChange={(e) => setBusquedaClub(e.target.value)}
            />
          </div>
        </header>

        {cargando ? (
          <p className="text-center py-10">Cargando base de datos...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jugadorasFiltradas.map(j => (
              <div key={j.id} className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden relative">
                {/* Badge de Verificación Manual */}
                {j.verificacion_manual && (
                  <div className="absolute top-2 right-2 bg-amber-500 text-slate-900 text-[10px] font-black px-2 py-1 rounded-full animate-pulse shadow-lg">
                    ⚠️ REVISIÓN NECESARIA
                  </div>
                )}

                <div className="p-5 flex gap-4">
                  <img src={j.foto_url} className="w-20 h-20 rounded-lg object-cover border-2 border-slate-600" alt="Perfil" />
                  <div>
                    <h2 className="text-xl font-bold uppercase leading-tight">{j.apellido}, {j.nombre}</h2>
                    <p className="text-blue-400 font-mono text-sm">{j.categoria_actual}</p>
                    <p className="text-slate-500 text-xs mt-1">DNI: {j.dni} | Club ID: {j.equipo_id}</p>
                  </div>
                </div>

                <div className="bg-slate-900/50 p-4 flex items-center justify-between border-t border-slate-700">
                  <span className={`text-xs font-bold px-2 py-1 rounded ${j.verificacion_manual ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {j.verificacion_manual ? 'PENDIENTE' : 'VERIFICADA'}
                  </span>
                  
                  {j.verificacion_manual && (
                    <button 
                      onClick={() => aprobar(j.id)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-4 rounded-md transition-all active:scale-95"
                    >
                      Aprobar Ahora
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