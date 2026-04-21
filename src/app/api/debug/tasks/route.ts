export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID ?? '(未設定)'

export async function GET() {
  const db = createServiceClient() as any
  const today = new Date().toISOString().split('T')[0]

  // task_logsの件数を確認
  const { data: logs, error: logErr } = await db
    .from('task_logs')
    .select('timing')
    .eq('tenant_id', TENANT_ID)
    .eq('date', today)

  // task_templatesの件数を確認
  const { data: templates, error: tplErr } = await db
    .from('task_templates')
    .select('timing')
    .eq('tenant_id', TENANT_ID)
    .eq('is_active', true)

  return NextResponse.json({
    TENANT_ID,
    today,
    task_logs_count: logs?.length ?? 0,
    task_templates_count: templates?.length ?? 0,
    log_error: logErr?.message ?? null,
    tpl_error: tplErr?.message ?? null,
  })
}
