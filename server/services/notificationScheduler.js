const notificationService = require('./notificationService');

class NotificationScheduler {
  constructor() {
    this.isRunning = false;
    this.interval = null;
  }

  start() {
    if (this.isRunning) {
      console.log('Notification scheduler is already running');
      return;
    }

    console.log('🚀 Starting notification scheduler...');
    this.isRunning = true;

    // Run immediately on start
    this.runScheduledNotifications();

    // Schedule to run daily at 9 AM
    this.interval = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 9 && now.getMinutes() === 0) {
        this.runScheduledNotifications();
      }
    }, 60000); // Check every minute

    console.log('✅ Notification scheduler started successfully');
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log('⏹️ Notification scheduler stopped');
  }

  async runScheduledNotifications() {
    console.log('📅 Running scheduled notifications...');
    
    try {
      // Send due reminders
      console.log('📧 Sending due reminders...');
      await notificationService.sendDueReminders();

      // Send overdue reminders
      console.log('⚠️ Sending overdue reminders...');
      await notificationService.sendOverdueReminders();

      console.log('✅ Scheduled notifications completed');
    } catch (error) {
      console.error('❌ Error running scheduled notifications:', error);
    }
  }

  async runNow() {
    console.log('⚡ Running notifications immediately...');
    await this.runScheduledNotifications();
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      nextRun: this.getNextRunTime()
    };
  }

  getNextRunTime() {
    const now = new Date();
    const nextRun = new Date(now);
    
    if (now.getHours() >= 9) {
      // If it's past 9 AM, schedule for tomorrow
      nextRun.setDate(now.getDate() + 1);
    }
    
    nextRun.setHours(9, 0, 0, 0);
    return nextRun;
  }
}

module.exports = new NotificationScheduler(); 