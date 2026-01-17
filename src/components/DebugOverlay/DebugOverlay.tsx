import { useState, useEffect } from 'react';
import './DebugOverlay.css';

interface DebugLog {
  id: number;
  message: string;
  timestamp: number;
  type: 'click' | 'longpress' | 'event';
}

let logId = 0;
const logs: DebugLog[] = [];
let updateCallback: (() => void) | null = null;

// Intercept console.log
const originalLog = console.log;
console.log = (...args: any[]) => {
  originalLog(...args);
  
  const message = args.join(' ');
  
  // Only show our debug messages
  if (message.includes('🔵') || message.includes('🟡') || message.includes('[LongPress')) {
    let type: 'click' | 'longpress' | 'event' = 'event';
    if (message.includes('🔵')) type = 'click';
    if (message.includes('🟡')) type = 'longpress';
    
    logs.push({
      id: logId++,
      message,
      timestamp: Date.now(),
      type
    });
    
    // Keep only last 10 logs
    if (logs.length > 10) logs.shift();
    
    // Trigger update
    if (updateCallback) updateCallback();
  }
};

export default function DebugOverlay() {
  const [, setUpdateTrigger] = useState(0);
  
  useEffect(() => {
    updateCallback = () => setUpdateTrigger(prev => prev + 1);
    return () => {
      updateCallback = null;
    };
  }, []);
  
  return (
    <div className="debug-overlay">
      <div className="debug-header">🐛 Debug Log</div>
      <div className="debug-logs">
        {logs.map(log => (
          <div key={log.id} className={`debug-log debug-log-${log.type}`}>
            {log.message}
          </div>
        ))}
      </div>
    </div>
  );
}