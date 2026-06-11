import { GameCanvas } from './components/canvas/GameCanvas'
import { HUD } from './components/hud/HUD'

export default function App() {
  return (
    <div className="app">
      <GameCanvas />
      <HUD />
    </div>
  )
}
