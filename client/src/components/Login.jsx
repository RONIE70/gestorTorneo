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
      // 1. Autenticación en Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // 2. Obtener el Perfil y el Rol
      const { data: perfil, error: perfilError } = await supabase
        .from('perfiles')
        .select('rol, equipo_id')
        .eq('id', authData.user.id)
        .single();

      if (perfilError) throw perfilError;

      // 3. Redirección Inteligente según Rol
      switch (perfil.rol) {
        case 'superadmin':
          navigate('/admin-config');
          break;
        case 'delegado':
          navigate('/admin-delegado'); // Aquí entraría a tu componente actual
          break;
        case 'arbitro':
          navigate('/admin-arbitros');
          break;
        case 'colaborador':
          navigate('/admin-liga');
          break;
        default:
          navigate('/mi-carnet'); // Jugadoras
      }

    } catch (error) {
      alert("Error de acceso: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-block p-4 rounded-full bg-rose-600/10 border border-rose-500/20 mb-4">
            <iframe src="https://assets.pinterest.com/ext/embed.html?id=261771797085621294" height="343" width="345" frameborder="0" scrolling="no" ></iframe></div>
          <h1 className="text-3xl font-black uppercase italic text-white tracking-tighter">
            SC<span className="text-rose-600">-</span>1225
          </h1>
          <p className="text-slate-500 text-[10px] uppercase tracking-[0.4em] font-bold mt-2">
            Gestión Oficial de Ligas Deportivas
          </p>
        </div>

        {/* Card de Formulario */}
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 ml-2 mb-2 block tracking-widest">
                Correo Electrónico
              </label>
              <input
                id="username" 
                autoComplete="username"
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:border-rose-600 transition-all"
                placeholder="ejemplo@liga.com"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 ml-2 mb-2 block tracking-widest">
                Contraseña
              </label>
              <input 
                id="password" 
                autoComplete="current-password"
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:border-rose-600 transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 ${
                loading ? 'bg-slate-700 text-slate-500' : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/20'
              }`}
            >
              {loading ? "Verificando Credenciales..." : "Iniciar Sesión"}
            </button>
          </form>
        </div>

        {/* Footer del Login */}
        <p className="text-center mt-8 text-slate-600 text-[9px] uppercase font-bold tracking-widest">
          Sistema Gestor de Torneos by Digital Scorpions &copy; 2026
        </p>
      </div>
    </div>
  );
};

export default Login;