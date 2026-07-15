const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');

const apiRoutes = require('./routes/apiRoutes');
const { errorHandler, notFound } = require('./middlewares/errorHandler');
const swaggerSpecs = require('./swagger/swaggerOptions');

const app = express();

// Security Middlewares
app.use(helmet());
app.disable('x-powered-by');

// CORS
app.use(cors());

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting (Theo chuẩn TMDB: ~50 requests / 1 giây)
const limiter = rateLimit({
  windowMs: 1000, // 1 giây
  max: 50, // giới hạn mỗi IP tối đa 50 requests mỗi giây
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});
app.use(limiter);

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// Routes
app.use('/', apiRoutes);

// Error Handling
app.use(notFound);
app.use(errorHandler);

module.exports = app;
