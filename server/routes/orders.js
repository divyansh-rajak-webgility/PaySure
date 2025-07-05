const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// Data file path
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

// Write orders to file
async function writeOrders(orders) {
  try {
    await fs.writeFile(ordersFilePath, JSON.stringify(orders, null, 2));
  } catch (error) {
    console.error('Error writing orders file:', error);
    throw error;
  }
}

// Generate a simple ID for new orders
function generateId() {
  return Date.now().toString();
}

// GET /api/orders - Get all orders with search and filtering
router.get('/', async (req, res) => {
  try {
    const { status, email, dateFrom, dateTo } = req.query;
    let orders = await readOrders();
    
    // Apply filters
    if (status) {
      orders = orders.filter(order => 
        order.status.toLowerCase() === status.toLowerCase() ||
        order.financialStatus.toLowerCase() === status.toLowerCase()
      );
    }
    
    if (email) {
      orders = orders.filter(order => 
        order.email && order.email.toLowerCase().includes(email.toLowerCase())
      );
    }
    
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      orders = orders.filter(order => new Date(order.createdAt) >= fromDate);
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      orders = orders.filter(order => new Date(order.createdAt) <= toDate);
    }
    
    // Return only the fields needed for the frontend table
    const ordersList = orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      name: order.name,
      email: order.email,
      status: order.status,
      financialStatus: order.financialStatus,
      totalPrice: order.totalPrice,
      totalOutstanding: order.totalOutstanding,
      currency: order.currency,
      createdAt: order.createdAt
    }));

    res.json(ordersList);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/orders/:id - Get specific order details
router.get('/:id', async (req, res) => {
  try {
    const orderId = req.params.id;
    const orders = await readOrders();
    
    const order = orders.find(o => o.id === orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ error: 'Failed to fetch order details' });
  }
});

// POST /api/orders - Create order from Shopify JSON
router.post('/', async (req, res) => {
  try {
    const shopifyOrder = req.body;
    
    // Validate required fields
    if (!shopifyOrder.id || !shopifyOrder.order_number) {
      return res.status(400).json({ error: 'Missing required fields: id and order_number' });
    }

    const orders = await readOrders();

    // Check if order already exists
    const existingOrder = orders.find(order => order.shopifyOrderId === shopifyOrder.id);
    if (existingOrder) {
      return res.status(409).json({ error: 'Order already exists' });
    }

    // Create order object
    const newOrder = {
      id: generateId(),
      shopifyOrderId: shopifyOrder.id,
      orderNumber: shopifyOrder.order_number,
      name: shopifyOrder.name,
      email: shopifyOrder.email,
      phone: shopifyOrder.phone,
      status: shopifyOrder.fulfillment_status || 'unfulfilled',
      financialStatus: shopifyOrder.financial_status || 'pending',
      totalPrice: parseFloat(shopifyOrder.total_price) || 0,
      subtotalPrice: parseFloat(shopifyOrder.subtotal_price) || 0,
      totalTax: parseFloat(shopifyOrder.total_tax) || 0,
      totalDiscounts: parseFloat(shopifyOrder.total_discounts) || 0,
      totalOutstanding: parseFloat(shopifyOrder.total_price) || 0, // Initially same as total price
      currency: shopifyOrder.currency || 'USD',
      createdAt: shopifyOrder.created_at || new Date().toISOString(),
      updatedAt: shopifyOrder.updated_at || new Date().toISOString(),
      processedAt: shopifyOrder.processed_at || null,
      cancelledAt: shopifyOrder.cancelled_at || null,
      cancelReason: shopifyOrder.cancel_reason,
      note: shopifyOrder.note,
      lineItems: shopifyOrder.line_items || [],
      taxLines: shopifyOrder.tax_lines || [],
      fulfillments: shopifyOrder.fulfillments || [],
      billingAddress: shopifyOrder.billing_address || null
    };

    // Add the new order to the array
    orders.push(newOrder);

    // Write back to file
    await writeOrders(orders);

    res.status(201).json(newOrder);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

module.exports = router; 