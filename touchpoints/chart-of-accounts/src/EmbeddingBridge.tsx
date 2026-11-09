import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setInAppNavigator } from './embedding'

/** Mounted inside the router so plain in-app link clicks (see embedding.ts) can use it. */
export function EmbeddingBridge() {
  const navigate = useNavigate()
  useEffect(() => {
    setInAppNavigator(path => navigate(path))
    return () => setInAppNavigator(null)
  }, [navigate])
  return null
}
