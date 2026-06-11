import { UI_FONT, type ScreenApp, type ScreenOS } from '../ScreenOS'

interface Cell {
  x: number
  y: number
}

const KEY_DIRS: Record<string, Cell> = {
  KeyW: { x: 0, y: -1 },
  ArrowUp: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  ArrowLeft: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
}

/** Classic snake; click to start (captures the keyboard for steering). */
export function createSnakeApp(): ScreenApp {
  let cell = 0
  let cols = 0
  let rows = 0
  let snake: Cell[] = []
  let dir: Cell = { x: 1, y: 0 }
  let pending: Cell = dir
  let food: Cell = { x: 0, y: 0 }
  let alive = false
  let started = false
  let score = 0
  let acc = 0

  const spawnFood = (): void => {
    do {
      food = { x: (Math.random() * cols) | 0, y: (Math.random() * rows) | 0 }
    } while (snake.some((c) => c.x === food.x && c.y === food.y))
  }

  const reset = (os: ScreenOS): void => {
    cell = Math.max(10, Math.round(14 * os.s))
    cols = Math.max(8, Math.floor(os.w / cell))
    rows = Math.max(8, Math.floor(os.contentH / cell))
    const cx = cols >> 1
    const cy = rows >> 1
    snake = [
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
    ]
    dir = { x: 1, y: 0 }
    pending = dir
    score = 0
    acc = 0
    alive = true
    started = true
    spawnFood()
  }

  const advance = (os: ScreenOS): void => {
    dir = pending
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y }
    const hitWall = head.x < 0 || head.y < 0 || head.x >= cols || head.y >= rows
    if (hitWall || snake.some((c) => c.x === head.x && c.y === head.y)) {
      alive = false
      os.hooks.releaseKeyboard()
      return
    }
    snake.unshift(head)
    if (head.x === food.x && head.y === food.y) {
      score++
      spawnFood()
    } else {
      snake.pop()
    }
  }

  return {
    title: 'Snake',

    draw(os, _now, dt) {
      const { ctx, w, s } = os
      const h = os.contentH
      ctx.fillStyle = '#101418'
      ctx.fillRect(0, 0, w, h)

      if (started) {
        const ox = Math.floor((w - cols * cell) / 2)
        const oy = Math.floor((h - rows * cell) / 2)
        ctx.strokeStyle = 'rgba(120, 160, 190, 0.18)'
        ctx.lineWidth = 1
        ctx.strokeRect(ox - 1, oy - 1, cols * cell + 2, rows * cell + 2)

        // steering needs the keyboard; pause the simulation while we lost it
        if (alive && os.kbdCaptured) {
          acc += dt
          const step = Math.max(0.06, 0.13 - score * 0.0025)
          while (acc > step) {
            acc -= step
            advance(os)
            if (!alive) break
          }
        }

        ctx.fillStyle = '#e85d4a'
        ctx.fillRect(ox + food.x * cell + 1, oy + food.y * cell + 1, cell - 2, cell - 2)
        snake.forEach((c, i) => {
          ctx.fillStyle = i === 0 ? '#8df2a6' : '#43a047'
          ctx.fillRect(ox + c.x * cell + 1, oy + c.y * cell + 1, cell - 2, cell - 2)
        })

        ctx.fillStyle = '#cfe3f5'
        ctx.font = `600 ${Math.max(10, Math.round(11 * s))}px ${UI_FONT}`
        ctx.fillText(`Score ${score}`, 6 * s, 14 * s)
      }

      const overlay = (title: string, hint: string): void => {
        ctx.fillStyle = 'rgba(8, 10, 14, 0.65)'
        ctx.fillRect(0, 0, w, h)
        ctx.textAlign = 'center'
        ctx.fillStyle = '#8df2a6'
        ctx.font = `700 ${Math.round(22 * s)}px ${UI_FONT}`
        ctx.fillText(title, w / 2, h / 2 - 8 * s)
        ctx.fillStyle = '#cfe3f5'
        ctx.font = `${Math.round(11 * s)}px ${UI_FONT}`
        ctx.fillText(hint, w / 2, h / 2 + 14 * s)
        ctx.textAlign = 'left'
      }
      if (!started) overlay('🐍 SNAKE', 'right-click to play · WASD / arrows steer')
      else if (!alive) overlay(`Game over — ${score}`, 'right-click to retry')
      else if (!os.kbdCaptured) overlay('Paused', 'right-click to grab the keyboard')
    },

    pointerDown(os) {
      if (!started || !alive) {
        reset(os)
        os.hooks.requestKeyboard()
      } else if (!os.kbdCaptured) {
        os.hooks.requestKeyboard()
      }
    },

    key(_os, event) {
      const next = KEY_DIRS[event.code]
      if (!next) return
      // ignore direct reversals
      if (snake.length > 1 && next.x === -dir.x && next.y === -dir.y) return
      pending = next
    },

    blur(os) {
      // pause when the user navigates away mid-game
      if (started && alive) acc = 0
      void os
    },
  }
}
