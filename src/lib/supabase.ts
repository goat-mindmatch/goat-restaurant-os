import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// ブラウザ・サーバー共用クライアント
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// サーバーサイド専用（API Route内でのみ使用）
export function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? supabaseAnonKey
  return createClient<Database>(
    supabaseUrl,
    serviceKey,
    { auth: { persistSession: false } }
  )
}
