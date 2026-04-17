/**
 * シフト制約チェックエンジン
 * シフト確定時に自動で問題箇所を検出する
 */

export type StaffInfo = {
  id: string
  name: string
  skill_one_op: boolean
  skill_kitchen: boolean
  skill_open: boolean
  skill_close: boolean
}

export type Assignment = {
  staff_id: string
  start_time: string
  end_time: string
}

export type Violation = {
  type: 'error' | 'warning'
  message: string
}

// ================================
// NG組み合わせ（同日出勤禁止ペア）
// ================================
const NG_PAIRS: [string, string][] = [
  ['河野', '畑中'],
]

// ================================
// チェック実行
// ================================
export function checkConstraints(
  date: string,
  assignments: Assignment[],
  allStaff: StaffInfo[],
): Violation[] {
  const violations: Violation[] = []
  const staffMap = new Map(allStaff.map(s => [s.id, s]))

  // 出勤するスタッフ名のリスト
  const assignedNames = assignments
    .map(a => staffMap.get(a.staff_id)?.name ?? '')
    .filter(Boolean)

  const assignedStaff = assignments
    .map(a => staffMap.get(a.staff_id))
    .filter((s): s is StaffInfo => !!s)

  // ① NG組み合わせチェック
  for (const [name1, name2] of NG_PAIRS) {
    if (assignedNames.includes(name1) && assignedNames.includes(name2)) {
      violations.push({
        type: 'error',
        message: `🚫 ${name1}と${name2}は同日出勤NG`,
      })
    }
  }

  // ② ワンオペチェック（1人しかいない時間帯にワンオペ不可スタッフ）
  if (assignments.length === 1) {
    const solo = staffMap.get(assignments[0].staff_id)
    if (solo && !solo.skill_one_op) {
      violations.push({
        type: 'error',
        message: `⚠️ ${solo.name}さんはワンオペ不可ですが、この日は1人シフトです`,
      })
    }
  }

  // ③ 朝シフト（10時入り）にキッチン可能スタッフがいるか
  const morningStaff = assignments.filter(a => {
    const [h] = a.start_time.split(':').map(Number)
    return h <= 11
  })
  if (morningStaff.length > 0) {
    const hasKitchen = morningStaff.some(a => staffMap.get(a.staff_id)?.skill_kitchen)
    if (!hasKitchen) {
      violations.push({
        type: 'warning',
        message: `⚠️ 午前シフトにキッチン対応可能なスタッフがいません（仕込み対応不可）`,
      })
    }
  }

  // ④ 土日の夜（18時以降）に2人以上いるか
  const d = new Date(date)
  const dow = d.getDay()
  if (dow === 0 || dow === 6) {
    const eveningStaff = assignments.filter(a => {
      const [h] = a.start_time.split(':').map(Number)
      const [endH] = a.end_time.split(':').map(Number)
      return h <= 18 && endH >= 19
    })
    if (eveningStaff.length < 2 && assignments.length > 0) {
      violations.push({
        type: 'warning',
        message: `⚠️ 土日の夜18〜19時に2人以上推奨ですが、${eveningStaff.length}人です`,
      })
    }
  }

  // ⑤ 0人の日チェック
  if (assignments.length === 0) {
    violations.push({
      type: 'warning',
      message: `📋 この日は誰もシフトが入っていません`,
    })
  }

  return violations
}
