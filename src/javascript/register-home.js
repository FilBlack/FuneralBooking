document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form');
    const submitBtn = document.getElementById('submit-btn');

    submitBtn.addEventListener('click', (event) => {
        event.preventDefault(); // Prevent the form from submitting through the browser

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const providerId = document.getElementById('providerId').value;
        const masterPassword = document.getElementById('masterPassword').value;

        const data = {
            username: username,
            password: password,
            providerId: providerId,
            masterPassword: masterPassword
        };

        fetch('/register-home', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(data => {
            console.log('Success:', data);
            alert('Registration successful');
        })
        .catch((error) => {
            console.error('Error:', error);
            alert('Error during registration');
        });
    });
});