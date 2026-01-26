import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import FichaJugadora from '../components/FichaJugadora';
import { useNavigate } from 'react-router-dom';

const ListaJugadoras = () => {
  const [jugadoras, setJugadoras] = useState([]);
  const [filtroNombre, setFiltroNombre] = useState('');
  const [loading, setLoading] = useState(true);
  const [perfilUsuario, setPerfilUsuario] = useState(null);
  const [jugadoraSeleccionadaId, setJugadoraSeleccionadaId] = useState(null);
  
  const navigate = useNavigate();

  // Función de carga de datos memorizada
  const cargarInformacion = useCallback(async (userId) => {
    try {
      const { data: perfil, error: pError } = await supabase
        .from('perfiles')
        .select('equipo_id, organizacion_id, equipos(nombre)')
        .eq('id', userId)
        .maybeSingle();

      if (pError || !perfil) {
        console.error("Perfil no encontrado o error:", pError);
        return;
      }

      setPerfilUsuario(perfil);

      const { data: lista, error: jError } = await supabase
        .from('jugadoras')
        .select('*, equipos(nombre)')
        .eq('organizacion_id', perfil.organizacion_id)
        .eq('equipo_id', perfil.equipo_id)
        .order('apellido', { ascending: true });
      
      if (jError) throw jError;
      setJugadoras(lista || []);

    } catch (err) {
      console.error("Error cargando datos:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let montado = true;

    const inicializarAutenticacion = async () => {
      // Intentamos recuperar la sesión
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session && montado) {
        cargarInformacion(session.user.id);
      } else {
        // Si no hay sesión, preguntamos al servidor directamente
        // eslint-disable-next-line no-unused-vars
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (user && montado) {
          cargarInformacion(user.id);
        } else {
          // SOLO redirigimos si pasaron 3 segundos y no hay rastro del usuario
          // Esto evita el rebote por lentitud de internet
          setTimeout(async () => {
            const { data: { user: finalCheck } } = await supabase.auth.getUser();
            if (!finalCheck && montado) {
              console.log("Sesión definitivamente inexistente.");
              navigate('/login');
            }
          }, 3000);
        }
      }
    };

    inicializarAutenticacion();
    return () => { montado = false; };
  }, [navigate, cargarInformacion]);

  // Filtro por texto
  const jugadorasFiltradas = jugadoras.filter(j => 
    `${j.nombre} ${j.apellido}`.toLowerCase().includes(filtroNombre.toLowerCase()) ||
    j.dni?.includes(filtroNombre)
  );

  // MIENTRAS CARGA, NO DEJAMOS PASAR NADA
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">
          Verificando Identidad SaaS...
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-white font-sans">
      <div className="max-w-6xl mx-auto">
        <button onClick={() => navigate(-1)} className="mb-6 text-[10px] font-black uppercase text-slate-500 hover:text-white transition-colors">
          ← Volver
        </button>

        <header className="mb-10">
          <h2 className="text-3xl font-black uppercase italic tracking-tighter">
            Plantel: <span className="text-blue-500">{perfilUsuario?.equipos?.nombre || 'Mi Club'}</span>
          </h2>
          <p className="text-slate-500 text-[9px] font-bold mt-2 uppercase tracking-widest">
            Visualización restringida a delegados y compañeras
          </p>
        </header>

        <div className="mb-10 bg-slate-900/50 border border-slate-800 p-2 rounded-2xl shadow-2xl">
          <input 
            type="text" 
            placeholder="Buscar por nombre o DNI..."
            className="bg-transparent w-full p-4 outline-none text-xs font-bold uppercase text-white"
            value={filtroNombre}
            onChange={(e) => setFiltroNombre(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {jugadorasFiltradas.map(j => (
            <div 
              key={j.id} 
              onClick={() => setJugadoraSeleccionadaId(j.id)}
              className="bg-slate-900 p-4 rounded-[2rem] border border-slate-800 hover:border-blue-500 transition-all cursor-pointer group shadow-xl"
            >
              <div className="relative overflow-hidden rounded-2xl mb-4">
                <img src={j.foto_url || 'https://via.placeholder.com/150'} className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-500" alt="j" />
              </div>
              <h3 className="text-xs font-black uppercase truncate">{j.apellido}, {j.nombre}</h3>
              <p className="text-[9px] text-blue-500 font-bold uppercase mt-1">DNI: {j.dni}</p>
            </div>
          ))}
        </div>

        {jugadoraSeleccionadaId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <FichaJugadora 
               jugadoraId={jugadoraSeleccionadaId} 
               onClose={() => setJugadoraSeleccionadaId(null)} 
               esTribunal={false} 
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ListaJugadoras;