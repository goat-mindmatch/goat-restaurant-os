import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// サーバーサイド専用（API Route内でのみ使用）
export function createServiceClient() {
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? anonKey
  return createClient<Database>(url, serviceKey, { auth: { persistSession: false } })
}

// ブラウザ・クライアントコンポーネント用（遅延初期化）
let _client: ReturnType<typeof createClient<Database>> | null = null
export function getSupabaseClient() {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    _client = createClient<Database>(url, key)
  }
  return _client
}

// 後方互換: 既存コードが `supabase.from(...)` を使っている場合用
export const supabase = new Proxy(
  {} as ReturnType<typeof createClient<Database>>,
  { get(_t, prop) { return getSupabaseClient()[prop as keyof ReturnType<typeof createClient<Database>>] } }
)
