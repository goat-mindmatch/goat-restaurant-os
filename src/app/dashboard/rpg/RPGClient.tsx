'use client'

/**
 * スタッフRPG 統合クライアント（DQ風キャラクタービジュアル）
 * 評価スコアタブは廃止 → RPGランキング一本化
 */

import DashboardNav from '@/components/DashboardNav'
import type { StaffRPGData, TeamStats } from './page'

// ─── クラス定義 ─────────────────────────────────────────
const DQ_CLASSES = [
  {
    minLevel: 25,
    label: '人類みなまぜそば之神',
    shortLabel: '神',
    bgFrom: '#FFD700',
    bgTo: '#FF8C00',
    textColor: '#7B3F00',
    borderColor: '#FFD700',
    glowColor: 'rgba(255,215,0,0.8)',
    description: '全てを超越した存在。まぜそばと一体化した神。',
  },
  {
    minLevel: 18,
    label: '伝説のスタッフ',
    shortLabel: '伝説',
    bgFrom: '#6B21A8',
    bgTo: '#3B0764',
    textColor: '#E9D5FF',
    borderColor: '#A855F7',
    glowColor: 'rgba(168,85,247,0.7)',
    description: '店の伝説として語り継がれる存在。',
  },
  {
    minLevel: 12,
    label: '賢者',
    shortLabel: '賢者',
    bgFrom: '#1D4ED8',
    bgTo: '#1E3A5F',
    textColor: '#BFDBFE',
    borderColor: '#60A5FA',
    glowColor: 'rgba(96,165,250,0.7)',
    description: '経験と知恵を兼ね備えた達人。',
  },
  {
    minLevel: 7,
    label: '武闘家',
    shortLabel: '武闘',
    bgFrom: '#DC2626',
    bgTo: '#7F1D1D',
    textColor: '#FEE2E2',
    borderColor: '#F87171',
    glowColor: 'rgba(248,113,113,0.7)',
    description: 'どんな繁忙期も乗り越える戦士。',
  },
  {
    minLevel: 3,
    label: '僧侶',
    shortLabel: '僧侶',
    bgFrom: '#059669',
    bgTo: '#064E3B',
    textColor: '#D1FAE5',
    borderColor: '#34D399',
    glowColor: 'rgba(52,211,153,0.6)',
    description: 'チームを支える縁の下の力持ち。',
  },
  {
    minLevel: 1,
    label: '旅人',
    shortLabel: '旅人',
    bgFrom: '#6B7280',
    bgTo: '#374151',
    textColor: '#F3F4F6',
    borderColor: '#9CA3AF',
    glowColor: 'rgba(156,163,175,0.5)',
    description: '今、冒険が始まる。',
  },
]

function getDQClass(level: number) {
  return DQ_CLASSES.find(c => level >= c.minLevel) ?? DQ_CLASSES[DQ_CLASSES.length - 1]
}

// ─── キャラクターSVGポートレート ─────────────────────────
function CharacterPortrait({ level, size = 80 }: { level: number; size?: number }) {
  const cls = getDQClass(level)
  const s = size

  // 神（Lv25+）: 光輝く神様
  if (level >= 25) {
    return (
      <svg width={s} height={s} viewBox="0 0 80 80">
        {/* 光輪 */}
        <circle cx="40" cy="18" r="14" fill="none" stroke="#FFD700" strokeWidth="3" opacity="0.9"/>
        <circle cx="40" cy="18" r="10" fill="#FFF9C4"/>
        {/* 顔 */}
        <ellipse cx="40" cy="18" rx="8" ry="8" fill="#FFDEAD"/>
        <circle cx="37" cy="16" r="1.5" fill="#5D3A1A"/>
        <circle cx="43" cy="16" r="1.5" fill="#5D3A1A"/>
        <path d="M37,21 Q40,23 43,21" fill="none" stroke="#5D3A1A" strokeWidth="1.5" strokeLinecap="round"/>
        {/* 王冠 */}
        <polygon points="33,9 36,4 40,8 44,4 47,9 33,9" fill="#FFD700"/>
        <circle cx="36" cy="5" r="1.5" fill="#FF6B00"/>
        <circle cx="40" cy="9" r="1.5" fill="#FF6B00"/>
        <circle cx="44" cy="5" r="1.5" fill="#FF6B00"/>
        {/* 白いローブ */}
        <path d="M28,28 Q40,26 52,28 L55,60 Q40,64 25,60 Z" fill="white"/>
        {/* 金縁 */}
        <path d="M28,28 Q40,26 52,28" fill="none" stroke="#FFD700" strokeWidth="2"/>
        <path d="M30,35 Q40,33 50,35" fill="none" stroke="#FFD700" strokeWidth="1"/>
        {/* 手 */}
        <ellipse cx="23" cy="40" rx="5" ry="4" fill="#FFDEAD"/>
        <ellipse cx="57" cy="40" rx="5" ry="4" fill="#FFDEAD"/>
        {/* 光の玉 */}
        <circle cx="22" cy="40" r="4" fill="#FFD700" opacity="0.5"/>
        <circle cx="58" cy="40" r="4" fill="#FFD700" opacity="0.5"/>
        {/* 足 */}
        <rect x="33" y="60" width="6" height="10" rx="3" fill="white"/>
        <rect x="41" y="60" width="6" height="10" rx="3" fill="white"/>
        {/* 後光エフェクト */}
        {[0,45,90,135,180,225,270,315].map((angle, i) => (
          <line
            key={i}
            x1={40 + 16 * Math.cos((angle * Math.PI) / 180)}
            y1={18 + 16 * Math.sin((angle * Math.PI) / 180)}
            x2={40 + 24 * Math.cos((angle * Math.PI) / 180)}
            y2={18 + 24 * Math.sin((angle * Math.PI) / 180)}
            stroke="#FFD700"
            strokeWidth="2"
            opacity="0.6"
          />
        ))}
      </svg>
    )
  }

  // 伝説（Lv18+）: ドラゴン鎧の戦士
  if (level >= 18) {
    return (
      <svg width={s} height={s} viewBox="0 0 80 80">
        {/* オーラ */}
        <circle cx="40" cy="38" r="30" fill="none" stroke="#A855F7" strokeWidth="1" opacity="0.4"/>
        <circle cx="40" cy="38" r="26" fill="none" stroke="#A855F7" strokeWidth="1" opacity="0.3"/>
        {/* 兜 */}
        <path d="M25,20 Q40,8 55,20 L53,30 L27,30 Z" fill="#4B0082"/>
        <path d="M28,18 Q40,10 52,18" fill="none" stroke="#A855F7" strokeWidth="1.5"/>
        {/* 角 */}
        <polygon points="28,20 22,10 30,18" fill="#7C3AED"/>
        <polygon points="52,20 58,10 50,18" fill="#7C3AED"/>
        {/* 顔 */}
        <rect x="27" y="28" width="26" height="14" rx="4" fill="#FFDEAD"/>
        <circle cx="35" cy="33" r="2.5" fill="#1a1a1a"/>
        <circle cx="45" cy="33" r="2.5" fill="#1a1a1a"/>
        <circle cx="36" cy="32" r="1" fill="white"/>
        <circle cx="46" cy="32" r="1" fill="white"/>
        <path d="M36,38 Q40,41 44,38" fill="none" stroke="#5D3A1A" strokeWidth="1.5" strokeLinecap="round"/>
        {/* 鎧 */}
        <path d="M22,42 Q40,38 58,42 L60,68 Q40,72 20,68 Z" fill="#4B0082"/>
        <path d="M30,42 L30,65" stroke="#7C3AED" strokeWidth="1" opacity="0.7"/>
        <path d="M50,42 L50,65" stroke="#7C3AED" strokeWidth="1" opacity="0.7"/>
        <path d="M22,52 Q40,48 58,52" fill="none" stroke="#A855F7" strokeWidth="1.5"/>
        {/* 剣 */}
        <rect x="60" y="30" width="3" height="30" rx="1" fill="#C0C0C0"/>
        <rect x="57" y="38" width="9" height="3" rx="1" fill="#8B4513"/>
        <polygon points="60,28 61.5,30 63,28" fill="#FFD700"/>
        {/* 盾 */}
        <path d="M14,35 L20,32 L26,35 L26,50 Q20,54 14,50 Z" fill="#4B0082" stroke="#A855F7" strokeWidth="1"/>
        <text x="20" y="46" textAnchor="middle" fontSize="7" fill="#A855F7">⬡</text>
        {/* 足 */}
        <rect x="28" y="66" width="10" height="8" rx="2" fill="#3B0764"/>
        <rect x="42" y="66" width="10" height="8" rx="2" fill="#3B0764"/>
      </svg>
    )
  }

  // 賢者（Lv12+）: 魔法使い
  if (level >= 12) {
    return (
      <svg width={s} height={s} viewBox="0 0 80 80">
        {/* 星エフェクト */}
        {[[15,15],[65,20],[10,55],[70,50],[40,8]].map(([x,y], i) => (
          <text key={i} x={x} y={y} fontSize="8" fill="#60A5FA" opacity={0.7 - i * 0.1}>✦</text>
        ))}
        {/* 帽子 */}
        <polygon points="40,4 20,32 60,32" fill="#1D4ED8"/>
        <rect x="16" y="30" width="48" height="5" rx="2" fill="#2563EB"/>
        {/* 帽子の星 */}
        <text x="34" y="25" fontSize="10" fill="#60A5FA">✦</text>
        {/* 顔 */}
        <ellipse cx="40" cy="40" rx="11" ry="12" fill="#FFDEAD"/>
        <circle cx="36" cy="38" r="2" fill="#1E3A5F"/>
        <circle cx="44" cy="38" r="2" fill="#1E3A5F"/>
        <circle cx="37" cy="37" r="0.8" fill="white"/>
        <circle cx="45" cy="37" r="0.8" fill="white"/>
        {/* 眉毛（白） */}
        <path d="M34,34 Q36,32 38,34" fill="none" stroke="white" strokeWidth="1.5"/>
        <path d="M42,34 Q44,32 46,34" fill="none" stroke="white" strokeWidth="1.5"/>
        <path d="M37,43 Q40,45 43,43" fill="none" stroke="#5D3A1A" strokeWidth="1.2"/>
        {/* ローブ */}
        <path d="M24,52 Q40,48 56,52 L58,72 Q40,76 22,72 Z" fill="#1D4ED8"/>
        {/* ローブ模様 */}
        <path d="M26,58 Q40,55 54,58" fill="none" stroke="#60A5FA" strokeWidth="1"/>
        <path d="M25,64 Q40,61 55,64" fill="none" stroke="#60A5FA" strokeWidth="1"/>
        {/* 杖 */}
        <rect x="58" y="36" width="2.5" height="36" rx="1" fill="#8B4513"/>
        <circle cx="59" cy="34" r="5" fill="#1D4ED8" opacity="0.8"/>
        <circle cx="59" cy="34" r="3" fill="#60A5FA"/>
        <circle cx="59" cy="34" r="1.5" fill="white"/>
        {/* 手 */}
        <ellipse cx="22" cy="58" rx="5" ry="4" fill="#FFDEAD"/>
        {/* 足 */}
        <rect x="31" y="70" width="8" height="6" rx="2" fill="#1E3A5F"/>
        <rect x="41" y="70" width="8" height="6" rx="2" fill="#1E3A5F"/>
      </svg>
    )
  }

  // 武闘家（Lv7+）: 格闘家
  if (level >= 7) {
    return (
      <svg width={s} height={s} viewBox="0 0 80 80">
        {/* 気合エフェクト */}
        {[[-30,0],[30,0],[0,-30]].map(([dx,dy], i) => (
          <line key={i} x1={40} y1={40} x2={40+dx} y2={40+dy} stroke="#F87171" strokeWidth="2" opacity="0.3"/>
        ))}
        {/* 頭 */}
        <ellipse cx="40" cy="20" rx="11" ry="11" fill="#FFDEAD"/>
        <circle cx="36" cy="18" r="2" fill="#5D3A1A"/>
        <circle cx="44" cy="18" r="2" fill="#5D3A1A"/>
        <path d="M37,24 Q40,26 43,24" fill="none" stroke="#5D3A1A" strokeWidth="1.5" strokeLinecap="round"/>
        {/* ハチマキ */}
        <rect x="29" y="12" width="22" height="5" rx="2" fill="#DC2626"/>
        <path d="M51,14 L58,10 M51,16 L58,22" stroke="#DC2626" strokeWidth="2" strokeLinecap="round"/>
        {/* 道着（上） */}
        <path d="M24,32 L40,28 L56,32 L58,50 L40,54 L22,50 Z" fill="white"/>
        <path d="M40,28 L40,54" stroke="#DC2626" strokeWidth="1.5"/>
        <path d="M26,30 Q33,36 36,50" fill="none" stroke="#ccc" strokeWidth="1"/>
        <path d="M54,30 Q47,36 44,50" fill="none" stroke="#ccc" strokeWidth="1"/>
        {/* 帯 */}
        <rect x="25" y="48" width="30" height="5" rx="1" fill="#DC2626"/>
        {/* 腕（構え） */}
        <path d="M22,34 L10,28" stroke="#FFDEAD" strokeWidth="8" strokeLinecap="round"/>
        <path d="M58,34 L68,42" stroke="#FFDEAD" strokeWidth="8" strokeLinecap="round"/>
        {/* グローブ */}
        <circle cx="10" cy="27" r="6" fill="#DC2626"/>
        <circle cx="68" cy="43" r="6" fill="#DC2626"/>
        {/* 足 */}
        <rect x="27" y="53" width="12" height="18" rx="3" fill="white"/>
        <rect x="41" y="53" width="12" height="18" rx="3" fill="white"/>
        <rect x="27" y="65" width="12" height="6" rx="2" fill="#DC2626"/>
        <rect x="41" y="65" width="12" height="6" rx="2" fill="#DC2626"/>
      </svg>
    )
  }

  // 僧侶（Lv3+）: ヒーラー
  if (level >= 3) {
    return (
      <svg width={s} height={s} viewBox="0 0 80 80">
        {/* 癒しオーラ */}
        <circle cx="40" cy="40" r="35" fill="none" stroke="#34D399" strokeWidth="1" opacity="0.3"/>
        {/* 頭 */}
        <ellipse cx="40" cy="20" rx="10" ry="11" fill="#FFDEAD"/>
        <circle cx="36" cy="19" r="2" fill="#059669"/>
        <circle cx="44" cy="19" r="2" fill="#059669"/>
        <path d="M37,24 Q40,26 43,24" fill="none" stroke="#5D3A1A" strokeWidth="1.2" strokeLinecap="round"/>
        {/* フード */}
        <path d="M30,12 Q40,6 50,12 L50,24 Q40,20 30,24 Z" fill="#059669"/>
        {/* ローブ */}
        <path d="M22,30 Q40,26 58,30 L60,70 Q40,74 20,70 Z" fill="#059669"/>
        <path d="M30,30 Q36,50 33,68" fill="none" stroke="#34D399" strokeWidth="1" opacity="0.6"/>
        <path d="M50,30 Q44,50 47,68" fill="none" stroke="#34D399" strokeWidth="1" opacity="0.6"/>
        {/* 手 */}
        <ellipse cx="20" cy="44" rx="5" ry="4" fill="#FFDEAD"/>
        <ellipse cx="60" cy="44" rx="5" ry="4" fill="#FFDEAD"/>
        {/* 十字 */}
        <rect x="38" y="36" width="4" height="12" rx="2" fill="white" opacity="0.9"/>
        <rect x="34" y="40" width="12" height="4" rx="2" fill="white" opacity="0.9"/>
        {/* 癒し粒子 */}
        {[[20,30],[60,30],[15,60],[65,60]].map(([x,y], i) => (
          <circle key={i} cx={x} cy={y} r="2" fill="#34D399" opacity="0.6"/>
        ))}
      </svg>
    )
  }

  // 旅人（Lv1+）: 冒険者
  return (
    <svg width={s} height={s} viewBox="0 0 80 80">
      {/* 頭 */}
      <ellipse cx="40" cy="20" rx="10" ry="11" fill="#FFDEAD"/>
      <circle cx="36" cy="19" r="2" fill="#5D3A1A"/>
      <circle cx="44" cy="19" r="2" fill="#5D3A1A"/>
      <path d="M37,24 Q40,26 43,24" fill="none" stroke="#5D3A1A" strokeWidth="1.2" strokeLinecap="round"/>
      {/* 帽子 */}
      <path d="M30,14 Q40,8 50,14" fill="none" stroke="#8B4513" strokeWidth="3" strokeLinecap="round"/>
      <ellipse cx="40" cy="14" rx="12" ry="3" fill="#8B4513"/>
      {/* 服 */}
      <path d="M28,32 Q40,28 52,32 L53,58 Q40,62 27,58 Z" fill="#92400E"/>
      <path d="M36,32 L36,58" stroke="#78350F" strokeWidth="1"/>
      <path d="M44,32 L44,58" stroke="#78350F" strokeWidth="1"/>
      {/* 腕 */}
      <path d="M28,34 L18,44" stroke="#FFDEAD" strokeWidth="7" strokeLinecap="round"/>
      <path d="M52,34 L62,44" stroke="#FFDEAD" strokeWidth="7" strokeLinecap="round"/>
      {/* 荷物（リュック） */}
      <rect x="52" y="30" width="14" height="16" rx="3" fill="#78350F"/>
      <rect x="54" y="28" width="10" height="4" rx="2" fill="#92400E"/>
      {/* 剣（初心者用） */}
      <rect x="16" y="30" width="2.5" height="20" rx="1" fill="#9CA3AF"/>
      <rect x="12" y="36" width="11" height="2.5" rx="1" fill="#78350F"/>
      {/* 足 */}
      <rect x="29" y="58" width="10" height="12" rx="3" fill="#78350F"/>
      <rect x="41" y="58" width="10" height="12" rx="3" fill="#78350F"/>
    </svg>
  )
}

// ─── EXPバー ──────────────────────────────────────────
function ExpBar({ exp, level }: { exp: number; level: number }) {
  const currentLevelExp = (level - 1) * 1000
  const nextLevelExp    = level * 1000
  const progress = Math.min(100, Math.round(((exp - currentLevelExp) / (nextLevelExp - currentLevelExp)) * 100))
  const remaining = nextLevelExp - exp
  const cls = getDQClass(level)

  return (
    <div>
      <div className="flex justify-between text-[10px] mb-1" style={{ color: cls.textColor, opacity: 0.8 }}>
        <span>{exp.toLocaleString()} EXP</span>
        <span>次Lvまで {remaining.toLocaleString()}</span>
      </div>
      <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)' }}>
        <div
          className="h-3 rounded-full transition-all"
          style={{
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${cls.bgFrom}, ${cls.bgTo})`,
            boxShadow: `0 0 8px ${cls.glowColor}`,
          }}
        />
      </div>
    </div>
  )
}

// ─── TOP1 専用カード（大きく表示）────────────────────────
function ChampionCard({ staff }: { staff: StaffRPGData }) {
  const cls = getDQClass(staff.level)

  return (
    <div
      className="rounded-3xl p-5 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${cls.bgFrom}22, #0a0a1a 60%, ${cls.bgTo}33)`,
        border: `2px solid ${cls.borderColor}`,
        boxShadow: `0 0 30px ${cls.glowColor}, 0 0 60px ${cls.glowColor}44`,
      }}
    >
      {/* タイトル行 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-black px-3 py-1 rounded-full"
            style={{ background: cls.borderColor, color: cls.textColor }}
          >
            👑 1位
          </span>
          <span className="text-xs font-bold" style={{ color: cls.borderColor }}>{cls.label}</span>
        </div>
        <div
          className="text-3xl font-black"
          style={{ color: cls.borderColor, textShadow: `0 0 12px ${cls.borderColor}` }}
        >
          Lv.{staff.level}
        </div>
      </div>

      {/* キャラクター + 情報 */}
      <div className="flex items-center gap-4">
        {/* キャラクターポートレート */}
        <div
          className="shrink-0 rounded-2xl flex items-center justify-center p-2"
          style={{
            width: 100, height: 100,
            background: `radial-gradient(circle, ${cls.bgFrom}44 0%, transparent 70%)`,
            border: `1px solid ${cls.borderColor}66`,
            boxShadow: `0 0 20px ${cls.glowColor}`,
          }}
        >
          <CharacterPortrait level={staff.level} size={80} />
        </div>

        {/* ステータス */}
        <div className="flex-1">
          <p className="text-xl font-black text-white mb-0.5">{staff.name}</p>
          <p className="text-xs mb-3" style={{ color: cls.borderColor }}>{cls.description}</p>

          <div className="flex gap-3 mb-3">
            <div className="text-center">
              <p className="text-lg font-black text-white">{staff.monthlyReviews}</p>
              <p className="text-[10px] text-gray-400">口コミ</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-black text-white">{staff.workDays}</p>
              <p className="text-[10px] text-gray-400">出勤日</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-black text-white">{staff.exp.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400">EXP</p>
            </div>
          </div>

          <ExpBar exp={staff.exp} level={staff.level} />
        </div>
      </div>

      {/* バッジ */}
      {staff.badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {staff.badges.map(b => (
            <span
              key={b}
              className="text-[10px] px-2 py-0.5 rounded-full font-bold"
              style={{ background: cls.borderColor, color: cls.textColor }}
            >
              {b}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 通常ランクカード ─────────────────────────────────
function RankCard({ staff }: { staff: StaffRPGData }) {
  const cls = getDQClass(staff.level)
  const rankEmoji = staff.rank === 2 ? '🥈' : staff.rank === 3 ? '🥉' : `#${staff.rank}`

  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-3"
      style={{
        background: `linear-gradient(135deg, ${cls.bgFrom}18, #0d0d1a 70%, ${cls.bgTo}22)`,
        border: `1.5px solid ${cls.borderColor}88`,
        boxShadow: `0 0 12px ${cls.glowColor}44`,
      }}
    >
      {/* キャラクタービジュアル（小） */}
      <div
        className="shrink-0 rounded-xl flex items-center justify-center"
        style={{
          width: 64, height: 64,
          background: `radial-gradient(circle, ${cls.bgFrom}33 0%, transparent 80%)`,
          border: `1px solid ${cls.borderColor}55`,
        }}
      >
        <CharacterPortrait level={staff.level} size={52} />
      </div>

      {/* 情報 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-base">{rankEmoji}</span>
            <span className="font-bold text-white text-sm">{staff.name}</span>
          </div>
          <span
            className="text-sm font-black"
            style={{ color: cls.borderColor }}
          >
            Lv.{staff.level}
          </span>
        </div>
        <p className="text-[10px] mb-2" style={{ color: cls.borderColor }}>{cls.label}</p>

        <div className="flex gap-3 mb-2">
          <span className="text-xs text-gray-400">⭐ <strong className="text-white">{staff.monthlyReviews}</strong>件</span>
          <span className="text-xs text-gray-400">📅 <strong className="text-white">{staff.workDays}</strong>日</span>
          <span className="text-xs text-gray-400">EXP <strong className="text-white">{staff.exp.toLocaleString()}</strong></span>
        </div>

        <ExpBar exp={staff.exp} level={staff.level} />

        {/* スキルドット */}
        <div className="flex gap-3 mt-2">
          <SkillDots level={staff.skillService} color="#F59E0B" label="接客" />
          <SkillDots level={staff.skillAttend}  color="#34D399" label="出勤" />
          <SkillDots level={staff.skillTeam}    color="#60A5FA" label="チーム" />
        </div>
      </div>
    </div>
  )
}

// ─── スキルドット ─────────────────────────────────────
function SkillDots({ level, color, label }: { level: number; color: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <span
            key={i}
            className="w-2 h-2 rounded-full inline-block"
            style={{ background: i <= level ? color : 'rgba(255,255,255,0.1)' }}
          />
        ))}
      </div>
      <span className="text-[9px] text-gray-500">{label}</span>
    </div>
  )
}

// ─── チームチャレンジ ─────────────────────────────────
function TeamChallenge({ stats }: { stats: TeamStats }) {
  const reviewPct = Math.min(100, Math.round((stats.totalReviews / stats.reviewGoal) * 100))
  const onTimePct = stats.totalStaff > 0 ? Math.round((stats.onTimeCount / stats.totalStaff) * 100) : 0
  const expPct    = Math.min(100, Math.round((stats.teamExp / stats.teamExpGoal) * 100))

  const rows = [
    { label: '今月の口コミ', value: `${stats.totalReviews}/${stats.reviewGoal}件`, pct: reviewPct, color: '#F59E0B' },
    { label: '遅刻ゼロメンバー', value: `${stats.onTimeCount}/${stats.totalStaff}名`, pct: onTimePct, color: '#34D399' },
    { label: 'チームEXP',  value: `${stats.teamExp.toLocaleString()}/${stats.teamExpGoal.toLocaleString()}`, pct: expPct, color: '#60A5FA' },
  ]

  return (
    <div
      className="rounded-2xl p-4 mb-4"
      style={{ background: 'linear-gradient(135deg, #1a0a3a, #0a1a2a)', border: '1.5px solid rgba(168,85,247,0.4)' }}
    >
      <p className="text-sm font-black text-white mb-3">🏆 チームチャレンジ</p>
      <div className="space-y-3">
        {rows.map(row => (
          <div key={row.label}>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-gray-300">{row.label}</span>
              <span className="font-bold" style={{ color: row.color }}>{row.value}</span>
            </div>
            <div className="w-full rounded-full h-2.5" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-2.5 rounded-full transition-all"
                style={{ width: `${row.pct}%`, background: row.color, boxShadow: `0 0 6px ${row.color}88` }}
              />
            </div>
          </div>
        ))}
      </div>
      {onTimePct >= 80 && reviewPct >= 80 && (
        <div className="mt-3 text-[11px] text-center text-yellow-300 font-bold">
          ✨ このペースなら今月のチームボーナス達成圏内！
        </div>
      )}
    </div>
  )
}

// ─── デイリーミッション ───────────────────────────────
const DAILY_MISSIONS = [
  { icon: '⭐', title: '口コミを1件獲得する', exp: 150, hint: 'お客様にQRを渡してみよう' },
  { icon: '🕐', title: '定時に出勤する',       exp: 100, hint: 'シフト開始5分前には準備完了' },
  { icon: '📋', title: 'タスクを3つ完了する',   exp: 150, hint: '仕込みリストをチェック' },
]

function DailyMissions() {
  return (
    <div
      className="rounded-2xl p-4 mb-4"
      style={{ background: 'linear-gradient(135deg, #0a1a0a, #0a1a2a)', border: '1.5px solid rgba(52,211,153,0.3)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-black text-white">📜 今日のミッション</p>
        <span className="text-[10px] text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">毎日リセット</span>
      </div>
      <div className="space-y-2">
        {DAILY_MISSIONS.map((m, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl p-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <span className="text-2xl shrink-0">{m.icon}</span>
            <div className="flex-1">
              <p className="text-xs font-bold text-white">{m.title}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{m.hint}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-black text-yellow-400">+{m.exp}</p>
              <p className="text-[9px] text-gray-500">EXP</p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-600 text-center mt-3">
        ※ ミッション達成は打刻・タスク・口コミが自動で集計されます
      </p>
    </div>
  )
}

// ─── 報酬ロードマップ ─────────────────────────────────
const REWARDS = [
  { level: 5,  icon: '🎯', title: '好きなシフト優先権', desc: '1日分のシフト希望が100%通る', color: '#34D399' },
  { level: 10, icon: '🍜', title: '店長とのランチ',     desc: 'メニューは何でもOK、好きな話をしよう', color: '#60A5FA' },
  { level: 15, icon: '🎌', title: '特別休暇1日',        desc: '希望日に特別休暇取得権', color: '#F59E0B' },
  { level: 20, icon: '💰', title: '時給 +¥50（1ヶ月）', desc: '翌月の給与に反映', color: '#A855F7' },
  { level: 25, icon: '👑', title: '伝説ボーナス ¥10,000', desc: '神クラス到達の証', color: '#FFD700' },
]

function RewardRoadmap({ staffList }: { staffList: StaffRPGData[] }) {
  return (
    <div className="mb-4">
      <p className="text-xs text-gray-500 mb-3 px-1">🎁 報酬ロードマップ</p>
      <div className="relative">
        {/* 縦ライン */}
        <div className="absolute left-7 top-4 bottom-4 w-0.5 bg-gray-800" />

        <div className="space-y-3">
          {REWARDS.map(r => {
            const achieved = staffList.filter(s => s.level >= r.level).length
            const isAny = achieved > 0
            return (
              <div key={r.level} className="flex items-start gap-3">
                {/* レベルバッジ */}
                <div
                  className="shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center z-10"
                  style={{
                    background: isAny ? `${r.color}22` : 'rgba(255,255,255,0.04)',
                    border: `2px solid ${isAny ? r.color : 'rgba(255,255,255,0.1)'}`,
                    boxShadow: isAny ? `0 0 12px ${r.color}44` : 'none',
                  }}
                >
                  <span className="text-xl">{isAny ? r.icon : '🔒'}</span>
                  <span className="text-[9px] font-black mt-0.5" style={{ color: isAny ? r.color : '#4b5563' }}>
                    Lv{r.level}
                  </span>
                </div>
                {/* テキスト */}
                <div className="flex-1 rounded-xl p-3" style={{
                  background: isAny ? `${r.color}0a` : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isAny ? `${r.color}33` : 'rgba(255,255,255,0.06)'}`,
                }}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black" style={{ color: isAny ? r.color : '#6b7280' }}>{r.title}</p>
                    {achieved > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                        style={{ background: `${r.color}22`, color: r.color }}>
                        {achieved}名達成
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">{r.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── クラス図鑑 ──────────────────────────────────────
function ClassGuide() {
  return (
    <div className="mt-6">
      <p className="text-xs text-gray-500 mb-3 px-1">⚔️ クラス図鑑</p>
      <div className="space-y-2">
        {DQ_CLASSES.map(cls => (
          <div
            key={cls.label}
            className="flex items-center gap-3 rounded-xl p-3"
            style={{ background: `${cls.bgFrom}18`, border: `1px solid ${cls.borderColor}44` }}
          >
            <div
              className="shrink-0 rounded-lg flex items-center justify-center"
              style={{ width: 44, height: 44, background: `${cls.bgFrom}33` }}
            >
              <CharacterPortrait level={cls.minLevel} size={38} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold" style={{ color: cls.borderColor }}>{cls.label}</p>
                <p className="text-xs text-gray-500">Lv{cls.minLevel}+</p>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{cls.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── メインコンポーネント ─────────────────────────────
type Props = {
  staffList: StaffRPGData[]
  currentMonth: string
  teamStats: TeamStats
}

export default function RPGClient({ staffList, currentMonth, teamStats }: Props) {
  return (
    <div className="min-h-screen pb-24" style={{ background: '#060818' }}>
      {/* ヘッダー */}
      <div
        className="px-4 pt-12 pb-5"
        style={{
          background: 'linear-gradient(180deg, #0f0535 0%, #060818 100%)',
          borderBottom: '1px solid rgba(168,85,247,0.3)',
        }}
      >
        <h1 className="text-xl font-black tracking-tight text-white">⚔️ スタッフRPG</h1>
        <p className="text-sm text-purple-300 mt-0.5">{currentMonth} / 全{staffList.length}名</p>

        {/* EXP凡例 */}
        <div className="flex flex-wrap gap-3 mt-3 text-[10px] text-gray-400">
          <span>出勤1日 = 50 EXP</span>
          <span>口コミ1件 = 150 EXP</span>
          <span>遅刻ゼロ週 = 100 EXP</span>
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* チームチャレンジ */}
        <TeamChallenge stats={teamStats} />

        {/* デイリーミッション */}
        <DailyMissions />

        {staffList.length === 0 ? (
          <div className="text-center text-gray-500 py-16">
            <p className="text-5xl mb-3">🎮</p>
            <p className="text-sm">スタッフデータがありません</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-500 px-1">🏅 今月のランキング</p>

            {/* 1位 — チャンピオンカード */}
            {staffList[0] && <ChampionCard staff={staffList[0]} />}

            {/* 2位以下 */}
            {staffList.slice(1).map(s => (
              <RankCard key={s.staffId} staff={s} />
            ))}

            {/* 報酬ロードマップ */}
            <div className="mt-4">
              <RewardRoadmap staffList={staffList} />
            </div>

            {/* クラス図鑑 */}
            <ClassGuide />
          </div>
        )}
      </div>

      <DashboardNav current="/dashboard/rpg" />
    </div>
  )
}
