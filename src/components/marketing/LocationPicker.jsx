import { useState, useRef, useEffect } from 'react'
import { ChevronDown, ChevronRight, MapPin, X, Globe } from 'lucide-react'
import { EGYPT_LOCATIONS, allDistrictKeys } from '../../data/egyptLocations'
import { useLang } from '../../contexts/LanguageContext'

// selection: Set of strings like "cairo::nasr_city"
// onChange(newSet): called whenever selection changes
export default function LocationPicker({ selection, onChange }) {
  const { lang, t } = useLang()
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState({})  // govKey → boolean
  const panelRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const toggle = (key) => {
    const next = new Set(selection)
    next.has(key) ? next.delete(key) : next.add(key)
    onChange(next)
  }

  // Toggle all districts of a governorate
  const toggleGov = (govKey) => {
    const distKeys = Object.keys(EGYPT_LOCATIONS[govKey].districts).map(d => `${govKey}::${d}`)
    const allSelected = distKeys.every(k => selection.has(k))
    const next = new Set(selection)
    if (allSelected) {
      distKeys.forEach(k => next.delete(k))
    } else {
      distKeys.forEach(k => next.add(k))
    }
    onChange(next)
  }

  // "All Egypt" toggle
  const toggleAll = () => {
    const all = allDistrictKeys()
    const allSelected = all.every(k => selection.has(k))
    onChange(allSelected ? new Set() : new Set(all))
  }

  // Check state helpers
  const govState = (govKey) => {
    const distKeys = Object.keys(EGYPT_LOCATIONS[govKey].districts).map(d => `${govKey}::${d}`)
    const selectedCount = distKeys.filter(k => selection.has(k)).length
    if (selectedCount === 0) return 'none'
    if (selectedCount === distKeys.length) return 'all'
    return 'partial'
  }

  const allKeys = allDistrictKeys()
  const allEgyptState = allKeys.every(k => selection.has(k)) ? 'all'
    : allKeys.some(k => selection.has(k)) ? 'partial' : 'none'

  // Build tags for selected items — group by governorate
  const selectedTags = []
  for (const govKey of Object.keys(EGYPT_LOCATIONS)) {
    const gov = EGYPT_LOCATIONS[govKey]
    const distKeys = Object.keys(gov.districts).map(d => `${govKey}::${d}`)
    const selectedDists = distKeys.filter(k => selection.has(k))
    if (selectedDists.length === 0) continue
    if (selectedDists.length === distKeys.length) {
      // Whole governorate selected → one tag
      selectedTags.push({ key: `gov::${govKey}`, label: gov[lang], govKey, distKey: null })
    } else {
      // Individual districts
      selectedDists.forEach(k => {
        const distKey = k.split('::')[1]
        selectedTags.push({ key: k, label: gov.districts[distKey][lang], govKey, distKey })
      })
    }
  }

  const removeTag = ({ key, govKey, distKey }) => {
    if (distKey === null) {
      // Remove entire governorate
      const next = new Set(selection)
      Object.keys(EGYPT_LOCATIONS[govKey].districts).forEach(d => next.delete(`${govKey}::${d}`))
      onChange(next)
    } else {
      toggle(key)
    }
  }

  const label = selection.size === 0
    ? (lang === 'ar' ? 'اختر المناطق...' : 'Select locations...')
    : lang === 'ar'
      ? `${selection.size} منطقة محددة`
      : `${selection.size} area${selection.size > 1 ? 's' : ''} selected`

  return (
    <div className="space-y-2" ref={panelRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border
                   border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800
                   text-sm text-gray-700 dark:text-white hover:border-gold-400 transition-colors"
      >
        <span className="flex items-center gap-2">
          <MapPin size={15} className="text-gold-500 shrink-0" />
          <span className={selection.size === 0 ? 'text-gray-400 dark:text-navy-500' : ''}>
            {label}
          </span>
        </span>
        <ChevronDown size={15} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 mt-1 w-full max-w-sm rounded-xl border border-gray-200 dark:border-navy-700
                        bg-white dark:bg-navy-900 shadow-2xl overflow-hidden"
             style={{ maxHeight: '380px', overflowY: 'auto' }}>
          {/* All Egypt */}
          <div
            onClick={toggleAll}
            className="flex items-center gap-2.5 px-4 py-3 cursor-pointer hover:bg-gold-50 dark:hover:bg-gold-900/10
                       border-b border-gray-100 dark:border-navy-800 sticky top-0 bg-white dark:bg-navy-900 z-10"
          >
            <Checkbox state={allEgyptState} />
            <Globe size={14} className="text-gold-500" />
            <span className="font-semibold text-sm text-gray-800 dark:text-white">
              {lang === 'ar' ? 'جميع أنحاء مصر' : 'All of Egypt'}
            </span>
          </div>

          {/* Governorates */}
          {Object.entries(EGYPT_LOCATIONS).map(([govKey, gov]) => {
            const state   = govState(govKey)
            const isExpanded = !!expanded[govKey]
            const distEntries = Object.entries(gov.districts)

            return (
              <div key={govKey} className="border-b border-gray-50 dark:border-navy-800 last:border-0">
                {/* Governorate row */}
                <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-navy-800 group">
                  {/* Checkbox area */}
                  <div onClick={() => toggleGov(govKey)} className="cursor-pointer">
                    <Checkbox state={state} />
                  </div>
                  {/* Label + expand toggle */}
                  <button
                    type="button"
                    onClick={() => setExpanded(prev => ({ ...prev, [govKey]: !prev[govKey] }))}
                    className="flex-1 flex items-center justify-between text-start"
                  >
                    <span className="text-sm font-medium text-gray-700 dark:text-navy-200">{gov[lang]}</span>
                    <span className="flex items-center gap-1">
                      {state !== 'none' && (
                        <span className="text-xs text-gold-500 font-semibold">
                          {Object.keys(gov.districts).filter(d => selection.has(`${govKey}::${d}`)).length}/{distEntries.length}
                        </span>
                      )}
                      {isExpanded
                        ? <ChevronDown size={13} className="text-gray-400" />
                        : <ChevronRight size={13} className="text-gray-400" />
                      }
                    </span>
                  </button>
                </div>

                {/* Districts */}
                {isExpanded && (
                  <div className="bg-gray-50 dark:bg-navy-950/50">
                    {distEntries.map(([distKey, dist]) => {
                      const fullKey = `${govKey}::${distKey}`
                      return (
                        <div
                          key={distKey}
                          onClick={() => toggle(fullKey)}
                          className={`flex items-center gap-2.5 ps-8 pe-4 py-2 cursor-pointer text-sm transition-colors
                                      hover:bg-gold-50 dark:hover:bg-gold-900/10 ${
                            selection.has(fullKey)
                              ? 'text-gold-700 dark:text-gold-400'
                              : 'text-gray-600 dark:text-navy-300'
                          }`}
                        >
                          <Checkbox state={selection.has(fullKey) ? 'all' : 'none'} small />
                          {dist[lang]}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Selected tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selectedTags.map(tag => (
            <span
              key={tag.key}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
                         bg-gold-100 text-gold-800 dark:bg-gold-900/30 dark:text-gold-300
                         border border-gold-200 dark:border-gold-800"
            >
              {tag.label}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="hover:text-red-500 transition-colors ms-0.5"
              >
                <X size={11} />
              </button>
            </span>
          ))}
          {selectedTags.length > 0 && (
            <button
              type="button"
              onClick={() => onChange(new Set())}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs text-gray-400
                         hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
            >
              <X size={11} />
              {lang === 'ar' ? 'مسح الكل' : 'Clear all'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Checkbox indicator (tri-state) ───────────────────────────────────────────
function Checkbox({ state, small }) {
  const size = small ? 'w-3.5 h-3.5' : 'w-4 h-4'
  if (state === 'all') {
    return (
      <div className={`${size} rounded flex items-center justify-center bg-gold-500 border-gold-500 border shrink-0`}>
        <svg viewBox="0 0 10 8" className="w-2.5 h-2 fill-white">
          <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    )
  }
  if (state === 'partial') {
    return (
      <div className={`${size} rounded flex items-center justify-center bg-gold-200 border-gold-400 border shrink-0`}>
        <div className="w-2 h-0.5 bg-gold-600 rounded" />
      </div>
    )
  }
  return (
    <div className={`${size} rounded border border-gray-300 dark:border-navy-600 bg-white dark:bg-navy-800 shrink-0`} />
  )
}
