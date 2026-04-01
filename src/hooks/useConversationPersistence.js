import { useCallback } from 'react'
import { API_URL } from '../app/constants'

export function useConversationPersistence({ student, activeLab }) {
  const saveConversation = useCallback(async (messages, labIdOverride = null) => {
    const labId = labIdOverride ?? activeLab?.id
    if (!student || !labId) return
    try {
      await fetch(`${API_URL}/save-conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uin: student.uin,
          lab_id: labId,
          messages: messages.map(m => ({
            role: m.role === 'ai' ? 'assistant' : 'user',
            content: m.text,
          })),
        }),
      })
    } catch {}
  }, [student, activeLab?.id])

  return { saveConversation }
}
