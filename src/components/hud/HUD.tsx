import { useEffect, useSyncExternalStore } from 'react'
import { HOTBAR_BLOCKS } from '../../game/blocks'
import { screenManager } from '../../game/screens/ScreenManager'
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
      // an in-world screen is typing, or a real website is open
      if (screenManager.keyboardOwner || screenManager.webview) return
      if (event.code === 'F3') {
        event.preventDefault() // browsers map F3 to find-in-page
        toggleDebug()
        return
      }
      if (useGameStore.getState().status !== 'playing') return
      if (event.code.startsWith('Digit')) {
        const digit = Number(event.code.slice(5))
        const slot = digit === 0 ? 9 : digit - 1
        if (slot < HOTBAR_BLOCKS.length) selectSlot(slot)
      }
    }
    const onWheel = (event: WheelEvent) => {
      const { status, selectedSlot } = useGameStore.getState()
      if (status !== 'playing') return
      if (screenManager.aim || screenManager.webview) return // wheel belongs to the screen
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
  const screenTyping = useSyncExternalStore(
    screenManager.subscribe,
    screenManager.isKeyboardCaptured,
  )

  return (
    <div className="hud">
      {underwater && <div className="underwater-overlay" />}
      <div className="vignette" />
      {status !== 'menu' && (
        <>
          <Crosshair />
          <Hotbar />
          {screenTyping && (
            <div className="screen-typing-hint">⌨ Typing on screen — press ` to leave</div>
          )}
        </>
      )}
      <DebugOverlay />
      <Menu />
    </div>
  )
}
