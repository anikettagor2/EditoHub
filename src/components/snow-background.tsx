"use client";

import React from "react";
import Snowfall from "react-snowfall";

export function SnowBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <Snowfall
        color="#6366f1" // Primary color (Indigo 500)
        style={{
          position: "fixed",
          width: "100vw",
          height: "100vh",
          zIndex: 0, 
        }}
        snowflakeCount={100}
        radius={[0.5, 2.0]}
        speed={[0.5, 2.0]}
        wind={[-0.5, 2.0]}
        opacity={[0.1, 0.4]} 
      />
    </div>
  );
}
