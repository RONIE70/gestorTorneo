import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      const { data: perfil, error: perfilError } = await supabase
        .from('perfiles')
        .select('rol, equipo_id')
        .eq('id', authData.user.id)
        .single();

      if (perfilError) throw perfilError;

      switch (perfil.rol) {
        case 'superadmin': navigate('/admin-config'); break;
        case 'delegado': navigate('/admin-delegado'); break;
        case 'arbitro': navigate('/admin-arbitros'); break;
        case 'colaborador': navigate('/admin-liga'); break;
        default: navigate('/mi-carnet');
      }

    } catch (error) {
      alert("Error de acceso: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
        
        {/* Logo / Header con el Escorpión Deportivo */}
        <div className="text-center mb-10">
          <div className="relative inline-block mb-6">
            {/* Círculo de Luz de Fondo */}
            <div className="absolute inset-0 bg-rose-600 rounded-full blur-[40px] opacity-20 animate-pulse"></div>
            
            {/* Contenedor del Icono (Escorpión) */}
            <div className="relative h-28 w-28 md:h-32 md:w-32 rounded-full overflow-hidden border-4 border-rose-600 bg-white p-1 shadow-2xl shadow-rose-900/40">
              <img 
                src="/escorpion_logo.jpg" 
                alt="Digital Scorpions Logo" 
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            
            {/* Badge de Versión */}
            <span className="absolute -bottom-2 right-0 bg-rose-600 text-white text-[8px] font-black px-2 py-1 rounded-md uppercase tracking-tighter border-2 border-slate-950">
              v2.0
            </span>
          </div>

          <h1 className="text-4xl font-black uppercase italic text-white tracking-tighter leading-none">
            SCORPIO<span className="text-rose-600">.</span>1225
          </h1>
          <p className="text-slate-500 text-[10px] uppercase tracking-[0.4em] font-bold mt-3">
            Digital Scorpions <span className="text-rose-600 mx-1">•</span> Elite Management
          </p>
        </div>

        {/* Card de Formulario */}
        <div className="bg-slate-900 border border-white/5 p-8 rounded-[3rem] shadow-2xl shadow-black/50 relative overflow-hidden">
          {/* Sutil brillo interno */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-600/5 rounded-full blur-[60px]"></div>
          
          <form onSubmit={handleLogin} className="space-y-6 relative z-10">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 ml-4 mb-2 block tracking-widest">
                Credenciales de Acceso
              </label>
              <input
                autoComplete="username"
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-white/5 rounded-2xl p-4 text-sm text-white outline-none focus:border-rose-600/50 focus:ring-1 focus:ring-rose-600/20 transition-all placeholder:text-slate-700"
                placeholder="EMAIL@LIGA.COM"
                required
              />
            </div>

            <div>
              <input 
                autoComplete="current-password"
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-white/5 rounded-2xl p-4 text-sm text-white outline-none focus:border-rose-600/50 focus:ring-1 focus:ring-rose-600/20 transition-all placeholder:text-slate-700"
                placeholder="CONTRASEÑA"
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 ${
                loading 
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40 hover:-translate-y-0.5'
              }`}
            >
              {loading ? "Sincronizando..." : "Entrar al Sistema"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center mt-10 space-y-2">
            <p className="text-slate-600 text-[9px] uppercase font-bold tracking-[0.3em]">
              Gestión Integral Deportiva
            </p>
            <div className="h-px w-10 bg-slate-800"></div>
            <p className="text-slate-700 text-[8px] uppercase font-black">
              © 2026 Powered by Digital Scorpions
            </p>
        </div>
      </div>
    </div>
  );
};

export default Login;