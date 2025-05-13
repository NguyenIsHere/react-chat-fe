// src/components/PrivateChatWindow.js
import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback
} from 'react'
import { AuthContext } from '../contexts/AuthContext'
import { sendPrivateMessage } from '../stompService'
import { getPrivateChatHistory } from '../api/userApi'

function PrivateChatWindow ({ selectedUser, onMessageReceived }) {
  const [messageInput, setMessageInput] = useState('')
  const [chatMessages, setChatMessages] = useState([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState(null)
  const { currentUser } = useContext(AuthContext)
  const messagesEndRef = useRef(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (chatMessages.length > 0) {
      scrollToBottom()
    }
  }, [chatMessages, scrollToBottom])

  const normalizeMessage = msg => {
    return {
      id: msg.id, // ID từ MongoDB (nếu là tin nhắn từ lịch sử hoặc đã được server xử lý)
      messageId: msg.messageId, // ID duy nhất của tin nhắn (UUID từ producer)
      tempId: msg.tempId, // ID tạm thời của client cho optimistic update
      sender: msg.sender || msg.senderPhoneNumber,
      recipientPhoneNumber: msg.recipientPhoneNumber,
      content: msg.content,
      timeStamp: msg.timeStamp || msg.timestamp,
      messageType: msg.messageType || 'PRIVATE',
      isOptimistic: !!msg.isOptimistic // Chuyển về boolean
    }
  }

  useEffect(() => {
    if (selectedUser && currentUser?.phoneNumber) {
      setChatMessages([])
      setIsLoadingHistory(true)
      setHistoryError(null)
      getPrivateChatHistory(currentUser.phoneNumber, selectedUser.phoneNumber)
        .then(history => {
          const normalizedHistory = Array.isArray(history)
            ? history.map(normalizeMessage)
            : []
          setChatMessages(normalizedHistory)
        })
        .catch(err => {
          setHistoryError('Could not load chat history.')
          setChatMessages([])
        })
        .finally(() => {
          setIsLoadingHistory(false)
        })
    } else {
      setChatMessages([])
    }
  }, [selectedUser, currentUser])

  useEffect(() => {
    if (onMessageReceived && selectedUser && currentUser?.phoneNumber) {
      const stompMessage = normalizeMessage(onMessageReceived)
      console.log(
        '[STOMP_MSG] PrivateChatWindow received STOMP message:',
        stompMessage
      )

      const {
        sender,
        recipientPhoneNumber: msgRecipient,
        messageId: stompMsgMessageId
      } = stompMessage
      const currentPhoneNumber = currentUser.phoneNumber
      const selectedPhoneNumber = selectedUser.phoneNumber

      const isForThisChat =
        (sender === currentPhoneNumber &&
          msgRecipient === selectedPhoneNumber) ||
        (sender === selectedPhoneNumber && msgRecipient === currentPhoneNumber)

      if (isForThisChat) {
        setChatMessages(prevMessages => {
          // 1. Nếu tin nhắn từ STOMP có messageId, cố gắng tìm và thay thế tin nhắn optimistic
          //    có cùng nội dung và người gửi (hoặc dựa vào tempId nếu có)
          if (stompMsgMessageId && sender === currentPhoneNumber) {
            const optimisticMsgIndex = prevMessages.findIndex(
              pm =>
                pm.isOptimistic &&
                pm.sender === sender &&
                pm.recipientPhoneNumber === msgRecipient && // Thêm điều kiện người nhận cho optimistic
                pm.content === stompMessage.content
              // Không nên so sánh timeStamp quá chặt chẽ ở đây
            )

            if (optimisticMsgIndex !== -1) {
              const updatedMessages = [...prevMessages]
              updatedMessages[optimisticMsgIndex] = {
                ...stompMessage,
                isOptimistic: false
              } // Thay thế bằng tin nhắn server
              console.log(
                '[STOMP_MSG] Replaced optimistic message with server version:',
                updatedMessages[optimisticMsgIndex]
              )
              return updatedMessages
            }
          }

          // 2. Nếu không phải là thay thế optimistic, kiểm tra xem tin nhắn đã tồn tại chưa (dựa trên messageId)
          // Điều này quan trọng để tránh trùng lặp nếu tin nhắn đến từ thiết bị khác của cùng user
          // hoặc nếu STOMP gửi lại vì lý do nào đó.
          const messageAlreadyExists = prevMessages.some(
            pm => pm.messageId && pm.messageId === stompMsgMessageId
          )

          if (!messageAlreadyExists) {
            console.log(
              '[STOMP_MSG] Adding new STOMP message to chatMessages:',
              stompMessage
            )
            return [...prevMessages, { ...stompMessage, isOptimistic: false }]
          } else {
            console.log(
              '[STOMP_MSG] STOMP message with ID',
              stompMsgMessageId,
              'already exists. Not adding again.'
            )
            return prevMessages // Đã tồn tại, không làm gì cả
          }
        })
      } else {
        console.log(
          '[STOMP_MSG] STOMP Message is not for the current private chat window.'
        )
      }
    }
  }, [onMessageReceived, currentUser, selectedUser]) // Bỏ chatMessages khỏi dependency array

  if (!selectedUser) {
    return (
      <div className='chat-window-placeholder'>
        Select a user to start chatting.
      </div>
    )
  }

  const handleSendMessage = e => {
    e.preventDefault()
    if (
      messageInput.trim() &&
      selectedUser?.phoneNumber &&
      currentUser?.phoneNumber
    ) {
      const clientTempId = `optimistic-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`
      const optimisticMessage = normalizeMessage({
        tempId: clientTempId, // ID tạm thời cho client-side để có thể tìm và thay thế
        sender: currentUser.phoneNumber,
        recipientPhoneNumber: selectedUser.phoneNumber,
        content: messageInput,
        timeStamp: new Date().toISOString(),
        messageType: 'PRIVATE',
        isOptimistic: true
      })

      console.log(
        '[OPTIMISTIC_SEND] Adding optimistic message:',
        optimisticMessage
      )
      setChatMessages(prevMessages => [...prevMessages, optimisticMessage])
      sendPrivateMessage(selectedUser.phoneNumber, messageInput)
      setMessageInput('')
    }
  }

  return (
    <div className='chat-window'>
      <h3>
        Chat with {selectedUser.username} ({selectedUser.phoneNumber})
      </h3>
      {isLoadingHistory && <p>Loading history...</p>}
      {historyError && <p style={{ color: 'red' }}>{historyError}</p>}
      <div
        className='messages-area'
        style={
          {
            /* ... styles ... */
          }
        }
      >
        {chatMessages.map(msg => {
          const isSentByCurrentUser =
            msg.sender &&
            currentUser?.phoneNumber &&
            msg.sender === currentUser.phoneNumber
          return (
            <div
              key={msg.id || msg.messageId || msg.tempId} // Ưu tiên id từ DB, rồi messageId, rồi tempId
              className={`message ${isSentByCurrentUser ? 'sent' : 'received'}`}
              style={
                msg.isOptimistic ? { opacity: 0.6, fontStyle: 'italic' } : {}
              }
            >
              <strong>
                {isSentByCurrentUser
                  ? 'You'
                  : selectedUser.phoneNumber === msg.sender
                  ? selectedUser.username
                  : msg.sender}
                :&nbsp; {/* Thêm non-breaking space */}
              </strong>
              {msg.content}
              <span
                style={{ fontSize: '0.7em', marginLeft: '10px', color: 'gray' }}
              >
                {new Date(msg.timeStamp).toLocaleTimeString()}
                {msg.isOptimistic && ' (Sending...)'}
              </span>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSendMessage}>
        {/* ... input và button ... */}
        <input
          type='text'
          value={messageInput}
          onChange={e => setMessageInput(e.target.value)}
          placeholder='Type your message...'
          style={{
            width: 'calc(100% - 85px)',
            marginRight: '5px',
            padding: '8px'
          }}
        />
        <button type='submit' style={{ padding: '8px 15px' }}>
          Send
        </button>
      </form>
    </div>
  )
}

export default PrivateChatWindow
