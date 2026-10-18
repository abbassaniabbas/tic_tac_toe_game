"use client";

import { useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import {
  DEFAULT_CONFIG,
  createSession,
  sessionReducer,
  chooseAiMove,
  canUndo,
  type GameConfig,
  type Mark as MarkType,
} from "@nexo/engine";
import { en } from "@/lib/messages";
import {
  DEFAULT_PREFERENCES,
  feedback,
  loadSaved,
  saveLocal,
  type Preferences,
} from "@/lib/preferences";
import { Board } from "./board";
import { Brand, Icon, Mark } from "./graphics";
import { Configuration, ModeSelector } from "./configuration";
import { OnlinePanel } from "./online-panel";
import { Studio, webStudioStorage } from "./studio";
import { newRequestId } from "@nexo/online";
import { appendLocalReplay } from "@nexo/online/react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
type ModalName =
  | "setup"
  | "preferences"
  | "rules"
  | "install"
  | "online"
  | "studio"
  | null;

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label={en.close}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Rules() {
  return (
    <div className="rules-grid">
      {[
        [en.ruleOne, en.ruleOneBody],
        [en.ruleTwo, en.ruleTwoBody],
        [en.ruleThree, en.ruleThreeBody],
      ].map(([title, body], i) => (
        <article className="rule" key={title}>
          <span className="rule-number">0{i + 1}</span>
          <h3>{title}</h3>
          <p>{body}</p>
        </article>
      ))}
    </div>
  );
}
function PreviewBoard() {
  const marks: (MarkType | null)[] = [
    "X",
    null,
    "O",
    null,
    "X",
    null,
    "O",
    null,
    "X",
  ];
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="art-orbit orbit-one" />
      <div className="art-orbit orbit-two" />
      <div className="art-topline">
        <span className="tiny-dot" />
        {en.classicLabel}
        <span>01 / 09</span>
      </div>
      <div className="art-board">
        {marks.map((value, i) => (
          <div
            key={i}
            className={`art-cell ${value ? `art-${value.toLowerCase()}` : ""}`}
          >
            {value && <Mark value={value} />}
          </div>
        ))}
        <svg viewBox="0 0 300 300" className="art-win">
          <path d="M45 45 255 255" />
        </svg>
      </div>
      <div className="art-caption">
        <span>{en.previewLabel}</span>
        <Icon name="arrow" size={18} />
      </div>
      <span className="floating-mark">
        <Mark value="O" />
      </span>
    </div>
  );
}

export function Arena() {
  const [session, dispatch] = useReducer(
    sessionReducer,
    DEFAULT_CONFIG,
    (config) => createSession(config),
  );
  const [config, setConfig] = useState<GameConfig>({ ...DEFAULT_CONFIG });
  const [preferences, setPreferences] =
    useState<Preferences>(DEFAULT_PREFERENCES);
  const [hydrated, setHydrated] = useState(false);
  const [started, setStarted] = useState(false);
  const [modal, setModal] = useState<ModalName>(null);
  const [invite, setInvite] = useState("");
  const [studioInvite, setStudioInvite] = useState("");
  const recorded = useRef(false);
  const [offline, setOffline] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(
    null,
  );
  const gameHeading = useRef<HTMLHeadingElement>(null);
  const playButton = useRef<HTMLButtonElement>(null);
  const { game } = session;
  const thinking =
    started &&
    game.status === "playing" &&
    session.config.mode === "ai" &&
    game.turn !== session.config.humanMark;

  useEffect(() => {
    const saved = loadSaved();
    if (saved) {
      setPreferences(saved.preferences);
      setConfig(saved.config);
      dispatch({
        type: "restore",
        session: createSession(saved.config, saved.score),
      });
    }
    const invitation = new URLSearchParams(window.location.search).get(
      "invite",
    );
    if (invitation) {
      setInvite(invitation);
      setModal("online");
    }
    const studioInvitation = new URLSearchParams(window.location.search).get(
      "studioInvite",
    );
    if (studioInvitation) {
      setStudioInvite(studioInvitation);
      setModal("studio");
    }
    setHydrated(true);
    const updateOnline = () => setOffline(!navigator.onLine);
    const captureInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    window.addEventListener("beforeinstallprompt", captureInstall);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then(() => setOfflineReady(true))
        .catch(() => setOfflineReady(false));
    }
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      window.removeEventListener("beforeinstallprompt", captureInstall);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.dataset.motion = preferences.reducedMotion
      ? "reduced"
      : "system";
    if (hydrated) saveLocal(preferences, session.config, session.score);
  }, [preferences, session.config, session.score, hydrated]);
  useEffect(() => {
    if (!thinking || modal) return;
    const timeout = window.setTimeout(() => {
      const index = chooseAiMove(game, session.config.difficulty);
      if (index !== null) {
        const next = sessionReducer(session, { type: "move", index });
        feedback(
          preferences.sound,
          preferences.haptics,
          next.game.status === "won",
        );
        dispatch({ type: "move", index });
      }
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [thinking, game, session, preferences.sound, preferences.haptics, modal]);
  useEffect(() => {
    if (started) gameHeading.current?.focus();
  }, [started]);

  useEffect(() => {
    if (game.status === "playing") {
      recorded.current = false;
      return;
    }
    if (!recorded.current) {
      recorded.current = true;
      void appendLocalReplay(webStudioStorage, {
        id: newRequestId(),
        rule: "classic-v1",
        first: game.first,
        moves: game.moves,
        result: game.winner ?? "draw",
        source: "local",
      }).catch(() => undefined);
    }
  }, [game]);

  function startGame() {
    if (
      modal === "setup" ||
      JSON.stringify(config) !== JSON.stringify(session.config)
    )
      dispatch({ type: "configure", config });
    else
      dispatch({
        type: "restore",
        session: createSession(config, session.score),
      });
    setModal(null);
    setStarted(true);
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => gameHeading.current?.focus());
  }
  function move(index: number) {
    if (thinking || game.status !== "playing" || game.board[index]) return;
    const next = sessionReducer(session, { type: "move", index });
    feedback(
      preferences.sound,
      preferences.haptics,
      next.game.status === "won",
    );
    dispatch({ type: "move", index });
  }
  function lobby() {
    setStarted(false);
    setConfig(session.config);
    setModal(null);
    requestAnimationFrame(() => playButton.current?.focus());
  }
  function openSetup() {
    setConfig({ ...session.config });
    setModal("setup");
  }
  const playerName = (mark: MarkType) =>
    session.config.mode === "local"
      ? en.player(mark)
      : mark === session.config.humanMark
        ? en.you
        : en.ai;
  let statusTitle = thinking
    ? en.thinking
    : session.config.mode === "local"
      ? en.playerTurn(game.turn)
      : en.yourTurn;
  let statusHint = thinking
    ? en.thinkingHint
    : session.config.mode === "local"
      ? en.localTurnHint
      : en.yourTurnHint;
  if (game.status === "draw") {
    statusTitle = en.draw;
    statusHint = en.drawHint;
  }
  if (game.winner) {
    statusTitle =
      session.config.mode === "local"
        ? en.playerWins(game.winner)
        : game.winner === session.config.humanMark
          ? en.youWin
          : en.aiWin;
    statusHint =
      session.config.mode === "local"
        ? en.localWinHint
        : game.winner === session.config.humanMark
          ? en.youWinHint
          : en.aiWinHint;
  }
  const modeLabel =
    session.config.mode === "local"
      ? en.local
      : `${en.solo} / ${en[session.config.difficulty]}`;

  return (
    <>
      <a className="skip-link" href="#main-content">
        {en.playNav}
      </a>
      <header className="site-header">
        <div className="header-inner">
          <button
            type="button"
            className="brand-button"
            aria-label={en.home}
            onClick={lobby}
          >
            <Brand />
          </button>
          <nav aria-label={en.brand}>
            <button
              type="button"
              className={started ? "nav-active" : ""}
              onClick={() =>
                started ? gameHeading.current?.focus() : startGame()
              }
            >
              {en.playNav}
            </button>
            <button type="button" onClick={() => setModal("rules")}>
              {en.howNav}
            </button>
          </nav>
          <div className="header-actions">
            <button
              type="button"
              className="text-button"
              onClick={() => setModal("online")}
            >
              Online
            </button>
            <button
              type="button"
              className="icon-button theme-button"
              aria-label={en.switchTheme}
              title={en.switchTheme}
              onClick={() =>
                setPreferences((p) => ({
                  ...p,
                  theme: p.theme === "dark" ? "light" : "dark",
                }))
              }
            >
              <Icon name={preferences.theme === "dark" ? "sun" : "moon"} />
            </button>
            <span className="header-divider" />
            <button
              type="button"
              className="icon-button"
              aria-label={en.preferences}
              title={en.preferences}
              onClick={() => setModal("preferences")}
            >
              <Icon name="settings" />
            </button>
          </div>
        </div>
      </header>
      {offline && (
        <div className="offline-banner" role="status">
          {en.offline}
        </div>
      )}
      <main id="main-content">
        {!started ? (
          <>
            <section className="hero container">
              <div className="hero-copy">
                <div className="eyebrow hero-eyebrow">
                  <span className="tiny-dot" />
                  {en.tagline}
                </div>
                <h1>
                  {en.titleTop}
                  <br />
                  <span>{en.titleBottom}</span>
                </h1>
                <p>{en.heroDescription}</p>
                <button
                  ref={playButton}
                  type="button"
                  className="button primary hero-cta"
                  onClick={startGame}
                >
                  {en.playNow}
                  <Icon name="arrow" />
                </button>
                <span className="micro-copy">{en.noAccount}</span>
                <div className="hero-detail">
                  <span>01</span>
                  <div />
                  <span>{en.classicLabel}</span>
                </div>
              </div>
              <PreviewBoard />
            </section>
            <section className="mode-section container" id="modes">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">{en.arena}</span>
                  <h2>{en.chooseMode}</h2>
                </div>
                <p>{en.modeDescription}</p>
              </div>
              <ModeSelector config={config} onChange={setConfig} />
              <button
                type="button"
                className="button secondary studio-entry"
                onClick={() => setModal("studio")}
              >
                Explore Studio →
              </button>
              <div className="lobby-configuration">
                <Configuration config={config} onChange={setConfig} />
                <button
                  type="button"
                  className="button secondary"
                  onClick={startGame}
                >
                  {en.openArena}
                  <Icon name="arrow" />
                </button>
              </div>
            </section>
            <section className="how-section container" id="how-to-play">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">{en.howNav}</span>
                  <h2>{en.howTitle}</h2>
                </div>
                <p>{en.howSubtitle}</p>
              </div>
              <Rules />
            </section>
            <section className="closing container">
              <div>
                <h2>{en.ready}</h2>
                <p>{en.readyBody}</p>
              </div>
              <button
                type="button"
                className="button primary"
                onClick={startGame}
              >
                {en.playNow}
                <Icon name="arrow" />
              </button>
            </section>
          </>
        ) : (
          <section className="arena-page container">
            <div className="arena-topbar">
              <button type="button" className="text-button" onClick={lobby}>
                <Icon name="back" size={16} />
                {en.back}
              </button>
              <span className="mode-pill">
                <span className="tiny-dot" />
                {modeLabel}
              </span>
              <button type="button" className="text-button" onClick={openSetup}>
                {en.newGame}
                <Icon name="settings" size={16} />
              </button>
            </div>
            <div className="arena-layout">
              <aside className="arena-intro">
                <span className="eyebrow">{en.live}</span>
                <h1 ref={gameHeading} tabIndex={-1}>
                  {en.titleTop}
                  <br />
                  <span>{en.titleBottom}</span>
                </h1>
                <p>{en.heroDescription}</p>
                <div className="match-meta">
                  <span>{en.round}</span>
                  <strong>{String(session.round).padStart(2, "0")}</strong>
                  <span className="meta-line" />
                </div>
                <div className="desktop-preferences">
                  <button
                    type="button"
                    className="text-button"
                    aria-label={preferences.sound ? en.soundOn : en.soundOff}
                    onClick={() =>
                      setPreferences((p) => ({ ...p, sound: !p.sound }))
                    }
                  >
                    <Icon
                      name={preferences.sound ? "sound" : "mute"}
                      size={18}
                    />
                    {en.sound} {preferences.sound ? en.on : en.off}
                  </button>
                </div>
              </aside>
              <div className="game-stage">
                <div
                  className={`game-status ${thinking ? "thinking" : ""}`}
                  role="status"
                  aria-live="polite"
                >
                  <div className="status-eyebrow">
                    {game.status === "playing" ? (
                      <>
                        <span className="tiny-dot" />
                        {en.round} {String(session.round).padStart(2, "0")}
                      </>
                    ) : (
                      <>
                        <Icon name="bolt" size={14} />
                        {en.classicLabel}
                      </>
                    )}
                  </div>
                  <h2>
                    {statusTitle}
                    {thinking && (
                      <span className="thinking-dots">
                        <i />
                        <i />
                        <i />
                      </span>
                    )}
                  </h2>
                  <p>{statusHint}</p>
                </div>
                <Board game={game} thinking={thinking} onMove={move} />
                <p className="board-hint">
                  <span className="desktop-hint">{en.keyboardHint}</span>
                  <span className="touch-hint">{en.mobileHint}</span>
                </p>
                <div className="game-controls">
                  {game.status === "playing" ? (
                    <>
                      <button
                        type="button"
                        className="button control-button"
                        disabled={!canUndo(session)}
                        onClick={() => dispatch({ type: "undo" })}
                      >
                        <Icon name="undo" size={17} />
                        {en.undo}
                      </button>
                      <button
                        type="button"
                        className="button control-button"
                        onClick={() => dispatch({ type: "restart" })}
                      >
                        <Icon name="restart" size={17} />
                        {en.restart}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="button primary rematch-button"
                      onClick={() => {
                        dispatch({ type: "rematch" });
                        requestAnimationFrame(() =>
                          gameHeading.current?.focus(),
                        );
                      }}
                    >
                      <Icon name="restart" size={18} />
                      {en.rematch}
                      <Icon name="arrow" size={18} />
                    </button>
                  )}
                </div>
              </div>
              <aside className="score-panel">
                <div className="score-heading">
                  <span className="eyebrow">{en.sessionScore}</span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={en.resetScore}
                    title={en.resetScoreHint}
                    onClick={() => dispatch({ type: "resetScore" })}
                  >
                    <Icon name="restart" size={15} />
                  </button>
                </div>
                <div className="score-players">
                  {(["X", "O"] as MarkType[]).map((mark) => (
                    <div
                      className={`score-player score-${mark.toLowerCase()} ${game.status === "playing" && game.turn === mark ? "current-player" : ""} ${game.winner === mark ? "score-winner" : ""}`}
                      key={mark}
                    >
                      <div className="player-avatar">
                        <Mark value={mark} />
                      </div>
                      <div className="player-info">
                        <strong>{playerName(mark)}</strong>
                        <span>
                          {game.winner === mark
                            ? en.winLabel
                            : game.status === "playing" && game.turn === mark
                              ? en.active
                              : mark}
                        </span>
                      </div>
                      <strong
                        className="score-value"
                        data-testid={`score-${mark}`}
                      >
                        {new Intl.NumberFormat("en").format(
                          session.score[mark],
                        )}
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="draw-score">
                  <span>{en.draws}</span>
                  <strong data-testid="score-draws">
                    {session.score.draws}
                  </strong>
                </div>
                <div className="score-bottom">
                  <span className="tiny-dot" />
                  {offlineReady ? en.offlineReady : en.noAccount}
                </div>
              </aside>
            </div>
          </section>
        )}
      </main>
      <footer className="footer container">
        <Brand compact />
        <p>{en.footerLine}</p>
        <button
          type="button"
          className="text-button"
          onClick={() => setModal("install")}
        >
          <Icon name="download" size={16} />
          {en.install}
        </button>
      </footer>
      <nav aria-label="Information" className="legal-nav container">
        <a href="/privacy">Privacy</a>
        <a href="/support">Support</a>
        <a href="/delete-account">Delete account</a>
      </nav>
      {modal === "studio" && (
        <Modal title="Signature Studio" onClose={() => setModal(null)}>
          <Studio initialInvite={studioInvite} />
        </Modal>
      )}
      {modal === "online" && (
        <Modal title="Play together" onClose={() => setModal(null)}>
          <OnlinePanel initialInvite={invite} />
        </Modal>
      )}
      {modal === "setup" && (
        <Modal title={en.settingsTitle} onClose={() => setModal(null)}>
          <p className="modal-description">{en.settingsDescription}</p>
          <ModeSelector config={config} onChange={setConfig} />
          <Configuration config={config} onChange={setConfig} />
          <button
            type="button"
            className="button primary full-width"
            onClick={startGame}
          >
            {en.openArena}
            <Icon name="arrow" />
          </button>
        </Modal>
      )}
      {modal === "rules" && (
        <Modal title={en.howTitle} onClose={() => setModal(null)}>
          <Rules />
        </Modal>
      )}
      {modal === "install" && (
        <Modal title={en.installTitle} onClose={() => setModal(null)}>
          <p className="modal-description">{en.installDescription}</p>
          {installPrompt ? (
            <button
              type="button"
              className="button primary"
              onClick={async () => {
                await installPrompt.prompt();
                await installPrompt.userChoice;
                setInstallPrompt(null);
                setModal(null);
              }}
            >
              {en.install}
              <Icon name="download" />
            </button>
          ) : (
            <p className="install-manual">{en.installManual}</p>
          )}
        </Modal>
      )}
      {modal === "preferences" && (
        <Modal title={en.preferences} onClose={() => setModal(null)}>
          <div className="preference-row">
            <span>{en.theme}</span>
            <div className="segment">
              {(["dark", "light"] as const).map((theme) => (
                <button
                  type="button"
                  key={theme}
                  aria-pressed={preferences.theme === theme}
                  onClick={() => setPreferences((p) => ({ ...p, theme }))}
                >
                  {en[theme]}
                </button>
              ))}
            </div>
          </div>
          {(
            [
              ["sound", en.sound],
              ["haptics", en.haptics],
              ["reducedMotion", en.reduceMotion],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="preference-row">
              <span id={`pref-${key}`}>{label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={preferences[key]}
                aria-labelledby={`pref-${key}`}
                className="switch"
                onClick={() =>
                  setPreferences((p) => ({ ...p, [key]: !p[key] }))
                }
              >
                <span />
              </button>
            </div>
          ))}
        </Modal>
      )}
    </>
  );
}
