const pidusage = require('pidusage');
const os = require('os');
const { spawn } = require('child_process');

class CPUMonitor {
  constructor(threshold = 70, checkInterval = 5000) {
    this.threshold = threshold; // CPU usage threshold (70%)
    this.checkInterval = checkInterval; // Check every 5 seconds
    this.isMonitoring = false;
    this.monitorInterval = null;
    this.restartCallback = null;
  }

  /**
   * Start monitoring CPU usage
   * @param {Function} onRestart - Callback function to execute on server restart
   */
  startMonitoring(onRestart) {
    if (this.isMonitoring) {
      console.log('CPU monitoring is already running');
      return;
    }

    this.restartCallback = onRestart;
    this.isMonitoring = true;
    
    console.log(`Starting CPU monitoring - Threshold: ${this.threshold}%, Check interval: ${this.checkInterval}ms`);

    this.monitorInterval = setInterval(async () => {
      try {
        const cpuUsage = await this.getCPUUsage();
        console.log(`Current CPU Usage: ${cpuUsage.toFixed(2)}%`);

        if (cpuUsage >= this.threshold) {
          console.warn(`⚠️  CPU usage exceeded threshold! Current: ${cpuUsage.toFixed(2)}%, Threshold: ${this.threshold}%`);
          console.log('🔄 Initiating server restart...');
          
          this.stopMonitoring();
          
          if (this.restartCallback) {
            await this.restartCallback();
          } else {
            await this.restartServer();
          }
        }
      } catch (error) {
        console.error('Error monitoring CPU:', error);
      }
    }, this.checkInterval);
  }

  /**
   * Stop monitoring CPU usage
   */
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.isMonitoring = false;
    console.log('CPU monitoring stopped');
  }

  /**
   * Get current CPU usage percentage
   * @returns {Promise<number>} CPU usage percentage
   */
  async getCPUUsage() {
    try {
      // Get CPU usage for current process
      const stats = await pidusage(process.pid);
      
      // pidusage returns CPU usage in percentage
      return stats.cpu;
    } catch (error) {
      // Fallback to system-wide CPU usage
      console.warn('pidusage failed, using system CPU load:', error.message);
      return this.getSystemCPUUsage();
    }
  }

  /**
   * Get system-wide CPU usage (fallback method)
   * @returns {number} CPU usage percentage
   */
  getSystemCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);
    
    return usage;
  }

  /**
   * Restart the server
   */
  async restartServer() {
    return new Promise((resolve, reject) => {
      console.log('Restarting server...');
      
      // Get the current script path
      const scriptPath = process.argv[1] || './server.js';
      const nodePath = process.execPath;
      
      // Spawn a new process to restart
      const child = spawn(nodePath, [scriptPath], {
        detached: true,
        stdio: 'inherit',
        env: process.env
      });

      child.unref();

      // Give the new process a moment to start
      setTimeout(() => {
        console.log('✅ New server process started. Exiting current process...');
        process.exit(0);
      }, 1000);
    });
  }

  /**
   * Get current CPU usage (synchronous getter)
   * @returns {Promise<number>} Current CPU usage
   */
  async getCurrentUsage() {
    return await this.getCPUUsage();
  }
}

module.exports = CPUMonitor;

