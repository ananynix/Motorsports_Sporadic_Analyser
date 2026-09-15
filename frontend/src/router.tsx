// This module deliberately exports both a component (Router) and plain
// hooks/functions (useNavigate, useLocation, Link) from one file, same as
// react-router-dom's own package shape -- splitting a ~90-line cohesive
// routing module into several files purely to satisfy Fast Refresh's
// single-export-type preference isn't worth the indirection.
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode, MouseEvent } from 'react'

// A minimal hand-rolled router covering exactly what this app needs: four
// flat top-level pages, no nested/dynamic route params, and route state
// (SimulationPage/ReportPage pass {mode, eventSlug, driver, insights, ...}
// the way react-router-dom's <Link state={...}> / useNavigate(to, {state})
// would). Built to avoid a new npm dependency entirely -- react-router-dom
// couldn't be installed here (registry.npmjs.org resets every connection
// from this network, confirmed via direct curl, unrelated to any one
// package), and the browser's own History API already covers this app's
// full routing needs without it.

interface RouteLocation {
  pathname: string;
  state: unknown;
}

interface RouterContextValue {
  location: RouteLocation;
  navigate: (to: string, options?: { replace?: boolean; state?: unknown }) => void;
}

const RouterContext = createContext<RouterContextValue | null>(null)

const readLocation = (): RouteLocation => ({
  pathname: window.location.pathname,
  state: window.history.state,
})

export const Router = ({ children }: { children: ReactNode }) => {
  const [location, setLocation] = useState<RouteLocation>(readLocation)

  useEffect(() => {
    const onPopState = () => setLocation(readLocation())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = (to: string, options: { replace?: boolean; state?: unknown } = {}) => {
    const method = options.replace ? 'replaceState' : 'pushState'
    window.history[method](options.state ?? null, '', to)
    setLocation({ pathname: to, state: options.state ?? null })
    window.scrollTo(0, 0)
  }

  return <RouterContext.Provider value={{ location, navigate }}>{children}</RouterContext.Provider>
}

const useRouterContext = (): RouterContextValue => {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('Router hooks must be used inside <Router>')
  return ctx
}

export const useNavigate = () => useRouterContext().navigate
export const useLocation = () => useRouterContext().location

interface LinkProps {
  to: string;
  children: ReactNode;
  className?: string;
}

export const Link = ({ to, children, className }: LinkProps) => {
  const navigate = useNavigate()
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Let modified clicks (open in new tab, etc.) behave like a normal link.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    navigate(to)
  }
  return (
    <a href={to} className={className} onClick={handleClick}>
      {children}
    </a>
  )
}
