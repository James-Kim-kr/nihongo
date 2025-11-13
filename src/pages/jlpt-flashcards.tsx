import React, { useState, useEffect, useCallback } from 'react';
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

const stageSlots = [-1, 0, 1] as const;
const STORAGE_KEY = 'jlptFlashcardsState';

export default function JLPTFlashcards({ vocabData: initialVocabData }: JLPTFlashcardsProps) {
  const [vocabData, setVocabData] = useState<JLPTVocab>(initialVocabData);
  const [selectedLevel, setSelectedLevel] = useState<JLPTLevel>('N5');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const [hasHydrated, setHasHydrated] = useState(false);

  const minSwipeDistance = 50;
  const currentCards = vocabData[selectedLevel] || [];
  const totalCards = currentCards.length;

  const getCardKey = useCallback((index: number) => `${selectedLevel}-${index}`, [selectedLevel]);

  const handleSpeak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !text) return;

    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = 0.85;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const handleCardFlip = useCallback(
    (index: number) => {
      if (index < 0 || index >= totalCards) return;
      const cardKey = getCardKey(index);
      setFlippedCards(prev => ({
        ...prev,
        [cardKey]: !prev[cardKey],
      }));

      const card = vocabData[selectedLevel][index];
      if (card?.hiragana) {
        handleSpeak(card.hiragana);
      }
    },
    [getCardKey, handleSpeak, selectedLevel, totalCards, vocabData]
  );

  const handleNext = useCallback(() => {
    setCurrentIndex(prev => {
      if (prev >= totalCards - 1) return prev;
      return prev + 1;
    });
  }, [totalCards]);

  const handlePrevious = useCallback(() => {
    setCurrentIndex(prev => (prev <= 0 ? prev : prev - 1));
  }, []);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleCardFlip(currentIndex);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentIndex, handleCardFlip, handleNext, handlePrevious]);

  const clampToRange = useCallback((value: number, total: number) => {
    if (total <= 0) return 0;
    return Math.min(Math.max(value, 0), total - 1);
  }, []);

  const handleLevelChange = (level: JLPTLevel) => {
    setSelectedLevel(level);
    setFlippedCards({});
  };

  const handleSliderInput = useCallback(
    (nextIndex: number) => {
      const safeIndex = clampToRange(nextIndex, totalCards);
      setCurrentIndex(safeIndex);
    },
    [clampToRange, totalCards]
  );

  const handleShuffleLevel = useCallback(() => {
    setVocabData(prev => {
      const currentDeck = prev[selectedLevel] ?? [];
      if (currentDeck.length <= 1) {
        return prev;
      }
      const shuffled = [...currentDeck];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return {
        ...prev,
        [selectedLevel]: shuffled,
      };
    });
    setCurrentIndex(0);
    setFlippedCards(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        if (key.startsWith(`${selectedLevel}-`)) {
          delete next[key];
        }
      });
      return next;
    });
  }, [selectedLevel, setVocabData]);

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
        parsed?.level && levels.includes(parsed.level) ? parsed.level : undefined;
      if (storedLevel && storedLevel !== selectedLevel) {
        setSelectedLevel(storedLevel);
      }
      const levelForIndex = storedLevel ?? selectedLevel;
      const storedIndex = parsed?.positions?.[levelForIndex];
      if (typeof storedIndex === 'number') {
        const total = vocabData[levelForIndex]?.length ?? 0;
        setCurrentIndex(clampToRange(storedIndex, total));
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
    const payload = {
      level: selectedLevel,
      positions,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [selectedLevel, currentIndex, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated) return;
    const clamped = clampToRange(currentIndex, totalCards);
    if (clamped !== currentIndex) {
      setCurrentIndex(clamped);
    }
  }, [currentIndex, totalCards, clampToRange, hasHydrated]);

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

  if (!currentCards.length) {
    return <div className="flashcard-container">No vocabulary data available.</div>;
  }

  const activeCard = currentCards[currentIndex];

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
            <p className="subtitle">
              세 장의 카드로 문맥을 느끼며 단어를 익히세요. 탭하면 즉시 뒤집히고 일본어 발음이 재생됩니다.
            </p>

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
                    disabled={(vocabData[selectedLevel]?.length ?? 0) <= 1}
                  >
                    섞기
                  </button>
                </div>
              </div>
            </div>
          </header>

          <section className="interaction-zone">
            <button
              className="nav-btn"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              aria-label="이전 카드"
            >
              ‹
            </button>

            <div
              className="card-row"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              {stageSlots.map(offset => {
                const actualIndex = currentIndex + offset;
                const card = currentCards[actualIndex];
                const cardKey = card ? getCardKey(actualIndex) : `placeholder-${offset}`;
                const isActive = offset === 0 && !!card;
                const isFlipped = card ? !!flippedCards[cardKey] : false;

                if (!card) {
                  return (
                    <div key={cardKey} className="card-wrapper placeholder" aria-hidden="true">
                      <div className="card-shell ghost">
                        <div className="ghost-label">No card</div>
                      </div>
                    </div>
                  );
                }

                const primaryText = card.hiragana;
                const secondaryText = card.nihongo ?? card.hiragana;

                return (
                  <div
                    key={cardKey}
                    className={`card-wrapper${isActive ? ' active' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isFlipped}
                    aria-label={`${card.nihongo || card.hiragana} 카드`}
                    onClick={() => handleCardFlip(actualIndex)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleCardFlip(actualIndex);
                      }
                    }}
                  >
                    <div className="card-shell">
                      <div className={`card-inner ${isFlipped ? 'flipped' : ''}`}>
                        <div className="card-face card-front">
                          <p className="card-label">Japanese</p>
                          <span className="japanese-text">{primaryText}</span>
                          {secondaryText && <span className="hiragana-text">{secondaryText}</span>}
                          {card.romaji && <span className="romaji-text">{card.romaji}</span>}
                          <p className="flip-hint">탭하면 의미와 발음이 재생돼요</p>
                        </div>
                        <div className="card-face card-back">
                          <p className="card-label">Korean</p>
                          <span className="korean-text">{card.korean}</span>
                          <span className="hiragana-text muted">{card.hiragana}</span>
                          <span className="romaji-text muted">{card.romaji}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              className="nav-btn"
              onClick={handleNext}
              disabled={currentIndex === totalCards - 1}
              aria-label="다음 카드"
            >
              ›
            </button>
          </section>

          <section className="helper-panel">
            <div>
              <p className="helper-title">학습 팁</p>
              <ul>
                <li>가운데 카드를 기준으로 이전/다음 단어를 한눈에 비교하세요.</li>
                <li>스페이스바 또는 엔터키로 현재 카드를 뒤집고 발음을 다시 들을 수 있어요.</li>
                <li>모바일에서는 좌우 스와이프로 빠르게 레벨별 단어를 탐색할 수 있습니다.</li>
              </ul>
            </div>
            {activeCard && (
              <div className="active-card-info">
                <p className="helper-title">현재 카드</p>
                <p className="active-hiragana">{activeCard.hiragana}</p>
                <p className="active-nihongo">{activeCard.nihongo ?? activeCard.hiragana}</p>
              </div>
            )}
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
          max-width: 1200px;
          display: flex;
          flex-direction: column;
          gap: 32px;
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
          font-size: 2.8rem;
          margin: 0;
          font-weight: 700;
        }

        .subtitle {
          color: rgba(255, 255, 255, 0.8);
          font-size: 1rem;
          margin-bottom: 10px;
        }

        .level-selector {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 12px;
          margin-top: 10px;
        }

        .level-btn {
          padding: 10px 24px;
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

        .level-btn:hover {
          transform: translateY(-2px);
        }

        .stats-bar {
          margin-top: 14px;
          padding: 16px 24px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 28px;
          flex-wrap: wrap;
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
          background: rgba(255, 255, 255, 0.2);
          outline: none;
        }

        .progress-scrubber::-webkit-slider-thumb {
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ffd452, #ff5f6d);
          cursor: pointer;
          border: none;
          box-shadow: 0 0 0 4px rgba(255, 95, 109, 0.2);
        }

        .progress-scrubber::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ffd452, #ff5f6d);
          border: none;
          cursor: pointer;
          box-shadow: 0 0 0 4px rgba(255, 95, 109, 0.2);
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
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

        .progress-track {
          width: 220px;
          height: 6px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.15);
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #ffd452, #ffb347, #ff5f6d);
        }

        .interaction-zone {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 24px;
          flex-wrap: wrap;
        }

        .nav-btn {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          border: none;
          background: linear-gradient(135deg, #ff758c, #ff7eb3);
          color: #0b0f1a;
          font-size: 1.8rem;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          box-shadow: 0 15px 35px rgba(255, 118, 142, 0.3);
        }

        .nav-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
          box-shadow: none;
        }

        .nav-btn:not(:disabled):hover {
          transform: translateY(-3px) scale(1.05);
        }

        .card-row {
          width: min(960px, 92vw);
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 32px;
          align-items: center;
        }

        .card-wrapper {
          width: 100%;
          max-width: 300px;
          height: 420px;
          justify-self: center;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.35s ease, opacity 0.35s ease;
        }

        .card-wrapper.active {
          transform: translateY(-12px) scale(1.05);
          opacity: 1;
        }

        .card-wrapper:not(.active) {
          transform: translateY(12px) scale(0.94);
          opacity: 0.78;
        }

        .card-wrapper.placeholder {
          pointer-events: none;
          opacity: 0.35;
          transform: none;
        }

        .card-shell {
          width: 100%;
          height: 100%;
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(12, 18, 34, 0.65);
          box-shadow: 0 25px 50px rgba(5, 8, 20, 0.55);
          padding: 0;
          position: relative;
          display: flex;
          align-items: stretch;
          justify-content: stretch;
          perspective: 1200px;
        }

        .card-shell.ghost {
          border: 1px dashed rgba(255, 255, 255, 0.15);
          background: rgba(255, 255, 255, 0.04);
          box-shadow: none;
          align-items: center;
          justify-content: center;
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

        .ghost-label {
          font-size: 0.9rem;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.4);
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
          background: linear-gradient(145deg, rgba(102, 152, 255, 0.9), rgba(53, 80, 185, 0.95));
        }

        .card-back {
          background: linear-gradient(145deg, rgba(255, 213, 130, 0.92), rgba(255, 132, 141, 0.98));
          transform: rotateY(180deg);
        }

        .card-label {
          text-transform: uppercase;
          letter-spacing: 2px;
          font-size: 0.8rem;
          margin-bottom: 16px;
          opacity: 0.8;
        }

        .japanese-text {
          font-size: 3.6rem;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .hiragana-text {
          font-size: 1.8rem;
          font-weight: 500;
        }

        .romaji-text {
          font-size: 1.1rem;
          margin-top: 6px;
          letter-spacing: 1px;
        }

        .romaji-text.muted,
        .hiragana-text.muted {
          opacity: 0.75;
        }

        .korean-text {
          font-size: 2.4rem;
          font-weight: 700;
          margin-bottom: 10px;
        }

        .flip-hint {
          margin-top: 24px;
          font-size: 0.9rem;
          opacity: 0.8;
        }

        .helper-panel {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          padding: 24px;
          border-radius: 28px;
          background: rgba(9, 13, 26, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.08);
          flex-wrap: wrap;
        }

        .helper-title {
          font-weight: 700;
          margin-bottom: 8px;
        }

        .helper-panel ul {
          margin: 0;
          padding-left: 18px;
          color: rgba(255, 255, 255, 0.8);
        }

        .helper-panel li {
          margin-bottom: 6px;
          line-height: 1.4;
        }

        .active-card-info {
          min-width: 220px;
          text-align: right;
        }

        .active-hiragana {
          font-size: 2rem;
          font-weight: 700;
          color: #fff;
        }

        .active-nihongo {
          font-size: 1.2rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.75);
        }

        @media (max-width: 900px) {
          .interaction-zone {
            flex-direction: column;
          }

          .card-row {
            grid-template-columns: minmax(0, 1fr);
            width: 100%;
            gap: 18px;
          }

          .card-wrapper {
            max-width: 360px;
            margin: 0 auto;
            transform: none;
            opacity: 1;
          }

          .helper-panel {
            flex-direction: column;
            text-align: left;
          }

          .active-card-info {
            text-align: left;
          }
        }

        @media (max-width: 600px) {
          h1 {
            font-size: 2.1rem;
          }

          .nav-btn {
            width: 52px;
            height: 52px;
          }

          .card-wrapper {
            max-width: 320px;
            height: 320px;
          }

          .japanese-text {
            font-size: 3rem;
          }

          .korean-text {
            font-size: 2rem;
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
