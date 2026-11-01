// Tiny hash router (works on GitHub Pages without server config)
import { useSyncExternalStore } from 'react'

const getPath = () => (window.location.hash.replace(/^#/, '') || '/').split('?')[0]
const subscribe = (cb) => { window.addEventListener('hashchange', cb); return () => window.removeEventListener('hashchange', cb) }

export const usePath = () => useSyncExternalStore(subscribe, getPath)
export function navigate(to) {
  window.location.hash = to
  window.scrollTo(0, 0)
}

export function Link({ to, children, className = '', ...rest }) {
  const path = usePath()
  const active = path === to || (to !== '/' && path.startsWith(to + '/'))
  return (
    <a href={'#' + to} className={className + (active ? ' active' : '')} onClick={() => window.scrollTo(0, 0)} {...rest}>
      {children}
    </a>
  )
}
