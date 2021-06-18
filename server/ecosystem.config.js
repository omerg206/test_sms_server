module.exports = {
  apps: [{
    name: "sms",
    script: "index.js",
    instances: 0,
    exec_mode: "cluster",
    "env": {
      "PORT": "3000" // the port on which the app should listen
    }
  }],

  deploy: {
    production: {
      user: 'SSH_USERNAME',
      host: 'SSH_HOSTMACHINE',
      ref: 'origin/master',
      repo: 'GIT_REPOSITORY',
      path: 'DESTINATION_PATH',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
