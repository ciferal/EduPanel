import { supabase } from './supabase'

export async function testConnection() {
  const { data, error } = await supabase
    .from('students')
    .select('id')
    .limit(1)

  if (error) {
    console.error('Supabase connection error:', error.message)
    return false
  }

  console.log('Supabase connected successfully!', data)
  return true
}