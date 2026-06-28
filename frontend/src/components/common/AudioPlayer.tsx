import { useState, useRef, useEffect, useCallback } from 'react'

// ─── Types ──────────────────────────────────────────────────────────────────

type PlayState = 'idle' | 'playing' | 'looping'

// ─── AudioControls ──────────────────────────────────────────────────────────
// Full-featured audio control with play-once and loop modes.
// Used in FillBlankExercise and ReviewExercise for per-line audio.

interface AudioControlsProps {
  audioPath: string | null
  lineIdx: number
}

export function AudioControls({ audioPath, lineIdx }: AudioControlsProps) {
  const [playState, setPlayState] = useState<PlayState>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    setPlayState('idle')
  }, [])

  const handlePlay = useCallback(() => {
    if (!audioPath) return
    stop()
    const a = new Audio('/' + audioPath)
    a.loop = false
    a.onended = () => setPlayState('idle')
    a.onerror = () => setPlayState('idle')
    audioRef.current = a
    setPlayState('playing')
    a.play().catch(stop)
  }, [audioPath, stop])

  const handleLoop = useCallback(() => {
    if (!audioPath) return
    if (playState === 'looping') { stop(); return }
    stop()
    const a = new Audio('/' + audioPath)
    a.loop = true
    a.onended = () => setPlayState('idle')
    a.onerror = () => setPlayState('idle')
    audioRef.current = a
    setPlayState('looping')
    a.play().catch(stop)
  }, [audioPath, playState, stop])

  // Cleanup on unmount
  useEffect(() => () => { stop() }, [stop])

  const disabled = !audioPath

  return (
    <div className="flex gap-1">
      <button
        id={`btn-play-audio-${lineIdx}`}
        onClick={handlePlay}
        disabled={disabled || playState === 'playing'}
        title="播放一次"
        className={`px-2 py-1 rounded-md text-sm border transition-all duration-150 ${
          playState === 'playing'
            ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
            : disabled
            ? 'bg-slate-800/60 text-slate-600 border-slate-700/50 cursor-not-allowed'
            : 'bg-slate-800/60 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:text-slate-200 cursor-pointer'
        }`}
      >
        {playState === 'playing' ? '⏸' : '🔊'}
      </button>
      <button
        id={`btn-loop-audio-${lineIdx}`}
        onClick={handleLoop}
        disabled={disabled}
        title="循环播放"
        className={`px-2 py-1 rounded-md text-sm border transition-all duration-150 ${
          playState === 'looping'
            ? 'bg-violet-500/25 text-violet-300 border-violet-500 ring-2 ring-violet-500/40'
            : disabled
            ? 'bg-slate-800/60 text-slate-600 border-slate-700/50 cursor-not-allowed'
            : 'bg-slate-800/60 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:text-slate-200 cursor-pointer'
        }`}
      >
        {playState === 'looping' ? '⏹' : '🔁'}
      </button>
    </div>
  )
}

// ─── ListPlayButton ──────────────────────────────────────────────────────────
// Compact single-button play control used in schedule/list views.

interface ListPlayButtonProps {
  audioPath: string
}

export function ListPlayButton({ audioPath }: ListPlayButtonProps) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const play = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    const a = new Audio('/' + audioPath)
    a.onended = () => setPlaying(false)
    a.onerror = () => setPlaying(false)
    audioRef.current = a
    setPlaying(true)
    a.play().catch((err) => {
      console.error(err)
      setPlaying(false)
    })
  }

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    setPlaying(false)
  }

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [])

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        if (playing) { stop() } else { play() }
      }}
      title={playing ? '停止' : '播放语音'}
      className={`bg-transparent border-0 cursor-pointer text-xl p-1 rounded-md flex items-center justify-center transition-all duration-150 hover:scale-115 ${
        playing ? 'text-violet-400 hover:text-violet-300' : 'text-slate-400 hover:text-violet-400'
      }`}
    >
      {playing ? '⏸' : '🔊'}
    </button>
  )
}
