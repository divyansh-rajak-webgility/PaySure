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

// Calculate days since order was created
function getDaysSinceOrder(createdAt) {
  return Math.floor((new Date() - new Date(createdAt)) / (1000 * 60 * 60 * 24));
}

// Calculate risk score for payment delay (0-100)
function calculateRiskScore(order) {
  let score = 0;
  
  // Base score for unpaid orders
  if (order.totalOutstanding > 0) {
    score += 30;
  }
  
  // Days since order (older orders are higher risk)
  const daysSinceOrder = getDaysSinceOrder(order.createdAt);
  if (daysSinceOrder > 7) score += 25;
  else if (daysSinceOrder > 3) score += 15;
  else if (daysSinceOrder > 1) score += 5;
  
  // Partial payments (might indicate payment issues)
  if (order.totalOutstanding > 0 && order.totalOutstanding < order.totalPrice) {
    score += 20;
  }
  
  // High value orders (more likely to have payment issues)
  if (order.totalPrice > 500) score += 15;
  else if (order.totalPrice > 200) score += 10;
  
  // Financial status
  if (order.financialStatus === 'pending') score += 10;
  else if (order.financialStatus === 'partially_paid') score += 15;
  
  return Math.min(score, 100);
}

// GET /api/insights/likely-delay - Get top 5 orders likely to be delayed
router.get('/likely-delay', async (req, res) => {
  try {
    const orders = await readOrders();
    
    // Filter unpaid orders and calculate risk scores
    const unpaidOrders = orders
      .filter(order => order.totalOutstanding > 0)
      .map(order => ({
        ...order,
        riskScore: calculateRiskScore(order),
        daysSinceOrder: getDaysSinceOrder(order.createdAt)
      }))
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 5);
    
    // Add insights for each order
    const ordersWithInsights = unpaidOrders.map(order => {
      let insight = '';
      let recommendation = '';
      
      if (order.riskScore >= 80) {
        insight = 'High Risk - Immediate attention required';
        recommendation = 'Send urgent payment reminder and consider phone follow-up';
      } else if (order.riskScore >= 60) {
        insight = 'Medium-High Risk - Payment likely delayed';
        recommendation = 'Send payment reminder and monitor closely';
      } else if (order.riskScore >= 40) {
        insight = 'Medium Risk - Payment may be delayed';
        recommendation = 'Send gentle payment reminder';
      } else {
        insight = 'Low Risk - Standard follow-up recommended';
        recommendation = 'Send standard payment reminder';
      }
      
      return {
        ...order,
        insight,
        recommendation
      };
    });
    
    res.json({
      orders: ordersWithInsights,
      summary: {
        totalUnpaidOrders: orders.filter(o => o.totalOutstanding > 0).length,
        totalOutstandingAmount: orders
          .filter(o => o.totalOutstanding > 0)
          .reduce((sum, o) => sum + o.totalOutstanding, 0),
        averageRiskScore: ordersWithInsights.length > 0 
          ? Math.round(ordersWithInsights.reduce((sum, o) => sum + o.riskScore, 0) / ordersWithInsights.length)
          : 0
      }
    });
  } catch (error) {
    console.error('Error generating insights:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

// GET /api/insights/dashboard - Get comprehensive dashboard insights
router.get('/dashboard', async (req, res) => {
  try {
    const orders = await readOrders();
    
    const totalOrders = orders.length;
    const paidOrders = orders.filter(o => o.totalOutstanding === 0).length;
    const unpaidOrders = orders.filter(o => o.totalOutstanding > 0).length;
    const totalRevenue = orders.reduce((sum, o) => sum + o.totalPrice, 0);
    const outstandingAmount = orders.reduce((sum, o) => sum + o.totalOutstanding, 0);
    
    // Payment status breakdown
    const statusBreakdown = {
      paid: orders.filter(o => o.financialStatus === 'paid').length,
      pending: orders.filter(o => o.financialStatus === 'pending').length,
      partially_paid: orders.filter(o => o.financialStatus === 'partially_paid').length,
      refunded: orders.filter(o => o.financialStatus === 'refunded').length
    };
    
    // Fulfillment status breakdown
    const fulfillmentBreakdown = {
      fulfilled: orders.filter(o => o.status === 'fulfilled').length,
      unfulfilled: orders.filter(o => o.status === 'unfulfilled').length,
      partial: orders.filter(o => o.status === 'partial').length
    };
    
    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentOrders = orders.filter(o => new Date(o.createdAt) >= sevenDaysAgo);
    
    // Average order value
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    // Collection rate
    const collectionRate = totalRevenue > 0 ? ((totalRevenue - outstandingAmount) / totalRevenue) * 100 : 100;
    
    res.json({
      overview: {
        totalOrders,
        paidOrders,
        unpaidOrders,
        totalRevenue,
        outstandingAmount,
        averageOrderValue,
        collectionRate: Math.round(collectionRate * 100) / 100
      },
      statusBreakdown,
      fulfillmentBreakdown,
      recentActivity: {
        ordersCreated: recentOrders.length,
        ordersPaid: recentOrders.filter(o => o.totalOutstanding === 0).length,
        revenueGenerated: recentOrders.reduce((sum, o) => sum + o.totalPrice, 0)
      },
      topInsights: [
        {
          type: 'warning',
          message: `${unpaidOrders} orders have outstanding payments totaling ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(outstandingAmount)}`
        },
        {
          type: 'info',
          message: `Collection rate is ${Math.round(collectionRate * 100) / 100}%`
        },
        {
          type: 'success',
          message: `Average order value is ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(averageOrderValue)}`
        }
      ]
    });
  } catch (error) {
    console.error('Error generating dashboard insights:', error);
    res.status(500).json({ error: 'Failed to generate dashboard insights' });
  }
});

module.exports = router; 