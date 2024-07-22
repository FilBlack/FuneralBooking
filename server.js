const express = require('express');
const jsonfile = require('jsonfile');
const path = require('path');
const browserSync = require('browser-sync').create();
const bodyParser = require('body-parser');
const Stripe = require('stripe');
const filepath = 'database.json'
// const forceHttps = require('express-force-https');


// Ensure the .env file is required at the top if you're using environment variables
require('dotenv').config();

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./mydatabase.db', (err) => {
    if (err) {
        console.error('Error opening database ' + err.message);
    } else {
        db.run('CREATE TABLE IF NOT EXISTS homes (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, latitude REAL, longitude REAL)',
            (err) => {
                if (err) console.error('Error creating table homes ' + err.message);
            });
        db.run('CREATE TABLE IF NOT EXISTS emails (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT)',
            (err) => {
                if (err) console.error('Error creating table emails ' + err.message);
            });
        db.run('CREATE TABLE IF NOT EXISTS addresses (id INTEGER PRIMARY KEY AUTOINCREMENT, address TEXT)',
            (err) => {
                if (err) console.error('Error creating table addresses ' + err.message);
            });
        db.run('CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_info TEXT)',
            (err) => {
                if (err) console.error('Error creating table customers ' + err.message);
            });
        db.run('CREATE TABLE IF NOT EXISTS credentials (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, password TEXT)',
            (err) => {
                if (err) console.error('Error creating table credentials ' + err.message);
            });
    }
});


// Initialize Stripe with your secret key from the environment variables
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

function distance(coords1, coords2) {
    function toRad(x) {
        return x * Math.PI / 180;
    }

    var lat1 = coords1[0];
    var lon1 = coords1[1];
    var lat2 = coords2[0];
    var lon2 = coords2[1];

    var R = 6371; // Earth's radius in kilometers

    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);

    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    var distance = R * c;

    return distance;
}

function updateData(existingData, incomingData) {
    // Iterate over each key in the incoming data
    Object.keys(incomingData).forEach(key => {
        const value = incomingData[key];

        // Check if the key already exists in the existing data
        if (existingData[key]) {
            // If it's not an array, convert it to an array with the current value
            if (!Array.isArray(existingData[key])) {
                existingData[key] = [existingData[key]];
            }
            // Add the new value to the array
            existingData[key].push(value);
        } else {
            // Initialize a new array for this key with the new value
            existingData[key] = [value];
        }
    });

    return existingData;
}


function expressServer() {
    const app = express();

    // app.use(forceHttps);

    app.use(bodyParser.json());  // Parse JSON request bodies

    // Explicitly handle the root route first
    app.get('/', function(req, res) {
        res.sendFile(path.join(__dirname, 'src', 'index.html'));
    });

    // Serve static files from 'src' but only after trying the explicit routes
    app.use(express.static('src'));

    app.use((err, req, res, next) => {
        console.error(err.stack);
        res.status(500).json({ error: 'Internal Server Error' });
    });

    // Endpoint to create a payment intent
    app.post('/create-payment', async (req, res) => {
        console.log('Received payment request with:', req.body);
    
        const { paymentMethodId, amount, paymentId } = req.body;
        if (!paymentMethodId || !amount) {
            console.error('Error: Payment Method ID and amount are required');
            return res.status(400).json({ success: false, message: 'Payment Method ID and amount are required' });
        }
    
        try {
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method: paymentMethodId,
                confirm: true,
                automatic_payment_methods: {
                    enabled: true,
                    allow_redirects: 'never'
                }
            });
    
            console.log('Payment Intent created:', paymentIntent);
            res.json({
                success: true,
                message: 'Payment successful',
                paymentIntentId: paymentIntent.id
            });
        } catch (error) {
            console.error('Error creating payment intent:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create payment intent',
                error: error.message
            });
        }
    });
    
    

    // Handling requests for HTML files specifically, after all other routes
    app.get(/.+\.html$/, function(req, res) {
        let filePath = path.join(__dirname, 'src', req.url);
        console.log('Requesting HTML file:', filePath);
        res.sendFile(filePath, function (err) {
            if (err) {
                console.log('Error sending file:', err);
                res.status(404).send('Page Not Found');
            }
        });
    });

    app.post('/store-data', async (req, res) => {
        const data = req.body; // Data sent in the POST request
        try {
            // Read existing data from the file
            try {
                var existingData = jsonfile.readFileSync(filepath);
            } catch (error) {
                console.log('No existing file, creating new one.');
            }
    
            // Combine old data with new data
            
            const updatedData = updateData(existingData, data);
    
            // Write data to a JSON file
            jsonfile.writeFileSync(filepath, updatedData, { spaces: 2 });

            // Send a success response
            res.json({status: 'success', message: 'Data stored successfully'});
        } catch (error) {
            // Send an error response
            res.status(500).json({status: 'error', message: 'Failed to store data', error: error.toString()});
        }
    });

    app.get('/retrieve-data', async (req, res) => {
        try {
            // It's better to use headers for sensitive data
            const password = req.header('password');
            if (password !== process.env.DATA_PASSWORD) {
                return res.status(401).json({ message: "Unauthorized: Incorrect password" });
            }
    
            const db = jsonfile.readFileSync(filepath); // Consider using async version in real applications
            const question = req.query.datapoint;
    
            const data = db[question];
            if (data) {
                res.json(data);
            } else {
                res.status(404).json({ message: "Data not found" });
            }
        } catch (error) {
            res.status(500).json({ message: "Failed to read data", error: error.toString() });
        }
    });

    app.post('/create-payment-intent', async (req, res) => {
        try {
            const paymentIntent = await stripe.paymentIntents.create({
                amount: 1099, // Specify the amount in the smallest currency unit, e.g., cents for USD
                currency: 'eur',  // Correct ISO code for Euro
                payment_method_types: ['card'], // This can be expanded based on what your PaymentElement supports
            });
            res.json({ clientSecret: paymentIntent.client_secret });
        } catch (error) {
            console.error("Failed to create payment intent:", error); // Detailed log for server-side debugging
            // You could handle specific error types differently here if needed
            res.status(500).json({ error: error.message });
        }
    });


    app.get('/confirmation', async (req, res) => {
        const paymentIntentId = req.query.payment_intent;
        if (!paymentIntentId) {
            return res.status(400).send('Payment intent ID is required');
        }
    
        try {
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            if (paymentIntent.status === 'succeeded') {
                res.status(200).json({ url: '/success.html' });
            } else {
                res.status(200).json({ url: '/failure.html' });
            }
        } catch (error) {
            console.error('Stripe error:', error);
            res.status(500).send('Internal Server Error');
        }
    });
    

    

    app.get('/nearest_homes/:place_id', function(req,res) {
        const place_id = req.params.place_id;
        fetch(`https://maps.googleapis.com/maps/api/geocode/json?place_id=${place_id}&key=${process.env.GOOGLE_KEY}`)
            .then(response => response.json())
            .then(data => {
            if (data.status === 'OK') {
                // Extracting latitude and longitude from the response
                var latitude = data.results[0].geometry.location.lat;
                var longitude = data.results[0].geometry.location.lng;
                console.log(`Latitude: ${latitude}, Longitude: ${longitude}`);
                const db = jsonfile.readFileSync(filepath);
                var current_distance;
                var all_distances = [];
                for (var home of db.all_homes) {   
                    current_distance = distance(home.coordinates, [latitude,longitude])
                    all_distances.push({"name":home.name, "distance":current_distance, "desc":home.desc})
                }
                console.log(all_distances)
                res.json(all_distances)

            } else {
                console.error('Geocoding failed:', data.status);
            }
            })
            .catch(error => console.error('Error with the geocoding request:', error));
    })

    // Start the Express server
    const port = process.env.PORT || 8081;

    const server = app.listen(port, function() {
        console.log(`[Express] Server listening on port ${port}`);
    });

    // Initialize BrowserSync to sync with the Express server
    
    if (process.env.NODE_ENV !== 'production') {
        const browserSync = require('browser-sync').create();
        browserSync.init({
            open: false,
            notify: false,
            proxy: 'localhost:8081',
            files: ['src/**/*.html', 'src/**/*.css', 'src/**/*.js'],
            port: 4000,
        });
    }

    // Clean up on server close
    server.on('close', () => {
        console.log('Server is shutting down');
        browserSync.exit();
    });
}



// Call the function to start the server
expressServer();

//Database stuff 



