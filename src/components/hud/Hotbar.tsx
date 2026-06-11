import { blockDef, HOTBAR_BLOCKS } from '../../game/blocks'
import { getBlockIcon } from '../../game/textures/icons'
import { useGameStore } from '../../state/useGameStore'

export function Hotbar() {
  const selected = useGameStore((s) => s.selectedSlot)
  const selectSlot = useGameStore((s) => s.selectSlot)
  const selectedName = blockDef(HOTBAR_BLOCKS[selected]).name

  return (
    <div className="hotbar-area">
      {/* keyed so the fade-out animation restarts on every selection change */}
      <div className="hotbar-label" key={selected}>
        {selectedName}
      </div>
      <div className="hotbar">
        {HOTBAR_BLOCKS.map((id, index) => (
          <button
            key={id}
            type="button"
            tabIndex={-1}
            className={`hotbar-slot${index === selected ? ' hotbar-slot--selected' : ''}`}
            onClick={() => selectSlot(index)}
          >
            <img src={getBlockIcon(id)} alt={blockDef(id).name} draggable={false} />
            <span className="hotbar-slot-key">{index + 1}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
