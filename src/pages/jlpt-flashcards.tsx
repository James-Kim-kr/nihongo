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

  const handleComingSoon = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.alert('서비스 준비중입니다.');
    }
  }, []);

  const handlePrevButton = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      handlePrevious();
    },
    [handlePrevious]
  );

  const handleNextButton = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      handleNext();
    },
    [handleNext]
  );

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
      <div className="flashcard-page">
        <div className="flashcard-container">
          <div className="empty-state">선택한 레벨에 카드가 없습니다.</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>JLPT Flashcards - Learn Japanese Vocabulary</title>
        <meta name="description" content="Interactive JLPT vocabulary flashcards for levels N5 to N1" />
      </Head>

      <div className="flashcard-page">
        <div className="flashcard-container">
          <div className="flashcard-shell">
            <nav className="primary-menu">
              <button type="button" className="menu-tab active" aria-current="page">
                어휘 카드
              </button>
              <button type="button" className="menu-tab" onClick={handleComingSoon}>
                어휘 게임
              </button>
              <button type="button" className="menu-tab" onClick={handleComingSoon}>
                문장 배우기
              </button>
            </nav>
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
                <div className="stat-block slider-block">
                  <span className="stat-label">카드 위치</span>
                  <div className="slider-inline">
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
                    <button
                      type="button"
                      className="shuffle-btn compact"
                      onClick={handleShuffleLevel}
                      disabled={totalCards <= 1}
                    >
                      섞기
                    </button>
                  </div>
                </div>
              </div>
            </header>

          <section className="interaction-zone">
            <div
              className="card-viewer"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <button
                type="button"
                className="card-nav prev"
                onClick={handlePrevButton}
                onKeyDown={event => event.stopPropagation()}
                disabled={currentIndex === 0}
                aria-label="이전 카드"
              >
                ‹
              </button>
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
                  <div className={`card-face-static ${isFrontSide ? 'card-front' : 'card-back'}`}>
                    {isFrontSide ? (
                      <>
                        <p className="card-label">Japanese</p>
                        <span className="japanese-text">{activeCard.hiragana}</span>
                        <span className="hiragana-text">{activeCard.nihongo ?? activeCard.hiragana}</span>
                        {activeCard.romaji && <span className="romaji-text">{activeCard.romaji}</span>}
                        <p className="flip-hint">탭하면 한국어 의미를 확인해요</p>
                      </>
                    ) : (
                      <>
                        <p className="card-label">Korean</p>
                        <span className="korean-text">{activeCard.korean}</span>
                        <span
                          className="romaji-text placeholder"
                          aria-hidden="true"
                        >
                          {activeCard.nihongo ?? activeCard.hiragana}
                        </span>
                        <p className="flip-hint">탭하면 일본어 카드로 돌아가요</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="card-nav next"
                onClick={handleNextButton}
                onKeyDown={event => event.stopPropagation()}
                disabled={currentIndex === totalCards - 1}
                aria-label="다음 카드"
              >
                ›
              </button>
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
      </div>

      <style jsx>{`
        .flashcard-page {
          min-height: 100vh;
          width: 100%;
          background: radial-gradient(circle at 20% 20%, #283d5f, #0f1829 55%, #05070f 100%);
          padding: clamp(32px, 5vw, 80px) clamp(16px, 5vw, 60px);
          overflow-x: hidden;
          display: flex;
          justify-content: center;
          box-sizing: border-box;
        }

        .flashcard-container {
          width: 100%;
          max-width: 1080px;
          margin: 0 auto;
          padding: 0 8px;
          color: #e9edff;
          display: flex;
          justify-content: center;
          align-items: stretch;
          box-sizing: border-box;
        }

        .flashcard-shell {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 32px;
          padding: clamp(32px, 4vw, 48px);
          border-radius: 40px;
          background: rgba(10, 16, 34, 0.65);
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(18px);
          box-shadow: 0 30px 80px rgba(3, 6, 15, 0.65);
        }

        .primary-menu {
          display: flex;
          justify-content: center;
          gap: 12px;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }

        .menu-tab {
          min-width: 120px;
          padding: 10px 22px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: rgba(255, 255, 255, 0.02);
          color: inherit;
          font-weight: 600;
          letter-spacing: 0.08em;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .menu-tab.active {
          background: linear-gradient(120deg, #8ec5fc, #e0c3fc);
          color: #0a1022;
          border-color: transparent;
          box-shadow: 0 12px 30px rgba(142, 197, 252, 0.35);
          cursor: default;
        }

        .flashcard-header {
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .eyebrow {
          text-transform: uppercase;
          letter-spacing: 0.45em;
          font-size: 0.78rem;
          color: rgba(233, 237, 255, 0.6);
        }

        h1 {
          font-size: clamp(2.4rem, 4vw, 3.4rem);
          margin: 0;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .subtitle {
          color: rgba(233, 237, 255, 0.75);
          font-size: 1.05rem;
          margin-bottom: 4px;
        }

        .level-selector {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 10px;
          padding: 12px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .level-btn {
          padding: 10px 22px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.02);
          color: inherit;
          font-weight: 600;
          letter-spacing: 0.08em;
          cursor: pointer;
          transition: transform 0.25s ease, background 0.25s ease, color 0.25s ease, border 0.25s ease;
        }

        .level-btn.active {
          background: linear-gradient(120deg, #8ec5fc, #e0c3fc);
          color: #0a1022;
          border-color: transparent;
          box-shadow: 0 12px 30px rgba(142, 197, 252, 0.35);
          transform: translateY(-2px);
        }

        .stats-bar {
          margin-top: 8px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 18px;
          width: 100%;
        }

        .stat-block {
          width: 100%;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          box-sizing: border-box;
        }

        .stat-block strong {
          font-size: 1.4rem;
          letter-spacing: 0.08em;
        }

        .stat-label {
          font-size: 0.75rem;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: rgba(233, 237, 255, 0.55);
        }

        .slider-block {
          width: 100%;
          align-items: stretch;
          gap: 12px;
          display: flex;
          flex-direction: column;
        }

        .slider-inline {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: nowrap;
          min-width: 0;
        }

        .scrubber-label {
          width: 100%;
          display: flex;
          align-items: center;
          margin: 0;
          flex: 1;
          min-width: 0;
        }

        .progress-scrubber {
          width: 100%;
          max-width: 100%;
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.2);
          outline: none;
        }

        .progress-scrubber:disabled {
          opacity: 0.4;
        }

        .progress-scrubber::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: linear-gradient(120deg, #ff9a9e, #fad0c4);
          border: none;
          box-shadow: 0 6px 18px rgba(250, 208, 196, 0.45);
          cursor: pointer;
        }

        .progress-scrubber::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: linear-gradient(120deg, #ff9a9e, #fad0c4);
          border: none;
          box-shadow: 0 6px 18px rgba(250, 208, 196, 0.45);
          cursor: pointer;
        }

        .shuffle-btn {
          padding: 12px 22px;
          border-radius: 999px;
          border: none;
          font-weight: 700;
          letter-spacing: 0.08em;
          background: linear-gradient(130deg, #fddb92, #d1fdff);
          color: #0f1324;
          cursor: pointer;
          transition: transform 0.25s ease, box-shadow 0.25s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .shuffle-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
        }

        .shuffle-btn:not(:disabled):hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 25px rgba(209, 253, 255, 0.4);
        }

        .shuffle-btn.compact {
          padding: 10px 18px;
          font-size: 0.95rem;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .interaction-zone {
          display: flex;
          justify-content: center;
          padding: 10px 0 40px;
        }

        .card-viewer {
          width: 100%;
          display: flex;
          justify-content: center;
          position: relative;
        }

        .card-wrapper.single {
          width: min(360px, 72vw);
          min-height: min(360px, 50vh);
          cursor: pointer;
          margin: 0 auto;
          display: flex;
          align-items: stretch;
          justify-content: center;
        }

        .card-nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 58px;
          height: 58px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(5, 6, 15, 0.55);
          color: #f8f9ff;
          font-size: 2rem;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.25s ease, background 0.25s ease, box-shadow 0.25s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
        }

        .card-nav.prev {
          left: 6%;
        }

        .card-nav.next {
          right: 6%;
        }

        .card-nav:disabled {
          opacity: 0.35;
          cursor: not-allowed;
          box-shadow: none;
          border-color: rgba(255, 255, 255, 0.08);
        }

        .card-nav:not(:disabled):hover {
          transform: translateY(calc(-50% - 2px));
          background: rgba(255, 255, 255, 0.15);
        }

        .card-shell {
          width: 100%;
          min-height: inherit;
          border-radius: 36px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(7, 10, 26, 0.58);
          box-shadow: 0 28px 80px rgba(2, 2, 8, 0.65);
          position: relative;
          overflow: hidden;
          display: flex;
        }

        .card-face-static {
          width: 100%;
          min-height: inherit;
          border-radius: inherit;
          padding: 44px 36px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          color: #fff;
          gap: 6px;
          transition: background 0.35s ease, color 0.35s ease;
        }

        .card-front {
          background: linear-gradient(160deg, rgba(79, 114, 255, 0.95), rgba(124, 167, 255, 0.92));
        }

        .card-back {
          background: linear-gradient(160deg, rgba(255, 185, 134, 0.96), rgba(255, 133, 161, 0.95));
        }

        .card-label {
          text-transform: uppercase;
          letter-spacing: 0.32em;
          font-size: 0.78rem;
          margin-bottom: 12px;
          opacity: 0.85;
        }

        .japanese-text {
          font-size: clamp(3.1rem, 7.8vw, 4.7rem);
          font-weight: 700;
          margin-bottom: 8px;
        }

        .hiragana-text {
          font-size: clamp(1.6rem, 3.3vw, 2.4rem);
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

        .romaji-text.placeholder {
          opacity: 0;
        }

        .korean-text {
          font-size: clamp(3.1rem, 7.8vw, 4.7rem);
          font-weight: 700;
          margin: 10px 0;
        }

        .flip-hint {
          margin-top: 28px;
          font-size: 0.9rem;
          opacity: 0.82;
        }

        .auto-controller {
          display: flex;
          justify-content: center;
          margin-top: 20px;
        }

        .play-btn {
          width: 220px;
          height: 64px;
          border-radius: 999px;
          border: none;
          font-size: 1.2rem;
          font-weight: 700;
          cursor: pointer;
          color: #05060f;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .play-btn.play {
          background: linear-gradient(130deg, #8fd3f4, #84fab0);
          box-shadow: 0 18px 40px rgba(132, 250, 176, 0.35);
        }

        .play-btn.pause {
          background: linear-gradient(130deg, #f6d365, #fda085);
          box-shadow: 0 18px 40px rgba(253, 160, 133, 0.35);
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
          padding: 80px 40px;
          border-radius: 32px;
          background: rgba(10, 16, 34, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 1.2rem;
          text-align: center;
          color: #e9edff;
        }

        @media (max-width: 900px) {
          .flashcard-shell {
            padding: 28px 20px;
          }

          .stats-bar {
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          }

          .level-selector,
          .primary-menu {
            padding: 12px 10px;
          }

          .interaction-zone {
            flex-direction: column;
            padding: 10px 0 30px;
          }

          .card-wrapper.single {
            width: 86vw;
            min-height: min(320px, 55vh);
          }

          .card-nav.prev {
            left: 2%;
          }

          .card-nav.next {
            right: 2%;
          }
        }

        @media (max-width: 600px) {
          .flashcard-page {
            padding: 20px 14px 40px;
          }

          h1 {
            font-size: 2rem;
          }

          .stats-bar {
            grid-template-columns: 1fr;
          }

          .stat-block {
            padding: 14px 16px;
          }

          .slider-block {
            gap: 8px;
          }

          .slider-inline {
            gap: 10px;
          }

          .card-wrapper.single {
            width: 92vw;
            min-height: 260px;
          }

          .card-face-static {
            padding: 32px 24px;
          }

          .play-btn {
            width: 180px;
          }

          .shuffle-btn {
            width: 100%;
            justify-content: center;
          }

          .card-nav {
            width: 50px;
            height: 50px;
            font-size: 1.6rem;
          }
        }
      `}</style>
      <style jsx global>{`
        html,
        body,
        #__next {
          min-height: 100%;
          width: 100%;
          overflow-x: hidden;
        }

        body {
          margin: 0;
          background: #05070f;
          overflow-x: hidden;
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
