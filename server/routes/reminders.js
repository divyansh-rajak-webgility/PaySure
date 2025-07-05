const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// Data file paths
const ordersFilePath = path.join(__dirname, '..', 'data', 'orders.json');
const remindersFilePath = path.join(__dirname, '..', 'data', 'reminders.json');

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

// Read reminders from file
async function readReminders() {
  try {
    const data = await fs.readFile(remindersFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading reminders file:', error);
    return [];
  }
}

// Write reminders to file
async function writeReminders(reminders) {
  try {
    await fs.writeFile(remindersFilePath, JSON.stringify(reminders, null, 2));
  } catch (error) {
    console.error('Error writing reminders file:', error);
    throw error;
  }
}

// Generate a simple ID for new reminders
function generateId() {
  return Date.now().toString();
}

// Generate AI-powered payment reminder message
function generateReminderMessage(order) {
  const outstandingAmount = order.totalOutstanding;
  const orderNumber = order.orderNumber;
  const customerName = order.billingAddress ? 
    `${order.billingAddress.first_name} ${order.billingAddress.last_name}` : 
    'Valued Customer';
  
  const daysSinceOrder = Math.floor((new Date() - new Date(order.createdAt)) / (1000 * 60 * 60 * 24));
  
  let message = '';
  
  if (outstandingAmount === order.totalPrice) {
    // No payment made yet
    if (daysSinceOrder <= 3) {
      message = `Dear ${customerName},\n\nThank you for your order ${orderNumber}. We're excited to fulfill your order and wanted to remind you that payment is still pending.\n\nOutstanding Amount: ${formatCurrency(outstandingAmount, order.currency)}\n\nPlease complete your payment to ensure timely processing and delivery. If you have any questions, don't hesitate to reach out to our support team.\n\nBest regards,\nYour Payment Collection Team`;
    } else if (daysSinceOrder <= 7) {
      message = `Dear ${customerName},\n\nWe hope you're enjoying your recent order ${orderNumber}. We noticed that payment is still outstanding and wanted to follow up.\n\nOutstanding Amount: ${formatCurrency(outstandingAmount, order.currency)}\n\nTo avoid any delays in processing your order, please complete your payment at your earliest convenience. We're here to help if you need any assistance.\n\nThank you for your business!\n\nBest regards,\nYour Payment Collection Team`;
    } else {
      message = `Dear ${customerName},\n\nWe're reaching out regarding your order ${orderNumber} which was placed ${daysSinceOrder} days ago. Payment is still outstanding and we'd appreciate your attention to this matter.\n\nOutstanding Amount: ${formatCurrency(outstandingAmount, order.currency)}\n\nTo ensure we can continue providing you with excellent service, please complete your payment. If you're experiencing any difficulties, please contact us immediately so we can work together to resolve this.\n\nThank you for your prompt attention to this matter.\n\nBest regards,\nYour Payment Collection Team`;
    }
  } else {
    // Partial payment made
    const paidAmount = order.totalPrice - outstandingAmount;
    message = `Dear ${customerName},\n\nThank you for your partial payment of ${formatCurrency(paidAmount, order.currency)} for order ${orderNumber}. We appreciate your commitment to settling this invoice.\n\nRemaining Balance: ${formatCurrency(outstandingAmount, order.currency)}\n\nTo complete your order and avoid any additional processing delays, please settle the remaining balance at your earliest convenience.\n\nIf you have any questions about the outstanding amount, please don't hesitate to contact us.\n\nThank you for your continued business!\n\nBest regards,\nYour Payment Collection Team`;
  }
  
  return message;
}

// Format currency helper function
function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
}

// GET /api/orders/:id/reminders - Get reminders for a specific order
router.get('/:orderId', async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const reminders = await readReminders();
    
    // Filter reminders for this specific order
    const orderReminders = reminders.filter(reminder => reminder.orderId === orderId);
    
    // Sort by sent date (newest first)
    orderReminders.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
    
    res.json(orderReminders);
  } catch (error) {
    console.error('Error fetching reminders:', error);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

// POST /api/orders/:id/reminders - Create a new reminder
router.post('/:orderId', async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { message, via = 'email' } = req.body;
    
    // Validate order exists
    const orders = await readOrders();
    const order = orders.find(o => o.id === orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Generate AI message if not provided
    let reminderMessage = message;
    if (!message) {
      reminderMessage = generateReminderMessage(order);
    }
    
    // Create reminder object
    const newReminder = {
      id: generateId(),
      orderId: orderId,
      message: reminderMessage,
      sentAt: new Date().toISOString(),
      via: via
    };
    
    // Add to reminders array
    const reminders = await readReminders();
    reminders.push(newReminder);
    
    // Write back to file
    await writeReminders(reminders);
    
    res.status(201).json(newReminder);
  } catch (error) {
    console.error('Error creating reminder:', error);
    res.status(500).json({ error: 'Failed to create reminder' });
  }
});

module.exports = router; 