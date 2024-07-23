const express = require('express');
const jsonfile = require('jsonfile');
const path = require('path');
const browserSync = require('browser-sync').create();
const bodyParser = require('body-parser');
const Stripe = require('stripe');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const crypto = require('crypto');
const { Storage } = require('@google-cloud/storage');
const filepath = 'database.json'
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
// const forceHttps = require('express-force-https');

// Initialize Stripe with your secret key from the environment variables
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Ensure the .env file is required at the top if you're using environment variables
require('dotenv').config();

const storage = new Storage();
const bucketName = 'funeral_booking';
const bucket = storage.bucket(bucketName);

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Error opening database ' + err.message);
    } else {
        // Existing tables creation
        db.run('CREATE TABLE IF NOT EXISTS homes (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, latitude REAL, longitude REAL)', checkTableCreation);
        db.run('CREATE TABLE IF NOT EXISTS emails (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT)', checkTableCreation);
        db.run('CREATE TABLE IF NOT EXISTS addresses (id INTEGER PRIMARY KEY AUTOINCREMENT, address TEXT)', checkTableCreation);
        db.run('CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_info TEXT)', checkTableCreation);
        db.run('CREATE TABLE IF NOT EXISTS credentials (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, password TEXT)', checkTableCreation);

        // Updated tables for service offerings
        db.run('CREATE TABLE IF NOT EXISTS providers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE)', checkTableCreation);
        db.run('CREATE TABLE IF NOT EXISTS coffins (id INTEGER PRIMARY KEY AUTOINCREMENT, provider_id INTEGER, name TEXT, description TEXT, price REAL, img_path TEXT, FOREIGN KEY (provider_id) REFERENCES providers(id))', checkTableCreation);
        db.run('CREATE TABLE IF NOT EXISTS flowers (id INTEGER PRIMARY KEY AUTOINCREMENT, provider_id INTEGER, name TEXT, description TEXT, price REAL, img_path TEXT, FOREIGN KEY (provider_id) REFERENCES providers(id))', checkTableCreation);
        db.run('CREATE TABLE IF NOT EXISTS dates (id INTEGER PRIMARY KEY AUTOINCREMENT, provider_id INTEGER, available_date TEXT, FOREIGN KEY (provider_id) REFERENCES providers(id))', checkTableCreation);
        db.run('CREATE TABLE IF NOT EXISTS church (id INTEGER PRIMARY KEY AUTOINCREMENT, provider_id INTEGER, name TEXT, description TEXT, address TEXT, FOREIGN KEY (provider_id) REFERENCES providers(id))', checkTableCreation);
        db.run('CREATE TABLE IF NOT EXISTS cemetery (id INTEGER PRIMARY KEY AUTOINCREMENT, provider_id INTEGER, name TEXT, description TEXT, address TEXT, FOREIGN KEY (provider_id) REFERENCES providers(id))', checkTableCreation);
        // Calendar
        db.run('CREATE TABLE IF NOT EXISTS Events (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, start TEXT, end TEXT, allDay BOOLEAN)', checkTableCreation);
    }
});                         

function checkTableCreation(err) {
    if (err) {
        console.error('Error creating table: ' + err.message);
    } else {
        console.log('Table created successfully');
    }
}

function saveCredentials(username, password, db, callback) {
    const saltRounds = 10; // or more, depending on security requirement
    bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) {
            console.error('Error hashing password: ' + err.message);
            return callback(err);
        }

        // Insert into credentials table
        db.run('INSERT INTO credentials (name, password) VALUES (?, ?)', [username, hash], function(err) {
            if (err) {
                console.error('Error inserting new credential: ' + err.message);
                return callback(err);
            }

            // Now create a provider entry
            db.run('INSERT INTO providers (name) VALUES (?)', [username], function(err) {
                if (err) {
                    console.error('Error creating provider: ' + err.message);
                    return callback(err);
                }
                const providerId = this.lastID;

                // Initialize related offerings
                initializeOfferings(providerId, db, callback);
            });
        });
    });
}

function initializeOfferings(providerId, db, callback) {
    // Insert default or empty entries for coffins, flowers, and dates
    db.run('INSERT INTO coffins (provider_id, description) VALUES (?, ?)', [providerId, 'Default coffin'], err => {
        if (err) return callback(err);
        db.run('INSERT INTO flowers (provider_id, description) VALUES (?, ?)', [providerId, 'Default flower'], err => {
            if (err) return callback(err);
            db.run('INSERT INTO dates (provider_id, available_date) VALUES (?, ?)', [providerId, '2024-01-01'], err => {
                if (err) return callback(err);
                callback(null, { message: 'Provider and offerings initialized successfully' });
            });
        });
    });
}



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

//Encryption

const algorithm = 'aes-256-ctr';
const phrase = 'YOUR_SECRET_KEY'; // Keep this key secure

function generateKey(passphrase) {
    return crypto.createHash('sha256').update(passphrase).digest();
}

const secretKey = generateKey(phrase)

function encrypt(text) {
    const iv = crypto.randomBytes(16); // Generate a new IV for each encryption
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

    return {
        iv: iv.toString('hex'),
        content: encrypted.toString('hex')
    };
}

function decrypt(hash) {
    const iv = Buffer.from(hash.iv, 'hex');
    const encryptedText = Buffer.from(hash.content, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
    const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);

    return decrypted.toString();
}



function expressServer() {
    const app = express();

    // app.use(forceHttps);

    app.use(bodyParser.json());  // Parse JSON request bodies
    app.use(cookieParser());
    app.use(session({
        secret: 'your_secret_key', // Change this to a real secret in production
        resave: false,
        saveUninitialized: true
    }));

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

    app.post('/authenticate', (req, res) => {
        const { username, password } = req.body;
    
        if (!username || !password) {
            return res.status(400).send('Username and password are required');
        }
    
        const query = 'SELECT * FROM credentials WHERE name = ?';
        db.get(query, [username], (err, user) => {
            if (err) {
                console.error('Database error: ' + err.message);
                return res.status(500).send('Internal server error');
            }
    
            if (!user) {
                return res.status(401).send('Credentials are not valid');
            }
    
            bcrypt.compare(password, user.password, (err, result) => {
                if (err) {
                    console.error('Error comparing passwords: ' + err.message);
                    return res.status(500).send('Internal server error');
                }
    
                if (result) {
                    const encryptedUsername = encrypt(username);
                    res.cookie('user', encryptedUsername, { httpOnly: true, maxAge: 900000, secure: true }); // Adjust settings as per your security needs
                    res.redirect('/offerings.html');
                } else {
                    res.status(401).send('Credentials are not valid');
                }
            });
        });
    });
    

    app.post('/update-offering', upload.any(), async (req, res) => {
        console.log(req.body)
        console.log(req.files)
        const encryptedUsername = req.cookies.user;
        if (!encryptedUsername) {
            return res.status(401).send('No credentials provided');
        }
    
        const username = decrypt(encryptedUsername);
        
    
        db.get('SELECT id FROM providers WHERE name = ?', [username], async (err, row) => {
            if (err) return res.status(500).send('Internal server error');
            if (!row) return res.status(404).send('Provider not found');
    
            const providerId = row.id;
    
            // Handle multiple categories
            const categories = ['coffin', 'flower']; // Extend this list with more categories as needed
            categories.forEach(category => {
                const items = req.body[category] || [];
                const files = req.files.filter(file => file.fieldname.startsWith(category));
                console.log(files)
                items.forEach((item, index) => {
                    const file = files[index]; // Directly use index for matching
                    if (file) {
                        const blob = bucket.file(`${category}/${Date.now()}_${file.originalname}`);
                        const blobStream = blob.createWriteStream({
                            resumable: false,
                            metadata: { contentType: file.mimetype }
                        });
    
                        blobStream.on('error', err => console.error(err));
                        blobStream.on('finish', () => {
                            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
    
                            db.run(`INSERT INTO ${category}s (provider_id, name, price, img_path) VALUES (?, ?, ?, ?)`,
                                [providerId, item.name, item.price, publicUrl], (err) => {
                                    if (err) console.error(`Error updating ${category}:`, err.message);
                                });
                        });
    
                        blobStream.end(file.buffer);
                    } else {
                        console.error('No matching file found for', item.name);
                    }
                });
                const second_categories = ['church', 'cemetery'];
                second_categories.forEach(category => {
                    const items = req.body[category] || [];
                    items.forEach((item) => {
                        const sql = `INSERT INTO ${category} (provider_id, name, description, address) VALUES (?, ?, ?, ?)`;
                        const params = [providerId, item.name, item.description, item.address];
                
                        db.run(sql, params, (err) => {
                            if (err) {
                                console.error(`Error updating ${category}:`, err.message);
                            } else {
                                console.log(`${category} updated successfully`);
                            }
                        });
                    });
                });

            });
    
            res.json({message: 'Offerings updated successfully'});
        });
    });
    

    app.post('/calendar-upload', (req, res) => {
        const events = req.body;
        console.log(events); // Log the events
    
        events.forEach(event => {
            const { title, start, end, allDay } = event;
            db.run('INSERT INTO Events (title, start, end, allDay) VALUES (?, ?, ?, ?)', [title, start, end, allDay], (err) => {
                if (err) {
                    return console.error(err.message);
                }
                console.log('A row has been inserted');
            });
        });
    
        res.status(200).json({ message: 'Events saved successfully' });
    });


    app.get('/calendar-source', (req, res) => {
        // Query the database for all events
        db.all('SELECT title, start, end, allDay FROM Events', [], (err, rows) => {
            if (err) {
                console.error(err.message);
                res.status(500).json({ error: err.message });
                return;
            }
            // Convert the database rows to FullCalendar event objects
            const events = rows.map(row => ({
                title: row.title,
                start: row.start,
                end: row.end,
                allDay: row.allDay === 1 // Convert integer back to boolean for FullCalendar
            }));
    
            // Send the events to the client
            res.json(events);
        });
    });


    app.post('/register-home', (req, res) => {
        const { username, password } = req.body;
    
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }
    
        saveCredentials(username, password, db, (err, result) => {
            if (err) {
                res.status(500).json({ message: 'Failed to register credentials and initialize offerings', error: err.message });
            } else {
                res.status(201).json(result);
            }
        });
    });

    app.post('/store-data', async (req, res) => {
        const data = req.body; // Data sent in the POST request
        console.log(data);
    
        // Begin transaction
        db.run('BEGIN TRANSACTION;', (err) => {
            if (err) {
                console.error('Error beginning transaction:', err.message);
                return res.status(500).json({ status: 'error', message: 'Failed to begin transaction' });
            }
    
            // Helper function to handle errors and rollback
            const handleError = (errorMessage) => {
                db.run('ROLLBACK;', (rollbackErr) => {
                    if (rollbackErr) console.error('Error rolling back transaction:', rollbackErr.message);
                });
                console.error(errorMessage);
                res.status(500).json({ status: 'error', message: errorMessage });
            };
    
            try {
                let dataSaved = false;
    
                // Handle storing homes data
                if (data.all_homes && Array.isArray(data.all_homes)) {
                    const insertHome = db.prepare('INSERT INTO homes (name, latitude, longitude) VALUES (?, ?, ?)');
                    data.all_homes.forEach(home => {
                        insertHome.run([home.name, home.coordinates[0], home.coordinates[1]], (err) => {
                            if (err) {
                                throw err;
                            }
                        });
                    });
                    insertHome.finalize();
                    dataSaved = true;
                }
    
                // Handle storing email data
                if (data.email && Array.isArray(data.email)) {
                    const insertEmail = db.prepare('INSERT INTO emails (email) VALUES (?)');
                    data.email.forEach(email => {
                        insertEmail.run([email], (err) => {
                            if (err) {
                                throw err;
                            }
                        });
                    });
                    insertEmail.finalize();
                    dataSaved = true;
                }
    
                // Handle storing addresses
                if (data.address && Array.isArray(data.address)) {
                    const insertAddress = db.prepare('INSERT INTO addresses (address) VALUES (?)');
                    data.address.forEach(address => {
                        insertAddress.run([address], (err) => {
                            if (err) {
                                throw err;
                            }
                        });
                    });
                    insertAddress.finalize();
                    dataSaved = true;
                }
    
                // Handle storing customer information
                if (data.customers && Array.isArray(data.customers)) {
                    const insertCustomer = db.prepare('INSERT INTO customers (customer_info) VALUES (?)');
                    data.customers.forEach(customer => {
                        insertCustomer.run([JSON.stringify(customer)], (err) => {
                            if (err) {
                                throw err;
                            }
                        });
                    });
                    insertCustomer.finalize();
                    dataSaved = true;
                }
    
                // Handle storing credentials
                if (data.credentials && Array.isArray(data.credentials)) {
                    const insertCredential = db.prepare('INSERT INTO credentials (name, password) VALUES (?, ?)');
                    data.credentials.forEach(credential => {
                        insertCredential.run([credential.name, credential.password], (err) => {
                            if (err) {
                                throw err;
                            }
                        });
                    });
                    insertCredential.finalize();
                    dataSaved = true;
                }
    
                // Commit transaction
                db.run('COMMIT;', (err) => {
                    if (err) {
                        throw err;
                    }
                    if (dataSaved) {
                        res.json({ status: 'success', message: 'Data stored successfully' });
                    } else {
                        handleError('No data was saved');
                    }
                });
    
            } catch (error) {
                // Rollback transaction in case of error
                db.run('ROLLBACK;', (rollbackErr) => {
                    if (rollbackErr) console.error('Error rolling back transaction:', rollbackErr.message);
                });
    
                console.error('Failed to store data:', error.message);
                res.status(500).json({ status: 'error', message: 'Failed to store data', error: error.toString() });
            }
        });
    });
    
    

    app.get('/retrieve-data', async (req, res) => {
        const password = req.header('password');
        if (password !== process.env.DATA_PASSWORD) {
            return res.status(401).json({ message: "Unauthorized: Incorrect password" });
        }
    
        const datapoint = req.query.datapoint; // This could be 'homes', 'emails', 'addresses', etc.
        if (!datapoint) {
            return res.status(400).json({ message: "Query parameter 'datapoint' is required" });
        }
    
        // Define table mappings or simply use the datapoint if it exactly matches your table names
        const tableMapping = {
            homes: 'homes',
            emails: 'emails',
            addresses: 'addresses',
            customers: 'customers',
            credentials: 'credentials'
        };
    
        const tableName = tableMapping[datapoint];
    
        if (!tableName) {
            return res.status(404).json({ message: "Invalid datapoint requested" });
        }
    
        // Query the database for the requested data
        try {
            db.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
                if (err) {
                    console.error('Error reading from the database:', err.message);
                    res.status(500).json({ message: "Failed to retrieve data", error: err.message });
                    return;
                }
                if (rows.length > 0) {
                    res.json(rows);
                } else {
                    res.status(404).json({ message: "Data not found" });
                }
            });
        } catch (error) {
            console.error('Server error:', error.message);
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



