const swaggerJsdoc = require('swagger-jsdoc');
const config = require('../config/config');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TMDB Integration API',
      version: '1.0.0',
      description: 'API to fetch and normalize data from The Movie Database (TMDB) for the Movie Booking System.',
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server',
      },
    ]
  },
  apis: ['./src/swagger/docs/*.yaml'], // paths to files containing swagger annotations
};

const swaggerDocs = swaggerJsdoc(options);

module.exports = swaggerDocs;
