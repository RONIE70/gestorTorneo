import { createClient } from '@supabase/supabase-js';

// Datos de tu .env (Imagen 96f0be.png)
const supabaseUrl = 'https://ssdpibrxjkjakbifdzlc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzZHBpYnJ4amtqYWtiaWZkemxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2NTIwMDgsImV4cCI6MjA4MzIyODAwOH0.OFSqjRy-fYn4prj_EOUd5712iNkKowxU_uX7ff1oLvU'; // Asegúrate de que termine en .algo y no tenga espacios

export const supabase = createClient(supabaseUrl, supabaseKey);