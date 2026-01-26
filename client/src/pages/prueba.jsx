const getPerfilYIdentidad = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          const { data: perfil } = await supabase
            .from('perfiles')
            .select('rol, organizaciones(nombre, color_principal)')
            .eq('id', session.user.id)
            .single();

          if (perfil) {
            setUserRol(perfil.rol);
            // ... resto de tu lógica de color y nombre ...
          }
        } else {
          // IMPORTANTE: Si no hay sesión, el rol es 'jugadora' (público)
          setUserRol('jugadora');
        }
      } catch (error) {
        setUserRol('jugadora');
      } finally {
        setLoadingSession(false);
      }
    };