const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// Settings file path
const settingsFilePath = path.join(__dirname, '..', 'data', 'settings.json');

// Default settings
const defaultSettings = {
  reminders: {
    daysBeforeFirstReminder: 3,
    reminderFrequency: 3,
    customEmailTemplate: {
      subject: "Payment Reminder - Order {{orderNumber}}",
      body: `Dear {{customerName}},

We hope this message finds you well. This is a friendly reminder that payment for your order {{orderNumber}} is currently outstanding.

Order Details:
- Order Number: {{orderNumber}}
- Total Amount: {{totalAmount}}
- Outstanding Amount: {{outstandingAmount}}
- Due Date: {{dueDate}}

Please complete your payment at your earliest convenience. If you have any questions or need assistance, please don't hesitate to contact us.

Thank you for your business.

Best regards,
{{companyName}}`
    },
    companyName: "Your Company Name",
    enableAutoReminders: true,
    maxRemindersPerOrder: 5
  }
};

// Read settings from file
async function readSettings() {
  try {
    const data = await fs.readFile(settingsFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, create it with default settings
    if (error.code === 'ENOENT') {
      await writeSettings(defaultSettings);
      return defaultSettings;
    }
    console.error('Error reading settings file:', error);
    return defaultSettings;
  }
}

// Write settings to file
async function writeSettings(settings) {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(settingsFilePath);
    await fs.mkdir(dataDir, { recursive: true });
    
    await fs.writeFile(settingsFilePath, JSON.stringify(settings, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing settings file:', error);
    return false;
  }
}

// GET /api/settings/reminders - Get reminder settings
router.get('/reminders', async (req, res) => {
  try {
    const settings = await readSettings();
    res.json(settings.reminders);
  } catch (error) {
    console.error('Error fetching reminder settings:', error);
    res.status(500).json({ error: 'Failed to fetch reminder settings' });
  }
});

// POST /api/settings/reminders - Update reminder settings
router.post('/reminders', async (req, res) => {
  try {
    const newSettings = req.body;
    
    // Validate required fields
    if (typeof newSettings.daysBeforeFirstReminder !== 'number' || newSettings.daysBeforeFirstReminder < 0) {
      return res.status(400).json({ error: 'daysBeforeFirstReminder must be a positive number' });
    }
    
    if (typeof newSettings.reminderFrequency !== 'number' || newSettings.reminderFrequency < 1) {
      return res.status(400).json({ error: 'reminderFrequency must be at least 1' });
    }
    
    if (typeof newSettings.maxRemindersPerOrder !== 'number' || newSettings.maxRemindersPerOrder < 1) {
      return res.status(400).json({ error: 'maxRemindersPerOrder must be at least 1' });
    }
    
    if (!newSettings.customEmailTemplate || !newSettings.customEmailTemplate.subject || !newSettings.customEmailTemplate.body) {
      return res.status(400).json({ error: 'Email template must include subject and body' });
    }
    
    // Read current settings
    const currentSettings = await readSettings();
    
    // Update reminder settings
    currentSettings.reminders = {
      ...currentSettings.reminders,
      ...newSettings,
      updatedAt: new Date().toISOString()
    };
    
    // Write updated settings
    const success = await writeSettings(currentSettings);
    
    if (success) {
      res.json({
        message: 'Reminder settings updated successfully',
        settings: currentSettings.reminders
      });
    } else {
      res.status(500).json({ error: 'Failed to save settings' });
    }
  } catch (error) {
    console.error('Error updating reminder settings:', error);
    res.status(500).json({ error: 'Failed to update reminder settings' });
  }
});

// GET /api/settings - Get all settings
router.get('/', async (req, res) => {
  try {
    const settings = await readSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// POST /api/settings/reset - Reset settings to defaults
router.post('/reset', async (req, res) => {
  try {
    const success = await writeSettings(defaultSettings);
    
    if (success) {
      res.json({
        message: 'Settings reset to defaults successfully',
        settings: defaultSettings
      });
    } else {
      res.status(500).json({ error: 'Failed to reset settings' });
    }
  } catch (error) {
    console.error('Error resetting settings:', error);
    res.status(500).json({ error: 'Failed to reset settings' });
  }
});

module.exports = router; 