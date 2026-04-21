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
          monthly_target: number | null // 月間売上目標
          change_fund: number | null    // つり銭準備金（デフォルト100,000）
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
          // 売上（店内）
          store_sales: number        // 店内売上
          // デリバリー各媒体
          // AnyDeli モバイルオーダー
          anydeli_sales: number | null        // AnyDeli 総売上（現金+オンライン）
          anydeli_orders: number | null       // AnyDeli 総注文数
          anydeli_cash_sales: number | null   // AnyDeli 現金売上
          anydeli_online_sales: number | null // AnyDeli オンライン売上（PayPay/クレカ）
          anydeli_synced_at: string | null    // AnyDeli 最終同期日時
          // キャッシュレジスター照合
          cash_register_photo_url: string | null  // 現金写真URL
          cash_register_actual: number | null     // 実際のレジ内金額（AI読み取り）
          cash_register_diff: number | null       // 差額（実際 - 想定）
          cash_register_checked_at: string | null // 照合実施日時
          // デリバリー各媒体
          uber_sales: number | null       // Uber Eats 売上
          uber_orders: number | null      // Uber Eats 注文数
          uber_synced_at: string | null   // Uber Eats 最終同期日時
          rocketnow_sales: number | null  // ロケットナウ 売上
          rocketnow_orders: number | null // ロケットナウ 注文数
          rocketnow_synced_at: string | null // ロケットナウ 最終同期日時
          menu_sales: number | null       // menu 売上
          menu_orders: number | null      // menu 注文数
          menu_synced_at: string | null   // menu 最終同期日時
          // デリバリー合計
          delivery_sales: number     // デリバリー売上合計（全媒体）
          total_sales: number        // 合計売上（店内＋デリバリー）
          // 客数
          store_orders: number       // 店内注文数
          delivery_orders: number    // デリバリー注文数合計
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
