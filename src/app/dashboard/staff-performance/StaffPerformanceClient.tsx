'use client'

type PerfItem = {
  staff: { id: string; name: string; role: string; hourly_wage: number }
  totalDays: number
  totalHours: number
  reviewLeads: number
  reviewVerified: number
  reviewBonus: number
  score: number
}

export default function StaffPerformanceClient({ perf }: { perf: PerfItem[] }) {
  return (
    <div className="px-4 py-4 space-y-3">
      {/* 説明 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800">
        💡 スコア = 出勤貢献（40点）+ 労働時間（30点）+ 口コミ獲得（30点）
      </div>

      {perf.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-gray-400 text-sm">
          今月のデータがありません
        </div>
      ) : (
        perf.map((p, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
          const scoreColor = p.score >= 70 ? 'text-green-600' : p.score >= 40 ? 'text-yellow-600' : 'text-gray-400'
          const barColor = p.score >= 70 ? 'bg-green-400' : p.score >= 40 ? 'bg-yellow-400' : 'bg-gray-300'

          return (
            <div key={p.staff.id} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {medal && <span className="text-2xl">{medal}</span>}
                  {!medal && <span className="text-sm text-gray-400 w-8 text-center">{i + 1}位</span>}
                  <div>
                    <p className="font-bold text-gray-800">{p.staff.name}</p>
                    <p className="text-xs text-gray-400">{p.staff.role === 'manager' ? '経営者' : 'スタッフ'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-black ${scoreColor}`}>{p.score}</p>
                  <p className="text-[10px] text-gray-400">/ 100点</p>
                </div>
              </div>

              {/* スコアバー */}
              <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${p.score}%` }} />
              </div>

              {/* 3指標 */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-gray-800">{p.totalDays}</p>
                  <p className="text-[10px] text-gray-400">出勤日数</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-gray-800">{p.totalHours.toFixed(1)}</p>
                  <p className="text-[10px] text-gray-400">労働時間(h)</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-green-600">{p.reviewVerified}</p>
                  <p className="text-[10px] text-gray-400">口コミ獲得</p>
                </div>
              </div>

              {/* 口コミボーナス */}
              {p.reviewBonus > 0 && (
                <div className="mt-2 bg-green-50 border border-green-100 rounded-lg px-3 py-1.5 flex justify-between items-center">
                  <span className="text-xs text-green-700">口コミボーナス</span>
                  <span className="text-sm font-bold text-green-700">+¥{p.reviewBonus.toLocaleString()}</span>
                </div>
              )}

              {/* 誘導数・承認待ち */}
              {p.reviewLeads > p.reviewVerified && (
                <p className="text-[10px] text-gray-400 mt-1 text-right">
                  ({p.reviewLeads}誘導中 / 未承認{p.reviewLeads - p.reviewVerified}件)
                </p>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
