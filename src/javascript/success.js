document.addEventListener('DOMContentLoaded', function() {
    // Retrieve the email from session storage
    const email = sessionStorage.getItem('email');

    if (email) {
        // Prepare the data to send in the POST request
        const postData = {
            email: email
        };

        // Send a POST request to the server
        fetch('/send-confirmation-email', {
            method: 'POST',   // Specify the method
            headers: {
                'Content-Type': 'application/json'  // Specify the content type
            },
            body: JSON.stringify(postData)  // Convert the JavaScript object to a JSON string
        })
        .then(response => {
            if (response.ok) {
                return response.json();  // Return the JSON response if successful
            }
            throw new Error('Network response was not ok.'); // Throw an error if response not ok
        })
        .then(data => {
            console.log('Email sent successfully:', data);  // Log success message and any response data
        })
        .catch(error => {
            console.error('Error sending email:', error);  // Log any errors that occur during the fetch
        });
    } else {
        console.log("No email found in session storage.");  // Log if no email is found
    }
});
