const axios = require('axios')
const FormData = require('form-data')
const fs = require('fs')
const { getSetting } = require('../database')

/**
 * Transcribes an audio file using the Faster-Whisper container.
 * @param {string} filePath - Absolute path to the audio file
 * @returns {Promise<string>} Transcribed text
 */
async function transcribeAudio(filePath) {
  const url = getSetting('whisper_url')

  const form = new FormData()
  form.append('file', fs.createReadStream(filePath))
  form.append('model', 'Systran/faster-whisper-medium')
  form.append('language', 'fr')
  form.append('response_format', 'json')

  const response = await axios.post(`${url}/v1/audio/transcriptions`, form, {
    headers: form.getHeaders(),
    timeout: 120_000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  })

  const text = response.data?.text
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Transcription vide ou malformée reçue de Faster-Whisper')
  }

  return text.trim()
}

module.exports = { transcribeAudio }
