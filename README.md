# Payment Collection Assistant

A MERN-like application for managing and tracking payment collections from Shopify orders.

## 🚀 Features

- **Order Management**: Import and view Shopify orders
- **Payment Tracking**: Monitor outstanding payments and financial status
- **Modern UI**: Clean, responsive interface built with React
- **RESTful API**: Node.js/Express backend with PostgreSQL database

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## 🛠️ Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd payment-collection-assistant
```

### 2. Backend Setup
```bash
cd server
npm install
npm run dev
```

The server will start on `http://localhost:5000`

### 3. Frontend Setup
```bash
cd client
npm install
npm start
```

The React app will start on `http://localhost:3000`

## 📊 Data Storage

The application uses file-based storage:
- `server/data/orders.json` - Contains all order data in JSON format
- Data is automatically created and managed by the application

## 🔌 API Endpoints

### Orders
- `GET /api/orders` - Get all orders
- `POST /api/orders` - Create order from Shopify JSON
- `GET /api/orders/:id` - Get specific order details (Phase 2)

### Health Check
- `GET /health` - API health status

## 🧪 Testing the API

You can test the API using the provided sample data:

```bash
# Test creating an order
curl -X POST http://localhost:5000/api/orders \
  -H "Content-Type: application/json" \
  -d @sample-shopify-order.json

# Test getting all orders
curl http://localhost:5000/api/orders
```

## 📱 Frontend Features

- **Orders List**: View all orders in a responsive table
- **Status Indicators**: Visual status badges for order and financial status
- **Currency Formatting**: Proper currency display
- **Responsive Design**: Works on desktop and mobile devices

## 🏗️ Project Structure

```
payment-collection-assistant/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   └── App.js         # Main app component
├── server/                 # Node.js backend
│   ├── data/              # Data storage
│   │   └── orders.json    # Orders data file
│   ├── routes/            # API routes
│   └── server.js          # Main server file
└── sample-shopify-order.json  # Sample data for testing
```

## 🔄 Development

### Backend Development
```bash
cd server
npm run dev  # Uses nodemon for auto-restart
```

### Frontend Development
```bash
cd client
npm start    # Starts development server with hot reload
```

## 📈 Next Phases

This is Phase 1 of the Payment Collection Assistant. Future phases will include:

- **Phase 2**: Order details view with billing address and line items
- **Phase 3**: Payment reminder system with AI-generated messages
- **Phase 4**: AI-powered insights and advanced search/filtering
- **Phase 5**: Customer-facing payment page

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License. 