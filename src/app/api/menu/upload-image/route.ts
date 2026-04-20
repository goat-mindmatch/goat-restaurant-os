export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/menu/upload-image
 * メニュー商品の写真をSupabase Storageにアップロードし、公開URLを返す
 * multipart/form-data: { file: File, item_id?: string }
 *
 * Supabaseで事前に「menu-images」バケットを Public で作成しておくこと
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'ファイルが選択されていません' }, { status: 400 })

    // ファイルサイズ制限: 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: '画像サイズが5MBを超えています。圧縮してから再アップしてください。' }, { status: 400 })
    }

    // 拡張子チェック
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'JPG・PNG・WebP形式のみ対応しています' }, { status: 400 })
    }

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const fileName = `menu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
    const filePath = `public/${fileName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceClient() as any

    const { error: uploadError } = await supabase.storage
      .from('menu-images')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json({
        error: `アップロード失敗: ${uploadError.message}。Supabaseの「menu-images」バケットが存在するか確認してください。`,
      }, { status: 500 })
    }

    const { data: urlData } = supabase.storage
      .from('menu-images')
      .getPublicUrl(filePath)

    return NextResponse.json({ ok: true, url: urlData.publicUrl })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
