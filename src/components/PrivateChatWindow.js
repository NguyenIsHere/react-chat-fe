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
    // Đảm bảo messageId luôn có mặt nếu là tin từ server hoặc optimistic đã có messageId được gán
    // tempId là của client-side optimistic
    return {
      id: msg.id,
      messageId: msg.messageId, // Rất quan trọng cho việc khớp tin nhắn
      tempId: msg.tempId,
      sender: msg.sender || msg.senderPhoneNumber,
      recipientPhoneNumber: msg.recipientPhoneNumber,
      content: msg.content,
      timeStamp: msg.timeStamp || msg.timestamp,
      messageType: msg.messageType || 'PRIVATE',
      isOptimistic: !!msg.isOptimistic
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
        .finally(() => setIsLoadingHistory(false))
    } else {
      setChatMessages([])
    }
  }, [selectedUser, currentUser])

  useEffect(() => {
    if (onMessageReceived && selectedUser && currentUser?.phoneNumber) {
      const stompMessage = normalizeMessage(onMessageReceived)
      console.log('[STOMP_MSG] Received in PrivateChatWindow:', stompMessage)

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
          // Tìm xem có tin nhắn optimistic nào cần được thay thế không
          // Tin nhắn optimistic sẽ có isOptimistic: true và cùng content, sender, recipient
          // Hoặc tốt hơn, nếu tin nhắn optimistic có tempId và server gửi lại messageId tương ứng với tempId đó
          // (điều này đòi hỏi backend phải biết về tempId, hiện tại chúng ta không làm vậy)
          // Hiện tại, chúng ta sẽ dựa vào messageId mà backend gửi về.
          // Nếu tin nhắn từ STOMP có messageId và là của currentUser gửi đi,
          // chúng ta sẽ cố gắng tìm và thay thế một tin nhắn optimistic.

          let isReplaced = false
          const updatedMessages = prevMessages.map(pm => {
            // Nếu tin nhắn từ STOMP là của currentUser gửi đi VÀ nó có messageId
            // VÀ tin nhắn pm trong state là optimistic VÀ có cùng nội dung
            // (Cách so sánh content này không hoàn hảo, nhưng là một heuristic)
            if (
              sender === currentPhoneNumber &&
              stompMsgMessageId &&
              pm.isOptimistic &&
              pm.sender === sender &&
              pm.recipientPhoneNumber === msgRecipient &&
              pm.content === stompMessage.content
            ) {
              console.log(
                '[STOMP_MSG] Replacing optimistic message with server version (ID: ' +
                  stompMsgMessageId +
                  ')'
              )
              isReplaced = true
              return { ...stompMessage, isOptimistic: false } // Thay thế
            }
            // Nếu tin nhắn từ STOMP có messageId và đã tồn tại trong state (cũng có messageId)
            if (
              stompMsgMessageId &&
              pm.messageId &&
              pm.messageId === stompMsgMessageId
            ) {
              console.log(
                '[STOMP_MSG] Message with ID ' +
                  stompMsgMessageId +
                  ' already exists. Updating if necessary.'
              )
              isReplaced = true // Coi như đã được xử lý/thay thế
              return { ...stompMessage, isOptimistic: false } // Cập nhật bằng bản từ server
            }
            return pm
          })

          if (!isReplaced) {
            // Nếu không có gì được thay thế, và tin nhắn này chưa tồn tại (dựa trên messageId)
            // thì thêm nó vào.
            const alreadyExistsById =
              stompMsgMessageId &&
              prevMessages.some(pm => pm.messageId === stompMsgMessageId)
            if (!alreadyExistsById) {
              console.log('[STOMP_MSG] Adding new STOMP message:', stompMessage)
              return [
                ...updatedMessages,
                { ...stompMessage, isOptimistic: false }
              ]
            }
          }
          return updatedMessages // Trả về danh sách đã được cập nhật hoặc không thay đổi
        })
      }
    }
  }, [onMessageReceived, currentUser, selectedUser]) // Bỏ chatMessages khỏi dependencies

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
      // Backend sẽ tạo messageId (UUID). Frontend không cần tạo messageId ở đây nữa.
      // tempId vẫn hữu ích cho việc tìm và thay thế optimistic message.
      const clientTempId = `optimistic-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`

      const optimisticMessage = normalizeMessage({
        tempId: clientTempId,
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

      // Gửi tin nhắn lên backend (backend sẽ tạo messageId thật)
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
          // Điều kiện để xác định tin nhắn là của người dùng hiện tại
          const isSentByCurrentUser =
            msg.sender &&
            currentUser?.phoneNumber &&
            msg.sender === currentUser.phoneNumber
          console.log(
            `[RENDER_MSG] Content: "${msg.content}", Sender: ${msg.sender}, CurrentUser: ${currentUser?.phoneNumber}, isSent: ${isSentByCurrentUser}`
          )
          return (
            <div
              key={msg.id || msg.messageId || msg.tempId} // Key ưu tiên
              className={`message ${isSentByCurrentUser ? 'sent' : 'received'}`}
              style={
                msg.isOptimistic ? { opacity: 0.6, fontStyle: 'italic' } : {}
              }
            >
              <strong>
                {isSentByCurrentUser
                  ? 'You'
                  : // Nếu là tin nhắn nhận được, hiển thị username của người đang chat cùng (selectedUser)
                  // Hoặc nếu vì lý do nào đó sender không phải selectedUser, thì hiển thị sender (SĐT)
                  selectedUser.phoneNumber === msg.sender
                  ? selectedUser.username
                  : `User(${msg.sender.slice(-4)})`}
                :&nbsp;
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
