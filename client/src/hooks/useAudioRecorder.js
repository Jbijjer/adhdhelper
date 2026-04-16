import { useState, useRef, useCallback } from 'react'

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState(null)
  const [duration, setDuration] = useState(0)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  const start = useCallback(async () => {
    setError(null)
    setDuration(0)
    chunksRef.current = []

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('Accès au microphone refusé. Veuillez autoriser l\'accès dans les réglages du navigateur.')
      return
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'

    const recorder = new MediaRecorder(stream, { mimeType })
    mediaRecorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.start(250) // collect chunks every 250ms
    setIsRecording(true)

    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
  }, [])

  const stop = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current
      if (!recorder) return resolve(null)

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
        // Stop all tracks to release the microphone
        recorder.stream.getTracks().forEach((t) => t.stop())
        resolve(blob)
      }

      recorder.stop()
      setIsRecording(false)
      clearInterval(timerRef.current)
    })
  }, [])

  return { isRecording, error, duration, start, stop }
}
