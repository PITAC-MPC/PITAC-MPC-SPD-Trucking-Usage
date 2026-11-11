import { useEffect, useState } from 'react'

/**
 * Scales a document so the whole sheet stays visible inside its frame.
 * Returns the zoom factor to apply.
 */
export default function useFitScale(ref, naturalWidth) {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const element = ref.current
    if (!element) return undefined

    const update = () => {
      const available = element.clientWidth - 4
      if (available <= 0) return
      const next = Math.max(0.45, Math.min(1, available / naturalWidth))
      const rounded = Number(next.toFixed(3))
      setScale((current) =>
        Math.abs(current - rounded) > 0.005 ? rounded : current,
      )
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, naturalWidth])

  return scale
}
