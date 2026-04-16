const axios = require('axios')
const { getSetting } = require('../database')
const { buildStructuringPrompt } = require('../prompts/structurer')

/**
 * Strips markdown code fences that some LLMs add despite being told not to.
 */
function sanitizeJson(raw) {
  return raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

/**
 * Sends the raw brain dump text to LiteLLM and returns structured tasks.
 * @param {string} rawText
 * @returns {Promise<Array>} Array of task objects from the LLM
 */
async function structureTasks(rawText) {
  const url = getSetting('litellm_url')
  const model = getSetting('litellm_model')
  const apiKey = getSetting('litellm_api_key')

  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  const response = await axios.post(
    `${url}/v1/chat/completions`,
    {
      model,
      messages: [
        {
          role: 'user',
          content: buildStructuringPrompt(rawText),
        },
      ],
      temperature: 0.3,
    },
    { timeout: 90_000, headers }
  )

  const content = response.data?.choices?.[0]?.message?.content
  if (!content) throw new Error('Réponse LLM vide ou malformée')

  const sanitized = sanitizeJson(content)

  let parsed
  try {
    parsed = JSON.parse(sanitized)
  } catch {
    throw new Error(`JSON invalide reçu du LLM : ${sanitized.slice(0, 200)}`)
  }

  if (!Array.isArray(parsed.tasks)) {
    throw new Error('Le LLM n\'a pas retourné un tableau "tasks"')
  }

  return parsed.tasks
}

/**
 * Generates a short motivational push notification message for a task.
 * @param {string} taskTitle
 * @param {'daily'|'followup'} type
 * @returns {Promise<{title: string, body: string}>}
 */
async function generateNotificationMessage(taskTitle, type) {
  const url = getSetting('litellm_url')
  const model = getSetting('litellm_model')
  const apiKey = getSetting('litellm_api_key')

  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  const prompt = type === 'daily'
    ? `Tu es un assistant bienveillant qui envoie un court message d'encouragement à une personne avec un TDAH.

La tâche du jour : "${taskTitle}"

Écris 1-2 phrases qui :
- Encouragent à commencer cette tâche spécifique, de façon concrète
- Sont chaleureuses et sincères, sans être creuses
- Parlent en français québécois naturel
- Donnent le goût de s'y mettre, sans pression excessive

À ÉVITER :
- Les blagues ou le sarcasme
- Les formules toutes faites ("Tu es capable !", "C'est le bon moment !")
- Commencer par "Hey" ou "Salut"

EXEMPLES :
- "Appeler le dentiste ça prend juste quelques minutes, pis après ça c'est réglé pour de bon."
- "Ta future version va vraiment apprécier que tu t'en occupes aujourd'hui."

Réponds UNIQUEMENT avec le texte du message, rien d'autre.`
    : `Tu es un assistant bienveillant qui envoie un doux rappel à une personne avec un TDAH pour une tâche non complétée.

La tâche : "${taskTitle}"

Écris 1-2 phrases qui :
- Rappellent gentiment sans culpabiliser
- Sont compréhensives et encourageantes
- Parlent en français québécois naturel

À ÉVITER :
- Les blagues ou le sarcasme
- La culpabilisation
- "N'oublie pas de...", "Il est encore temps de..."

EXEMPLES :
- "Cette tâche t'attend encore, rien d'urgent mais ça ferait du bien de s'en occuper."
- "Juste 10 minutes là-dessus aujourd'hui, c'est tout ce qu'il faut pour avancer."

Réponds UNIQUEMENT avec le texte du message, rien d'autre.`

  try {
    const response = await axios.post(
      `${url}/v1/chat/completions`,
      {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 1000,
      },
      { timeout: 30_000, headers }
    )

    const raw = response.data?.choices?.[0]?.message?.content || ''
    // Strip thinking blocks that some models (gemma4, qwen3) emit
    const body = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    if (!body) throw new Error('Réponse vide')

    const title = taskTitle
    return { title, body }
  } catch (err) {
    console.warn('[notification] Génération IA échouée, fallback statique:', err.message)
    return {
      title: taskTitle,
      body: type === 'daily' ? 'Ta tâche du jour 🎯' : 'Rappel — tâche en attente ⏰',
    }
  }
}

module.exports = { structureTasks, generateNotificationMessage }
