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
              <img src="data:image/png;base64,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" alt="checkmark"
              className="w-full h-full object-cover rounded-full"
              />
                
              
            </div>
            
            {/* Badge de Versión */}
            <span className="absolute -bottom-2 right-0 bg-rose-600 text-white text-[8px] font-black px-2 py-1 rounded-md uppercase tracking-tighter border-2 border-slate-950">
              v2.0
            </span>
          </div>

          <h1 className="text-4xl font-black uppercase italic text-white tracking-tighter leading-none">
            SC<span className="text-rose-600">.</span>1225
          </h1>
          <p className="text-slate-600 text-[9px] uppercase font-bold tracking-[0.3em]">
              Gestión Integral Deportiva
            </p>
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