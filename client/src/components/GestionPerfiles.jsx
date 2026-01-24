import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const GestionPerfiles = () => {
  const [perfiles, setPerfiles] = useState([]);
  const [clubes, setClubes] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Cargar perfiles y clubes
  const cargarDatos = useCallback(async () => {
  // Quitamos el setLoading(true) de aquí si se llama dentro de un useEffect simple
  const { data: perfilesData, error: errP } = await supabase
    .from('perfiles')
    .select('*, equipo:equipos(nombre)')
    .order('rol', { ascending: true });
  
  const { data: equiposData, error: errE } = await supabase.from('equipos').select('*').order('nombre');

  if (!errP && !errE) {
    // Agrupamos las actualizaciones de estado
    setPerfiles(perfilesData || []);
    setClubes(equiposData || []);
  }
  setLoading(false);
}, []); // Memorizamos la función

useEffect(() => {
  // Definimos la función dentro para que no necesite estar en las dependencias
  const fetchData = async () => {
    try {
      // 1. Iniciamos carga
      setLoading(true);

      // 2. Ejecutamos consultas en paralelo para mayor velocidad
      const [perfilesRes, equiposRes] = await Promise.all([
        supabase.from('perfiles').select('*, equipo:equipos(nombre)').order('rol'),
        supabase.from('equipos').select('*').order('nombre')
      ]);

      // 3. Verificamos errores antes de actualizar estado
      if (perfilesRes.error) throw perfilesRes.error;
      if (equiposRes.error) throw equiposRes.error;

      // 4. Actualizamos estados una sola vez
      setPerfiles(perfilesRes.data || []);
      setClubes(equiposRes.data || []);

    } catch (err) {
      console.error("Error cargando datos:", err.message);
    } finally {
      // 5. Finalizamos carga
      setLoading(false);
    }
  };

  fetchData();
}, []); // Array vacío: solo se ejecuta una vez al montar

  
  // 2. Función para cambiar el rol con un clic
  const actualizarRol = async (id, nuevoRol) => {
    const { error } = await supabase
      .from('perfiles')
      .update({ rol: nuevoRol })
      .eq('id', id);

    if (!error) {
      alert("✅ Rol actualizado correctamente");
      cargarDatos();
    }
  };

  // 3. Función para asignar equipo (solo para delegados)
  const asignarEquipo = async (id, equipoId) => {
    const { error } = await supabase
      .from('perfiles')
      .update({ equipo_id: equipoId })
      .eq('id', id);

    if (!error) cargarDatos();
  };

  if (loading) return <div className="p-10 text-white">Cargando base de usuarios...</div>;

  return (
    <div className="p-8 bg-slate-950 min-h-screen text-white font-sans">
      <header className="mb-10 border-b border-slate-800 pb-6">
        <h1 className="text-3xl font-black uppercase italic text-rose-600">Gestión de Perfiles</h1>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">
          Control de Acceso y Roles de Usuario
        </p>
      </header>

      <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800/50 border-b border-slate-700">
              <th className="p-5 text-[10px] font-black uppercase tracking-tighter">Usuario / Email</th>
              <th className="p-5 text-[10px] font-black uppercase tracking-tighter">Rol Actual</th>
              <th className="p-5 text-[10px] font-black uppercase tracking-tighter">Acciones de Rol</th>
              <th className="p-5 text-[10px] font-black uppercase tracking-tighter">Asignar Club (Delegados)</th>
            </tr>
          </thead>
          <tbody>
            {perfiles.map((p) => (
              <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-all">
                <td className="p-5">
                  <p className="text-xs font-bold text-white">{p.nombre_completo || 'Sin Nombre'}</p>
                  <p className="text-[10px] text-slate-500">{p.email}</p>
                </td>
                <td className="p-5">
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                    p.rol === 'superadmin' ? 'bg-rose-600' : 
                    p.rol === 'delegado' ? 'bg-blue-600' : 
                    p.rol === 'arbitro' ? 'bg-amber-500' : 'bg-slate-700'
                  }`}>
                    {p.rol}
                  </span>
                </td>
                <td className="p-5 flex gap-2">
                  <button onClick={() => actualizarRol(p.id, 'delegado')} className="bg-slate-800 hover:bg-blue-600 p-2 rounded-lg text-[9px] font-bold uppercase transition-all">Delegado</button>
                  <button onClick={() => actualizarRol(p.id, 'arbitro')} className="bg-slate-800 hover:bg-amber-500 p-2 rounded-lg text-[9px] font-bold uppercase transition-all">Árbitro</button>
                  <button onClick={() => actualizarRol(p.id, 'colaborador')} className="bg-slate-800 hover:bg-emerald-600 p-2 rounded-lg text-[9px] font-bold uppercase transition-all">Colab.</button>
                </td>
                <td className="p-5">
                  {p.rol === 'delegado' ? (
                    <select 
                      className="bg-slate-950 border border-slate-800 p-2 rounded-xl text-[10px] font-bold text-white outline-none w-full"
                      value={p.equipo_id || ""}
                      onChange={(e) => asignarEquipo(p.id, e.target.value)}
                    >
                      <option value="">Seleccionar Club...</option>
                      {clubes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  ) : (
                    <span className="text-[9px] text-slate-700 uppercase font-black italic">No requiere club</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="mt-8 text-center">
        <p className="text-slate-600 text-[9px] font-bold uppercase tracking-[0.5em]">
          nc-s1125 Security Management System
        </p>
      </footer>
    </div>
  );
};

export default GestionPerfiles;