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

// GET /api/reports/receivables - Get accounts receivable report
router.get('/receivables', async (req, res) => {
  try {
    const { type } = req.query; // 'b2b', 'b2c', or undefined for all
    const orders = await readOrders();
    
    // Group orders by customer
    const customerGroups = {};
    
    orders.forEach(order => {
      // Determine customer identifier (email or billing address)
      let customerKey = order.email || 'unknown';
      let customerName = order.name || 'Unknown Customer';
      let isB2B = false;
      
      // Check if it's B2B based on billing address company
      if (order.billingAddress && order.billingAddress.company) {
        customerKey = order.billingAddress.company;
        customerName = order.billingAddress.company;
        isB2B = true;
      }
      
      // Filter by type if specified
      if (type === 'b2b' && !isB2B) return;
      if (type === 'b2c' && isB2B) return;
      
      if (!customerGroups[customerKey]) {
        customerGroups[customerKey] = {
          customerKey,
          customerName,
          email: order.email || '',
          isB2B,
          billingAddress: order.billingAddress || null,
          totalOrders: 0,
          totalValue: 0,
          totalPaid: 0,
          totalOutstanding: 0,
          orders: []
        };
      }
      
      const customer = customerGroups[customerKey];
      customer.totalOrders++;
      customer.totalValue += order.totalPrice;
      customer.totalOutstanding += order.totalOutstanding;
      customer.totalPaid = customer.totalValue - customer.totalOutstanding;
      
      // Add order details
      customer.orders.push({
        id: order.id,
        orderNumber: order.orderNumber,
        totalPrice: order.totalPrice,
        totalOutstanding: order.totalOutstanding,
        status: order.status,
        financialStatus: order.financialStatus,
        createdAt: order.createdAt,
        currency: order.currency
      });
    });
    
    // Convert to array and sort by outstanding amount (highest first)
    const customers = Object.values(customerGroups)
      .filter(customer => customer.totalOutstanding > 0) // Only show customers with outstanding amounts
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding);
    
    // Calculate summary statistics
    const summary = {
      totalCustomers: customers.length,
      totalOutstanding: customers.reduce((sum, c) => sum + c.totalOutstanding, 0),
      totalValue: customers.reduce((sum, c) => sum + c.totalValue, 0),
      totalPaid: customers.reduce((sum, c) => sum + c.totalPaid, 0),
      b2bCustomers: customers.filter(c => c.isB2B).length,
      b2cCustomers: customers.filter(c => !c.isB2B).length
    };
    
    res.json({
      customers,
      summary,
      filters: {
        type: type || 'all',
        appliedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error generating receivables report:', error);
    res.status(500).json({ error: 'Failed to generate receivables report' });
  }
});

// GET /api/reports/receivables/:customerKey - Get detailed orders for a specific customer
router.get('/receivables/:customerKey', async (req, res) => {
  try {
    const { customerKey } = req.params;
    const orders = await readOrders();
    
    // Find all orders for this customer
    const customerOrders = orders.filter(order => {
      if (order.billingAddress && order.billingAddress.company === customerKey) {
        return true;
      }
      if (order.email === customerKey) {
        return true;
      }
      return false;
    });
    
    if (customerOrders.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Get customer info from first order
    const firstOrder = customerOrders[0];
    const customerInfo = {
      customerKey,
      customerName: firstOrder.billingAddress?.company || firstOrder.name || 'Unknown Customer',
      email: firstOrder.email || '',
      isB2B: !!(firstOrder.billingAddress && firstOrder.billingAddress.company),
      billingAddress: firstOrder.billingAddress || null
    };
    
    // Calculate totals
    const totals = customerOrders.reduce((acc, order) => {
      acc.totalOrders++;
      acc.totalValue += order.totalPrice;
      acc.totalOutstanding += order.totalOutstanding;
      return acc;
    }, {
      totalOrders: 0,
      totalValue: 0,
      totalOutstanding: 0
    });
    
    totals.totalPaid = totals.totalValue - totals.totalOutstanding;
    
    res.json({
      customerInfo,
      totals,
      orders: customerOrders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        totalPrice: order.totalPrice,
        totalOutstanding: order.totalOutstanding,
        status: order.status,
        financialStatus: order.financialStatus,
        createdAt: order.createdAt,
        currency: order.currency,
        lineItems: order.lineItems || []
      }))
    });
  } catch (error) {
    console.error('Error fetching customer details:', error);
    res.status(500).json({ error: 'Failed to fetch customer details' });
  }
});

module.exports = router; 