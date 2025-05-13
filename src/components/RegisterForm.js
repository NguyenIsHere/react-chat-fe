// src/components/RegisterForm.js
import React, { useState, useContext } from 'react'
import { AuthContext } from '../contexts/AuthContext'

function RegisterForm () {
  const [username, setUsername] = useState('')
  const { handleRegisterUsername, authError, tempPhoneNumber, setAuthError } =
    useContext(AuthContext)

  const handleSubmit = async e => {
    e.preventDefault()
    if (!username) {
      setAuthError('Username is required.')
      return
    }
    await handleRegisterUsername(username)
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Register Username</h2>
      <p>Your phone number: {tempPhoneNumber} needs a username.</p>
      <div>
        <label htmlFor='username'>Username:</label>
        <input
          type='text'
          id='username'
          value={username}
          onChange={e => setUsername(e.target.value)}
          required
        />
      </div>
      <button type='submit'>Register & Login</button>
      {authError && <p style={{ color: 'red' }}>{authError}</p>}
    </form>
  )
}

export default RegisterForm
