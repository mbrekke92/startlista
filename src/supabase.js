import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://razcbbvvmtyedfgciogc.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhemNiYnZ2bXR5ZWRmZ2Npb2djIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NjM3NzYsImV4cCI6MjA5MDEzOTc3Nn0.x0uu3O8pwNAb4k8CrQb3rRWMGTjn8XAQ9nF9YfHTR6o'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
