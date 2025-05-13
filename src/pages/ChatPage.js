// src/pages/ChatPage.js
import React, { useContext, useEffect, useState, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { AuthContext } from '../contexts/AuthContext'
import UserList from '../components/UserList'
import PrivateChatWindow from '../components/PrivateChatWindow'
import { connectStomp, disconnectStomp, getStompClient } from '../stompService' // getStompClient ở đây là biến, không phải hàm
import { logoutUserApi } from '../api/authApi'

function ChatPage () {
  const { currentUser, tokens, logout } = useContext(AuthContext)
  const [selectedUser, setSelectedUser] = useState(null)
  const [stompClientInstance, setStompClientInstance] = useState(getStompClient)
  const [lastPrivateMessage, setLastPrivateMessage] = useState(null) // Để truyền xuống ChatWindow

  const handlePrivateMessageReceived = useCallback(message => {
    console.log('ChatPage received private message:', message)
    // Cập nhật state để PrivateChatWindow có thể re-render
    // Chúng ta sẽ truyền message này xuống PrivateChatWindow để nó tự quản lý state chatMessages
    setLastPrivateMessage(message)
  }, [])

  useEffect(() => {
    if (currentUser && tokens?.accessToken && !stompClientInstance) {
      // Chỉ kết nối nếu chưa có instance
      const client = connectStomp(
        tokens,
        connectedClient => {
          setStompClientInstance(connectedClient) // Lưu client đã kết nối vào state
          console.log('STOMP Connected in ChatPage')
        },
        error => {
          console.error('STOMP Connection Error in ChatPage:', error)
        },
        handlePrivateMessageReceived
      )
      // không cần setStompClientInstance(client) ở đây nữa vì onConnectedCallback sẽ làm
    }

    // Cleanup function
    return () => {
      // Khi component unmount, kiểm tra xem có client instance nào đang active không
      // getStompClient ở đây là biến chứa stompClient instance từ stompService.js
      const currentGlobalClient = getStompClient // Lấy client từ module stompService

      if (currentGlobalClient && currentGlobalClient.active) {
        console.log(
          'ChatPage unmounting, global STOMP client is active, deactivating...'
        )
        // Không nên gọi disconnectStomp() trực tiếp ở đây nếu muốn giữ kết nối cho các trang khác
        // Tuy nhiên, nếu ChatPage là nơi duy nhất quản lý kết nối này thì có thể disconnect.
        // Hoặc, chỉ disconnect nếu stompClientInstance (client của trang này) tồn tại
        // disconnectStomp(); // Cân nhắc việc này
      } else if (stompClientInstance && stompClientInstance.active) {
        console.log(
          'ChatPage unmounting, local STOMP client instance is active, deactivating...'
        )
        disconnectStomp() // Chỉ ngắt kết nối client do trang này tạo ra
        setStompClientInstance(null)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, tokens, handlePrivateMessageReceived, , stompClientInstance]) // Chỉ chạy lại khi currentUser hoặc tokens thay đổi

  if (!currentUser) {
    return <Navigate to='/login' />
  }

  const handleLogout = async () => {
    try {
      if (stompClientInstance) {
        disconnectStomp() // Ngắt kết nối stomp trước
      }
      await logoutUserApi() // Gọi API logout của backend
    } catch (error) {
      console.error('Error during API logout:', error)
      // Vẫn tiếp tục logout ở client dù API có lỗi
    } finally {
      logout() // Xóa token và user ở client
    }
  }

  return (
    <div className='chat-page-container' style={{ display: 'flex' }}>
      <div
        className='sidebar'
        style={{ width: '30%', borderRight: '1px solid #ccc', padding: '10px' }}
      >
        <h2>Welcome, {currentUser.username || currentUser.phoneNumber}!</h2>
        <button onClick={handleLogout}>Logout</button>
        <UserList onSelectUser={setSelectedUser} />
      </div>
      <div className='main-chat-area' style={{ width: '70%', padding: '10px' }}>
        {selectedUser ? (
          <PrivateChatWindow
            selectedUser={selectedUser}
            onMessageReceived={lastPrivateMessage} // Truyền tin nhắn mới nhất xuống
          />
        ) : (
          <p>Select a user from the list to start a private chat.</p>
        )}
        {/* TODO: Thêm phần chat room nếu cần */}
      </div>
    </div>
  )
}

export default ChatPage
