
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
const NEON_MODE_KEY = 'neon-solitaire-mode-active';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(initGame());
  const [selection, setSelection] = useState<Selection>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const [isNeonMode, setIsNeonMode] = useState<boolean>(() => {
    const saved = localStorage.getItem(NEON_MODE_KEY);
    return saved !== null ? saved === 'true' : true;
  });

  const tableauRefs = useRef<(HTMLDivElement | null)[]>([]);
  const foundationRefs = useRef<{ [key in Suit]?: HTMLDivElement | null }>({});

  const [gameSpeed, setGameSpeed] = useState<GameSpeed>(() => {
    const saved = localStorage.getItem(SPEED_KEY);
    return saved ? (parseFloat(saved) as GameSpeed) : 1;
  });

  const [backTheme, setBackTheme] = useState<CardBackTheme>(() => {
    return (localStorage.getItem(THEME_KEY) as CardBackTheme) || 'blue';
  });

  useEffect(() => {
    localStorage.setItem(NEON_MODE_KEY, isNeonMode.toString());
    if (isNeonMode) {
      document.body.classList.add('neon-mode', 'grid-bg-neon');
      document.body.classList.remove('classic-mode', 'felt-bg-classic');
      document.body.style.backgroundColor = '#030308';
    } else {
      document.body.classList.remove('neon-mode', 'grid-bg-neon');
      document.body.classList.add('classic-mode', 'felt-bg-classic');
      // Fix: Aligned with user request, classic mode background is always green (#1b5e20)
      document.body.style.backgroundColor = '#1b5e20';
    }
  }, [isNeonMode]);

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

  useEffect(() => {
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

  const themes: { id: CardBackTheme, color: string, classicBack: string, name: string }[] = [
    { id: 'blue', color: 'bg-[#001a33] border-[#00f2ff]', classicBack: 'bg-blue-800', name: 'Sapphire' },
    { id: 'red', color: 'bg-[#2a0015] border-[#ff007f]', classicBack: 'bg-red-800', name: 'Ruby' },
    { id: 'green', color: 'bg-[#002211] border-[#39ff14]', classicBack: 'bg-emerald-900', name: 'Emerald' },
    { id: 'black', color: 'bg-[#0f0f15] border-[#7f00ff]', classicBack: 'bg-zinc-900', name: 'Onyx' },
    { id: 'gold', color: 'bg-[#221a00] border-[#ffcc00]', classicBack: 'bg-amber-700', name: 'Amber' },
  ];

  const hudClasses = isNeonMode 
    ? "bg-black/40 border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.5)]" 
    : "bg-white/90 border-zinc-200 shadow-md text-zinc-900";

  const hudLabelClasses = isNeonMode ? "text-cyan-400 font-neon neon-text-cyan" : "text-zinc-500 font-bold";
  const hudValueClasses = isNeonMode ? "font-neon" : "font-bold text-zinc-900";

  return (
    <div className="h-screen w-screen flex flex-col items-center p-2 md:p-6 overflow-hidden">
      {/* HUD */}
      <div className={`w-full max-w-5xl flex justify-between items-center mb-4 md:mb-8 border p-3 md:p-5 rounded-2xl backdrop-blur-xl z-[50] transition-colors ${hudClasses}`}>
        <div className="flex gap-4 md:gap-8">
          <div className="flex flex-col">
            <span className={`text-[10px] md:text-xs uppercase tracking-widest ${hudLabelClasses}`}>Moves</span>
            <span className={`text-sm md:text-2xl ${hudValueClasses}`}>{gameState.movesCount}</span>
          </div>
          <div className="flex flex-col">
            <span className={`text-[10px] md:text-xs uppercase tracking-widest ${isNeonMode ? 'text-pink-500 font-neon neon-text-pink' : 'text-zinc-500 font-bold'}`}>Time</span>
            <span className={`text-sm md:text-2xl ${hudValueClasses}`}>{formatTime(currentTime)}</span>
          </div>
        </div>

        <h1 className={`hidden sm:block text-xl md:text-3xl font-black italic tracking-tighter ${isNeonMode ? 'font-neon text-white neon-text-cyan' : 'text-zinc-800'}`}>
          {isNeonMode ? 'NEON ROYAL' : 'ROYAL SOLITAIRE'}
        </h1>

        <div className="flex gap-2 md:gap-4">
          <button 
            onClick={() => setIsNeonMode(!isNeonMode)} 
            className={`p-2 rounded-xl border transition-all ${isNeonMode ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-zinc-100 border-zinc-300 text-zinc-700 hover:bg-zinc-200'}`}
            title={isNeonMode ? "Mudar para Modo Clássico" : "Mudar para Modo Neon"}
          >
            {isNeonMode ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            )}
          </button>

          <button onClick={() => setShowThemes(true)} className={`p-2 rounded-xl border transition-all ${isNeonMode ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-zinc-100 border-zinc-300 text-zinc-700 hover:bg-zinc-200'}`} title="Themes">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
          </button>

          <button onClick={() => setSoundEnabled(!soundEnabled)} className={`p-2 rounded-xl border transition-all ${isNeonMode ? 'bg-white/5 border-white/10 text-white' : 'bg-zinc-100 border-zinc-300 text-zinc-700'}`}>
            {soundEnabled ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg> : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>}
          </button>
          <button onClick={handleNewGame} className={`px-4 py-2 text-xs md:text-sm font-black rounded-xl uppercase transition-all ${isNeonMode ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(8,145,178,0.5)] font-neon' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}`}>Reset</button>
        </div>
      </div>

      {/* Board */}
      <div className="w-full max-w-5xl flex flex-col gap-4 md:gap-8 flex-1">
        <div className="grid grid-cols-7 gap-2 md:gap-4 h-fit">
          <div className="col-span-2 flex gap-2 md:gap-4">
            <div className="w-1/2" onClick={handleStockClick}>
               {gameState.stock.length > 0 ? (
                 <Card card={{ id: 'stock', suit: Suit.CLUBS, rank: Rank.ACE, isFaceUp: false }} isNeon={isNeonMode} backTheme={backTheme} speed={gameSpeed} className={isNeonMode ? "neon-border-cyan" : ""} />
               ) : (
                 <div className={`w-full aspect-[5/7] rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors ${isNeonMode ? 'border-white/10 hover:bg-white/5 text-white/20' : 'border-white/10 hover:bg-black/5 text-white/40'}`}>
                    <span className={`text-3xl ${isNeonMode ? 'font-neon' : ''}`}>↺</span>
                 </div>
               )}
            </div>
            <div className="relative w-1/2">
              {gameState.waste.map((c, i) => i === gameState.waste.length - 1 && (
                <div key={c.id} className="absolute inset-0">
                  <Card card={c} isNeon={isNeonMode} backTheme={backTheme} speed={gameSpeed} isSelected={selection?.source === 'waste'} onPointerDown={(e) => handlePointerDown(e, { source: 'waste' })} onClick={(e) => { e.stopPropagation(); selectCard({ source: 'waste' }); }} />
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
              
              const slotBg = isNeonMode ? 'bg-black/40 border-2' : 'bg-black/10 border-2 border-white/10';
              const slotBorder = isNeonMode ? (isRed ? 'border-pink-500/20' : 'border-cyan-500/20') : '';

              return (
                <div key={suit} ref={el => { foundationRefs.current[suit as Suit] = el; }} className={`relative w-full aspect-[5/7] rounded-xl flex items-center justify-center group overflow-hidden transition-colors ${slotBg} ${slotBorder}`}>
                  <SuitIcon suit={suit} className={`w-8 h-8 md:w-12 md:h-12 opacity-10 ${isNeonMode ? (isRed ? 'text-pink-500' : 'text-cyan-500') : 'text-zinc-100'}`} />
                  <div className="absolute inset-0">
                    {pile.length > 0 && <Card card={pile[pile.length - 1]} isNeon={isNeonMode} backTheme={backTheme} speed={gameSpeed} isSelected={isSelected} onPointerDown={(e) => handlePointerDown(e, { source: 'foundation', suit })} onClick={(e) => { e.stopPropagation(); selectCard({ source: 'foundation', suit }); }} />}
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
              {pile.length === 0 && (
                <div 
                  onClick={() => selectCard({ source: 'tableau', pileIndex: pileIdx })} 
                  className={`w-full aspect-[5/7] rounded-xl border-2 border-dashed transition-colors ${isNeonMode ? 'border-white/5 bg-white/5 hover:bg-white/10' : 'border-white/10 bg-black/5 hover:bg-black/10'}`}
                ></div>
              )}
              {pile.map((card, cardIdx) => {
                const isSelected = selection?.source === 'tableau' && selection.pileIndex === pileIdx && selection.cardIndex === cardIdx;
                const isDragged = dragState?.source?.source === 'tableau' && dragState.source.pileIndex === pileIdx && cardIdx >= dragState.source.cardIndex!;
                const verticalOffset = window.innerWidth < 768 ? 14 : 35;
                return (
                  <div key={card.id} className="absolute w-full" style={{ top: `${cardIdx * verticalOffset}px`, zIndex: cardIdx, visibility: isDragged ? 'hidden' : 'visible' }}>
                    <Card card={card} isNeon={isNeonMode} backTheme={backTheme} speed={gameSpeed} isSelected={isSelected} onPointerDown={(e) => handlePointerDown(e, { source: 'tableau', pileIndex: pileIdx, cardIndex: cardIdx })} onClick={(e) => { e.stopPropagation(); selectCard({ source: 'tableau', pileIndex: pileIdx, cardIndex: cardIdx }); }} />
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
              <Card card={card} isNeon={isNeonMode} backTheme={backTheme} speed={gameSpeed} isDragging />
            </div>
          ))}
        </div>
      )}

      {/* Themes Modal */}
      {showThemes && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className={`p-6 md:p-10 rounded-3xl shadow-2xl max-w-lg w-full relative max-h-[90vh] overflow-y-auto ${isNeonMode ? 'bg-[#0a0a0f] border border-pink-500/30 text-white' : 'bg-white text-zinc-900'}`}>
            <button onClick={() => setShowThemes(false)} className={`absolute top-6 right-6 transition-colors ${isNeonMode ? 'text-pink-500 hover:text-white' : 'text-zinc-400 hover:text-zinc-900'}`}><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            <h2 className={`text-2xl font-black mb-8 tracking-widest uppercase ${isNeonMode ? 'font-neon neon-text-pink' : 'font-bold'}`}>Selecione o Tema</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
              {themes.map((theme) => (
                <div key={theme.id} onClick={() => setBackTheme(theme.id)} className={`cursor-pointer group flex flex-col items-center gap-3 p-3 rounded-2xl transition-all ${backTheme === theme.id ? (isNeonMode ? 'bg-white/10 ring-2 ring-pink-500' : 'bg-zinc-100 ring-2 ring-blue-600') : (isNeonMode ? 'hover:bg-white/5 border border-white/5' : 'hover:bg-zinc-50 border border-zinc-100')}`}>
                  <div className={`w-full aspect-[5/7] rounded-xl border-2 flex items-center justify-center ${isNeonMode ? theme.color : `${theme.classicBack} border-white shadow-sm`}`}>
                    <SuitIcon suit={Suit.SPADES} className={`w-8 h-8 text-white ${isNeonMode ? 'opacity-20' : 'opacity-40'}`} />
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isNeonMode ? 'font-neon' : 'text-zinc-600'}`}>{theme.name}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowThemes(false)} className={`w-full py-4 font-black rounded-2xl shadow-lg uppercase tracking-widest transition-colors ${isNeonMode ? 'bg-pink-600 hover:bg-pink-500 text-white font-neon' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}`}>Confirmar Tema</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
