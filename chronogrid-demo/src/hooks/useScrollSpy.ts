import { useState, useEffect } from 'react'

export function useScrollSpy(ids: string[], offset = 80) {
  const [active, setActive] = useState<string>(ids[0] ?? '')

  useEffect(() => {
    const handler = () => {
      const scrollY = window.scrollY + offset + 1
      let current = ids[0] ?? ''
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.offsetTop <= scrollY) current = id
      }
      setActive(current)
    }
    window.addEventListener('scroll', handler, { passive: true })
    handler()
    return () => window.removeEventListener('scroll', handler)
  }, [ids, offset])

  return active
}
