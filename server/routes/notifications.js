const express = require('express');
const router = express.Router();
const notificationService = require('../services/notificationService');
const notificationScheduler = require('../services/notificationScheduler');

// Get notification settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await notificationService.loadSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error loading notification settings:', error);
    res.status(500).json({ error: 'Failed to load notification settings' });
  }
});

// Update notification settings
router.post('/settings', async (req, res) => {
  try {
    const settings = req.body;
    await notificationService.saveSettings(settings);
    res.json({ message: 'Notification settings updated successfully' });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({ error: 'Failed to update notification settings' });
  }
});

// Get notification logs with filters
router.get('/logs', async (req, res) => {
  try {
    const filters = {
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      type: req.query.type,
      channel: req.query.channel,
      status: req.query.status
    };

    const logs = await notificationService.getAllNotificationLogs(filters);
    res.json(logs);
  } catch (error) {
    console.error('Error loading notification logs:', error);
    res.status(500).json({ error: 'Failed to load notification logs' });
  }
});

// Send manual reminder for specific order
router.post('/send-now', async (req, res) => {
  try {
    const { orderId, type, channel } = req.body;
    
    if (!orderId || !type || !channel) {
      return res.status(400).json({ 
        error: 'Missing required fields: orderId, type, channel' 
      });
    }

    const notification = await notificationService.sendManualReminder(orderId, type, channel);
    
    if (notification) {
      res.json({ 
        message: 'Reminder sent successfully', 
        notification 
      });
    } else {
      res.status(404).json({ error: 'Order not found' });
    }
  } catch (error) {
    console.error('Error sending manual reminder:', error);
    res.status(500).json({ error: 'Failed to send reminder' });
  }
});

// Get notification statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await notificationService.getNotificationStats();
    res.json(stats);
  } catch (error) {
    console.error('Error loading notification stats:', error);
    res.status(500).json({ error: 'Failed to load notification statistics' });
  }
});

// Start notification scheduler
router.post('/scheduler/start', (req, res) => {
  try {
    notificationScheduler.start();
    res.json({ message: 'Notification scheduler started successfully' });
  } catch (error) {
    console.error('Error starting notification scheduler:', error);
    res.status(500).json({ error: 'Failed to start notification scheduler' });
  }
});

// Stop notification scheduler
router.post('/scheduler/stop', (req, res) => {
  try {
    notificationScheduler.stop();
    res.json({ message: 'Notification scheduler stopped successfully' });
  } catch (error) {
    console.error('Error stopping notification scheduler:', error);
    res.status(500).json({ error: 'Failed to stop notification scheduler' });
  }
});

// Get scheduler status
router.get('/scheduler/status', (req, res) => {
  try {
    const status = notificationScheduler.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting scheduler status:', error);
    res.status(500).json({ error: 'Failed to get scheduler status' });
  }
});

// Run notifications immediately
router.post('/scheduler/run-now', async (req, res) => {
  try {
    await notificationScheduler.runNow();
    res.json({ message: 'Notifications sent successfully' });
  } catch (error) {
    console.error('Error running notifications:', error);
    res.status(500).json({ error: 'Failed to run notifications' });
  }
});

// Retry failed notifications
router.post('/retry-failed', async (req, res) => {
  try {
    const { notificationId } = req.body;
    
    if (!notificationId) {
      return res.status(400).json({ error: 'Missing notificationId' });
    }

    // Get all orders and find the failed notification
    const orders = await notificationService.loadOrders();
    let retryResult = null;

    for (const order of orders) {
      if (order.notificationLog) {
        const failedNotification = order.notificationLog.find(n => 
          n.id === notificationId && n.status === 'failed'
        );

        if (failedNotification) {
          // Retry the notification
          const retryNotification = await notificationService.sendManualReminder(
            order.id, 
            failedNotification.type, 
            failedNotification.channel
          );

          if (retryNotification) {
            retryResult = retryNotification;
            break;
          }
        }
      }
    }

    if (retryResult) {
      res.json({ 
        message: 'Notification retried successfully', 
        notification: retryResult 
      });
    } else {
      res.status(404).json({ error: 'Failed notification not found' });
    }
  } catch (error) {
    console.error('Error retrying failed notification:', error);
    res.status(500).json({ error: 'Failed to retry notification' });
  }
});

module.exports = router; 