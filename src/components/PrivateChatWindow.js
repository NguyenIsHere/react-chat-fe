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

  // Function để chuẩn hóa message object (nếu cần)
  const normalizeMessage = msg => {
    return {
      id: msg.id, // từ server
      tempId: msg.tempId, // từ optimistic update
      sender: msg.sender || msg.senderPhoneNumber, // Ưu tiên 'sender', fallback về 'senderPhoneNumber'
      recipientPhoneNumber: msg.recipientPhoneNumber,
      content: msg.content,
      timeStamp: msg.timeStamp || msg.timestamp, // Ưu tiên 'timeStamp', fallback về 'timestamp'
      messageType: msg.messageType || 'PRIVATE',
      isOptimistic: msg.isOptimistic
    }
  }

  useEffect(() => {
    if (selectedUser && currentUser?.phoneNumber) {
      setChatMessages([])
      setIsLoadingHistory(true)
      setHistoryError(null)
      console.log(
        `[HISTORY] Fetching for user1: '${currentUser.phoneNumber}' and user2: '${selectedUser.phoneNumber}'`
      )
      getPrivateChatHistory(currentUser.phoneNumber, selectedUser.phoneNumber)
        .then(history => {
          const normalizedHistory = Array.isArray(history)
            ? history.map(normalizeMessage)
            : []
          console.log('[HISTORY] Fetched and normalized:', normalizedHistory)
          setChatMessages(normalizedHistory)
        })
        .catch(err => {
          console.error('[HISTORY] Failed to load:', err)
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
      const normalizedStompMessage = normalizeMessage(onMessageReceived)
      console.log(
        '[STOMP_MSG] PrivateChatWindow received new STOMP message via prop (normalized):',
        normalizedStompMessage
      )

      const { sender, recipientPhoneNumber: msgRecipient } =
        normalizedStompMessage
      const currentPhoneNumber = currentUser.phoneNumber
      const selectedPhoneNumber = selectedUser.phoneNumber

      const isForThisChat =
        (sender === currentPhoneNumber &&
          msgRecipient === selectedPhoneNumber) ||
        (sender === selectedPhoneNumber && msgRecipient === currentPhoneNumber)

      if (isForThisChat) {
        setChatMessages(prevMessages => {
          const messageExists = prevMessages.some(
            existingMsg =>
              (existingMsg.id &&
                existingMsg.id === normalizedStompMessage.id) || // Từ server có ID
              (existingMsg.tempId &&
                existingMsg.tempId === normalizedStompMessage.tempId) || // Optimistic có tempId
              (existingMsg.sender === sender &&
                existingMsg.content === normalizedStompMessage.content &&
                Math.abs(
                  new Date(existingMsg.timeStamp).getTime() -
                    new Date(normalizedStompMessage.timeStamp).getTime()
                ) < 3000) // Fallback
          )
          if (!messageExists) {
            console.log(
              '[STOMP_MSG] Adding STOMP message to chatMessages:',
              normalizedStompMessage
            )
            return [...prevMessages, normalizedStompMessage]
          } else {
            console.log(
              '[STOMP_MSG] STOMP message likely already present:',
              normalizedStompMessage
            )
            return prevMessages
          }
        })
      } else {
        console.log(
          '[STOMP_MSG] STOMP Message is not for the current private chat window.',
          {
            msgDetails: normalizedStompMessage,
            currentUserPhone: currentPhoneNumber,
            selectedUserPhone: selectedPhoneNumber
          }
        )
      }
    }
  }, [onMessageReceived, currentUser, selectedUser]) // Bỏ chatMessages khỏi dependency của STOMP listener để tránh vòng lặp vô hạn nếu có lỗi logic

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
      const optimisticMessage = normalizeMessage({
        // Sử dụng normalizeMessage
        tempId: `optimistic-${Date.now()}`, // Tạo một ID tạm thời cho client-side key
        sender: currentUser.phoneNumber,
        recipientPhoneNumber: selectedUser.phoneNumber,
        content: messageInput,
        timeStamp: new Date().toISOString(),
        messageType: 'PRIVATE',
        isOptimistic: true
      })

      setChatMessages(prevMessages => [...prevMessages, optimisticMessage])
      sendPrivateMessage(selectedUser.phoneNumber, messageInput)
      setMessageInput('')
    }
  }

  // Log giá trị ngay trước khi render để debug
  // console.log("[RENDER] CurrentUser Phone:", currentUser?.phoneNumber);
  // console.log("[RENDER] SelectedUser:", selectedUser);
  // console.log("[RENDER] ChatMessages:", chatMessages);

  return (
    <div className='chat-window'>
      <h3>
        Chat with {selectedUser.username} ({selectedUser.phoneNumber})
      </h3>
      {isLoadingHistory && <p>Loading history...</p>}
      {historyError && <p style={{ color: 'red' }}>{historyError}</p>}
      <div
        className='messages-area'
        style={{
          height: '300px',
          overflowY: 'auto',
          border: '1px solid #ccc',
          padding: '10px',
          marginBottom: '10px',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {chatMessages.map(msg => {
          // Đảm bảo msg.sender và currentUser.phoneNumber có giá trị trước khi so sánh
          const isSentByCurrentUser =
            msg.sender &&
            currentUser?.phoneNumber &&
            msg.sender === currentUser.phoneNumber
          return (
            <div
              key={msg.id || msg.tempId} // Sử dụng ID tin nhắn hoặc ID tạm thời làm key
              className={`message ${isSentByCurrentUser ? 'sent' : 'received'}`}
              style={msg.isOptimistic ? { opacity: 0.7 } : {}}
            >
              <strong>
                {isSentByCurrentUser
                  ? 'You'
                  : selectedUser.phoneNumber === msg.sender
                  ? selectedUser.username
                  : msg.sender}
                : {/* Khoảng trắng */}
              </strong>
              {msg.content}
              <span
                style={{ fontSize: '0.7em', marginLeft: '10px', color: 'gray' }}
              >
                {new Date(msg.timeStamp).toLocaleTimeString()}
                {msg.isOptimistic && ' (Sent)'}
              </span>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSendMessage}>
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
