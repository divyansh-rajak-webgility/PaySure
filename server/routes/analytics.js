const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// Data file paths
const ordersFilePath = path.join(__dirname, '..', 'data', 'orders.json');

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

// GET /api/analytics/dashboard - Get comprehensive dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    const orders = await readOrders();
    
    // Basic metrics
    const totalOrders = orders.length;
    const paidOrders = orders.filter(o => o.totalOutstanding === 0).length;
    const unpaidOrders = orders.filter(o => o.totalOutstanding > 0).length;
    const totalRevenue = orders.reduce((sum, o) => sum + o.totalPrice, 0);
    const outstandingAmount = orders.reduce((sum, o) => sum + o.totalOutstanding, 0);
    const collectedAmount = totalRevenue - outstandingAmount;
    
    // Collection rate
    const collectionRate = totalRevenue > 0 ? (collectedAmount / totalRevenue) * 100 : 100;
    
    // Average order value
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    // Payment status breakdown
    const paymentStatusBreakdown = {
      paid: orders.filter(o => o.financialStatus === 'paid').length,
      pending: orders.filter(o => o.financialStatus === 'pending').length,
      partially_paid: orders.filter(o => o.financialStatus === 'partially_paid').length,
      refunded: orders.filter(o => o.financialStatus === 'refunded').length
    };
    
    // Fulfillment status breakdown
    const fulfillmentStatusBreakdown = {
      fulfilled: orders.filter(o => o.status === 'fulfilled').length,
      unfulfilled: orders.filter(o => o.status === 'unfulfilled').length,
      partial: orders.filter(o => o.status === 'partial').length
    };
    
    // Monthly trends (last 6 months)
    const monthlyData = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
      const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      
      const monthOrders = orders.filter(o => {
        const orderDate = new Date(o.createdAt);
        return orderDate >= monthStart && orderDate <= monthEnd;
      });
      
      const monthRevenue = monthOrders.reduce((sum, o) => sum + o.totalPrice, 0);
      const monthCollected = monthOrders.reduce((sum, o) => sum + (o.totalPrice - o.totalOutstanding), 0);
      
      monthlyData.push({
        month: month.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        orders: monthOrders.length,
        revenue: monthRevenue,
        collected: monthCollected,
        outstanding: monthRevenue - monthCollected
      });
    }
    
    // Top customers by order value
    const customerStats = {};
    orders.forEach(order => {
      if (order.email) {
        if (!customerStats[order.email]) {
          customerStats[order.email] = {
            email: order.email,
            totalOrders: 0,
            totalSpent: 0,
            outstandingAmount: 0
          };
        }
        customerStats[order.email].totalOrders++;
        customerStats[order.email].totalSpent += order.totalPrice;
        customerStats[order.email].outstandingAmount += order.totalOutstanding;
      }
    });
    
    const topCustomers = Object.values(customerStats)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5);
    
    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentOrders = orders.filter(o => new Date(o.createdAt) >= sevenDaysAgo);
    
    // Risk assessment
    const highRiskOrders = orders.filter(o => {
      const daysSinceOrder = Math.floor((new Date() - new Date(o.createdAt)) / (1000 * 60 * 60 * 24));
      return o.totalOutstanding > 0 && daysSinceOrder > 7;
    }).length;
    
    const mediumRiskOrders = orders.filter(o => {
      const daysSinceOrder = Math.floor((new Date() - new Date(o.createdAt)) / (1000 * 60 * 60 * 24));
      return o.totalOutstanding > 0 && daysSinceOrder > 3 && daysSinceOrder <= 7;
    }).length;
    
    res.json({
      overview: {
        totalOrders,
        paidOrders,
        unpaidOrders,
        totalRevenue,
        outstandingAmount,
        collectedAmount,
        collectionRate: Math.round(collectionRate * 100) / 100,
        averageOrderValue: Math.round(averageOrderValue * 100) / 100
      },
      statusBreakdown: {
        payment: paymentStatusBreakdown,
        fulfillment: fulfillmentStatusBreakdown
      },
      monthlyTrends: monthlyData,
      topCustomers,
      recentActivity: {
        ordersCreated: recentOrders.length,
        ordersPaid: recentOrders.filter(o => o.totalOutstanding === 0).length,
        revenueGenerated: recentOrders.reduce((sum, o) => sum + o.totalPrice, 0),
        amountCollected: recentOrders.reduce((sum, o) => sum + (o.totalPrice - o.totalOutstanding), 0)
      },
      riskAssessment: {
        highRisk: highRiskOrders,
        mediumRisk: mediumRiskOrders,
        lowRisk: unpaidOrders - highRiskOrders - mediumRiskOrders
      }
    });
  } catch (error) {
    console.error('Error generating analytics:', error);
    res.status(500).json({ error: 'Failed to generate analytics' });
  }
});

// GET /api/analytics/export - Export orders data for reporting
router.get('/export', async (req, res) => {
  try {
    const orders = await readOrders();
    
    // Format data for export
    const exportData = orders.map(order => ({
      'Order Number': order.orderNumber,
      'Customer Email': order.email || '',
      'Customer Name': order.name || '',
      'Status': order.status,
      'Financial Status': order.financialStatus,
      'Total Price': order.totalPrice,
      'Outstanding Amount': order.totalOutstanding,
      'Currency': order.currency,
      'Created Date': new Date(order.createdAt).toISOString(),
      'Line Items Count': order.lineItems ? order.lineItems.length : 0,
      'Billing Address': order.billingAddress ? `${order.billingAddress.address1}, ${order.billingAddress.city}` : ''
    }));
    
    res.json({
      data: exportData,
      summary: {
        totalOrders: orders.length,
        totalRevenue: orders.reduce((sum, o) => sum + o.totalPrice, 0),
        outstandingAmount: orders.reduce((sum, o) => sum + o.totalOutstanding, 0),
        exportDate: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

module.exports = router; 