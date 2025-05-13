// src/contexts/AuthContext.js
import React, { createContext, useState, useEffect, useCallback } from 'react'
import { jwtDecode } from 'jwt-decode' // Sửa thành import đúng
import { loginUser, registerUser, refreshToken } from '../api/authApi'

export const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [tokens, setTokens] = useState(() => {
    const storedTokens = localStorage.getItem('authTokens')
    return storedTokens ? JSON.parse(storedTokens) : null
  })
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)
  const [needsRegistration, setNeedsRegistration] = useState(false)
  const [tempPhoneNumber, setTempPhoneNumber] = useState('') // Lưu SĐT khi cần đăng ký username

  const decodeToken = useCallback(accessToken => {
    if (accessToken) {
      try {
        const decoded = jwtDecode(accessToken)
        // Giả sử 'sub' trong token là phoneNumber
        setCurrentUser({ phoneNumber: decoded.sub, ...decoded })
      } catch (error) {
        console.error('Failed to decode token:', error)
        setCurrentUser(null)
      }
    } else {
      setCurrentUser(null)
    }
  }, [])

  useEffect(() => {
    if (tokens?.accessToken) {
      decodeToken(tokens.accessToken)
      localStorage.setItem('authTokens', JSON.stringify(tokens))
    } else {
      localStorage.removeItem('authTokens')
      setCurrentUser(null)
    }
    setLoading(false)
  }, [tokens, decodeToken])

  // Hàm refresh token tự động (ví dụ)
  useEffect(() => {
    if (!tokens?.refreshToken) return

    const interval = setInterval(async () => {
      try {
        console.log('Attempting to refresh token...')
        const newTokens = await refreshToken(tokens.refreshToken)
        setTokens(newTokens)
        console.log('Token refreshed successfully')
      } catch (error) {
        console.error('Failed to refresh token, logging out:', error)
        logout() // Đăng xuất nếu refresh thất bại
      }
    }, 55 * 60 * 1000) // Refresh mỗi 55 phút (trước khi access token 1h hết hạn)

    return () => clearInterval(interval)
  }, [tokens])

  const handleLogin = async phoneNumber => {
    setAuthError(null)
    setNeedsRegistration(false)
    try {
      const data = await loginUser(phoneNumber)
      if (data.message === 'New user, please register username') {
        setNeedsRegistration(true)
        setTempPhoneNumber(phoneNumber) // Lưu SĐT để dùng cho màn hình đăng ký username
        // Không set token ở đây vì user chưa hoàn tất login
      } else if (data.accessToken && data.refreshToken) {
        setTokens({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken
        })
        setNeedsRegistration(false)
      } else {
        setAuthError(
          data.message || 'Login failed: Unknown response from server.'
        )
      }
    } catch (error) {
      if (
        error.response &&
        error.response.data &&
        error.response.data.message === 'New user, please register username'
      ) {
        setNeedsRegistration(true)
        setTempPhoneNumber(phoneNumber)
      } else {
        setAuthError(
          error.response?.data?.message || error.message || 'Login failed'
        )
      }
    }
  }

  const handleRegisterUsername = async username => {
    setAuthError(null)
    if (!tempPhoneNumber) {
      setAuthError('Phone number for registration is missing.')
      return
    }
    try {
      // Gọi API đăng ký username
      const data = await registerUser(tempPhoneNumber, username)
      if (data.accessToken && data.refreshToken) {
        setTokens({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken
        })
        setNeedsRegistration(false)
        setTempPhoneNumber('') // Xóa SĐT tạm
      } else {
        setAuthError(
          data.message || 'Registration failed: Unknown response from server.'
        )
      }
    } catch (error) {
      setAuthError(
        error.response?.data?.message || error.message || 'Registration failed'
      )
    }
  }

  const logout = () => {
    // TODO: Gọi API logout của backend nếu có
    setTokens(null)
    setCurrentUser(null)
    localStorage.removeItem('authTokens')
    setNeedsRegistration(false)
    setTempPhoneNumber('')
    // Điều hướng về trang login nếu cần (thường xử lý ở App.js hoặc component cha)
  }

  return (
    <AuthContext.Provider
      value={{
        tokens,
        currentUser,
        loading,
        authError,
        needsRegistration,
        tempPhoneNumber,
        handleLogin,
        handleRegisterUsername,
        logout,
        setAuthError
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
