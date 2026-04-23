const email = 'testuser2@example.com';
fetch('http://localhost:5000/api/auth/verify-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, otp: '100884' })
})
.then(res => res.json())
.then(data => console.log('Register Response:', data))
.catch(err => console.error(err));
