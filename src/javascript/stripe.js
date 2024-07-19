
var stripe = Stripe("pk_test_51PZ7zSI8AZ6DGCO7VXuRg1tBi7sNHTVTMs9txVe7wmP6PvB4ykr2oUW27Wdx8puufERS8hYmHYSqYuyg9k8iyw1500pqZQ1OSc");
var elements;


function sendDataToServer(data) {
    fetch('/store-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => console.log('Data sent successfully:', data))
    .catch((error) => console.error('Error:', error));
  }

fetch('/create-payment-intent', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount: 1099 }) // Example amount, you can dynamicize this
}).then(response => response.json())
  .then(data => {
      elements = stripe.elements({ clientSecret: data.clientSecret });
      const paymentElement = elements.create('payment');
      paymentElement.mount('#payment-element');
  })
  .catch(error => {
      console.error('Error:', error);
  });

// var card = elements.create('card');
// console.log("Card element created", card);

// card.mount('#card-element');
// console.log("Card element mounted");



function generatePaymentId() {
    return 'pid_' + new Date().getTime() + '_' + Math.random().toString(36).substring(2, 15);
}

document.getElementById('payment-form').addEventListener('submit', function(event) {
    event.preventDefault();

    var cardholderName = document.getElementById('cardholderName').value;
    var billingAddress = document.getElementById('billingAddress').value;
    var city = document.getElementById('city').value;
    var zipCode = document.getElementById('zipCode').value;

    // Create a JSON object
    var formData = {customers: {
        "Cardholder Name": cardholderName,
        "Billing Address": billingAddress,
        "City": city,
        "ZIP Code": zipCode
        }   
    };

    sendDataToServer(formData)
    const returnUrl = `${window.location.origin}/confirmation`;
    console.log(returnUrl)
    console.log("confirming payment")
    stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: {
        },
    }).then(function(result) {
        if (result.error) {
            console.error('Error confirming payment:', result.error.message);
        } else {
            console.log('Payment confirmed:', result.paymentIntent.id);
            // Redirecting to the confirmation endpoint with paymentIntent ID in the query
            const confirmationUrl = `${window.location.origin}/confirmation?payment_intent=${result.paymentIntent.id}`;
            fetch(confirmationUrl)
                .then(response => response.json()) // Assuming the server responds with JSON
                .then(data => {
                    console.log('Server response:', data);
                    window.location.href = window.location.origin + data.url;
                    // Redirect or handle the response from the server
                })
                .catch(error => {
                    console.error('Error fetching confirmation:', error);
                });
        }
    });
});

// document.getElementById('payment-form').addEventListener('submit', function(event) {
//     event.preventDefault();

//     var paymentAmount = parseInt(document.getElementById('payment-amount').value, 10);
//     var paymentId = generatePaymentId(); // Ensure this function is defined

//     stripe.createPaymentMethod({
//         type: 'card',
//         card: card,
//     }).then(function(result) {
//         if (result.error) {
//             console.error('Error creating payment method:', result.error.message);
//         } else {
//             console.log('Payment Method ID:', result.paymentMethod.id);
//             fetch('/create-payment', {
//                 method: 'POST',
//                 headers: {
//                     'Content-Type': 'application/json',
//                 },
//                 body: JSON.stringify({
//                     paymentMethodId: result.paymentMethod.id,
//                     amount: paymentAmount,
//                     paymentId: paymentId
//                 }),
//             })
//             .then(response => {
//                 if (!response.ok) {
//                     throw new Error('Network response was not ok. Status: ' + response.status);
//                 }
//                 return response.json(); // Parse the JSON of the response
//             })
//             .then(transactionResponse => {
//                 console.log('Server response:', transactionResponse);
//             })
//             .catch(error => {
//                 console.error('Fetch Error:', error);
//             });
//         }
//     });
// });
