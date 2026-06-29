import { TrendingUp, TrendingDown } from 'lucide-react'

export default function StatCard({ title, value, subtitle, icon: Icon, trend, trendValue, color = 'navy' }) {
  const colorMap = {
    navy:  'from-navy-700 to-navy-900',
    gold:  'from-gold-500 to-gold-700',
    green: 'from-green-500 to-green-700',
    red:   'from-red-500 to-red-700',
    blue:  'from-blue-500 to-blue-700',
  }

  const iconBg = {
    navy:  'bg-navy-600/50',
    gold:  'bg-gold-400/30',
    green: 'bg-green-400/30',
    red:   'bg-red-400/30',
    blue:  'bg-blue-400/30',
  }

  return (
    <div className={`card p-5 bg-gradient-to-br ${colorMap[color]} text-white border-0 shadow-lg`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white/70 truncate">{title}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-white/60">{subtitle}</p>}

          {trendValue !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {trend === 'up'
                ? <TrendingUp size={14} className="text-green-300" />
                : <TrendingDown size={14} className="text-red-300" />
              }
              <span className={`text-xs font-medium ${trend === 'up' ? 'text-green-300' : 'text-red-300'}`}>
                {trendValue}
              </span>
            </div>
          )}
        </div>

        {Icon && (
          <div className={`p-3 rounded-xl ${iconBg[color]} shrink-0`}>
            <Icon size={22} className="text-white" />
          </div>
        )}
      </div>
    </div>
  )
}
