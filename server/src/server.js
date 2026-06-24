const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const users = require('./data/users');

const app = express();
const PORT = 5000;
const SECRET_KEY = 'your_secret_key_here';

app.use(cors());
app.use(express.json());

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  // Find user
  const user = users.find(
    u => u.username === username && u.password === password
  );
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Tên đăng nhập hoặc mật khẩu không đúng!'
    });
  }
  
  // Generate token
  const token = jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      role: user.role 
    },
    SECRET_KEY,
    { expiresIn: '1h' }
  );
  
  res.json({
    success: true,
    message: 'Đăng nhập thành công!',
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName
    }
  });
});

// Register endpoint
app.post('/api/register', (req, res) => {
  const { username, password, displayName } = req.body;
  
  // Check if username exists
  const existingUser = users.find(u => u.username === username);
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'Tên đăng nhập đã tồn tại!'
    });
  }
  
  // Create new user (in memory - for demo)
  const newUser = {
    id: users.length + 1,
    username,
    password,
    role: 'user', // Default role for new users
    displayName: displayName || username
  };
  
  users.push(newUser);
  
  // Generate token for new user
  const token = jwt.sign(
    { 
      id: newUser.id, 
      username: newUser.username, 
      role: newUser.role 
    },
    SECRET_KEY,
    { expiresIn: '1h' }
  );
  
  res.json({
    success: true,
    message: 'Đăng ký thành công!',
    token,
    user: {
      id: newUser.id,
      username: newUser.username,
      role: newUser.role,
      displayName: newUser.displayName
    }
  });
});

// Verify token endpoint
app.get('/api/verify', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided'
    });
  }
  
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    res.json({
      success: true,
      user: decoded
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});