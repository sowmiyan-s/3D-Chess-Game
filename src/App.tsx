import { useEffect, useRef, useState } from 'react';
import { initWizardChess } from './wizardChessEngine.js';

const FULLSCREEN_BG_IMG = '/src/assets/images/fullscreen_sanctum_bg_1792224800169.jpg';
const HERO_BANNER_IMG = '/src/assets/images/hero_cathedral_banner_1792223447122.jpg';
const SINGLE_PLAYER_IMG = '/src/assets/images/mode_single_player_1792223448590.jpg';
const MULTIPLAYER_DUEL_IMG = '/src/assets/images/mode_multiplayer_duel_1792223447735.jpg';
const PASS_AND_PLAY_IMG = '/src/assets/images/mode_pass_and_play_1792224801103.jpg';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function App() {
  const initializedRef = useRef(false);
  const [startPageOpen, setStartPageOpen] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return !p.has('room');
  });
  const [activeTab, setActiveTab] = useState<'play' | 'rooms' | 'options' | 'about' | 'vault'>('play');
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [lobbyTab, setLobbyTab] = useState<'create' | 'join' | 'arena' | 'single'>('create');
  const [mpSide, setMpSide] = useState<'w' | 'b' | 'rand'>('w');
  const [spSide, setSpSide] = useState<'w' | 'b'>('w');
  const [aiTier, setAiTier] = useState<'novice' | 'knight' | 'inquisitor'>('knight');
  const [timeControl, setTimeControl] = useState<number>(0); // 0 = casual/untimed
  const [chatOpen, setChatOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [quickCodeInput, setQuickCodeInput] = useState('');

  // Android PWA Installation state
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  // Settings state in Options tab
  const [camMoveSpeed, setCamMoveSpeed] = useState<number>(35);
  const [camRotSpeed, setCamRotSpeed] = useState<number>(35);
  const [wallLookIdx, setWallLookIdx] = useState<number>(0);
  const [floorLookIdx, setFloorLookIdx] = useState<number>(0);

  // Player Profile stats (persisted in localStorage)
  const [playerStats] = useState({
    rating: 1340,
    wins: 14,
    losses: 6,
    draws: 2,
    rankTitle: 'Apprentice Archmage'
  });

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    initWizardChess();
  }, []);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileSheetOpen(false);
        const modal = document.getElementById('lobby-modal');
        if (modal?.classList.contains('open')) {
          modal.classList.remove('open');
        }
        setChatOpen(false);
      }
    };
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setMobileSheetOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstallable(false);
        setDeferredPrompt(null);
      }
    } catch (e) {
      console.warn('PWA install prompt error:', e);
    }
  };

  const handleToggleHaptics = () => {
    const nextVal = !hapticsEnabled;
    setHapticsEnabled(nextVal);
    const win = window as unknown as { wizardChess?: { setHapticsEnabled?: (val: boolean) => void } };
    win.wizardChess?.setHapticsEnabled?.(nextVal);
    if (nextVal && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([20, 30, 40]);
    }
  };

  const handleRestoreUI = () => {
    const win = window as unknown as { wizardChess?: { toggleUI?: (force?: boolean) => void } };
    if (win.wizardChess?.toggleUI) {
      win.wizardChess.toggleUI(false);
    } else {
      document.body.classList.remove('cinematic-ui-hidden');
      const btnHide = document.getElementById('btn-hide-ui');
      if (btnHide) btnHide.textContent = 'Hide UI [H]';
    }
  };

  const handleOpenLobby = (tab: 'create' | 'join' | 'arena' | 'single' = 'create') => {
    setLobbyTab(tab);
    const modal = document.getElementById('lobby-modal');
    modal?.classList.add('open');
  };

  const handleCloseLobby = () => {
    const modal = document.getElementById('lobby-modal');
    modal?.classList.remove('open');
  };

  const handleCreateRoom = () => {
    const win = window as unknown as {
      wizardChess?: {
        createMultiplayerRoom?: (side: string, timeControl: number) => void;
      };
    };
    if (win.wizardChess?.createMultiplayerRoom) {
      win.wizardChess.createMultiplayerRoom(mpSide, timeControl);
    }
  };

  const handleJoinRoom = () => {
    const input = document.getElementById('input-room-code') as HTMLInputElement | null;
    const code = (input?.value || quickCodeInput).trim().toUpperCase();
    if (!code) return;
    const win = window as unknown as {
      wizardChess?: {
        joinMultiplayerRoom?: (code: string) => void;
      };
    };
    if (win.wizardChess?.joinMultiplayerRoom) {
      win.wizardChess.joinMultiplayerRoom(code);
    }
  };

  const handleQuickJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCodeInput.trim()) return;
    const input = document.getElementById('input-room-code') as HTMLInputElement | null;
    if (input) input.value = quickCodeInput.trim().toUpperCase();
    handleJoinRoom();
    setStartPageOpen(false);
  };

  const handleStartSingle = (chosenSide: 'w' | 'b' = spSide) => {
    const win = window as unknown as {
      wizardChess?: {
        setSinglePlayerSide?: (side: string) => void;
        resetChessBoard?: (orient: boolean) => void;
      };
    };
    if (win.wizardChess?.setSinglePlayerSide) {
      win.wizardChess.setSinglePlayerSide(chosenSide);
    } else if (win.wizardChess?.resetChessBoard) {
      win.wizardChess.resetChessBoard(true);
    }
    handleCloseLobby();
    setStartPageOpen(false);
  };

  const handleStartPassAndPlay = () => {
    const win = window as unknown as {
      wizardChess?: {
        setPassAndPlay?: () => void;
        setSinglePlayerSide?: (side: string) => void;
      };
    };
    if (win.wizardChess?.setPassAndPlay) {
      win.wizardChess.setPassAndPlay();
    } else if (win.wizardChess?.setSinglePlayerSide) {
      win.wizardChess.setSinglePlayerSide('w');
    }
    handleCloseLobby();
    setStartPageOpen(false);
  };

  const handleLaunchMultiplayer = (initialTab: 'create' | 'join' = 'create') => {
    setStartPageOpen(false);
    handleOpenLobby(initialTab);
  };

  const handleCamSpeedChange = (val: number) => {
    setCamMoveSpeed(val);
    const win = window as unknown as {
      wizardChess?: { setCameraKeySpeedPercent?: (v: number) => void };
    };
    win.wizardChess?.setCameraKeySpeedPercent?.(val);
  };

  const handleCamRotChange = (val: number) => {
    setCamRotSpeed(val);
    const win = window as unknown as {
      wizardChess?: { setCameraRotSpeedPercent?: (v: number) => void };
    };
    win.wizardChess?.setCameraRotSpeedPercent?.(val);
  };

  const handleCycleWallStone = () => {
    const win = window as unknown as {
      wizardChess?: {
        nextWallStoneLook?: () => number;
        WALL_STONE_LOOKS?: Array<{ name: string }>;
      };
    };
    if (win.wizardChess?.nextWallStoneLook) {
      const nextIdx = win.wizardChess.nextWallStoneLook();
      setWallLookIdx(nextIdx);
    }
  };

  const handleCycleFloorStone = () => {
    const win = window as unknown as {
      wizardChess?: {
        nextFloorStoneLook?: () => number;
        FLOOR_STONE_LOOKS?: Array<{ name: string }>;
      };
    };
    if (win.wizardChess?.nextFloorStoneLook) {
      const nextIdx = win.wizardChess.nextFloorStoneLook();
      setFloorLookIdx(nextIdx);
    }
  };

  return (
    <>
      <div id="loading-overlay">
        <div className="loader-title">Wizard Chess</div>
        <div className="loader-bar-wrap">
          <div className="loader-bar" id="loader-bar"></div>
        </div>
        <div id="loader-text">Summoning Sanctum Architecture &amp; Sculpted Pieces...</div>
      </div>

      <div id="canvas-container"></div>

      <button
        type="button"
        className="hud-btn mobile-only-restore-ui"
        id="btn-mobile-show-ui"
        onClick={handleRestoreUI}
        title="Show HUD Controls"
      >
        Show UI
      </button>

      {/* Floating Opponent Event Toast */}
      <div id="opponent-toast" className="opponent-toast" role="alert" aria-live="assertive"></div>

      {/* =========================================================================
          AAA FULL-BLEED MOBILE & DESKTOP STARTING PAGE (COVERED VIEWPORT)
          ========================================================================= */}
      {startPageOpen && (
        <div className="start-fullscreen-hub" id="start-page-screen">
          {/* Full desktop covered background image */}
          <div className="start-bg-layer">
            <img
              src={FULLSCREEN_BG_IMG}
              alt="Gothic Sanctum Altar Hall"
              className="start-bg-img"
              referrerPolicy="no-referrer"
            />
            <div className="start-bg-vignette"></div>
            <div className="start-bg-particles" aria-hidden="true">
              <span className="ember-particle p1"></span>
              <span className="ember-particle p2"></span>
              <span className="ember-particle p3"></span>
              <span className="ember-particle p4"></span>
              <span className="ember-particle p5"></span>
            </div>
          </div>

          {/* Top Application Bar */}
          <header className="hub-top-bar">
            <div className="hub-brand-group">
              <div className="hub-brand-crest">
                <span className="hub-crest-icon">🧙‍♂️</span>
              </div>
              <div className="hub-brand-text">
                <div className="hub-brand-title">WIZARD CHESS</div>
                <div className="hub-brand-sub">ANDROID SANCTUM EDITION</div>
              </div>
            </div>

            <div className="hub-center-status">
              <span className="live-status-dot"></span>
              <span className="live-status-label">Sanctum Netcode Active</span>
              <span className="live-status-ping">&bull; Touch &amp; Haptics Enabled</span>
            </div>

            <div className="hub-profile-bar">
              <div className="hub-profile-chip" title="Player Sanctuary Profile">
                <div className="hub-avatar">♔</div>
                <div className="hub-user-info">
                  <div className="hub-username">Archmage Player</div>
                  <div className="hub-rating-pill">
                    <span className="rating-val">{playerStats.rating} ELO</span>
                    <span className="record-val">{playerStats.wins}W - {playerStats.losses}L</span>
                  </div>
                </div>
              </div>

              {isInstallable && (
                <button
                  type="button"
                  className="hub-install-app-btn"
                  onClick={handleInstallClick}
                  title="Install Wizard Chess on your Android Device"
                >
                  <span>Install App</span>
                  <span className="install-icon">📲</span>
                </button>
              )}

              <button
                type="button"
                className={`hub-icon-btn ${hapticsEnabled ? 'active' : ''}`}
                title={hapticsEnabled ? 'Disable Haptic Vibration' : 'Enable Haptic Vibration'}
                onClick={handleToggleHaptics}
              >
                {hapticsEnabled ? '📳' : '📴'}
              </button>

              <button
                type="button"
                className={`hub-icon-btn ${soundEnabled ? 'active' : ''}`}
                title={soundEnabled ? 'Mute Atmosphere' : 'Enable Sound'}
                onClick={() => setSoundEnabled((v) => !v)}
              >
                {soundEnabled ? '🔊' : '🔇'}
              </button>

              <button
                type="button"
                className="hub-enter-sanctum-btn"
                onClick={() => setStartPageOpen(false)}
                title="Enter the live 3D cathedral altar"
              >
                <span>Enter Board</span>
                <span className="btn-arrow">➔</span>
              </button>
            </div>
          </header>

          {/* Hub Main Stage Content Area */}
          <main className="hub-main-stage">
            {/* TAB 1: GAME MODES & QUICK PLAY */}
            {activeTab === 'play' && (
              <div className="hub-tab-panel animate-fade-in">
                {/* Hero Showcase Action Banner */}
                <section className="hub-hero-banner">
                  <div className="hero-banner-content">
                    <div className="hero-eyebrow">
                      <span className="hero-badge-runic">✦ GOTHIC ALTAR DUELS ✦</span>
                      <span className="hero-version">ANDROID PORTRAIT READY</span>
                    </div>
                    <h1 className="hero-title">COMMAND THE LIVING STONE</h1>
                    <p className="hero-description">
                      Pieces stride across the obsidian board, deliver devastating melee blows, and shatter enemy defenders into simulated physical stone debris with tactile haptic rumble.
                    </p>

                    <div className="hero-cta-cluster">
                      <button
                        type="button"
                        className="hero-btn-primary"
                        onClick={() => handleStartSingle('w')}
                      >
                        <span className="btn-icon">⚔️</span>
                        <span>QUICK PLAY (VS AI)</span>
                      </button>

                      <button
                        type="button"
                        className="hero-btn-gold"
                        onClick={() => handleLaunchMultiplayer('create')}
                      >
                        <span className="btn-icon">⚡</span>
                        <span>SUMMON DUEL ROOM</span>
                      </button>

                      {/* Quick Code Join Form */}
                      <form className="hero-quick-join" onSubmit={handleQuickJoinSubmit}>
                        <input
                          type="text"
                          className="hero-code-input"
                          placeholder="ROOM CODE"
                          maxLength={6}
                          value={quickCodeInput}
                          onChange={(e) => setQuickCodeInput(e.target.value.toUpperCase())}
                          aria-label="Quick Room Code"
                        />
                        <button type="submit" className="hero-code-btn" title="Join Room with Code">
                          Join 🗝️
                        </button>
                      </form>
                    </div>
                  </div>

                  <div className="hero-banner-media">
                    <img
                      src={HERO_BANNER_IMG}
                      alt="Gothic Cathedral Altar with Stone Statues"
                      className="hero-banner-img"
                      referrerPolicy="no-referrer"
                    />
                    <div className="hero-banner-gradient"></div>
                  </div>
                </section>

                {/* 3-Mode Mobile-App Style Cards Grid */}
                <div className="hub-modes-grid">
                  {/* Card 1: Solo Sanctum vs AI */}
                  <article className="hub-mode-card">
                    <div className="mode-card-header-badge">
                      <span className="badge-tag">MODE 01</span>
                      <span className="badge-pill">SOLO AI</span>
                    </div>

                    <div className="mode-media-wrap">
                      <img
                        src={SINGLE_PLAYER_IMG}
                        alt="Sculpted Stone Knight facing Black King statue"
                        className="mode-asset-img"
                        referrerPolicy="no-referrer"
                      />
                      <div className="mode-media-shade"></div>
                    </div>

                    <div className="mode-card-body">
                      <h2 className="mode-title">Solo Sanctum vs AI</h2>
                      <p className="mode-blurb">
                        Face the Cathedral engine with automated responses, melee capture framing, and checkmate King-topple physics.
                      </p>

                      {/* Side Allegiance Selector */}
                      <div className="mode-option-block">
                        <span className="option-label">Allegiance:</span>
                        <div className="allegiance-pills">
                          <button
                            type="button"
                            className={`allegiance-btn ${spSide === 'w' ? 'selected' : ''}`}
                            onClick={() => setSpSide('w')}
                          >
                            ♔ White (1st)
                          </button>
                          <button
                            type="button"
                            className={`allegiance-btn ${spSide === 'b' ? 'selected' : ''}`}
                            onClick={() => setSpSide('b')}
                          >
                            ♚ Black (2nd)
                          </button>
                        </div>
                      </div>

                      {/* AI Difficulty Selector */}
                      <div className="mode-option-block">
                        <span className="option-label">Difficulty:</span>
                        <div className="tier-pills">
                          <button
                            type="button"
                            className={`tier-btn ${aiTier === 'novice' ? 'selected' : ''}`}
                            onClick={() => setAiTier('novice')}
                          >
                            Acolyte
                          </button>
                          <button
                            type="button"
                            className={`tier-btn ${aiTier === 'knight' ? 'selected' : ''}`}
                            onClick={() => setAiTier('knight')}
                          >
                            Knight
                          </button>
                          <button
                            type="button"
                            className={`tier-btn ${aiTier === 'inquisitor' ? 'selected' : ''}`}
                            onClick={() => setAiTier('inquisitor')}
                          >
                            Inquisitor
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="mode-action-btn primary"
                        onClick={() => handleStartSingle(spSide)}
                      >
                        <span>Battle AI</span>
                        <span className="btn-glyph">➔</span>
                      </button>
                    </div>
                  </article>

                  {/* Card 2: Online Duels (Multiplayer) */}
                  <article className="hub-mode-card featured">
                    <div className="mode-card-header-badge gold">
                      <span className="badge-tag">MODE 02</span>
                      <span className="badge-pill gold">REAL-TIME WEBSOCKETS</span>
                    </div>

                    <div className="mode-media-wrap">
                      <img
                        src={MULTIPLAYER_DUEL_IMG}
                        alt="Two stone chess statues clashing in dramatic melee duel"
                        className="mode-asset-img"
                        referrerPolicy="no-referrer"
                      />
                      <div className="mode-media-shade"></div>
                    </div>

                    <div className="mode-card-body">
                      <h2 className="mode-title">Online Chamber Duels</h2>
                      <p className="mode-blurb">
                        Peer-to-peer real-time netcode, Blitz/Rapid clocks, live spectator chambers, in-game spell banter, and rematches.
                      </p>

                      {/* Time Controls */}
                      <div className="mode-option-block">
                        <span className="option-label">Match Clock:</span>
                        <div className="tier-pills">
                          <button
                            type="button"
                            className={`tier-btn ${timeControl === 0 ? 'selected' : ''}`}
                            onClick={() => setTimeControl(0)}
                          >
                            Untimed
                          </button>
                          <button
                            type="button"
                            className={`tier-btn ${timeControl === 180 ? 'selected' : ''}`}
                            onClick={() => setTimeControl(180)}
                          >
                            3m Blitz
                          </button>
                          <button
                            type="button"
                            className={`tier-btn ${timeControl === 300 ? 'selected' : ''}`}
                            onClick={() => setTimeControl(300)}
                          >
                            5m Rapid
                          </button>
                          <button
                            type="button"
                            className={`tier-btn ${timeControl === 600 ? 'selected' : ''}`}
                            onClick={() => setTimeControl(600)}
                          >
                            10m
                          </button>
                        </div>
                      </div>

                      {/* Dual Action Grid */}
                      <div className="duel-btn-group">
                        <button
                          type="button"
                          className="mode-action-btn gold"
                          onClick={() => handleLaunchMultiplayer('create')}
                        >
                          <span>Summon Chamber ⚔️</span>
                        </button>
                        <button
                          type="button"
                          className="mode-action-btn outline"
                          onClick={() => handleLaunchMultiplayer('join')}
                        >
                          <span>Join by Code 🗝️</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        className="arena-browse-link"
                        onClick={() => {
                          setActiveTab('rooms');
                        }}
                      >
                        Browse Open Sanctum Arena 🏛️ &rarr;
                      </button>
                    </div>
                  </article>

                  {/* Card 3: Pass & Play / Local Duel */}
                  <article className="hub-mode-card">
                    <div className="mode-card-header-badge">
                      <span className="badge-tag">MODE 03</span>
                      <span className="badge-pill">LOCAL 2-PLAYER</span>
                    </div>

                    <div className="mode-media-wrap">
                      <img
                        src={PASS_AND_PLAY_IMG}
                        alt="Cathedral altar stone chess set prepared for two commanders"
                        className="mode-asset-img"
                        referrerPolicy="no-referrer"
                      />
                      <div className="mode-media-shade"></div>
                    </div>

                    <div className="mode-card-body">
                      <h2 className="mode-title">Pass &amp; Play Duel</h2>
                      <p className="mode-blurb">
                        Two wizards on a single device or screen. Alternate turns directly on the obsidian altar without internet required.
                      </p>

                      <div className="pass-play-features">
                        <div className="feat-chip">✓ Mobile &amp; Tablet Ready</div>
                        <div className="feat-chip">✓ Full Melee Animations</div>
                        <div className="feat-chip">✓ In-Person Tabletop Feel</div>
                      </div>

                      <button
                        type="button"
                        className="mode-action-btn primary"
                        onClick={handleStartPassAndPlay}
                      >
                        <span>Start Local Match</span>
                        <span className="btn-glyph">➔</span>
                      </button>
                    </div>
                  </article>
                </div>
              </div>
            )}

            {/* TAB 2: ARENA & ROOMS LOBBY */}
            {activeTab === 'rooms' && (
              <div className="hub-tab-panel animate-fade-in rooms-panel-layout">
                <div className="hub-panel-header">
                  <div className="header-badge">MULTIPLAYER SANCTUM ARENA</div>
                  <h2 className="header-heading">Active Chambers &amp; Matchmaking</h2>
                  <p className="header-sub">
                    Summon an online room to receive an instant 4-character code, or enter an active room directly.
                  </p>
                </div>

                <div className="rooms-split-grid">
                  {/* Left: Quick Actions */}
                  <div className="rooms-action-column">
                    <div className="brutal-box">
                      <h3 className="box-title">Summon New Chamber</h3>
                      <p className="box-text">Host a private duel with customizable side &amp; clock settings.</p>
                      <button
                        type="button"
                        className="hero-btn-gold full-width"
                        onClick={() => handleLaunchMultiplayer('create')}
                      >
                        Create Chamber Now ⚔️
                      </button>
                    </div>

                    <div className="brutal-box">
                      <h3 className="box-title">Direct Code Entry</h3>
                      <p className="box-text">Enter your opponent&apos;s 4-character chamber code:</p>
                      <form onSubmit={handleQuickJoinSubmit} className="direct-code-form">
                        <input
                          type="text"
                          className="brutal-input"
                          placeholder="e.g. MAGE"
                          maxLength={6}
                          value={quickCodeInput}
                          onChange={(e) => setQuickCodeInput(e.target.value.toUpperCase())}
                        />
                        <button type="submit" className="hero-btn-primary full-width">
                          Enter Chamber 🗝️
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Right: Public Chambers List */}
                  <div className="rooms-list-column">
                    <div className="brutal-box full-height">
                      <div className="box-header-row">
                        <h3 className="box-title">Live Public Arena</h3>
                        <button
                          type="button"
                          className="hub-icon-btn small"
                          title="Refresh Chambers"
                          onClick={() => {
                            const win = window as unknown as { wizardChess?: { refreshArenaRooms?: () => void } };
                            win.wizardChess?.refreshArenaRooms?.();
                          }}
                        >
                          🔄 Refresh
                        </button>
                      </div>

                      <div className="open-chambers-feed">
                        <div className="chamber-item">
                          <div className="chamber-info">
                            <span className="chamber-code-tag">CODE: GOTH</span>
                            <span className="chamber-tc-tag">Blitz 3m</span>
                          </div>
                          <span className="chamber-status-tag">Waiting for Challenger...</span>
                          <button
                            type="button"
                            className="chamber-join-btn"
                            onClick={() => {
                              const input = document.getElementById('input-room-code') as HTMLInputElement | null;
                              if (input) input.value = 'GOTH';
                              handleJoinRoom();
                              setStartPageOpen(false);
                            }}
                          >
                            Fight ⚔️
                          </button>
                        </div>

                        <div className="chamber-item">
                          <div className="chamber-info">
                            <span className="chamber-code-tag">CODE: ARCH</span>
                            <span className="chamber-tc-tag">Rapid 5m</span>
                          </div>
                          <span className="chamber-status-tag">Host: Black ♚</span>
                          <button
                            type="button"
                            className="chamber-join-btn"
                            onClick={() => {
                              const input = document.getElementById('input-room-code') as HTMLInputElement | null;
                              if (input) input.value = 'ARCH';
                              handleJoinRoom();
                              setStartPageOpen(false);
                            }}
                          >
                            Fight ⚔️
                          </button>
                        </div>

                        <div className="chamber-empty-note">
                          <span>Want to duel with a friend? Summon a chamber and share the code or link!</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: OPTIONS & SANCTUM CUSTOMIZATION */}
            {activeTab === 'options' && (
              <div className="hub-tab-panel animate-fade-in options-panel-layout">
                <div className="hub-panel-header">
                  <div className="header-badge">CONFIGURATIONS</div>
                  <h2 className="header-heading">Cathedral Architecture &amp; Mobile Controls</h2>
                  <p className="header-sub">
                    Tune your touch sensitivity, haptic feedback rumble, Gothic masonry shaders, and altar stone reflections.
                  </p>
                </div>

                <div className="options-cards-grid">
                  <div className="brutal-box">
                    <h3 className="box-title">Touch, Camera &amp; Haptics</h3>
                    
                    <div className="opt-toggle-row">
                      <div className="opt-meta">
                        <span className="opt-name">Haptic Vibration on Moves &amp; Shatter</span>
                        <span className="opt-desc">Tactile physical rumble on Android hardware</span>
                      </div>
                      <button
                        type="button"
                        className={`hero-btn-primary small ${hapticsEnabled ? '' : 'outline'}`}
                        onClick={handleToggleHaptics}
                      >
                        {hapticsEnabled ? 'Haptics ON 📳' : 'Haptics OFF 📴'}
                      </button>
                    </div>

                    <div className="opt-slider-row">
                      <div className="opt-meta">
                        <span className="opt-name">WASD + R/F Flight Velocity</span>
                        <span className="opt-desc">Speed of free camera motion along the cathedral nave</span>
                      </div>
                      <div className="opt-input-wrap">
                        <input
                          type="range"
                          min="5"
                          max="120"
                          value={camMoveSpeed}
                          onChange={(e) => handleCamSpeedChange(Number(e.target.value))}
                          className="brutal-range"
                        />
                        <span className="opt-value-badge">{camMoveSpeed}%</span>
                      </div>
                    </div>

                    <div className="opt-slider-row">
                      <div className="opt-meta">
                        <span className="opt-name">Orbit &amp; Pitch Rate</span>
                        <span className="opt-desc">Angular speed when orbiting the obsidian altar</span>
                      </div>
                      <div className="opt-input-wrap">
                        <input
                          type="range"
                          min="5"
                          max="120"
                          value={camRotSpeed}
                          onChange={(e) => handleCamRotChange(Number(e.target.value))}
                          className="brutal-range"
                        />
                        <span className="opt-value-badge">{camRotSpeed}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="brutal-box">
                    <h3 className="box-title">Gothic Stone &amp; Architecture Finish</h3>
                    <div className="opt-toggle-row">
                      <div className="opt-meta">
                        <span className="opt-name">Cathedral Wall Ashlar Masonry</span>
                        <span className="opt-desc">Cycle textured stone styles and vault tints</span>
                      </div>
                      <button
                        type="button"
                        className="hero-btn-primary small"
                        onClick={handleCycleWallStone}
                      >
                        Cycle Stone Style ⟳
                      </button>
                    </div>

                    <div className="opt-toggle-row">
                      <div className="opt-meta">
                        <span className="opt-name">Obsidian Altar Polish &amp; Roughness</span>
                        <span className="opt-desc">Specular reflections on the chessboard platform</span>
                      </div>
                      <button
                        type="button"
                        className="hero-btn-gold small"
                        onClick={handleCycleFloorStone}
                      >
                        Cycle Altar Polish ⟳
                      </button>
                    </div>

                    {isInstallable && (
                      <div className="opt-toggle-row">
                        <div className="opt-meta">
                          <span className="opt-name">Install Android Game App</span>
                          <span className="opt-desc">Add Wizard Chess directly to your home screen</span>
                        </div>
                        <button
                          type="button"
                          className="hero-btn-gold small"
                          onClick={handleInstallClick}
                        >
                          Install App 📲
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="options-apply-row">
                  <button
                    type="button"
                    className="hero-btn-primary"
                    onClick={() => setStartPageOpen(false)}
                  >
                    Apply &amp; Return to Cathedral Altar ➔
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: ABOUT GAME & MELEE LORE */}
            {activeTab === 'about' && (
              <div className="hub-tab-panel animate-fade-in about-panel-layout">
                <div className="hub-panel-header">
                  <div className="header-badge">LORE &amp; COMBAT MECHANICS</div>
                  <h2 className="header-heading">The Legend of the Cathedral Sanctum</h2>
                  <p className="header-sub">
                    An unbroken fusion of centuries-old chess tactics with visceral cinematic 3D melee battles.
                  </p>
                </div>

                <div className="lore-cards-grid">
                  <div className="brutal-box">
                    <div className="lore-num">01</div>
                    <h3 className="box-title">Living Sculpted Statues</h3>
                    <p className="box-text">
                      The White Order is carved from radiant Carrara marble and forged silver. The Black Coven is sculpted from volcanic basalt and weathered bronze.
                    </p>
                  </div>

                  <div className="brutal-box">
                    <div className="lore-num">02</div>
                    <h3 className="box-title">Cinematic Standoff &amp; Melee Strike</h3>
                    <p className="box-text">
                      Capturing moves trigger an uninterrupted camera glide. Attackers step forward, raise their weapons, and smash the defender with bone-shattering force.
                    </p>
                  </div>

                  <div className="brutal-box">
                    <div className="lore-num">03</div>
                    <h3 className="box-title">Simulated Stone Shatter Physics</h3>
                    <p className="box-text">
                      Defeated pieces break apart into dynamic physical stone fragments that rebound across the board tiles with flash lighting and dust plumes.
                    </p>
                  </div>

                  <div className="brutal-box">
                    <div className="lore-num">04</div>
                    <h3 className="box-title">Android Touch Gestures</h3>
                    <p className="box-text">
                      Tap a piece to select/move. Drag with 1 finger to orbit around the altar. Pinch with 2 fingers to zoom. Drag with 2 fingers to pan.
                    </p>
                  </div>
                </div>

                <div className="options-apply-row">
                  <button
                    type="button"
                    className="hero-btn-primary"
                    onClick={() => setStartPageOpen(false)}
                  >
                    Enter Sanctum &amp; Commence Play ➔
                  </button>
                </div>
              </div>
            )}

            {/* TAB 5: VAULT & STATS */}
            {activeTab === 'vault' && (
              <div className="hub-tab-panel animate-fade-in vault-panel-layout">
                <div className="hub-panel-header">
                  <div className="header-badge">HALL OF RECORDS</div>
                  <h2 className="header-heading">Sanctum Vault &amp; Achievements</h2>
                  <p className="header-sub">Track your duel records, Elo rating progression, and battle accolades.</p>
                </div>

                <div className="stats-kpi-row">
                  <div className="kpi-card">
                    <span className="kpi-label">Sanctum Rating</span>
                    <span className="kpi-value gold">{playerStats.rating}</span>
                    <span className="kpi-sub">Apprentice Archmage</span>
                  </div>
                  <div className="kpi-card">
                    <span className="kpi-label">Total Matches</span>
                    <span className="kpi-value">{playerStats.wins + playerStats.losses + playerStats.draws}</span>
                    <span className="kpi-sub">Across All Modes</span>
                  </div>
                  <div className="kpi-card">
                    <span className="kpi-label">Victories</span>
                    <span className="kpi-value green">{playerStats.wins}</span>
                    <span className="kpi-sub">70% Win Rate</span>
                  </div>
                  <div className="kpi-card">
                    <span className="kpi-label">Pieces Shattered</span>
                    <span className="kpi-value">{playerStats.wins * 12 + 48}</span>
                    <span className="kpi-sub">Total Captured Stone</span>
                  </div>
                </div>

                <div className="options-apply-row">
                  <button
                    type="button"
                    className="hero-btn-primary"
                    onClick={() => setStartPageOpen(false)}
                  >
                    Return to Board ➔
                  </button>
                </div>
              </div>
            )}
          </main>

          {/* Bottom Mobile-App Navigation Dock */}
          <nav className="hub-bottom-dock" aria-label="Sanctum Main Navigation">
            <button
              type="button"
              className={`dock-btn ${activeTab === 'play' ? 'active' : ''}`}
              onClick={() => setActiveTab('play')}
            >
              <span className="dock-icon">⚔️</span>
              <span className="dock-label">Modes</span>
            </button>

            <button
              type="button"
              className={`dock-btn ${activeTab === 'rooms' ? 'active' : ''}`}
              onClick={() => setActiveTab('rooms')}
            >
              <span className="dock-icon">🏛️</span>
              <span className="dock-label">Arena Rooms</span>
            </button>

            <button
              type="button"
              className={`dock-btn ${activeTab === 'options' ? 'active' : ''}`}
              onClick={() => setActiveTab('options')}
            >
              <span className="dock-icon">⚙️</span>
              <span className="dock-label">Settings</span>
            </button>

            <button
              type="button"
              className={`dock-btn ${activeTab === 'about' ? 'active' : ''}`}
              onClick={() => setActiveTab('about')}
            >
              <span className="dock-icon">📜</span>
              <span className="dock-label">Lore &amp; Rules</span>
            </button>

            <button
              type="button"
              className={`dock-btn ${activeTab === 'vault' ? 'active' : ''}`}
              onClick={() => setActiveTab('vault')}
            >
              <span className="dock-icon">🏆</span>
              <span className="dock-label">Vault</span>
            </button>
          </nav>
        </div>
      )}

      {/* TOP HUD BAR (During 3D Board Play) */}
      <div id="hud-top">
        <div className="hud-group" id="hud-left">
          <div
            className="brand-pill"
            onClick={() => setStartPageOpen(true)}
            title="Open Main Starting Page Menu"
            style={{ cursor: 'pointer' }}
          >
            <span className="brand-icon">🧙‍♂️</span>
            <span className="brand-title">Wizard Chess</span>
          </div>

          <div className="status-pill" id="status-pill">
            <span className="turn-dot" id="turn-dot"></span>
            <span id="turn-text">White to Move</span>
            <span className="mode-badge" id="mode-badge">Playing as White</span>
          </div>

          {/* Active Multiplayer Chamber Pill */}
          <div
            className="room-pill"
            id="room-pill"
            style={{ display: 'none' }}
            title="Active Chamber Status (Click for Chamber Info)"
            onClick={() => handleOpenLobby('create')}
          >
            <span className="room-icon">⚔️</span>
            <span className="room-code-tag">
              Chamber: <strong id="hud-room-code">----</strong>
            </span>
            <span className="room-status-badge" id="hud-room-status">
              Waiting...
            </span>
            <span className="hud-clock" id="hud-clock-white" style={{ display: 'none' }}></span>
            <span className="hud-clock" id="hud-clock-black" style={{ display: 'none' }}></span>
          </div>
        </div>

        <button
          type="button"
          className={`hud-btn mobile-controls-trigger ${mobileSheetOpen ? 'active' : ''}`}
          id="btn-mobile-controls"
          aria-expanded={mobileSheetOpen}
          aria-controls="hud-right"
          onClick={() => setMobileSheetOpen((prev) => !prev)}
        >
          {mobileSheetOpen ? 'Close' : 'Controls'}
        </button>

        <div
          className={`mobile-sheet-backdrop ${mobileSheetOpen ? 'open' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setMobileSheetOpen(false);
          }}
          aria-hidden="true"
        ></div>

        <div
          className={`hud-group ${mobileSheetOpen ? 'mobile-sheet-open' : ''}`}
          id="hud-right"
        >
          <div
            className="mobile-sheet-handle-wrap"
            onClick={(e) => {
              e.stopPropagation();
              setMobileSheetOpen(false);
            }}
            aria-hidden="true"
          >
            <div className="mobile-sheet-handle"></div>
          </div>

          <div className="mobile-sheet-header">
            <span className="mobile-sheet-title">Sanctum Controls</span>
            <button
              type="button"
              className="mobile-sheet-close"
              id="btn-mobile-sheet-close"
              onClick={(e) => {
                e.stopPropagation();
                setMobileSheetOpen(false);
              }}
              aria-label="Close Controls"
            >
              Close ✕
            </button>
          </div>

          <div className="mobile-sheet-section-label">Online &amp; Game Mode</div>

          {/* Return to Starting Page / Menu */}
          <button
            type="button"
            className="hud-btn"
            id="btn-main-menu"
            title="Return to Starting Page / Main Menu"
            onClick={() => {
              setMobileSheetOpen(false);
              setStartPageOpen(true);
            }}
          >
            Menu ☰
          </button>

          {/* Primary Multiplayer Trigger */}
          <button
            type="button"
            className="hud-btn primary"
            id="btn-lobby"
            title="Open Multiplayer Matchmaking Chamber"
            onClick={() => {
              setMobileSheetOpen(false);
              handleOpenLobby('create');
            }}
          >
            Play Online ⚔️
          </button>

          <button
            type="button"
            className="hud-btn"
            id="btn-toggle-chat"
            title="Open In-Game Chat &amp; Spells"
            onClick={() => {
              setMobileSheetOpen(false);
              setChatOpen((prev) => !prev);
            }}
          >
            Chat &amp; Emotes 💬
          </button>

          <button
            type="button"
            className="hud-btn"
            id="btn-side-toggle"
            title="Switch between Playing as White and Playing as Black"
            onClick={() => setMobileSheetOpen(false)}
          >
            Play as Black
          </button>

          <button
            type="button"
            className="hud-btn"
            id="btn-ai-move"
            title="Let the AI make the next move immediately"
            onClick={() => setMobileSheetOpen(false)}
          >
            AI Move
          </button>

          <button
            type="button"
            className="hud-btn danger-hover"
            id="btn-resign"
            style={{ display: 'none' }}
            title="Yield the match and resign the Sanctum"
            onClick={() => setMobileSheetOpen(false)}
          >
            Resign 🏳️
          </button>

          <button
            type="button"
            className="hud-btn"
            id="btn-reset"
            title="Start a fresh game on the altar"
            onClick={() => setMobileSheetOpen(false)}
          >
            New Game
          </button>

          <div className="hud-divider" aria-hidden="true"></div>
          <div className="mobile-sheet-section-label">
            <span>Camera Views</span>
            <span className="mobile-sheet-section-sub">Tap active view to flip</span>
          </div>

          <button
            className="hud-btn active"
            id="btn-cam-player"
            title="Player Camera (Click again to flip White / Black view)"
          >
            Player Cam
          </button>
          <button
            className="hud-btn"
            id="btn-cam-top"
            title="Overhead Board View (Click again to flip White / Black orientation)"
          >
            Overhead
          </button>
          <button
            className="hud-btn"
            id="btn-cam-side"
            title="Side Profile View (Click again to switch East / West side)"
          >
            Side
          </button>
          <button
            className="hud-btn"
            id="btn-cam-wide"
            title="Wide Cathedral View (Click again to switch North Rose / South Narthex)"
          >
            Cathedral
          </button>

          <div className="hud-divider" aria-hidden="true"></div>
          <div className="mobile-sheet-section-label">Display &amp; Gestures</div>

          <button
            className="hud-btn"
            id="btn-hide-ui"
            title="Toggle HUD visibility (Shortcut: H)"
            onClick={() => setMobileSheetOpen(false)}
          >
            Hide UI [H]
          </button>

          <div className="mobile-sheet-hint">
            <strong>Touch:</strong> Tap Piece to Move &nbsp;&bull;&nbsp; 1-Finger Drag: Orbit &nbsp;&bull;&nbsp; 2-Finger Drag: Pan &nbsp;&bull;&nbsp; Pinch: Zoom
          </div>
        </div>
      </div>

      {/* IN-GAME ANDROID THUMB ACTION DECK (Floating Ergonomic Reach Zone) */}
      {!startPageOpen && (
        <div className="mobile-thumb-deck" id="mobile-thumb-deck" role="toolbar" aria-label="Game Quick Deck">
          <button
            type="button"
            className="thumb-deck-btn"
            onClick={() => {
              const btn = document.getElementById('btn-cam-player');
              btn?.click();
            }}
            title="Flip / Reset Camera Perspective"
          >
            <span className="thumb-deck-icon">🔄</span>
            <span className="thumb-deck-text">Cam</span>
          </button>

          <button
            type="button"
            className="thumb-deck-btn"
            onClick={() => {
              const btn = document.getElementById('btn-ai-move');
              btn?.click();
            }}
            title="Trigger AI Move"
          >
            <span className="thumb-deck-icon">🤖</span>
            <span className="thumb-deck-text">AI Move</span>
          </button>

          <button
            type="button"
            className="thumb-deck-btn primary"
            onClick={() => handleOpenLobby('create')}
            title="Online Chamber Lobby"
          >
            <span className="thumb-deck-icon">⚔️</span>
            <span className="thumb-deck-text">Duel</span>
          </button>

          <button
            type="button"
            className="thumb-deck-btn"
            onClick={() => setChatOpen((prev) => !prev)}
            title="Spells & Emote Chat"
          >
            <span className="thumb-deck-icon">💬</span>
            <span className="thumb-deck-text">Spells</span>
          </button>

          <button
            type="button"
            className={`thumb-deck-btn ${hapticsEnabled ? 'active' : ''}`}
            onClick={handleToggleHaptics}
            title="Toggle Haptic Rumble"
          >
            <span className="thumb-deck-icon">{hapticsEnabled ? '📳' : '📴'}</span>
            <span className="thumb-deck-text">Vibe</span>
          </button>

          <button
            type="button"
            className="thumb-deck-btn"
            onClick={() => setStartPageOpen(true)}
            title="Return to Main Sanctum Menu"
          >
            <span className="thumb-deck-icon">☰</span>
            <span className="thumb-deck-text">Menu</span>
          </button>
        </div>
      )}

      {/* BOTTOM HUD */}
      <div id="hud-bottom">
        <div className="hint-pill" id="controls-hint">
          <strong>Controls:</strong> Tap Piece to Move &nbsp;&bull;&nbsp; 1-Finger Drag: Orbit &nbsp;&bull;&nbsp; Pinch: Zoom &nbsp;&bull;&nbsp; 2-Finger Drag: Pan &nbsp;&bull;&nbsp; WASD: Fly Cam
        </div>
        <div className="captured-pill" id="captured-tray"></div>
      </div>

      {/* IN-GAME CHAT & WIZARD EMOTES DRAWER */}
      <div className={`chat-drawer ${chatOpen ? 'open' : ''}`} id="chat-drawer">
        <div className="chat-drawer-header">
          <div className="chat-drawer-title">
            <span>⚔️ Sanctum Chat &amp; Spells</span>
          </div>
          <button
            type="button"
            className="chat-close-btn"
            id="btn-close-chat"
            onClick={() => setChatOpen(false)}
            aria-label="Close chat"
          >
            ✕
          </button>
        </div>

        <div className="chat-emotes-bar">
          <span className="chat-emotes-label">Quick Emotes:</span>
          <div className="chat-emotes-grid">
            <button type="button" className="btn-quick-emote" data-emote="⚔️ En garde!">
              ⚔️ En garde!
            </button>
            <button type="button" className="btn-quick-emote" data-emote="⚡ Ancient magic strikes!">
              ⚡ Ancient magic!
            </button>
            <button type="button" className="btn-quick-emote" data-emote="👑 Check! Defend your King!">
              👑 Check!
            </button>
            <button type="button" className="btn-quick-emote" data-emote="✨ Well played!">
              ✨ Well played!
            </button>
            <button type="button" className="btn-quick-emote" data-emote="🛡️ Impenetrable defense!">
              🛡️ Defense!
            </button>
            <button type="button" className="btn-quick-emote" data-emote="💀 Surrender the throne!">
              💀 Yield!
            </button>
          </div>
        </div>

        <div className="chat-messages" id="mp-chat-messages">
          <div className="chat-msg sys">
            <div className="chat-msg-header">
              <span className="chat-sender sys">Sanctum</span>
            </div>
            <div className="chat-text">Welcome to the Wizard Chess Sanctum. Challenge another wizard or type a spell!</div>
          </div>
        </div>

        <div className="chat-input-bar">
          <input
            type="text"
            id="input-chat-text"
            className="chat-input"
            placeholder="Type a message to your opponent..."
            maxLength={160}
          />
          <button type="button" id="btn-send-chat" className="chat-send-btn">
            Send
          </button>
        </div>
      </div>

      {/* MULTIPLAYER LOBBY MODAL */}
      <div className="lobby-modal-backdrop" id="lobby-modal">
        <div className="lobby-modal-container">
          <div className="lobby-modal-header">
            <div className="lobby-title-wrap">
              <span className="lobby-ornament">✦ SANCTUM CHAMBER ✦</span>
              <h2 className="lobby-title">Multiplayer Wizard Chess</h2>
            </div>
            <button
              type="button"
              className="lobby-close-btn"
              id="btn-close-lobby"
              onClick={handleCloseLobby}
              aria-label="Close Modal"
            >
              ✕
            </button>
          </div>

          {/* Modal Tab Bar */}
          <div className="lobby-tabs">
            <button
              type="button"
              className={`lobby-tab ${lobbyTab === 'create' ? 'active' : ''}`}
              id="tab-multi"
              onClick={() => setLobbyTab('create')}
            >
              ⚔️ Create Chamber
            </button>
            <button
              type="button"
              className={`lobby-tab ${lobbyTab === 'join' ? 'active' : ''}`}
              id="tab-multi-join"
              onClick={() => setLobbyTab('join')}
            >
              🗝️ Join by Code
            </button>
            <button
              type="button"
              className={`lobby-tab ${lobbyTab === 'arena' ? 'active' : ''}`}
              id="tab-arena"
              onClick={() => {
                setLobbyTab('arena');
                const win = window as unknown as { wizardChess?: { refreshArenaRooms?: () => void } };
                win.wizardChess?.refreshArenaRooms?.();
              }}
            >
              🏛️ Open Arena
            </button>
            <button
              type="button"
              className={`lobby-tab ${lobbyTab === 'single' ? 'active' : ''}`}
              id="tab-single"
              onClick={() => setLobbyTab('single')}
            >
              🤖 Solo AI
            </button>
          </div>

          <div className="lobby-body">
            {/* TAB 1: CREATE CHAMBER */}
            <div
              className="lobby-panel"
              id="panel-multi"
              style={{ display: lobbyTab === 'create' ? 'block' : 'none' }}
            >
              <div className="panel-section">
                <label className="section-label">Select Your Side</label>
                <div className="side-picker">
                  <button
                    type="button"
                    className={`side-option ${mpSide === 'w' ? 'selected' : ''}`}
                    id="pick-mp-white"
                    onClick={() => setMpSide('w')}
                  >
                    <span className="side-crown">♔</span>
                    <span className="side-name">White</span>
                    <span className="side-sub">Strikes First</span>
                  </button>
                  <button
                    type="button"
                    className={`side-option ${mpSide === 'b' ? 'selected' : ''}`}
                    id="pick-mp-black"
                    onClick={() => setMpSide('b')}
                  >
                    <span className="side-crown">♚</span>
                    <span className="side-name">Black</span>
                    <span className="side-sub">Counter-Attack</span>
                  </button>
                  <button
                    type="button"
                    className={`side-option ${mpSide === 'rand' ? 'selected' : ''}`}
                    id="pick-mp-rand"
                    onClick={() => setMpSide('rand')}
                  >
                    <span className="side-crown">🎲</span>
                    <span className="side-name">Random</span>
                    <span className="side-sub">Sanctum Choice</span>
                  </button>
                </div>
              </div>

              <div className="panel-section">
                <label className="section-label">Clock / Time Control</label>
                <div className="tc-picker">
                  <button
                    type="button"
                    className={`tc-option ${timeControl === 0 ? 'selected' : ''}`}
                    id="tc-untimed"
                    onClick={() => setTimeControl(0)}
                  >
                    Casual (Untimed)
                  </button>
                  <button
                    type="button"
                    className={`tc-option ${timeControl === 180 ? 'selected' : ''}`}
                    id="tc-3m"
                    onClick={() => setTimeControl(180)}
                  >
                    3 min Blitz
                  </button>
                  <button
                    type="button"
                    className={`tc-option ${timeControl === 300 ? 'selected' : ''}`}
                    id="tc-5m"
                    onClick={() => setTimeControl(300)}
                  >
                    5 min Rapid
                  </button>
                  <button
                    type="button"
                    className={`tc-option ${timeControl === 600 ? 'selected' : ''}`}
                    id="tc-10m"
                    onClick={() => setTimeControl(600)}
                  >
                    10 min Classical
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="action-btn-primary"
                id="btn-create-room"
                onClick={handleCreateRoom}
              >
                Summon Sanctum Chamber ⚔️
              </button>

              {/* Room Created Success Panel */}
              <div className="room-created-panel" id="room-created-panel" style={{ display: 'none' }}>
                <div className="created-banner">Chamber Summoned!</div>
                <div className="room-code-display">
                  <span className="code-label">Chamber Code:</span>
                  <span className="code-text" id="modal-room-code">
                    ----
                  </span>
                </div>
                <div className="room-actions-row">
                  <button type="button" className="hud-btn" id="btn-copy-code">
                    Copy Code
                  </button>
                  <button type="button" className="hud-btn" id="btn-copy-link">
                    Copy Invite Link
                  </button>
                  <button type="button" className="hud-btn primary" id="btn-enter-created-room">
                    Enter Chamber
                  </button>
                </div>
                <div className="waiting-pulse">
                  <span className="pulse-dot"></span>
                  <span id="mp-status-msg">Waiting for Player 2 to enter the Sanctum...</span>
                </div>
              </div>
            </div>

            {/* TAB 2: JOIN BY CODE */}
            <div
              className="lobby-panel"
              id="panel-multi-join"
              style={{ display: lobbyTab === 'join' ? 'block' : 'none' }}
            >
              <div className="panel-section">
                <label className="section-label">Enter 4-Character Chamber Code</label>
                <div className="join-input-wrap">
                  <input
                    type="text"
                    id="input-room-code"
                    className="join-input"
                    placeholder="e.g. GOTH"
                    maxLength={6}
                    autoComplete="off"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="action-btn-primary join-action"
                    id="btn-join-room"
                    onClick={handleJoinRoom}
                  >
                    Enter Chamber 🗝️
                  </button>
                </div>
                <div className="input-hint">
                  Or open an invite link formatted as <code>?room=CODE</code> in your browser.
                </div>
                <div className="mp-status-msg" id="mp-status-msg-join"></div>
              </div>
            </div>

            {/* TAB 3: OPEN ARENA */}
            <div
              className="lobby-panel"
              id="panel-arena"
              style={{ display: lobbyTab === 'arena' ? 'block' : 'none' }}
            >
              <div className="arena-header">
                <span className="section-label">Active Open Chambers Seeking Challengers</span>
                <button type="button" className="hud-btn" id="btn-refresh-arena">
                  Refresh 🔄
                </button>
              </div>
              <div className="arena-room-list" id="arena-room-list">
                <div className="arena-empty-msg">Scanning Sanctum chambers...</div>
              </div>
            </div>

            {/* TAB 4: SOLO AI */}
            <div
              className="lobby-panel"
              id="panel-single"
              style={{ display: lobbyTab === 'single' ? 'block' : 'none' }}
            >
              <div className="panel-section">
                <label className="section-label">Choose Your Allegiance vs Cathedral AI</label>
                <div className="side-picker">
                  <button
                    type="button"
                    className={`side-option ${spSide === 'w' ? 'selected' : ''}`}
                    id="pick-sp-white"
                    onClick={() => setSpSide('w')}
                  >
                    <span className="side-crown">♔</span>
                    <span className="side-name">White</span>
                    <span className="side-sub">Player Moves First</span>
                  </button>
                  <button
                    type="button"
                    className={`side-option ${spSide === 'b' ? 'selected' : ''}`}
                    id="pick-sp-black"
                    onClick={() => setSpSide('b')}
                  >
                    <span className="side-crown">♚</span>
                    <span className="side-name">Black</span>
                    <span className="side-sub">AI Moves First</span>
                  </button>
                </div>
              </div>
              <button
                type="button"
                className="action-btn-primary"
                id="btn-start-single"
                onClick={() => handleStartSingle(spSide)}
              >
                Commence Solo Battle ⚔️
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CHECKMATE OVERLAY */}
      <div id="checkmate-overlay" role="status" aria-live="polite">
        <div className="checkmate-banner">
          <div className="checkmate-ornament">✦ &nbsp; Sanctum Judgment &nbsp; ✦</div>
          <div className="checkmate-crown" id="checkmate-crown">
            ♔
          </div>
          <div className="checkmate-title" id="checkmate-title">
            Checkmate
          </div>
          <div className="checkmate-rule"></div>
          <div className="checkmate-subtitle" id="checkmate-subtitle">
            White Triumphs • The Black King Has Fallen
          </div>
          <div className="checkmate-actions">
            <button className="checkmate-btn" id="btn-checkmate-rematch">
              Offer Rematch ⚔️
            </button>
            <button className="checkmate-btn" id="btn-checkmate-replay">
              Replay King Fall
            </button>
            <button className="checkmate-btn" id="btn-checkmate-newgame">
              New Game
            </button>
            <button className="checkmate-btn secondary" id="btn-checkmate-dismiss">
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
