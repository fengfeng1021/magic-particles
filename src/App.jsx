// src/App.jsx
import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Particles from './components/Scene/Particles'
import HandTracker from './components/Webcam/HandTracker'

function App() {
  // handData 現在會包含 { x, y, isPinching }
  const [handData, setHandData] = useState(null)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      
      {/* 屬性名稱改為 onHandUpdate 比較語意化 */}
      <HandTracker onHandUpdate={(data) => setHandData(data)} />

      <Canvas camera={{ position: [0, 0, 8], fov: 60 }} gl={{ antialias: false }}>
        <color attach="background" args={['black']} />
        
        {/* 將整個 handData 物件傳給粒子 */}
        <Particles handData={handData} />
        
        {/* 為了效能，我們可以移除 OrbitControls，因為現在是用手控 */}
      </Canvas>

      {/* UI 提示 */}
      <div style={{
        position: 'absolute', top: '20px', left: '20px', color: 'white', pointerEvents: 'none', fontFamily: 'monospace'
      }}>
        <h2>Magic Particles v2</h2>
        <p>狀態: {handData ? (handData.isPinching ? "🔴 蓄力中 (PINCH)" : "🔵 跟隨中 (FOLLOW)") : "等待手勢..."}</p>
      </div>
    </div>
  )
}

export default App