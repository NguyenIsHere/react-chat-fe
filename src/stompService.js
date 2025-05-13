// src/stompService.js
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

const WS_BASE_URL = process.env.REACT_APP_WS_BASE_URL || 'http://localhost/ws'

let stompClient = null
let userPhoneNumberForSubscription = null // Lưu SĐT của user để dùng cho subscription

const connectStomp = (
  tokens,
  onConnectedCallback,
  onErrorCallback,
  onPrivateMessageReceived
) => {
  if (stompClient && stompClient.active) {
    console.log('STOMP client already connected.')
    if (onConnectedCallback) onConnectedCallback(stompClient)
    return stompClient
  }

  const socketFactory = () => {
    return new SockJS(WS_BASE_URL) // Endpoint WebSocket của bạn
  }

  stompClient = new Client({
    webSocketFactory: socketFactory,
    connectHeaders: {
      // Gửi access token trong STOMP connect headers để backend có thể xác thực WebSocket session
      // Backend (ví dụ: ChannelInterceptor) cần đọc header này
      Authorization: `Bearer ${tokens?.accessToken}`
    },
    debug: function (str) {
      console.log('STOMP DEBUG: ' + str)
    },
    reconnectDelay: 5000, // Tự động kết nối lại sau 5 giây nếu mất kết nối
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000
  })

  stompClient.onConnect = frame => {
    console.log('Connected to STOMP broker:', frame)
    // Lưu user principal name (phoneNumber) từ frame nếu có, hoặc lấy từ context
    // Frame.headers['user-name'] thường chứa principal name sau khi xác thực
    userPhoneNumberForSubscription = frame.headers['user-name']
    console.log(
      'User Principal for STOMP subscription:',
      userPhoneNumberForSubscription
    )

    if (userPhoneNumberForSubscription) {
      // Subscribe vào kênh tin nhắn riêng tư của user
      // Backend sẽ gửi tin nhắn 1-1 tới /user/{phoneNumber}/queue/private
      // Client subscribe tới /user/queue/private (Spring sẽ tự xử lý prefix /user)
      stompClient.subscribe(
        `/user/queue/private-messages`,
        message => {
          console.log('Private message received:', message.body)
          if (onPrivateMessageReceived) {
            onPrivateMessageReceived(JSON.parse(message.body))
          }
        },
        { id: 'private-sub' }
      ) // Cung cấp ID cho subscription để dễ quản lý
      console.log(
        `Subscribed to /user/queue/private-messages for ${userPhoneNumberForSubscription}`
      )
    } else {
      console.warn(
        'Could not subscribe to private messages: userPhoneNumberForSubscription is null'
      )
    }

    if (onConnectedCallback)
      onConnectedCallback(stompClient, userPhoneNumberForSubscription)
  }

  stompClient.onStompError = frame => {
    console.error('Broker reported error: ' + frame.headers['message'])
    console.error('Additional details: ' + frame.body)
    if (onErrorCallback) onErrorCallback(frame)
  }

  stompClient.onWebSocketError = event => {
    console.error('WebSocket error:', event)
    if (onErrorCallback) onErrorCallback(event)
  }

  stompClient.onDisconnect = () => {
    console.log('Disconnected from STOMP broker')
    // Có thể xử lý logic khi disconnect ở đây
  }

  try {
    stompClient.activate()
  } catch (error) {
    console.error('STOMP activation error:', error)
  }

  return stompClient
}

const disconnectStomp = () => {
  if (stompClient && stompClient.active) {
    stompClient.deactivate()
    console.log('STOMP client deactivated.')
  }
  stompClient = null
  userPhoneNumberForSubscription = null
}

const sendPrivateMessage = (recipientPhoneNumber, content) => {
  if (stompClient && stompClient.active) {
    const payload = {
      recipientPhoneNumber: recipientPhoneNumber,
      content: content
    }
    // Client gửi tin nhắn tới /app/private.sendMessage
    stompClient.publish({
      destination: '/app/private.sendMessage',
      body: JSON.stringify(payload)
    })
    console.log('Sent private message:', payload)
  } else {
    console.error('Cannot send private message: STOMP client not connected.')
  }
}

// Hàm gửi tin nhắn vào Room (ví dụ)
const sendRoomMessage = (roomId, content) => {
  if (stompClient && stompClient.active) {
    const payload = {
      content: content
      // sender sẽ được backend lấy từ Principal
      // roomId đã có trong destination
    }
    // Client gửi tin nhắn tới /app/room.sendMessage/{roomId}
    stompClient.publish({
      destination: `/app/room.sendMessage/${roomId}`,
      body: JSON.stringify(payload)
    })
    console.log(`Sent room message to ${roomId}:`, payload)
  } else {
    console.error('Cannot send room message: STOMP client not connected.')
  }
}

export {
  connectStomp,
  disconnectStomp,
  sendPrivateMessage,
  sendRoomMessage,
  stompClient as getStompClient
}
