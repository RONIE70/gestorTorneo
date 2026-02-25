import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { supabase } from '../supabaseClient';
import CarnetJugadora from '../components/CarnetJugadora'; 

const FormularioFichaje = () => {
  const [filePerfil, setFilePerfil] = useState(null);
  const [fileDNI, setFileDNI] = useState(null);
  const [jugadoraRegistrada, setJugadoraRegistrada] = useState(null);
  const [cargando, setCargando] = useState(false);
  
  // Estado para las reglas de categorías de la liga
  const [reglasCategorias, setReglasCategorias] = useState([]);
  const [userOrgId, setUserOrgId] = useState(null);
  const [categoriaSugerida, setCategoriaSugerida] = useState("");

  const [datos, setDatos] = useState({ 
    nombre: '', 
    apellido: '', 
    dni: '', 
    fecha_nacimiento: '', 
    equipo_id: '' // Ahora es dinámico
  });

  // 1. Obtener contexto de Organización y sus categorías
  useEffect(() => {
    const cargarConfiguracion = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('organizacion_id, equipo_id')
          .eq('id', session.user.id)
          .single();
        
        if (perfil) {
          setUserOrgId(perfil.organizacion_id);
          setDatos(prev => ({ ...prev, equipo_id: perfil.equipo_id }));

          // Cargamos las reglas de esta liga
          const { data: cats } = await supabase
            .from('categorias')
            .select('*')
            .eq('organizacion_id', perfil.organizacion_id);
          setReglasCategorias(cats || []);
        }
      }
    };
    cargarConfiguracion();
  }, []);

  // 2. Lógica para detectar categoría automáticamente al cambiar la fecha
  useEffect(() => {
    if (datos.fecha_nacimiento && reglasCategorias.length > 0) {
      const anio = new Date(datos.fecha_nacimiento).getFullYear();
      const match = reglasCategorias.find(c => 
        anio >= c.año_desde && anio <= (c.año_hasta || anio)
      );
      if (match) setCategoriaSugerida(match.nombre);
      else setCategoriaSugerida("SIN CATEGORÍA CORRESPONDIENTE");
    }
  }, [datos.fecha_nacimiento, reglasCategorias]);

  const manejarEnvio = async (e) => {
    e.preventDefault();
    if (!filePerfil || !fileDNI) return alert("Faltan fotos");
    
    setCargando(true);
    const formData = new FormData();
    
    formData.append('foto', filePerfil);
    formData.append('dni_foto', fileDNI);
    formData.append('nombre', datos.nombre);
    formData.append('apellido', datos.apellido);
    formData.append('dni', datos.dni);
    formData.append('fecha_nacimiento', datos.fecha_nacimiento);
    formData.append('equipo_id', datos.equipo_id);
    formData.append('organizacion_id', userOrgId);
    formData.append('categoria_actual', categoriaSugerida); // Guardamos la categoría calculada

    try {
      // Usamos variable de entorno para la URL
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.post(`${API_URL}/fichar`, formData);
      
      setJugadoraRegistrada(res.data.jugadora);
      alert("✅ Registro completado en: " + categoriaSugerida);
    } catch (err) {
      alert("❌ Error: " + (err.response?.data?.error || "Error de red"));
    } finally {
      setCargando(false);
    }
  };

  if (jugadoraRegistrada) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-4">
        <CarnetJugadora jugadora={jugadoraRegistrada} />
        <button onClick={() => setJugadoraRegistrada(null)} className="mt-8 bg-blue-600 text-white px-8 py-3 rounded-full font-bold shadow-lg">
          REALIZAR OTRO REGISTRO
        </button>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen p-4 bg-slate-900 font-sans">
      <form onSubmit={manejarEnvio} className="bg-white p-8 rounded-[2rem] shadow-2xl w-full max-w-md border-t-8 border-blue-600">
        <h2 className="text-2xl font-black text-center text-slate-800 mb-2 uppercase tracking-tighter">Fichaje Oficial</h2>
        <p className="text-center text-[10px] text-slate-400 mb-6 font-bold uppercase tracking-widest">Sistema de Validación Biométrica</p>
        
        <div className="space-y-4">
          <input type="text" placeholder="Nombre" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" 
            onChange={e => setDatos({...datos, nombre: e.target.value.toUpperCase()})} required />
          
          <input type="text" placeholder="Apellido" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" 
            onChange={e => setDatos({...datos, apellido: e.target.value.toUpperCase()})} required />
          
          <input type="text" placeholder="DNI" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" 
            onChange={e => setDatos({...datos, dni: e.target.value})} required />
          
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
            <label className="text-[10px] font-black text-blue-600 uppercase ml-1 block mb-1">Fecha de Nacimiento</label>
            <input type="date" className="w-full bg-transparent outline-none font-bold text-slate-700" 
              onChange={e => setDatos({...datos, fecha_nacimiento: e.target.value})} required />
            
            {/* INDICADOR DE CATEGORÍA AUTOMÁTICA */}
            {categoriaSugerida && (
                <div className="mt-3 pt-2 border-t border-blue-200">
                    <p className="text-[9px] font-black text-blue-400 uppercase">Categoría Asignada:</p>
                    <p className="text-sm font-black text-blue-700 italic">{categoriaSugerida}</p>
                </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Foto Perfil</label>
                <input type="file" className="text-[10px] w-full" onChange={e => setFilePerfil(e.target.files[0])} required />
            </div>
            <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Foto DNI</label>
                <input type="file" className="text-[10px] w-full" onChange={e => setFileDNI(e.target.files[0])} required />
            </div>
          </div>

          <button disabled={cargando} className={`w-full font-black py-5 rounded-2xl transition-all shadow-xl uppercase text-xs tracking-widest ${cargando ? 'bg-slate-300 text-slate-500' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
            {cargando ? "Validando Biometría..." : "Finalizar Fichaje"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormularioFichaje;