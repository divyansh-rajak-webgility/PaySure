const fs = require('fs').promises;
const path = require('path');

class NotificationService {
  constructor() {
    this.ordersPath = path.join(__dirname, '../data/orders.json');
    this.settingsPath = path.join(__dirname, '../data/notificationSettings.json');
  }

  async loadOrders() {
    try {
      const data = await fs.readFile(this.ordersPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading orders:', error);
      return [];
    }
  }

  async loadSettings() {
    try {
      const data = await fs.readFile(this.settingsPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading notification settings:', error);
      return null;
    }
  }

  async saveOrders(orders) {
    try {
      await fs.writeFile(this.ordersPath, JSON.stringify(orders, null, 2));
    } catch (error) {
      console.error('Error saving orders:', error);
    }
  }

  async saveSettings(settings) {
    try {
      await fs.writeFile(this.settingsPath, JSON.stringify(settings, null, 2));
    } catch (error) {
      console.error('Error saving notification settings:', error);
    }
  }

  processTemplate(template, data) {
    let processed = template;
    Object.keys(data).forEach(key => {
      const placeholder = `{{${key}}}`;
      processed = processed.replace(new RegExp(placeholder, 'g'), data[key]);
    });
    return processed;
  }

  generateNotificationId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async sendEmailNotification(order, template, settings) {
    // Mock email sending - in production, integrate with Nodemailer or SendGrid
    const emailData = {
      customer_name: order.name,
      order_number: order.orderNumber,
      amount_due: `$${order.totalOutstanding.toFixed(2)}`,
      due_date: new Date(order.dueDate).toLocaleDateString(),
      payment_link: `https://yourstore.com/pay/${order.id}`,
      store_name: 'Your Store'
    };

    const subject = this.processTemplate(template.subject, emailData);
    const body = this.processTemplate(template.body, emailData);

    console.log(`📧 Email sent to ${order.email}:`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${body}`);

    // Simulate delivery status
    const status = Math.random() > 0.1 ? 'delivered' : 'failed';
    
    return {
      id: this.generateNotificationId(),
      type: template.type,
      channel: 'email',
      status: status,
      timestamp: new Date().toISOString(),
      message: body,
      subject: subject,
      recipient: order.email
    };
  }

  async sendWhatsAppNotification(order, template, settings) {
    // Mock WhatsApp sending - in production, integrate with Twilio or Meta Cloud API
    const whatsappData = {
      customer_name: order.name,
      order_number: order.orderNumber,
      amount_due: `$${order.totalOutstanding.toFixed(2)}`,
      due_date: new Date(order.dueDate).toLocaleDateString(),
      payment_link: `https://yourstore.com/pay/${order.id}`
    };

    const message = this.processTemplate(template, whatsappData);

    console.log(`📱 WhatsApp sent to ${order.name}:`);
    console.log(`Message: ${message}`);

    // Simulate delivery status
    const statuses = ['sent', 'delivered', 'seen'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    return {
      id: this.generateNotificationId(),
      type: template.type,
      channel: 'whatsapp',
      status: status,
      timestamp: new Date().toISOString(),
      message: message,
      recipient: order.name
    };
  }

  async sendNotification(order, type, channel, settings) {
    const notification = {
      type: type,
      channel: channel
    };

    try {
      if (channel === 'email' && settings.channels.email.enabled) {
        const template = settings.templates.email[type];
        return await this.sendEmailNotification(order, template, settings);
      } else if (channel === 'whatsapp' && settings.channels.whatsapp.enabled) {
        const template = settings.templates.whatsapp[type];
        return await this.sendWhatsAppNotification(order, template, settings);
      }
    } catch (error) {
      console.error(`Error sending ${channel} notification:`, error);
      return {
        id: this.generateNotificationId(),
        type: type,
        channel: channel,
        status: 'failed',
        timestamp: new Date().toISOString(),
        message: 'Failed to send notification',
        error: error.message
      };
    }
  }

  async logNotification(orderId, notification) {
    const orders = await this.loadOrders();
    const orderIndex = orders.findIndex(o => o.id === orderId);
    
    if (orderIndex !== -1) {
      if (!orders[orderIndex].notificationLog) {
        orders[orderIndex].notificationLog = [];
      }
      orders[orderIndex].notificationLog.push(notification);
      await this.saveOrders(orders);
    }
  }

  async sendDueReminders() {
    const orders = await this.loadOrders();
    const settings = await this.loadSettings();
    
    if (!settings) return;

    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(today.getDate() + settings.dueReminderDays);

    const dueOrders = orders.filter(order => {
      if (order.financialStatus === 'paid' || order.totalOutstanding === 0) return false;
      
      const orderDueDate = new Date(order.dueDate);
      const daysUntilDue = Math.ceil((orderDueDate - today) / (1000 * 60 * 60 * 24));
      
      return daysUntilDue <= settings.dueReminderDays && daysUntilDue > 0;
    });

    console.log(`📅 Found ${dueOrders.length} orders due for reminders`);

    for (const order of dueOrders) {
      // Check if we already sent a reminder today
      const todayNotifications = order.notificationLog?.filter(n => {
        const notificationDate = new Date(n.timestamp);
        return n.type === 'due_reminder' && 
               notificationDate.toDateString() === today.toDateString();
      }) || [];

      if (todayNotifications.length === 0) {
        // Send email reminder
        if (settings.channels.email.enabled) {
          const emailNotification = await this.sendNotification(order, 'dueReminder', 'email', settings);
          await this.logNotification(order.id, emailNotification);
        }

        // Send WhatsApp reminder
        if (settings.channels.whatsapp.enabled) {
          const whatsappNotification = await this.sendNotification(order, 'dueReminder', 'whatsapp', settings);
          await this.logNotification(order.id, whatsappNotification);
        }
      }
    }
  }

  async sendOverdueReminders() {
    const orders = await this.loadOrders();
    const settings = await this.loadSettings();
    
    if (!settings) return;

    const today = new Date();

    const overdueOrders = orders.filter(order => {
      if (order.financialStatus === 'paid' || order.totalOutstanding === 0) return false;
      
      const orderDueDate = new Date(order.dueDate);
      return orderDueDate < today;
    });

    console.log(`⚠️ Found ${overdueOrders.length} overdue orders`);

    for (const order of overdueOrders) {
      // Count overdue reminders sent
      const overdueNotifications = order.notificationLog?.filter(n => 
        n.type === 'overdue_reminder'
      ) || [];

      if (overdueNotifications.length < settings.maxOverdueReminders) {
        // Check if we already sent a reminder today
        const todayNotifications = overdueNotifications.filter(n => {
          const notificationDate = new Date(n.timestamp);
          return notificationDate.toDateString() === today.toDateString();
        });

        if (todayNotifications.length === 0) {
          // Send email reminder
          if (settings.channels.email.enabled) {
            const emailNotification = await this.sendNotification(order, 'overdueReminder', 'email', settings);
            await this.logNotification(order.id, emailNotification);
          }

          // Send WhatsApp reminder
          if (settings.channels.whatsapp.enabled) {
            const whatsappNotification = await this.sendNotification(order, 'overdueReminder', 'whatsapp', settings);
            await this.logNotification(order.id, whatsappNotification);
          }
        }
      }
    }
  }

  async sendManualReminder(orderId, type, channel) {
    const orders = await this.loadOrders();
    const settings = await this.loadSettings();
    
    if (!settings) return null;

    const order = orders.find(o => o.id === orderId);
    if (!order) return null;

    const notification = await this.sendNotification(order, type, channel, settings);
    await this.logNotification(orderId, notification);
    
    return notification;
  }

  async getNotificationStats() {
    const orders = await this.loadOrders();
    const today = new Date();
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);

    const stats = {
      totalDue: 0,
      totalOverdue: 0,
      remindersSentToday: 0,
      upcomingReminders: 0
    };

    for (const order of orders) {
      if (order.financialStatus !== 'paid' && order.totalOutstanding > 0) {
        const orderDueDate = new Date(order.dueDate);
        
        if (orderDueDate > today) {
          stats.totalDue += order.totalOutstanding;
          
          // Check if due within 3 days
          if (orderDueDate <= threeDaysFromNow) {
            stats.upcomingReminders++;
          }
        } else {
          stats.totalOverdue += order.totalOutstanding;
        }
      }

      // Count today's notifications
      if (order.notificationLog) {
        const todayNotifications = order.notificationLog.filter(n => {
          const notificationDate = new Date(n.timestamp);
          return notificationDate.toDateString() === today.toDateString();
        });
        stats.remindersSentToday += todayNotifications.length;
      }
    }

    return stats;
  }

  async getAllNotificationLogs(filters = {}) {
    const orders = await this.loadOrders();
    let allLogs = [];

    for (const order of orders) {
      if (order.notificationLog) {
        const orderLogs = order.notificationLog.map(log => ({
          ...log,
          customerName: order.name,
          orderNumber: order.orderNumber,
          orderId: order.id
        }));
        allLogs = allLogs.concat(orderLogs);
      }
    }

    // Apply filters
    if (filters.dateFrom) {
      allLogs = allLogs.filter(log => new Date(log.timestamp) >= new Date(filters.dateFrom));
    }
    if (filters.dateTo) {
      allLogs = allLogs.filter(log => new Date(log.timestamp) <= new Date(filters.dateTo));
    }
    if (filters.type) {
      allLogs = allLogs.filter(log => log.type === filters.type);
    }
    if (filters.channel) {
      allLogs = allLogs.filter(log => log.channel === filters.channel);
    }
    if (filters.status) {
      allLogs = allLogs.filter(log => log.status === filters.status);
    }

    // Sort by timestamp (newest first)
    allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return allLogs;
  }
}

module.exports = new NotificationService(); 