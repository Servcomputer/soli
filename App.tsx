
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GameState, Selection, Card as CardType, Suit, Rank, GameStats, CardBackTheme, GameSpeed, DragState } from './types';
import { initGame, canMoveToTableau, canMoveToFoundation } from './services/solitaireLogic';
import { soundService } from './services/soundService';
import Card from './components/Card';
import { SuitIcon } from './constants';

const STATS_KEY = 'royal-solitaire-stats';
const THEME_KEY = 'royal-solitaire-theme';
const SOUND_KEY = 'royal-solitaire-sound';
const SPEED_KEY = 'royal-solitaire-speed';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(initGame());
  const [selection, setSelection] = useState<Selection>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const tableauRefs = useRef<(HTMLDivElement | null)[]>([]);
  const foundationRefs = useRef<{ [key in Suit]?: HTMLDivElement | null }>({});

  // Game Speed configuration
  const [gameSpeed, setGameSpeed] = useState<GameSpeed>(() => {
    const saved = localStorage.getItem(SPEED_KEY);
    return saved ? (parseFloat(saved) as GameSpeed) : 1;
  });

  useEffect(() => {
    soundService.setSpeed(gameSpeed);
    localStorage.setItem(SPEED_KEY, gameSpeed.toString());
  }, [gameSpeed]);

  // Sound configuration
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(SOUND_KEY);
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    soundService.setEnabled(soundEnabled);
    localStorage.setItem(SOUND_KEY, soundEnabled.toString());
  }, [soundEnabled]);

  // Initialize back theme
  const [backTheme, setBackTheme] = useState<CardBackTheme>(() => {
    return (localStorage.getItem(THEME_KEY) as CardBackTheme) || 'blue';
  });

  // Initialize stats from localStorage
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

  // Persist stats and theme
  useEffect(() => {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, backTheme);
  }, [backTheme]);

  // Handle auto-flipping
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

  // Check for Win Condition
  useEffect(() => {
    const totalFoundation = Object.values(gameState.foundation).reduce((acc, pile) => acc + pile.length, 0);
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

  // Pointer Events for Dragging
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (dragState) {
        setDragState(prev => prev ? ({
          ...prev,
          currentPos: { x: e.clientX, y: e.clientY }
        }) : null);
      }
    };

    const handleGlobalPointerUp = (e: PointerEvent) => {
      if (dragState) {
        const target = findDropTarget(e.clientX, e.clientY);
        if (target) {
          const moved = attemptMove(dragState.source, target);
          if (!moved) {
            // No move happened, just clear
          }
        }
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
    // Check Foundation
    for (const suit of Object.values(Suit)) {
      const ref = foundationRefs.current[suit as Suit];
      if (ref) {
        const rect = ref.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          return { source: 'foundation', suit: suit as Suit };
        }
      }
    }
    // Check Tableau
    for (let i = 0; i < tableauRefs.current.length; i++) {
      const ref = tableauRefs.current[i];
      if (ref) {
        const rect = ref.getBoundingClientRect();
        // A bit wider check for tableau columns
        if (x >= rect.left - 10 && x <= rect.right + 10 && y >= rect.top && y <= rect.bottom + 200) {
          return { source: 'tableau', pileIndex: i };
        }
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
      // Also set selection for consistency
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
      const moved = attemptMove(selection, src);
      if (moved) {
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

    // Target: Tableau
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
          const newFoundation = (from.source === 'foundation' && from.suit) ? {
             ...prev.foundation,
             [from.suit]: prev.foundation[from.suit].slice(0, -1)
          } : prev.foundation;
          return { ...prev, tableau: newTableau, waste: newWaste, foundation: newFoundation, movesCount: prev.movesCount + 1 };
        });
        soundService.playCardMove();
        return true;
      }
    }

    // Target: Foundation
    if (to.source === 'foundation' && cardsToMove.length === 1) {
      // Auto-detect correct foundation pile if suit not specified
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
    if (ms === null) return '--:--';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const resetStats = () => {
    if (confirm("Are you sure?")) {
      setStats({ totalGames: 0, totalWins: 0, bestMoves: null, fastestTime: null, longestTime: null });
    }
  };

  const winRate = stats.totalGames === 0 ? 0 : Math.round((stats.totalWins / stats.totalGames) * 100);
  const currentTime = gameState.startTime ? Date.now() - gameState.startTime : 0;

  const themes: { id: CardBackTheme, color: string, name: string }[] = [
    { id: 'blue', color: 'bg-blue-800', name: 'Royal Blue' },
    { id: 'red', color: 'bg-red-900', name: 'Imperial Red' },
    { id: 'green', color: 'bg-emerald-800', name: 'Forest Emerald' },
    { id: 'black', color: 'bg-zinc-900', name: 'Midnight Onyx' },
    { id: 'gold', color: 'bg-amber-700', name: 'Golden Sovereign' },
  ];

  return (
    <div className="h-screen w-screen flex flex-col items-center bg-emerald-900 p-2 md:p-6 overflow-hidden">
      {/* HUD */}
      <div className="w-full max-w-5xl flex justify-between items-center mb-4 md:mb-8 bg-emerald-800/50 p-2 md:p-4 rounded-xl backdrop-blur-sm shadow-xl z-[50]">
        <div className="flex gap-3 md:gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] md:text-xs text-emerald-300 uppercase font-bold tracking-wider">Moves</span>
            <span className="text-sm md:text-xl font-bold font-mono">{gameState.movesCount}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] md:text-xs text-emerald-300 uppercase font-bold tracking-wider">Time</span>
            <span className="text-sm md:text-xl font-bold font-mono">{formatTime(currentTime)}</span>
          </div>
        </div>
        <h1 className="hidden sm:block text-lg md:text-2xl font-black italic tracking-tighter text-emerald-100">ROYAL SOLITAIRE</h1>
        <div className="flex gap-1 md:gap-3">
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 md:p-2 bg-emerald-700/50 hover:bg-emerald-600/50 text-white rounded-lg transition-all">
            {soundEnabled ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
            )}
          </button>
          <button onClick={() => setShowSettings(true)} className="p-1.5 md:p-2 bg-emerald-700/50 hover:bg-emerald-600/50 text-white rounded-lg transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
          <button onClick={() => setShowThemes(true)} className="p-1.5 md:p-2 bg-emerald-700/50 hover:bg-emerald-600/50 text-white rounded-lg transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
          </button>
          <button onClick={() => setShowStats(true)} className="p-1.5 md:p-2 bg-emerald-700/50 hover:bg-emerald-600/50 text-white rounded-lg transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </button>
          <button onClick={handleNewGame} className="px-2 md:px-4 py-1.5 md:py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs md:text-sm font-bold rounded-lg shadow-lg">New Game</button>
        </div>
      </div>

      {/* Main Board */}
      <div className="w-full max-w-5xl flex flex-col gap-4 md:gap-8 flex-1">
        {/* Top Area */}
        <div className="grid grid-cols-7 gap-1 md:gap-4 h-fit">
          <div className="col-span-2 flex gap-1 md:gap-4">
            <div className="w-1/2" onClick={handleStockClick}>
               {gameState.stock.length > 0 ? (
                 <Card card={{ id: 'stock', suit: Suit.CLUBS, rank: Rank.ACE, isFaceUp: false }} backTheme={backTheme} speed={gameSpeed} className="ring-1 md:ring-2 ring-white/10" />
               ) : (
                 <div className="w-full aspect-[5/7] rounded-sm md:rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:bg-white/5"><span className="text-white/20 rotate-45 text-lg md:text-2xl">↺</span></div>
               )}
            </div>
            <div className="relative w-1/2">
              {gameState.waste.length === 0 && <div className="w-full aspect-[5/7] rounded-sm md:rounded-lg border-2 border-white/5 bg-black/5"></div>}
              {gameState.waste.map((c, i) => (
                <div key={c.id} className="absolute inset-0">
                  <Card 
                    card={c} 
                    backTheme={backTheme} 
                    speed={gameSpeed} 
                    isSelected={selection?.source === 'waste' && i === gameState.waste.length - 1} 
                    onPointerDown={(e) => handlePointerDown(e, { source: 'waste' })}
                    onClick={(e) => { e.stopPropagation(); selectCard({ source: 'waste' }); }}
                    className={i === gameState.waste.length - 1 ? 'block' : 'hidden'} 
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="col-span-1"></div>
          <div className="col-span-4 flex justify-between gap-1 md:gap-2">
            {(Object.values(Suit)).map(suit => {
              const pile = gameState.foundation[suit];
              const isSelected = selection?.source === 'foundation' && selection.suit === suit;
              return (
                <div 
                  key={suit} 
                  /* Fix: Wrap ref assignment to return void instead of the element to fix TypeScript type error */
                  ref={el => { foundationRefs.current[suit as Suit] = el; }}
                  className="relative w-full aspect-[5/7] rounded-sm md:rounded-lg bg-black/20 border-2 border-white/10 flex items-center justify-center group"
                >
                  <SuitIcon suit={suit} className="text-white/5 w-4 h-4 md:w-8 md:h-8 group-hover:scale-110 transition-transform" />
                  <div className="absolute inset-0">
                    {pile.length > 0 && (
                      <Card 
                        card={pile[pile.length - 1]} 
                        backTheme={backTheme} 
                        speed={gameSpeed} 
                        isSelected={isSelected} 
                        onPointerDown={(e) => handlePointerDown(e, { source: 'foundation', suit })}
                        onClick={(e) => { e.stopPropagation(); selectCard({ source: 'foundation', suit }); }}
                      />
                    )}
                    {pile.length === 0 && (
                      <div className="w-full h-full" onClick={() => selectCard({ source: 'foundation', suit })}></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tableau Area */}
        <div className="grid grid-cols-7 gap-1 md:gap-4 flex-1 h-full overflow-y-auto pb-20">
          {gameState.tableau.map((pile, pileIdx) => (
            /* Fix: Wrap ref assignment to return void instead of the element to fix TypeScript type error */
            <div key={pileIdx} ref={el => { tableauRefs.current[pileIdx] = el; }} className="relative flex-1 min-h-[150px] md:min-h-[300px]">
              {pile.length === 0 && (
                <div onClick={() => selectCard({ source: 'tableau', pileIndex: pileIdx })} className="w-full aspect-[5/7] rounded-sm md:rounded-lg border-2 border-dashed border-white/5 bg-black/10 hover:bg-black/20"></div>
              )}
              {pile.map((card, cardIdx) => {
                const isSelected = selection?.source === 'tableau' && selection.pileIndex === pileIdx && selection.cardIndex === cardIdx;
                const isDragged = dragState?.source?.source === 'tableau' && dragState.source.pileIndex === pileIdx && cardIdx >= dragState.source.cardIndex!;
                const verticalOffset = window.innerWidth < 768 ? 12 : 30;
                return (
                  <div 
                    key={card.id} 
                    className="absolute w-full" 
                    style={{ 
                      top: `${cardIdx * verticalOffset}px`, 
                      zIndex: cardIdx,
                      visibility: isDragged ? 'hidden' : 'visible'
                    }}
                  >
                    <Card 
                      card={card} 
                      backTheme={backTheme} 
                      speed={gameSpeed} 
                      isSelected={isSelected} 
                      onPointerDown={(e) => handlePointerDown(e, { source: 'tableau', pileIndex: pileIdx, cardIndex: cardIdx })}
                      onClick={(e) => { e.stopPropagation(); selectCard({ source: 'tableau', pileIndex: pileIdx, cardIndex: cardIdx }); }}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* DRAG PREVIEW */}
      {dragState && (
        <div 
          className="fixed pointer-events-none z-[9999]" 
          style={{ 
            left: `${dragState.currentPos.x - dragState.offset.x}px`, 
            top: `${dragState.currentPos.y - dragState.offset.y}px`,
            width: `${window.innerWidth / 7.5}px` // Scale roughly with column width
          }}
        >
          {dragState.cards.map((card, i) => (
            <div key={card.id} className="absolute w-full" style={{ top: `${i * (window.innerWidth < 768 ? 12 : 30)}px` }}>
              <Card card={card} backTheme={backTheme} speed={gameSpeed} isDragging />
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showSettings && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-emerald-900 border border-emerald-400/30 text-white p-6 md:p-8 rounded-2xl shadow-2xl max-sm w-full relative">
            <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-emerald-400 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h2 className="text-xl md:text-2xl font-black mb-6 italic text-emerald-100 uppercase">Settings</h2>
            <div className="space-y-6 mb-8">
              <div>
                <label className="text-xs font-bold text-emerald-400 uppercase tracking-widest block mb-4">Animation Speed</label>
                <div className="grid grid-cols-4 gap-2">
                  {[0.5, 1, 2, 4].map((s) => (
                    <button key={s} onClick={() => setGameSpeed(s as GameSpeed)} className={`py-2 rounded-lg font-bold text-xs transition-all ${gameSpeed === s ? 'bg-emerald-500 text-white shadow-lg ring-2 ring-emerald-300' : 'bg-emerald-800 text-emerald-300 hover:bg-emerald-700'}`}>
                      {s === 0.5 ? 'Slow' : s === 1 ? 'Norm' : s === 2 ? 'Turbo' : 'Inst'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-emerald-800/30 rounded-xl border border-emerald-700/50">
                <span className="text-sm font-bold">Sound Effects</span>
                <button onClick={() => setSoundEnabled(!soundEnabled)} className={`w-12 h-6 rounded-full transition-colors relative ${soundEnabled ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                   <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${soundEnabled ? 'right-1' : 'left-1'}`}></div>
                </button>
              </div>
            </div>
            <button onClick={() => setShowSettings(false)} className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl shadow-lg">DONE</button>
          </div>
        </div>
      )}

      {showThemes && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-emerald-900 border border-emerald-400/30 text-white p-4 md:p-8 rounded-2xl shadow-2xl max-w-lg w-full relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowThemes(false)} className="absolute top-4 right-4 text-emerald-400 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h2 className="text-xl md:text-2xl font-black mb-6 italic text-emerald-100 flex items-center gap-3 uppercase">Card Themes</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-4 mb-8">
              {themes.map((theme) => (
                <div key={theme.id} onClick={() => setBackTheme(theme.id)} className={`cursor-pointer group flex flex-col items-center gap-2 p-2 rounded-xl transition-all ${backTheme === theme.id ? 'bg-white/10 ring-2 ring-yellow-400' : 'hover:bg-white/5'}`}>
                  <div className={`w-12 h-18 md:w-16 md:h-24 rounded-lg shadow-lg border-2 border-white/20 ${theme.color} flex items-center justify-center aspect-[5/7]`}><div className="opacity-30 transform -rotate-12"><SuitIcon suit={Suit.SPADES} className="w-6 h-6 md:w-8 md:h-8 text-white" /></div></div>
                  <span className="text-[10px] md:text-xs font-bold text-emerald-200 group-hover:text-white">{theme.name}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowThemes(false)} className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl shadow-lg">DONE</button>
          </div>
        </div>
      )}

      {showStats && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-emerald-900 border border-emerald-400/30 text-white p-4 md:p-8 rounded-2xl shadow-2xl max-w-lg w-full relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowStats(false)} className="absolute top-4 right-4 text-emerald-400 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h2 className="text-xl md:text-3xl font-black mb-6 italic text-emerald-100 uppercase">Statistics</h2>
            <div className="grid grid-cols-2 gap-2 md:gap-4 mb-8">
              <div className="bg-emerald-800/40 p-2 md:p-4 rounded-xl border border-emerald-700/50">
                <div className="text-[10px] uppercase text-emerald-400 font-bold mb-1">Total Games</div>
                <div className="text-lg md:text-3xl font-black">{stats.totalGames}</div>
              </div>
              <div className="bg-emerald-800/40 p-2 md:p-4 rounded-xl border border-emerald-700/50">
                <div className="text-[10px] uppercase text-emerald-400 font-bold mb-1">Win Rate</div>
                <div className="text-lg md:text-3xl font-black">{winRate}%</div>
              </div>
              <div className="bg-emerald-800/40 p-2 md:p-4 rounded-xl border border-emerald-700/50">
                <div className="text-[10px] uppercase text-emerald-400 font-bold mb-1">Best Moves</div>
                <div className="text-lg md:text-3xl font-black">{stats.bestMoves || '--'}</div>
              </div>
              <div className="bg-emerald-800/40 p-2 md:p-4 rounded-xl border border-emerald-700/50">
                <div className="text-[10px] uppercase text-emerald-400 font-bold mb-1">Fastest Win</div>
                <div className="text-lg md:text-3xl font-black">{formatTime(stats.fastestTime)}</div>
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-2 md:gap-4">
              <button onClick={resetStats} className="flex-1 py-3 border border-red-500/50 text-red-400 hover:bg-red-500/10 font-bold rounded-xl">RESET</button>
              <button onClick={() => setShowStats(false)} className="flex-[2] py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl shadow-lg">CLOSE</button>
            </div>
          </div>
        </div>
      )}

      {/* Win Overlay */}
      {gameState.isGameOver && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in zoom-in duration-300">
          <div className="bg-white text-black p-6 md:p-8 rounded-2xl shadow-2xl text-center max-w-md w-full border-t-8 border-yellow-500">
             <div className="text-yellow-500 text-4xl md:text-6xl mb-4">🏆</div>
             <h2 className="text-2xl md:text-4xl font-black mb-2 italic">VICTORY!</h2>
             <p className="text-sm md:text-base text-gray-600 mb-6">Incredible performance!</p>
             <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-gray-100 p-2 md:p-4 rounded-xl">
                  <div className="text-[10px] uppercase text-gray-400 font-bold">Time</div>
                  <div className="text-lg md:text-2xl font-black">{formatTime(currentTime)}</div>
                </div>
                <div className="bg-gray-100 p-2 md:p-4 rounded-xl">
                  <div className="text-[10px] uppercase text-gray-400 font-bold">Moves</div>
                  <div className="text-lg md:text-2xl font-black">{gameState.movesCount}</div>
                </div>
             </div>
             <button onClick={handleNewGame} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-lg md:text-xl shadow-lg">PLAY AGAIN</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
