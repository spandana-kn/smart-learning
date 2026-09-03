// Live Mood Widget – premium UI
// --------------------------------------------------------------
import { useEffect, useState } from 'react';
import axios from 'axios';

// HSL colour palette for emotions
const EMOTION_COLORS: Record<string, string> = {
  FOCUSED:    'hsl(160, 90%, 48%)',
  BORED:      'hsl(246, 80%, 74%)',
  SLEEPY:     'hsl(32, 100%, 58%)',
  UNKNOWN:    'hsl(0, 0%, 30%)',
};

function normalizeEmotion(emotion?: string) {
  const value = (emotion ?? '').toUpperCase()
  if (value === 'SLEEPY') return 'SLEEPY'
  if (value === 'BORED' || value === 'DISENGAGED' || value === 'SAD' || value === 'FRUSTRATED' || value === 'ANGRY' || value === 'ANXIOUS' || value === 'CONFUSED' || value === 'SURPRISE' || value === 'FEAR') return 'BORED'
  if (value === 'FOCUSED' || value === 'ENGAGED' || value === 'NEUTRAL') return 'FOCUSED'
  return 'UNKNOWN'
}

export default function LiveMoodWidget() {
  const [mood, setMood] = useState<{ emotion: string; confidence: number }>({
    emotion: 'UNKNOWN',
    confidence: 0,
  });

  // Poll the backend every 5 seconds
  useEffect(() => {
    const fetchMood = async () => {
      try {
        const { data } = await axios.get<{ emotion: string; confidence: number }>(
          '/api/v1/emotions/current'
        );
        setMood(data);
      } catch (e) {
        // Keep previous state on error
      }
    };
    fetchMood();
    const timer = setInterval(fetchMood, 5_000);
    return () => clearInterval(timer);
  }, []);

  const normalizedMood = normalizeEmotion(mood.emotion)
  const bg = EMOTION_COLORS[normalizedMood] ?? EMOTION_COLORS.UNKNOWN;

  return (
    <div
      className="flex items-center gap-2 p-2 rounded-xl shadow-md"
      style={{ background: bg, color: '#fff' }}
    >
      {/* Pulse animation reflects confidence */}
      <div
        className="w-4 h-4 rounded-full"
        style={{
          opacity: 0.6 + 0.4 * mood.confidence,
          animation: 'pulse 2s infinite',
        }}
      />
      <span className="font-medium capitalize">{normalizedMood}</span>
      <span className="text-xs opacity-80">
        {(mood.confidence * 100).toFixed(0)}%
      </span>
      <style>{`
        @keyframes pulse {
          0% { transform: scale(0.9); }
          50% { transform: scale(1.1); }
          100% { transform: scale(0.9); }
        }
      `}</style>
    </div>
  );
}
