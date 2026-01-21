import React, { useState } from 'react';
import axios from 'axios';
import CarnetJugadora from '../components/CarnetJugadora'; 

const FormularioFichaje = () => {
  // Manejamos los archivos en estados independientes para evitar errores de referencia
  const [filePerfil, setFilePerfil] = useState(null);
  const [fileDNI, setFileDNI] = useState(null);
  
  const [jugadoraRegistrada, setJugadoraRegistrada] = useState(null);
  const [cargando, setCargando] = useState(false);
  
  const [datos, setDatos] = useState({ 
    nombre: '', 
    apellido: '', 
    dni: '', 
    fecha_nacimiento: '', 
    equipo_id: 1 
  });

  const manejarEnvio = async (e) => {
    e.preventDefault();
    
    // Validaciones de seguridad
    if (!filePerfil) return alert("Por favor, selecciona la foto de perfil");
    if (!fileDNI) return alert("Por favor, selecciona la foto del DNI para validar");
    
    setCargando(true);
    const formData = new FormData();
    
    // Archivos (Deben coincidir con los nombres en el backend: upload.fields)
    formData.append('foto', filePerfil);
    formData.append('dni_foto', fileDNI);
    
    // Datos de texto
    formData.append('nombre', datos.nombre);
    formData.append('apellido', datos.apellido);
    formData.append('dni', datos.dni);
    formData.append('fecha_nacimiento', datos.fecha_nacimiento);
    formData.append('equipo_id', datos.equipo_id);

    try {
      const res = await axios.post('http://localhost:5000/fichar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setJugadoraRegistrada(res.data.jugadora);
      alert("✅ Fichaje y Validación completados con éxito");
    } catch (err) {
      console.error("Error detallado:", err);
      const msgError = err.response?.data?.error || "Servidor desconectado";
      alert("❌ Error: " + msgError);
    } finally {
      setCargando(false);
    }
  };

  if (jugadoraRegistrada) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-4">
        <CarnetJugadora jugadora={jugadoraRegistrada} />
        <button 
          onClick={() => setJugadoraRegistrada(null)}
          className="mt-8 bg-blue-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-blue-700 transition-all">
          REALIZAR OTRO REGISTRO
        </button>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen p-4 bg-slate-900">
      <form onSubmit={manejarEnvio} className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border-t-8 border-blue-600">
        <h2 className="text-2xl font-black text-center text-slate-800 mb-6 uppercase tracking-tighter">Registro NC-S1125</h2>
        
        <div className="space-y-4">
          <input type="text" placeholder="Nombre" className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" 
            onChange={e => setDatos({...datos, nombre: e.target.value})} required />
          
          <input type="text" placeholder="Apellido" className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" 
            onChange={e => setDatos({...datos, apellido: e.target.value})} required />
          
          <input type="text" placeholder="DNI" className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" 
            onChange={e => setDatos({...datos, dni: e.target.value})} required />
          
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Fecha de Nacimiento</label>
            <input type="date" className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" 
              onChange={e => setDatos({...datos, fecha_nacimiento: e.target.value})} required />
          </div>
          
          {/* CAMPO 1: Foto de Perfil */}
          <div>
            <label className="text-[10px] font-bold text-blue-600 uppercase ml-1">Foto para el Carnet</label>
            <input type="file" className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700" 
              onChange={e => setFilePerfil(e.target.files[0])} required />
          </div>

          {/* CAMPO 2: Foto del DNI */}
          <div>
            <label className="text-[10px] font-bold text-green-600 uppercase ml-1">Foto Frente DNI (Validación)</label>
            <input type="file" className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-green-50 file:text-green-700" 
              onChange={e => setFileDNI(e.target.files[0])} required />
          </div>

          <button 
            disabled={cargando}
            className={`w-full font-bold py-4 rounded-2xl transition-all shadow-lg ${cargando ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
            {cargando ? "VALIDANDO IDENTIDAD..." : "FINALIZAR REGISTRO"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormularioFichaje;