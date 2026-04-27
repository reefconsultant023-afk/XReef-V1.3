import React from 'react';
import Spline from '@splinetool/react-spline';

/**
 * Scene3D component displays an interactive 3D scene from Spline.
 * Used to enhance the visual appeal of the main landing/projects page.
 */
export default function Scene3D({ className = "h-[400px] sm:h-[500px]", showBorder = true }: { className?: string, showBorder?: boolean }) {
  return (
    <div className={`w-full ${className} mb-8 overflow-hidden relative ${showBorder ? 'rounded-3xl border border-white/10 bg-gray-900/20 shadow-2xl' : ''}`}>
      <div className="absolute inset-0 z-0">
        <Spline 
          scene="https://prod.spline.design/tbVnt2WrYvnxXXsy/scene.splinecode" 
        />
      </div>
      {/* Blocking layer to hide Spline watermark */}
      <div className="absolute bottom-0 right-0 w-32 h-10 bg-gray-900/0 pointer-events-none z-10" style={{ backdropFilter: 'blur(0px)' }}>
          <div className="absolute inset-0 bg-[#0a0a0a]" style={{ clipPath: 'inset(40% 0 0 40%)' }}></div>
      </div>
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
    </div>
  );
}
