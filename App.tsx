
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GameState, Selection, Card as CardType, Suit, Rank, GameStats, CardBackTheme, GameSpeed, DragState } from './types';
import { initGame, canMoveToTableau, canMoveToFoundation } from './services/solitaireLogic';
import { soundService } from './services/soundService';
import Card from './components/Card';
import { SuitIcon } from './constants';

const STATS_KEY = 'neon-solitaire-stats';
const THEME_KEY = 'neon-solitaire-theme';
const SOUND_KEY = 'neon-solitaire-sound';
const SPEED_KEY = 'neon-solitaire-speed';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(initGame());
  const [selection, setSelection] = useState<Selection>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Fix: Added state to track current elapsed time
  const [currentTime, setCurrentTime] = useState(0);

  const tableauRefs = useRef<(HTMLDivElement | null)[]>([]);
  const foundationRefs = useRef<{ [key in Suit]?: HTMLDivElement | null }>({});

  const [gameSpeed, setGameSpeed] = useState<GameSpeed>(() => {
    const saved = localStorage.getItem(SPEED_KEY);
    return saved ? (parseFloat(saved) as GameSpeed) : 1;
  });

  useEffect(() => {
    soundService.setSpeed(gameSpeed);
    localStorage.setItem(SPEED_KEY, gameSpeed.toString());
  }, [gameSpeed]);

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(SOUND_KEY);
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    soundService.setEnabled(soundEnabled);
    localStorage.setItem(SOUND_KEY, soundEnabled.toString());
  }, [soundEnabled]);

  const [backTheme, setBackTheme] = useState<CardBackTheme>(() => {
    return (localStorage.getItem(THEME_KEY) as CardBackTheme) || 'blue';
  });

  const [stats, setStats] = useState<GameStats>(() => {
    const saved = localStorage.getItem(STATS_KEY);
    return saved ? JSON.parse(saved) : {
      totalGames: 0,
      totalWins: 0,
      bestMoves: null,
      fastestTime: null,
      longestTime: null
    };
  });

  // Fix: Timer effect to update currentTime while game is running
  useEffect(() => {
    // Replaced NodeJS.Timeout with any to fix build error in browser environment where NodeJS namespace is not available
    let interval: any;
    if (gameState.startTime && !gameState.isGameOver) {
      interval = setInterval(() => {
        setCurrentTime(Date.now() - gameState.startTime!);
      }, 1000);
    } else if (!gameState.startTime) {
      setCurrentTime(0);
    }
    return () => clearInterval(interval);
  }, [gameState.startTime, gameState.isGameOver]);

  useEffect(() => {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, backTheme);
  }, [backTheme]);

  useEffect(() => {
    let changed = false;
    const newTableau = gameState.tableau.map(pile => {
      if (pile.length > 0 && !pile[pile.length - 1].isFaceUp) {
        changed = true;
        const newPile = [...pile];
        newPile[newPile.length - 1].isFaceUp = true;
        return newPile;
      }
      return pile;
    });

    if (changed) {
      setGameState(prev => ({ ...prev, tableau: newTableau }));
      soundService.playCardMove();
    }
  }, [gameState.tableau]);

  useEffect(() => {
    // Fix: Explicitly cast Object.values results to Card[][] to avoid 'unknown' type error on 'pile.length'
    const totalFoundation = (Object.values(gameState.foundation) as CardType[][]).reduce((acc, pile) => acc + pile.length, 0);
    if (totalFoundation === 52 && !gameState.isGameOver) {
      const gameDuration = gameState.startTime ? Date.now() - gameState.startTime : 0;
      setGameState(prev => ({ ...prev, isGameOver: true }));
      soundService.playWin();
      setStats(prev => ({
        ...prev,
        totalWins: prev.totalWins + 1,
        bestMoves: prev.bestMoves === null ? gameState.movesCount : Math.min(prev.bestMoves, gameState.movesCount),
        fastestTime: prev.fastestTime === null ? gameDuration : Math.min(prev.fastestTime, gameDuration),
        longestTime: prev.longestTime === null ? gameDuration : Math.max(prev.longestTime, gameDuration)
      }));
    }
  }, [gameState.foundation, gameState.isGameOver, gameState.movesCount, gameState.startTime]);

  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (dragState) {
        setDragState(prev => prev ? ({ ...prev, currentPos: { x: e.clientX, y: e.clientY } }) : null);
      }
    };
    const handleGlobalPointerUp = (e: PointerEvent) => {
      if (dragState) {
        const target = findDropTarget(e.clientX, e.clientY);
        if (target) attemptMove(dragState.source, target);
        setDragState(null);
      }
    };
    if (dragState) {
      window.addEventListener('pointermove', handleGlobalPointerMove);
      window.addEventListener('pointerup', handleGlobalPointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
    };
  }, [dragState]);

  const findDropTarget = (x: number, y: number): Selection => {
    for (const suit of Object.values(Suit)) {
      const ref = foundationRefs.current[suit as Suit];
      if (ref) {
        const rect = ref.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return { source: 'foundation', suit: suit as Suit };
      }
    }
    for (let i = 0; i < tableauRefs.current.length; i++) {
      const ref = tableauRefs.current[i];
      if (ref) {
        const rect = ref.getBoundingClientRect();
        if (x >= rect.left - 10 && x <= rect.right + 10 && y >= rect.top && y <= rect.bottom + 400) return { source: 'tableau', pileIndex: i };
      }
    }
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent, src: Selection) => {
    if (!src) return;
    let cards: CardType[] = [];
    if (src.source === 'tableau' && src.pileIndex !== undefined && src.cardIndex !== undefined) {
      cards = gameState.tableau[src.pileIndex].slice(src.cardIndex);
    } else if (src.source === 'waste') {
      cards = [gameState.waste[gameState.waste.length - 1]];
    } else if (src.source === 'foundation' && src.suit !== undefined) {
      const pile = gameState.foundation[src.suit];
      cards = [pile[pile.length - 1]];
    }
    if (cards.length > 0 && cards[0].isFaceUp) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setDragState({
        source: src,
        cards,
        startPos: { x: e.clientX, y: e.clientY },
        currentPos: { x: e.clientX, y: e.clientY },
        offset: { x: e.clientX - rect.left, y: e.clientY - rect.top }
      });
      setSelection(src);
    }
  };

  const handleNewGame = () => {
    setGameState(initGame());
    setSelection(null);
    setStats(prev => ({ ...prev, totalGames: prev.totalGames + 1 }));
    soundService.playShuffle();
  };

  const handleStockClick = () => {
    soundService.playCardMove();
    if (gameState.stock.length === 0) {
      setGameState(prev => ({
        ...prev,
        stock: [...prev.waste].reverse().map(c => ({ ...c, isFaceUp: false })),
        waste: [],
        movesCount: prev.movesCount + 1
      }));
    } else {
      const nextCard = { ...gameState.stock[gameState.stock.length - 1], isFaceUp: true };
      setGameState(prev => ({
        ...prev,
        stock: prev.stock.slice(0, -1),
        waste: [...prev.waste, nextCard],
        movesCount: prev.movesCount + 1
      }));
    }
    setSelection(null);
  };

  const selectCard = (src: Selection) => {
    if (!src) return;
    if (selection && selection !== src) {
      if (attemptMove(selection, src)) {
        setSelection(null);
        return;
      }
    }
    setSelection(src);
  };

  const attemptMove = (from: Selection, to: Selection): boolean => {
    if (!from || !to) return false;
    if (from.source === to.source && from.pileIndex === to.pileIndex && from.suit === to.suit) return false;
    let cardsToMove: CardType[] = [];
    if (from.source === 'tableau' && from.pileIndex !== undefined && from.cardIndex !== undefined) {
      cardsToMove = gameState.tableau[from.pileIndex].slice(from.cardIndex);
    } else if (from.source === 'waste') {
      const lastWaste = gameState.waste[gameState.waste.length - 1];
      if (lastWaste) cardsToMove = [lastWaste];
    } else if (from.source === 'foundation' && from.suit !== undefined) {
      const pile = gameState.foundation[from.suit];
      if (pile.length > 0) cardsToMove = [pile[pile.length - 1]];
    }
    if (cardsToMove.length === 0) return false;
    const mainCard = cardsToMove[0];
    if (to.source === 'tableau' && to.pileIndex !== undefined) {
      const targetPile = gameState.tableau[to.pileIndex];
      if (canMoveToTableau(mainCard, targetPile)) {
        setGameState(prev => {
          const newTableau = prev.tableau.map((p, i) => {
            if (i === from.pileIndex) return p.slice(0, from.cardIndex);
            if (i === to.pileIndex) return [...p, ...cardsToMove];
            return p;
          });
          const newWaste = from.source === 'waste' ? prev.waste.slice(0, -1) : prev.waste;
          const newFoundation = (from.source === 'foundation' && from.suit) ? { ...prev.foundation, [from.suit]: prev.foundation[from.suit].slice(0, -1) } : prev.foundation;
          return { ...prev, tableau: newTableau, waste: newWaste, foundation: newFoundation, movesCount: prev.movesCount + 1 };
        });
        soundService.playCardMove();
        return true;
      }
    }
    if (to.source === 'foundation' && cardsToMove.length === 1) {
      const actualSuit = mainCard.suit;
      const targetPile = gameState.foundation[actualSuit];
      if (canMoveToFoundation(mainCard, targetPile)) {
        setGameState(prev => {
          const newFoundation = { ...prev.foundation, [actualSuit]: [...targetPile, mainCard] };
          const newTableau = from.source === 'tableau' ? prev.tableau.map((p, i) => i === from.pileIndex ? p.slice(0, from.cardIndex) : p) : prev.tableau;
          const newWaste = from.source === 'waste' ? prev.waste.slice(0, -1) : prev.waste;
          return { ...prev, foundation: newFoundation, tableau: newTableau, waste: newWaste, movesCount: prev.movesCount + 1 };
        });
        soundService.playCardMove();
        return true;
      }
    }
    return false;
  };

  const formatTime = (ms: number | null) => {
    if (ms === null) return '00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const themes: { id: CardBackTheme, color: string, name: string }[] = [
    { id: 'blue', color: 'bg-[#001a33] border-[#00f2ff]', name: 'Laser Blue' },
    { id: 'red', color: 'bg-[#2a0015] border-[#ff007f]', name: 'Cyber Pink' },
    { id: 'green', color: 'bg-[#002211] border-[#39ff14]', name: 'Toxic Lime' },
    { id: 'black', color: 'bg-[#0f0f15] border-[#7f00ff]', name: 'Deep Void' },
    { id: 'gold', color: 'bg-[#221a00] border-[#ffcc00]', name: 'Neon Sun' },
  ];

  return (
    <div className="h-screen w-screen flex flex-col items-center p-2 md:p-6 overflow-hidden">
      {/* HUD - Glassmorphism Neon */}
      <div className="w-full max-w-5xl flex justify-between items-center mb-4 md:mb-8 bg-black/40 border border-white/10 p-3 md:p-5 rounded-2xl backdrop-blur-xl shadow-[0_0_20px_rgba(0,0,0,0.5)] z-[50]">
        <div className="flex gap-4 md:gap-8">
          <div className="flex flex-col">
            <span className="text-[10px] md:text-xs text-cyan-400 uppercase font-black tracking-widest font-neon neon-text-cyan">Moves</span>
            <span className="text-sm md:text-2xl font-black font-neon">{gameState.movesCount}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] md:text-xs text-pink-500 uppercase font-black tracking-widest font-neon neon-text-pink">Time</span>
            <span className="text-sm md:text-2xl font-black font-neon">{formatTime(currentTime)}</span>
          </div>
        </div>
        <h1 className="hidden sm:block text-xl md:text-3xl font-black font-neon italic tracking-tighter text-white neon-text-cyan">NEON ROYAL</h1>
        <div className="flex gap-2 md:gap-4">
          <button onClick={() => setShowThemes(true)} className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all" title="Themes">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
          </button>
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all">
            {soundEnabled ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg> : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>}
          </button>
          <button onClick={() => setShowSettings(true)} className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
          <button onClick={handleNewGame} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs md:text-sm font-black rounded-xl shadow-[0_0_15px_rgba(8,145,178,0.5)] font-neon uppercase">Reset</button>
        </div>
      </div>

      {/* Board */}
      <div className="w-full max-w-5xl flex flex-col gap-4 md:gap-8 flex-1">
        {/* Top Area */}
        <div className="grid grid-cols-7 gap-2 md:gap-4 h-fit">
          <div className="col-span-2 flex gap-2 md:gap-4">
            <div className="w-1/2" onClick={handleStockClick}>
               {gameState.stock.length > 0 ? <Card card={{ id: 'stock', suit: Suit.CLUBS, rank: Rank.ACE, isFaceUp: false }} backTheme={backTheme} speed={gameSpeed} className="neon-border-cyan" /> : <div className="w-full aspect-[5/7] rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center cursor-pointer hover:bg-white/5"><span className="text-white/20 text-3xl font-neon">↺</span></div>}
            </div>
            <div className="relative w-1/2">
              {gameState.waste.map((c, i) => i === gameState.waste.length - 1 && (
                <div key={c.id} className="absolute inset-0">
                  <Card card={c} backTheme={backTheme} speed={gameSpeed} isSelected={selection?.source === 'waste'} onPointerDown={(e) => handlePointerDown(e, { source: 'waste' })} onClick={(e) => { e.stopPropagation(); selectCard({ source: 'waste' }); }} />
                </div>
              ))}
            </div>
          </div>
          <div className="col-span-1"></div>
          <div className="col-span-4 flex justify-between gap-2">
            {(Object.values(Suit)).map(suit => {
              const pile = gameState.foundation[suit];
              const isSelected = selection?.source === 'foundation' && selection.suit === suit;
              const isRed = suit === Suit.HEARTS || suit === Suit.DIAMONDS;
              return (
                <div key={suit} ref={el => { foundationRefs.current[suit as Suit] = el; }} className={`relative w-full aspect-[5/7] rounded-xl bg-black/40 border-2 ${isRed ? 'border-pink-500/20' : 'border-cyan-500/20'} flex items-center justify-center group overflow-hidden`}>
                  <SuitIcon suit={suit} className={`w-8 h-8 md:w-12 md:h-12 opacity-10 ${isRed ? 'text-pink-500' : 'text-cyan-500'}`} />
                  <div className="absolute inset-0">
                    {pile.length > 0 && <Card card={pile[pile.length - 1]} backTheme={backTheme} speed={gameSpeed} isSelected={isSelected} onPointerDown={(e) => handlePointerDown(e, { source: 'foundation', suit })} onClick={(e) => { e.stopPropagation(); selectCard({ source: 'foundation', suit }); }} />}
                    {pile.length === 0 && <div className="w-full h-full" onClick={() => selectCard({ source: 'foundation', suit })}></div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tableau */}
        <div className="grid grid-cols-7 gap-2 md:gap-4 flex-1 h-full overflow-y-auto pb-40">
          {gameState.tableau.map((pile, pileIdx) => (
            <div key={pileIdx} ref={el => { tableauRefs.current[pileIdx] = el; }} className="relative flex-1 min-h-[400px]">
              {pile.length === 0 && <div onClick={() => selectCard({ source: 'tableau', pileIndex: pileIdx })} className="w-full aspect-[5/7] rounded-xl border-2 border-dashed border-white/5 bg-white/5 hover:bg-white/10"></div>}
              {pile.map((card, cardIdx) => {
                const isSelected = selection?.source === 'tableau' && selection.pileIndex === pileIdx && selection.cardIndex === cardIdx;
                const isDragged = dragState?.source?.source === 'tableau' && dragState.source.pileIndex === pileIdx && cardIdx >= dragState.source.cardIndex!;
                const verticalOffset = window.innerWidth < 768 ? 14 : 35;
                return (
                  <div key={card.id} className="absolute w-full" style={{ top: `${cardIdx * verticalOffset}px`, zIndex: cardIdx, visibility: isDragged ? 'hidden' : 'visible' }}>
                    <Card card={card} backTheme={backTheme} speed={gameSpeed} isSelected={isSelected} onPointerDown={(e) => handlePointerDown(e, { source: 'tableau', pileIndex: pileIdx, cardIndex: cardIdx })} onClick={(e) => { e.stopPropagation(); selectCard({ source: 'tableau', pileIndex: pileIdx, cardIndex: cardIdx }); }} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Drag Preview */}
      {dragState && (
        <div className="fixed pointer-events-none z-[9999]" style={{ left: `${dragState.currentPos.x - dragState.offset.x}px`, top: `${dragState.currentPos.y - dragState.offset.y}px`, width: `${window.innerWidth / 8}px` }}>
          {dragState.cards.map((card, i) => (
            <div key={card.id} className="absolute w-full" style={{ top: `${i * (window.innerWidth < 768 ? 14 : 35)}px` }}>
              <Card card={card} backTheme={backTheme} speed={gameSpeed} isDragging />
            </div>
          ))}
        </div>
      )}

      {/* Modals - Neon Styling */}
      {showSettings && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#0a0a0f] border border-cyan-500/30 text-white p-6 md:p-10 rounded-3xl shadow-[0_0_50px_rgba(0,242,255,0.1)] max-w-sm w-full relative">
            <button onClick={() => setShowSettings(false)} className="absolute top-6 right-6 text-cyan-500 hover:text-white transition-colors"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            <h2 className="text-2xl font-black mb-8 font-neon neon-text-cyan tracking-widest uppercase">System</h2>
            <div className="space-y-8 mb-10">
              <div>
                <label className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] block mb-4">Warp Speed</label>
                <div className="grid grid-cols-4 gap-2">
                  {[0.5, 1, 2, 4].map((s) => (
                    <button key={s} onClick={() => setGameSpeed(s as GameSpeed)} className={`py-3 rounded-xl font-bold font-neon text-[10px] transition-all ${gameSpeed === s ? 'bg-cyan-500 text-black shadow-[0_0_15px_#00f2ff]' : 'bg-white/5 text-cyan-300 hover:bg-white/10 border border-cyan-500/20'}`}>
                      {s === 0.5 ? 'Slow' : s === 1 ? 'Norm' : s === 2 ? 'Turbo' : 'Instant'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                <span className="text-xs font-black font-neon uppercase tracking-widest">Audio Feedback</span>
                <button onClick={() => setSoundEnabled(!soundEnabled)} className={`w-14 h-7 rounded-full transition-all relative ${soundEnabled ? 'bg-cyan-500 shadow-[0_0_10px_#00f2ff]' : 'bg-zinc-800'}`}>
                   <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${soundEnabled ? 'right-1' : 'left-1'}`}></div>
                </button>
              </div>
            </div>
            <button onClick={() => setShowSettings(false)} className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-black font-neon rounded-2xl shadow-lg uppercase tracking-widest">Confirm</button>
          </div>
        </div>
      )}

      {/* Themes */}
      {showThemes && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#0a0a0f] border border-pink-500/30 text-white p-6 md:p-10 rounded-3xl shadow-[0_0_50px_rgba(255,0,127,0.1)] max-w-lg w-full relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowThemes(false)} className="absolute top-6 right-6 text-pink-500 hover:text-white transition-colors"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            <h2 className="text-2xl font-black mb-8 font-neon neon-text-pink tracking-widest uppercase">Grid Themes</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
              {themes.map((theme) => (
                <div key={theme.id} onClick={() => setBackTheme(theme.id)} className={`cursor-pointer group flex flex-col items-center gap-3 p-3 rounded-2xl transition-all ${backTheme === theme.id ? 'bg-white/10 ring-2 ring-pink-500' : 'hover:bg-white/5 border border-white/5'}`}>
                  <div className={`w-full aspect-[5/7] rounded-xl border-2 ${theme.color} flex items-center justify-center`}>
                    <SuitIcon suit={Suit.SPADES} className="w-8 h-8 text-white opacity-20" />
                  </div>
                  <span className="text-[10px] font-black font-neon text-white uppercase tracking-widest">{theme.name}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowThemes(false)} className="w-full py-4 bg-pink-600 hover:bg-pink-500 text-white font-black font-neon rounded-2xl shadow-lg uppercase tracking-widest">Apply Theme</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
