import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

/**
 * GET /api/tasks?date=YYYY-MM-DD
 * 指定日のtask_logsを返す。存在しない場合はtask_templatesから自動生成する。
 */
export async function GET(req: NextRequest) {
  const db = createServiceClient() as any
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0]

  // まず当日分のtask_logsを確認
  const { data: existing, error: fetchError } = await db
    .from('task_logs')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .eq('date', date)
    .order('timing')
    .order('created_at')

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  // 既にログがあればそのまま返す
  if (existing && existing.length > 0) {
    return NextResponse.json(existing)
  }

  // ログがなければ is_active=true のテンプレートから自動生成
  const { data: templates, error: tplError } = await db
    .from('task_templates')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .eq('is_active', true)
    .order('timing')
    .order('order_index')

  if (tplError) {
    return NextResponse.json({ error: tplError.message }, { status: 500 })
  }

  if (!templates || templates.length === 0) {
    return NextResponse.json([])
  }

  // task_logsにINSERT
  const rows = templates.map((t: any) => ({
    tenant_id: TENANT_ID,
    template_id: t.id,
    date,
    title: t.title,
    timing: t.timing,
    completed_at: null,
  }))

  const { data: inserted, error: insertError } = await db
    .from('task_logs')
    .insert(rows)
    .select()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json(inserted ?? [])
}

/**
 * POST /api/tasks
 * body: { title, timing, template_only?: boolean, date?: string }
 * template_only=true → task_templatesに追加（当日ログも生成）
 * template_only=false/省略 → 当日のtask_logsにのみ追加
 */
export async function POST(req: NextRequest) {
  const db = createServiceClient() as any
  const body = await req.json()
  const { title, timing = 'open', template_only = false, date } = body
  const targetDate = date ?? new Date().toISOString().split('T')[0]

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  if (template_only) {
    // テンプレートに追加
    const { data: tpl, error: tplErr } = await db
      .from('task_templates')
      .insert({ tenant_id: TENANT_ID, title, timing, order_index: 999 })
      .select()
      .single()

    if (tplErr) {
      return NextResponse.json({ error: tplErr.message }, { status: 500 })
    }

    // 当日ログにも追加
    const { data: log, error: logErr } = await db
      .from('task_logs')
      .insert({
        tenant_id: TENANT_ID,
        template_id: tpl.id,
        date: targetDate,
        title,
        timing,
      })
      .select()
      .single()

    if (logErr) {
      return NextResponse.json({ error: logErr.message }, { status: 500 })
    }

    return NextResponse.json({ template: tpl, log })
  } else {
    // 当日ログのみ追加
    const { data: log, error: logErr } = await db
      .from('task_logs')
      .insert({
        tenant_id: TENANT_ID,
        template_id: null,
        date: targetDate,
        title,
        timing,
      })
      .select()
      .single()

    if (logErr) {
      return NextResponse.json({ error: logErr.message }, { status: 500 })
    }

    return NextResponse.json({ log })
  }
}
