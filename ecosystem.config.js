
module.exports = {
  apps: [
    {
      name: "lorafilm-tmdb-api",
      script: "./server.js",
      instances: 1,           // Chạy 1 luồng là đủ cho VPS 2GB RAM
      autorestart: true,      // Tự động khởi động lại nếu sập
      watch: false,           // Tắt tính năng watch code trên Production
      max_memory_restart: '1G', // Giới hạn ăn tối đa 1GB RAM, nếu hơn sẽ tự Restart để nhả RAM
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production", // Kích hoạt mode Production giúp app chạy nhanh hơn, ít log hơn
      }
    }
  ]
};
