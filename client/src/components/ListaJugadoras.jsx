import React, { useState, useEffect } from 'react';

const ListaJugadoras = () => {
  const [jugadoras, setJugadoras] = useState([]);
  const [filtroClub, setFiltroClub] = useState('');
  const [loading, setLoading] = useState(true);

  // 1. Cargar jugadoras desde el servidor
  useEffect(() => {
    const fetchJugadoras = async () => {
      try {
        // Ajusta la URL según tu puerto (5000)
        const response = await fetch('http://localhost:5000/test-db'); 
        // Nota: Deberías crear un endpoint /jugadoras que traiga todo, 
        // por ahora usamos el de prueba o el que tengas definido.
        const data = await response.json();
        setJugadoras(data.jugadoras || []);
        setLoading(false);
      } catch (error) {
        console.error("Error cargando jugadoras:", error);
        setLoading(false);
      }
    };
    fetchJugadoras();
  }, []);

  // 2. Función para aprobar manualmente
  const handleAprobar = async (id) => {
    try {
      const response = await fetch(`http://localhost:5000/jugadoras/${id}/aprobar`, {
        method: 'PATCH'
      });
      if (response.ok) {
        // Actualizamos el estado local para que el badge cambie a verde
        setJugadoras(jugadoras.map(j => j.id === id ? { ...j, verificacion_manual: false } : j));
      }
    // eslint-disable-next-line no-unused-vars
    } catch (error) {
      alert("Error al aprobar");
    }
  };

  // 3. Filtro lógico por club (equipo_id o nombre de equipo)
  const jugadorasFiltradas = jugadoras.filter(j => 
    j.equipo_id.toString().includes(filtroClub)
  );

  if (loading) return <div className="p-8 text-center text-white">Cargando jugadoras de NO COUNTRY...</div>;

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-white">
      <h2 className="text-3xl font-bold mb-6 text-blue-400">Panel de Jugadoras - nc-s1125</h2>

      {/* FILTRO POR CLUB */}
      <div className="mb-8 flex gap-4 items-center bg-gray-800 p-4 rounded-lg">
        <label className="font-semibold text-gray-300">Buscar por ID de Club:</label>
        <input 
          type="text" 
          placeholder="Ej: 1"
          className="bg-gray-700 border border-gray-600 p-2 rounded w-40 focus:ring-2 focus:ring-blue-500 outline-none"
          value={filtroClub}
          onChange={(e) => setFiltroClub(e.target.value)}
        />
        <span className="text-sm text-gray-400">Mostrando: {jugadorasFiltradas.length} jugadoras</span>
      </div>

      {/* LISTADO */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {jugadorasFiltradas.map((jugadora) => (
          <div key={jugadora.id} className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 hover:border-blue-500 transition-all shadow-lg">
            <div className="flex p-4 gap-4">
              <img 
                src={jugadora.foto_url} 
                alt={jugadora.nombre} 
                className="w-24 h-24 rounded-full object-cover border-2 border-gray-600"
              />
              <div className="flex-1">
                <h3 className="text-xl font-bold">{jugadora.nombre} {jugadora.apellido}</h3>
                <p className="text-gray-400 text-sm">DNI: {jugadora.dni}</p>
                <p className="text-blue-400 font-semibold text-sm">{jugadora.categoria_actual}</p>
                
                {/* BADGE DE VALIDACIÓN */}
                <div className="mt-2">
                  {jugadora.verificacion_manual ? (
                    <span className="px-2 py-1 bg-orange-900/50 text-orange-400 text-xs rounded-full border border-orange-700 animate-pulse">
                      ⚠️ Revisión Manual
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-green-900/50 text-green-400 text-xs rounded-full border border-green-700">
                      ✅ Verificada
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* BOTÓN DE ACCIÓN PARA EL ADMIN */}
            {jugadora.verificacion_manual && (
              <div className="bg-gray-700/50 p-3 flex justify-center">
                <button 
                  onClick={() => handleAprobar(jugadora.id)}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-1 px-4 rounded transition-colors"
                >
                  Aprobar Identidad
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {jugadorasFiltradas.length === 0 && (
        <div className="text-center py-20 text-gray-500">No se encontraron jugadoras para este club.</div>
      )}
    </div>
  );
};

export default ListaJugadoras;