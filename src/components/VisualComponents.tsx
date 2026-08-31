import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Heart } from 'lucide-react';

export function AnimatedHeart() {
  const [bpm, setBpm] = useState(72);
  
  useEffect(() => {
    const i = setInterval(() => {
      setBpm(60 + Math.floor(Math.random() * 30));
    }, 2000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-center p-8 h-full">
      {/* Glow effect behind heart */}
      <div className="absolute inset-0 bg-[#C4453D] opacity-10 blur-3xl rounded-full animate-pulse" />
      
      <motion.div
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ 
          duration: 60 / bpm, 
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="relative z-10 mb-4"
      >
        <Heart 
          size={64} 
          className="text-[#C4453D] drop-shadow-[0_0_15px_rgba(196,69,61,0.5)]" 
          fill="currentColor"
        />
      </motion.div>
      
      <div className="font-mono text-xl font-bold text-[#C4453D]">
        {bpm} <span className="text-xs text-[#9A9A9A]">BPM</span>
      </div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#9A9A9A] mt-1">Live Vitals Simulator</div>
    </div>
  );
}

export function FleetMap() {
  // A stylized pseudo-map using scattered dots
  const [nodes, setNodes] = useState(
    Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      status: Math.random() > 0.9 ? 'alarm' : Math.random() > 0.7 ? 'offline' : 'online'
    }))
  );

  return (
    <div className="relative w-full h-full min-h-[200px] overflow-hidden flex items-center justify-center bg-[#0a0a0a]">
      {/* Simulated Map Background */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '20px 20px'
      }} />
      
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <Activity size={14} className="text-[#1B7A6E]" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#1B7A6E]">Global Fleet Map</span>
      </div>

      {nodes.map(node => (
        <motion.div
          key={node.id}
          className={`absolute w-1.5 h-1.5 rounded-full ${
            node.status === 'alarm' ? 'bg-[#C4453D] shadow-[0_0_10px_#C4453D]' :
            node.status === 'offline' ? 'bg-[#555]' : 'bg-[#1B7A6E] shadow-[0_0_8px_#1B7A6E]'
          }`}
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
          animate={node.status === 'alarm' ? { scale: [1, 2, 1], opacity: [1, 0.5, 1] } : { opacity: [0.8, 1, 0.8] }}
          transition={{ duration: node.status === 'alarm' ? 1 : 2, repeat: Infinity }}
        />
      ))}
    </div>
  );
}

export function MockTerminal() {
  const [logs, setLogs] = useState<string[]>([
    '> INIT SYSTEM... OK',
    '> BINDING TO PORT 8443... OK',
    '> LISTENING FOR TELEMETRY...'
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      const devices = ['DEV-0198', 'DEV-2234', 'DEV-9912', 'DEV-4451'];
      const actions = ['RCV_PKT', 'SYNC_OK', 'HB_ACK', 'CALIBRATE'];
      const d = devices[Math.floor(Math.random() * devices.length)];
      const a = actions[Math.floor(Math.random() * actions.length)];
      const ms = new Date().toISOString().split('T')[1].slice(0, -1);
      
      setLogs(prev => {
        const newLogs = [...prev, `[${ms}] ${a} from ${d}`];
        if (newLogs.length > 20) return newLogs.slice(newLogs.length - 20);
        return newLogs;
      });
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-48 bg-black border border-[#262626] rounded-sm p-4 font-mono text-[10px] text-[#3ADB8F] overflow-hidden flex flex-col justify-end relative shadow-inner">
      <div className="absolute top-2 right-2 flex gap-1.5">
        <div className="w-2 h-2 rounded-full bg-[#C4453D]"></div>
        <div className="w-2 h-2 rounded-full bg-[#D99B3F]"></div>
        <div className="w-2 h-2 rounded-full bg-[#1B7A6E]"></div>
      </div>
      {logs.map((log, i) => (
        <div key={i} className="opacity-80 hover:opacity-100 transition-opacity">
          {log}
        </div>
      ))}
    </div>
  );
}

export function AIHealthTrends() {
  const trends = [
    { text: "Anomaly detected in QRS complex for 12% of fleet", severity: "warning" },
    { text: "Battery degradation pattern identified in DEV-01xx series", severity: "info" },
    { text: "Overall fleet signal quality improved by 4.2% this week", severity: "success" }
  ];

  return (
    <div className="w-full h-full p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Activity size={18} className="text-[#1B7A6E]" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-light-text dark:text-dark-text">AI Health Insights</h3>
        </div>
        <p className="text-[11px] text-[#9A9A9A] mb-6 leading-relaxed">
          The Pulse AI engine is actively analyzing telemetry across your fleet to identify patterns and potential issues before they become critical.
        </p>
        
        <div className="flex flex-col gap-3">
          {trends.map((trend, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-100 dark:border-[#262626] rounded-sm">
              <div className={`mt-0.5 shrink-0 w-2 h-2 rounded-full ${
                trend.severity === 'warning' ? 'bg-[#D99B3F]' : 
                trend.severity === 'info' ? 'bg-[#7C8A94]' : 
                'bg-[#1B7A6E]'
              }`} />
              <span className="text-xs font-medium text-light-text dark:text-[#F2F2F2]">{trend.text}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-[#262626] flex items-center justify-between">
        <span className="text-[10px] font-mono text-[#9A9A9A]">Model: PulseAI-v4.2</span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#1B7A6E] px-2 py-1 bg-[#1B7A6E]/10 rounded-sm border border-[#1B7A6E]/20">Active</span>
      </div>
    </div>
  );
}
