import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../features/auth/hooks/useAuth'
import { useConectividad } from '../hooks/useConectividad'
import type { UserRole } from '../types/base'

type Tema = 'dark' | 'light'

function useTema(): [Tema, () => void] {
  const [tema, setTema] = useState<Tema>(() => {
    const saved = localStorage.getItem('tema') as Tema | null
    return saved ?? 'dark'
  })
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema)
    localStorage.setItem('tema', tema)
  }, [tema])
  return [tema, () => setTema(t => t === 'dark' ? 'light' : 'dark')]
}

type NavItem = {
  ruta:          string
  label:         string
  labelCorto:    string
  soloAdmin?:    boolean
  soloOperador?: boolean
  icono:         React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  {
    ruta: '/productos', label: 'Busqueda', labelCorto: 'Busqueda',
    icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  },
  {
    ruta: '/ubicaciones', label: 'Mapa Bodega', labelCorto: 'Mapa',
    icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="5" rx="1"/><rect x="2" y="10" width="20" height="5" rx="1"/><rect x="2" y="17" width="20" height="5" rx="1"/></svg>,
  },
  {
    ruta: '/ingresos', label: 'Importacion', labelCorto: 'Importacion', soloAdmin: true,
    icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="9.5" y1="11" x2="12" y2="13.5"/><line x1="14.5" y1="11" x2="12" y2="13.5"/></svg>,
  },
  {
    ruta: '/notas', label: 'NV preparacion', labelCorto: 'NV prep',
    icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>,
  },
  {
    ruta: '/salidas', label: 'NV despacho', labelCorto: 'NV desp', soloAdmin: true,
    icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  },
  {
    ruta: '/traslados', label: 'Traslado', labelCorto: 'Traslado',
    icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M15 6l6 6-6 6"/><path d="M19 12H5"/><path d="M9 6L3 12l6 6"/></svg>,
  },
  {
    ruta: '/historial', label: 'Historial', labelCorto: 'Historial',
    icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  },
  {
    ruta: '/inventario-inicial', label: 'Inv. Inicial', labelCorto: 'Inicial', soloAdmin: true,
    icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>,
  },
  {
    ruta: '/etiquetas', label: 'Etiquetas', labelCorto: 'Etiquetas', soloAdmin: true,
    icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  },
  {
    ruta: '/picking-masivo', label: 'Picking Masivo', labelCorto: 'Picking', soloAdmin: true,
    icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>,
  },
  {
    ruta: '/picking-masivo/operador', label: 'Picking Masivo', labelCorto: 'Picking', soloOperador: true,
    icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>,
  },
]

const IconLogout = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)
const IconMenu = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
)
const IconClose = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const IconUser = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={13} height={13}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
)
const IconSun = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)
const IconMoon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)

interface Props { children: React.ReactNode }

export function Layout({ children }: Props) {
  const navigate           = useNavigate()
  const location           = useLocation()
  const { sesion, logout } = useAuth()
  const { offline }        = useConectividad()
  const [tema, toggleTema] = useTema()

  // Sidebar is always dark (#1E2E38), so white logo works in both themes
  const logoSrc = '/logo-grantt.png'

  // Desktop starts expanded, tablet starts collapsed
  const [expandido, setExpandido] = useState(() => window.innerWidth >= 1101)

  const rol           = sesion.rol as UserRole | null
  const nombre        = localStorage.getItem('user_nombre') ?? ''
  const itemsVisibles = NAV_ITEMS.filter((item) =>
    (!item.soloAdmin || rol === 'admin') && (!item.soloOperador || rol === 'operador')
  )

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  // ── Sidebar item ──────────────────────────────────────────
  function SidebarItem({ item }: { item: NavItem }) {
    const activo = location.pathname.startsWith(item.ruta)
    return (
      <button
        onClick={() => navigate(item.ruta)}
        title={!expandido ? item.label : undefined}
        className={`
          group flex items-center gap-3 w-full rounded-lg transition-all duration-150
          ${expandido ? 'px-3 py-2.5' : 'justify-center p-2.5'}
          ${activo
            ? 'bg-[rgba(125,211,252,0.15)] text-[#7DD3FC] font-bold shadow-[inset_3px_0_0_#7DD3FC]'
            : 'text-[#F1F5F9] opacity-75 hover:opacity-100 hover:bg-[rgba(255,255,255,0.07)]'
          }
        `}
      >
        <span className="w-5 h-5 flex items-center justify-center shrink-0 [&_svg]:w-5 [&_svg]:h-5">
          {item.icono}
        </span>
        {expandido && (
          <span className="text-sm font-semibold font-[Inter] truncate leading-none">
            {item.label}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="flex min-h-svh bg-[var(--bg-base)]">

      {/* ── Sidebar (tablet+) ────────────────────────────── */}
      <aside
        className={`
          hidden tablet:flex flex-col shrink-0 sticky top-0 h-svh z-50
          bg-[#1E2E38]
          border-r border-[rgba(255,255,255,0.06)]
          shadow-[2px_0_16px_rgba(0,0,0,0.35)]
          transition-[width] duration-200 ease-in-out overflow-hidden
          ${expandido ? 'w-52' : 'w-16'}
        `}
      >
        {/* Logo + toggle */}
        <div className={`flex items-center border-b border-[rgba(255,255,255,0.06)] shrink-0 h-16 ${expandido ? 'px-3 gap-2' : 'justify-center'}`}>
          {expandido && (
            <button onClick={() => navigate('/home')} className="flex-1 flex items-center min-w-0">
              <img src={logoSrc} alt="Grantt" className="h-10 w-auto object-contain" />
            </button>
          )}
          <button
            onClick={() => setExpandido(e => !e)}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-[#F1F5F9] opacity-60 hover:opacity-100 hover:bg-[rgba(255,255,255,0.08)] transition-all shrink-0"
            title={expandido ? 'Contraer' : 'Expandir'}
          >
            {expandido ? <IconClose /> : <IconMenu />}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 flex flex-col gap-0.5 p-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {itemsVisibles.map(item => (
            <SidebarItem key={item.ruta} item={item} />
          ))}
        </nav>

        {/* Footer: usuario + toggle tema + logout */}
        <div className="shrink-0 border-t border-[rgba(255,255,255,0.06)] p-2 flex flex-col gap-1">
          {expandido && nombre && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-[#94a3b8] text-xs">
              <IconUser />
              <span className="truncate">{nombre}</span>
            </div>
          )}
          <button
            onClick={toggleTema}
            title={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className={`
              flex items-center gap-3 rounded-lg text-[#94a3b8]
              hover:text-[#00A0DF] hover:bg-[rgba(0,160,223,0.1)]
              transition-all duration-150
              ${expandido ? 'px-3 py-2.5' : 'justify-center p-2.5'}
            `}
          >
            <span className="shrink-0">{tema === 'dark' ? <IconSun /> : <IconMoon />}</span>
            {expandido && <span className="text-sm font-semibold font-[Inter]">{tema === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>}
          </button>
          <button
            onClick={handleLogout}
            title={!expandido ? 'Salir' : undefined}
            className={`
              flex items-center gap-3 rounded-lg text-[#94a3b8]
              hover:text-red-400 hover:bg-[rgba(239,68,68,0.1)]
              transition-all duration-150
              ${expandido ? 'px-3 py-2.5' : 'justify-center p-2.5'}
            `}
          >
            <span className="shrink-0"><IconLogout /></span>
            {expandido && <span className="text-sm font-semibold font-[Inter]">Salir</span>}
          </button>
        </div>
      </aside>

      {/* ── Sidebar mobile (izquierda fija) ─────────────────── */}
      <nav className="tablet:hidden fixed left-0 top-0 h-svh w-14 z-50 flex flex-col bg-[#1E2E38] border-r border-[rgba(255,255,255,0.06)] shadow-[2px_0_16px_rgba(0,0,0,0.35)]">

        {/* Logo */}
        <button onClick={() => navigate('/home')} className="h-14 flex items-center justify-center shrink-0 border-b border-[rgba(255,255,255,0.06)]">
          <img src={logoSrc} alt="Grantt" className="h-7 w-auto object-contain" />
        </button>

        {/* Nav items */}
        <div className="flex-1 flex flex-col gap-0.5 py-2 px-1.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

          {/* Home */}
          <button
            onClick={() => navigate('/home')}
            title="Inicio"
            className={`flex items-center justify-center p-2.5 rounded-lg transition-all duration-150 [&_svg]:w-5 [&_svg]:h-5
              ${location.pathname === '/home'
                ? 'bg-[rgba(125,211,252,0.15)] text-[#7DD3FC] shadow-[inset_3px_0_0_#7DD3FC]'
                : 'text-[#F1F5F9] opacity-60 hover:opacity-100 hover:bg-[rgba(255,255,255,0.07)]'
              }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
              <polyline points="9 21 9 12 15 12 15 21"/>
            </svg>
          </button>

          {itemsVisibles.map(item => {
            const activo = location.pathname.startsWith(item.ruta)
            return (
              <button
                key={item.ruta}
                onClick={() => navigate(item.ruta)}
                title={item.label}
                className={`flex items-center justify-center p-2.5 rounded-lg transition-all duration-150 [&_svg]:w-5 [&_svg]:h-5
                  ${activo
                    ? 'bg-[rgba(125,211,252,0.15)] text-[#7DD3FC] shadow-[inset_3px_0_0_#7DD3FC]'
                    : 'text-[#F1F5F9] opacity-60 hover:opacity-100 hover:bg-[rgba(255,255,255,0.07)]'
                  }`}
              >
                {item.icono}
              </button>
            )
          })}
        </div>

        {/* Toggle tema + Logout */}
        <div className="shrink-0 border-t border-[rgba(255,255,255,0.06)] p-1.5 flex flex-col gap-1">
          {nombre && (
            <div className="flex items-center justify-center py-1.5 text-[#94a3b8]">
              <IconUser />
            </div>
          )}
          <button
            onClick={toggleTema}
            title={tema === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            className="flex items-center justify-center w-full p-2.5 rounded-lg text-[#94a3b8] hover:text-[#00A0DF] hover:bg-[rgba(0,160,223,0.1)] transition-all duration-150 [&_svg]:w-5 [&_svg]:h-5"
          >
            {tema === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
          <button
            onClick={handleLogout}
            title="Salir"
            className="flex items-center justify-center w-full p-2.5 rounded-lg text-[#94a3b8] hover:text-red-400 hover:bg-[rgba(239,68,68,0.1)] transition-all duration-150 [&_svg]:w-5 [&_svg]:h-5"
          >
            <IconLogout />
          </button>
        </div>
      </nav>

      {/* ── Contenido principal ──────────────────────────── */}
      <div className="layout-content flex-1 flex flex-col min-w-0 pl-14 tablet:pl-0">

        {offline && (
          <div className="offline-banner bg-[rgba(239,68,68,0.15)] border-b border-[rgba(239,68,68,0.3)] text-red-300 text-sm text-center py-2 px-4">
            Sin conexión — modo solo lectura
          </div>
        )}
        <main className="layout-main flex-1">
          {children}
        </main>
      </div>

    </div>
  )
}
