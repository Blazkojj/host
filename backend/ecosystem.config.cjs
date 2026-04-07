module.exports = {
  apps: [
    {
      name: "hostpanel-backend",
      script: "./src/index.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
