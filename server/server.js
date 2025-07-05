const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const notificationScheduler = require('./services/notificationScheduler');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Data file path
const ordersFilePath = path.join(__dirname, 'data', 'orders.json');

// Ensure data directory exists
async function ensureDataDirectory() {
  const dataDir = path.dirname(ordersFilePath);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Initialize orders.json if it doesn't exist
async function initializeOrdersFile() {
  try {
    await fs.access(ordersFilePath);
  } catch {
    // File doesn't exist, create it with empty array
    await fs.writeFile(ordersFilePath, JSON.stringify([], null, 2));
  }
}

// Read orders from file
async function readOrders() {
  try {
    const data = await fs.readFile(ordersFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading orders file:', error);
    return [];
  }
}

// Write orders to file
async function writeOrders(orders) {
  try {
    await fs.writeFile(ordersFilePath, JSON.stringify(orders, null, 2));
  } catch (error) {
    console.error('Error writing orders file:', error);
    throw error;
  }
}

// Routes
app.use('/api/orders', require('./routes/orders'));
app.use('/api/orders', require('./routes/reminders'));
app.use('/api/insights', require('./routes/insights'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/notifications', require('./routes/notifications'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Payment Collection Assistant API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
async function startServer() {
  try {
    await ensureDataDirectory();
    await initializeOrdersFile();
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Orders data file: ${ordersFilePath}`);
      
      // Start notification scheduler
      notificationScheduler.start();
    });
  } catch (error) {
    console.error('Unable to start server:', error);
  }
}

startServer(); 