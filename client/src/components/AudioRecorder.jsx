import { useAudioRecorder } from '../hooks/useAudioRecorder'

function formatDuration(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function AudioRecorder({ onBlob, disabled }) {
  const { isRecording, error, duration, start, stop } = useAudioRecorder()

  async function handleToggle() {
    if (isRecording) {
      const blob = await stop()
      if (blob) onBlob(blob)
    } else {
      await start()
    }
  }

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
          onClick={handleToggle}
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
