const express = require('express');
const jsonfile = require('jsonfile');
const path = require('path');
const browserSync = require('browser-sync').create();
const bodyParser = require('body-parser');
const fs = require('fs'); // Ensure fs is required
const Stripe = require('stripe');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const crypto = require('crypto');
const { Storage } = require('@google-cloud/storage');
const filepath = 'database.json'
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const nodemailer = require('nodemailer');

const DynamoDBStore = require('connect-dynamodb')({ session: session });
const AWS = require('aws-sdk');

AWS.config.update({
    region: 'eu-west-1', // e.g., 'us-west-2'
    endpoint: undefined, // Localstack endpoint
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});


// const forceHttps = require('express-force-https');
require('dotenv').config();
// Initialize Stripe with your secret key from the environment variables
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Ensure the .env file is required at the top if you're using environment variables

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
        db.run('CREATE TABLE IF NOT EXISTS Events (id INTEGER PRIMARY KEY AUTOINCREMENT, provider_id INTEGER, title TEXT, start TEXT, end TEXT, allDay BOOLEAN)', checkTableCreation);
    }
});                         

function checkTableCreation(err) {
    if (err) {
        console.error('Error creating table: ' + err.message);
    } else {
        console.log('Table created successfully');
    }
}

function saveCredentials(username, password, providerId, db, callback) {
    const saltRounds = 10; // Or more, depending on security requirement

    // Hash the password
    bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) {
            console.error('Error hashing password: ' + err.message);
            return callback(err);
        }

        // Insert hashed password and username into the credentials table
        db.run('INSERT INTO credentials (name, password) VALUES (?, ?)', [username, hash], function(err) {
            if (err) {
                console.error('Error inserting new credential: ' + err.message);
                return callback(err);
            }

            // Insert provider information into the providers table
            db.run('INSERT INTO providers (id, name) VALUES (?, ?)', [providerId, username], function(err) {
                if (err) {
                    console.error('Error creating provider: ' + err.message);
                    return callback(err);
                }

                // Success, call the callback without an error
                callback(null);
            });
        });
    });
}


async function sendEmail(to, subject, text) {
    // Create a transporter
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'Funeralbookingie@gmail.com',  // Your Gmail address
            pass: process.env.GOOGLE_MAIL_PASSWORD         // Your Gmail password
        }
    });

    // Setup email data
    let mailOptions = {
        from: '"Filip Black" <Funeralbookingie@gmail.com>',  // sender address
        to: to,  // list of receivers
        subject: subject,  // Subject line
        text: text,  // plain text body
        html: '<b>Hello world?</b>'  // HTML body content
    };

    // Send email
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log(error);
        }
        console.log('Message sent: %s', info.messageId);
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
const phrase = process.env.SECRET_PHRASE; // Keep this key secure

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

function getProviderId(providerId, callback) {
    if (!isNaN(providerId)) {
        // providerId is a number, return it as is
        callback(null, providerId);
    } else {
        // providerId is not a number, decrypt it
        try {
            const decryptedName = decrypt(providerId);
            // Fetch provider ID by the decrypted name
            const sql = 'SELECT id FROM providers WHERE name = ?';
            db.get(sql, [decryptedName], (err, row) => {
                if (err) {
                    callback(err);
                } else if (row) {
                    callback(null, row.id);
                } else {
                    callback(new Error('Provider not found'));
                }
            });
        } catch (error) {
            callback(error);
        }
    }
}

async function uploadToCloudStorage(file, category) {
    const blob = bucket.file(`${category}/${Date.now()}_${file.originalname}`);
    const blobStream = blob.createWriteStream({
        resumable: false,
        metadata: { contentType: file.mimetype }
    });

    return new Promise((resolve, reject) => {
        blobStream.on('error', err => {
            console.error(err);
            reject(err);
        });
        blobStream.on('finish', () => {
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
            resolve(publicUrl);
        });
        blobStream.end(file.buffer);
    });
}


function expressServer() {
    const app = express();

    // app.use(forceHttps);

    app.use(bodyParser.json());  // Parse JSON request bodies
    app.use(cookieParser());
    app.use(session({
        store: new DynamoDBStore({
            table: 'FuneralSession', 
            AWSRegion: 'eu-west-1',
            endpoint:  undefined, // Localstack endpoint
            logger: console,
            hashKey: 'funeral' 
        }),
        secret: process.env.SECRET_PHRASE || 'your_secret_key', // Change this to a real secret in production
        resave: false,
        saveUninitialized: true,
        cookie: {
            secure: process.env.NODE_ENV === 'production', // Set to true if using https
            maxAge: 1000 * 60 * 10 // Session max age in milliseconds
        }
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
    
                    // Fetch providerId
                    const providerQuery = 'SELECT id FROM providers WHERE name = ?';
                    db.get(providerQuery, [username], (err, provider) => {
                        if (err) {
                            console.error('Database error: ' + err.message);
                            return res.status(500).send('Internal server error');
                        }
    
                        if (!provider) {
                            return res.status(401).send('Provider not found');
                        }
    
                        const providerId = provider.id;
                        res.cookie('user', encryptedUsername, { httpOnly: true, maxAge: 900000, secure: true }); // Adjust settings as per your security needs
                        res.cookie('providerId', providerId, { httpOnly: false, maxAge: 900000 }); // Non-httpOnly cookie for providerId
                        res.redirect('/offerings.html');
                    });
                } else {
                    res.status(401).send('Credentials are not valid');
                }
            });
        });
    });
    

    app.post('/send-confirmation-email', (req, res) => {
        const { email } = req.body; // Extract the email address from request body
    
        // Ensure there is an email provided
        if (!email) {
            return res.status(400).send('Email address is required.');
        }
        
        let transporter = nodemailer.createTransport({
            host: 'smtp.seznam.cz',
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: 'funeralbookingie@seznam.cz', // your Seznam email
                pass: process.env.SEZNAM_MAIL_PASSWORD // your Seznam password
            },
            tls: {
                ciphers:'SSLv3'
            }
        });
    
        // Setup email data
        let mailOptions = {
            from: '"Filip Black" <funeralbookingie@seznam.cz>',  // sender address
            to: email,  // list of receivers
            subject: "Funeral Booking confirmation",  // Subject line
            text: 'This is your confirmation email! The Funeral Home will reach out to you shortly.', // Plain text body
            html: '<b>This is your confirmation email! The Funeral Home will reach out to you shortly.</b>' // HTML body
        };
    
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending email:', error);
                return res.status(500).send('Failed to send email.');
            }
            console.log('Email sent:', info.response);
            res.json({messsage: 'Email sent successfully to ' + email});
        });
    });

    app.post('/update-offering', upload.any(), async (req, res) => {
        const encryptedUsername = req.cookies.user;
        if (!encryptedUsername) {
            return res.status(401).send('No credentials provided');
        }


        console.log(req.body)
    
        const username = decrypt(encryptedUsername);
    
        db.get('SELECT id FROM providers WHERE name = ?', [username], async (err, providerRow) => {
            if (err) return res.status(500).send('Internal server error');
            if (!providerRow) return res.status(404).send('Provider not found');
    
            const providerId = providerRow.id;
            const categories = ['coffin', 'flower'];
            const second_categories = ['church', 'cemetery'];
            if (req.query.type === "places") {
                second_categories.forEach(category => {
                    db.run(`DELETE FROM ${category} WHERE provider_id = ?`, [providerId], (delErr) => {
                        if (delErr) {
                            console.error(`Error clearing ${category}:`, delErr.message);
                            return;
                        }
        
                        // Insert new data
                        const items = req.body[category] || [];
                        items.forEach(item => {
                            const sql = `INSERT INTO ${category} (provider_id, name, description, address) VALUES (?, ?, ?, ?)`;
                            db.run(sql, [providerId, item.name, item.description, item.address], (err) => {
                                if (err) {
                                    console.error(`Error updating ${category}:`, err.message);
                                } else {
                                    console.log(`${category} updated successfully`);
                                }
                            });
                        });
                    });
                });
            }
            // Clear existing data for second_categories
            
            
            if (req.query.type === "items") {

            
                // Handle coffins and flowers
                for (let category of categories) {

                    const existingItems = await new Promise(resolve => {
                        db.all(`SELECT name FROM ${category}s WHERE provider_id = ?`, [providerId], (err, rows) => {
                            if (err) {
                                console.error(`Error fetching existing ${category}s:`, err.message);
                                return resolve([]);
                            }
                            resolve(rows.map(row => row.name));
                        });
                    });

                    const items = req.body[category] || [];
                    const files = req.files.filter(file => file.fieldname.startsWith(category));

                    // Create a set of new and updated names
                    const updatedNames = new Set(items.map(item => item.name));

                    // Delete entries not mentioned in the updated list
                    const namesToDelete = existingItems.filter(name => !updatedNames.has(name));
                    for (const name of namesToDelete) {
                        db.run(`DELETE FROM ${category}s WHERE provider_id = ? AND name = ?`, [providerId, name], (err) => {
                            if (err) console.error(`Error deleting ${category} ${name}:`, err.message);
                        });
                    }

        
                    for (let i = 0; i < items.length; i++) {
                        const item = items[i];
                        const file = files.find(f => f.fieldname === `${category}[${i}][image]`);
                        const existing = await new Promise(resolve => {
                            db.get(`SELECT * FROM ${category}s WHERE name = ? AND provider_id = ?`, [item.name, providerId], (err, row) => {
                                if (err) {
                                    console.error(`Error fetching ${category}:`, err.message);
                                    return resolve(null);
                                }
                                resolve(row);
                            });
                        });
        
                        if (existing) {
                            if (file) {
                                const publicUrl = await uploadToCloudStorage(file, category);
                                db.run(`UPDATE ${category}s SET price = ?, img_path = ? WHERE id = ?`,
                                    [item.price, publicUrl, existing.id], (err) => {
                                        if (err) console.error(`Error updating ${category}:`, err.message);
                                    });
                            } else {
                                console.log(`${category} not updated as no new image provided for existing item.`);
                            }
                        } else {
                            if (file) {
                                const publicUrl = await uploadToCloudStorage(file, category);
                                db.run(`INSERT INTO ${category}s (provider_id, name, price, img_path) VALUES (?, ?, ?, ?)`,
                                    [providerId, item.name, item.price, publicUrl], (err) => {
                                        if (err) console.error(`Error creating new ${category}:`, err.message);
                                    });
                            } else {
                                res.send(`After renaming ${item.name}, please upload image again`);
                            }
                        }
                    }
                }
            }
    
            res.json({message:"Processed update offering request."});
        });
    });
    
    app.get('/coffins/:providerId', (req, res) => {
        const { providerId } = req.params;
    
        getProviderId(providerId, (err, resolvedProviderId) => {
            if (err) {
                console.error('Error resolving providerId:', err.message);
                res.status(400).json({ error: err.message });
                return;
            }
    
            const sql = 'SELECT * FROM coffins WHERE provider_id = ?';
            db.all(sql, [resolvedProviderId], (err, rows) => {
                if (err) {
                    console.error('Error fetching coffins:', err.message);
                    res.status(500).json({ error: 'Internal server error' });
                    return;
                }
    
                const coffins = rows.map(coffin => ({
                    id: coffin.id,
                    name: coffin.name,
                    description: coffin.description,
                    price: coffin.price,
                    imgPath: coffin.img_path
                }));
    
                res.json(coffins);
            });
        });
    });

    app.get('/flowers/:providerId', (req, res) => {
        const { providerId } = req.params;
    
        getProviderId(providerId, (err, resolvedProviderId) => {
            if (err) {
                console.error('Error resolving providerId:', err.message);
                res.status(400).json({ error: err.message });
                return;
            }
    
            const sql = 'SELECT * FROM flowers WHERE provider_id = ?';
            db.all(sql, [resolvedProviderId], (err, rows) => {
                if (err) {
                    console.error('Error fetching flowers:', err.message);
                    res.status(500).json({ error: 'Internal server error' });
                    return;
                }
    
                const flowers = rows.map(flower => ({
                    id: flower.id,
                    name: flower.name,
                    description: flower.description,
                    price: flower.price,
                    imgPath: flower.img_path
                }));
    
                res.json(flowers);
            });
        });
    });
    
    app.get('/church/:providerId', (req, res) => {
        const { providerId } = req.params;
    
        getProviderId(providerId, (err, resolvedProviderId) => {
            if (err) {
                console.error('Error resolving providerId:', err.message);
                res.status(400).json({ error: err.message });
                return;
            }
    
            const sql = 'SELECT * FROM church WHERE provider_id = ?';
            db.all(sql, [resolvedProviderId], (err, rows) => {
                if (err) {
                    console.error('Error fetching churches:', err.message);
                    res.status(500).json({ error: 'Internal server error' });
                    return;
                }
    
                const churches = rows.map(church => ({
                    id: church.id,
                    name: church.name,
                    description: church.description,
                    address: church.address
                }));
    
                res.json(churches);
            });
        });
    });
    
    app.get('/cemetery/:providerId', (req, res) => {
        const { providerId } = req.params;
    
        getProviderId(providerId, (err, resolvedProviderId) => {
            if (err) {
                console.error('Error resolving providerId:', err.message);
                res.status(400).json({ error: err.message });
                return;
            }
    
            const sql = 'SELECT * FROM cemetery WHERE provider_id = ?';
            db.all(sql, [resolvedProviderId], (err, rows) => {
                if (err) {
                    console.error('Error fetching cemeteries:', err.message);
                    res.status(500).json({ error: 'Internal server error' });
                    return;
                }
    
                const cemeteries = rows.map(cemetery => ({
                    id: cemetery.id,
                    name: cemetery.name,
                    description: cemetery.description,
                    address: cemetery.address
                }));
    
                res.json(cemeteries);
            });
        });
    });

    app.post('/calendar-upload/:providerId', (req, res) => {
        const { providerId } = req.params;
        const events = req.body;
    
        events.forEach(event => {
            const { title, start, end, allDay } = event;
            const sql = 'INSERT INTO Events (provider_id, title, start, end, allDay) VALUES (?, ?, ?, ?, ?)';
            db.run(sql, [providerId, title, start, end, allDay], (err) => {
                if (err) {
                    console.error(err.message);
                    return res.status(500).send(err.message);
                }
                console.log('A row has been inserted');
            });
        });
    
        res.status(200).json({ message: 'Events saved successfully' });
    });
    


    app.get('/calendar-source/:providerId', (req, res) => {
        const { providerId } = req.params;
    
        const sql = 'SELECT title, start, end, allDay FROM Events WHERE provider_id = ?';
        db.all(sql, [providerId], (err, rows) => {
            if (err) {
                console.error(err.message);
                res.status(500).json({ error: err.message });
                return;
            }
            const events = rows.map(row => ({
                title: row.title,
                start: row.start,
                end: row.end,
                allDay: row.allDay === 1 // Convert integer back to boolean for FullCalendar
            }));
    
            res.json(events);
        });
    });

    app.post('/download-database', (req, res) => {
        const { password } = req.body;
    
        if (password !== process.env.MASTER_PASSWORD) {
            return res.status(401).json({ error: 'Unauthorized: Incorrect password' });
        }
    
        const dbPath = './database.db'
    
        // Check if the database file exists
        if (!fs.existsSync(dbPath)) {
            return res.status(404).json({ error: 'Database file not found' });
        }
    
        // Send the database file as a download
        res.download(dbPath, 'database.db', (err) => {
            if (err) {
                console.error('Error sending the database file:', err);
                res.status(500).json({ error: 'Failed to send the database file' });
            }
        });
    });
    


    app.post('/register-home', (req, res) => {
        const { username, password, providerId, masterPassword } = req.body;
    
        if (!username || !password || !masterPassword) {
            return res.status(400).json({ message: 'Username and password are required' });
        }
        if (masterPassword === process.env.MASTER_PASSWORD) {
            saveCredentials(username, password, providerId, db, (err, result) => {
                if (err) {
                    res.status(500).json({ message: 'Failed to register credentials and initialize offerings', error: err.message });
                } else {
                    res.status(201).json(result);
                }
            });
        } else {
            res.status(400).json({message: "Master Password incorrect"})
        }

        
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



