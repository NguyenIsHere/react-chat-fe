// src/components/UserList.js
import React, { useState, useEffect, useContext } from 'react'
import { searchUsers, getOnlineUsers } from '../api/userApi'
import { AuthContext } from '../contexts/AuthContext'

function UserList ({ onSelectUser }) {
  const [users, setUsers] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { currentUser } = useContext(AuthContext)

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      let fetchedUsers
      if (searchTerm.trim()) {
        fetchedUsers = await searchUsers(searchTerm)
      } else {
        fetchedUsers = await getOnlineUsers() // Hoặc một API lấy danh sách bạn bè
      }
      // Lọc ra user hiện tại nếu có trong danh sách (mặc dù backend đã làm)
      setUsers(
        fetchedUsers.filter(u => u.phoneNumber !== currentUser?.phoneNumber)
      )
    } catch (err) {
      setError(err.message || 'Failed to fetch users')
    }
    setLoading(false)
  }

  useEffect(() => {
    if (currentUser) {
      // Chỉ fetch users nếu đã login
      fetchUsers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, currentUser]) // Fetch lại khi searchTerm hoặc currentUser thay đổi

  return (
    <div className='user-list-container'>
      <h3>Users</h3>
      <input
        type='text'
        placeholder='Search users...'
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
      />
      {loading && <p>Loading users...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <ul>
        {users.map(user => (
          <li
            key={user.phoneNumber}
            onClick={() => onSelectUser(user)}
            style={{ cursor: 'pointer', color: user.online ? 'green' : 'grey' }}
          >
            {user.username} ({user.phoneNumber}) -{' '}
            {user.online ? 'Online' : 'Offline'}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default UserList
