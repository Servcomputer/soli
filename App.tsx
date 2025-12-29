
import React, { useState, useEffect, useMemo } from 'react';
import { GameState, Selection, Card as CardType, Suit, Rank, GameStats } from './types';
import { initGame, canMoveToTableau, canMoveToFoundation } from './services/solitaireLogic';
import { getAIHint } from './services/geminiService';
import Card from './components/Card';
import { SuitIcon } from './constants';

const STATS_KEY = 'royal-solitaire-stats';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(initGame());
  const [selection, setSelection] = useState<Selection>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [loadingHint, setLoadingHint] = useState(false);
  const [errorType, setErrorType] = useState<'NONE' | 'KEY_REQUIRED'>('NONE');
  const [showStats, setShowStats] = useState(false);
  
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

  // Persist stats to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }, [stats]);

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
    }
  }, [gameState.tableau]);

  // Check for Win Condition and update stats
  useEffect(() => {
    const totalFoundation = Object.values(gameState.foundation).reduce((acc, pile) => acc + pile.length, 0);
    if (totalFoundation === 52 && !gameState.isGameOver) {
      const gameDuration = gameState.startTime ? Date.now() - gameState.startTime : 0;
      
      setGameState(prev => ({ ...prev, isGameOver: true }));
      
      setStats(prev => ({
        ...prev,
        totalWins: prev.totalWins + 1,
        bestMoves: prev.bestMoves === null ? gameState.movesCount : Math.min(prev.bestMoves, gameState.movesCount),
        fastestTime: prev.fastestTime === null ? gameDuration : Math.min(prev.fastestTime, gameDuration),
        longestTime: prev.longestTime === null ? gameDuration : Math.max(prev.longestTime, gameDuration)
      }));
    }
  }, [gameState.foundation, gameState.isGameOver, gameState.movesCount, gameState.startTime]);

  const handleNewGame = () => {
    setGameState(initGame());
    setSelection(null);
    setHint(null);
    setErrorType('NONE');
    setStats(prev => ({ ...prev, totalGames: prev.totalGames + 1 }));
  };

  const handleStockClick = () => {
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
    if (selection) {
      const moved = attemptMove(selection, src);
      if (moved) {
        setSelection(null);
        return;
      }
    }
    let card: CardType | null = null;
    if (src.source === 'tableau' && src.pileIndex !== undefined && src.cardIndex !== undefined) {
      card = gameState.tableau[src.pileIndex][src.cardIndex];
    } else if (src.source === 'waste') {
      card = gameState.waste[gameState.waste.length - 1];
    } else if (src.source === 'foundation' && src.suit !== undefined) {
      const pile = gameState.foundation[src.suit];
      card = pile[pile.length - 1];
    }
    if (card && card.isFaceUp) {
      setSelection(src);
    } else {
      setSelection(null);
    }
  };

  const attemptMove = (from: Selection, to: Selection): boolean => {
    if (!from || !to) return false;
    let cardsToMove: CardType[] = [];
    if (from.source === 'tableau' && from.pileIndex !== undefined && from.cardIndex !== undefined) {
      cardsToMove = gameState.tableau[from.pileIndex].slice(from.cardIndex);
    } else if (from.source === 'waste') {
      cardsToMove = [gameState.waste[gameState.waste.length - 1]];
    } else if (from.source === 'foundation' && from.suit !== undefined) {
      const pile = gameState.foundation[from.suit];
      cardsToMove = [pile[pile.length - 1]];
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
          const newFoundation = from.source === 'foundation' && from.suit ? {
             ...prev.foundation,
             [from.suit]: prev.foundation[from.suit].slice(0, -1)
          } : prev.foundation;
          return { ...prev, tableau: newTableau, waste: newWaste, foundation: newFoundation, movesCount: prev.movesCount + 1 };
        });
        return true;
      }
    }
    if (to.source === 'foundation' && to.suit !== undefined && cardsToMove.length === 1) {
      const targetPile = gameState.foundation[to.suit];
      if (canMoveToFoundation(mainCard, targetPile)) {
        setGameState(prev => {
          const newFoundation = { ...prev.foundation, [to.suit!]: [...targetPile, mainCard] };
          const newTableau = from.source === 'tableau' ? prev.tableau.map((p, i) => i === from.pileIndex ? p.slice(0, -1) : p) : prev.tableau;
          const newWaste = from.source === 'waste' ? prev.waste.slice(0, -1) : prev.waste;
          return { ...prev, foundation: newFoundation, tableau: newTableau, waste: newWaste, movesCount: prev.movesCount + 1 };
        });
        return true;
      }
    }
    return false;
  };

  const handleOpenKeySelector = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio) {
      await aistudio.openSelectKey();
      setErrorType('NONE');
    }
  };

  const getHint = async () => {
    setLoadingHint(true);
    setErrorType('NONE');
    setHint(null);

    try {
      const aistudio = (window as any).aistudio;
      if (aistudio) {
        const hasKey = await aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await aistudio.openSelectKey();
        }
      }
      const text = await getAIHint(gameState);
      setHint(text);
    } catch (e: any) {
      if (e.message === 'MODEL_NOT_FOUND') {
        setErrorType('KEY_REQUIRED');
      } else {
        setHint("Could not reach the AI. Try again.");
      }
    } finally {
      setLoadingHint(false);
    }
  };

  const formatTime = (ms: number | null) => {
    if (ms === null) return '--:--';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const resetStats = () => {
    if (confirm("Are you sure you want to reset all your statistics?")) {
      const initialStats = {
        totalGames: 0,
        totalWins: 0,
        bestMoves: null,
        fastestTime: null,
        longestTime: null
      };
      setStats(initialStats);
    }
  };

  const winRate = useMemo(() => {
    if (stats.totalGames === 0) return 0;
    return Math.round((stats.totalWins / stats.totalGames) * 100);
  }, [stats.totalWins, stats.totalGames]);

  const currentTime = gameState.startTime ? Date.now() - gameState.startTime : 0;

  return (
    <div className="h-screen w-screen flex flex-col items-center bg-emerald-900 p-4 md:p-8 overflow-hidden">
      {/* HUD / Header */}
      <div className="w-full max-w-5xl flex justify-between items-center mb-8 bg-emerald-800/50 p-4 rounded-xl backdrop-blur-sm shadow-xl">
        <div className="flex gap-6">
          <div className="flex flex-col">
            <span className="text-xs text-emerald-300 uppercase font-bold tracking-wider">Moves</span>
            <span className="text-xl font-bold font-mono">{gameState.movesCount}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-emerald-300 uppercase font-bold tracking-wider">Time</span>
            <span className="text-xl font-bold font-mono">{formatTime(currentTime)}</span>
          </div>
        </div>
        
        <h1 className="hidden md:block text-2xl font-black italic tracking-tighter text-emerald-100">ROYAL SOLITAIRE</h1>

        <div className="flex gap-3">
          <button 
            onClick={() => setShowStats(true)}
            className="p-2 bg-emerald-700/50 hover:bg-emerald-600/50 text-white rounded-lg transition-all"
            title="Statistics"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>
          <button 
            onClick={getHint}
            disabled={loadingHint}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-bold rounded-lg transition-colors flex items-center gap-2 shadow-lg"
          >
            {loadingHint ? 'Thinking...' : 'AI Hint'}
          </button>
          <button 
            onClick={handleNewGame}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors shadow-lg"
          >
            New Game
          </button>
        </div>
      </div>

      {/* Error & Hint Overlays */}
      {errorType === 'KEY_REQUIRED' && (
        <div className="mb-4 bg-red-950/50 p-4 rounded-lg border border-red-500/50 text-sm max-w-xl text-center flex flex-col items-center gap-2">
          <p className="text-red-200">AI Key selection required or invalid. Please select a valid API key from a paid project.</p>
          <button onClick={handleOpenKeySelector} className="bg-red-500 hover:bg-red-400 text-white px-3 py-1 rounded font-bold text-xs">SELECT API KEY</button>
        </div>
      )}

      {hint && (
        <div className="mb-4 bg-white/10 p-3 rounded-lg border border-white/20 text-sm max-w-xl text-center italic relative animate-pulse">
          <button onClick={() => setHint(null)} className="absolute -top-2 -right-2 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center text-[10px] hover:scale-110 transition-transform">✕</button>
          "{hint}"
        </div>
      )}

      {/* Statistics Modal */}
      {showStats && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-emerald-900 border border-emerald-400/30 text-white p-8 rounded-2xl shadow-2xl max-w-lg w-full relative">
            <button onClick={() => setShowStats(false)} className="absolute top-4 right-4 text-emerald-400 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <h2 className="text-3xl font-black mb-6 italic text-emerald-100 flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              YOUR STATISTICS
            </h2>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-emerald-800/40 p-4 rounded-xl border border-emerald-700/50">
                <div className="text-xs uppercase text-emerald-400 font-bold mb-1">Total Games</div>
                <div className="text-3xl font-black">{stats.totalGames}</div>
              </div>
              <div className="bg-emerald-800/40 p-4 rounded-xl border border-emerald-700/50">
                <div className="text-xs uppercase text-emerald-400 font-bold mb-1">Win Rate</div>
                <div className="text-3xl font-black">{winRate}%</div>
              </div>
              <div className="bg-emerald-800/40 p-4 rounded-xl border border-emerald-700/50">
                <div className="text-xs uppercase text-emerald-400 font-bold mb-1">Best Moves</div>
                <div className="text-3xl font-black">{stats.bestMoves || '--'}</div>
              </div>
              <div className="bg-emerald-800/40 p-4 rounded-xl border border-emerald-700/50">
                <div className="text-xs uppercase text-emerald-400 font-bold mb-1">Fastest Win</div>
                <div className="text-3xl font-black">{formatTime(stats.fastestTime)}</div>
              </div>
              <div className="col-span-2 bg-emerald-800/40 p-4 rounded-xl border border-emerald-700/50">
                <div className="text-xs uppercase text-emerald-400 font-bold mb-1">Longest Session</div>
                <div className="text-3xl font-black">{formatTime(stats.longestTime)}</div>
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={resetStats}
                className="flex-1 py-3 border border-red-500/50 text-red-400 hover:bg-red-500/10 font-bold rounded-xl transition-all"
              >
                RESET STATS
              </button>
              <button 
                onClick={() => setShowStats(false)}
                className="flex-[2] py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl transition-all shadow-lg"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Game Board */}
      <div className="w-full max-w-5xl flex flex-col gap-8 flex-1">
        <div className="grid grid-cols-7 gap-4">
          <div className="col-span-2 flex gap-4">
            <div onClick={handleStockClick}>
               {gameState.stock.length > 0 ? (
                 <Card card={{ id: 'stock', suit: Suit.CLUBS, rank: Rank.ACE, isFaceUp: false }} className="ring-2 ring-white/10" />
               ) : (
                 <div className="w-16 h-24 md:w-20 md:h-28 rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:bg-white/5 transition-colors">
                   <span className="text-white/20 rotate-45 text-2xl">↺</span>
                 </div>
               )}
            </div>
            <div className="relative h-24 md:h-28">
              {gameState.waste.map((c, i) => (
                <div key={c.id} className="absolute top-0 left-0">
                  <Card 
                    card={c} 
                    isSelected={selection?.source === 'waste' && i === gameState.waste.length - 1}
                    onClick={() => selectCard({ source: 'waste' })}
                    className={i === gameState.waste.length - 1 ? 'block' : 'hidden'} 
                  />
                </div>
              ))}
              {gameState.waste.length === 0 && <div className="w-16 h-24 md:w-20 md:h-28 rounded-lg border-2 border-white/5 bg-black/5"></div>}
            </div>
          </div>
          <div className="col-span-1"></div>
          <div className="col-span-4 flex justify-between gap-2">
            {[Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES].map(suit => {
              const pile = gameState.foundation[suit];
              const isSelected = selection?.source === 'foundation' && selection.suit === suit;
              return (
                <div key={suit} className="relative w-16 h-24 md:w-20 md:h-28 rounded-lg bg-black/20 border-2 border-white/10 flex items-center justify-center group overflow-hidden">
                  <SuitIcon suit={suit} className="text-white/5 w-8 h-8 group-hover:scale-110 transition-transform" />
                  <div className="absolute inset-0">
                    {pile.length > 0 && (
                      <Card 
                        card={pile[pile.length - 1]} 
                        isSelected={isSelected}
                        onClick={() => selectCard({ source: 'foundation', suit })}
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

        <div className="grid grid-cols-7 gap-4 flex-1">
          {gameState.tableau.map((pile, pileIdx) => (
            <div key={pileIdx} className="relative flex-1 min-h-[300px]">
              {pile.length === 0 && (
                <div 
                  onClick={() => selectCard({ source: 'tableau', pileIndex: pileIdx })}
                  className="w-16 h-24 md:w-20 md:h-28 rounded-lg border-2 border-dashed border-white/5 bg-black/10 hover:bg-black/20 transition-colors"
                ></div>
              )}
              {pile.map((card, cardIdx) => {
                const isSelected = selection?.source === 'tableau' && 
                                   selection.pileIndex === pileIdx && 
                                   selection.cardIndex === cardIdx;
                return (
                  <div 
                    key={card.id}
                    className="absolute w-full"
                    style={{ top: `${cardIdx * 30}px` }}
                  >
                    <Card 
                      card={card}
                      isSelected={isSelected}
                      onClick={() => selectCard({ source: 'tableau', pileIndex: pileIdx, cardIndex: cardIdx })}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Win Modal Overlay */}
      {gameState.isGameOver && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in zoom-in duration-300">
          <div className="bg-white text-black p-8 rounded-2xl shadow-2xl text-center max-w-md w-full border-t-8 border-yellow-500 transform transition-all">
             <div className="text-yellow-500 text-6xl mb-4">🏆</div>
             <h2 className="text-4xl font-black mb-2 italic">VICTORY!</h2>
             <p className="text-gray-600 mb-6">Incredible performance! You cleared the deck.</p>
             <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-gray-100 p-4 rounded-xl">
                  <div className="text-xs uppercase text-gray-400 font-bold">Time</div>
                  <div className="text-2xl font-black">{formatTime(currentTime)}</div>
                </div>
                <div className="bg-gray-100 p-4 rounded-xl">
                  <div className="text-xs uppercase text-gray-400 font-bold">Moves</div>
                  <div className="text-2xl font-black">{gameState.movesCount}</div>
                </div>
             </div>
             <button onClick={handleNewGame} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xl shadow-lg transform transition-transform hover:scale-105 active:scale-95">PLAY AGAIN</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
