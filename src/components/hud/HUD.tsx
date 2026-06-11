import { useEffect } from 'react'
import { useGameStore } from '../../state/useGameStore'
import { Crosshair } from './Crosshair'
import { DebugOverlay } from './DebugOverlay'
import { Hotbar } from './Hotbar'
import { Menu } from './Menu'

function useGameHotkeys(): void {
  const selectSlot = useGameStore((s) => s.selectSlot)
  const toggleDebug = useGameStore((s) => s.toggleDebug)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'F3') {
        event.preventDefault() // browsers map F3 to find-in-page
        toggleDebug()
        return
      }
      if (useGameStore.getState().status !== 'playing') return
      if (event.code.startsWith('Digit')) {
        const digit = Number(event.code.slice(5))
        if (digit >= 1 && digit <= 9) selectSlot(digit - 1)
      }
    }
    const onWheel = (event: WheelEvent) => {
      const { status, selectedSlot } = useGameStore.getState()
      if (status !== 'playing') return
      selectSlot(selectedSlot + Math.sign(event.deltaY))
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('wheel', onWheel)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('wheel', onWheel)
    }
  }, [selectSlot, toggleDebug])
}

export function HUD() {
  useGameHotkeys()
  const status = useGameStore((s) => s.status)
  const underwater = useGameStore((s) => s.underwater)

  return (
    <div className="hud">
      {underwater && <div className="underwater-overlay" />}
      <div className="vignette" />
      {status !== 'menu' && (
        <>
          <Crosshair />
          <Hotbar />
        </>
      )}
      <DebugOverlay />
      <Menu />
    </div>
  )
}
