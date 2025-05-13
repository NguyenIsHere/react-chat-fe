// src/components/LoginForm.js
import React, { useState, useContext } from 'react'
import { AuthContext } from '../contexts/AuthContext'

function LoginForm () {
  const [phoneNumber, setPhoneNumber] = useState('')
  const { handleLogin, authError, setAuthError } = useContext(AuthContext)

  const handleSubmit = async e => {
    e.preventDefault()
    if (!phoneNumber) {
      setAuthError('Phone number is required.')
      return
    }
    await handleLogin(phoneNumber)
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Login</h2>
      <div>
        <label htmlFor='phoneNumber'>Phone Number:</label>
        <input
          type='tel'
          id='phoneNumber'
          value={phoneNumber}
          onChange={e => setPhoneNumber(e.target.value)}
          placeholder='E.g., +84123456789 or 0123456789'
          required
        />
      </div>
      <button type='submit'>Login</button>
      {authError && <p style={{ color: 'red' }}>{authError}</p>}
    </form>
  )
}

export default LoginForm
