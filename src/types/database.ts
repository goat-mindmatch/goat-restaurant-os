/**
 * GOAT Restaurant OS - Supabase データベース型定義
 * テーブル設計: まぜそば 人類みなまぜそば 向け（マルチテナント対応）
 */

export type Database = {
  public: {
    Tables: {
      // ================================
      // テナント（飲食店）管理
      // ================================
      tenants: {
        Row: {
          id: string
          name: string                // 店舗名 e.g. "人類みなまぜそば"
          slug: string                // URL用スラッグ e.g. "mazesoba-jinrui"
          plan: 'starter' | 'pro' | 'enterprise'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tenants']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['tenants']['Insert']>
      }

      // ================================
      // スタッフ管理
      // ================================
      staff: {
        Row: {
          id: string
          tenant_id: string
          name: string                // 氏名 e.g. "中地"
          line_user_id: string | null // LINE User ID（紐付け後）
          role: 'manager' | 'staff'
          // スキルマトリクス
          skill_hall: boolean         // ホール
          skill_cashier: boolean      // レジ
          skill_kitchen: boolean      // キッチン（麺・仕込み）
          skill_one_op: boolean       // ワンオペ可
          skill_open: boolean         // オープン作業可
          skill_close: boolean        // クローズ作業可
          // 給与
          hourly_wage: number         // 時給
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['staff']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['staff']['Insert']>
      }

      // ================================
      // 打刻（出退勤）
      // ================================
      attendance: {
        Row: {
          id: string
          tenant_id: string
          staff_id: string
          date: string               // YYYY-MM-DD
          clock_in: string | null    // HH:MM
          clock_out: string | null   // HH:MM
          break_minutes: number      // 休憩時間（分）
          work_minutes: number | null // 実労働時間（自動計算）
          note: string | null
          recorded_via: 'line' | 'manual'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['attendance']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['attendance']['Insert']>
      }

      // ================================
      // シフト希望
      // ================================
      shift_requests: {
        Row: {
          id: string
          tenant_id: string
          staff_id: string
          target_year: number        // 対象年
          target_month: number       // 対象月
          available_dates: string[]  // 出勤可能日 ["2026-05-01", ...]
          preferred_dates: string[]  // 希望出勤日
          note: string | null
          status: 'pending' | 'confirmed'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['shift_requests']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['shift_requests']['Insert']>
      }

      // ================================
      // 確定シフト
      // ================================
      shifts: {
        Row: {
          id: string
          tenant_id: string
          staff_id: string
          date: string               // YYYY-MM-DD
          start_time: string         // HH:MM
          end_time: string           // HH:MM
          role_on_day: string        // その日の役割 e.g. "ホール" "ワンオペ"
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['shifts']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['shifts']['Insert']>
      }

      // ================================
      // 日次売上サマリ（AnyDeli Excelから取込）
      // ================================
      daily_sales: {
        Row: {
          id: string
          tenant_id: string
          date: string               // YYYY-MM-DD
          // 売上
          store_sales: number        // 店内売上
          delivery_sales: number     // デリバリー売上（Uber Eats等）
          total_sales: number        // 合計売上
          // 客数
          store_orders: number       // 店内注文数
          delivery_orders: number    // デリバリー注文数
          // FL
          food_cost: number | null   // 食材費（発注データから）
          labor_cost: number | null  // 人件費（打刻から自動計算）
          // AI生成日報
          ai_comment: string | null  // AIが生成した一言コメント
          data_source: 'anydeli_excel' | 'manual' | 'api'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['daily_sales']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['daily_sales']['Insert']>
      }

      // ================================
      // 発注管理
      // ================================
      orders: {
        Row: {
          id: string
          tenant_id: string
          supplier_name: string      // 業者名
          supplier_contact: string | null // 電話/メール/LINE
          order_date: string         // YYYY-MM-DD
          delivery_date: string | null
          items: OrderItem[]         // JSONB
          total_amount: number | null
          status: 'draft' | 'sent' | 'delivered' | 'cancelled'
          sent_via: 'line' | 'email' | 'phone' | null
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['orders']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['orders']['Insert']>
      }
    }
  }
}

// ================================
// 補助型
// ================================
export type OrderItem = {
  name: string
  quantity: number
  unit: string      // e.g. "kg", "本", "袋"
  unit_price?: number
}

export type Staff = Database['public']['Tables']['staff']['Row']
export type Attendance = Database['public']['Tables']['attendance']['Row']
export type Shift = Database['public']['Tables']['shifts']['Row']
export type DailySales = Database['public']['Tables']['daily_sales']['Row']
export type Order = Database['public']['Tables']['orders']['Row']
