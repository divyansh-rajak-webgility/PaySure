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

// Simple intent parsing (in a real app, you'd use NLP libraries)
function parseIntent(query) {
  const lowerQuery = query.toLowerCase();
  
  // Check for different intents
  if (lowerQuery.includes('owe') || lowerQuery.includes('outstanding') || lowerQuery.includes('due')) {
    if (lowerQuery.includes('most') || lowerQuery.includes('highest')) {
      return 'highest_outstanding';
    }
    if (lowerQuery.includes('b2b') || lowerQuery.includes('business')) {
      return 'b2b_outstanding';
    }
    if (lowerQuery.includes('b2c') || lowerQuery.includes('customer')) {
      return 'b2c_outstanding';
    }
    return 'total_outstanding';
  }
  
  if (lowerQuery.includes('unpaid') || lowerQuery.includes('pending')) {
    if (lowerQuery.includes('above') || lowerQuery.includes('more than')) {
      return 'unpaid_above_amount';
    }
    if (lowerQuery.includes('last month') || lowerQuery.includes('previous month')) {
      return 'unpaid_last_month';
    }
    return 'unpaid_orders';
  }
  
  if (lowerQuery.includes('customer') || lowerQuery.includes('client')) {
    if (lowerQuery.includes('top') || lowerQuery.includes('best')) {
      return 'top_customers';
    }
    return 'customer_info';
  }
  
  if (lowerQuery.includes('revenue') || lowerQuery.includes('sales')) {
    return 'revenue_info';
  }
  
  if (lowerQuery.includes('collection rate') || lowerQuery.includes('payment rate')) {
    return 'collection_rate';
  }
  
  return 'general_help';
}

// Generate response based on intent
async function generateResponse(intent, query, orders) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  switch (intent) {
    case 'highest_outstanding':
      const highestOutstanding = orders
        .filter(o => o.totalOutstanding > 0)
        .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
        .slice(0, 5);
      
      return {
        text: `Here are the top 5 customers with the highest outstanding amounts:`,
        data: highestOutstanding.map(order => ({
          customer: order.email || order.name || 'Unknown',
          orderNumber: order.orderNumber,
          outstanding: formatCurrency(order.totalOutstanding),
          total: formatCurrency(order.totalPrice)
        }))
      };

    case 'b2b_outstanding':
      const b2bOrders = orders.filter(o => 
        o.totalOutstanding > 0 && 
        o.billingAddress && 
        o.billingAddress.company
      );
      const b2bTotal = b2bOrders.reduce((sum, o) => sum + o.totalOutstanding, 0);
      
      return {
        text: `B2B customers have a total outstanding amount of ${formatCurrency(b2bTotal)} across ${b2bOrders.length} orders.`,
        data: b2bOrders.map(order => ({
          company: order.billingAddress.company,
          orderNumber: order.orderNumber,
          outstanding: formatCurrency(order.totalOutstanding)
        }))
      };

    case 'b2c_outstanding':
      const b2cOrders = orders.filter(o => 
        o.totalOutstanding > 0 && 
        (!o.billingAddress || !o.billingAddress.company)
      );
      const b2cTotal = b2cOrders.reduce((sum, o) => sum + o.totalOutstanding, 0);
      
      return {
        text: `B2C customers have a total outstanding amount of ${formatCurrency(b2cTotal)} across ${b2cOrders.length} orders.`,
        data: b2cOrders.map(order => ({
          customer: order.email || order.name || 'Unknown',
          orderNumber: order.orderNumber,
          outstanding: formatCurrency(order.totalOutstanding)
        }))
      };

    case 'total_outstanding':
      const totalOutstanding = orders.reduce((sum, o) => sum + o.totalOutstanding, 0);
      const unpaidCount = orders.filter(o => o.totalOutstanding > 0).length;
      
      return {
        text: `The total outstanding amount across all customers is ${formatCurrency(totalOutstanding)} from ${unpaidCount} unpaid orders.`,
        data: null
      };

    case 'unpaid_above_amount':
      // Extract amount from query (simple regex for demo)
      const amountMatch = query.match(/\$?(\d+(?:,\d+)*(?:\.\d{2})?)/);
      const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 1000;
      
      const unpaidAbove = orders.filter(o => 
        o.totalOutstanding > 0 && 
        o.totalOutstanding >= amount
      );
      
      return {
        text: `Found ${unpaidAbove.length} unpaid orders with outstanding amounts of ${formatCurrency(amount)} or more:`,
        data: unpaidAbove.map(order => ({
          customer: order.email || order.name || 'Unknown',
          orderNumber: order.orderNumber,
          outstanding: formatCurrency(order.totalOutstanding),
          total: formatCurrency(order.totalPrice)
        }))
      };

    case 'unpaid_last_month':
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const lastMonthStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
      const lastMonthEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
      
      const unpaidLastMonth = orders.filter(o => {
        const orderDate = new Date(o.createdAt);
        return o.totalOutstanding > 0 && 
               orderDate >= lastMonthStart && 
               orderDate <= lastMonthEnd;
      });
      
      const lastMonthTotal = unpaidLastMonth.reduce((sum, o) => sum + o.totalOutstanding, 0);
      
      return {
        text: `Last month, there were ${unpaidLastMonth.length} unpaid orders with a total outstanding amount of ${formatCurrency(lastMonthTotal)}.`,
        data: unpaidLastMonth.map(order => ({
          customer: order.email || order.name || 'Unknown',
          orderNumber: order.orderNumber,
          outstanding: formatCurrency(order.totalOutstanding),
          date: new Date(order.createdAt).toLocaleDateString()
        }))
      };

    case 'unpaid_orders':
      const unpaidOrders = orders.filter(o => o.totalOutstanding > 0);
      const unpaidTotal = unpaidOrders.reduce((sum, o) => sum + o.totalOutstanding, 0);
      
      return {
        text: `There are currently ${unpaidOrders.length} unpaid orders with a total outstanding amount of ${formatCurrency(unpaidTotal)}.`,
        data: unpaidOrders.map(order => ({
          customer: order.email || order.name || 'Unknown',
          orderNumber: order.orderNumber,
          outstanding: formatCurrency(order.totalOutstanding),
          status: order.financialStatus
        }))
      };

    case 'top_customers':
      const customerTotals = {};
      orders.forEach(order => {
        const key = order.email || order.name || 'Unknown';
        if (!customerTotals[key]) {
          customerTotals[key] = { total: 0, orders: 0 };
        }
        customerTotals[key].total += order.totalPrice;
        customerTotals[key].orders++;
      });
      
      const topCustomers = Object.entries(customerTotals)
        .sort(([,a], [,b]) => b.total - a.total)
        .slice(0, 5)
        .map(([customer, data]) => ({
          customer,
          total: formatCurrency(data.total),
          orders: data.orders
        }));
      
      return {
        text: `Here are your top 5 customers by total order value:`,
        data: topCustomers
      };

    case 'revenue_info':
      const totalRevenue = orders.reduce((sum, o) => sum + o.totalPrice, 0);
      const collectedRevenue = orders.reduce((sum, o) => sum + (o.totalPrice - o.totalOutstanding), 0);
      const outstandingRevenue = orders.reduce((sum, o) => sum + o.totalOutstanding, 0);
      
      return {
        text: `Revenue Summary:\n• Total Revenue: ${formatCurrency(totalRevenue)}\n• Collected: ${formatCurrency(collectedRevenue)}\n• Outstanding: ${formatCurrency(outstandingRevenue)}`,
        data: null
      };

    case 'collection_rate':
      const totalRevenue2 = orders.reduce((sum, o) => sum + o.totalPrice, 0);
      const collectedRevenue2 = orders.reduce((sum, o) => sum + (o.totalPrice - o.totalOutstanding), 0);
      const collectionRate = totalRevenue2 > 0 ? (collectedRevenue2 / totalRevenue2) * 100 : 100;
      
      return {
        text: `Your current collection rate is ${collectionRate.toFixed(1)}%. You've collected ${formatCurrency(collectedRevenue2)} out of ${formatCurrency(totalRevenue2)} total revenue.`,
        data: null
      };

    default:
      return {
        text: `I can help you with questions about:\n• Who owes the most money\n• Outstanding amounts for B2B/B2C customers\n• Unpaid orders above a certain amount\n• Revenue and collection rates\n• Top customers by order value\n\nTry asking something like "Who owes me the most?" or "What's the total outstanding for B2B customers?"`,
        data: null
      };
  }
}

// POST /api/ai/assistant - AI Assistant endpoint
router.post('/assistant', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required and must be a string' });
    }
    
    const orders = await readOrders();
    const intent = parseIntent(query);
    const response = await generateResponse(intent, query, orders);
    
    res.json({
      query,
      intent,
      response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error processing AI assistant query:', error);
    res.status(500).json({ error: 'Failed to process query' });
  }
});

module.exports = router; 