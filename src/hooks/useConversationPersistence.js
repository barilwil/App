import { useCallback } from 'react'
import { API_URL } from '../app/constants'

export function useConversationPersistence({ student, activeLab, websiteChatSync = null }) {
  const saveConversation = useCallback(async (messages, labIdOverride = null) => {
    const labId = labIdOverride ?? activeLab?.id
    if (!student || !labId) return

    const normalizedMessages = messages.map((m) => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.text,
    }))

    try {
      await fetch(`${API_URL}/save-conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uin: student.uin,
          lab_id: labId,
          messages: normalizedMessages,
        }),
      })
    } catch {}

    if (!websiteChatSync?.chatId) return

    try {
      await fetch(`${API_URL}/website-chats/${encodeURIComponent(websiteChatSync.chatId)}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_uin: String(student.uin),
          student_name: student.name || null,
          course_name: websiteChatSync.courseName || null,
          course_code: websiteChatSync.courseCode || null,
          lab_name: websiteChatSync.labName || null,
          lab_number: websiteChatSync.labNumber ?? null,
          title: websiteChatSync.title || null,
          messages: normalizedMessages,
        }),
      })
    } catch {}
  }, [student, activeLab?.id, websiteChatSync?.chatId, websiteChatSync?.courseName, websiteChatSync?.courseCode, websiteChatSync?.labName, websiteChatSync?.labNumber, websiteChatSync?.title])

  return { saveConversation }
}
