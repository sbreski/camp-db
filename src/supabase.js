import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://guujqyawgxioicnclabc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1dWpxeWF3Z3hpb2ljbmNsYWJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTkyMDAsImV4cCI6MjA5MTMzNTIwMH0.6s83YC90vIKyqcFJ7xwsTL4CLHqKjN-tcBxIG7QAhzE'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)