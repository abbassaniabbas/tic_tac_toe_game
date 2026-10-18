import { useRef, useState, type KeyboardEvent } from 'react';
import type { GameState } from '@nexo/engine';
import { en } from '@/lib/messages';
import { Mark } from './graphics';

export function Board({ game, thinking, onMove }: { game: GameState; thinking: boolean; onMove: (index: number) => void }) {
  const [focused, setFocused] = useState(4);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  function navigate(event: KeyboardEvent, index: number) {
    const offset: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3, Home: -index, End: 8 - index };
    if (!(event.key in offset)) return;
    event.preventDefault(); const next = (index + offset[event.key] + 9) % 9;
    setFocused(next); buttons.current[next]?.focus();
  }
  const line = game.winningLine;
  const coords = (index: number) => ({ x: (index % 3) * 100 + 50, y: Math.floor(index / 3) * 100 + 50 });
  const start = line ? coords(line[0]) : null; const end = line ? coords(line[2]) : null;
  return <div className={`board-frame ${game.status !== 'playing' ? 'finished' : ''}`}>
    <div className="board-grid" role="group" aria-label={en.boardLabel} data-testid="board" aria-busy={thinking}>
      {game.board.map((cell, index) => <button type="button" key={index} ref={el => { buttons.current[index] = el; }}
        className={`square ${cell ? 'occupied' : ''} ${line?.includes(index) ? 'winning-square' : ''}`}
        aria-label={en.square(index, cell)} aria-disabled={!!cell || thinking || game.status !== 'playing'}
        tabIndex={focused === index ? 0 : -1} onFocus={() => setFocused(index)} onKeyDown={event => navigate(event, index)}
        onClick={() => { if (!cell && !thinking && game.status === 'playing') onMove(index); }}>
        {cell ? <Mark value={cell} className="placed-mark"/> : <><span className="square-number" aria-hidden="true">{index + 1}</span><Mark value={game.turn} className="ghost-mark"/></>}
      </button>)}
    </div>
    {start && end && <svg className={`winning-line line-${game.winner?.toLowerCase()}`} viewBox="0 0 300 300" aria-hidden="true"><line x1={start.x} y1={start.y} x2={end.x} y2={end.y}/></svg>}
    <span className="board-corner corner-tl"/><span className="board-corner corner-tr"/><span className="board-corner corner-bl"/><span className="board-corner corner-br"/>
  </div>;
}
