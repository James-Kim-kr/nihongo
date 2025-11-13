import React, { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import { GetStaticProps } from 'next';
import fs from 'fs';
import path from 'path';

const levels = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;
type JLPTLevel = typeof levels[number];
const isJLPTLevel = (value: string): value is JLPTLevel =>
  (levels as readonly string[]).includes(value);

interface VocabCard {
  hiragana: string;
  nihongo?: string | null;
  korean: string;
  level: JLPTLevel;
  romaji?: string | null;
}

type JLPTVocab = Record<JLPTLevel, VocabCard[]>;

interface JLPTFlashcardsProps {
  vocabData: JLPTVocab;
}

const STORAGE_KEY = 'jlptFlashcardsState';
const AUTO_JA_DURATION = 1800;
const AUTO_KO_DURATION = 1800;

export default function JLPTFlashcards({ vocabData: initialVocabData }: JLPTFlashcardsProps) {
  const [vocabData, setVocabData] = useState<JLPTVocab>(initialVocabData);
  const [selectedLevel, setSelectedLevel] = useState<JLPTLevel>('N5');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFrontSide, setIsFrontSide] = useState(true);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);

  const autoplayTimers = useRef<NodeJS.Timeout[]>([]);
  const minSwipeDistance = 50;

  const currentDeck = vocabData[selectedLevel] || [];
  const totalCards = currentDeck.length;
  const activeCard = currentDeck[currentIndex];

  const speakText = useCallback((text?: string | null, lang: 'ja-JP' | 'ko-KR' = 'ja-JP') => {
    if (typeof window === 'undefined' || !text) return;
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = lang === 'ja-JP' ? 0.9 : 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, []);

  const clearAutoplayTimers = useCallback(() => {
    autoplayTimers.current.forEach(timer => clearTimeout(timer));
    autoplayTimers.current = [];
  }, []);

  const stopAutoplay = useCallback(() => {
    clearAutoplayTimers();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsAutoPlaying(false);
  }, [clearAutoplayTimers]);

  const clampToRange = useCallback((value: number, total: number) => {
    if (total <= 0) return 0;
    return Math.min(Math.max(value, 0), total - 1);
  }, []);

  const handleLevelChange = useCallback(
    (level: JLPTLevel) => {
      stopAutoplay();
      setSelectedLevel(level);
      setCurrentIndex(0);
      setIsFrontSide(true);
    },
    [stopAutoplay]
  );

  const handleShuffleLevel = useCallback(() => {
    stopAutoplay();
    setVocabData(prev => {
      const deck = prev[selectedLevel] ?? [];
      if (deck.length <= 1) return prev;
      const shuffled = [...deck];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return { ...prev, [selectedLevel]: shuffled };
    });
    setCurrentIndex(0);
    setIsFrontSide(true);
  }, [selectedLevel, stopAutoplay]);

  const handleSliderInput = useCallback(
    (nextIndex: number) => {
      stopAutoplay();
      const safe = clampToRange(nextIndex, totalCards);
      setCurrentIndex(safe);
      setIsFrontSide(true);
    },
    [clampToRange, stopAutoplay, totalCards]
  );

  const handleCardTap = useCallback(() => {
    if (!activeCard) return;
    stopAutoplay();
    if (isFrontSide) {
      speakText(activeCard.hiragana, 'ja-JP');
    } else {
      speakText(activeCard.korean, 'ko-KR');
    }
    setIsFrontSide(prev => !prev);
  }, [activeCard, isFrontSide, speakText, stopAutoplay]);

  const handleNext = useCallback(() => {
    stopAutoplay();
    setCurrentIndex(prev => (prev >= totalCards - 1 ? prev : prev + 1));
    setIsFrontSide(true);
  }, [stopAutoplay, totalCards]);

  const handlePrevious = useCallback(() => {
    stopAutoplay();
    setCurrentIndex(prev => (prev <= 0 ? prev : prev - 1));
    setIsFrontSide(true);
  }, [stopAutoplay]);

  const handleToggleAutoplay = useCallback(() => {
    if (isAutoPlaying) {
      stopAutoplay();
      return;
    }
    if (!activeCard) return;
    setIsFrontSide(true);
    setIsAutoPlaying(true);
  }, [activeCard, isAutoPlaying, stopAutoplay]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setHasHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw);
      const storedLevel: JLPTLevel | undefined =
        parsed?.level && isJLPTLevel(parsed.level) ? parsed.level : undefined;
      const levelToUse = storedLevel ?? selectedLevel;
      if (storedLevel && storedLevel !== selectedLevel) {
        setSelectedLevel(storedLevel);
      }
      const storedIndex = parsed?.positions?.[levelToUse];
      if (typeof storedIndex === 'number') {
        const deckSize = vocabData[levelToUse]?.length ?? 0;
        setCurrentIndex(clampToRange(storedIndex, deckSize));
      }
    } catch (error) {
      console.warn('Unable to read flashcard state', error);
    } finally {
      setHasHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocabData]);

  useEffect(() => {
    if (!hasHydrated || typeof window === 'undefined') return;
    let positions: Record<string, number> = {};
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.positions && typeof parsed.positions === 'object') {
          positions = parsed.positions;
        }
      }
    } catch {
      positions = {};
    }
    positions[selectedLevel] = currentIndex;
    const payload = { level: selectedLevel, positions };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [selectedLevel, currentIndex, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated) return;
    const clamped = clampToRange(currentIndex, totalCards);
    if (clamped !== currentIndex) {
      setCurrentIndex(clamped);
    }
  }, [currentIndex, totalCards, clampToRange, hasHydrated]);

  useEffect(() => {
    return () => {
      clearAutoplayTimers();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [clearAutoplayTimers]);

  useEffect(() => {
    if (!isAutoPlaying || !activeCard) {
      clearAutoplayTimers();
      return;
    }

    setIsFrontSide(true);
    speakText(activeCard.hiragana, 'ja-JP');

    const flipTimer = setTimeout(() => {
      setIsFrontSide(false);
      speakText(activeCard.korean, 'ko-KR');
    }, AUTO_JA_DURATION);

    const nextTimer = setTimeout(() => {
      setCurrentIndex(prev => (prev >= totalCards - 1 ? 0 : prev + 1));
      setIsFrontSide(true);
    }, AUTO_JA_DURATION + AUTO_KO_DURATION);

    autoplayTimers.current = [flipTimer, nextTimer];

    return () => clearAutoplayTimers();
  }, [activeCard, isAutoPlaying, totalCards, speakText, clearAutoplayTimers]);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (touchStart === null || touchEnd === null) return;
    const distance = touchStart - touchEnd;
    if (distance > minSwipeDistance) {
      handleNext();
    } else if (distance < -minSwipeDistance) {
      handlePrevious();
    }
  };

  if (!activeCard) {
    return (
      <div className="flashcard-container">
        <div className="empty-state">선택한 레벨에 카드가 없습니다.</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>JLPT Flashcards - Learn Japanese Vocabulary</title>
        <meta name="description" content="Interactive JLPT vocabulary flashcards for levels N5 to N1" />
      </Head>

      <div className="flashcard-container">
        <div className="flashcard-shell">
          <header className="flashcard-header">
            <p className="eyebrow">Neo Study Deck</p>
            <h1>JLPT Immersive Flashcards</h1>
            <p className="subtitle">한 장씩 집중해서 일본어·한국어 의미와 발음을 번갈아 익혀보세요.</p>

            <div className="level-selector">
              {levels.map(level => (
                <button
                  key={level}
                  className={`level-btn ${selectedLevel === level ? 'active' : ''}`}
                  onClick={() => handleLevelChange(level)}
                >
                  {level}
                </button>
              ))}
            </div>

            <div className="stats-bar">
              <div className="stat-block">
                <span className="stat-label">현재 카드</span>
                <strong>
                  {totalCards === 0 ? 0 : currentIndex + 1} / {totalCards}
                </strong>
              </div>
              <label className="scrubber-label">
                <span className="sr-only">카드 위치 조정</span>
                <input
                  className="progress-scrubber"
                  type="range"
                  min={0}
                  max={Math.max(totalCards - 1, 0)}
                  step={1}
                  value={Math.min(currentIndex, Math.max(totalCards - 1, 0))}
                  onChange={e => handleSliderInput(Number(e.target.value))}
                  disabled={totalCards <= 1}
                />
              </label>
              <div className="stat-block level-block">
                <span className="stat-label">선택 레벨</span>
                <div className="level-display">
                  <strong>{selectedLevel}</strong>
                  <button
                    type="button"
                    className="shuffle-btn"
                    onClick={handleShuffleLevel}
                    disabled={totalCards <= 1}
                  >
                    섞기
                  </button>
                </div>
              </div>
            </div>
          </header>

          <div className="nav-controls">
            <button
              className="nav-btn"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              aria-label="이전 카드"
            >
              ‹
            </button>
            <button
              className="nav-btn"
              onClick={handleNext}
              disabled={currentIndex === totalCards - 1}
              aria-label="다음 카드"
            >
              ›
            </button>
          </div>

          <section className="interaction-zone">
            <div
              className="card-viewer"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <div
                className="card-wrapper single"
                role="button"
                tabIndex={0}
                aria-pressed={!isFrontSide}
                aria-label="현재 카드"
                onClick={handleCardTap}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardTap();
                  }
                }}
              >
                <div className="card-shell">
                  <div className={`card-inner ${isFrontSide ? '' : 'flipped'}`}>
                    <div className="card-face card-front">
                      <p className="card-label">Japanese</p>
                      <span className="japanese-text">{activeCard.hiragana}</span>
                      <span className="hiragana-text">{activeCard.nihongo ?? activeCard.hiragana}</span>
                      {activeCard.romaji && <span className="romaji-text">{activeCard.romaji}</span>}
                      <p className="flip-hint">탭하면 발음을 듣고 의미를 확인해요</p>
                    </div>
                    <div className="card-face card-back">
                      <p className="card-label">Korean</p>
                      <span className="korean-text">{activeCard.korean}</span>
                      <span className="romaji-text muted">{activeCard.nihongo ?? activeCard.hiragana}</span>
                      <p className="flip-hint">탭하면 일본어로 돌아갑니다</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="auto-controller">
            <button
              type="button"
              className={`play-btn ${isAutoPlaying ? 'pause' : 'play'}`}
              onClick={handleToggleAutoplay}
              disabled={!totalCards}
            >
              {isAutoPlaying ? '중지' : '플레이'}
            </button>
          </section>
        </div>
      </div>

      <style jsx>{`
        .flashcard-container {
          min-height: 100vh;
          background: radial-gradient(circle at 20% 20%, #243b55, #141e30 60%, #090d18 100%);
          padding: 40px 20px 80px;
          display: flex;
          justify-content: center;
          color: #f5f6ff;
        }

        .flashcard-shell {
          width: 100%;
          max-width: 960px;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .flashcard-header {
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .eyebrow {
          text-transform: uppercase;
          letter-spacing: 4px;
          font-size: 0.8rem;
          color: rgba(255, 255, 255, 0.7);
        }

        h1 {
          font-size: 2.6rem;
          margin: 0;
          font-weight: 700;
        }

        .subtitle {
          color: rgba(255, 255, 255, 0.8);
          font-size: 1rem;
          margin-bottom: 12px;
        }

        .level-selector {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 10px;
        }

        .level-btn {
          padding: 10px 22px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          background: transparent;
          color: inherit;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .level-btn.active {
          background: linear-gradient(135deg, #ff9a8b, #ff6a88, #ff99ac);
          color: #0b0f1a;
          border-color: transparent;
        }

        .stats-bar {
          margin-top: 10px;
          padding: 16px 24px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 24px;
          flex-wrap: wrap;
        }

        .nav-controls {
          display: flex;
          justify-content: center;
          gap: 18px;
          margin-top: -10px;
        }

        .stat-block {
          min-width: 140px;
          text-align: center;
        }

        .stat-label {
          display: block;
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 6px;
        }

        .scrubber-label {
          flex: 1;
          min-width: 220px;
          display: flex;
          align-items: center;
        }

        .progress-scrubber {
          width: 100%;
          appearance: none;
          height: 6px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.25);
          outline: none;
        }

        .progress-scrubber::-webkit-slider-thumb {
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ffd452, #ff5f6d);
          border: none;
          box-shadow: 0 0 0 4px rgba(255, 95, 109, 0.2);
          cursor: pointer;
        }

        .level-display {
          display: flex;
          align-items: center;
          gap: 10px;
          justify-content: center;
        }

        .shuffle-btn {
          padding: 8px 14px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.4);
          background: transparent;
          color: inherit;
          cursor: pointer;
        }

        .interaction-zone {
          display: flex;
          justify-content: center;
          padding: 20px 0 50px;
        }

        .card-viewer {
          width: 100%;
          display: flex;
          justify-content: center;
        }

        .card-wrapper.single {
          width: min(280px, 65vw);
          height: min(330px, 45vh);
          cursor: pointer;
        }

        .card-shell {
          width: 100%;
          height: 100%;
          border-radius: 30px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(0, 0, 0, 0.2);
          box-shadow: 0 20px 45px rgba(4, 8, 20, 0.6);
          perspective: 1200px;
          position: relative;
        }

        .card-inner {
          width: 100%;
          height: 100%;
          position: relative;
          transform-style: preserve-3d;
          transition: transform 0.6s ease;
          border-radius: inherit;
        }

        .card-inner.flipped {
          transform: rotateY(180deg);
        }

        .card-face {
          position: absolute;
          width: 100%;
          height: 100%;
          backface-visibility: hidden;
          border-radius: inherit;
          padding: 40px 32px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          color: #fff;
        }

        .card-front {
          background: linear-gradient(145deg, rgba(90, 134, 255, 0.92), rgba(59, 82, 184, 0.95));
        }

        .card-back {
          background: linear-gradient(145deg, rgba(255, 189, 130, 0.92), rgba(255, 135, 141, 0.98));
          transform: rotateY(180deg);
        }

        .card-label {
          text-transform: uppercase;
          letter-spacing: 2px;
          font-size: 0.8rem;
          margin-bottom: 12px;
          opacity: 0.85;
        }

        .japanese-text {
          font-size: clamp(2.2rem, 5vw, 3.4rem);
          font-weight: 700;
          margin-bottom: 8px;
        }

        .hiragana-text {
          font-size: clamp(1.2rem, 2.5vw, 1.8rem);
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }

        .romaji-text {
          font-size: 1rem;
          margin-top: 6px;
          letter-spacing: 1px;
          opacity: 0.9;
        }

        .romaji-text.muted {
          opacity: 0.7;
        }

        .korean-text {
          font-size: clamp(1.8rem, 4vw, 2.6rem);
          font-weight: 700;
          margin: 10px 0;
        }

        .flip-hint {
          margin-top: 24px;
          font-size: 0.9rem;
          opacity: 0.8;
        }

        .nav-btn {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          border: none;
          background: linear-gradient(135deg, #ff758c, #ff7eb3);
          color: #0b0f1a;
          font-size: 2rem;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          box-shadow: 0 15px 35px rgba(255, 118, 142, 0.3);
        }

        .nav-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
          box-shadow: none;
        }

        .auto-controller {
          display: flex;
          justify-content: center;
          margin-top: 70px;
        }

        .play-btn {
          width: 200px;
          height: 60px;
          border-radius: 30px;
          border: none;
          font-size: 1.3rem;
          font-weight: 700;
          cursor: pointer;
          color: #0b0f1a;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .play-btn.play {
          background: linear-gradient(135deg, #56ccf2, #2f80ed);
          box-shadow: 0 15px 40px rgba(47, 128, 237, 0.35);
        }

        .play-btn.pause {
          background: linear-gradient(135deg, #f2994a, #f2c94c);
          box-shadow: 0 15px 40px rgba(242, 153, 74, 0.35);
        }

        .play-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          box-shadow: none;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          border: 0;
        }

        .empty-state {
          padding: 60px 30px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 1.2rem;
        }

        @media (max-width: 900px) {
          .interaction-zone {
            flex-direction: column;
            padding: 10px 0 40px;
          }

          .card-wrapper.single {
            width: 80vw;
            height: min(300px, 45vh);
          }
        }

        @media (max-width: 600px) {
          h1 {
            font-size: 2rem;
          }

          .nav-btn {
            width: 52px;
            height: 52px;
          }

          .card-wrapper.single {
            height: 260px;
          }

          .play-btn {
            width: 180px;
          }
        }
      `}</style>
    </>
  );
}

type RawJLPTEntry = {
  hiragana: string;
  nihongo?: string | null;
  korean: string;
  level: string;
  romaji?: string | null;
};

const buildEmptyVocab = (): JLPTVocab =>
  levels.reduce((acc, level) => {
    acc[level] = [];
    return acc;
  }, {} as JLPTVocab);

export const getStaticProps: GetStaticProps = async () => {
  const filePath = path.join(process.cwd(), 'public', 'n1-n5_words.json');
  const fileContents = fs.readFileSync(filePath, 'utf8');
  const rawData: RawJLPTEntry[] = JSON.parse(fileContents);

  const vocabData: JLPTVocab = buildEmptyVocab();

  rawData.forEach(entry => {
    if (!entry?.hiragana || !entry.level) return;
    if (!isJLPTLevel(entry.level)) return;

    vocabData[entry.level].push({
      hiragana: entry.hiragana,
      nihongo: entry.nihongo ?? null,
      korean: entry.korean,
      level: entry.level,
      romaji: entry.romaji ?? null,
    });
  });

  return {
    props: {
      vocabData,
    },
  };
};
