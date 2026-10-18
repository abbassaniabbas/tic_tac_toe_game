import type { GameConfig, Difficulty, Mark as MarkType } from '@nexo/engine';
import { en } from '@/lib/messages';
import { Icon, Mark } from './graphics';

export function ModeSelector({ config, onChange }: { config: GameConfig; onChange: (config: GameConfig) => void }) {
  return <div className="mode-grid" role="group" aria-label={en.chooseMode}>
    {(['ai','local'] as const).map(mode => <button key={mode} type="button" className={`mode-card ${config.mode === mode ? 'selected' : ''}`} aria-pressed={config.mode === mode} onClick={() => onChange({ ...config, mode })}>
      <span className="mode-icon"><Icon name={mode === 'ai' ? 'bot' : 'people'} size={25}/></span>
      <span className="mode-content"><span className="eyebrow">{mode === 'ai' ? en.soloTag : en.localTag}</span><strong>{mode === 'ai' ? en.solo : en.local}</strong><span>{mode === 'ai' ? en.soloDescription : en.localDescription}</span></span>
      <span className="mode-check" aria-hidden="true">{config.mode === mode ? <Icon name="check" size={16}/> : <Icon name="chevron" size={16}/>}</span>
    </button>)}
  </div>;
}
export function Configuration({ config, onChange }: { config: GameConfig; onChange: (config: GameConfig) => void }) {
  return <div className="configuration">
    {config.mode === 'ai' && <fieldset><legend>{en.difficulty}</legend><div className="segment" role="group" aria-label={en.difficulty}>
      {(['easy','medium','hard'] as Difficulty[]).map(difficulty => <button key={difficulty} type="button" aria-pressed={config.difficulty === difficulty} onClick={() => onChange({ ...config, difficulty })}>{en[difficulty]}</button>)}
    </div><p className="field-hint">{en[`${config.difficulty}Description`]}</p></fieldset>}
    <div className="config-row">
      {config.mode === 'ai' && <fieldset><legend>{en.playAs}</legend><div className="segment mark-segment" role="group" aria-label={en.playAs}>{(['X','O'] as MarkType[]).map(mark => <button key={mark} type="button" aria-pressed={config.humanMark === mark} aria-label={mark} onClick={() => onChange({ ...config, humanMark: mark })}><Mark value={mark}/><span>{mark}</span></button>)}</div></fieldset>}
      <fieldset><legend>{en.firstMove}</legend><select aria-label={en.firstMove} value={config.firstMark} onChange={event => onChange({ ...config, firstMark: event.target.value as MarkType })}>
        <option value="X">{config.mode === 'local' ? en.xFirst : config.humanMark === 'X' ? en.youFirst : en.aiFirst}</option>
        <option value="O">{config.mode === 'local' ? en.oFirst : config.humanMark === 'O' ? en.youFirst : en.aiFirst}</option>
      </select></fieldset>
    </div>
  </div>;
}
