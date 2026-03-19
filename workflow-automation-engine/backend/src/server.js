const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('express-async-errors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { seedSampleData } = require('./seedSampleData');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
const workflowRoutes = require('./routes/workflows');
const stepRoutes = require('./routes/steps');
const ruleRoutes = require('./routes/rules');
const executionRoutes = require('./routes/executions');

app.use('/api/workflows', workflowRoutes);
app.use('/api', stepRoutes);
app.use('/api', ruleRoutes);
app.use('/api', executionRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/workflow_engine';

mongoose
  .connect(MONGO_URI, {
    autoIndex: true,
  })
  .then(() => {
    console.log('MongoDB connected');
    seedSampleData()
      .then(() => {
        app.listen(PORT, () => {
          console.log(`Server running on port ${PORT}`);
        });
      })
      .catch((err) => {
        console.error('Error seeding sample data', err);
        app.listen(PORT, () => {
          console.log(`Server running on port ${PORT}`);
        });
      });
  })
  .catch((err) => {
    console.error('Mongo connection error', err);
    process.exit(1);
  });

