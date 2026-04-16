import { useEffect, useRef, useState } from 'react'
import { useAudioRecorder } from '../hooks/useAudioRecorder'

function formatDuration(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function AudioRecorder({ onBlob, disabled, autoStart = false }) {
  const { isRecording, error, duration, start, stop } = useAudioRecorder()

  // État de révision
  const [reviewBlob, setReviewBlob] = useState(null)
  const [reviewUrl, setReviewUrl] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playProgress, setPlayProgress] = useState(0)
  const [playDuration, setPlayDuration] = useState(0)
  const audioRef = useRef(null)

  useEffect(() => {
    if (autoStart && !disabled) start()
  }, [autoStart]) // eslint-disable-line react-hooks/exhaustive-deps

  // Nettoyage de l'URL objet à la destruction
  useEffect(() => {
    return () => { if (reviewUrl) URL.revokeObjectURL(reviewUrl) }
  }, [reviewUrl])

  async function handleStop() {
    const blob = await stop()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    setReviewBlob(blob)
    setReviewUrl(url)
    setPlayProgress(0)
    setIsPlaying(false)
  }

  function handleTogglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
  }

  function handleSend() {
    onBlob(reviewBlob)
    resetReview()
  }

  function handleReRecord() {
    resetReview()
    start()
  }

  function resetReview() {
    if (reviewUrl) URL.revokeObjectURL(reviewUrl)
    setReviewBlob(null)
    setReviewUrl(null)
    setIsPlaying(false)
    setPlayProgress(0)
    setPlayDuration(0)
  }

  // ── État révision ────────────────────────────────────────────────────────────
  if (reviewBlob) {
    const progressPct = playDuration > 0 ? (playProgress / playDuration) * 100 : 0

    return (
      <div className="w-full space-y-5">
        <div className="text-center space-y-1">
          <p className="text-slate-500 text-sm font-semibold uppercase tracking-widest">Écoute avant d'envoyer</p>
          <p className="text-slate-400 text-xs font-medium">{formatDuration(Math.round(playDuration || duration))}</p>
        </div>

        {/* Lecteur audio */}
        <audio
          ref={audioRef}
          src={reviewUrl}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => { setIsPlaying(false); setPlayProgress(0) }}
          onTimeUpdate={(e) => setPlayProgress(e.target.currentTime)}
          onLoadedMetadata={(e) => setPlayDuration(e.target.duration)}
        />

        {/* Barre de progression */}
        <div
          className="w-full h-2 bg-slate-100 rounded-full overflow-hidden cursor-pointer"
          onClick={(e) => {
            const audio = audioRef.current
            if (!audio || !playDuration) return
            const rect = e.currentTarget.getBoundingClientRect()
            audio.currentTime = ((e.clientX - rect.left) / rect.width) * playDuration
          }}
        >
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-100"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Bouton play/pause centré */}
        <div className="flex justify-center">
          <button
            onClick={handleTogglePlay}
            className="w-16 h-16 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-2xl transition-all shadow-sm"
          >
            {isPlaying ? '⏸' : '▶️'}
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleReRecord}
            className="flex-1 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm border border-slate-200 transition-all"
          >
            🔄 Réenregistrer
          </button>
          <button
            onClick={handleSend}
            className="flex-1 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm transition-all"
          >
            Envoyer ✓
          </button>
        </div>
      </div>
    )
  }

  // ── État enregistrement / idle ───────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-10">
      <div className="relative flex items-center justify-center">
        {isRecording && (
          <>
            <span className="ring-record-1 absolute inset-0 rounded-full bg-rose-400/30" />
            <span className="ring-record-2 absolute inset-0 rounded-full bg-rose-400/20" />
            <span className="ring-record-3 absolute inset-0 rounded-full bg-rose-300/15" />
          </>
        )}

        <button
          onClick={isRecording ? handleStop : start}
          disabled={disabled}
          className={`
            relative w-44 h-44 rounded-full font-bold text-white
            transition-all duration-300 disabled:opacity-40
            focus:outline-none select-none shadow-lg
            ${isRecording
              ? 'bg-rose-500 hover:bg-rose-600 scale-105 shadow-rose-300'
              : 'bg-blue-600 hover:bg-blue-700 hover:scale-105 shadow-blue-200'}
          `}
        >
          <span className="text-6xl">{isRecording ? '⏹' : '🎤'}</span>
        </button>
      </div>

      {isRecording ? (
        <div className="flex flex-col items-center gap-1">
          <span className="text-rose-500 font-mono text-4xl font-extrabold tabular-nums">
            {formatDuration(duration)}
          </span>
          <span className="text-rose-400 text-xs font-semibold uppercase tracking-widest animate-pulse">
            Enregistrement…
          </span>
        </div>
      ) : (
        <p className="text-slate-400 text-center text-sm font-medium">
          Appuie pour commencer à enregistrer
        </p>
      )}

      {error && (
        <p className="text-rose-600 text-center text-sm bg-rose-50 border border-rose-200 rounded-xl px-4 py-2">{error}</p>
      )}
    </div>
  )
}
