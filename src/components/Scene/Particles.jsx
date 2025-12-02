// src/components/Scene/Particles.jsx
import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber' // 引入 useThree 用於獲取螢幕寬度
import * as THREE from 'three'

export default function Particles({ handData }) {
  // 獲取視窗的寬高 (Three.js 單位)，這能確保手的位置跟滑鼠/螢幕 1:1 對應
  const { viewport } = useThree() 
  
  const pointsRef = useRef()
  // 新增：記錄上一幀捏合狀態
  const prevPinchRef = useRef(false)
  // 新增：記錄爆炸波的剩餘能量 (0 ~ 1)
  const shockwaveRef = useRef(0)
  
  const count = 5000 // 粒子數量

  // 初始化數據：位置、原始位置、速度、顏色
  const { positions, originalPositions, velocities, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const originalPositions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3) // 速度向量 (vx, vy, vz)
    const colors = new Float32Array(count * 3)
    
    const color1 = new THREE.Color("#00ffff") // 青色 (平靜)

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      // 擴大分佈範圍，更有氣勢
      const x = (Math.random() - 0.5) * 15
      const y = (Math.random() - 0.5) * 15
      const z = (Math.random() - 0.5) * 15
      
      positions.set([x, y, z], i3)
      originalPositions.set([x, y, z], i3)
      velocities.set([0, 0, 0], i3) // 初始靜止
      
      colors.set([color1.r, color1.g, color1.b], i3)
    }
    
    return { positions, originalPositions, velocities, colors }
  }, [])

  useFrame((state, delta) => {
    if (!pointsRef.current) return

    const posAttr = pointsRef.current.geometry.attributes.position
    const colAttr = pointsRef.current.geometry.attributes.color

    // 1. 處理手勢觸發 (這裡只取第一隻手的捏合來觸發全域爆炸，簡化邏輯)
    // 如果你有兩隻手，任一隻手放開都能觸發衝擊波
    const anyHandPinching = handData.some(h => h.isPinching)
    
    if (prevPinchRef.current && !anyHandPinching) {
      shockwaveRef.current = 1.0 
    }
    prevPinchRef.current = anyHandPinching

    if (shockwaveRef.current > 0) {
      shockwaveRef.current -= delta * 2.0 
      if (shockwaveRef.current < 0) shockwaveRef.current = 0
    }

    const calmColor = new THREE.Color("#00ffff") 
    const pinchColor = new THREE.Color("#ff0055") 
    const whiteColor = new THREE.Color("#ffffff")
    const tempColor = new THREE.Color()

    // 2. 定義邊界 (根據當前視窗大小)
    // viewport.width 是 Three.js 場景的可視寬度，這確保了精準對應
    const boundX = viewport.width / 2 + 1 // 左右邊界
    const boundY = viewport.height / 2 + 1 // 上下邊界
    const boundZ = 5 // 前後邊界

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const px = posAttr.array[i3]
      const py = posAttr.array[i3 + 1]
      const pz = posAttr.array[i3 + 2]

      let vx = velocities[i3]
      let vy = velocities[i3 + 1]
      let vz = velocities[i3 + 2]

      // --- [A] 手勢互動 (遍歷每一隻手) ---
      let affectedByHand = false
      
      handData.forEach(hand => {
        // 將標準化座標轉換為真實的世界座標 (這就是精準度的關鍵！)
        const targetX = hand.x * viewport.width
        const targetY = hand.y * viewport.height
        
        const dx = targetX - px
        const dy = targetY - py
        const dz = 0 - pz
        
        const distSq = dx*dx + dy*dy + dz*dz
        const dist = Math.sqrt(distSq) + 0.1

        // 根據捏合狀態給予不同的力
        if (hand.isPinching) {
          // 捏合：強力黑洞吸引
          const force = 20.0 * delta
          vx += (dx / dist) * force
          vy += (dy / dist) * force
          vz += (dz / dist) * force
          affectedByHand = true
        } else {
          // 張開：溫和的氣流跟隨
          const force = 5.0 * delta
          vx += (dx / dist) * force
          vy += (dy / dist) * force
          vz += (dz / dist) * force
          
          // 旋轉力 (讓粒子繞著手轉)
          const spin = 5.0 * delta
          vx += -dy * spin / dist // 除以 dist 讓近處旋轉快，遠處慢
          vy += dx * spin / dist
        }
      })

      // --- [B] 全域特效 ---
      if (shockwaveRef.current > 0) {
        // 簡單的爆炸：從中心向外推
        const distOrigin = Math.sqrt(px*px + py*py + pz*pz) + 0.1
        const boom = 50.0 * delta * shockwaveRef.current
        vx += (px / distOrigin) * boom
        vy += (py / distOrigin) * boom
        vz += (pz / distOrigin) * boom * 2
        
        // 爆炸變色
        tempColor.set(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i))
        tempColor.lerp(whiteColor, 0.2)
      } else if (affectedByHand) {
        // 如果被手影響，變紅
        tempColor.set(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i))
        tempColor.lerp(pinchColor, 0.1)
      } else {
        // 沒人理，變回青色
        tempColor.set(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i))
        tempColor.lerp(calmColor, 0.05)
      }

      // --- [C] 歸位力 (當沒有手的時候，慢慢飄回原位) ---
      if (handData.length === 0 && shockwaveRef.current <= 0) {
        const ox = originalPositions[i3]
        const oy = originalPositions[i3 + 1]
        const oz = originalPositions[i3 + 2]
        vx += (ox - px) * 1.0 * delta
        vy += (oy - py) * 1.0 * delta
        vz += (oz - pz) * 1.0 * delta
      }

      // --- [D] 邊界檢查 (Wall Bounce) ---
      // 這是防止粒子散開到外面的關鍵
      const bounceFactor = -0.6 // 反彈係數 (負數代表反向，0.6 代表損失一點能量)
      
      if (px > boundX) { vx *= bounceFactor; posAttr.array[i3] = boundX; }
      else if (px < -boundX) { vx *= bounceFactor; posAttr.array[i3] = -boundX; }

      if (py > boundY) { vy *= bounceFactor; posAttr.array[i3 + 1] = boundY; }
      else if (py < -boundY) { vy *= bounceFactor; posAttr.array[i3 + 1] = -boundY; }
      
      if (pz > boundZ) { vz *= bounceFactor; posAttr.array[i3 + 2] = boundZ; }
      else if (pz < -boundZ) { vz *= bounceFactor; posAttr.array[i3 + 2] = -boundZ; }

      // --- [E] 更新位置與速度 ---
      // 阻尼 (空氣阻力)
      const friction = 0.95
      vx *= friction
      vy *= friction
      vz *= friction

      posAttr.array[i3] += vx
      posAttr.array[i3 + 1] += vy
      posAttr.array[i3 + 2] += vz

      velocities[i3] = vx
      velocities[i3 + 1] = vy
      velocities[i3 + 2] = vz

      colAttr.setXYZ(i, tempColor.r, tempColor.g, tempColor.b)
    }

    posAttr.needsUpdate = true
    colAttr.needsUpdate = true
    pointsRef.current.rotation.y += delta * 0.05
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={count} array={colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.1}
        vertexColors={true} // 啟用頂點顏色，這樣才能變色
        sizeAttenuation={true}
        transparent={true}
        opacity={0.8}
        blending={THREE.AdditiveBlending} // 發光疊加模式
        depthWrite={false} // 關閉深度寫入，讓粒子重疊時更亮
      />
    </points>
  )
}