import { useState, useEffect, useRef } from 'react'

type PlayState = 'idle' | 'playing' | 'looping'

interface SentenceAudioProps {
  audioPath: string | null
}

export default function SentenceAudio({ audioPath }: SentenceAudioProps) {
  const [playState, setPlayState] = useState<PlayState>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    setPlayState('idle')
  }

  const play = () => {
    if (!audioPath) return
    stop()
    const a = new Audio('/' + audioPath)
    a.onended = () => setPlayState('idle')
    a.onerror = () => setPlayState('idle')
    audioRef.current = a
    setPlayState('playing')
    a.play().catch(stop)
  }

  const loop = () => {
    if (!audioPath) return
    if (playState === 'looping') {
      stop()
      return
    }
    stop()
    const a = new Audio('/' + audioPath)
    a.loop = true
    audioRef.current = a
    setPlayState('looping')
    a.play().catch(stop)
  }

  useEffect(() => {
    return () => stop()
  }, [audioPath])

  if (!audioPath) return null

  return (
    <div className="flex gap-1.5">
      <button
        onClick={play}
        disabled={playState === 'playing'}
        title="播放单次"
        className={`px-3 py-1.5 rounded-lg text-[13px] border cursor-pointer transition-all duration-150 ${
          playState === 'playing'
            ? 'bg-blue-500/25 border-blue-500/30 text-blue-400'
            : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:bg-slate-700/40 hover:text-slate-200'
        }`}
      >
        {playState === 'playing' ? '⏸ 播放中' : '🔊 听音'}
      </button>
      <button
        onClick={loop}
        title="循环播放"
        className={`px-3 py-1.5 rounded-lg text-[13px] border cursor-pointer transition-all duration-150 ${
          playState === 'looping'
            ? 'bg-violet-500/25 border-violet-500 text-violet-300'
            : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:bg-slate-700/40 hover:text-slate-200'
        }`}
      >
        {playState === 'looping' ? '⏹ 停止循环' : '🔁 循环'}
      </button>
    </div>
  )
}
