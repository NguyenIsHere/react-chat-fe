// src/App.js
import React from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate
} from 'react-router-dom'
import { AuthProvider, AuthContext } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import ChatPage from './pages/ChatPage'
import './App.css' // File CSS cơ bản (tạo nếu cần)

function ProtectedRoute ({ children }) {
  const { currentUser, loading } = React.useContext(AuthContext)

  if (loading) {
    return <div>Loading...</div> // Hoặc một spinner
  }

  return currentUser ? children : <Navigate to='/login' />
}

function App () {
  return (
    <AuthProvider>
      <Router>
        <div className='App'>
          <Routes>
            <Route path='/login' element={<LoginPage />} />
            <Route
              path='/chat'
              element={
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              }
            />
            <Route path='/' element={<Navigate to='/login' />} />{' '}
            {/* Mặc định chuyển đến login */}
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App
