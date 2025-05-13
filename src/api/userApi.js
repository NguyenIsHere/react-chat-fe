// src/api/userApi.js
import axios from 'axios'

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || 'http://localhost/api/v1'

const apiClient = axios.create({
  baseURL: API_BASE_URL
})

// Interceptor để thêm token vào header nếu có (quan trọng cho các API cần xác thực)
apiClient.interceptors.request.use(
  config => {
    const tokens = localStorage.getItem('authTokens')
    if (tokens) {
      const { accessToken } = JSON.parse(tokens)
      if (accessToken) {
        config.headers['Authorization'] = `Bearer ${accessToken}`
      }
    }
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

export const searchUsers = async usernameQuery => {
  try {
    const response = await apiClient.get(
      `/users/search?usernameQuery=${usernameQuery}`
    )
    return response.data // [{ id, phoneNumber, username, online }]
  } catch (error) {
    console.error('Search users API error:', error.response || error)
    throw error
  }
}

export const getOnlineUsers = async () => {
  try {
    const response = await apiClient.get('/users/online')
    return response.data
  } catch (error) {
    console.error('Get online users API error:', error.response || error)
    throw error
  }
}

export const getPrivateChatHistory = async (
  user1PhoneNumber,
  user2PhoneNumber,
  page = 0,
  size = 50
) => {
  try {
    // API endpoint này cần được bảo vệ, yêu cầu user đã login
    // SỬA LẠI URL Ở ĐÂY:
    const apiUrlPath = `/chat-history/private/${user1PhoneNumber}/${user2PhoneNumber}`
    console.log('Requesting chat history from URL path:', apiUrlPath) // Log để kiểm tra

    const response = await apiClient.get(
      apiUrlPath, // Sử dụng template string đã được nội suy đúng cách
      {
        params: { page, size }
      }
    )
    return response.data // Mong đợi một mảng các tin nhắn [{id, senderPhoneNumber, ...}]
  } catch (error) {
    console.error(
      'Get private chat history API error:',
      error.response || error.message // Log cả error.message nếu không có error.response
    )
    throw error
  }
}
