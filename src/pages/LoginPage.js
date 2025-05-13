// src/pages/LoginPage.js
import React, { useContext } from 'react'
import { Navigate } from 'react-router-dom'
import LoginForm from '../components/LoginForm'
import RegisterForm from '../components/RegisterForm' // Form đăng ký username
import { AuthContext } from '../contexts/AuthContext'

function LoginPage () {
  const { currentUser, needsRegistration } = useContext(AuthContext)

  if (currentUser) {
    return <Navigate to='/chat' /> // Nếu đã login, chuyển đến trang chat
  }

  return (
    <div>
      <h1>Chat App</h1>
      {needsRegistration ? <RegisterForm /> : <LoginForm />}
    </div>
  )
}

export default LoginPage
