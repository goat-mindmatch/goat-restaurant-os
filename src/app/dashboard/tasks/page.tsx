export const dynamic = 'force-dynamic'

/**
 * 仕込みタスク管理ページ
 * task_templates から当日分を自動生成し、チェックリスト形式で管理
 */

import { createServiceClient } from '@/lib/supabase'
import TasksClient from './TasksClient'

const TENANT_ID = process.env.TENANT_ID!

async function getTaskLogs(date: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  // 当日のtask_logsを確認
  const { data: existing, error } = await db
    .from('task_logs')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .eq('date', date)
    .order('timing')
    .order('created_at')

  if (error) return []

  // 既にログがあれば返す
  if (existing && existing.length > 0) return existing

  // なければテンプレートから自動生成
  const { data: templates } = await db
    .from('task_templates')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .eq('is_active', true)
    .order('timing')
    .order('order_index')

  if (!templates || templates.length === 0) return []

  const rows = templates.map((t: Record<string, unknown>) => ({
    tenant_id: TENANT_ID,
    template_id: t.id,
    date,
    title: t.title,
    timing: t.timing,
    completed_at: null,
  }))

  const { data: inserted } = await db
    .from('task_logs')
    .insert(rows)
    .select()

  return inserted ?? []
}

export default async function TasksPage() {
  const today = new Date().toISOString().split('T')[0]
  const logs = await getTaskLogs(today)

  const doneCount = logs.filter((l: { completed_at: string | null }) => l.completed_at).length
  const totalCount = logs.length

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="sr-only">
        {/* SEO用: 今日のタスク {doneCount}/{totalCount}件完了 */}
      </div>
      <TasksClient initialLogs={logs} date={today} />
    </main>
  )
}
