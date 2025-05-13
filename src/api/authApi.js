import axios from 'axios'

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || 'http://localhost:8088/api/v1'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // Thêm dòng này để hỗ trợ gửi credentials
})

// Interceptor để thêm token vào header nếu có
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

export const loginUser = async phoneNumber => {
  try {
    const response = await apiClient.post('/auth/login', { phoneNumber })
    return response.data // { accessToken, refreshToken, message }
  } catch (error) {
    console.error('Login API error:', error.response || error)
    throw error
  }
}

export const registerUser = async (phoneNumber, username) => {
  try {
    const response = await apiClient.post('/auth/register', {
      phoneNumber,
      username
    })
    return response.data
  } catch (error) {
    console.error('Register API error:', error.response || error)
    throw error
  }
}

export const refreshToken = async currentRefreshToken => {
  try {
    const response = await apiClient.post('/auth/refresh', {
      refreshToken: currentRefreshToken
    })
    return response.data // { accessToken, refreshToken, message }
  } catch (error) {
    console.error('Refresh token API error:', error.response || error)
    throw error
  }
}

export const logoutUserApi = async () => {
  try {
    const response = await apiClient.post('/auth/logout')
    return response.data
  } catch (error) {
    console.error('Logout API error:', error.response || error)
    throw error
  }
}
