import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const SuperAdminDashboard = () => {
  const [nombreLiga, setNombreLiga] = useState('');
  const [emailAdmin, setEmailAdmin] = useState('');
  const [passwordAdmin, setPasswordAdmin] = useState('');
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  const [loading, setLoading] = useState(false);

  const crearNuevaLiga = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Crear la Organización
      const { data: org, error: orgError } = await supabase
        .from('organizaciones')
        .insert([{ nombre: nombreLiga, slug: nombreLiga.toLowerCase().replace(/ /g, '-') }])
        .select()
        .single();

      if (orgError) throw orgError;

      // 2. Crear el Usuario Admin para esa Liga
      // Nota: Usamos signUp, el usuario deberá confirmar su email
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailAdmin,
        password: passwordAdmin,
        options: {
          data: {
            rol: 'admin_liga',
            organizacion_id: org.id
          }
        }
      });

      if (authError) throw authError;

      // 3. Crear el perfil vinculado
      const { error: perfilError } = await supabase
        .from('perfiles')
        .insert([{
          id: authData.user.id,
          rol: 'admin_liga',
          organizacion_id: org.id,
          email: emailAdmin
        }]);

      if (perfilError) throw perfilError;

      setMensaje({ tipo: 'success', texto: `Liga "${nombreLiga}" creada con éxito. Admin: ${emailAdmin}` });
      setNombreLiga(''); setEmailAdmin(''); setPasswordAdmin('');

    } catch (error) {
      setMensaje({ tipo: 'error', texto: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 font-sans">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-black uppercase italic mb-8">Panel de <span className="text-rose-600">Control Maestro</span></h1>
        
        <form onSubmit={crearNuevaLiga} className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-6">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Nombre de la Nueva Liga</label>
            <input 
              type="text" required placeholder="EJ: LIGA FEMENINA SUR"
              className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl mt-2 outline-none focus:border-rose-600 transition-all uppercase text-sm"
              value={nombreLiga} onChange={(e) => setNombreLiga(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Email del Administrador</label>
              <input 
                type="email" required placeholder="admin@liga.com"
                className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl mt-2 outline-none focus:border-rose-600 transition-all text-sm"
                value={emailAdmin} onChange={(e) => setEmailAdmin(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Contraseña Inicial</label>
              <input 
                type="password" required placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl mt-2 outline-none focus:border-rose-600 transition-all text-sm"
                value={passwordAdmin} onChange={(e) => setPasswordAdmin(e.target.value)}
              />
            </div>
          </div>

          <button 
            type="submit" disabled={loading}
            className="w-full bg-rose-600 hover:bg-rose-500 py-4 rounded-2xl font-black uppercase tracking-widest transition-all disabled:opacity-50"
          >
            {loading ? 'Procesando...' : '🚀 Dar de Alta Nueva Liga'}
          </button>

          {mensaje.texto && (
            <div className={`p-4 rounded-xl text-xs font-bold text-center uppercase ${mensaje.tipo === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
              {mensaje.texto}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;