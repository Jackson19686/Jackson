/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  RotateCcw, 
  Menu, 
  X, 
  Send, 
  Twitter, 
  Target, 
  ChevronRight,
  Medal,
  Volume2,
  VolumeX
} from 'lucide-react';
import confetti from 'canvas-confetti';

// --- Types ---
interface LeaderboardEntry {
  name: string;
  score: number;
  date: string;
}

interface GameStats {
  totalShots: number;
  totalGoals: number;
  highestStreak: number;
  gamesPlayed: number;
}

type GameState = 'START' | 'PLAYING' | 'RESULT';

// --- Constants ---
const COLORS = {
  primary: '#8B5CF6', // Purple-500
  secondary: '#A78BFA', // Purple-400
  background: '#000000', // Black
  surface: '#111827', // Gray-900
  text: '#FFFFFF',
};

const SOUNDS = {
  kick: 'https://assets.mixkit.co/active_storage/sfx/2092/2092-preview.mp3',
  goal: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',
  miss: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  click: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
};

export default function App() {
  // Game State
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [difficulty, setDifficulty] = useState(1);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<GameStats>({
    totalShots: 0,
    totalGoals: 0,
    highestStreak: 0,
    gamesPlayed: 0,
  });

  // Animation State
  const [targetPos, setTargetPos] = useState(50); // 0 to 100 (percentage across goal)
  const [barPos, setBarPos] = useState(0); // 0 to 100 (power bar)
  const [isShooting, setIsShooting] = useState(false);
  const [lastShotResult, setLastShotResult] = useState<'GOAL' | 'MISS' | null>(null);

  // Refs for animation loops and audio
  const requestRef = useRef<number>(null);
  const startTimeRef = useRef<number>(null);
  const menuStatsRef = useRef<HTMLDivElement>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  // Initialize Audio
  useEffect(() => {
    Object.entries(SOUNDS).forEach(([key, url]) => {
      const audio = new Audio(url);
      audio.preload = 'auto';
      audioRefs.current[key] = audio;
    });
  }, []);

  const playSound = useCallback((key: keyof typeof SOUNDS) => {
    if (isMuted) return;
    const audio = audioRefs.current[key];
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {
        // Ignore autoplay errors
      });
    }
  }, [isMuted]);

  // Load Data
  useEffect(() => {
    const savedHighScore = localStorage.getItem('perfect-shot-highscore');
    if (savedHighScore) setHighScore(parseInt(savedHighScore));

    const savedLeaderboard = localStorage.getItem('perfect-shot-leaderboard');
    if (savedLeaderboard) setLeaderboard(JSON.parse(savedLeaderboard));

    const savedStats = localStorage.getItem('perfect-shot-stats');
    if (savedStats) setStats(JSON.parse(savedStats));
  }, []);

  // Save Stats
  const saveStats = (newStats: GameStats) => {
    setStats(newStats);
    localStorage.setItem('perfect-shot-stats', JSON.stringify(newStats));
  };

  // Animation Loop
  const animate = useCallback((time: number) => {
    if (gameState !== 'PLAYING' || isShooting) return;

    if (!startTimeRef.current) startTimeRef.current = time;
    const elapsed = time - startTimeRef.current;

    // Target movement (Sine wave)
    const targetSpeed = 0.001 * (1 + difficulty * 0.5);
    const newTargetPos = 50 + 40 * Math.sin(elapsed * targetSpeed * Math.PI);
    setTargetPos(newTargetPos);

    // Power bar movement (Ping-pong)
    const barSpeed = 0.003 * (1 + difficulty * 0.3);
    const newBarPos = (Math.sin(elapsed * barSpeed * Math.PI) + 1) * 50;
    setBarPos(newBarPos);

    requestRef.current = requestAnimationFrame(animate);
  }, [gameState, isShooting, difficulty]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  // Game Actions
  const startGame = () => {
    playSound('click');
    setScore(0);
    setStreak(0);
    setDifficulty(1);
    setGameState('PLAYING');
    setLastShotResult(null);
    saveStats({ ...stats, gamesPlayed: stats.gamesPlayed + 1 });
  };

  const handleShoot = () => {
    if (gameState !== 'PLAYING' || isShooting) return;

    setIsShooting(true);
    playSound('kick');

    const diff = Math.abs(targetPos - barPos);
    const isGoal = diff < 8;

    setTimeout(() => {
      const newStats = { ...stats, totalShots: stats.totalShots + 1 };
      
      if (isGoal) {
        playSound('goal');
        const points = 10 + streak * 2;
        setScore(prev => prev + points);
        const newStreak = streak + 1;
        setStreak(newStreak);
        setLastShotResult('GOAL');
        setDifficulty(prev => Math.min(prev + 0.1, 5));
        
        newStats.totalGoals += 1;
        newStats.highestStreak = Math.max(newStats.highestStreak, newStreak);
        
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: [COLORS.primary, '#FFFFFF', COLORS.secondary]
        });
      } else {
        playSound('miss');
        setGameState('RESULT');
        setLastShotResult('MISS');
        updateLeaderboard(score);
      }
      
      saveStats(newStats);
      setIsShooting(false);
    }, 600);
  };

  const updateLeaderboard = (finalScore: number) => {
    if (finalScore <= 0) return;

    const newEntry: LeaderboardEntry = {
      name: 'Player',
      score: finalScore,
      date: new Date().toLocaleDateString()
    };

    const updated = [...leaderboard, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    setLeaderboard(updated);
    localStorage.setItem('perfect-shot-leaderboard', JSON.stringify(updated));

    if (finalScore > highScore) {
      setHighScore(finalScore);
      localStorage.setItem('perfect-shot-highscore', finalScore.toString());
    }
  };

  const getRank = (s: number) => {
    if (s > 500) return 'Legendary Striker';
    if (s > 250) return 'Pro Finisher';
    if (s > 100) return 'Rising Star';
    if (s > 50) return 'Amateur';
    return 'Rookie';
  };

  const scrollToStats = () => {
    setIsMenuOpen(true);
    setTimeout(() => {
      menuStatsRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const accuracy = stats.totalShots > 0 
    ? Math.round((stats.totalGoals / stats.totalShots) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-purple-500/30 overflow-hidden flex flex-col">
      {/* --- Header --- */}
      <header className="p-6 flex justify-between items-center z-50">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2"
        >
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
            <Target className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-black tracking-tighter uppercase italic">VERSE</span>
        </motion.div>

        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-white/10"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-purple-400" />}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={scrollToStats}
            className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-white/10 text-xs font-bold uppercase tracking-widest"
          >
            <Medal className="w-4 h-4 text-purple-500" />
            Analytics
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsMenuOpen(true)}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-white/10"
          >
            <Menu className="w-6 h-6" />
          </motion.button>
        </div>
      </header>

      {/* --- Main Game Area --- */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 relative">
        <AnimatePresence mode="wait">
          {gameState === 'START' && (
            <motion.div
              key="start"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center space-y-8"
            >
              <div className="space-y-2">
                <h1 className="text-7xl md:text-9xl font-black tracking-tighter uppercase italic text-transparent bg-clip-text bg-gradient-to-b from-purple-400 to-purple-700">
                  PERFECT<br/>SHOT
                </h1>
                <p className="text-purple-300/60 font-medium tracking-widest uppercase text-sm">Precision Timing Challenge</p>
              </div>

              <div className="flex flex-col items-center gap-4">
                <button
                  onClick={startGame}
                  className="px-12 py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-full text-xl transition-all hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] active:scale-95"
                >
                  START GAME
                </button>
                
                <div className="flex items-center gap-6">
                  <div className="text-white/40 text-sm flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    Best: {highScore}
                  </div>
                  <button 
                    onClick={scrollToStats}
                    className="text-purple-400 text-sm flex items-center gap-2 hover:text-purple-300 transition-colors font-bold uppercase tracking-widest"
                  >
                    <Medal className="w-4 h-4" />
                    Analytics
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {gameState === 'PLAYING' && (
            <motion.div
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-2xl flex flex-col items-center gap-12"
              onClick={handleShoot}
            >
              {/* Score Display */}
              <div className="flex justify-between w-full px-4">
                <div className="flex flex-col">
                  <span className="text-xs text-purple-400 font-bold uppercase tracking-widest">Score</span>
                  <span className="text-4xl font-black">{score}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs text-purple-400 font-bold uppercase tracking-widest">Streak</span>
                  <span className="text-4xl font-black text-purple-500">x{streak}</span>
                </div>
              </div>

              {/* Goal Area */}
              <div className="relative w-full aspect-[16/9] bg-white/5 rounded-t-3xl border-x-8 border-t-8 border-white/20 overflow-hidden shadow-[inset_0_20px_50px_rgba(0,0,0,0.5)]">
                {/* Net Pattern */}
                <div className="absolute inset-0 opacity-10 pointer-events-none" 
                  style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} 
                />
                
                {/* Moving Target */}
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2 w-16 h-16 md:w-24 md:h-24 flex items-center justify-center"
                  style={{ left: `${targetPos}%`, transform: 'translate(-50%, -50%)' }}
                >
                  <div className="w-full h-full rounded-full border-4 border-purple-500 flex items-center justify-center animate-pulse">
                    <div className="w-3/4 h-3/4 rounded-full border-4 border-purple-400 flex items-center justify-center">
                      <div className="w-1/2 h-1/2 rounded-full bg-purple-600 shadow-[0_0_20px_rgba(139,92,246,0.8)]" />
                    </div>
                  </div>
                </motion.div>

                {/* Ball Animation */}
                {isShooting && (
                  <motion.div
                    initial={{ bottom: -50, left: '50%', scale: 1 }}
                    animate={{ 
                      bottom: '50%', 
                      left: `${barPos}%`, 
                      scale: 0.4,
                      rotate: 720
                    }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="absolute w-12 h-12 bg-white rounded-full shadow-xl z-10"
                    style={{ transform: 'translateX(-50%)' }}
                  >
                    {/* Ball details */}
                    <div className="absolute inset-0 border-2 border-black/10 rounded-full" />
                  </motion.div>
                )}
              </div>

              {/* Timing Bar */}
              <div className="w-full space-y-4">
                <div className="relative h-6 bg-white/10 rounded-full overflow-hidden border border-white/5">
                  {/* Target Zone Indicator (Visual guide) */}
                  <div 
                    className="absolute top-0 bottom-0 w-12 bg-purple-500/30 blur-sm"
                    style={{ left: `${targetPos}%`, transform: 'translateX(-50%)' }}
                  />
                  
                  {/* Moving Indicator */}
                  <motion.div
                    className="absolute top-0 bottom-0 w-2 bg-white shadow-[0_0_15px_white]"
                    style={{ left: `${barPos}%`, transform: 'translateX(-50%)' }}
                  />
                </div>
                <p className="text-center text-white/40 text-xs font-bold uppercase tracking-[0.3em]">Tap to shoot when aligned</p>
              </div>
            </motion.div>
          )}

          {gameState === 'RESULT' && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-xl text-center space-y-8"
            >
              <div className="space-y-2">
                <h2 className="text-purple-500 font-black text-xl uppercase tracking-widest">Game Over</h2>
                <div className="text-6xl font-black">{score}</div>
                <p className="text-white/60 font-medium italic">{getRank(score)}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <div className="text-xs text-white/40 uppercase font-bold mb-1">Best Streak</div>
                  <div className="text-2xl font-black text-purple-400">{streak}</div>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <div className="text-xs text-white/40 uppercase font-bold mb-1">High Score</div>
                  <div className="text-2xl font-black text-purple-400">{highScore}</div>
                </div>
              </div>

              <button
                onClick={startGame}
                className="w-full py-4 bg-white text-black font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-purple-50 transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
                PLAY AGAIN
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* --- Footer / Branding --- */}
      <footer className="p-8 text-center text-white/20 text-[10px] font-bold uppercase tracking-[0.5em]">
        &copy; 2026 VERSE ECOSYSTEM
      </footer>

      {/* --- Menu Overlay --- */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col"
          >
            <div className="p-6 flex justify-end">
              <button 
                onClick={() => setIsMenuOpen(false)}
                className="p-2 bg-white/5 rounded-full"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-12 space-y-12">
              {/* Analytics Section */}
              <section ref={menuStatsRef} className="space-y-6">
                <div className="flex items-center gap-3">
                  <Medal className="w-6 h-6 text-purple-500" />
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter">Analytics</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <div className="text-[10px] text-white/40 uppercase font-bold mb-1 tracking-widest">Total Goals</div>
                    <div className="text-2xl font-black text-purple-400">{stats.totalGoals}</div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <div className="text-[10px] text-white/40 uppercase font-bold mb-1 tracking-widest">Accuracy</div>
                    <div className="text-2xl font-black text-purple-400">{accuracy}%</div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <div className="text-[10px] text-white/40 uppercase font-bold mb-1 tracking-widest">Best Streak</div>
                    <div className="text-2xl font-black text-purple-400">{stats.highestStreak}</div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <div className="text-[10px] text-white/40 uppercase font-bold mb-1 tracking-widest">Games Played</div>
                    <div className="text-2xl font-black text-purple-400">{stats.gamesPlayed}</div>
                  </div>
                </div>
              </section>

              {/* Leaderboard Section */}
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <Trophy className="w-6 h-6 text-purple-500" />
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter">Leaderboard</h3>
                </div>
                
                <div className="space-y-2">
                  {leaderboard.length > 0 ? (
                    leaderboard.map((entry, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-4">
                          <span className="text-purple-500 font-black w-4">{i + 1}</span>
                          <span className="font-bold">{entry.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-white/40 text-xs">{entry.date}</span>
                          <span className="font-black text-lg">{entry.score}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-white/20 font-bold uppercase tracking-widest">No scores yet</div>
                  )}
                </div>
              </section>

              {/* Contact Section */}
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <Send className="w-6 h-6 text-purple-500" />
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter">Contact Us</h3>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  <a 
                    href="https://t.me/Getverse" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400">
                        <Send className="w-5 h-5" />
                      </div>
                      <span className="font-bold">Telegram</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/40 group-hover:text-white transition-colors">
                      <span className="text-sm">@Getverse</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </a>

                  <a 
                    href="https://twitter.com/VerseEcosystem" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                        <Twitter className="w-5 h-5" />
                      </div>
                      <span className="font-bold">Twitter</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/40 group-hover:text-white transition-colors">
                      <span className="text-sm">@VerseEcosystem</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </a>
                </div>
              </section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
